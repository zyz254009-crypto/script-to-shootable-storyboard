#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  artifactId,
  directExecution,
  findObjectsWithKey,
  isArtifactCandidate,
  issue,
  makeReport,
  runValidatorCli,
} from "./lib/core.mjs";

const VALIDATOR = "validate-model-capabilities";
const HELP = "Usage: node validate-model-capabilities.mjs <project.json>\nValidate generation duration, references, and unknown capability dependencies.";
const DEFAULT_MODEL_ID = "bytedance-seedance-2.0";
const REGISTRY_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../references/model-registry.yaml",
);

function numberFrom(block, pattern, fallback) {
  const match = block.match(pattern);
  return match ? Number(match[1]) : fallback;
}

function registryProfile(modelId = DEFAULT_MODEL_ID) {
  const fallback = {
    model_id: modelId,
    registry_version: "fallback",
    duration_minimum: 4,
    duration_maximum: 15,
    image_maximum_items: 9,
    video_maximum_items: 3,
    video_total_duration_seconds_maximum: 15,
    audio_maximum_items: 3,
    audio_total_duration_seconds_maximum: 15,
    source: "fallback-defaults",
  };
  try {
    const text = readFileSync(REGISTRY_PATH, "utf8");
    const registryVersion =
      text.match(/^registry_version:\s*"?([^"\r\n]+)"?/m)?.[1] ??
      fallback.registry_version;
    const modelStart = text.indexOf(`model_id: "${modelId}"`);
    if (modelStart < 0) return { ...fallback, registry_version: registryVersion };
    const nextModel = text.indexOf("\n  - model_id:", modelStart + 1);
    const modelBlock =
      nextModel < 0 ? text.slice(modelStart) : text.slice(modelStart, nextModel);
    return {
      model_id: modelId,
      registry_version: registryVersion,
      duration_minimum: numberFrom(
        modelBlock,
        /output_duration_seconds:[\s\S]*?minimum:\s*(\d+(?:\.\d+)?)/,
        fallback.duration_minimum,
      ),
      duration_maximum: numberFrom(
        modelBlock,
        /output_duration_seconds:[\s\S]*?maximum:\s*(\d+(?:\.\d+)?)/,
        fallback.duration_maximum,
      ),
      image_maximum_items: numberFrom(
        modelBlock,
        /reference_limits:[\s\S]*?image:[\s\S]*?maximum_items:\s*(\d+)/,
        fallback.image_maximum_items,
      ),
      video_maximum_items: numberFrom(
        modelBlock,
        /reference_limits:[\s\S]*?video:[\s\S]*?maximum_items:\s*(\d+)/,
        fallback.video_maximum_items,
      ),
      video_total_duration_seconds_maximum: numberFrom(
        modelBlock,
        /reference_limits:[\s\S]*?video:[\s\S]*?total_duration_seconds_maximum:\s*(\d+(?:\.\d+)?)/,
        fallback.video_total_duration_seconds_maximum,
      ),
      audio_maximum_items: numberFrom(
        modelBlock,
        /reference_limits:[\s\S]*?audio:[\s\S]*?maximum_items:\s*(\d+)/,
        fallback.audio_maximum_items,
      ),
      audio_total_duration_seconds_maximum: numberFrom(
        modelBlock,
        /reference_limits:[\s\S]*?audio:[\s\S]*?total_duration_seconds_maximum:\s*(\d+(?:\.\d+)?)/,
        fallback.audio_total_duration_seconds_maximum,
      ),
      source: REGISTRY_PATH,
    };
  } catch {
    return fallback;
  }
}

function modelIdFor(task) {
  return (
    task.model_profile?.model_profile_id ??
    task.model_profile_id ??
    task.seedance_model_profile_id ??
    DEFAULT_MODEL_ID
  );
}

export async function validateModelCapabilities(project, { inputPath } = {}) {
  const issues = [];
  const profilesUsed = new Map();
  for (const { value: task, pointer } of findObjectsWithKey(project, "generation_task_id")) {
    if (!isArtifactCandidate(task, "generation-task.schema.json", pointer)) continue;
    const profile = registryProfile(modelIdFor(task));
    profilesUsed.set(profile.model_id, {
      registry_version: profile.registry_version,
      source: profile.source,
    });
    const id = artifactId(task);
    const duration = task.duration_seconds ?? task.capture_or_generation_duration_seconds;
    if (
      typeof duration === "number" &&
      (duration < profile.duration_minimum || duration > profile.duration_maximum)
    ) issues.push(issue({ severity: "error", rule_id: "MODEL-001", artifact_id: id, field_path: `${pointer}/duration_seconds`, evidence: `${profile.model_id} registry ${profile.registry_version} verified duration is ${profile.duration_minimum}–${profile.duration_maximum} seconds.`, repair_owner: "model-compiler" }));
    const images = task.reference_assets?.images ?? [];
    const videos = task.reference_assets?.videos ?? [];
    const audio = task.reference_assets?.audio ?? [];
    if (images.length > profile.image_maximum_items) issues.push(issue({ severity: "error", rule_id: "MODEL-002", artifact_id: id, field_path: `${pointer}/reference_assets/images`, evidence: `Image reference count exceeds registry limit ${profile.image_maximum_items}.`, repair_owner: "model-compiler" }));
    if (videos.length > profile.video_maximum_items) issues.push(issue({ severity: "error", rule_id: "MODEL-003", artifact_id: id, field_path: `${pointer}/reference_assets/videos`, evidence: `Video reference count exceeds registry limit ${profile.video_maximum_items}.`, repair_owner: "model-compiler" }));
    if (audio.length > profile.audio_maximum_items) issues.push(issue({ severity: "error", rule_id: "MODEL-004", artifact_id: id, field_path: `${pointer}/reference_assets/audio`, evidence: `Audio reference count exceeds registry limit ${profile.audio_maximum_items}.`, repair_owner: "model-compiler" }));
    const durationOf = (entry) =>
      Number.isFinite(entry?.source_in_seconds) && Number.isFinite(entry?.source_out_seconds)
        ? Math.max(0, entry.source_out_seconds - entry.source_in_seconds)
        : 0;
    const videoSeconds = videos.reduce((sum, entry) => sum + durationOf(entry), 0);
    const audioSeconds = audio.reduce((sum, entry) => sum + durationOf(entry), 0);
    if (videoSeconds > profile.video_total_duration_seconds_maximum) issues.push(issue({ severity: "error", rule_id: "MODEL-006", artifact_id: id, field_path: `${pointer}/reference_assets/videos`, evidence: `Total referenced video duration exceeds registry limit ${profile.video_total_duration_seconds_maximum} seconds.`, repair_owner: "model-compiler" }));
    if (audioSeconds > profile.audio_total_duration_seconds_maximum) issues.push(issue({ severity: "error", rule_id: "MODEL-007", artifact_id: id, field_path: `${pointer}/reference_assets/audio`, evidence: `Total referenced audio duration exceeds registry limit ${profile.audio_total_duration_seconds_maximum} seconds.`, repair_owner: "model-compiler" }));
    if ((task.unknown_capability_dependencies?.length ?? 0) > 0 && !task.runtime_capability_snapshot_id) issues.push(issue({ severity: "blocker", rule_id: "MODEL-005", artifact_id: id, field_path: `${pointer}/unknown_capability_dependencies`, evidence: "Unknown capabilities require a runtime capability snapshot.", repair_owner: "human-review" }));
  }
  return makeReport({
    validator: VALIDATOR,
    inputPath,
    issues,
    metadata: { model_registry_profiles: Object.fromEntries(profilesUsed) },
  });
}
if (directExecution(import.meta.url)) await runValidatorCli({ validator: VALIDATOR, validate: validateModelCapabilities, help: HELP });

#!/usr/bin/env node
import fs from "node:fs";
import { pathToFileURL } from "node:url";

export const VALIDATOR = "validate-prompt-alignment";
export const RULE_VERSION = "1.0.0";

const HELP = `Usage: node validate-prompt-alignment.mjs <project.json|-> [--pretty]

Cross-check Shot List and Generation Task IDs, timing, state hashes, subjects, props,
audio events, prompt segments, and task mode. "-" reads stdin.

Exit codes: 0 no blocking issue; 1 repairable error; 2 invalid input/execution;
3 human authorization or judgment required.`;
const arr = (v) => v == null ? [] : Array.isArray(v) ? v : [v];
const present = (v) => v !== undefined && v !== null && v !== "";

function collect(root, predicate) {
  const out = [];
  const seen = new WeakSet();
  const walk = (v) => {
    if (!v || typeof v !== "object" || seen.has(v)) return;
    seen.add(v);
    if (predicate(v)) out.push(v);
    for (const child of Object.values(v)) walk(child);
  };
  walk(root);
  return out;
}

function issueFactory() {
  let n = 0;
  return (severity, ruleId, artifactId, fieldPath, message, evidence = {}, options = {}) => ({
    issue_id: `${VALIDATOR}-${String(++n).padStart(4, "0")}`,
    severity, validator: VALIDATOR, artifact_id: artifactId ?? "project", field_path: fieldPath,
    rule_id: ruleId, rule_version: RULE_VERSION,
    evidence: { message, ...evidence },
    repair_owner: options.repairOwner ?? "seedance-compiler",
    repair_scope: options.repairScope ?? "generation-task",
    repairable: options.repairable ?? true,
    autofix_allowed: false,
    automatic_fix_allowed: false,
    human_review_required: options.humanReviewRequired ?? false,
    status: "open",
  });
}

function makeReport(project, issues, status = null) {
  const normalizedIssues = issues.map((entry) => ({
    ...entry,
    autofix_allowed: entry.autofix_allowed === true || entry.automatic_fix_allowed === true,
    automatic_fix_allowed: entry.autofix_allowed === true || entry.automatic_fix_allowed === true,
  }));
  const summary = { blocker: 0, error: 0, warning: 0, suggestion: 0, total: normalizedIssues.length };
  for (const i of normalizedIssues) summary[i.severity] += 1;
  return {
    schema_version: "1.0.0", report_type: "quality-report", validator: VALIDATOR,
    rule_version: RULE_VERSION, generated_at: new Date().toISOString(),
    artifact_id: project?.job_id ?? project?.project_id ?? "project",
    status: status ?? (summary.blocker || summary.error ? "failed" : summary.warning ? "passed_with_warnings" : "passed"),
    summary, issues: normalizedIssues,
  };
}

function hasId(list, id) {
  return arr(list).includes(id);
}

export function validatePromptAlignment(project) {
  const issues = [];
  const issue = issueFactory();
  const add = (...args) => issues.push(issue(...args));
  const shots = collect(project, (v) => present(v?.shot_id) && present(v?.dominant_shot_size)
    && present(v?.visible_action));
  const tasks = collect(project, (v) => present(v?.generation_task_id) && Array.isArray(v?.shot_ids)
    && Array.isArray(v?.timeline_prompt));
  if (!tasks.length) return makeReport(project, [], "not_applicable");
  const shotMap = new Map(shots.map((v) => [v.shot_id, v]));

  for (const task of tasks) {
    const taskId = task.generation_task_id;
    const path = `generation_tasks.${taskId}`;
    const taskShots = arr(task.shot_ids);
    if (["atomic_shot", "shot_segment"].includes(task.task_mode) && taskShots.length !== 1) {
      add("error", "PROMPT.TASK_MODE_SHOT_COUNT", taskId, `${path}.shot_ids`,
        `${task.task_mode} must reference exactly one Shot.`, { shot_ids: taskShots });
    }
    if (task.task_mode === "multi_shot_exception" && taskShots.length < 2) {
      add("error", "PROMPT.MULTISHOT_EXCEPTION_EMPTY", taskId, `${path}.shot_ids`,
        "multi_shot_exception must reference at least two Shots.", { shot_ids: taskShots });
    }

    const resolved = [];
    for (const shotId of taskShots) {
      const shot = shotMap.get(shotId);
      if (!shot) {
        add("blocker", "PROMPT.UNKNOWN_SHOT_REFERENCE", taskId, `${path}.shot_ids`,
          `Generation Task references missing Shot ${shotId}.`, { shot_id: shotId });
      } else resolved.push(shot);
    }
    if (!resolved.length) continue;

    const expectedDuration = Math.max(...resolved.map((s) => Number(s.capture_or_generation_duration_seconds) || 0));
    if (Number.isFinite(task.duration_seconds) && expectedDuration > task.duration_seconds + 0.001) {
      add("error", "PROMPT.TASK_DURATION_TOO_SHORT", taskId, `${path}.duration_seconds`,
        "Generation duration is shorter than the referenced Shot capture/generation duration.",
        { task_duration_seconds: task.duration_seconds, required_seconds: expectedDuration });
    }

    const segments = [...arr(task.timeline_prompt)].sort((a, b) => a.start_seconds - b.start_seconds);
    const segmentShotIds = new Set(segments.map((s) => s.shot_id).filter(Boolean));
    for (const [index, segment] of segments.entries()) {
      if (!Number.isFinite(segment.start_seconds) || !Number.isFinite(segment.end_seconds)
        || segment.start_seconds < 0 || segment.end_seconds <= segment.start_seconds
        || segment.end_seconds > task.duration_seconds + 0.001) {
        add("error", "PROMPT.SEGMENT_TIME_INVALID", taskId, `${path}.timeline_prompt[${index}]`,
          "Prompt segment must fit inside the Generation Task duration.", { segment, duration_seconds: task.duration_seconds });
      }
      if (segment.shot_id && !taskShots.includes(segment.shot_id)) {
        add("error", "PROMPT.SEGMENT_SHOT_OUTSIDE_TASK", taskId, `${path}.timeline_prompt[${index}].shot_id`,
          `Prompt segment references Shot ${segment.shot_id}, which is not owned by the Task.`, { task_shot_ids: taskShots });
      }
      if (!present(segment.visual_instruction) || !present(segment.camera_instruction)) {
        add("error", "PROMPT.SEGMENT_INSTRUCTION_MISSING", taskId, `${path}.timeline_prompt[${index}]`,
          "Each prompt segment needs both visual and camera instructions.",
          { visual_instruction_present: present(segment.visual_instruction),
            camera_instruction_present: present(segment.camera_instruction) });
      }
    }
    if (taskShots.length > 1) {
      for (const shotId of taskShots) if (!segmentShotIds.has(shotId)) {
        add("error", "PROMPT.SHOT_HAS_NO_SEGMENT", taskId, `${path}.timeline_prompt`,
          `Multi-shot Task has no timeline segment for Shot ${shotId}.`, { shot_id: shotId });
      }
    }

    const first = resolved[0];
    const last = resolved[resolved.length - 1];
    const targets = task.continuity_targets ?? {};
    if (present(targets.required_start_state_hash) && present(first.start_state?.state_hash)
      && targets.required_start_state_hash !== first.start_state.state_hash) {
      add("blocker", "PROMPT.START_STATE_HASH_MISMATCH", taskId, `${path}.continuity_targets.required_start_state_hash`,
        "Generation Task start-state hash conflicts with the first Shot.", {
          task_hash: targets.required_start_state_hash, shot_hash: first.start_state.state_hash, shot_id: first.shot_id });
    }
    if (present(targets.required_end_state_hash) && present(last.end_state?.state_hash)
      && targets.required_end_state_hash !== last.end_state.state_hash) {
      add("blocker", "PROMPT.END_STATE_HASH_MISMATCH", taskId, `${path}.continuity_targets.required_end_state_hash`,
        "Generation Task end-state hash conflicts with the last Shot.", {
          task_hash: targets.required_end_state_hash, shot_hash: last.end_state.state_hash, shot_id: last.shot_id });
    }
    if (present(task.first_frame?.continuity_state_hash) && present(first.start_state?.state_hash)
      && task.first_frame.continuity_state_hash !== first.start_state.state_hash) {
      add("error", "PROMPT.FIRST_FRAME_STATE_MISMATCH", taskId, `${path}.first_frame.continuity_state_hash`,
        "First-frame continuity hash does not match the first Shot start state.");
    }
    if (present(task.last_frame_target?.continuity_state_hash) && present(last.end_state?.state_hash)
      && task.last_frame_target.continuity_state_hash !== last.end_state.state_hash) {
      add("error", "PROMPT.LAST_FRAME_STATE_MISMATCH", taskId, `${path}.last_frame_target.continuity_state_hash`,
        "Last-frame continuity hash does not match the final Shot end state.");
    }

    const expectedSubjects = new Set(resolved.flatMap((s) =>
      [s.primary_subject_id, ...arr(s.supporting_subject_ids)].filter(Boolean)));
    const lockedSubjects = new Set(arr(task.subject_lock).map((s) => s?.subject_id).filter(Boolean));
    for (const id of arr(targets.locked_character_ids)) lockedSubjects.add(id);
    for (const id of expectedSubjects) if (!lockedSubjects.has(id)) {
      add("warning", "PROMPT.SUBJECT_NOT_LOCKED", taskId, `${path}.subject_lock`,
        `Shot subject ${id} has no subject lock or continuity lock.`, { subject_id: id });
    }

    const expectedProps = new Set(resolved.flatMap((s) => arr(s.prop_ids)));
    const lockedProps = new Set(arr(targets.locked_prop_ids));
    for (const id of expectedProps) if (!lockedProps.has(id)
      && !arr(task.reference_assets?.images).some((r) => r?.purpose === "prop" && r?.asset_id === id)) {
      add("warning", "PROMPT.PROP_NOT_LOCKED", taskId, `${path}.continuity_targets.locked_prop_ids`,
        `Shot prop ${id} is not explicitly locked in the Generation Task.`, { prop_id: id });
    }

    const expectedAudio = new Set(resolved.flatMap((s) => arr(s.audio_event_ids)));
    const taskAudio = new Set(arr(task.audio_requirements?.audio_event_ids));
    const segmentAudio = new Set(segments.flatMap((s) => arr(s.audio_event_ids)));
    for (const id of expectedAudio) if (!taskAudio.has(id) && !segmentAudio.has(id)) {
      add("error", "PROMPT.AUDIO_EVENT_DROPPED", taskId, `${path}.audio_requirements.audio_event_ids`,
        `Shot audio event ${id} is absent from the Task and timeline prompt.`, { audio_event_id: id });
    }

    const shotEntries = new Set(resolved.flatMap((s) =>
      [...arr(s.continuity_in_entry_ids), ...arr(s.continuity_out_entry_ids)]));
    for (const id of arr(targets.continuity_entry_ids)) if (shotEntries.size && !shotEntries.has(id)) {
      add("warning", "PROMPT.UNRELATED_CONTINUITY_ENTRY", taskId, `${path}.continuity_targets.continuity_entry_ids`,
        `Task continuity entry ${id} is not referenced by its Shots.`, { continuity_entry_id: id });
    }

    if (task.model_profile?.capability_status === "unknown") {
      add("blocker", "PROMPT.MODEL_CAPABILITY_UNKNOWN", taskId, `${path}.model_profile.capability_status`,
        "Generation Task relies on an unknown model capability profile.", {}, {
          humanReviewRequired: true, repairable: false, repairOwner: "model-registry-owner",
        });
    } else if (task.model_profile?.capability_status === "stale") {
      add("warning", "PROMPT.MODEL_PROFILE_STALE", taskId, `${path}.model_profile.capability_status`,
        "Model capability profile is stale and should be reverified before production.");
    }
  }
  return makeReport(project, issues);
}

export function exitCodeFor(report) {
  if (report.status === "invalid") return 2;
  if (report.issues.some((i) => i.human_review_required)) return 3;
  if (report.issues.some((i) => ["blocker", "error"].includes(i.severity))) return 1;
  return 0;
}

export async function runCli(argv = process.argv.slice(2)) {
  if (argv.includes("--help") || argv.includes("-h")) { process.stdout.write(`${HELP}\n`); return 0; }
  const pretty = argv.includes("--pretty");
  const input = argv.find((v) => !v.startsWith("-")) ?? (argv.includes("-") ? "-" : null);
  if (!input) throw new Error("Missing project JSON path.");
  const project = JSON.parse(input === "-" ? fs.readFileSync(0, "utf8") : fs.readFileSync(input, "utf8"));
  const report = validatePromptAlignment(project);
  process.stdout.write(`${JSON.stringify(report, null, pretty ? 2 : 0)}\n`);
  return exitCodeFor(report);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().then((code) => { process.exitCode = code; }).catch((error) => {
    const issue = issueFactory()("blocker", "PROMPT.EXECUTION_FAILURE", "project", "$", error.message,
      { name: error.name }, { repairOwner: "pipeline-operator", repairable: false });
    process.stdout.write(`${JSON.stringify(makeReport({}, [issue], "invalid"))}\n`);
    process.exitCode = 2;
  });
}

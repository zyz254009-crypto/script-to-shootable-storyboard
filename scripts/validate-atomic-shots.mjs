#!/usr/bin/env node

import {
  artifactId,
  directExecution,
  exitCodeForIssues,
  findObjectsWithKey,
  issue,
  joinPointer,
  joinPointerPath,
  makeReport,
  runValidatorCli,
} from "./lib/core.mjs";

const VALIDATOR = "validate-atomic-shots";

const HIDDEN_EDIT_PATTERN =
  /(?:镜头|画面)?(?:切到|切至|再切|跳切|转场到)|\b(?:cut|cuts|cutting)\s+to\b|\b(?:smash|match|jump)\s+cut\b/i;
const TIME_SPACE_JUMP_PATTERN =
  /第二天|数[小时天]后|几[小时天]后|多年后|与此同时.{0,18}(?:另一|别处|外面)|转眼(?:来到|到了)|随后.{0,12}(?:回到家|抵达|来到另一个|出现在)|\b(?:later that day|the next day|years later|at another location|meanwhile,? elsewhere)\b/i;
const ACTION_CONNECTOR_PATTERN =
  /然后|随后|接着|紧接着|又|再(?:次)?|与此同时|继而|之后|并且|and then|after that|meanwhile/gi;
const CAMERA_TERMS =
  /固定|手持|推近|拉远|摇摄|横移|升高|降低|环绕|跟拍|变焦|locked|handheld|dolly|truck|pedestal|arc|crane|zoom|follow/gi;

const SHOT_SIZE_TERMS = Object.freeze({
  extreme_wide: /大远景|极远景|extreme[_ -]?wide/gi,
  wide: /(?<!极)远景|\bwide\b/gi,
  full: /全身景|\bfull(?: shot)?\b/gi,
  medium_wide: /中远景|medium[_ -]?wide/gi,
  medium: /(?<!近)中景|\bmedium(?: shot)?\b/gi,
  medium_close: /中近景|medium[_ -]?close/gi,
  close_up: /(?<!极)近景|特写|close[_ -]?up/gi,
  extreme_close_up: /大特写|极特写|extreme[_ -]?close/gi,
  insert: /插入镜头|物件特写|\binsert\b/gi,
  over_shoulder: /过肩(?:镜头)?|over[_ -]?shoulder/gi,
  two_shot: /双人(?:镜头|景)|two[_ -]?shot/gi,
  group_shot: /群像(?:镜头|景)|group[_ -]?shot/gi,
  pov: /主观(?:镜头|视角)|\bpov\b/gi,
});

function extractShotSizes(text) {
  const found = new Set();
  for (const [name, pattern] of Object.entries(SHOT_SIZE_TERMS)) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) found.add(name);
  }
  return found;
}

function countMatches(text, pattern) {
  pattern.lastIndex = 0;
  return [...String(text).matchAll(pattern)].length;
}

function validateLongTake(shot, pointer, issues) {
  const id = artifactId(shot);
  const startSize = shot.start_composition?.shot_size;
  const endSize = shot.end_composition?.shot_size;
  if (shot.long_take_exception) {
    for (const field of [
      "long_take_exception_reason",
      "continuous_camera_path",
      "long_take_fallback_plan",
    ]) {
      const value = shot[field];
      const missing = Array.isArray(value)
        ? value.length === 0
        : !String(value ?? "").trim();
      if (missing) {
        issues.push(
          issue({
            severity: "error",
            rule_id: "ATOMIC-LONG-001",
            artifact_id: id,
            field_path: joinPointer(pointer, field),
            evidence: `Long-take exception requires "${field}".`,
            repair_owner: "atomic-shot-designer",
            autofix_allowed: false,
          }),
        );
      }
    }
    if (
      !["adjacent_size_continuous", "declared_long_take_path"].includes(
        shot.allowed_composition_drift,
      )
    ) {
      issues.push(
        issue({
          severity: "error",
          rule_id: "ATOMIC-LONG-002",
          artifact_id: id,
          field_path: joinPointer(pointer, "allowed_composition_drift"),
          evidence:
            "Long-take exception must declare a continuous composition-drift mode.",
          repair_owner: "atomic-shot-designer",
          autofix_allowed: false,
        }),
      );
    }
  } else {
    if (startSize && endSize && startSize !== endSize) {
      issues.push(
        issue({
          severity: "error",
          rule_id: "ATOMIC-SIZE-001",
          artifact_id: id,
          field_path: joinPointerPath(pointer, "end_composition", "shot_size"),
          evidence: `Atomic shot changes from ${startSize} to ${endSize} without a long-take exception.`,
          repair_owner: "atomic-shot-designer",
          autofix_allowed: false,
        }),
      );
    }
    if (
      ["adjacent_size_continuous", "declared_long_take_path"].includes(
        shot.allowed_composition_drift,
      )
    ) {
      issues.push(
        issue({
          severity: "error",
          rule_id: "ATOMIC-SIZE-002",
          artifact_id: id,
          field_path: joinPointer(pointer, "allowed_composition_drift"),
          evidence:
            "Non-exception atomic shots may only use none or same_size_minor composition drift.",
          repair_owner: "atomic-shot-designer",
          autofix_allowed: false,
        }),
      );
    }
  }
  if (
    startSize &&
    endSize &&
    startSize === endSize &&
    shot.dominant_shot_size &&
    shot.dominant_shot_size !== startSize
  ) {
    issues.push(
      issue({
        severity: "error",
        rule_id: "ATOMIC-SIZE-003",
        artifact_id: id,
        field_path: joinPointer(pointer, "dominant_shot_size"),
        evidence: `Dominant size ${shot.dominant_shot_size} conflicts with both compositions (${startSize}).`,
        repair_owner: "atomic-shot-designer",
        autofix_allowed: false,
      }),
    );
  }
}

function validateTextualAtomicity(shot, pointer, issues) {
  const id = artifactId(shot);
  const fields = [
    ["visible_action", shot.visible_action],
    ["narrative_purpose", shot.narrative_purpose],
    ["camera_position", shot.camera_position],
    ["camera_motion/path", shot.camera_motion?.path],
    ["continuous_camera_path", shot.continuous_camera_path],
  ];
  for (const [field, raw] of fields) {
    const text = String(raw ?? "");
    if (!text) continue;
    if (HIDDEN_EDIT_PATTERN.test(text)) {
      issues.push(
        issue({
          severity: "error",
          rule_id: "ATOMIC-EDIT-001",
          artifact_id: id,
          field_path: joinPointer(pointer, field),
          evidence: `Text contains an internal edit instruction: ${text}`,
          repair_owner: "atomic-shot-designer",
          autofix_allowed: false,
        }),
      );
    }
    if (TIME_SPACE_JUMP_PATTERN.test(text)) {
      issues.push(
        issue({
          severity: "error",
          rule_id: "ATOMIC-SPACETIME-001",
          artifact_id: id,
          field_path: joinPointer(pointer, field),
          evidence: `Text appears to jump time or location inside one shot: ${text}`,
          repair_owner: "atomic-shot-designer",
          autofix_allowed: false,
        }),
      );
    }
    const sizes = extractShotSizes(text);
    if (sizes.size > 1 && !shot.long_take_exception) {
      issues.push(
        issue({
          severity: "error",
          rule_id: "ATOMIC-SIZE-004",
          artifact_id: id,
          field_path: joinPointer(pointer, field),
          evidence: `Multiple shot sizes are embedded in one atomic shot: ${[
            ...sizes,
          ].join(", ")}.`,
          repair_owner: "atomic-shot-designer",
          autofix_allowed: false,
        }),
      );
    }
  }
}

function validateActionLoad(shot, pointer, issues) {
  const id = artifactId(shot);
  const action = String(shot.visible_action ?? "");
  const connectors = countMatches(action, ACTION_CONNECTOR_PATTERN);
  const clauses = action
    .split(/[；;。.!?！？]/)
    .map((item) => item.trim())
    .filter(Boolean).length;
  if (connectors >= 4 || clauses >= 5) {
    issues.push(
      issue({
        severity: "warning",
        rule_id: "ATOMIC-ACTION-001",
        artifact_id: id,
        field_path: joinPointer(pointer, "visible_action"),
        evidence: `Action may contain multiple independent result units (${connectors} sequential connectors, ${clauses} clauses).`,
        repair_owner: "atomic-shot-designer",
        autofix_allowed: false,
      }),
    );
  }

  const motion = shot.camera_motion ?? {};
  const pathText = String(motion.path ?? "");
  const cameraTerms = new Set(
    (pathText.match(CAMERA_TERMS) ?? []).map((term) => term.toLowerCase()),
  );
  if (motion.motion_type === "compound" && !shot.long_take_exception) {
    issues.push(
      issue({
        severity: "warning",
        rule_id: "ATOMIC-CAMERA-001",
        artifact_id: id,
        field_path: joinPointerPath(pointer, "camera_motion", "motion_type"),
        evidence:
          "Compound camera motion is high-risk in default atomic mode; declare the single dominant movement or a long-take exception.",
        repair_owner: "camera-designer",
        autofix_allowed: false,
      }),
    );
  }
  if (motion.motion_type !== "compound" && cameraTerms.size >= 3) {
    issues.push(
      issue({
        severity: "error",
        rule_id: "ATOMIC-CAMERA-002",
        artifact_id: id,
        field_path: joinPointerPath(pointer, "camera_motion", "path"),
        evidence: `Camera path names multiple movements but motion_type is ${motion.motion_type}: ${[
          ...cameraTerms,
        ].join(", ")}.`,
        repair_owner: "camera-designer",
        autofix_allowed: false,
      }),
    );
  }
}

function validateSubjectContinuity(shot, pointer, issues) {
  const id = artifactId(shot);
  const subjectId = shot.primary_subject_id;
  if (!subjectId) return;
  for (const field of ["start_composition", "end_composition"]) {
    const subjectIds = shot[field]?.subject_ids;
    if (Array.isArray(subjectIds) && !subjectIds.includes(subjectId)) {
      issues.push(
        issue({
          severity: "error",
          rule_id: "ATOMIC-SUBJECT-001",
          artifact_id: id,
          field_path: joinPointerPath(pointer, field, "subject_ids"),
          evidence: `Primary subject ${subjectId} is absent from ${field}.`,
          repair_owner: "atomic-shot-designer",
          autofix_allowed: false,
        }),
      );
    }
  }
}

export async function validateAtomicShots(data, context = {}) {
  const issues = [];
  const shots = findObjectsWithKey(data, "shot_id").filter((found) =>
    Object.hasOwn(found.value, "visible_action"),
  );
  if (shots.length === 0) {
    issues.push(
      issue({
        severity: "blocker",
        rule_id: "ATOMIC-INPUT-001",
        evidence: "No shot objects with visible_action were found.",
        repair_owner: "project-orchestrator",
        autofix_allowed: false,
      }),
    );
  }

  for (const found of shots) {
    validateLongTake(found.value, found.pointer, issues);
    validateTextualAtomicity(found.value, found.pointer, issues);
    validateActionLoad(found.value, found.pointer, issues);
    validateSubjectContinuity(found.value, found.pointer, issues);
  }

  const exitCode = exitCodeForIssues(issues);
  return makeReport({
    validator: VALIDATOR,
    inputPath: context.inputPath,
    issues,
    exitCode,
    metadata: { shots_checked: shots.length },
  });
}

const HELP = `
Usage: node validate-atomic-shots.mjs <input.json>

Validate atomic-shot production rules: one dominant shot size, continuous
spacetime, no hidden edit, bounded action/camera load, explicit long-take
exceptions, and primary-subject composition continuity.

Exit codes:
  0  Passed (warnings/suggestions may remain)
  1  Contains repairable atomic-shot errors
  2  JSON, configuration, or execution failure
  3  Requires human authorization/judgment
`;

if (directExecution(import.meta.url)) {
  await runValidatorCli({
    validator: VALIDATOR,
    validate: validateAtomicShots,
    help: HELP,
  });
}

export default validateAtomicShots;

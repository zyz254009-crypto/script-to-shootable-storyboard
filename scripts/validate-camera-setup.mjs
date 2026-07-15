#!/usr/bin/env node
import { artifactId, directExecution, findObjectsWithKey, isArtifactCandidate, issue, makeReport, runValidatorCli } from "./lib/core.mjs";

const VALIDATOR = "validate-camera-setup";
const HELP = "Usage: node validate-camera-setup.mjs <project.json>\nValidate focus, axis, platform, and hybrid handoff requirements.";

export async function validateCameraSetup(project, { inputPath } = {}) {
  const issues = [];
  for (const { value: setup, pointer } of findObjectsWithKey(project, "camera_setup_id")) {
    if (!isArtifactCandidate(setup, "camera-setup.schema.json", pointer)) continue;
    const id = artifactId(setup);
    if (!(setup.supported_shot_intent_ids?.length > 0)) issues.push(issue({ severity: "error", rule_id: "CAMERA-001", artifact_id: id, field_path: `${pointer}/supported_shot_intent_ids`, evidence: "Camera setup supports no shot intents.", repair_owner: "camera-designer" }));
    if (["fixed_distance", "single_mark", "rack_focus", "continuous_subject_tracking"].includes(setup.focus_strategy) && !(setup.focus_distance_or_marks?.length > 0)) issues.push(issue({ severity: "error", rule_id: "CAMERA-002", artifact_id: id, field_path: `${pointer}/focus_distance_or_marks`, evidence: "Focus strategy requires executable focus marks.", repair_owner: "camera-designer" }));
    if (setup.axis_side === "crossing_with_plan" && !setup.axis_crossing_plan_id) issues.push(issue({ severity: "error", rule_id: "CAMERA-003", artifact_id: id, field_path: `${pointer}/axis_crossing_plan_id`, evidence: "Axis crossing setup has no crossing plan.", repair_owner: "continuity-supervisor" }));
    const h = setup.hybrid_handoff;
    if (h?.tracking_data_required && !(h.tracking_data_ids?.length > 0)) issues.push(issue({ severity: "error", rule_id: "CAMERA-004", artifact_id: id, field_path: `${pointer}/hybrid_handoff/tracking_data_ids`, evidence: "Hybrid handoff requires tracking data.", repair_owner: "vfx-supervisor" }));
    if (h?.lens_distortion_profile_required && !h.lens_distortion_profile_id) issues.push(issue({ severity: "error", rule_id: "CAMERA-005", artifact_id: id, field_path: `${pointer}/hybrid_handoff/lens_distortion_profile_id`, evidence: "Lens distortion profile is required for hybrid handoff.", repair_owner: "vfx-supervisor" }));
  }
  return makeReport({ validator: VALIDATOR, inputPath, issues });
}
if (directExecution(import.meta.url)) await runValidatorCli({ validator: VALIDATOR, validate: validateCameraSetup, help: HELP });

#!/usr/bin/env node
import { artifactId, directExecution, findObjectsWithKey, isArtifactCandidate, issue, joinPointer, makeReport, runValidatorCli } from "./lib/core.mjs";

const VALIDATOR = "validate-blocking";
const HELP = "Usage: node validate-blocking.mjs <project.json>\nValidate marks, paths, occlusion readability, collision checks, and axis plans.";

export async function validateBlocking(project, { inputPath } = {}) {
  const issues = [];
  for (const { value: plan, pointer } of findObjectsWithKey(project, "blocking_plan_id")) {
    if (!isArtifactCandidate(plan, "blocking-plan.schema.json", pointer)) continue;
    const id = artifactId(plan);
    const markIds = new Set((plan.actor_marks ?? []).map((x) => x.mark_id));
    for (const [i, mark] of (plan.actor_marks ?? []).entries()) {
      if (mark.reachable === false) issues.push(issue({ severity: "blocker", rule_id: "BLOCKING-001", artifact_id: id, field_path: `${pointer}/actor_marks/${i}/reachable`, evidence: `Actor mark ${mark.mark_id} is unreachable.`, repair_owner: "blocking-supervisor" }));
    }
    for (const [i, path] of (plan.movement_paths ?? []).entries()) {
      if (!markIds.has(path.from_mark_id) || !markIds.has(path.to_mark_id)) issues.push(issue({ severity: "error", rule_id: "BLOCKING-002", artifact_id: id, field_path: `${pointer}/movement_paths/${i}`, evidence: "Movement path references missing marks.", repair_owner: "blocking-supervisor" }));
      if (path.collision_checked !== true) issues.push(issue({ severity: "warning", rule_id: "BLOCKING-003", artifact_id: id, field_path: `${pointer}/movement_paths/${i}/collision_checked`, evidence: "Movement path has not been collision checked.", repair_owner: "blocking-supervisor" }));
    }
    for (const [i, rel] of (plan.occlusion_relations ?? []).entries()) {
      if (rel.readability === "unacceptable") issues.push(issue({ severity: "error", rule_id: "BLOCKING-004", artifact_id: id, field_path: `${pointer}/occlusion_relations/${i}/readability`, evidence: "Required subject is unreadably occluded.", repair_owner: "blocking-supervisor" }));
    }
    for (const [i, crossing] of (plan.axis_crossing_plan ?? []).entries()) {
      if (crossing.method === "intentional_disorientation" && !crossing.authorization_id) issues.push(issue({ severity: "blocker", rule_id: "BLOCKING-005", artifact_id: id, field_path: `${pointer}/axis_crossing_plan/${i}/authorization_id`, evidence: "Intentional disorientation requires authorization.", repair_owner: "authorization-review" }));
    }
  }
  return makeReport({ validator: VALIDATOR, inputPath, issues });
}
if (directExecution(import.meta.url)) await runValidatorCli({ validator: VALIDATOR, validate: validateBlocking, help: HELP });

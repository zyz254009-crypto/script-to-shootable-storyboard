#!/usr/bin/env node
import {
  artifactId,
  directExecution,
  findObjectsWithKey,
  issue,
  joinPointer,
  makeReport,
  runValidatorCli,
} from "./lib/core.mjs";

const VALIDATOR = "validate-coverage";
const HELP = "Usage: node validate-coverage.mjs <project.json>\nValidate planned and production coverage closure.";

export async function validateCoverage(project, { inputPath } = {}) {
  const issues = [];
  for (const { value: matrix, pointer } of findObjectsWithKey(project, "coverage_matrix_id")) {
    for (const [index, need] of (matrix.coverage_needs ?? []).entries()) {
      const base = joinPointer(joinPointer(pointer, "coverage_needs"), index);
      const id = need.coverage_id ?? artifactId(matrix);
      if (!(need.required_information?.length > 0)) {
        issues.push(issue({ severity: "error", rule_id: "COVERAGE-001", artifact_id: id, field_path: joinPointer(base, "required_information"), evidence: "Coverage need has no required information.", repair_owner: "coverage-editor" }));
      }
      if (!(need.candidate_shot_intent_ids?.length > 0) && need.fulfillment_status !== "waived") {
        issues.push(issue({ severity: "error", rule_id: "COVERAGE-002", artifact_id: id, field_path: joinPointer(base, "candidate_shot_intent_ids"), evidence: "Coverage need has no candidate shot intent.", repair_owner: "coverage-editor" }));
      }
      if (need.coverage_priority === "must_have" && need.fulfillment_status === "timeline_assembled") {
        if (!(need.fulfilled_by_shot_ids?.length > 0) || !(need.fulfilled_by_timeline_clip_ids?.length > 0)) {
          issues.push(issue({ severity: "blocker", rule_id: "COVERAGE-003", artifact_id: id, field_path: base, evidence: "Must-have coverage claims timeline closure without both shot and timeline clip evidence.", repair_owner: "editorial-review" }));
        }
      }
      if (need.fulfillment_status === "waived" && !need.waiver_authorization_id) {
        issues.push(issue({ severity: "blocker", rule_id: "COVERAGE-004", artifact_id: id, field_path: joinPointer(base, "waiver_authorization_id"), evidence: "Waived coverage requires authorization.", repair_owner: "authorization-review" }));
      }
    }
  }
  return makeReport({ validator: VALIDATOR, inputPath, issues });
}

if (directExecution(import.meta.url)) {
  await runValidatorCli({ validator: VALIDATOR, validate: validateCoverage, help: HELP });
}

#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const skillRoot = resolve(scriptsDir, "..");
const schemaDir = join(skillRoot, "references", "schemas");
const fixturesDir = join(scriptsDir, "test-fixtures");
const tempDir = mkdtempSync(join(tmpdir(), "storyboard-skill-regression-"));
const checks = [];

function runNode(args) {
  return spawnSync(process.execPath, args, {
    cwd: skillRoot,
    encoding: "utf8",
    windowsHide: true,
  });
}

function record(name, passed, detail = "") {
  checks.push({ name, passed, detail });
}

function assert(name, condition, detail = "") {
  record(name, Boolean(condition), condition ? "" : detail);
}

function parseJson(stdout) {
  return JSON.parse(stdout.trim());
}

function writeTempJson(name, value) {
  const path = join(tempDir, name);
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

const SUPPORTED_SCHEMA_KEYWORDS = new Set([
  "$schema",
  "$id",
  "$ref",
  "$defs",
  "$comment",
  "title",
  "description",
  "default",
  "examples",
  "type",
  "required",
  "properties",
  "items",
  "additionalProperties",
  "unevaluatedProperties",
  "propertyNames",
  "enum",
  "const",
  "minLength",
  "maxLength",
  "pattern",
  "format",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minItems",
  "maxItems",
  "uniqueItems",
  "contains",
  "minContains",
  "maxContains",
  "minProperties",
  "maxProperties",
  "allOf",
  "anyOf",
  "oneOf",
  "not",
  "if",
  "then",
  "else",
]);

function lintSchemaKeywords(schema, filename) {
  const failures = [];
  const nestedSchemaKeys = new Set([
    "items",
    "additionalProperties",
    "unevaluatedProperties",
    "propertyNames",
    "contains",
    "not",
    "if",
    "then",
    "else",
  ]);
  const schemaArrayKeys = new Set(["allOf", "anyOf", "oneOf"]);

  function lintNode(node, pointer) {
    if (!node || typeof node !== "object" || Array.isArray(node)) return;
    for (const [key, value] of Object.entries(node)) {
      if (!SUPPORTED_SCHEMA_KEYWORDS.has(key)) {
        failures.push(`${filename}${pointer}: unsupported schema keyword "${key}"`);
        continue;
      }
      if (key === "properties" || key === "$defs") {
        if (value && typeof value === "object" && !Array.isArray(value)) {
          for (const [childName, childSchema] of Object.entries(value)) {
            lintNode(childSchema, `${pointer}/${key}/${childName}`);
          }
        }
      } else if (
        nestedSchemaKeys.has(key) &&
        value &&
        typeof value === "object" &&
        !Array.isArray(value)
      ) {
        lintNode(value, `${pointer}/${key}`);
      } else if (schemaArrayKeys.has(key) && Array.isArray(value)) {
        value.forEach((childSchema, index) =>
          lintNode(childSchema, `${pointer}/${key}/${index}`),
        );
      }
    }
  }

  lintNode(schema, "#");
  return failures;
}

try {
  const scripts = readdirSync(scriptsDir)
    .filter((name) => name.endsWith(".mjs"))
    .map((name) => join(scriptsDir, name));
  for (const script of scripts) {
    const result = runNode(["--check", script]);
    assert(`syntax:${script}`, result.status === 0, result.stderr || result.stdout);
  }

  const schemas = readdirSync(schemaDir).filter((name) => name.endsWith(".json"));
  for (const schema of schemas) {
    try {
      const parsed = JSON.parse(readFileSync(join(schemaDir, schema), "utf8"));
      record(`schema-json:${schema}`, true);
      const lintFailures = lintSchemaKeywords(parsed, schema);
      assert(
        `schema-keywords:${schema}`,
        lintFailures.length === 0,
        lintFailures.join("; "),
      );
    } catch (error) {
      record(`schema-json:${schema}`, false, error.message);
    }
  }

  let result = runNode([join(scriptsDir, "check-skill-structure.mjs")]);
  assert("skill-structure", result.status === 0, result.stdout || result.stderr);

  const validPath = join(fixturesDir, "valid-project.json");
  const invalidPath = join(fixturesDir, "invalid-project.json");
  result = runNode([
    join(scriptsDir, "validate-all.mjs"),
    "--input",
    validPath,
    "--compact",
    "--require-validators",
  ]);
  const validReport = parseJson(result.stdout);
  assert(
    "validate-all:valid-project",
    result.status === 0 &&
      validReport.summary.issue_count === 0 &&
      validReport.summary.validator_count === 16,
    result.stdout || result.stderr,
  );
  assert(
    "validate-all:aggregate-severity-shape",
    Object.hasOwn(validReport.summary.by_severity, "critical") &&
      Object.hasOwn(validReport.summary.by_severity, "info"),
    result.stdout || result.stderr,
  );
  assert(
    "validate-all:preserves-reported-status",
    validReport.validators.every((entry) =>
      Object.hasOwn(entry, "reported_status"),
    ),
    result.stdout || result.stderr,
  );

  result = runNode([
    join(scriptsDir, "validate-all.mjs"),
    "--input",
    invalidPath,
    "--compact",
    "--require-validators",
  ]);
  const invalidReport = parseJson(result.stdout);
  assert(
    "validate-all:invalid-project-fails",
    result.status === 3 && invalidReport.summary.issue_count > 0,
    result.stdout || result.stderr,
  );

  result = runNode([
    join(scriptsDir, "validate-all.mjs"),
    "--input",
    validPath,
    "--no-internal",
    "--validators",
    ",",
    "--compact",
  ]);
  assert(
    "validate-all:empty-validator-list-rejected",
    result.status === 2 && /at least one validator/.test(`${result.stdout}${result.stderr}`),
    `${result.stdout}${result.stderr}`,
  );

  const validProject = JSON.parse(readFileSync(validPath, "utf8"));
  const schemaInvalid = structuredClone(validProject);
  schemaInvalid.job_spec.revision_permission = "story";
  schemaInvalid.job_spec.authorization_ids = [];
  delete schemaInvalid.job_spec.seedance_model_profile_id;
  schemaInvalid.job_spec.unexpected_extra_field = true;
  const schemaInvalidPath = writeTempJson("schema-invalid-job-spec.json", schemaInvalid);
  result = runNode([join(scriptsDir, "validate-schema.mjs"), schemaInvalidPath]);
  const schemaInvalidReport = parseJson(result.stdout);
  const schemaMessages = schemaInvalidReport.issues.map((issue) =>
    `${issue.rule_id}:${issue.field_path}:${issue.evidence}`,
  );
  assert(
    "validate-schema:catches-strict-job-spec-errors",
    result.status === 1 &&
      schemaMessages.some((text) => text.includes("unexpected_extra_field")) &&
      schemaMessages.some((text) => text.includes("seedance_model_profile_id")) &&
      schemaMessages.some((text) => text.includes("authorizations")),
    result.stdout || result.stderr,
  );

  const rightsPendingPath = writeTempJson("rights-pending.json", {
    project_id: "project-regression-rights",
    rights_manifest: {
      rights_records: [
        {
          rights_record_id: "RIGHTS-RECORD-PENDING-001",
          rights_subject_id: "RIGHTS-SUBJECT-PERSON-001",
          verification_status: "pending",
          permissions: {
            commercial_use: "allowed",
            ai_reference_use: "allowed",
            ai_generated_derivative_use: "allowed",
          },
          consent: { required: false },
          evidence: [],
        },
      ],
    },
  });
  result = runNode([join(scriptsDir, "validate-rights-safety.mjs"), rightsPendingPath]);
  assert(
    "validate-rights-safety:pending-rights-blocks",
    result.status === 3 && /RIGHTS\.RECORD_NOT_CLEARED/.test(result.stdout),
    result.stdout || result.stderr,
  );

  const modelOverflowPath = writeTempJson("model-reference-overflow.json", {
    generation_tasks: [
      {
        generation_task_id: "GENERATION-TASK-OVERFLOW-001",
        shot_ids: ["SHOT-DEMO-001"],
        task_mode: "atomic_shot",
        model_profile: {
          model_profile_id: "bytedance-seedance-2.0",
        },
        duration_seconds: 10,
        reference_assets: {
          images: Array.from({ length: 10 }, (_, index) => ({
            asset_id: `ASSET-IMAGE-${index + 1}`,
          })),
          videos: [],
          audio: [],
        },
      },
    ],
  });
  result = runNode([
    join(scriptsDir, "validate-model-capabilities.mjs"),
    modelOverflowPath,
  ]);
  assert(
    "validate-model-capabilities:image-reference-limit",
    result.status === 1 && /MODEL-002/.test(result.stdout),
    result.stdout || result.stderr,
  );

  const repairReportPath = writeTempJson("repair-report-autofix.json", {
    issues: [
      {
        issue_id: "ISSUE-REPAIR-001",
        severity: "error",
        rule_id: "TIMING-HEADTAIL-001",
        field_path: "/shot_list/shots/0/edit_duration_seconds",
        suggested_value: 6,
        automatic_fix_allowed: true,
      },
    ],
  });
  result = runNode([
    join(scriptsDir, "build-repair-plan.mjs"),
    "--report",
    repairReportPath,
    "--project",
    validPath,
    "--compact",
  ]);
  const repairPlan = parseJson(result.stdout);
  assert(
    "build-repair-plan:automatic-safe-field",
    result.status === 0 &&
      repairPlan.report_type === "repair-plan" &&
      repairPlan.operations.some((entry) => entry.op === "replace"),
    result.stdout || result.stderr,
  );

  const protectedRepairReportPath = writeTempJson("repair-report-protected.json", {
    issues: [
      {
        issue_id: "ISSUE-REPAIR-002",
        severity: "blocker",
        rule_id: "RIGHTS-STATUS-001",
        field_path: "/rights_manifest/records/0/verification_status",
        suggested_value: "verified",
        automatic_fix_allowed: true,
      },
    ],
  });
  result = runNode([
    join(scriptsDir, "build-repair-plan.mjs"),
    "--report",
    protectedRepairReportPath,
    "--project",
    validPath,
    "--compact",
  ]);
  const protectedRepairPlan = parseJson(result.stdout);
  assert(
    "build-repair-plan:protected-field-needs-human",
    result.status === 3 &&
      protectedRepairPlan.requires_human_approval === true &&
      protectedRepairPlan.rejected_candidates.length === 1,
    result.stdout || result.stderr,
  );
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

const failed = checks.filter((check) => !check.passed);
const report = {
  status: failed.length ? "failed" : "passed",
  checked: checks.length,
  failed: failed.length,
  failures: failed,
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
process.exitCode = failed.length ? 1 : 0;

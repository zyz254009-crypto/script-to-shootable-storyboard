#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SELF = basename(fileURLToPath(import.meta.url));
const VALIDATOR_PATTERN = /^(?:validate|review|score)-.+\.mjs$/;
const REQUIRED_VALIDATORS = Object.freeze([
  "review-abstract-language.mjs",
  "score-generation-risk.mjs",
  "validate-atomic-shots.mjs",
  "validate-audio-pipeline.mjs",
  "validate-blocking.mjs",
  "validate-camera-setup.mjs",
  "validate-continuity.mjs",
  "validate-coverage.mjs",
  "validate-hook-contract.mjs",
  "validate-model-capabilities.mjs",
  "validate-prompt-alignment.mjs",
  "validate-rights-safety.mjs",
  "validate-schema.mjs",
  "validate-source-trace.mjs",
  "validate-timeline.mjs",
  "validate-timing.mjs",
]);

function printHelp() {
  console.log(`Usage:
  node validate-all.mjs --input <project.json> [options]

Options:
  -i, --input <path>          Project JSON file to validate.
  -o, --output <path>         Write the aggregate report to a file.
      --validators <list>     Comma-separated validator filenames or paths.
      --timeout-ms <number>   Per-validator timeout (default: 30000).
      --require-validators    Require the complete bundled validator set.
      --no-internal           Skip the built-in project sanity checks.
      --pretty                Pretty-print JSON (default).
      --compact               Emit compact JSON.
  -h, --help                  Show this help.

External validator contract:
  node <validator>.mjs <project.json>

The validator must emit one JSON object to stdout and use exit codes:
  0 = pass, 1 = repairable findings, 2 = configuration/execution failure,
  3 = human authorization or judgment required.
`);
}

function parseArgs(argv) {
  const options = {
    timeoutMs: 30_000,
    requireValidators: false,
    internal: true,
    pretty: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      const value = argv[index + 1];
      if (!value || value.startsWith("-")) {
        throw new Error(`Missing value for ${arg}`);
      }
      index += 1;
      return value;
    };

    if (arg === "-h" || arg === "--help") options.help = true;
    else if (arg === "-i" || arg === "--input") options.input = next();
    else if (arg === "-o" || arg === "--output") options.output = next();
    else if (arg === "--validators") options.validators = next();
    else if (arg === "--timeout-ms") options.timeoutMs = Number(next());
    else if (arg === "--require-validators") options.requireValidators = true;
    else if (arg === "--no-internal") options.internal = false;
    else if (arg === "--pretty") options.pretty = true;
    else if (arg === "--compact") options.pretty = false;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!options.help && !options.input) {
    throw new Error("--input is required");
  }
  if (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 1) {
    throw new Error("--timeout-ms must be a positive integer");
  }
  if (
    options.validators !== undefined &&
    !options.validators.split(",").some((value) => value.trim())
  ) {
    throw new Error("--validators must contain at least one validator");
  }
  return options;
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`Cannot read JSON from ${path}: ${error.message}`);
  }
}

function issue({
  ruleId,
  severity,
  message,
  artifactId = null,
  fieldPath = "",
  evidence = null,
  repairOwner = "project-orchestrator",
  autofixAllowed = false,
}) {
  const automaticFixAllowed = Boolean(autofixAllowed);
  return {
    rule_id: ruleId,
    rule_version: "1.0.0",
    severity,
    message,
    artifact_id: artifactId,
    field_path: fieldPath,
    evidence,
    repair_owner: repairOwner,
    autofix_allowed: automaticFixAllowed,
    automatic_fix_allowed: automaticFixAllowed,
  };
}

function internalValidate(project) {
  const issues = [];
  const projectId = project?.project_id ?? project?.job_spec?.project_id ?? null;
  const semver = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

  if (!project || typeof project !== "object" || Array.isArray(project)) {
    return [
      issue({
        ruleId: "ORCH-PROJECT-001",
        severity: "blocker",
        message: "Project root must be a JSON object.",
        evidence: typeof project,
      }),
    ];
  }
  if (!projectId || typeof projectId !== "string") {
    issues.push(
      issue({
        ruleId: "ORCH-PROJECT-002",
        severity: "error",
        message: "Project must expose project_id at root or job_spec.project_id.",
        fieldPath: "/project_id",
      }),
    );
  }
  if (!semver.test(String(project.schema_version ?? ""))) {
    issues.push(
      issue({
        ruleId: "ORCH-VERSION-001",
        severity: "error",
        message: "schema_version must be semantic version text such as 1.0.0.",
        artifactId: projectId,
        fieldPath: "/schema_version",
        evidence: project.schema_version ?? null,
        autofixAllowed: false,
      }),
    );
  }

  const permission = project?.job_spec?.revision_permission;
  if (permission && !["faithful", "visual", "pacing", "story"].includes(permission)) {
    issues.push(
      issue({
        ruleId: "ORCH-PERMISSION-001",
        severity: "blocker",
        message: "Unknown revision permission.",
        artifactId: projectId,
        fieldPath: "/job_spec/revision_permission",
        evidence: permission,
      }),
    );
  }
  if (
    permission === "story" &&
    (!Array.isArray(project?.job_spec?.authorization_ids) ||
      project.job_spec.authorization_ids.length === 0 ||
      !Array.isArray(project?.job_spec?.authorizations) ||
      project.job_spec.authorizations.length === 0)
  ) {
    issues.push(
      issue({
        ruleId: "ORCH-PERMISSION-002",
        severity: "blocker",
        message: "Story rewriting requires authorization IDs and scoped authorization records.",
        artifactId: projectId,
        fieldPath: "/job_spec/authorization_ids",
        repairOwner: "human-authorization",
      }),
    );
  }

  const facts = project?.fact_ledger?.facts;
  if (Array.isArray(facts)) {
    facts.forEach((fact, index) => {
      if (
        fact?.locked === true &&
        Array.isArray(fact.allowed_transformations) &&
        fact.allowed_transformations.includes("modify_with_authorization")
      ) {
        issues.push(
          issue({
            ruleId: "ORCH-FACT-001",
            severity: "blocker",
            message: "A locked fact cannot permit semantic modification.",
            artifactId: fact.fact_id ?? projectId,
            fieldPath: `/fact_ledger/facts/${index}/allowed_transformations`,
            evidence: fact.allowed_transformations,
            repairOwner: "source-and-fidelity-review",
          }),
        );
      }
      if (fact?.locked === true && fact.canonical_value === undefined) {
        issues.push(
          issue({
            ruleId: "ORCH-FACT-002",
            severity: "blocker",
            message: "A locked fact must retain canonical_value.",
            artifactId: fact.fact_id ?? projectId,
            fieldPath: `/fact_ledger/facts/${index}/canonical_value`,
            repairOwner: "source-and-fidelity-review",
          }),
        );
      }
    });
  }

  const rightsRecords =
    project?.rights_manifest?.rights_records ??
    project?.rights_manifest?.records ??
    project?.rights_manifest?.rights_records ??
    project?.rights_records;
  if (Array.isArray(rightsRecords)) {
    const blockedStates = new Set([
      "pending",
      "unknown",
      "expired",
      "withdrawn",
      "restricted",
      "blocked",
    ]);
    rightsRecords.forEach((record, index) => {
      const status = record?.verification_status ?? record?.status;
      if (blockedStates.has(status)) {
        issues.push(
          issue({
            ruleId: "ORCH-RIGHTS-001",
            severity: "blocker",
            message: `Rights record is not cleared: ${status}.`,
            artifactId: record.rights_subject_id ?? record.rights_record_id ?? projectId,
            fieldPath: `/rights_manifest/records/${index}/verification_status`,
            evidence: status,
            repairOwner: "rights-review",
          }),
        );
      }
    });
  }

  const tasks =
    project?.generation_tasks ??
    project?.artifacts?.generation_tasks ??
    project?.generation_task_list?.tasks;
  if (Array.isArray(tasks)) {
    tasks.forEach((task, index) => {
      const duration = task?.duration_seconds ?? task?.duration;
      if (typeof duration === "number" && (duration < 4 || duration > 15)) {
        issues.push(
          issue({
            ruleId: "ORCH-SEEDANCE-001",
            severity: "error",
            message: "Seedance task duration is outside the verified 4–15 second profile.",
            artifactId: task.generation_task_id ?? task.generation_id ?? projectId,
            fieldPath: `/generation_tasks/${index}/duration_seconds`,
            evidence: duration,
            repairOwner: "model-compiler",
            autofixAllowed: false,
          }),
        );
      }
    });
  }

  const lineItems = project?.cost_inputs?.line_items;
  if (Array.isArray(lineItems)) {
    lineItems.forEach((item, index) => {
      const values = [
        item.unit_price,
        item.quantity,
        item.quantity_distribution?.low,
        item.quantity_distribution?.expected,
        item.quantity_distribution?.high,
        item.quantity_distribution?.high_failure,
      ];
      if (values.some((value) => typeof value === "number" && value < 0)) {
        issues.push(
          issue({
            ruleId: "ORCH-COST-001",
            severity: "error",
            message: "Cost prices and quantities cannot be negative.",
            artifactId: item.line_item_id ?? projectId,
            fieldPath: `/cost_inputs/line_items/${index}`,
            evidence: item,
            repairOwner: "cost-estimator",
          }),
        );
      }
    });
  }

  return issues;
}

function discoverValidators(explicit) {
  if (explicit) {
    return explicit
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => resolve(SCRIPT_DIR, value));
  }
  return readdirSync(SCRIPT_DIR, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name !== SELF &&
        VALIDATOR_PATTERN.test(entry.name),
    )
    .map((entry) => join(SCRIPT_DIR, entry.name))
    .sort();
}

function deepHasKey(root, keys) {
  const wanted = new Set(keys);
  const seen = new WeakSet();
  const stack = [root];
  while (stack.length > 0) {
    const value = stack.pop();
    if (!value || typeof value !== "object" || seen.has(value)) continue;
    seen.add(value);
    if (Object.keys(value).some((key) => wanted.has(key))) return true;
    stack.push(...Object.values(value));
  }
  return false;
}

function validatorApplies(scriptPath, project) {
  const name = basename(scriptPath, extname(scriptPath));
  if (name === "validate-schema" || name === "review-abstract-language") return true;
  if (name.includes("source-trace")) {
    return deepHasKey(project, [
      "field_provenance",
      "source_manifest_id",
      "source_manifests",
      "source_refs",
    ]);
  }
  if (name.includes("atomic-shot") || name.includes("timing")) {
    return deepHasKey(project, ["shot_id", "shot_list", "shots"]);
  }
  if (name.includes("continuity")) {
    return deepHasKey(project, ["continuity_ledger_id", "continuity_ledgers"]);
  }
  if (name.includes("hook")) {
    return deepHasKey(project, ["hook_id", "hook_contracts", "hooks"]);
  }
  if (name.includes("prompt-alignment") || name.includes("generation-risk")) {
    return deepHasKey(project, [
      "generation_task_id",
      "generation_tasks",
      "generation_task_list",
    ]);
  }
  if (name.includes("coverage")) {
    return deepHasKey(project, ["coverage_matrix_id", "coverage_matrices"]);
  }
  if (name.includes("timeline")) {
    return deepHasKey(project, ["timeline_clip_id", "timeline_clips"]);
  }
  if (name.includes("audio")) {
    return deepHasKey(project, [
      "audio_event_id",
      "audio_events",
      "audio_production_id",
    ]);
  }
  if (name.includes("rights") || name.includes("safety")) {
    return deepHasKey(project, [
      "rights_manifest",
      "rights_subject_id",
      "rights_record_id",
      "safety_plan",
    ]);
  }
  if (name.includes("model-capabil")) {
    return deepHasKey(project, [
      "generation_task_id",
      "seedance_model_profile_id",
      "model_profile_id",
    ]);
  }
  return true;
}

function parseJsonOutput(stdout) {
  const text = stdout.trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const lines = text.split(/\r?\n/).filter(Boolean);
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      try {
        return JSON.parse(lines[index]);
      } catch {
        // Keep searching for a final JSON line.
      }
    }
  }
  return null;
}

function extractIssues(report, validatorName) {
  const candidates =
    report?.issues ??
    report?.findings ??
    report?.quality_report?.issues ??
    report?.results?.flatMap?.((result) => result.issues ?? []) ??
    [];
  if (!Array.isArray(candidates)) return [];
  return candidates.map((entry, index) => {
    const automaticFixAllowed =
      entry.automatic_fix_allowed === true || entry.autofix_allowed === true;
    return {
      rule_id: entry.rule_id ?? `${validatorName.toUpperCase()}-${index + 1}`,
      rule_version: entry.rule_version ?? "unknown",
      severity: entry.severity ?? "warning",
      message:
        entry.message ??
        entry.summary ??
        entry.evidence?.message ??
        (typeof entry.evidence === "string"
          ? entry.evidence
          : "Validator finding"),
      artifact_id: entry.artifact_id ?? null,
      field_path: entry.field_path ?? "",
      evidence: entry.evidence ?? null,
      repair_owner: entry.repair_owner ?? validatorName,
      ...entry,
      autofix_allowed: automaticFixAllowed,
      automatic_fix_allowed: automaticFixAllowed,
      validator: entry.validator ?? validatorName,
    };
  });
}

function runValidator(scriptPath, inputPath, timeoutMs) {
  const name = basename(scriptPath, extname(scriptPath));
  if (!existsSync(scriptPath)) {
    return {
      name,
      path: scriptPath,
      status: "missing",
      exit_code: 2,
      issues: [
        issue({
          ruleId: "ORCH-VALIDATOR-001",
          severity: "blocker",
          message: `Validator not found: ${scriptPath}`,
          repairOwner: "skill-maintainer",
        }),
      ],
    };
  }

  const execution = spawnSync(
    process.execPath,
    [scriptPath, inputPath],
    {
      cwd: SCRIPT_DIR,
      encoding: "utf8",
      timeout: timeoutMs,
      windowsHide: true,
      maxBuffer: 16 * 1024 * 1024,
    },
  );

  if (execution.error) {
    return {
      name,
      path: scriptPath,
      status: execution.error.code === "ETIMEDOUT" ? "timeout" : "execution_error",
      exit_code: 2,
      stderr: execution.stderr?.trim() || execution.error.message,
      issues: [
        issue({
          ruleId: "ORCH-VALIDATOR-002",
          severity: "blocker",
          message: `${name} could not execute: ${execution.error.message}`,
          repairOwner: "skill-maintainer",
        }),
      ],
    };
  }

  const report = parseJsonOutput(execution.stdout ?? "");
  if (!report) {
    return {
      name,
      path: scriptPath,
      status: "invalid_output",
      exit_code: 2,
      stderr: execution.stderr?.trim() || null,
      issues: [
        issue({
          ruleId: "ORCH-VALIDATOR-003",
          severity: "blocker",
          message: `${name} did not emit a JSON report.`,
          evidence: (execution.stdout ?? "").slice(0, 1000),
          repairOwner: "skill-maintainer",
        }),
      ],
    };
  }

  const code = [0, 1, 2, 3].includes(execution.status) ? execution.status : 2;
  return {
    name,
    path: scriptPath,
    status: code === 0 ? "passed" : code === 3 ? "human_review" : "failed",
    reported_status: report?.status ?? null,
    exit_code: code,
    stderr: execution.stderr?.trim() || null,
    report,
    issues: extractIssues(report, name),
  };
}

function summarize(issues, validatorRuns) {
  const bySeverity = {
    blocker: 0,
    critical: 0,
    error: 0,
    warning: 0,
    info: 0,
    suggestion: 0,
  };
  for (const entry of issues) {
    const key = Object.hasOwn(bySeverity, entry.severity)
      ? entry.severity
      : "warning";
    bySeverity[key] += 1;
  }
  return {
    validator_count: validatorRuns.length,
    validator_passed: validatorRuns.filter((run) => run.exit_code === 0).length,
    validator_failed: validatorRuns.filter((run) => run.exit_code !== 0).length,
    validator_not_applicable: validatorRuns.filter(
      (run) => run.reported_status === "not_applicable",
    ).length,
    issue_count: issues.length,
    by_severity: bySeverity,
  };
}

function determineExitCode(issues, validatorRuns) {
  if (validatorRuns.some((run) => run.exit_code === 2)) return 2;
  if (
    validatorRuns.some((run) => run.exit_code === 3) ||
    issues.some((entry) => entry.repair_owner === "human-authorization")
  ) {
    return 3;
  }
  if (
    validatorRuns.some((run) => run.exit_code === 1) ||
    issues.some((entry) =>
      ["blocker", "critical", "error"].includes(entry.severity),
    )
  ) {
    return 1;
  }
  return 0;
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    printHelp();
    process.exitCode = 2;
    return;
  }
  if (options.help) {
    printHelp();
    return;
  }

  const inputPath = resolve(options.input);
  if (!existsSync(inputPath)) {
    console.error(`Input file not found: ${inputPath}`);
    process.exitCode = 2;
    return;
  }

  let project;
  try {
    project = readJson(inputPath);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
    return;
  }

  const issues = options.internal ? internalValidate(project) : [];
  const discoveredValidatorPaths = discoverValidators(options.validators);
  const validatorPaths = options.validators
    ? discoveredValidatorPaths
    : REQUIRED_VALIDATORS.map((name) => join(SCRIPT_DIR, name));
  const skippedValidators = [];
  if (options.requireValidators && options.validators) {
    const selected = new Set(
      validatorPaths.map((path) => basename(path)),
    );
    for (const name of REQUIRED_VALIDATORS) {
      if (!selected.has(name)) {
        issues.push(
          issue({
            ruleId: "ORCH-VALIDATOR-005",
            severity: "blocker",
            message: `Required validator was not selected: ${name}`,
            repairOwner: "skill-maintainer",
          }),
        );
      }
    }
  }
  const validatorRuns = validatorPaths.map((path) =>
    runValidator(path, inputPath, options.timeoutMs),
  );
  for (const run of validatorRuns) issues.push(...run.issues);

  if (validatorRuns.length === 0) {
    issues.push(
      issue({
        ruleId: "ORCH-VALIDATOR-004",
        severity: options.requireValidators ? "blocker" : "warning",
        message: options.requireValidators
          ? "No external validators were available."
          : "No external validators were available; only internal checks ran.",
        repairOwner: "skill-maintainer",
      }),
    );
  }

  const exitCode = determineExitCode(issues, validatorRuns);
  const report = {
    report_type: "validation-aggregate",
    report_version: "1.0.0",
    generated_at: new Date().toISOString(),
    project_id: project.project_id ?? project?.job_spec?.project_id ?? null,
    input_path: inputPath,
    execution_order: [
      ...(options.internal ? ["validate-all:internal"] : []),
      ...validatorRuns.map((run) => run.name),
    ],
    skipped_validators: skippedValidators,
    summary: summarize(issues, validatorRuns),
    issues,
    validators: validatorRuns.map((run) => ({
      name: run.name,
      path: run.path,
      status: run.status,
      reported_status: run.reported_status ?? null,
      exit_code: run.exit_code,
      stderr: run.stderr,
      issue_count: run.issues.length,
    })),
    exit_code: exitCode,
  };

  const json = JSON.stringify(report, null, options.pretty ? 2 : 0);
  if (options.output) {
    writeFileSync(resolve(options.output), `${json}\n`, "utf8");
  } else {
    process.stdout.write(`${json}\n`);
  }
  process.exitCode = exitCode;
}

main();

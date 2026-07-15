#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const FORBIDDEN_PATTERNS = [
  "/fact_ledger/*/canonical_value",
  "/fact_ledger/*/locked",
  "/fact_ledger/facts/*/canonical_value",
  "/fact_ledger/facts/*/locked",
  "/rights_manifest/**",
  "/rights_records/**",
  "/authorization/**",
  "/authorizations/**",
  "/compliance/**",
  "/privacy/**",
  "/consent/**",
  "/permissions/**",
];

const SAFE_FIELD_NAMES = new Set([
  "duration",
  "duration_seconds",
  "edit_duration_seconds",
  "capture_or_generation_duration_seconds",
  "head_handle_seconds",
  "tail_handle_seconds",
  "estimated_duration_seconds",
  "risk_score",
  "risk_band",
  "sort_order",
  "sequence",
  "sequence_number",
  "shot_number",
  "notes",
  "warnings",
  "suggestions",
  "reference_ids",
  "source_refs",
  "continuity_in",
  "continuity_out",
  "head_handle",
  "tail_handle",
]);

function printHelp() {
  console.log(`Usage:
  node build-repair-plan.mjs --report <quality-report.json> [options]

Options:
  -r, --report <path>         Quality report or project containing quality_report.
  -p, --project <path>        Base project JSON used for tests and hashing.
  -o, --output <path>         Write the repair plan to a file.
      --policy-version <ver>  Authorization policy version (default: 1.0.0).
      --pretty                Pretty-print JSON (default).
      --compact               Emit compact JSON.
  -h, --help                  Show this help.

Accepted finding hints:
  patch_operations / suggested_patch / patch
  or field_path + suggested_value

This tool never applies patches. It rejects all locked-fact, rights,
authorization, compliance, privacy, consent, and permission paths.
`);
}

function parseArgs(argv) {
  const options = {
    policyVersion: "1.0.0",
    pretty: true,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      const value = argv[index + 1];
      if (!value || value.startsWith("-")) throw new Error(`Missing value for ${arg}`);
      index += 1;
      return value;
    };
    if (arg === "-h" || arg === "--help") options.help = true;
    else if (arg === "-r" || arg === "--report") options.report = next();
    else if (arg === "-p" || arg === "--project") options.project = next();
    else if (arg === "-o" || arg === "--output") options.output = next();
    else if (arg === "--policy-version") options.policyVersion = next();
    else if (arg === "--pretty") options.pretty = true;
    else if (arg === "--compact") options.pretty = false;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!options.help && !options.report) throw new Error("--report is required");
  return options;
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`Cannot read JSON from ${path}: ${error.message}`);
  }
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashObject(value) {
  return `sha256:${createHash("sha256").update(stableStringify(value)).digest("hex")}`;
}

function decodePointer(pointer) {
  if (pointer === "") return [];
  if (typeof pointer !== "string" || !pointer.startsWith("/")) {
    throw new Error(`Invalid JSON Pointer: ${pointer}`);
  }
  return pointer
    .slice(1)
    .split("/")
    .map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"));
}

function encodePointer(segments) {
  if (segments.length === 0) return "";
  return `/${segments
    .map((segment) => String(segment).replaceAll("~", "~0").replaceAll("/", "~1"))
    .join("/")}`;
}

function getAtPointer(document, pointer) {
  let current = document;
  for (const segment of decodePointer(pointer)) {
    if (
      current === null ||
      current === undefined ||
      typeof current !== "object" ||
      !Object.hasOwn(current, segment)
    ) {
      return { exists: false, value: undefined };
    }
    current = current[segment];
  }
  return { exists: true, value: current };
}

function globMatches(pattern, pointer) {
  const patternSegments = decodePointer(pattern);
  const pointerSegments = decodePointer(pointer);

  function match(patternIndex, pointerIndex) {
    if (patternIndex === patternSegments.length) {
      return pointerIndex === pointerSegments.length;
    }
    const token = patternSegments[patternIndex];
    if (token === "**") {
      if (patternIndex === patternSegments.length - 1) return true;
      for (let index = pointerIndex; index <= pointerSegments.length; index += 1) {
        if (match(patternIndex + 1, index)) return true;
      }
      return false;
    }
    if (pointerIndex >= pointerSegments.length) return false;
    if (token !== "*" && token !== pointerSegments[pointerIndex]) return false;
    return match(patternIndex + 1, pointerIndex + 1);
  }

  return match(0, 0);
}

function collectLockedFactRoots(document) {
  const roots = [];
  function visit(value, segments) {
    if (!value || typeof value !== "object") return;
    if (value.locked === true && Object.hasOwn(value, "fact_id")) {
      roots.push(encodePointer(segments));
    }
    if (Array.isArray(value)) {
      value.forEach((entry, index) => visit(entry, [...segments, index]));
    } else {
      Object.entries(value).forEach(([key, entry]) =>
        visit(entry, [...segments, key]),
      );
    }
  }
  visit(document, []);
  return roots;
}

function protectedReason(pointer, lockedFactRoots) {
  if (FORBIDDEN_PATTERNS.some((pattern) => globMatches(pattern, pointer))) {
    return "path matches a protected rights, authorization, compliance, privacy, or fact pattern";
  }
  const lowerSegments = decodePointer(pointer).map((segment) => segment.toLowerCase());
  const protectedSegment = lowerSegments.find(
    (segment) =>
      segment.includes("right") ||
      segment.includes("authoriz") ||
      segment.includes("permission") ||
      segment.includes("consent") ||
      segment.includes("privacy") ||
      segment.includes("compliance"),
  );
  if (protectedSegment) return `path contains protected segment "${protectedSegment}"`;
  for (const root of lockedFactRoots) {
    if (pointer === root || pointer.startsWith(`${root}/`)) {
      return "path is inside a locked fact";
    }
  }
  return null;
}

function isWhitelisted(pointer) {
  const segments = decodePointer(pointer);
  const field = String(segments.at(-1) ?? "");
  return SAFE_FIELD_NAMES.has(field);
}

function candidateOperations(issue) {
  const supplied =
    issue.patch_operations ??
    issue.suggested_patch ??
    issue.patch ??
    issue.repair_patch;
  if (Array.isArray(supplied)) return supplied;
  if (supplied && typeof supplied === "object" && supplied.op) return [supplied];
  if (
    typeof issue.field_path === "string" &&
    issue.field_path.startsWith("/") &&
    Object.hasOwn(issue, "suggested_value")
  ) {
    return [
      {
        op: issue.suggested_op ?? "replace",
        path: issue.field_path,
        value: issue.suggested_value,
      },
    ];
  }
  return [];
}

function makeRejection(issue, operation, reason) {
  return {
    issue_id: issue.issue_id ?? issue.rule_id ?? null,
    rule_id: issue.rule_id ?? null,
    operation,
    reason,
    requires_human_approval: true,
  };
}

function prepareOperation(document, operation, issue, lockedRoots) {
  if (!operation || typeof operation !== "object") {
    return { rejection: makeRejection(issue, operation, "operation is not an object") };
  }
  if (!["add", "remove", "replace"].includes(operation.op)) {
    return {
      rejection: makeRejection(
        issue,
        operation,
        "only add, remove, and replace suggestions are generated",
      ),
    };
  }
  if (typeof operation.path !== "string" || !operation.path.startsWith("/")) {
    return { rejection: makeRejection(issue, operation, "invalid JSON Pointer path") };
  }
  try {
    decodePointer(operation.path);
  } catch (error) {
    return { rejection: makeRejection(issue, operation, error.message) };
  }

  const protectedPath = protectedReason(operation.path, lockedRoots);
  if (protectedPath) {
    return { rejection: makeRejection(issue, operation, protectedPath) };
  }
  if (!isWhitelisted(operation.path)) {
    return {
      rejection: makeRejection(
        issue,
        operation,
        "path is outside the structural autofix whitelist",
      ),
    };
  }
  if (issue.automatic_fix_allowed !== true && issue.autofix_allowed !== true) {
    return {
      rejection: makeRejection(
        issue,
        operation,
        "finding does not explicitly permit autofix",
      ),
    };
  }

  const existing = getAtPointer(document, operation.path);
  const parentSegments = decodePointer(operation.path).slice(0, -1);
  const parentPath = encodePointer(parentSegments);
  const parent = getAtPointer(document, parentPath);
  if (!parent.exists) {
    return {
      rejection: makeRejection(issue, operation, "parent path does not exist"),
    };
  }
  if (operation.op === "replace" || operation.op === "remove") {
    if (!existing.exists) {
      return {
        rejection: makeRejection(issue, operation, `${operation.op} target does not exist`),
      };
    }
  }
  if (operation.op === "add" && existing.exists) {
    operation = { ...operation, op: "replace" };
  }
  if (operation.op !== "remove" && !Object.hasOwn(operation, "value")) {
    return {
      rejection: makeRejection(issue, operation, `${operation.op} requires value`),
    };
  }

  const testOperation = existing.exists
    ? { op: "test", path: operation.path, value: existing.value }
    : { op: "test", path: parentPath, value: parent.value };

  let rollback;
  if (operation.op === "add") {
    rollback = [
      { op: "test", path: operation.path, value: operation.value },
      { op: "remove", path: operation.path },
    ];
  } else if (operation.op === "remove") {
    const parentAfterRemoval = structuredClone(parent.value);
    const targetSegment = decodePointer(operation.path).at(-1);
    if (Array.isArray(parentAfterRemoval)) {
      parentAfterRemoval.splice(Number(targetSegment), 1);
    } else {
      delete parentAfterRemoval[targetSegment];
    }
    rollback = [
      { op: "test", path: parentPath, value: parentAfterRemoval },
      { op: "add", path: operation.path, value: existing.value },
    ];
  } else {
    rollback = [
      { op: "test", path: operation.path, value: operation.value },
      { op: "replace", path: operation.path, value: existing.value },
    ];
  }

  return {
    prepared: [testOperation, operation],
    rollback,
    allowedPath: operation.path,
  };
}

function extractIssues(reportDocument) {
  const report = reportDocument.quality_report ?? reportDocument;
  return (
    report.issues ??
    report.findings ??
    report.validation_issues ??
    reportDocument.validation_issues ??
    []
  );
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

  const reportPath = resolve(options.report);
  if (!existsSync(reportPath)) {
    console.error(`Report file not found: ${reportPath}`);
    process.exitCode = 2;
    return;
  }

  let reportDocument;
  let project;
  try {
    reportDocument = readJson(reportPath);
    project = options.project
      ? readJson(resolve(options.project))
      : reportDocument.project ?? reportDocument;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
    return;
  }

  const issues = extractIssues(reportDocument);
  if (!Array.isArray(issues)) {
    console.error("Quality report issues must be an array.");
    process.exitCode = 2;
    return;
  }

  const lockedRoots = collectLockedFactRoots(project);
  const operations = [];
  const rollbackGroups = [];
  const rejected = [];
  const allowedPaths = new Set();

  for (const issue of issues) {
    const candidates = candidateOperations(issue);
    if (candidates.length === 0) {
      if (["blocker", "error"].includes(issue.severity)) {
        rejected.push(makeRejection(issue, null, "finding provides no safe patch hint"));
      }
      continue;
    }
    for (const candidate of candidates) {
      const result = prepareOperation(project, { ...candidate }, issue, lockedRoots);
      if (result.rejection) {
        rejected.push(result.rejection);
        continue;
      }
      operations.push(...result.prepared);
      rollbackGroups.unshift(result.rollback);
      allowedPaths.add(result.allowedPath);
    }
  }

  const baseHash = hashObject(project);
  const plan = {
    report_type: "repair-plan",
    schema_version: "1.0.0",
    patch_id: `repair-${baseHash.slice(-16)}`,
    generated_at: new Date().toISOString(),
    base_artifact_hash: baseHash,
    authorization_policy_version: options.policyVersion,
    allowed_paths: [...allowedPaths].sort(),
    forbidden_paths: FORBIDDEN_PATTERNS,
    operations,
    invariants_checked: [
      "locked facts are untouched",
      "rights and consent state is untouched",
      "authorization state is untouched",
      "compliance and privacy state is untouched",
      "each mutation has a test precondition",
      "only structural whitelist fields are suggested",
    ],
    requires_human_approval: rejected.length > 0,
    rejected_candidates: rejected,
    rollback_patch: rollbackGroups.flat(),
    application_policy: {
      apply_automatically: false,
      transaction_mode: "atomic",
      invalidate_if_base_hash_changes: true,
      invalidate_if_policy_version_changes: true,
    },
    schema_note:
      "Runtime proposal only. This report does not claim conformance to repair-patch.schema.json until target_artifact metadata, policy evaluations, approval records, and field provenance are added.",
    summary: {
      finding_count: issues.length,
      suggested_mutation_count: operations.filter((entry) => entry.op !== "test").length,
      rejected_candidate_count: rejected.length,
    },
  };

  const json = JSON.stringify(plan, null, options.pretty ? 2 : 0);
  if (options.output) writeFileSync(resolve(options.output), `${json}\n`, "utf8");
  else process.stdout.write(`${json}\n`);
  if (plan.requires_human_approval) process.exitCode = 3;
}

main();

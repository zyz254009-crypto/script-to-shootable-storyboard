import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const SEVERITIES = Object.freeze([
  "blocker",
  "error",
  "warning",
  "suggestion",
]);

export const SCHEMA_MARKERS = Object.freeze({
  "job-spec.schema.json": "job_id",
  "source-manifest.schema.json": "source_manifest_id",
  "scene.schema.json": "scene_id",
  "beat-sheet.schema.json": "beat_sheet_id",
  "story-bible.schema.json": "story_bible_id",
  "fact-ledger.schema.json": "fact_ledger_id",
  "blocking-plan.schema.json": "blocking_plan_id",
  "coverage-matrix.schema.json": "coverage_matrix_id",
  "provisional-shot-intent.schema.json": "shot_intent_id",
  "camera-setup.schema.json": "camera_setup_id",
  "shot-list.schema.json": "shot_list_id",
  "take.schema.json": "take_id",
  "generation-task.schema.json": "generation_task_id",
  "generation-attempt.schema.json": "attempt_id",
  "media-asset.schema.json": "asset_id",
  "timeline-clip.schema.json": "timeline_clip_id",
  "audio-event.schema.json": "audio_event_id",
  "audio-production.schema.json": "audio_production_id",
  "composite-recipe.schema.json": "composite_recipe_id",
  "hook-contract.schema.json": "hook_id",
  "continuity-ledger.schema.json": "continuity_ledger_id",
  "cost-estimate.schema.json": "cost_estimate_id",
  "eval-result.schema.json": "eval_result_id",
  "genre-profile.schema.json": "genre_profile_id",
  "metrics-config.schema.json": "metrics_config_id",
  "migration-report.schema.json": "migration_report_id",
  "model-registry.schema.json": "registry_id",
  "platform-profile.schema.json": "platform_profile_id",
  "provenance.schema.json": "artifact_id",
  "quality-report.schema.json": "quality_report_id",
  "release-checklist.schema.json": "release_checklist_id",
  "repair-patch.schema.json": "patch_id",
  "rights-manifest.schema.json": "rights_manifest_id",
  "run-snapshot.schema.json": "run_snapshot_id",
  "semantic-review-run.schema.json": "semantic_review_run_id",
});

export const SCHEMA_DISCRIMINATORS = Object.freeze({
  "job-spec.schema.json": ["input_type", "production_mode"],
  "source-manifest.schema.json": ["stable_spans", "source_document_id"],
  "scene.schema.json": ["slugline", "sequence_number"],
  "beat-sheet.schema.json": ["beats"],
  "story-bible.schema.json": ["characters", "locations"],
  "fact-ledger.schema.json": ["facts"],
  "blocking-plan.schema.json": ["coordinate_system", "actor_blocking"],
  "coverage-matrix.schema.json": ["coverage_needs"],
  "provisional-shot-intent.schema.json": ["editorial_purpose"],
  "camera-setup.schema.json": ["camera_position", "coordinate_system_ref"],
  "shot-list.schema.json": ["shots"],
  "take.schema.json": ["attempt_number", "recorded_asset_ids"],
  "generation-task.schema.json": ["task_mode", "model_profile"],
  "generation-attempt.schema.json": ["request_parameters", "submitted_at"],
  "media-asset.schema.json": ["origin_type", "file_hash"],
  "timeline-clip.schema.json": ["source_in_seconds", "timeline_in_seconds"],
  "audio-event.schema.json": ["event_type", "timing"],
  "audio-production.schema.json": ["method", "attempts"],
  "composite-recipe.schema.json": ["input_media_asset_ids", "render_parameters"],
  "hook-contract.schema.json": ["promise_beat_ids", "viewer_question"],
  "continuity-ledger.schema.json": ["entries"],
  "cost-estimate.schema.json": ["estimate_version", "pricing_evidence"],
  "eval-result.schema.json": ["evaluation_id", "variants"],
  "genre-profile.schema.json": ["genre_name", "hook_patterns"],
  "metrics-config.schema.json": ["metrics", "release_gates"],
  "migration-report.schema.json": ["migration_run_id", "operations"],
  "model-registry.schema.json": ["registry_version", "models"],
  "platform-profile.schema.json": ["platform_name", "delivery_context"],
  "provenance.schema.json": ["field_provenance"],
  "quality-report.schema.json": ["tool_runs", "release_assessment"],
  "release-checklist.schema.json": ["gate_results", "review_panel"],
  "repair-patch.schema.json": ["target_artifact_id", "operations"],
  "rights-manifest.schema.json": ["rights_records", "overall_status"],
  "run-snapshot.schema.json": ["run_id", "model_bindings"],
  "semantic-review-run.schema.json": ["review_type", "rubric"],
});

export const COLLECTION_ID_FIELDS = Object.freeze({
  stable_spans: "span_id",
  scenes: "scene_id",
  beats: "beat_id",
  facts: "fact_id",
  blocking_plans: "blocking_plan_id",
  coverage_needs: "coverage_id",
  coverage_items: "coverage_id",
  shot_intents: "shot_intent_id",
  provisional_shot_intents: "shot_intent_id",
  camera_setups: "camera_setup_id",
  shots: "shot_id",
  takes: "take_id",
  generation_tasks: "generation_task_id",
  generation_attempts: "attempt_id",
  media_assets: "asset_id",
  assets: "asset_id",
  timeline_clips: "timeline_clip_id",
  audio_events: "audio_event_id",
  hook_contracts: "hook_id",
  continuity_entries: "continuity_entry_id",
  events: "event_id",
});

export const REFERENCE_TARGETS = Object.freeze({
  job_id: "job_id",
  source_manifest_id: "source_manifest_id",
  source_manifest_ids: "source_manifest_id",
  scene_id: "scene_id",
  scene_ids: "scene_id",
  beat_id: "beat_id",
  beat_ids: "beat_id",
  cause_beat_ids: "beat_id",
  effect_beat_ids: "beat_id",
  shot_id: "shot_id",
  shot_ids: "shot_id",
  anchor_shot_id: "shot_id",
  camera_setup_id: "camera_setup_id",
  camera_setup_ids: "camera_setup_id",
  generation_task_id: "generation_task_id",
  generation_task_ids: "generation_task_id",
  generation_attempt_id: "attempt_id",
  generation_attempt_ids: "attempt_id",
  audio_event_id: "audio_event_id",
  audio_event_ids: "audio_event_id",
  timeline_clip_id: "timeline_clip_id",
  timeline_clip_ids: "timeline_clip_id",
  asset_id: "asset_id",
  asset_ids: "asset_id",
  source_media_asset_id: "asset_id",
  reference_asset_id: "asset_id",
  reference_asset_ids: "asset_id",
  fact_id: "fact_id",
  fact_ids: "fact_id",
  hook_contract_id: "hook_id",
  hook_contract_ids: "hook_id",
  continuity_entry_id: "continuity_entry_id",
  continuity_entry_ids: "continuity_entry_id",
  event_id: "event_id",
});

export class InputError extends Error {
  constructor(message, code = "INPUT_ERROR", cause) {
    super(message, { cause });
    this.name = "InputError";
    this.code = code;
  }
}

export function issue({
  severity,
  rule_id,
  artifact_id = "PROJECT",
  field_path = "/",
  evidence,
  repair_owner,
  autofix_allowed = false,
}) {
  if (!SEVERITIES.includes(severity)) {
    throw new TypeError(`Unsupported severity: ${severity}`);
  }
  const automaticFixAllowed = Boolean(autofix_allowed);
  return {
    severity,
    rule_id: String(rule_id),
    artifact_id: String(artifact_id ?? "PROJECT"),
    field_path: String(field_path || "/"),
    evidence:
      typeof evidence === "string" ? evidence : JSON.stringify(evidence ?? null),
    repair_owner: String(repair_owner || "quality-review"),
    autofix_allowed: automaticFixAllowed,
    automatic_fix_allowed: automaticFixAllowed,
  };
}

export function summarizeIssues(issues) {
  const summary = {
    total: issues.length,
    blocker: 0,
    error: 0,
    warning: 0,
    suggestion: 0,
  };
  for (const item of issues) {
    if (Object.hasOwn(summary, item.severity)) summary[item.severity] += 1;
  }
  return summary;
}

export function exitCodeForIssues(
  issues,
  { schemaFailure = false, executionFailure = false } = {},
) {
  if (executionFailure || schemaFailure) return 2;
  const hasHumanDecision = issues.some(
    (item) =>
      (item.severity === "blocker" || item.severity === "error") &&
      /^(authorization-review|human-review|rights-review|source-owner)$/.test(
        item.repair_owner,
      ),
  );
  if (hasHumanDecision) return 3;
  if (
    issues.some(
      (item) => item.severity === "blocker" || item.severity === "error",
    )
  ) {
    return 1;
  }
  return 0;
}

export function makeReport({
  validator,
  inputPath,
  issues,
  exitCode,
  metadata = {},
}) {
  const normalizedIssues = issues.map((entry) => {
    const automaticFixAllowed =
      entry.automatic_fix_allowed === true || entry.autofix_allowed === true;
    return {
      ...entry,
      autofix_allowed: automaticFixAllowed,
      automatic_fix_allowed: automaticFixAllowed,
    };
  });
  const resolvedExitCode =
    exitCode === undefined ? exitCodeForIssues(normalizedIssues) : exitCode;
  return {
    validator,
    input: inputPath ?? null,
    status:
      resolvedExitCode === 0
        ? "passed"
        : resolvedExitCode === 3
          ? "needs_human_review"
          : "failed",
    exit_code: resolvedExitCode,
    summary: summarizeIssues(normalizedIssues),
    issues: normalizedIssues,
    ...metadata,
  };
}

export async function loadJsonFile(inputPath) {
  let text;
  try {
    text = await readFile(inputPath, "utf8");
  } catch (error) {
    throw new InputError(
      `Cannot read input JSON: ${error.message}`,
      "INPUT_IO",
      error,
    );
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new InputError(
      `Invalid JSON: ${error.message}`,
      "INPUT_JSON_PARSE",
      error,
    );
  }
}

export function sha256Text(text, withPrefix = true) {
  const digest = createHash("sha256").update(String(text), "utf8").digest("hex");
  return withPrefix ? `sha256:${digest}` : digest;
}

export function hashMatches(value, expected) {
  if (typeof expected !== "string") return false;
  const normalized = expected.replace(/^sha256:/i, "").toLowerCase();
  return sha256Text(value, false) === normalized;
}

export function escapeJsonPointer(segment) {
  return String(segment).replaceAll("~", "~0").replaceAll("/", "~1");
}

export function joinPointer(base, segment) {
  const prefix = !base || base === "/" ? "" : base;
  return `${prefix}/${escapeJsonPointer(segment)}` || "/";
}

export function joinPointerPath(base, ...segments) {
  return segments.reduce((pointer, segment) => joinPointer(pointer, segment), base);
}

export function resolveJsonPointer(root, pointer) {
  if (pointer === "") return root;
  if (typeof pointer !== "string" || !pointer.startsWith("/")) return undefined;
  let current = root;
  for (const token of pointer.slice(1).split("/")) {
    const key = token.replaceAll("~1", "/").replaceAll("~0", "~");
    if (
      current === null ||
      current === undefined ||
      (typeof current !== "object" && !Array.isArray(current)) ||
      !Object.hasOwn(current, key)
    ) {
      return undefined;
    }
    current = current[key];
  }
  return current;
}

export function walk(value, visitor, pointer = "/", parentKey = null) {
  visitor(value, pointer, parentKey);
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      walk(item, visitor, joinPointer(pointer, index), parentKey),
    );
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    walk(child, visitor, joinPointer(pointer, key), key);
  }
}

export function findObjectsWithKey(root, key) {
  const results = [];
  const seen = new Set();
  walk(root, (value, pointer) => {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.hasOwn(value, key) &&
      !seen.has(value)
    ) {
      seen.add(value);
      results.push({ value, pointer });
    }
  });
  return results;
}

export function artifactId(value, fallback = "PROJECT") {
  if (!value || typeof value !== "object") return fallback;
  for (const key of [
    "shot_id",
    "beat_id",
    "scene_id",
    "audio_event_id",
    "generation_task_id",
    "generation_attempt_id",
    "timeline_clip_id",
    "asset_id",
    "source_manifest_id",
    "fact_id",
    "job_id",
    "artifact_id",
  ]) {
    if (typeof value[key] === "string" && value[key]) return value[key];
  }
  return fallback;
}

export function collectDefinitions(root) {
  const byType = new Map();
  const byId = new Map();
  const definitionPointers = new Set();

  const add = (type, id, pointer) => {
    if (typeof id !== "string" || !id) return;
    if (!byType.has(type)) byType.set(type, new Map());
    const entries = byType.get(type);
    if (!entries.has(id)) entries.set(id, []);
    entries.get(id).push(pointer);
    if (!byId.has(id)) byId.set(id, []);
    byId.get(id).push({ type, pointer });
    definitionPointers.add(pointer);
  };

  for (const [filename, marker] of Object.entries(SCHEMA_MARKERS)) {
    for (const found of findObjectsWithKey(root, marker)) {
      if (!isArtifactCandidate(found.value, filename, found.pointer)) continue;
      add(marker, found.value[marker], joinPointer(found.pointer, marker));
    }
  }

  for (const found of findObjectsWithKey(root, "continuity_entry_id")) {
    if (
      isPlainObject(found.value) &&
      typeof found.value.shot_id === "string" &&
      isPlainObject(found.value.start_state) &&
      isPlainObject(found.value.end_state)
    ) {
      add(
        "continuity_entry_id",
        found.value.continuity_entry_id,
        joinPointer(found.pointer, "continuity_entry_id"),
      );
    }
  }

  walk(root, (value, pointer, parentKey) => {
    if (!Array.isArray(value) || !COLLECTION_ID_FIELDS[parentKey]) return;
    const idField = COLLECTION_ID_FIELDS[parentKey];
    value.forEach((entry, index) => {
      if (entry && typeof entry === "object" && !Array.isArray(entry)) {
        add(
          idField,
          entry[idField],
          joinPointer(joinPointer(pointer, index), idField),
        );
      }
    });
  });

  return { byType, byId, definitionPointers };
}

export function isArtifactCandidate(value, filename, pointer = "/") {
  if (!isPlainObject(value)) return false;
  const marker = SCHEMA_MARKERS[filename];
  if (!marker || !Object.hasOwn(value, marker)) return false;
  if (pointer === "/") return true;
  const discriminators = SCHEMA_DISCRIMINATORS[filename] ?? [];
  return discriminators.length === 0
    ? true
    : discriminators.every((key) => Object.hasOwn(value, key));
}

export function collectReferences(root, definitionPointers = new Set()) {
  const references = [];
  walk(root, (value, pointer, parentKey) => {
    const targetType = REFERENCE_TARGETS[parentKey];
    if (!targetType || definitionPointers.has(pointer)) return;
    if (typeof value === "string") {
      references.push({
        targetType,
        id: value,
        pointer,
        field: parentKey,
      });
    } else if (Array.isArray(value)) {
      value.forEach((id, index) => {
        if (typeof id === "string") {
          references.push({
            targetType,
            id,
            pointer: joinPointer(pointer, index),
            field: parentKey,
          });
        }
      });
    }
  });
  return references.filter(
    (entry, index, list) =>
      list.findIndex(
        (other) =>
          other.targetType === entry.targetType &&
          other.id === entry.id &&
          other.pointer === entry.pointer,
      ) === index,
  );
}

export function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isSemver(value) {
  return /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(
    value,
  );
}

export function directExecution(importMetaUrl) {
  if (!process.argv[1]) return false;
  return (
    pathToFileURL(path.resolve(process.argv[1])).href ===
    new URL(importMetaUrl).href
  );
}

export async function runValidatorCli({
  validator,
  validate,
  help,
  argv = process.argv.slice(2),
}) {
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(`${help.trim()}\n`);
    return 0;
  }
  const positional = argv.filter((arg) => !arg.startsWith("-"));
  if (positional.length !== 1 || positional.length !== argv.length) {
    const issues = [
      issue({
        severity: "blocker",
        rule_id: "CLI-ARGS-001",
        evidence: "Expected exactly one positional JSON input path.",
        repair_owner: "tooling",
        autofix_allowed: false,
      }),
    ];
    const report = makeReport({
      validator,
      inputPath: positional[0] ?? null,
      issues,
      exitCode: 2,
    });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exitCode = 2;
    return 2;
  }

  const inputPath = path.resolve(positional[0]);
  try {
    const data = await loadJsonFile(inputPath);
    const report = await validate(data, { inputPath });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exitCode = report.exit_code;
    return report.exit_code;
  } catch (error) {
    const ruleId =
      error instanceof InputError && error.code === "INPUT_JSON_PARSE"
        ? "SCHEMA-JSON-001"
        : "VALIDATOR-EXEC-001";
    const issues = [
      issue({
        severity: "blocker",
        rule_id: ruleId,
        evidence: error.message,
        repair_owner: "tooling",
        autofix_allowed: false,
      }),
    ];
    const report = makeReport({
      validator,
      inputPath,
      issues,
      exitCode: 2,
    });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exitCode = 2;
    return 2;
  }
}

export function schemaDirectoryFrom(importMetaUrl) {
  const currentFile = fileURLToPath(importMetaUrl);
  return path.resolve(path.dirname(currentFile), "../references/schemas");
}

export async function loadSchemaRegistry(schemaDirectory) {
  const registry = new Map();
  const files = (await readdir(schemaDirectory)).filter((name) =>
    name.endsWith(".schema.json"),
  );
  for (const filename of files) {
    const schema = JSON.parse(
      await readFile(path.join(schemaDirectory, filename), "utf8"),
    );
    registry.set(filename, schema);
    if (schema.$id) registry.set(schema.$id, schema);
  }
  return registry;
}

export function getSchemaAtPointer(schema, pointer) {
  if (!pointer || pointer === "#") return schema;
  if (!pointer.startsWith("#/")) return undefined;
  return resolveJsonPointer(schema, pointer.slice(1));
}

export function resolveSchemaRef(ref, currentSchema, registry) {
  if (ref.startsWith("#")) {
    return {
      schema: getSchemaAtPointer(currentSchema, ref),
      rootSchema: currentSchema,
    };
  }
  const [resource, fragment = ""] = ref.split("#", 2);
  const external = registry.get(resource) ?? registry.get(path.basename(resource));
  if (!external) return { schema: undefined, rootSchema: undefined };
  return {
    schema: fragment
      ? getSchemaAtPointer(external, `#${fragment}`)
      : external,
    rootSchema: external,
  };
}

const SCHEMA_OBJECT_IDS = new WeakMap();
let nextSchemaObjectId = 1;

function schemaObjectId(schema) {
  if (!schema || typeof schema !== "object") return "none";
  if (!SCHEMA_OBJECT_IDS.has(schema)) {
    SCHEMA_OBJECT_IDS.set(schema, nextSchemaObjectId);
    nextSchemaObjectId += 1;
  }
  return SCHEMA_OBJECT_IDS.get(schema);
}

function typeMatches(value, expected) {
  if (expected === "null") return value === null;
  if (expected === "array") return Array.isArray(value);
  if (expected === "object") return isPlainObject(value);
  if (expected === "integer") return Number.isInteger(value);
  if (expected === "number") return typeof value === "number" && Number.isFinite(value);
  return typeof value === expected;
}

function schemaPasses(value, schema, rootSchema, registry) {
  const candidateIssues = [];
  validateSchemaSubset({
    value,
    schema,
    rootSchema,
    registry,
    issues: candidateIssues,
    active: new Set(),
  });
  return !candidateIssues.some((entry) =>
    ["blocker", "error"].includes(entry.severity),
  );
}

function collectDeclaredProperties(schema, rootSchema, registry, found = new Set(), seen = new Set()) {
  if (!schema || typeof schema !== "object" || seen.has(schema)) return found;
  seen.add(schema);
  if (schema.$ref) {
    const resolved = resolveSchemaRef(schema.$ref, rootSchema, registry);
    if (resolved.schema) {
      collectDeclaredProperties(resolved.schema, resolved.rootSchema, registry, found, seen);
    }
    return found;
  }
  for (const key of Object.keys(schema.properties ?? {})) found.add(key);
  for (const keyword of ["allOf", "anyOf", "oneOf"]) {
    for (const child of schema[keyword] ?? []) {
      collectDeclaredProperties(child, rootSchema, registry, found, seen);
    }
  }
  for (const child of [schema.then, schema.else]) {
    if (child) collectDeclaredProperties(child, rootSchema, registry, found, seen);
  }
  return found;
}

export function matchesCondition(value, condition, rootSchema = condition, registry = new Map()) {
  return schemaPasses(value, condition, rootSchema, registry);
}

export function validateSchemaSubset({
  value,
  schema,
  rootSchema = schema,
  registry,
  pointer = "/",
  artifact = "PROJECT",
  issues = [],
  active = new Set(),
}) {
  if (!schema || typeof schema !== "object") return issues;
  const visitKey = `${pointer}|${schemaObjectId(schema)}|${schemaObjectId(rootSchema)}`;
  if (active.has(visitKey)) return issues;
  active.add(visitKey);

  const add = (rule_id, evidence, field_path = pointer, severity = "error") => {
    issues.push(
      issue({
        severity,
        rule_id,
        artifact_id: artifact,
        field_path,
        evidence,
        repair_owner: severity === "blocker" ? "schema-maintainer" : "artifact-owner",
        autofix_allowed: false,
      }),
    );
  };

  if (schema.$ref) {
    const resolved = resolveSchemaRef(schema.$ref, rootSchema, registry);
    if (!resolved.schema) {
      add("SCHEMA-REF-001", `Cannot resolve schema reference ${schema.$ref}.`, pointer, "blocker");
      active.delete(visitKey);
      return issues;
    }
    validateSchemaSubset({
      value,
      schema: resolved.schema,
      rootSchema: resolved.rootSchema,
      registry,
      pointer,
      artifact,
      issues,
      active,
    });
    active.delete(visitKey);
    return issues;
  }

  const expectedTypes = Array.isArray(schema.type)
    ? schema.type
    : schema.type
      ? [schema.type]
      : [];
  if (expectedTypes.length && !expectedTypes.some((expected) => typeMatches(value, expected))) {
    add("SCHEMA-TYPE-001", `Expected type ${expectedTypes.join(" or ")}.`);
    active.delete(visitKey);
    return issues;
  }

  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    add("SCHEMA-ENUM-001", `Value is not one of: ${schema.enum.join(", ")}.`);
  }
  if (Object.hasOwn(schema, "const") && value !== schema.const) {
    add("SCHEMA-CONST-001", `Value must equal ${JSON.stringify(schema.const)}.`);
  }

  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      add("SCHEMA-STRING-001", `String is shorter than ${schema.minLength}.`);
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      add("SCHEMA-STRING-002", `String is longer than ${schema.maxLength}.`);
    }
    if (schema.pattern) {
      try {
        if (!new RegExp(schema.pattern, "u").test(value)) {
          add("SCHEMA-PATTERN-001", `String does not match ${schema.pattern}.`);
        }
      } catch {
        add("SCHEMA-PATTERN-002", `Schema contains an invalid regular expression: ${schema.pattern}.`, pointer, "blocker");
      }
    }
    if (schema.format === "date-time" && Number.isNaN(Date.parse(value))) {
      add("SCHEMA-FORMAT-001", "String is not a valid date-time.");
    }
    if (schema.format === "uri") {
      try {
        new URL(value);
      } catch {
        add("SCHEMA-FORMAT-002", "String is not a valid absolute URI.");
      }
    }
  }

  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) {
      add("SCHEMA-NUMBER-001", `Number is below minimum ${schema.minimum}.`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      add("SCHEMA-NUMBER-002", `Number is above maximum ${schema.maximum}.`);
    }
    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) {
      add("SCHEMA-NUMBER-003", `Number must be greater than ${schema.exclusiveMinimum}.`);
    }
    if (schema.exclusiveMaximum !== undefined && value >= schema.exclusiveMaximum) {
      add("SCHEMA-NUMBER-004", `Number must be less than ${schema.exclusiveMaximum}.`);
    }
    if (schema.multipleOf !== undefined && Math.abs(value / schema.multipleOf - Math.round(value / schema.multipleOf)) > 1e-9) {
      add("SCHEMA-NUMBER-005", `Number must be a multiple of ${schema.multipleOf}.`);
    }
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      add("SCHEMA-ARRAY-001", `Array has fewer than ${schema.minItems} items.`);
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      add("SCHEMA-ARRAY-002", `Array has more than ${schema.maxItems} items.`);
    }
    if (schema.uniqueItems) {
      const serialized = value.map((item) => JSON.stringify(item));
      if (new Set(serialized).size !== serialized.length) {
        add("SCHEMA-ARRAY-003", "Array contains duplicate items.");
      }
    }
    if (schema.items) {
      value.forEach((item, index) =>
        validateSchemaSubset({
          value: item,
          schema: schema.items,
          rootSchema,
          registry,
          pointer: joinPointer(pointer, index),
          artifact,
          issues,
          active,
        }),
      );
    }
    if (schema.contains) {
      const matchCount = value.filter((item) =>
        schemaPasses(item, schema.contains, rootSchema, registry),
      ).length;
      const minimum = schema.minContains ?? 1;
      const maximum = schema.maxContains ?? Number.POSITIVE_INFINITY;
      if (matchCount < minimum || matchCount > maximum) {
        add("SCHEMA-CONTAINS-001", `Array contains ${matchCount} matching items; expected ${minimum}..${maximum}.`);
      }
    }
  }

  if (isPlainObject(value)) {
    if (schema.minProperties !== undefined && Object.keys(value).length < schema.minProperties) {
      add("SCHEMA-OBJECT-001", `Object has fewer than ${schema.minProperties} properties.`);
    }
    if (schema.maxProperties !== undefined && Object.keys(value).length > schema.maxProperties) {
      add("SCHEMA-OBJECT-002", `Object has more than ${schema.maxProperties} properties.`);
    }
    for (const required of schema.required ?? []) {
      if (!Object.hasOwn(value, required)) {
        add("SCHEMA-REQUIRED-001", `Missing required field "${required}".`, joinPointer(pointer, required));
      }
    }
    if (schema.propertyNames) {
      for (const key of Object.keys(value)) {
        if (!schemaPasses(key, schema.propertyNames, rootSchema, registry)) {
          add("SCHEMA-PROPERTY-NAME-001", `Property name "${key}" is not allowed.`, joinPointer(pointer, key));
        }
      }
    }
    for (const [key, childSchema] of Object.entries(schema.properties ?? {})) {
      if (!Object.hasOwn(value, key)) continue;
      validateSchemaSubset({
        value: value[key],
        schema: childSchema,
        rootSchema,
        registry,
        pointer: joinPointer(pointer, key),
        artifact,
        issues,
        active,
      });
    }
    const declared = collectDeclaredProperties(schema, rootSchema, registry);
    for (const key of Object.keys(value)) {
      if (declared.has(key)) continue;
      if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
        validateSchemaSubset({
          value: value[key],
          schema: schema.additionalProperties,
          rootSchema,
          registry,
          pointer: joinPointer(pointer, key),
          artifact,
          issues,
          active,
        });
      } else if (schema.additionalProperties === false || schema.unevaluatedProperties === false) {
        add("SCHEMA-ADDITIONAL-001", `Unexpected property "${key}".`, joinPointer(pointer, key));
      }
    }
  }

  for (const childSchema of schema.allOf ?? []) {
    validateSchemaSubset({
      value,
      schema: childSchema,
      rootSchema,
      registry,
      pointer,
      artifact,
      issues,
      active,
    });
  }
  if (schema.if) {
    const branch = matchesCondition(value, schema.if, rootSchema, registry)
      ? schema.then
      : schema.else;
    if (branch) {
      validateSchemaSubset({
        value,
        schema: branch,
        rootSchema,
        registry,
        pointer,
        artifact,
        issues,
        active,
      });
    }
  }
  if (Array.isArray(schema.anyOf)) {
    const anyMatch = schema.anyOf.some((candidate) =>
      schemaPasses(value, candidate, rootSchema, registry),
    );
    if (!anyMatch) {
      add("SCHEMA-ANYOF-001", "Value does not satisfy any allowed schema branch.");
    }
  }
  if (Array.isArray(schema.oneOf)) {
    const matches = schema.oneOf.filter((candidate) =>
      schemaPasses(value, candidate, rootSchema, registry),
    ).length;
    if (matches !== 1) {
      add("SCHEMA-ONEOF-001", `Value must satisfy exactly one schema branch; matched ${matches}.`);
    }
  }
  if (schema.not && schemaPasses(value, schema.not, rootSchema, registry)) {
    add("SCHEMA-NOT-001", "Value satisfies a forbidden schema.");
  }
  active.delete(visitKey);
  return issues;
}

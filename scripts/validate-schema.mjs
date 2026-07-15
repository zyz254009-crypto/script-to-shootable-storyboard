#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SCHEMA_MARKERS,
  artifactId,
  collectDefinitions,
  collectReferences,
  directExecution,
  exitCodeForIssues,
  findObjectsWithKey,
  isArtifactCandidate,
  isPlainObject,
  isSemver,
  issue,
  loadSchemaRegistry,
  makeReport,
  runValidatorCli,
  validateSchemaSubset,
} from "./lib/core.mjs";

const VALIDATOR = "validate-schema";
const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_DIRECTORY = path.resolve(
  SCRIPT_DIRECTORY,
  "../references/schemas",
);

function looksLikeProjectBundle(data) {
  if (!isPlainObject(data)) return false;
  const keys = new Set(Object.keys(data));
  return [
    "job_spec",
    "source_manifests",
    "scenes",
    "beat_sheet",
    "shot_list",
    "artifacts",
  ].filter((key) => keys.has(key)).length >= 2;
}

function validateProjectBundleBasics(data, issues) {
  if (!looksLikeProjectBundle(data)) return;
  const requirements = [
    ["job_spec", ["job_spec", "job_specs"]],
    ["source_manifests", ["source_manifest", "source_manifests"]],
    ["scenes", ["scene", "scenes"]],
    ["beat_sheet", ["beat_sheet", "beat_sheets"]],
    ["shot_list", ["shot_list", "shot_lists"]],
  ];
  for (const [label, alternatives] of requirements) {
    if (!alternatives.some((key) => Object.hasOwn(data, key))) {
      issues.push(
        issue({
          severity: "error",
          rule_id: "SCHEMA-BUNDLE-001",
          artifact_id: data.project_id ?? "PROJECT",
          field_path: `/${label}`,
          evidence: `Project bundle is missing required object "${label}".`,
          repair_owner: "project-orchestrator",
          autofix_allowed: false,
        }),
      );
    }
  }
}

export async function validateSchema(data, context = {}) {
  const issues = [];
  if (!isPlainObject(data) && !Array.isArray(data)) {
    issues.push(
      issue({
        severity: "blocker",
        rule_id: "SCHEMA-ROOT-001",
        evidence: "The JSON root must be an object or array of artifacts.",
        repair_owner: "artifact-owner",
        autofix_allowed: false,
      }),
    );
    return makeReport({
      validator: VALIDATOR,
      inputPath: context.inputPath,
      issues,
      exitCode: 2,
    });
  }

  let registry;
  try {
    registry = await loadSchemaRegistry(SCHEMA_DIRECTORY);
  } catch (error) {
    issues.push(
      issue({
        severity: "blocker",
        rule_id: "SCHEMA-REGISTRY-001",
        evidence: `Cannot load bundled schemas: ${error.message}`,
        repair_owner: "schema-maintainer",
        autofix_allowed: false,
      }),
    );
    return makeReport({
      validator: VALIDATOR,
      inputPath: context.inputPath,
      issues,
      exitCode: 2,
    });
  }

  validateProjectBundleBasics(data, issues);
  let artifactCount = 0;
  const validatedObjects = new Set();

  for (const [filename, marker] of Object.entries(SCHEMA_MARKERS)) {
    const schema = registry.get(filename);
    if (!schema) continue;
    for (const found of findObjectsWithKey(data, marker)) {
      if (!isArtifactCandidate(found.value, filename, found.pointer)) continue;
      if (validatedObjects.has(found.value)) continue;
      validatedObjects.add(found.value);
      artifactCount += 1;
      const id = artifactId(found.value, found.value[marker] ?? "PROJECT");
      if (
        typeof found.value.schema_version !== "string" ||
        !isSemver(found.value.schema_version)
      ) {
        issues.push(
          issue({
            severity: "error",
            rule_id: "SCHEMA-VERSION-001",
            artifact_id: id,
            field_path: `${found.pointer === "/" ? "" : found.pointer}/schema_version`,
            evidence: "schema_version is missing or is not valid SemVer.",
            repair_owner: "artifact-owner",
            autofix_allowed: false,
          }),
        );
      }
      validateSchemaSubset({
        value: found.value,
        schema,
        rootSchema: schema,
        registry,
        pointer: found.pointer,
        artifact: id,
        issues,
      });
    }
  }

  if (artifactCount === 0) {
    issues.push(
      issue({
        severity: "blocker",
        rule_id: "SCHEMA-ARTIFACT-001",
        evidence:
          "No recognized storyboard artifact marker was found in the JSON.",
        repair_owner: "project-orchestrator",
        autofix_allowed: false,
      }),
    );
  }

  const definitions = collectDefinitions(data);
  for (const [id, locations] of definitions.byId.entries()) {
    const uniqueDefinitions = locations.filter(
      (entry, index, list) =>
        list.findIndex(
          (other) =>
            other.pointer === entry.pointer && other.type === entry.type,
        ) === index,
    );
    if (uniqueDefinitions.length > 1) {
      issues.push(
        issue({
          severity: "error",
          rule_id: "SCHEMA-ID-001",
          artifact_id: id,
          field_path: uniqueDefinitions[0].pointer,
          evidence: `ID is defined more than once: ${uniqueDefinitions
            .map((entry) => entry.pointer)
            .join(", ")}.`,
          repair_owner: "project-orchestrator",
          autofix_allowed: false,
        }),
      );
    }
  }

  for (const reference of collectReferences(
    data,
    definitions.definitionPointers,
  )) {
    if (!reference.id.trim()) {
      issues.push(
        issue({
          severity: "error",
          rule_id: "SCHEMA-REFERENCE-001",
          field_path: reference.pointer,
          evidence: `Reference field "${reference.field}" contains an empty ID.`,
          repair_owner: "artifact-owner",
          autofix_allowed: false,
        }),
      );
      continue;
    }
    const namespace = definitions.byType.get(reference.targetType);
    if (!namespace || !namespace.has(reference.id)) {
      issues.push(
        issue({
          severity: "error",
          rule_id: "SCHEMA-REFERENCE-002",
          artifact_id: reference.id,
          field_path: reference.pointer,
          evidence: `Reference "${reference.id}" does not resolve to a defined ${reference.targetType} in this project bundle.`,
          repair_owner: "project-orchestrator",
          autofix_allowed: false,
        }),
      );
    }
  }

  const exitCode = exitCodeForIssues(issues);
  return makeReport({
    validator: VALIDATOR,
    inputPath: context.inputPath,
    issues,
    exitCode,
    metadata: { artifacts_checked: artifactCount },
  });
}

const HELP = `
Usage: node validate-schema.mjs <input.json>

Validate parseable project/artifact JSON against the bundled schema subset.
Checks schema_version, required structures, primitive constraints, duplicate IDs,
and resolvable references available inside the same input.

Exit codes:
  0  Passed (warnings/suggestions may remain)
  1  Reserved for non-schema validation failures
  2  JSON parsing, schema registry, configuration, or execution failure
  3  Reserved for required human authorization/judgment
`;

if (directExecution(import.meta.url)) {
  await runValidatorCli({
    validator: VALIDATOR,
    validate: validateSchema,
    help: HELP,
  });
}

export default validateSchema;

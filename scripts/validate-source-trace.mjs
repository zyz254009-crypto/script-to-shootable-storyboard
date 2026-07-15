#!/usr/bin/env node

import {
  artifactId,
  directExecution,
  exitCodeForIssues,
  findObjectsWithKey,
  hashMatches,
  isArtifactCandidate,
  isPlainObject,
  issue,
  joinPointer,
  joinPointerPath,
  makeReport,
  resolveJsonPointer,
  runValidatorCli,
  walk,
} from "./lib/core.mjs";

const VALIDATOR = "validate-source-trace";

function buildManifestIndex(data) {
  const documents = new Map();
  for (const found of findObjectsWithKey(data, "source_manifest_id")) {
    if (
      !isArtifactCandidate(
        found.value,
        "source-manifest.schema.json",
        found.pointer,
      )
    ) {
      continue;
    }
    const manifest = found.value;
    const key = `${manifest.source_document_id}@${manifest.source_revision}`;
    const spans = new Map();
    for (const span of manifest.stable_spans ?? []) {
      if (span && typeof span.span_id === "string") {
        spans.set(span.span_id, span);
      }
    }
    documents.set(key, { manifest, spans, pointer: found.pointer });
  }
  return documents;
}

function collectSourceRefs(data) {
  const refs = [];
  walk(data, (value, pointer) => {
    if (
      isPlainObject(value) &&
      typeof value.source_document_id === "string" &&
      typeof value.source_revision === "string" &&
      isPlainObject(value.stable_span) &&
      typeof value.stable_span.span_id === "string"
    ) {
      refs.push({ value, pointer });
    }
  });
  return refs;
}

function validateSourceRef(ref, pointer, manifests, issues, ownerId) {
  const key = `${ref.source_document_id}@${ref.source_revision}`;
  const indexed = manifests.get(key);
  if (!indexed) {
    issues.push(
      issue({
        severity: manifests.size > 0 ? "error" : "warning",
        rule_id: "SOURCE-MANIFEST-001",
        artifact_id: ownerId,
        field_path: pointer,
        evidence:
          manifests.size > 0
            ? `Source document/revision ${key} is not present in the input manifests.`
            : `Cannot resolve ${key}; no source manifest is included in this input.`,
        repair_owner: "source-analysis",
        autofix_allowed: false,
      }),
    );
    return;
  }
  const spanId = ref.stable_span.span_id;
  const stableSpan = indexed.spans.get(spanId);
  if (!stableSpan) {
    issues.push(
      issue({
        severity: "error",
        rule_id: "SOURCE-SPAN-001",
        artifact_id: ownerId,
        field_path: joinPointerPath(pointer, "stable_span", "span_id"),
        evidence: `Stable span ${spanId} does not exist in ${key}.`,
        repair_owner: "source-analysis",
        autofix_allowed: false,
      }),
    );
    return;
  }
  for (const field of ["char_start", "char_end", "line_start", "line_end"]) {
    if (
      ref.stable_span[field] !== undefined &&
      stableSpan[field] !== undefined &&
      ref.stable_span[field] !== stableSpan[field]
    ) {
      issues.push(
        issue({
          severity: "error",
          rule_id: "SOURCE-SPAN-002",
          artifact_id: ownerId,
          field_path: joinPointerPath(pointer, "stable_span", field),
          evidence: `Referenced ${field}=${ref.stable_span[field]} differs from manifest ${field}=${stableSpan[field]}.`,
          repair_owner: "source-analysis",
          autofix_allowed: false,
        }),
      );
    }
  }
  if (
    ref.stable_span.text_hash &&
    stableSpan.text_hash &&
    ref.stable_span.text_hash !== stableSpan.text_hash
  ) {
    issues.push(
      issue({
        severity: "error",
        rule_id: "SOURCE-HASH-001",
        artifact_id: ownerId,
        field_path: joinPointerPath(pointer, "stable_span", "text_hash"),
        evidence: `Referenced text hash does not match manifest span ${spanId}.`,
        repair_owner: "source-analysis",
        autofix_allowed: false,
      }),
    );
  }
  if (
    typeof stableSpan.text === "string" &&
    typeof stableSpan.text_hash === "string" &&
    !hashMatches(stableSpan.text, stableSpan.text_hash)
  ) {
    issues.push(
      issue({
        severity: "blocker",
        rule_id: "SOURCE-HASH-002",
        artifact_id: indexed.manifest.source_manifest_id,
        field_path: `${indexed.pointer}/stable_spans`,
        evidence: `Manifest text for span ${spanId} does not match its SHA-256 hash.`,
        repair_owner: "source-owner",
        autofix_allowed: false,
      }),
    );
  }
  if (
    ref.source_hash &&
    ![indexed.manifest.content_hash, indexed.manifest.source_hash].includes(
      ref.source_hash,
    )
  ) {
    issues.push(
      issue({
        severity: "error",
        rule_id: "SOURCE-HASH-003",
        artifact_id: ownerId,
        field_path: joinPointer(pointer, "source_hash"),
        evidence: `Source hash does not match manifest ${indexed.manifest.source_manifest_id}.`,
        repair_owner: "source-analysis",
        autofix_allowed: false,
      }),
    );
  }
}

function requireNarrativeSource(data, issues) {
  const requirements = [
    {
      key: "scene_id",
      discriminator: (value) => Object.hasOwn(value, "slugline"),
      sourceField: "source_spans",
      allowAuthorization: false,
    },
    {
      key: "beat_id",
      discriminator: (value) => Object.hasOwn(value, "visible_event"),
      sourceField: "source_spans",
      allowAuthorization: false,
    },
    {
      key: "shot_id",
      discriminator: (value) => Object.hasOwn(value, "visible_action"),
      sourceField: "source_spans",
      allowAuthorization: true,
    },
    {
      key: "fact_id",
      discriminator: (value) => Object.hasOwn(value, "canonical_value"),
      sourceField: "source_refs",
      allowAuthorization: false,
    },
  ];
  for (const requirement of requirements) {
    for (const found of findObjectsWithKey(data, requirement.key)) {
      const value = found.value;
      if (!requirement.discriminator(value)) continue;
      const sources = value[requirement.sourceField];
      const authorizations =
        value.authorization_ids ??
        (value.authorization_id ? [value.authorization_id] : []);
      if (
        (!Array.isArray(sources) || sources.length === 0) &&
        !(requirement.allowAuthorization && authorizations.length > 0)
      ) {
        issues.push(
          issue({
            severity: "blocker",
            rule_id: "SOURCE-REQUIRED-001",
            artifact_id: artifactId(value),
            field_path: joinPointer(found.pointer, requirement.sourceField),
            evidence: `${requirement.key} requires source spans${
              requirement.allowAuthorization ? " or an authorization ID" : ""
            }.`,
            repair_owner: "source-analysis",
            autofix_allowed: false,
          }),
        );
      }
    }
  }
}

function validateFieldProvenance(data, manifests, issues) {
  for (const found of findObjectsWithKey(data, "field_provenance")) {
    const owner = found.value;
    const ownerId = artifactId(owner, "PROJECT");
    const provenance = owner.field_provenance;
    if (!isPlainObject(provenance) || Object.keys(provenance).length === 0) {
      issues.push(
        issue({
          severity: "error",
          rule_id: "SOURCE-PROVENANCE-001",
          artifact_id: ownerId,
          field_path: joinPointer(found.pointer, "field_provenance"),
          evidence: "field_provenance must be a non-empty JSON Pointer map.",
          repair_owner: "source-analysis",
          autofix_allowed: false,
        }),
      );
      continue;
    }
    for (const [fieldPointer, entries] of Object.entries(provenance)) {
      const entryPath = joinPointer(
        joinPointer(found.pointer, "field_provenance"),
        fieldPointer,
      );
      if (!/^\/(?:[^~/]|~0|~1)*(?:\/(?:[^~/]|~0|~1)*)*$/.test(fieldPointer)) {
        issues.push(
          issue({
            severity: "error",
            rule_id: "SOURCE-PROVENANCE-002",
            artifact_id: ownerId,
            field_path: entryPath,
            evidence: `"${fieldPointer}" is not a valid JSON Pointer.`,
            repair_owner: "source-analysis",
            autofix_allowed: false,
          }),
        );
      } else if (resolveJsonPointer(owner, fieldPointer) === undefined) {
        issues.push(
          issue({
            severity: "error",
            rule_id: "SOURCE-PROVENANCE-003",
            artifact_id: ownerId,
            field_path: entryPath,
            evidence: `Provenance pointer ${fieldPointer} does not resolve inside its owning artifact.`,
            repair_owner: "source-analysis",
            autofix_allowed: false,
          }),
        );
      }
      if (!Array.isArray(entries) || entries.length === 0) {
        issues.push(
          issue({
            severity: "error",
            rule_id: "SOURCE-PROVENANCE-004",
            artifact_id: ownerId,
            field_path: entryPath,
            evidence: "Each provenance pointer requires at least one entry.",
            repair_owner: "source-analysis",
            autofix_allowed: false,
          }),
        );
        continue;
      }
      entries.forEach((entry, index) => {
        const provenancePath = joinPointer(entryPath, index);
        if (!isPlainObject(entry)) {
          issues.push(
            issue({
              severity: "error",
              rule_id: "SOURCE-PROVENANCE-005",
              artifact_id: ownerId,
              field_path: provenancePath,
              evidence: "Provenance entry must be an object.",
              repair_owner: "source-analysis",
              autofix_allowed: false,
            }),
          );
          return;
        }
        const hasEvidence =
          (Array.isArray(entry.source_refs) && entry.source_refs.length > 0) ||
          (Array.isArray(entry.fact_ids) && entry.fact_ids.length > 0) ||
          Boolean(entry.authorization_id);
        if (!hasEvidence) {
          issues.push(
            issue({
              severity: "error",
              rule_id: "SOURCE-PROVENANCE-006",
              artifact_id: ownerId,
              field_path: provenancePath,
              evidence:
                "Provenance entry requires source_refs, fact_ids, or authorization_id.",
              repair_owner: "source-analysis",
              autofix_allowed: false,
            }),
          );
        }
        if (
          entry.transformation_type === "authorized_addition" &&
          !entry.authorization_id
        ) {
          issues.push(
            issue({
              severity: "blocker",
              rule_id: "SOURCE-AUTH-001",
              artifact_id: ownerId,
              field_path: joinPointer(provenancePath, "authorization_id"),
              evidence:
                "authorized_addition requires an explicit authorization_id.",
              repair_owner: "authorization-review",
              autofix_allowed: false,
            }),
          );
        }
        if (
          entry.transformation_type === "inferred" &&
          !String(entry.inference_note ?? "").trim()
        ) {
          issues.push(
            issue({
              severity: "error",
              rule_id: "SOURCE-INFERENCE-001",
              artifact_id: ownerId,
              field_path: joinPointer(provenancePath, "inference_note"),
              evidence: "An inferred value requires an inference_note.",
              repair_owner: "source-analysis",
              autofix_allowed: false,
            }),
          );
        }
        for (const [sourceIndex, sourceRef] of (
          entry.source_refs ?? []
        ).entries()) {
          validateSourceRef(
            sourceRef,
            joinPointer(
              joinPointer(provenancePath, "source_refs"),
              sourceIndex,
            ),
            manifests,
            issues,
            ownerId,
          );
        }
      });
    }
  }
}

export async function validateSourceTrace(data, context = {}) {
  const issues = [];
  const manifests = buildManifestIndex(data);

  requireNarrativeSource(data, issues);
  validateFieldProvenance(data, manifests, issues);

  const seenRefs = new Set();
  for (const found of collectSourceRefs(data)) {
    const signature = `${found.pointer}|${found.value.source_document_id}|${found.value.source_revision}|${found.value.stable_span.span_id}`;
    if (seenRefs.has(signature)) continue;
    seenRefs.add(signature);
    validateSourceRef(
      found.value,
      found.pointer,
      manifests,
      issues,
      "PROJECT",
    );
  }

  const exitCode = exitCodeForIssues(issues);
  return makeReport({
    validator: VALIDATOR,
    inputPath: context.inputPath,
    issues,
    exitCode,
    metadata: {
      source_manifests_checked: manifests.size,
      source_references_checked: seenRefs.size,
    },
  });
}

const HELP = `
Usage: node validate-source-trace.mjs <input.json>

Validate source manifests, stable spans, field-level provenance, inference notes,
and authorization markers for scenes, beats, facts, and shots.

Exit codes:
  0  Passed (warnings/suggestions may remain)
  1  Contains repairable source-trace errors
  2  JSON, configuration, or execution failure
  3  Requires source-owner or authorization review
`;

if (directExecution(import.meta.url)) {
  await runValidatorCli({
    validator: VALIDATOR,
    validate: validateSourceTrace,
    help: HELP,
  });
}

export default validateSourceTrace;

#!/usr/bin/env node
import fs from "node:fs";
import { pathToFileURL } from "node:url";

export const VALIDATOR = "validate-rights-safety";
export const RULE_VERSION = "1.0.0";

const HELP = `Usage: node validate-rights-safety.mjs <project.json|-> [--pretty]

Validate reference-asset rights, consent evidence, expiry, commercial/AI permissions,
minor and biometric safeguards, live-action safety plans, and release labeling readiness.
This is a governance validator, not legal advice. "-" reads stdin.

Exit codes: 0 no blocking issue; 1 repairable error; 2 invalid input/execution;
3 human authorization, legal, platform, or safety judgment required.`;

const NON_CLEAR = new Set(["pending", "unknown", "expired", "withdrawn", "restricted", "blocked", "counsel_review"]);
const FORBIDDEN = new Set(["forbidden", "prohibited", "unknown"]);
const DANGER_SIGNALS = [
  /武器|枪|刀具|爆炸|烟火|火焰|高空|坠落|吊挂|水下|开放水域|车辆追逐|特技驾驶|打斗|亲密戏|裸露|动物|儿童危险/u,
  /weapon|firearm|explosion|pyrotechnic|open flame|stunt driving|high fall|underwater|fight choreography|intimacy scene/i,
];
const arr = (v) => v == null ? [] : Array.isArray(v) ? v : [v];
const present = (v) => v !== undefined && v !== null && v !== "";

function collect(root, predicate) {
  const out = [];
  const seen = new WeakSet();
  const walk = (v) => {
    if (!v || typeof v !== "object" || seen.has(v)) return;
    seen.add(v);
    if (predicate(v)) out.push(v);
    for (const child of Object.values(v)) walk(child);
  };
  walk(root);
  return out;
}

function textOf(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(textOf).join(" ");
  if (value && typeof value === "object") return Object.values(value).map(textOf).join(" ");
  return "";
}

function issueFactory() {
  let n = 0;
  return (severity, ruleId, artifactId, fieldPath, message, evidence = {}, options = {}) => ({
    issue_id: `${VALIDATOR}-${String(++n).padStart(4, "0")}`,
    severity, validator: VALIDATOR, artifact_id: artifactId ?? "project", field_path: fieldPath,
    rule_id: ruleId, rule_version: RULE_VERSION, evidence: { message, ...evidence },
    repair_owner: options.repairOwner ?? "rights-safety-owner",
    repair_scope: options.repairScope ?? "rights-safety",
    repairable: options.repairable ?? false,
    autofix_allowed: false,
    automatic_fix_allowed: false,
    human_review_required: options.humanReviewRequired ?? true,
    status: "open",
  });
}

function makeReport(project, issues, results, status = null) {
  const normalizedIssues = issues.map((entry) => ({
    ...entry,
    autofix_allowed: entry.autofix_allowed === true || entry.automatic_fix_allowed === true,
    automatic_fix_allowed: entry.autofix_allowed === true || entry.automatic_fix_allowed === true,
  }));
  const summary = { blocker: 0, error: 0, warning: 0, suggestion: 0, total: normalizedIssues.length };
  for (const i of normalizedIssues) summary[i.severity] += 1;
  return {
    schema_version: "1.0.0", report_type: "quality-report", validator: VALIDATOR,
    rule_version: RULE_VERSION, generated_at: new Date().toISOString(),
    artifact_id: project?.job_id ?? project?.project_id ?? "project",
    status: status ?? (summary.blocker || summary.error ? "failed" : summary.warning ? "passed_with_warnings" : "passed"),
    summary, results, issues: normalizedIssues,
  };
}

function rightsStatusOf(value) {
  if (typeof value === "string") return value;
  return value?.verification_status ?? value?.governance?.status
    ?? value?.rights_status?.status ?? value?.rights_status ?? value?.status;
}

function referenceIds(task) {
  return [
    ...arr(task.reference_assets?.images),
    ...arr(task.reference_assets?.videos),
    ...arr(task.reference_assets?.audio),
  ].map((v) => v?.asset_id).filter(Boolean);
}

function isReleaseStage(project) {
  return project?.release_ready === true || project?.final_export === true
    || ["release", "publish", "final_export", "platform_submission"].includes(project?.requested_operation)
    || ["release", "delivery"].includes(project?.stage);
}

function commercialUse(project) {
  return project?.commercial_use === true || project?.job_spec?.commercial_use === true
    || ["advertising", "commercial"].includes(project?.job_spec?.purpose);
}

function clearedGuardianFor(characterId, subjects) {
  return subjects.some((subject) => subject.subject_type === "minor_guardian"
    && (arr(subject.related_person_ids).includes(characterId) || arr(subject.related_character_ids).includes(characterId))
    && rightsStatusOf(subject) === "cleared");
}

export function validateRightsSafety(project) {
  const issues = [];
  const issue = issueFactory();
  const add = (...args) => issues.push(issue(...args));
  const subjects = collect(project, (v) => present(v?.rights_subject_id) && present(v?.subject_type));
  const formalRecords = collect(project, (v) => present(v?.rights_record_id)
    && present(v?.rights_subject_id) && present(v?.verification_status));
  const assets = collect(project, (v) => present(v?.asset_id)
    && (present(v?.rights_status) || present(v?.selection_eligibility)));
  const tasks = collect(project, (v) => present(v?.generation_task_id) && Array.isArray(v?.shot_ids));
  const shots = collect(project, (v) => present(v?.shot_id) && present(v?.production_decision));
  const characters = collect(project, (v) => present(v?.character_id) && v?.age_range && present(v?.appearance_anchor));
  const assetMap = new Map(assets.map((asset) => [asset.asset_id, asset]));
  const subjectMap = new Map([
    ...subjects.map((subject) => [subject.rights_subject_id, subject]),
    ...formalRecords.flatMap((record) => [
      [record.rights_record_id, record],
      [record.rights_subject_id, record],
    ]),
  ]);
  const requiredAssetIds = new Set(tasks.flatMap(referenceIds));
  const blockedItems = [];

  for (const record of formalRecords) {
    const id = record.rights_record_id;
    const status = rightsStatusOf(record);
    if (NON_CLEAR.has(status) || status === "rejected") {
      blockedItems.push({ artifact_id: id, reason: `verification_status=${status}` });
      add("blocker", "RIGHTS.RECORD_NOT_CLEARED", id,
        `rights_records.${id}.verification_status`,
        `Rights record cannot propagate while verification_status is ${status}.`,
        { rights_subject_id: record.rights_subject_id, status });
    }
    const permissions = record.permissions ?? {};
    if (commercialUse(project) && FORBIDDEN.has(permissions.commercial_use)) {
      add("blocker", "RIGHTS.RECORD_COMMERCIAL_USE_BLOCK", id,
        `rights_records.${id}.permissions.commercial_use`,
        "Commercial use is forbidden or unknown for this rights record.",
        { permission: permissions.commercial_use });
    }
    if (FORBIDDEN.has(permissions.ai_reference_use)
      || FORBIDDEN.has(permissions.ai_generated_derivative_use)) {
      add("blocker", "RIGHTS.RECORD_AI_USE_BLOCK", id,
        `rights_records.${id}.permissions`,
        "AI reference or generated-derivative use is forbidden or unknown.",
        {
          ai_reference_use: permissions.ai_reference_use,
          ai_generated_derivative_use: permissions.ai_generated_derivative_use,
        });
    }
    if (record.consent?.required === true
      && record.consent?.status !== "obtained") {
      add("blocker", "RIGHTS.RECORD_CONSENT_MISSING", id,
        `rights_records.${id}.consent.status`,
        "Required consent has not been obtained.",
        { status: record.consent?.status });
    }
    if (["verified", "conditional"].includes(status)) {
      const verifiedEvidence = arr(record.evidence).some((entry) =>
        entry?.verification_status === "verified"
        && present(entry?.locator)
        && present(entry?.evidence_hash)
        && present(entry?.issuer_or_signatory)
        && present(entry?.issued_at));
      if (!verifiedEvidence) {
        add("blocker", "RIGHTS.RECORD_EVIDENCE_INCOMPLETE", id,
          `rights_records.${id}.evidence`,
          "Verified or conditional rights require at least one fully identified, verified evidence record.");
      }
    }
  }

  for (const task of tasks) {
    for (const assetId of referenceIds(task)) {
      const asset = assetMap.get(assetId);
      if (!asset) {
        add("error", "RIGHTS.REFERENCE_ASSET_MISSING", task.generation_task_id,
          `generation_tasks.${task.generation_task_id}.reference_assets`,
          `Reference asset ${assetId} is not present in the project asset registry.`,
          { asset_id: assetId }, { humanReviewRequired: false, repairable: true, repairOwner: "asset-manager" });
        continue;
      }
      const status = rightsStatusOf(asset);
      if (NON_CLEAR.has(status)) {
        blockedItems.push({ artifact_id: assetId, reason: `rights_status=${status}` });
        add("blocker", "RIGHTS.REFERENCE_ASSET_NOT_CLEARED", assetId, `media_assets.${assetId}.rights_status`,
          `Reference asset ${assetId} cannot be used while rights status is ${status}.`,
          { asset_id: assetId, status, generation_task_id: task.generation_task_id });
      } else if (status === "conditional") {
        add("warning", "RIGHTS.CONDITIONAL_ASSET", assetId, `media_assets.${assetId}.rights_status`,
          `Reference asset ${assetId} is conditionally cleared; verify every obligation before submission.`,
          { asset_id: assetId, rights_record_ids: asset.rights_status?.rights_record_ids ?? [] });
      }
      const rights = asset.rights_status ?? {};
      if (commercialUse(project) && FORBIDDEN.has(rights.commercial_use)) {
        add("blocker", "RIGHTS.COMMERCIAL_USE_NOT_ALLOWED", assetId,
          `media_assets.${assetId}.rights_status.commercial_use`,
          "Project is commercial but the asset does not permit commercial use.",
          { commercial_use: rights.commercial_use });
      }
      if (FORBIDDEN.has(rights.ai_use)) {
        add("blocker", "RIGHTS.AI_USE_NOT_ALLOWED", assetId, `media_assets.${assetId}.rights_status.ai_use`,
          "Asset is used by a Generation Task but AI use is forbidden or unknown.", { ai_use: rights.ai_use });
      }
      for (const rightsId of arr(rights.rights_record_ids)) {
        if (subjects.length && !subjectMap.has(rightsId)) {
          add("error", "RIGHTS.RECORD_REFERENCE_MISSING", assetId,
            `media_assets.${assetId}.rights_status.rights_record_ids`,
            `Asset references missing rights record ${rightsId}.`, { rights_subject_id: rightsId },
            { humanReviewRequired: false, repairable: true });
        }
      }
    }
  }

  for (const subject of subjects) {
    const id = subject.rights_subject_id;
    const path = `rights_subjects.${id}`;
    let status = rightsStatusOf(subject);
    const expires = subject.rights_basis?.expires_at;
    if (present(expires) && !Number.isNaN(Date.parse(expires)) && Date.parse(expires) < Date.now()) status = "expired";
    if (NON_CLEAR.has(status)) {
      blockedItems.push({ artifact_id: id, reason: `governance.status=${status}` });
      add("blocker", "RIGHTS.SUBJECT_NOT_CLEARED", id, `${path}.governance.status`,
        `Rights subject cannot propagate while status is ${status}.`, { status, subject_type: subject.subject_type });
    }
    if (["cleared", "conditional"].includes(status)) {
      const evidence = subject.evidence ?? {};
      if (!present(evidence.evidence_uri) || !present(evidence.evidence_hash)
        || !present(evidence.verified_at) || !present(evidence.verified_by)) {
        add("blocker", "RIGHTS.CLEARANCE_EVIDENCE_INCOMPLETE", id, `${path}.evidence`,
          "Cleared or conditional rights must have a verifiable evidence URI, hash, verifier, and date.",
          { evidence_fields_present: {
            evidence_uri: present(evidence.evidence_uri), evidence_hash: present(evidence.evidence_hash),
            verified_at: present(evidence.verified_at), verified_by: present(evidence.verified_by),
          } });
      }
    }
    const permissions = subject.permissions ?? {};
    if (commercialUse(project) && FORBIDDEN.has(permissions.commercial_use)) {
      add("blocker", "RIGHTS.SUBJECT_COMMERCIAL_USE_BLOCK", id, `${path}.permissions.commercial_use`,
        "Commercial use is forbidden or unknown for a required rights subject.",
        { permission: permissions.commercial_use });
    }
    if (["reference_asset", "model_input", "image", "video", "performance", "likeness"].includes(subject.subject_type)
      && requiredAssetIds.size && FORBIDDEN.has(permissions.ai_reference_input)) {
      add("blocker", "RIGHTS.AI_REFERENCE_PERMISSION_BLOCK", id, `${path}.permissions.ai_reference_input`,
        "AI reference-input permission is forbidden or unknown.", { permission: permissions.ai_reference_input });
    }
    if (["voice", "digital_replica", "likeness"].includes(subject.subject_type)) {
      const field = subject.subject_type === "voice" ? "voice_clone_or_synthesis" : "digital_replica";
      if (FORBIDDEN.has(permissions[field])) {
        add("blocker", "RIGHTS.SYNTHETIC_PERSON_PERMISSION_BLOCK", id, `${path}.permissions.${field}`,
          `${field} permission is forbidden or unknown.`, { permission: permissions[field] });
      }
    }
    const privacy = subject.privacy ?? {};
    if (privacy.sensitive_data_present === true || privacy.biometric_data_present === true) {
      const missing = [
        !arr(privacy.purpose_limitation).length && "purpose_limitation",
        !arr(privacy.storage_regions).length && "storage_regions",
        !present(privacy.retention_until) && "retention_until",
        !arr(privacy.access_roles).length && "access_roles",
        !present(privacy.withdrawal_process) && "withdrawal_process",
        !present(privacy.deletion_process) && "deletion_process",
      ].filter(Boolean);
      if (missing.length) add("blocker", "RIGHTS.SENSITIVE_DATA_GOVERNANCE_MISSING", id, `${path}.privacy`,
        "Sensitive or biometric data lacks required purpose, storage, retention, access, withdrawal, or deletion controls.",
        { missing_fields: missing });
    }
  }

  for (const character of characters) {
    if (Number(character.age_range?.maximum) < 18 && !clearedGuardianFor(character.character_id, subjects)) {
      add("blocker", "RIGHTS.MINOR_GUARDIAN_CLEARANCE_MISSING", character.character_id,
        `characters.${character.character_id}.age_range`,
        "A minor character/person lacks a cleared guardian authorization record.",
        { character_id: character.character_id, age_range: character.age_range });
    }
  }

  const safetyRegisters = collect(project, (v) => present(v?.safety_risk_register_id)
    || (Array.isArray(v?.risks) && /safety/i.test(String(v?.register_type ?? ""))));
  for (const shot of shots) {
    if (!["live", "hybrid"].includes(shot.production_decision?.primary_method)) continue;
    const text = textOf({ action: shot.visible_action, timing: shot.timing, decision: shot.production_decision });
    const dangerMatches = DANGER_SIGNALS.filter((pattern) => pattern.test(text)).map(String);
    const structuredTags = arr(shot.safety_risk_ids ?? shot.safety_tags);
    if (!dangerMatches.length && !structuredTags.length) continue;
    const covered = safetyRegisters.some((register) => {
      const rText = textOf(register);
      return rText.includes(shot.shot_id) || structuredTags.some((tag) => rText.includes(tag));
    });
    if (!covered) {
      add("blocker", "SAFETY.LIVE_ACTION_PLAN_MISSING", shot.shot_id,
        `shots.${shot.shot_id}.production_decision`,
        "Live or hybrid Shot contains a structured/linguistic danger signal but has no linked safety risk plan.",
        { danger_signals: dangerMatches, safety_tags: structuredTags });
    }
  }

  const hasAiWork = tasks.length > 0 || shots.some((s) => ["seedance", "hybrid", "composite"].includes(s.production_decision?.primary_method));
  if (hasAiWork && isReleaseStage(project)) {
    const labelingPlans = collect(project, (v) => present(v?.aigc_labeling_plan_id)
      || (v?.plan_type === "aigc_labeling" && present(v?.status)));
    if (!labelingPlans.length) {
      add("blocker", "COMPLIANCE.AIGC_LABELING_PLAN_MISSING", project?.job_id ?? "project",
        "$.aigc_labeling_plan", "Release-stage AI content lacks a versioned AIGC/platform disclosure plan.",
        { requested_operation: project?.requested_operation ?? null, stage: project?.stage ?? null });
    } else if (labelingPlans.some((plan) => NON_CLEAR.has(plan.status))) {
      add("blocker", "COMPLIANCE.AIGC_LABELING_UNRESOLVED", project?.job_id ?? "project",
        "$.aigc_labeling_plan.status", "AIGC labeling or platform disclosure remains unresolved.",
        { statuses: labelingPlans.map((v) => v.status) });
    }
  }

  const results = {
    rights_subject_count: subjects.length,
    referenced_asset_count: requiredAssetIds.size,
    safety_register_count: safetyRegisters.length,
    release_stage: isReleaseStage(project),
    blocked_items: blockedItems,
    legal_disclaimer: "Governance checks only; not legal advice or safety approval.",
  };
  const applicable = subjects.length || formalRecords.length || assets.length || tasks.length || shots.length;
  return makeReport(project, issues, results, applicable ? null : "not_applicable");
}

export function exitCodeFor(report) {
  if (report.status === "invalid") return 2;
  if (report.issues.some((i) => i.human_review_required)) return 3;
  if (report.issues.some((i) => ["blocker", "error"].includes(i.severity))) return 1;
  return 0;
}

export async function runCli(argv = process.argv.slice(2)) {
  if (argv.includes("--help") || argv.includes("-h")) { process.stdout.write(`${HELP}\n`); return 0; }
  const pretty = argv.includes("--pretty");
  const input = argv.find((v) => !v.startsWith("-")) ?? (argv.includes("-") ? "-" : null);
  if (!input) throw new Error("Missing project JSON path.");
  const project = JSON.parse(input === "-" ? fs.readFileSync(0, "utf8") : fs.readFileSync(input, "utf8"));
  const report = validateRightsSafety(project);
  process.stdout.write(`${JSON.stringify(report, null, pretty ? 2 : 0)}\n`);
  return exitCodeFor(report);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().then((code) => { process.exitCode = code; }).catch((error) => {
    const issue = issueFactory()("blocker", "RIGHTS.EXECUTION_FAILURE", "project", "$",
      error.message, { name: error.name }, { repairOwner: "pipeline-operator", repairable: false });
    process.stdout.write(`${JSON.stringify(makeReport({}, [issue], {}, "invalid"))}\n`);
    process.exitCode = 2;
  });
}

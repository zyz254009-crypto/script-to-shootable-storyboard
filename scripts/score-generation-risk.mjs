#!/usr/bin/env node
import fs from "node:fs";
import { pathToFileURL } from "node:url";

export const VALIDATOR = "score-generation-risk";
export const RULE_VERSION = "1.0.0";
export const SCORING_POLICY_VERSION = "1.0.0";

const HELP = `Usage: node score-generation-risk.mjs <project.json|-> [--pretty]

Classify Seedance Generation Tasks across identity, motion, action, hand/prop, spatial,
continuity, lip-sync, camera, framing, reflection, physics, environment, audio, multi-shot,
and rights/safety risk. Scores are production triage, not success probabilities.

Exit codes: 0 no blocking issue; 1 repairable error; 2 invalid input/execution;
3 human authorization or judgment required.`;

const WEIGHTS = {
  identity_count: 2, simultaneous_motion: 2, action_chain: 2, hand_prop_precision: 3,
  spatial_constraint: 2, continuity_constraint: 2, dialogue_lipsync: 3, camera_motion: 2,
  framing_lock: 1, occlusion_reflection: 2, physics: 3, environment_complexity: 2,
  audio_complexity: 2, multi_shot_complexity: 3,
};
const arr = (v) => v == null ? [] : Array.isArray(v) ? v : [v];
const present = (v) => v !== undefined && v !== null && v !== "";
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

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

function scoreByCount(count, cuts = [1, 2, 4]) {
  if (count <= cuts[0]) return count === 0 ? 0 : 1;
  if (count <= cuts[1]) return 2;
  return 3;
}

function overlappingPeak(segments) {
  const points = [];
  for (const s of segments) {
    if (!Number.isFinite(s?.start_seconds) || !Number.isFinite(s?.end_seconds)) continue;
    points.push([s.start_seconds, 1], [s.end_seconds, -1]);
  }
  points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let active = 0;
  let peak = 0;
  for (const [, delta] of points) { active += delta; peak = Math.max(peak, active); }
  return peak;
}

function issueFactory() {
  let n = 0;
  return (severity, ruleId, artifactId, fieldPath, message, evidence = {}, options = {}) => ({
    issue_id: `${VALIDATOR}-${String(++n).padStart(4, "0")}`,
    severity, validator: VALIDATOR, artifact_id: artifactId ?? "project", field_path: fieldPath,
    rule_id: ruleId, rule_version: RULE_VERSION, evidence: { message, ...evidence },
    repair_owner: options.repairOwner ?? "seedance-compiler",
    repair_scope: "generation-risk",
    repairable: options.repairable ?? true,
    autofix_allowed: false,
    automatic_fix_allowed: false,
    human_review_required: options.humanReviewRequired ?? false,
    status: "open",
  });
}

function makeReport(project, issues, assessments, status = null) {
  const normalizedIssues = issues.map((entry) => ({
    ...entry,
    autofix_allowed: entry.autofix_allowed === true || entry.automatic_fix_allowed === true,
    automatic_fix_allowed: entry.autofix_allowed === true || entry.automatic_fix_allowed === true,
  }));
  const summary = { blocker: 0, error: 0, warning: 0, suggestion: 0, total: normalizedIssues.length };
  for (const i of normalizedIssues) summary[i.severity] += 1;
  return {
    schema_version: "1.0.0", report_type: "quality-report", validator: VALIDATOR,
    rule_version: RULE_VERSION, scoring_policy_version: SCORING_POLICY_VERSION,
    generated_at: new Date().toISOString(),
    artifact_id: project?.job_id ?? project?.project_id ?? "project",
    status: status ?? (summary.blocker || summary.error ? "failed" : summary.warning ? "passed_with_warnings" : "passed"),
    summary, results: { risk_assessments: assessments }, issues: normalizedIssues,
  };
}

function structuredRightsBlocked(project, task) {
  const assetIds = new Set([
    ...arr(task.reference_assets?.images), ...arr(task.reference_assets?.videos), ...arr(task.reference_assets?.audio),
  ].map((v) => v?.asset_id).filter(Boolean));
  const assets = collect(project, (v) => present(v?.asset_id) && present(v?.rights_status));
  const blocked = [];
  for (const asset of assets) {
    if (!assetIds.has(asset.asset_id)) continue;
    const status = typeof asset.rights_status === "string" ? asset.rights_status : asset.rights_status?.status;
    if (["pending", "unknown", "expired", "withdrawn", "restricted", "blocked"].includes(status)) {
      blocked.push({ asset_id: asset.asset_id, status });
    }
  }
  return blocked;
}

export function assessGenerationTask(task, project = {}) {
  const segments = arr(task.timeline_prompt);
  const text = textOf({
    timeline_prompt: task.timeline_prompt, environment: task.environment,
    audio_requirements: task.audio_requirements, negative_constraints: task.negative_constraints,
  }).toLowerCase();
  const subjects = new Set([
    ...arr(task.subject_lock).map((v) => v?.subject_id),
    ...arr(task.continuity_targets?.locked_character_ids),
  ].filter(Boolean));
  const props = new Set(arr(task.continuity_targets?.locked_prop_ids));
  const lipSync = new Set(arr(task.audio_requirements?.lip_sync_character_ids));
  const cameraComplex = (text.match(/arc|crane|orbit|绕拍|复合运镜|快速|遮挡后|跟拍|甩镜/g) ?? []).length;
  const handPropSignals = (text.match(/手指|指尖|交换|递给|接过|装配|旋开|按钮|戒指|钥匙|录音笔|小道具|hand|finger|prop/g) ?? []).length;
  const physicsSignals = (text.match(/液体|水花|火焰|爆炸|破碎|碰撞|布料|烟雾|雨|fluid|fire|explosion|collision|shatter/g) ?? []).length;
  const reflectionSignals = (text.match(/镜面|镜子|玻璃|反射|遮挡|穿过前景|mirror|reflection|glass|occlusion/g) ?? []).length;
  const environmentSignals = (text.match(/群演|车辆|动物|动态光|天气|人群|crowd|vehicle|animal|weather/g) ?? []).length;
  const audioIds = new Set([
    ...arr(task.audio_requirements?.audio_event_ids),
    ...segments.flatMap((v) => arr(v?.audio_event_ids)),
  ]);
  const dimensions = {
    identity_count: subjects.size <= 1 ? subjects.size : subjects.size === 2 ? 2 : 3,
    simultaneous_motion: clamp(scoreByCount(overlappingPeak(segments), [1, 2, 3]), 0, 3),
    action_chain: clamp(scoreByCount(segments.length, [1, 3, 5]), 0, 3),
    hand_prop_precision: clamp((props.size ? 1 : 0) + (handPropSignals >= 2 ? 1 : 0) + (handPropSignals >= 5 ? 1 : 0), 0, 3),
    spatial_constraint: clamp((arr(task.continuity_targets?.locked_character_ids).length > 1 ? 1 : 0)
      + (arr(task.continuity_targets?.locked_prop_ids).length ? 1 : 0)
      + (/左右|前后|视线|轴线|screen_left|screen_right|eyeline|axis/.test(text) ? 1 : 0), 0, 3),
    continuity_constraint: clamp(scoreByCount(arr(task.continuity_targets?.continuity_entry_ids).length, [0, 2, 4]), 0, 3),
    dialogue_lipsync: lipSync.size === 0 ? 0 : lipSync.size === 1 ? 2 : 3,
    camera_motion: cameraComplex === 0 ? (/pan|tilt|dolly|truck|推近|拉远|摇|移/.test(text) ? 1 : 0)
      : cameraComplex === 1 ? 2 : 3,
    framing_lock: task.first_frame?.composition_hash && task.last_frame_target?.composition_hash ? 2
      : task.first_frame?.composition_hash || task.last_frame_target?.composition_hash ? 1 : 0,
    occlusion_reflection: clamp(reflectionSignals, 0, 3),
    physics: clamp(physicsSignals, 0, 3),
    environment_complexity: clamp(environmentSignals + (subjects.size >= 3 ? 1 : 0), 0, 3),
    audio_complexity: clamp((task.audio_requirements?.mode === "native_generation" ? 1 : 0)
      + (lipSync.size ? 1 : 0) + (audioIds.size >= 3 ? 1 : 0), 0, 3),
    multi_shot_complexity: arr(task.shot_ids).length <= 1 ? 0 : arr(task.shot_ids).length === 2 ? 2 : 3,
  };
  const maximum = Object.values(WEIGHTS).reduce((sum, weight) => sum + weight * 3, 0);
  const weighted = Object.entries(WEIGHTS).reduce((sum, [key, weight]) => sum + dimensions[key] * weight, 0);
  const normalized = Math.round((weighted / maximum) * 100);
  const blockedRights = structuredRightsBlocked(project, task);
  const capability = task.model_profile?.capability_status;
  const hardBlocked = blockedRights.length > 0 || capability === "unknown";
  const riskLevel = hardBlocked ? "blocking" : normalized >= 75 ? "blocking"
    : normalized >= 50 ? "high" : normalized >= 25 ? "medium" : "low";
  const dominant = Object.entries(dimensions)
    .map(([key, value]) => ({ key, value, weighted: value * WEIGHTS[key] }))
    .filter((v) => v.value > 0).sort((a, b) => b.weighted - a.weighted).slice(0, 5);
  return {
    risk_assessment_id: `risk-${task.generation_task_id}`,
    generation_task_id: task.generation_task_id,
    scoring_policy_version: SCORING_POLICY_VERSION,
    dimension_scores: dimensions,
    weighted_score: normalized,
    risk_level: riskLevel,
    dominant_risk_factors: dominant,
    rights_safety_gate: blockedRights.length ? "blocked" : "clear_or_not_applicable",
    blocked_rights_assets: blockedRights,
    unknown_capability_dependencies: capability === "unknown" ? [task.model_profile?.model_profile_id ?? "model_profile"] : [],
    recommended_attempts: riskLevel === "low" ? 2 : riskLevel === "medium" ? 3 : 0,
    production_switch_review_required: ["high", "blocking"].includes(riskLevel),
    interpretation: "Internal production-triage score; not a probability of generation success.",
  };
}

export function scoreGenerationRisk(project) {
  const tasks = collect(project, (v) => present(v?.generation_task_id) && Array.isArray(v?.shot_ids)
    && Array.isArray(v?.timeline_prompt));
  if (!tasks.length) return makeReport(project, [], [], "not_applicable");
  const issues = [];
  const issue = issueFactory();
  const assessments = tasks.map((task) => assessGenerationTask(task, project));
  for (const assessment of assessments) {
    const id = assessment.generation_task_id;
    if (assessment.risk_level === "blocking") {
      const human = assessment.blocked_rights_assets.length > 0 || assessment.unknown_capability_dependencies.length > 0;
      issues.push(issue("blocker", "GENERATION_RISK.BLOCKING", id, `generation_tasks.${id}.risk_assessment`,
        "Generation Task is blocked before submission.", { assessment }, {
          humanReviewRequired: human, repairable: !human,
          repairOwner: human ? "rights-or-model-owner" : "seedance-compiler",
        }));
    } else if (assessment.risk_level === "high") {
      issues.push(issue("warning", "GENERATION_RISK.HIGH", id, `generation_tasks.${id}.risk_assessment`,
        "High-risk Task should be simplified, split, or reviewed for live/hybrid production before attempts.",
        { assessment }));
    } else if (assessment.risk_level === "medium") {
      issues.push(issue("warning", "GENERATION_RISK.MEDIUM", id, `generation_tasks.${id}.risk_assessment`,
        "Medium-risk Task should use bounded attempts and failure-specific repair.", { assessment }));
    }
  }
  return makeReport(project, issues, assessments);
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
  const report = scoreGenerationRisk(project);
  process.stdout.write(`${JSON.stringify(report, null, pretty ? 2 : 0)}\n`);
  return exitCodeFor(report);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().then((code) => { process.exitCode = code; }).catch((error) => {
    const issue = issueFactory()("blocker", "GENERATION_RISK.EXECUTION_FAILURE", "project", "$",
      error.message, { name: error.name }, { repairOwner: "pipeline-operator", repairable: false });
    process.stdout.write(`${JSON.stringify(makeReport({}, [issue], [], "invalid"))}\n`);
    process.exitCode = 2;
  });
}

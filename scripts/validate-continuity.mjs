#!/usr/bin/env node
import fs from "node:fs";
import { pathToFileURL } from "node:url";

export const VALIDATOR = "validate-continuity";
export const RULE_VERSION = "1.0.0";

const HELP = `Usage: node validate-continuity.mjs <project.json|-> [--pretty]

Validate character, prop, environment, action-phase, eyeline, axis, and screen-direction
continuity. "-" reads project JSON from stdin.

Exit codes: 0 no blocking issue; 1 repairable error; 2 invalid input/execution;
3 human authorization or judgment required.`;

const asArray = (value) => value == null ? [] : Array.isArray(value) ? value : [value];
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const present = (value) => value !== undefined && value !== null && value !== "";

function collect(root, predicate) {
  const found = [];
  const seen = new WeakSet();
  const walk = (value) => {
    if (!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    if (predicate(value)) found.push(value);
    for (const child of Object.values(value)) walk(child);
  };
  walk(root);
  return found;
}

function reportFor(project, issues, status = null) {
  const counts = { blocker: 0, error: 0, warning: 0, suggestion: 0 };
  for (const item of issues) counts[item.severity] += 1;
  const finalStatus = status ?? (counts.blocker || counts.error ? "failed" : counts.warning ? "passed_with_warnings" : "passed");
  return {
    schema_version: "1.0.0",
    report_type: "quality-report",
    validator: VALIDATOR,
    rule_version: RULE_VERSION,
    generated_at: new Date().toISOString(),
    artifact_id: project?.job_id ?? project?.project_id ?? "project",
    status: finalStatus,
    summary: { ...counts, total: issues.length },
    issues,
  };
}

function issueFactory() {
  let index = 0;
  return (severity, ruleId, artifactId, fieldPath, message, details = {}, options = {}) => ({
    issue_id: `${VALIDATOR}-${String(++index).padStart(4, "0")}`,
    severity,
    validator: VALIDATOR,
    artifact_id: artifactId ?? "project",
    field_path: fieldPath,
    rule_id: ruleId,
    rule_version: RULE_VERSION,
    evidence: { message, ...details },
    repair_owner: options.repairOwner ?? "continuity-supervisor",
    repair_scope: options.repairScope ?? "continuity-ledger",
    repairable: options.repairable ?? true,
    autofix_allowed: false,
    human_review_required: options.humanReviewRequired ?? false,
    status: "open",
  });
}

function indexBy(items, key) {
  return new Map(asArray(items).filter(Boolean).map((item) => [item?.[key], item]).filter(([id]) => present(id)));
}

function compareField(add, context, kind, entityId, from, to, field, severity = "error") {
  if (!present(from?.[field]) || !present(to?.[field]) || same(from[field], to[field])) return;
  if (context.approved) {
    add("warning", `CONTINUITY.AUTHORIZED_${kind.toUpperCase()}_CHANGE`, context.transitionId,
      `${context.path}.${kind}.${entityId}.${field}`,
      `Authorized or re-established transition changes ${kind} ${entityId}.${field}.`,
      { from: from[field], to: to[field], authorization_id: context.authorizationId ?? null });
    return;
  }
  add(severity, `CONTINUITY.${kind.toUpperCase()}_${field.toUpperCase()}_MISMATCH`, context.transitionId,
    `${context.path}.${kind}.${entityId}.${field}`,
    `${kind} ${entityId}.${field} changes without a recorded source, re-establishment, or authorization.`,
    { from: from[field], to: to[field], from_shot_id: context.fromShotId, to_shot_id: context.toShotId });
}

function compareSnapshots(add, transition, fromEntry, toEntry, transitionIndex) {
  const from = fromEntry?.end_state;
  const to = toEntry?.start_state;
  const transitionId = transition?.continuity_transition_id ?? `${fromEntry?.shot_id}->${toEntry?.shot_id}`;
  const approved = ["authorized_change", "reestablished"].includes(transition?.overall_status)
    || present(transition?.authorization_id)
    || present(transition?.reestablishing_shot_id);
  const context = {
    transitionId,
    approved,
    authorizationId: transition?.authorization_id,
    fromShotId: fromEntry?.shot_id,
    toShotId: toEntry?.shot_id,
    path: `continuity.transitions[${transitionIndex}]`,
  };

  if (!from || !to) {
    add("error", "CONTINUITY.STATE_SNAPSHOT_MISSING", transitionId, context.path,
      "Both the outgoing end_state and incoming start_state are required.",
      { from_state_present: Boolean(from), to_state_present: Boolean(to) });
    return;
  }

  const fromCharacters = indexBy(from.character_states, "character_id");
  const toCharacters = indexBy(to.character_states, "character_id");
  for (const id of new Set([...fromCharacters.keys(), ...toCharacters.keys()])) {
    const a = fromCharacters.get(id);
    const b = toCharacters.get(id);
    if (!a || !b) {
      add(approved ? "warning" : "error", "CONTINUITY.CHARACTER_PRESENCE_MISMATCH", transitionId,
        `${context.path}.characters.${id}`, `Character ${id} appears or disappears across a continuous transition.`,
        { outgoing_present: Boolean(a), incoming_present: Boolean(b) });
      continue;
    }
    for (const field of ["position_mark_id", "screen_direction", "facing_direction", "eyeline_target_id",
      "pose", "wardrobe_state_id", "injury_state_id", "dirt_state_id", "dialogue_state"]) {
      compareField(add, context, "character", id, a, b, field, field === "dialogue_state" ? "warning" : "error");
    }
    const ap = a.action_phase;
    const bp = b.action_phase;
    if (ap?.action_id === bp?.action_id && ap?.phase !== bp?.phase) {
      const order = ["not_started", "anticipation", "in_progress", "contact", "result", "recovery", "completed"];
      const regression = order.indexOf(bp.phase) < order.indexOf(ap.phase) - 1;
      add(regression && !approved ? "error" : "warning", "CONTINUITY.ACTION_PHASE_CHANGE", transitionId,
        `${context.path}.characters.${id}.action_phase`,
        regression ? `Action ${ap.action_id} regresses across the cut.` : `Action ${ap.action_id} changes phase across the cut; verify overlap.`,
        { from: ap, to: bp, authorized: approved });
    }
  }

  const fromProps = indexBy(from.prop_states, "prop_id");
  const toProps = indexBy(to.prop_states, "prop_id");
  for (const id of new Set([...fromProps.keys(), ...toProps.keys()])) {
    const a = fromProps.get(id);
    const b = toProps.get(id);
    if (!a || !b) {
      add(approved ? "warning" : "error", "CONTINUITY.PROP_PRESENCE_MISMATCH", transitionId,
        `${context.path}.props.${id}`, `Prop ${id} appears or disappears without a recorded handoff or state change.`,
        { outgoing_present: Boolean(a), incoming_present: Boolean(b) });
      continue;
    }
    for (const field of ["owner_character_id", "hand", "position_mark_id", "state"]) {
      compareField(add, context, "prop", id, a, b, field);
    }
  }

  for (const field of ["doors_windows_lights", "time_of_day", "weather", "lighting_direction",
    "environment_audio_state_id", "variable_object_states"]) {
    compareField(add, context, "environment", "scene", from.environment_state, to.environment_state, field,
      ["time_of_day", "weather"].includes(field) ? "error" : "warning");
  }

  if (present(from.axis_side) && present(to.axis_side) && from.axis_side !== to.axis_side) {
    const rebuilt = approved || present(transition?.axis_crossing_plan_id);
    add(rebuilt ? "warning" : "error", rebuilt ? "CONTINUITY.AXIS_REESTABLISHED" : "CONTINUITY.AXIS_CROSSING_UNPLANNED",
      transitionId, `${context.path}.axis_side`,
      rebuilt ? "Axis side changes with a declared crossing or re-establishment." : "Axis side changes without a crossing or re-establishing shot.",
      { from: from.axis_side, to: to.axis_side, axis_crossing_plan_id: transition?.axis_crossing_plan_id ?? null });
  }

  for (const [checkIndex, check] of asArray(transition?.checks).entries()) {
    if (check?.status !== "mismatch") continue;
    add(approved ? "warning" : "error", "CONTINUITY.DECLARED_CHECK_MISMATCH", transitionId,
      `${context.path}.checks[${checkIndex}]`,
      `Transition declares a ${check.check_type ?? "continuity"} mismatch.`,
      { check, overall_status: transition?.overall_status ?? null });
  }
  if (transition?.overall_status === "blocked") {
    add("blocker", "CONTINUITY.TRANSITION_BLOCKED", transitionId, `${context.path}.overall_status`,
      "The continuity transition is explicitly blocked.", { blocking_issue_ids: transition.blocking_issue_ids ?? [] });
  }
}

export function validateContinuity(project) {
  const issues = [];
  const add = issueFactory();
  const ledgers = collect(project, (value) => Array.isArray(value?.entries) && Array.isArray(value?.transitions)
    && (present(value?.continuity_ledger_id) || value?.artifact_type === "continuity-ledger"));
  if (!ledgers.length) return reportFor(project, issues, "not_applicable");

  const shotObjects = collect(project, (value) => present(value?.shot_id) && Number.isFinite(value?.sequence));
  const shotOrder = new Map(shotObjects.map((shot) => [shot.shot_id, shot.sequence]));

  for (const [ledgerIndex, ledger] of ledgers.entries()) {
    const entryMap = indexBy(ledger.entries, "shot_id");
    let transitions = asArray(ledger.transitions);
    if (entryMap.size > 1 && transitions.length < entryMap.size - 1) {
      issues.push(add("error", "CONTINUITY.ADJACENT_TRANSITIONS_INCOMPLETE",
        ledger.continuity_ledger_id,
        `continuity_ledgers[${ledgerIndex}].transitions`,
        "A continuity ledger must explicitly cover every adjacent Shot pair.",
        {
          entry_count: entryMap.size,
          minimum_transition_count: entryMap.size - 1,
          actual_transition_count: transitions.length,
        }));
    }
    if (!transitions.length && entryMap.size > 1) {
      const ordered = [...entryMap.values()].sort((a, b) =>
        (shotOrder.get(a.shot_id) ?? Number.MAX_SAFE_INTEGER) - (shotOrder.get(b.shot_id) ?? Number.MAX_SAFE_INTEGER));
      transitions = ordered.slice(0, -1).map((entry, index) => ({
        continuity_transition_id: `derived-${entry.shot_id}-${ordered[index + 1].shot_id}`,
        from_shot_id: entry.shot_id,
        to_shot_id: ordered[index + 1].shot_id,
        overall_status: "matched",
        checks: [],
      }));
    }
    for (const [transitionIndex, transition] of transitions.entries()) {
      const fromEntry = entryMap.get(transition?.from_shot_id);
      const toEntry = entryMap.get(transition?.to_shot_id);
      if (!fromEntry || !toEntry) {
        issues.push(add("error", "CONTINUITY.TRANSITION_REFERENCE_MISSING",
          transition?.continuity_transition_id ?? ledger.continuity_ledger_id,
          `continuity_ledgers[${ledgerIndex}].transitions[${transitionIndex}]`,
          "Transition references a shot without a continuity entry.",
          { from_shot_id: transition?.from_shot_id, to_shot_id: transition?.to_shot_id,
            missing: [!fromEntry ? transition?.from_shot_id : null, !toEntry ? transition?.to_shot_id : null].filter(Boolean) }));
        continue;
      }
      if (fromEntry.scene_id !== toEntry.scene_id && !transition?.authorization_id) continue;
      compareSnapshots((...args) => issues.push(add(...args)), transition, fromEntry, toEntry, transitionIndex);
    }
  }
  return reportFor(project, issues);
}

export function exitCodeFor(report) {
  if (report.status === "invalid") return 2;
  if (report.issues.some((item) => item.human_review_required)) return 3;
  if (report.issues.some((item) => item.severity === "blocker" || item.severity === "error")) return 1;
  return 0;
}

export async function runCli(argv = process.argv.slice(2)) {
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(`${HELP}\n`);
    return 0;
  }
  const pretty = argv.includes("--pretty");
  const input = argv.find((arg) => !arg.startsWith("-")) ?? (argv.includes("-") ? "-" : null);
  if (!input) throw new Error("Missing project JSON path. Use --help for usage.");
  const text = input === "-" ? fs.readFileSync(0, "utf8") : fs.readFileSync(input, "utf8");
  const project = JSON.parse(text);
  const report = validateContinuity(project);
  process.stdout.write(`${JSON.stringify(report, null, pretty ? 2 : 0)}\n`);
  return exitCodeFor(report);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().then((code) => { process.exitCode = code; }).catch((error) => {
    const issue = issueFactory()("blocker", "CONTINUITY.EXECUTION_FAILURE", "project", "$",
      error.message, { name: error.name }, { repairOwner: "pipeline-operator", repairable: false });
    process.stdout.write(`${JSON.stringify(reportFor({}, [issue], "invalid"))}\n`);
    process.exitCode = 2;
  });
}

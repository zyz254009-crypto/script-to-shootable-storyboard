#!/usr/bin/env node
import fs from "node:fs";
import { pathToFileURL } from "node:url";

export const VALIDATOR = "validate-hook-contract";
export const RULE_VERSION = "1.0.0";

const HELP = `Usage: node validate-hook-contract.mjs <project.json|-> [--pretty]

Validate that each hook has a visible/audible promise and is paid off, validly deferred,
or intentionally left open with authorization. "-" reads stdin.

Exit codes: 0 no blocking issue; 1 repairable error; 2 invalid input/execution;
3 human authorization or judgment required.`;
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

function makeIssueFactory() {
  let n = 0;
  return (severity, ruleId, hook, fieldPath, message, evidence = {}, options = {}) => ({
    issue_id: `${VALIDATOR}-${String(++n).padStart(4, "0")}`,
    severity,
    validator: VALIDATOR,
    artifact_id: hook?.hook_id ?? "project",
    field_path: fieldPath,
    rule_id: ruleId,
    rule_version: RULE_VERSION,
    evidence: { message, ...evidence },
    repair_owner: options.repairOwner ?? "hook-editor",
    repair_scope: "hook-contract",
    repairable: options.repairable ?? true,
    autofix_allowed: false,
    human_review_required: options.humanReviewRequired ?? false,
    status: "open",
  });
}

function buildReport(project, issues, status = null) {
  const summary = { blocker: 0, error: 0, warning: 0, suggestion: 0, total: issues.length };
  for (const issue of issues) summary[issue.severity] += 1;
  return {
    schema_version: "1.0.0",
    report_type: "quality-report",
    validator: VALIDATOR,
    rule_version: RULE_VERSION,
    generated_at: new Date().toISOString(),
    artifact_id: project?.job_id ?? project?.project_id ?? "project",
    status: status ?? (summary.blocker || summary.error ? "failed" : summary.warning ? "passed_with_warnings" : "passed"),
    summary,
    issues,
  };
}

export function validateHookContracts(project) {
  const issues = [];
  const issue = makeIssueFactory();
  const hooks = collect(project, (v) => present(v?.hook_id) && present(v?.status)
    && ("promise_beat_ids" in v || "promise_shot_ids" in v));
  if (!hooks.length) return buildReport(project, [], "not_applicable");

  const beatIds = new Set(collect(project, (v) => present(v?.beat_id)).map((v) => v.beat_id));
  const shotIds = new Set(collect(project, (v) => present(v?.shot_id)).map((v) => v.shot_id));

  for (const hook of hooks) {
    const add = (...args) => issues.push(issue(...args));
    const path = `hooks.${hook.hook_id}`;
    if (!arr(hook.promise_beat_ids).length || !arr(hook.promise_shot_ids).length) {
      add("error", "HOOK.PROMISE_REFERENCE_MISSING", hook, `${path}.promise`,
        "A hook must point to at least one promise Beat and one promise Shot.",
        { promise_beat_ids: hook.promise_beat_ids ?? [], promise_shot_ids: hook.promise_shot_ids ?? [] });
    }
    if (!present(hook.visible_or_audible_evidence)) {
      add("error", "HOOK.PROMISE_NOT_OBSERVABLE", hook, `${path}.visible_or_audible_evidence`,
        "The hook promise lacks visible or audible evidence.");
    }
    if (!present(hook.viewer_question) || !present(hook.stakes)) {
      add("error", "HOOK.QUESTION_OR_STAKES_MISSING", hook, path,
        "The hook must define both the viewer question and concrete stakes.",
        { viewer_question_present: present(hook.viewer_question), stakes_present: present(hook.stakes) });
    }
    if (hook.authorized_change === true && !present(hook.authorization_id)) {
      add("blocker", "HOOK.AUTHORIZATION_ID_MISSING", hook, `${path}.authorization_id`,
        "The hook changes story material but has no authorization ID.", {}, { humanReviewRequired: true, repairable: false });
    }
    for (const id of arr(hook.promise_beat_ids)) {
      if (beatIds.size && !beatIds.has(id)) add("error", "HOOK.UNKNOWN_PROMISE_BEAT", hook, `${path}.promise_beat_ids`,
        `Promise Beat ${id} does not exist in the project.`, { beat_id: id });
    }
    for (const id of arr(hook.promise_shot_ids)) {
      if (shotIds.size && !shotIds.has(id)) add("error", "HOOK.UNKNOWN_PROMISE_SHOT", hook, `${path}.promise_shot_ids`,
        `Promise Shot ${id} does not exist in the project.`, { shot_id: id });
    }
    const delayIds = arr(hook.delay_beat_ids);
    const delayFunctions = arr(hook.delay_functions);
    if (delayIds.length !== delayFunctions.length
      || delayFunctions.some((entry) => !delayIds.includes(entry?.beat_id))) {
      add("error", "HOOK.DELAY_FUNCTION_MISSING", hook, `${path}.delay_functions`,
        "Every delay Beat must declare how it increases pressure, information, obstruction, cost, or partial answer.",
        { delay_beat_ids: delayIds, delay_functions: delayFunctions });
    }

    if (hook.status === "paid_off") {
      if (!arr(hook.payoff_beat_ids).length || !arr(hook.payoff_shot_ids).length || !present(hook.payoff_evidence)) {
        add("blocker", "HOOK.PAYOFF_INCOMPLETE", hook, `${path}.payoff`,
          "A paid-off hook must identify payoff Beats, payoff Shots, and observable payoff evidence.",
          { payoff_beat_ids: hook.payoff_beat_ids ?? [], payoff_shot_ids: hook.payoff_shot_ids ?? [],
            payoff_evidence_present: present(hook.payoff_evidence) });
      }
      const payoff = hook.payoff_contract;
      if (!payoff || !arr(payoff.setup_beat_ids).length
        || !arr(payoff.protagonist_action_beat_ids).length
        || !arr(payoff.consequence_beat_ids).length
        || !present(payoff.new_state)) {
        add("blocker", "HOOK.PAYOFF_CAUSAL_CHAIN_INCOMPLETE", hook, `${path}.payoff_contract`,
          "A paid-off hook requires setup, protagonist action, consequence, and a visible new state.",
          { payoff_contract: payoff ?? null });
      }
      if (["deferred", "open_ending"].includes(hook.payoff_type)) {
        add("error", "HOOK.PAYOFF_TYPE_CONTRADICTS_STATUS", hook, `${path}.payoff_type`,
          "A paid-off hook cannot use deferred or open-ending payoff_type.", { payoff_type: hook.payoff_type });
      }
    } else if (hook.status === "deferred_to_episode") {
      if (hook.payoff_type !== "deferred" || !present(hook.deferred_to_episode)
        || !arr(hook.next_episode_bridge_beat_ids).length) {
        add("blocker", "HOOK.INVALID_DEFERRAL", hook, `${path}.deferred_to_episode`,
          "A deferred hook must name the destination episode, use payoff_type=deferred, and provide a bridge Beat.",
          { payoff_type: hook.payoff_type, deferred_to_episode: hook.deferred_to_episode ?? null,
            next_episode_bridge_beat_ids: hook.next_episode_bridge_beat_ids ?? [] });
      }
    } else if (hook.status === "intentionally_unresolved") {
      if (hook.payoff_type !== "open_ending" || !present(hook.authorization_id)) {
        add("blocker", "HOOK.UNRESOLVED_WITHOUT_AUTHORIZATION", hook, `${path}.authorization_id`,
          "An intentionally unresolved promise requires open_ending payoff_type and explicit authorization.",
          { payoff_type: hook.payoff_type, authorization_id: hook.authorization_id ?? null },
          { humanReviewRequired: true, repairable: false });
      }
    } else if (hook.status === "blocked") {
      add("blocker", "HOOK.CONTRACT_BLOCKED", hook, `${path}.status`,
        "The Hook Contract is explicitly blocked.", { blocking_issue_ids: hook.blocking_issue_ids ?? [] });
    } else {
      add("error", "HOOK.UNKNOWN_STATUS", hook, `${path}.status`,
        `Unknown Hook Contract status: ${String(hook.status)}.`, { status: hook.status });
    }

    const promiseSet = new Set([...arr(hook.promise_beat_ids), ...arr(hook.promise_shot_ids)]);
    const payoffSet = [...arr(hook.payoff_beat_ids), ...arr(hook.payoff_shot_ids)];
    const overlap = payoffSet.filter((id) => promiseSet.has(id));
    if (overlap.length && hook.status === "paid_off") {
      add("warning", "HOOK.PROMISE_PAYOFF_OVERLAP", hook, `${path}.payoff`,
        "Promise and payoff reuse the same artifact; verify that the hook is not declared resolved before it develops.",
        { overlapping_ids: overlap });
    }
    const window = hook.target_window;
    if (window && (!Number.isFinite(window.start_seconds) || !Number.isFinite(window.end_seconds)
      || window.end_seconds <= window.start_seconds)) {
      add("error", "HOOK.INVALID_TARGET_WINDOW", hook, `${path}.target_window`,
        "Hook target_window must have finite seconds with end_seconds greater than start_seconds.", { target_window: window });
    }
  }
  return buildReport(project, issues);
}

export function exitCodeFor(report) {
  if (report.status === "invalid") return 2;
  if (report.issues.some((v) => v.human_review_required)) return 3;
  if (report.issues.some((v) => ["blocker", "error"].includes(v.severity))) return 1;
  return 0;
}

export async function runCli(argv = process.argv.slice(2)) {
  if (argv.includes("--help") || argv.includes("-h")) { process.stdout.write(`${HELP}\n`); return 0; }
  const pretty = argv.includes("--pretty");
  const input = argv.find((v) => !v.startsWith("-")) ?? (argv.includes("-") ? "-" : null);
  if (!input) throw new Error("Missing project JSON path.");
  const project = JSON.parse(input === "-" ? fs.readFileSync(0, "utf8") : fs.readFileSync(input, "utf8"));
  const report = validateHookContracts(project);
  process.stdout.write(`${JSON.stringify(report, null, pretty ? 2 : 0)}\n`);
  return exitCodeFor(report);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().then((code) => { process.exitCode = code; }).catch((error) => {
    const issue = makeIssueFactory()("blocker", "HOOK.EXECUTION_FAILURE", {}, "$", error.message,
      { name: error.name }, { repairOwner: "pipeline-operator", repairable: false });
    process.stdout.write(`${JSON.stringify(buildReport({}, [issue], "invalid"))}\n`);
    process.exitCode = 2;
  });
}

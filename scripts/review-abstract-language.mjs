#!/usr/bin/env node
import fs from "node:fs";
import { pathToFileURL } from "node:url";

export const VALIDATOR = "review-abstract-language";
export const RULE_VERSION = "1.0.0";

const HELP = `Usage: node review-abstract-language.mjs <project.json|-> [--pretty]

Review shot, beat, prompt, and storyboard text for abstract psychology, author explanation,
and non-executable style language. Keyword matches alone never cause a hard failure.

Exit codes: 0 no blocking issue; 1 repairable error; 2 invalid input/execution;
3 human authorization or judgment required.`;

const TARGET_KEYS = new Set([
  "visible_action", "visible_event", "description", "summary", "narrative_purpose",
  "visual_instruction", "camera_instruction", "payoff_evidence", "visible_or_audible_evidence",
  "physical_description", "framing", "lighting", "weather_or_atmosphere",
]);
const ABSTRACT_TERMS = [
  "释然", "宿命", "压迫感", "高级感", "心如死灰", "心碎", "复杂情绪", "意味深长",
  "终于明白", "意识到", "决定反击", "不再隐忍", "内心挣扎", "气氛凝固", "空气凝固",
  "真正含义", "占据主动", "权力逆转", "感到危险", "事情没那么简单", "眼神复杂",
];
const OBSERVABLE_TERMS = [
  "拿", "放", "推", "拉", "关", "开", "走", "站", "坐", "抬", "低", "转", "停", "递",
  "撕", "按", "握", "松", "看向", "退", "挡", "敲", "响", "显示", "亮", "熄灭", "落",
  "门", "桌", "手机", "屏幕", "合同", "工牌", "钥匙", "录音笔", "脚步", "呼吸", "声音",
];
const AUTHOR_PATTERNS = [
  /不是[^。；，]{0,40}而是/u,
  /(其实|真正|代表|意味着|象征着|看似).{0,40}(内心|想法|目的|反抗|得意|退让)/u,
  /(她|他|人物).{0,12}(意识到|终于明白|决定|感到|认为|知道).{0,60}$/u,
];

function collectText(root) {
  const out = [];
  const seen = new WeakSet();
  const walk = (value, path = "$", parent = null) => {
    if (typeof value === "string") {
      const key = path.split(".").at(-1)?.replace(/\[\d+\]$/, "");
      if (TARGET_KEYS.has(key) || parent === "timeline_prompt") out.push({ path, text: value });
      return;
    }
    if (!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) value.forEach((v, i) => walk(v, `${path}[${i}]`, parent));
    else for (const [key, child] of Object.entries(value)) walk(child, `${path}.${key}`, key);
  };
  walk(root);
  return out;
}

function artifactIdFor(path, project) {
  const match = path.match(/(?:shots|generation_tasks|hooks|beats)\.([A-Za-z0-9._:-]+)/);
  return match?.[1] ?? project?.job_id ?? project?.project_id ?? "project";
}

function issueFactory() {
  let n = 0;
  return (severity, ruleId, artifactId, fieldPath, message, evidence = {}, options = {}) => ({
    issue_id: `${VALIDATOR}-${String(++n).padStart(4, "0")}`,
    severity, validator: VALIDATOR, artifact_id: artifactId, field_path: fieldPath,
    rule_id: ruleId, rule_version: RULE_VERSION, evidence: { message, ...evidence },
    repair_owner: options.repairOwner ?? "visual-translator",
    repair_scope: "visual-language",
    repairable: true,
    autofix_allowed: false,
    automatic_fix_allowed: false,
    human_review_required: options.humanReviewRequired ?? false,
    status: "open",
  });
}

function makeReport(project, issues, reviewedCount, status = null) {
  const normalizedIssues = issues.map((entry) => ({
    ...entry,
    autofix_allowed: entry.autofix_allowed === true || entry.automatic_fix_allowed === true,
    automatic_fix_allowed: entry.autofix_allowed === true || entry.automatic_fix_allowed === true,
  }));
  const summary = { blocker: 0, error: 0, warning: 0, suggestion: 0, total: normalizedIssues.length, reviewed_text_fields: reviewedCount };
  for (const i of normalizedIssues) summary[i.severity] += 1;
  return {
    schema_version: "1.0.0", report_type: "quality-report", validator: VALIDATOR,
    rule_version: RULE_VERSION, generated_at: new Date().toISOString(),
    artifact_id: project?.job_id ?? project?.project_id ?? "project",
    status: status ?? (summary.blocker || summary.error ? "failed" : summary.warning ? "passed_with_warnings" : "passed"),
    summary, issues: normalizedIssues,
  };
}

export function reviewAbstractLanguage(project) {
  const fields = collectText(project);
  const issues = [];
  const issue = issueFactory();
  const resolutionTargets = new Set();
  const seen = new WeakSet();
  const collectResolutionTargets = (value) => {
    if (!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    if (typeof value.abstract_resolution_id === "string") {
      for (const beatId of value.target_beat_ids ?? []) resolutionTargets.add(beatId);
    }
    for (const child of Object.values(value)) collectResolutionTargets(child);
  };
  collectResolutionTargets(project);

  const beatSeen = new WeakSet();
  const inspectBeatSources = (value, path = "$") => {
    if (!value || typeof value !== "object" || beatSeen.has(value)) return;
    beatSeen.add(value);
    if (
      typeof value.beat_id === "string" &&
      typeof value.source_text === "string"
    ) {
      const matchedTerms = ABSTRACT_TERMS.filter((term) =>
        value.source_text.includes(term),
      );
      const matchedPatterns = AUTHOR_PATTERNS.filter((pattern) =>
        pattern.test(value.source_text),
      ).map(String);
      if (
        (matchedTerms.length || matchedPatterns.length) &&
        !resolutionTargets.has(value.beat_id)
      ) {
        issues.push(
          issue(
            "error",
            "ABSTRACT.SOURCE_MAPPING_MISSING",
            value.beat_id,
            `${path}.source_text`,
            "An abstract source Beat requires an explicit abstract_resolutions mapping to visible or audible evidence.",
            {
              text: value.source_text,
              matched_terms: matchedTerms,
              matched_patterns: matchedPatterns,
            },
          ),
        );
      }
    }
    if (Array.isArray(value)) {
      value.forEach((child, index) => inspectBeatSources(child, `${path}[${index}]`));
    } else {
      for (const [key, child] of Object.entries(value)) {
        inspectBeatSources(child, `${path}.${key}`);
      }
    }
  };
  inspectBeatSources(project);

  for (const field of fields) {
    const matchedTerms = ABSTRACT_TERMS.filter((term) => field.text.includes(term));
    const matchedPatterns = AUTHOR_PATTERNS.filter((pattern) => pattern.test(field.text)).map(String);
    if (!matchedTerms.length && !matchedPatterns.length) continue;
    const observable = OBSERVABLE_TERMS.filter((term) => field.text.includes(term));
    const artifactId = artifactIdFor(field.path, project);
    if (matchedPatterns.length && observable.length === 0) {
      issues.push(issue("error", "ABSTRACT.AUTHOR_EXPLANATION_WITHOUT_EVIDENCE", artifactId, field.path,
        "Text appears to explain an inner meaning without an observable action, object state, spatial change, or sound.",
        { text: field.text, matched_patterns: matchedPatterns, observable_signals: observable,
          decision_basis: "pattern plus absence of observable evidence; semantic review still required",
          keyword_only_hard_failure: false }));
    } else {
      issues.push(issue("warning", "ABSTRACT.KEYWORD_REVIEW_SIGNAL", artifactId, field.path,
        "Potentially abstract language detected. Keep it only as performance guidance when executable evidence is already present.",
        { text: field.text, matched_terms: matchedTerms, observable_signals: observable,
          decision_basis: "keyword signal only; never a hard failure" }));
    }
    if (/眼神复杂|意味深长|高级感|宿命感|压迫感/u.test(field.text) && observable.length === 0) {
      issues.push(issue("suggestion", "ABSTRACT.REPLACE_STYLE_LABEL", artifactId, field.path,
        "Replace the style or micro-expression label with concrete framing, light, distance, movement, sound, or prop evidence.",
        { text: field.text }));
    }
  }
  return makeReport(project, issues, fields.length, fields.length ? null : "not_applicable");
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
  const report = reviewAbstractLanguage(project);
  process.stdout.write(`${JSON.stringify(report, null, pretty ? 2 : 0)}\n`);
  return exitCodeFor(report);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().then((code) => { process.exitCode = code; }).catch((error) => {
    const issue = issueFactory()("blocker", "ABSTRACT.EXECUTION_FAILURE", "project", "$",
      error.message, { name: error.name }, { repairOwner: "pipeline-operator" });
    process.stdout.write(`${JSON.stringify(makeReport({}, [issue], 0, "invalid"))}\n`);
    process.exitCode = 2;
  });
}

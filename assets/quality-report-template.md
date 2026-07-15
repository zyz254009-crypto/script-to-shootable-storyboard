# 质量报告模板

正式质量报告必须符合 `references/schemas/quality-report.schema.json`。<br>
`scripts/validate-all.mjs` 输出的是运行时汇总报告，`report_type` 为 `validation-aggregate`；需要归档或交付时，再把汇总结果转写成下面这种 `quality_report_id` 对象。

## 生成与判定

- 汇总校验：`node scripts/validate-all.mjs --input project.json --require-validators`
- 单项复核示例：`node scripts/validate-timing.mjs project.json`
- 交付条件：`blocker = 0`、`critical = 0`、`error = 0`，且 `release_assessment.eligible = true`
- 不允许自动批准：权利、授权、隐私、合规、安全、锁定剧情事实、人物身份和结局改写

## 人类可读摘要

| 字段 | 值 |
|---|---|
| 任务 | `JOB-DEMO-001` |
| 报告 | `QUALITY-REPORT-DEMO-001` |
| 状态 | `failed / eligible=false` |
| 阻断 / 严重 / 错误 / 警告 / 建议 | `0 / 0 / 1 / 0 / 0` |
| 人工审批 | `rights-reviewer` |
| 是否允许交付 | 否 |

## 问题清单

| Issue | 严重度 | 类别 | 校验器 / 规则 | 对象与字段 | 修复责任 | 自动修复 | 状态 |
|---|---|---|---|---|---|---|---|
| `ISSUE-DEMO-001` | error | timing | `validate-timing.mjs / TIMING-HEADTAIL-001` | `SHOT-DEMO-001 /capture_or_generation_duration_seconds` | `atomic-shot-design` | 否 | open |

## 机器可读最小示例

```yaml
schema_version: 1.0.0
created_at: "2026-06-25T09:40:00+08:00"
created_by_stage: quality-aggregate
source_hash: "sha256:5555555555555555555555555555555555555555555555555555555555555555"
quality_report_id: QUALITY-REPORT-DEMO-001
job_id: JOB-DEMO-001
report_version: 1.0.0
run_snapshot_id: RUN-SNAPSHOT-DEMO-001

artifact_scope:
  - artifact_id: SHOTLIST-DEMO-001
    artifact_type: shot-list
    artifact_hash: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    schema_version: 1.0.0

tool_runs:
  - tool_run_id: TOOL-RUN-TIMING-001
    tool_name: validate-timing.mjs
    tool_kind: validator
    tool_version: 1.0.0
    rule_registry_version: 1.0.0
    started_at: "2026-06-25T09:39:00+08:00"
    completed_at: "2026-06-25T09:39:04+08:00"
    status: fail
    exit_code: 1
    input_hashes:
      - "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    output_hash: "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"

issues:
  - issue_id: ISSUE-DEMO-001
    severity: error
    report_class: blocking_error
    category: timing
    validator: validate-timing.mjs
    rule_id: TIMING-HEADTAIL-001
    artifact_id: SHOT-DEMO-001
    location: /capture_or_generation_duration_seconds
    message: 请求时长必须覆盖计划可用时长与头尾余量。
    evidence:
      - "requested_duration=7; required_duration=8"
    repair_owner: atomic-shot-design
    repair_scope: timing
    repairable: true
    automatic_fix_allowed: false
    status: open
    release_blocking: true

summary:
  issue_count: 1
  counts_by_severity:
    blocker: 0
    critical: 0
    error: 1
    warning: 0
    info: 0
    suggestion: 0
  counts_by_status:
    open: 1
    accepted: 0
    fixed: 0
    waived: 0
    invalid: 0
  blocking_issue_ids:
    - ISSUE-DEMO-001
  manual_confirmation_issue_ids: []
  risk_warning_issue_ids: []
  creative_suggestion_issue_ids: []

repair_routing:
  - issue_id: ISSUE-DEMO-001
    owner_stage: atomic-shot-design
    repair_scope: timing
    repairable: true
    automatic_patch_allowed: false

release_assessment:
  eligible: false
  blocking_reasons:
    - 存在 timing error。
  required_manual_approvals:
    - rights-reviewer
  metrics_config_id: METRICS-CONFIG-DEMO-001
  gate_result_ids:
    - GATE-TIMING-DEMO-001

report_hash: "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"
field_provenance:
  /issues:
    - provenance_id: PROVENANCE-QUALITY-001
      fact_ids:
        - ISSUE-DEMO-001
      transformation_type: compressed
      derived_by_stage: quality-aggregate
      confidence: 1
```

## 交付决定

- `waived` 必须绑定审批者、理由、时间戳和审批证据哈希；模板里不允许用一句“已人工确认”代替。
- 修复后先跑受影响校验器，再跑 `validate-all.mjs --require-validators`。
- `validation-aggregate` 只可作为运行日志；交付归档必须使用本模板对应的正式质量报告结构。

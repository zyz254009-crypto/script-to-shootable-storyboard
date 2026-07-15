# 已有分镜可拍化修复模板

用于“已有分镜优化/修复”入口。默认只修复可拍性、可剪性、Seedance 适配和连续性问题；不要自动改剧情。

## 修复权限

```yaml
job_id:
input_type: existing_storyboard
revision_permission: faithful
production_mode: undecided
source_storyboard_version:
authorization_ids: []
locked_elements:
  - character_identity
  - core_plot_causality
  - ending
  - evidence_chain
```

## 诊断表

| 原镜号 | 原内容摘要 | 问题类型 | 严重度 | 修复权限 | 修复策略 | 是否需授权 |
|---|---|---|---|---|---|---|
| S001 |  | 一镜多景别 / 心理空话 / 隐含剪辑 / 超时 / 越轴 / 权利未知 / Seedance过载 | blocker / error / warning / suggestion | faithful / visual / pacing / story | 拆镜 / 可见化 / 调整时长 / 降低负载 / 转真人 / 保留待确认 | 是/否 |

## 修复前后对照

| 原镜号 | 新镜号 | 变更类型 | 修复前 | 修复后 | 来源/授权 | 备注 |
|---|---|---|---|---|---|---|
| S001 | S001-A | 拆镜 |  |  | source_span / fact_id / authorization_id |  |
| S001 | S001-B | 拆镜 |  |  | source_span / fact_id / authorization_id |  |

变更类型只允许：

- `preserved`：保留。
- `split`：拆镜。
- `merged`：合镜。
- `visible_translation`：把不可拍描述转成可见/可听证据。
- `timing_adjustment`：调整时长或事件相位。
- `continuity_repair`：修复承接。
- `seedance_deload`：降低生成负载。
- `authorized_story_change`：已授权剧情改写。

## 新分镜最小字段

```yaml
shot_id:
source_shot_id:
scene_id:
beat_ids: []
source_spans: []
fact_ids: []
revision_permission:
change_type:
dominant_shot_size:
camera_setup_id:
coverage_role:
edit_duration_seconds:
capture_or_generation_duration_seconds:
start_state:
visible_action:
end_state:
camera_motion:
audio_event_ids: []
continuity_entry_id:
production_decision:
  primary_method:
  fallback_method:
  switch_conditions: []
  required_handoff_asset_ids: []
field_provenance: {}
```

## 不可越过的边界

- 原镜头如果含多景别，拆成多个新镜号，不要在一个镜号里写“全景推到特写再切反应”。
- 原镜头如果写心理解释，必须转成动作、道具、站位、声音或环境变化。
- 需要新增剧情事实时，先停在建议区；没有 `story` 授权不得写入正式修复后镜头。
- 为 Seedance 降负载时，不得删除关键 Beat；先拆镜、锁机位、减少主体、分离声音或改混合制作。
- 每个修复后镜头必须能追溯到原镜头、原剧本事实或授权记录。

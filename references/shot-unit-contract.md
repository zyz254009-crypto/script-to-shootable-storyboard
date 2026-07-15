# 生产对象与镜头单位契约

## 目录

- [1. 契约目的](#1-契约目的)
- [2. 通用对象封装](#2-通用对象封装)
- [3. ID 与引用规则](#3-id-与引用规则)
- [4. Scene](#4-scene)
- [5. Beat](#5-beat)
- [6. Coverage Need 与 Shot Intent](#6-coverage-need-与-shot-intent)
- [7. Camera Setup](#7-camera-setup)
- [8. Shot](#8-shot)
- [9. Take](#9-take)
- [10. Generation Task](#10-generation-task)
- [11. Generation Attempt](#11-generation-attempt)
- [12. Media Asset](#12-media-asset)
- [13. Timeline Clip](#13-timeline-clip)
- [14. Audio Event](#14-audio-event)
- [15. 对象关系与基数](#15-对象关系与基数)
- [16. 来源与字段级 Provenance](#16-来源与字段级-provenance)
- [17. 状态与生命周期](#17-状态与生命周期)
- [18. 原子镜头契约](#18-原子镜头契约)
- [19. 正反例](#19-正反例)
- [20. 错误路由](#20-错误路由)
- [21. 交付前检查](#21-交付前检查)

## 1. 契约目的

使用本契约区分叙事、摄影、生成、素材和剪辑单位。

不得将以下概念混用：

```text
Scene ≠ Beat ≠ Shot ≠ Take
Shot ≠ Generation Task ≠ Generation Attempt
Generation Attempt ≠ Media Asset ≠ Timeline Clip
```

把每种对象分开编号、分开验证、通过 ID 建立关系。不要用文件夹嵌套暗示对象关系。

## 2. 通用对象封装

为每个结构化对象增加：

```yaml
schema_version:
object_id:
status:
created_at:
created_by_stage:
source_package_hash:
field_provenance:
```

遵守：

1. 使用 JSON Schema Draft 2020-12 验证结构。
2. 使用 SemVer 管理 Schema。
3. 不原地修改已经发布的对象语义。
4. 对重大字段变化生成迁移记录。
5. 把未知值写为 `unknown` 或 `null`，不要编造。
6. 不用自由文本替代已有结构字段。

## 3. ID 与引用规则

### 3.1 推荐前缀

```text
SCN-    Scene
BEAT-   Beat
COV-    Coverage Need
INT-    Provisional Shot Intent
SET-    Camera Setup
SHT-    Shot
TAKE-   Take
GT-     Generation Task
GA-     Generation Attempt
AST-    Media Asset
CLIP-   Timeline Clip
AUE-    Audio Event
FACT-   Fact
AUTH-   Authorization
SRC-    Source Document
```

### 3.2 ID 不变量

- 在项目内保持唯一。
- 创建后不得复用。
- 删除对象时保留墓碑状态，不把 ID 分配给新对象。
- 不因排序变化重编号稳定 ID。
- 在人类表格中可显示场景内镜号，但仍保留机器稳定 ID。
- 在合并并行场景时先检查命名空间冲突。

### 3.3 引用规则

- 验证每个引用对象存在。
- 验证引用类型正确。
- 验证引用对象未被废弃。
- 验证跨版本引用明确指向版本。
- 禁止用对象名称代替 ID。
- 禁止只写“承接上一镜”；必须引用上一镜 ID。

## 4. Scene

### 4.1 定义

把 Scene 定义为相对连续的地点、时间和戏剧情境中的行动集合。

在以下情况通常新建 Scene：

- 地点发生实质变化。
- 时间发生可感知跳跃。
- 戏剧情境切换到另一个独立行动区。
- 画外回忆、梦境或监控画面形成独立时空。

不要因摄影机换机位而新建 Scene。

### 4.2 最小字段

```yaml
scene_id:
source_refs:
slugline:
location_id:
interior_exterior:
time_of_day:
story_time:
characters_present:
scene_goal:
entry_state:
exit_state:
beat_ids:
```

### 4.3 边界判断

同一会议室内从门口走到桌边仍可属于同一 Scene。会议室切到两小时前的停车场应新建 Scene。

当原稿地点不明确时保留 `location_id: unknown`，不要为方便分镜自行决定豪华办公室或地下车库。

## 5. Beat

### 5.1 定义

把 Beat 定义为行动、目标、信息、关系或局势发生一次有意义变化的最小叙事单位。

不要按句号、对白轮次或预计镜头数机械拆 Beat。

### 5.2 最小字段

```yaml
beat_id:
scene_id:
source_refs:
fact_ids:
start_state:
character_goal:
obstacle:
visible_or_audible_event:
information_before:
information_after:
result:
end_state:
causal_predecessor_ids:
must_preserve:
transformation_type:
```

### 5.3 拆分条件

出现以下变化时考虑新建 Beat：

- 新行动开始。
- 新证据出现。
- 人物目标改变。
- 权力关系改变。
- 观众获得新信息。
- 行动产生可识别结果。
- 冲突进入下一阶段。

一个 Beat 可由多个 Shot 覆盖；一个 Shot 也可同时承载紧密相连的多个 Beat。不要强制一对一。

## 6. Coverage Need 与 Shot Intent

### 6.1 Coverage Need

把 Coverage Need 定义为“剪辑必须看见或听见什么”的需求，不把它当作镜头父节点。

记录：

```yaml
coverage_id:
scene_id:
beat_ids:
required_information:
priority: must_have | safety | optional
role: master | two_shot | over_shoulder | single | reaction | insert | transition | clean_plate
action_overlap_range:
dialogue_overlap_range:
reaction_cut_points:
editorial_reason:
candidate_shot_intent_ids:
```

只创建具有剪辑用途的 Coverage。不要为了“丰富”机械添加特写。

### 6.2 Provisional Shot Intent

在冻结正式 Shot 前创建稳定意图：

```yaml
shot_intent_id:
scene_id:
beat_ids:
coverage_ids:
editorial_purpose:
dominant_subject:
provisional_shot_size:
blocking_requirements:
audio_requirements:
platform_constraints:
status: proposed | allocated_to_setup | frozen_as_shot | rejected
final_shot_id:
```

让 Coverage 和 Camera Setup 引用 Shot Intent，避免引用尚未创建的 Shot。

## 7. Camera Setup

### 7.1 定义

把 Camera Setup 定义为一套可重复使用的摄影机、镜头、灯光、空间和技术配置。

多个 Shot 可以共用一个 Setup。一次 Setup 变更不一定产生新 Scene 或 Beat。

### 7.2 最小字段

```yaml
camera_setup_id:
scene_id:
coordinate_system_ref:
camera_position:
sensor_or_frame_basis:
focal_length:
field_of_view:
height:
orientation:
focus_strategy:
focus_marks:
frame_rate:
shutter:
resolution:
color_space:
lighting_state:
axis_side:
supported_shot_intent_ids:
setup_cost:
```

不要把“低机位、有压迫感”作为完整 Setup。写明位置、高度、方向、视场和轴线侧。

## 8. Shot

### 8.1 定义

把 Shot 定义为成片中两个剪辑点之间的连续画面。

默认输出原子 Shot：

```text
一个连续时空
+ 一个主导景别
+ 一个主要视觉行动单元
+ 一个主要摄影意图
+ 一个开始状态
+ 一个结束状态
+ 一个主要叙事目的
```

“单镜单景别”是本 SKILL 的稳定生产策略，不是通用电影理论。

### 8.2 最小字段

```yaml
shot_id:
scene_id:
beat_ids:
coverage_ids:
source_refs:
fact_ids:
camera_setup_id:
edit_duration_seconds:
capture_or_generation_duration_seconds:
head_handle_seconds:
tail_handle_seconds:
dominant_shot_size:
start_composition:
end_composition:
allowed_composition_drift:
long_take_exception:
camera_angle:
camera_position:
camera_motion:
primary_subject:
start_state:
visible_action:
end_state:
dialogue:
audio_event_ids:
prop_ids:
continuity_in:
continuity_out:
narrative_purpose:
production_method:
```

### 8.3 Shot 边界

默认在以下位置切分 Shot：

- 主导景别跨级变化。
- 摄影机切换到新机位。
- 叙事注意力转移到另一主体。
- 出现新的独立信息结果。
- 地点或时间变化。
- 反应必须独立读取。
- 动作链超出时长或生成预算。

不要因人物眨眼、呼吸或小幅前后移动机械拆镜。

### 8.4 Shot 与画面描述

只写摄影机能够记录的内容：

- 人物动作。
- 可见表情变化。
- 道具状态变化。
- 空间距离变化。
- 环境物理变化。
- 可听见的对白和声音。

不要把导演解释写入 `visible_action`。

## 9. Take

### 9.1 定义

把 Take 定义为真人制作中对一个 Shot 的一次完整录制尝试。

一个 Shot 可以有多个 Take；一个 Take 默认只服务一个 Shot。若一条长录制覆盖多个 Shot，先记录为连续录制资产，再用多个 Timeline Clip 使用其区段。

### 9.2 最小字段

```yaml
take_id:
shot_id:
camera_setup_id:
attempt_number:
recorded_asset_ids:
performance_notes:
continuity_notes:
usable_ranges:
selection_status:
rejection_reasons:
```

不要把 Take 编号当作 Shot 编号。

## 10. Generation Task

### 10.1 定义

把 Generation Task 定义为提交给某个生成模型的结构化目标，不把它等同于实际请求或返回文件。

默认映射：

```text
1 Atomic Shot → 1 Generation Task
```

允许一个 Shot 拆成多个 Task。只有经过风险评估时才允许一个 Task 包含多个 Shot。

### 10.2 最小字段

```yaml
generation_task_id:
shot_ids:
model_profile_id:
duration_seconds:
aspect_ratio:
reference_asset_ids:
first_frame_target:
last_frame_target:
subject_lock:
environment:
timeline_prompt:
negative_constraints:
continuity_targets:
acceptance_criteria:
fallback_plan:
```

Task 只描述目标，不记录一次实际调用的费用和返回结果。

## 11. Generation Attempt

### 11.1 定义

把 Generation Attempt 定义为根据某个 Task 对模型执行的一次实际请求。

一个 Task 可以有多个 Attempt。每次 Attempt 必须可复现到统计层面，并保留完整请求快照。

### 11.2 最小字段

```yaml
attempt_id:
generation_task_id:
provider_entry:
account_region:
model_build:
request_parameters:
seed_if_available:
submitted_at:
result_asset_ids:
failure_codes:
actual_cost:
latency:
artifact_hashes:
acceptance_scores:
selection_status:
rejection_reasons:
```

不要覆盖失败 Attempt。保留失败类型，供降级和成本评估使用。

## 12. Media Asset

### 12.1 定义

把 Media Asset 定义为 Take、Attempt、录音、素材库或合成渲染产生的实际媒体文件。

Media Asset 是源素材，不是最终 Shot，也不是时间线上的一次使用。

### 12.2 最小字段

```yaml
asset_id:
origin_type: take | generation_attempt | composite | audio | library | reference
origin_id:
file_hash:
duration:
frame_rate:
resolution:
color_space:
audio_format:
internal_shot_boundaries:
usable_ranges:
quality_scores:
rights_status:
fact_ids:
field_provenance:
```

同一 Attempt 可以返回多个 Asset。同一 Asset 可以包含多个内部镜头边界。

## 13. Timeline Clip

### 13.1 定义

把 Timeline Clip 定义为剪辑时间线上对某个 Media Asset 的一次使用。

同一 Asset 可以被重复使用；一个 Shot 也可以由多个 Clip 或合成层组成。

### 13.2 最小字段

```yaml
timeline_clip_id:
asset_id:
shot_ids:
source_in:
source_out:
timeline_in:
timeline_out:
head_handle:
tail_handle:
speed:
audio_links:
transition_in:
transition_out:
track_role:
```

只将 `usable_ranges` 内的区段放入 Clip。验证源入点和源出点不越界。

不要把整个 15 秒生成结果自动当作 15 秒成片镜头。

## 14. Audio Event

把 Audio Event 定义为对白、画外音、旁白、环境声、拟音、音乐、Wild Track 或声画桥在统一时间轴上的事件。

记录：

```yaml
audio_event_id:
type:
source_media_asset_id:
start:
end:
timebase: shot_local | timeline_global
shot_ids:
timeline_clip_ids:
required_for_comprehension:
lip_sync_required:
post_dub_allowed:
continuity_state:
fact_ids:
```

不要把声音只写在备注中。需要跨镜延续时引用两个以上 Shot 或 Clip。

## 15. 对象关系与基数

按以下关系验证：

```text
Script 1 ── * Scene
Scene 1 ── * Beat
Beat * ── * Coverage Need
Coverage Need * ── * Shot Intent
Camera Setup 1 ── * Shot
Shot * ── * Beat
Shot * ── * Generation Task
Generation Task 1 ── * Generation Attempt
Shot 1 ── * Take
Take / Generation Attempt / Composite / Audio 1 ── * Media Asset
Media Asset 1 ── * Timeline Clip
Shot * ── * Timeline Clip
Audio Event * ── * Shot / Timeline Clip
```

重点检查：

- Beat 与 Shot 为多对多。
- Shot 与 Task 可多对多。
- Task 与 Attempt 为一对多。
- Shot 与 Take 为一对多。
- Attempt 与 Asset 为一对多。
- Asset 与 Clip 为一对多。
- Shot 与 Clip 为多对多。

不要把这些关系压成一棵严格父子树。

## 16. 来源与字段级 Provenance

### 16.1 来源记录

为任何承载叙事信息的字段记录：

```yaml
source_document_id:
source_revision:
stable_span:
source_hash:
fact_ids:
transformation_type: verbatim | visualized | compressed | reordered | inferred | authorized_addition
authorization_id:
derived_by_stage:
confidence:
```

### 16.2 必须带 Provenance 的字段

至少覆盖：

- Beat 的事件、信息变化和结果。
- Shot 的动作、对白、开始状态、结束状态和叙事目的。
- Task 的动作、声音和连续性目标。
- Audio Event 的文字和叙事用途。
- Asset 的来源 Shot 或录制目标。
- Clip 的来源 Asset、Shot 和使用区间。

禁止只在对象顶部挂一个来源，然后让内部字段自由变化。

### 16.3 转换类型约束

- 使用 `verbatim` 表示直接保留。
- 使用 `visualized` 表示不改变事实的画面化。
- 使用 `compressed` 表示压缩重复表达。
- 使用 `reordered` 表示在授权范围内调整顺序。
- 使用 `inferred` 表示可撤销推断。
- 使用 `authorized_addition` 表示有授权 ID 的新增事实。

`inferred` 不得写入锁定事实。`authorized_addition` 缺少授权 ID 时必须阻断。

## 17. 状态与生命周期

### 17.1 推荐状态

```text
draft
validated
approved
rejected
superseded
blocked
```

### 17.2 生命周期规则

- 只允许已验证 Beat 进入正式 Shot 设计。
- 只允许已冻结 Shot 生成 Task。
- 只允许已记录 Task 的 Attempt 进入候选。
- 只允许通过验收的 Asset 创建最终 Clip。
- 只允许权利状态有效的 Clip 进入最终导出。
- 变更上游锁定事实时，把所有下游对象标记为 `superseded` 并重新验证。

不要静默更新下游对象来掩盖上游变化。

## 18. 原子镜头契约

### 18.1 硬要求

- 定义一个主导景别。
- 定义一个连续时空。
- 定义一个主要视觉行动单元。
- 定义一个主要摄影意图。
- 定义开始状态和结束状态。
- 定义主要叙事目的。
- 定义来源 Beat 或授权新增。
- 让动作、对白、反应和运镜在时间轴内可执行。

### 18.2 允许的同镜内容

允许以下内容留在同一 Shot：

- 双人关系镜头中的一说一听。
- 与主要行动不可分割的即时结果。
- 同级景别范围内的小幅走位。
- 简单推、摇或移，但不跨越主导景别等级。
- 同一连续动作中的短反应。

### 18.3 必须拆镜或声明例外

- 从全景明显推进到近景。
- 同一描述出现“切到”“再切至”。
- 无过渡地改变地点或时间。
- 同时要求互相冲突的机位。
- 注意力从主体 A 完整转移到主体 B 并需独立读取。
- 动作链包含多个独立结果节点。

连续长镜头例外必须记录：

```yaml
long_take_exception: true
start_composition:
end_composition:
camera_path:
action_path:
reason:
failure_fallback:
```

## 19. 正反例

### 19.1 Shot、Task、Attempt、Asset、Clip 正例

```text
SHT-012：近景，女主把录音笔放到桌面。
GT-012：生成该动作的 6 秒 Seedance 任务。
GA-012-01：第一次请求，手部变形，淘汰。
GA-012-02：第二次请求，返回 AST-041。
AST-041：8 秒媒体文件，1.1–6.7 秒可用。
CLIP-026：使用 AST-041 的 1.4–5.9 秒，对应成片 SHT-012。
```

每个对象边界清楚。

反例：

```text
镜头12：Seedance生成8秒，第二版，剪到4秒。
```

该写法混合 Shot、Task、Attempt、Asset 和 Clip，无法追踪。

### 19.2 Beat 与 Shot 正例

原文：

```text
经理指控她伪造合同。她把录音笔放到桌上，会议室安静下来。
```

可以拆为三个 Beat，并用经理近景、录音笔插入、众人反应三个 Shot 覆盖。不要宣称每个 Beat 必须正好一个 Shot。

### 19.3 原子镜头正例

```text
近景，固定机位。她从画面下方抬起录音笔，放到桌面中央，手指离开。
```

反例：

```text
全景拍会议室，推到女主近景，再切录音笔特写，最后摇到经理冷汗。
```

该描述含多个剪辑镜头和多个景别，必须拆分。

## 20. 错误路由

| 错误 | 严重级别 | 返回对象/阶段 | 处理 |
|---|---|---|---|
| ID 重复 | blocker | 对象创建 | 分配新稳定 ID，不覆盖旧对象 |
| 引用不存在 | blocker | 关系建立 | 修复引用或恢复上游对象 |
| Scene 与 Shot 混用 | blocker | 剧本解析 | 重新划分对象 |
| Beat 按镜头机械拆分 | error | Beat 分析 | 按行动/信息变化重拆 |
| Coverage 引用未创建 Shot | error | Shot Intent | 改引用稳定 Intent |
| Shot 缺来源 Beat | blocker | Shot 设计 | 绑定 Beat 或授权新增 |
| Shot 含未标记剪辑 | blocker | 原子镜头 | 拆镜或声明长镜头例外 |
| Task 被当作实际请求 | error | 生成编译 | 创建独立 Attempt |
| Attempt 结果未建 Asset | error | 资产登记 | 为返回文件建立 Asset |
| 整个 Asset 被直接当成 Shot | error | 时间线 | 建立 Clip 和入出点 |
| Clip 超出 Asset 可用范围 | blocker | 剪辑装配 | 调整入出点或换 Asset |
| `inferred` 被写成锁定事实 | blocker | 来源追踪 | 退回事实台账 |
| 新增事实无授权 ID | blocker | 权限控制 | 删除或取得授权 |
| 上游变化后下游仍标记有效 | blocker | 生命周期 | 标记过期并重跑验证 |

## 21. 交付前检查

逐项确认：

- Scene、Beat、Shot、Task、Attempt、Asset、Clip 使用不同 ID。
- 每个 Shot 能追溯到 Beat、原文或授权新增。
- 每个 Task 引用一个或多个冻结 Shot。
- 每个 Attempt 引用一个 Task。
- 每个 Asset 记录明确来源和文件哈希。
- 每个最终 Clip 引用可用 Asset 区间。
- 每个 Shot 的开始状态能承接上游结束状态。
- 所有叙事字段都有字段级 Provenance。
- 没有把生成时长当作剪辑时长。
- 没有把原始 Asset 当作最终成片镜头。
- 原子 Shot 没有隐含剪辑或未授权事实。
- 所有阻断错误已解决，或交付被明确标记为阻塞。

# 生成风险、Attempt 评审与分支修复

本文件规定如何评估 Seedance 生成风险、记录实际 Attempt、选择可用 `Media Asset`、建立 `Timeline Clip`，以及在失败时切换为更简单的 AI 任务、真人拍摄或混合制作。

## 目录

1. [原则与对象边界](#1-原则与对象边界)
2. [生成前风险评估](#2-生成前风险评估)
3. [风险等级与阻断条件](#3-风险等级与阻断条件)
4. [Attempt 协议](#4-attempt-协议)
5. [失败分类](#5-失败分类)
6. [分支修复矩阵](#6-分支修复矩阵)
7. [Media Asset 验收](#7-media-asset-验收)
8. [Timeline Clip 装配](#8-timeline-clip-装配)
9. [真人、AI 与混合制作切换](#9-真人ai-与混合制作切换)
10. [停止、升级与回滚](#10-停止升级与回滚)
11. [实测回写](#11-实测回写)
12. [示例](#12-示例)

## 1. 原则与对象边界

不要把“模型支持某能力”解释成“这个镜头能稳定成功”。风险评估服务于生产选择，不服务于宣传模型。

保持链路：

```text
Generation Task
  → Generation Attempt
  → Media Asset
  → usable range
  → Timeline Clip
```

每一层分别回答：

- Task：希望模型完成什么。
- Attempt：实际提交了什么参数和素材。
- Asset：模型实际返回了什么。
- Usable range：返回结果中哪段可以用。
- Clip：这段素材如何进入时间线。

同一 Task 可以有多个 Attempt；同一 Attempt 可以返回多个 Asset；同一 Asset 可以生成多个 Clip。不要覆盖失败记录，也不要只保存最后一次结果。

## 2. 生成前风险评估

### 2.1 评分不是成功率

风险分只用于：

- 比较同一项目内的任务。
- 决定 Attempt 数量。
- 决定是否先拆镜或改制作方式。
- 选择对应修复分支。

在没有真实项目数据校准前，不要把风险分转换为精确成功概率。

### 2.2 风险维度

每项使用 `0..3`：

```text
0 = 不存在或可忽略
1 = 单一、清楚、低负载
2 = 多重或需要精确一致性
3 = 高精度、强耦合或已知常见失败
```

记录以下维度：

| 维度 | 0 分示例 | 3 分示例 |
|---|---|---|
| identity_count | 无人物或单一背影 | 三名以上可辨识人物持续同屏 |
| simultaneous_motion | 单一主体小动作 | 多主体沿不同路径同时移动 |
| action_chain | 单一动作 | 多步动作依赖前一步精确结果 |
| hand_prop_precision | 无手部交互 | 手指操作小物件、交换或装配 |
| spatial_constraint | 自由背景 | 严格左右位置、视线、遮挡和距离 |
| continuity_constraint | 独立镜头 | 必须逐项承接服装、伤势、道具和姿势 |
| dialogue_lipsync | 无对白 | 多人长对白、重叠对白或精确语言同步 |
| camera_motion | 固定机位 | 复合运镜、绕拍、快速遮挡后重构图 |
| framing_lock | 构图容许变化 | 必须严格首尾构图和主导景别 |
| occlusion_reflection | 无遮挡 | 镜面、玻璃、反射和主体多次遮挡 |
| physics | 静态或简单落体 | 液体、破坏、碰撞、火焰或布料强交互 |
| environment_complexity | 简单室内 | 群演、车辆、动物、天气和动态光源 |
| audio_complexity | 后期静音 | 同期对白、音乐、环境声和动作精确同步 |
| multi_shot_complexity | 单原子 Shot | 单次生成包含多场景、多角度和内部剪辑 |
| rights_safety | 无特殊风险 | 公众人物、未成年人、危险动作或受限素材 |

### 2.3 权重和解释

初始建议权重：

```yaml
identity_count: 2
simultaneous_motion: 2
action_chain: 2
hand_prop_precision: 3
spatial_constraint: 2
continuity_constraint: 2
dialogue_lipsync: 3
camera_motion: 2
framing_lock: 1
occlusion_reflection: 2
physics: 3
environment_complexity: 2
audio_complexity: 2
multi_shot_complexity: 3
rights_safety: gate
```

这些权重是内部初始策略，不是 Seedance 官方结论。真实回写积累后按版本校准，并保留旧版本。

### 2.4 风险报告

```yaml
risk_assessment_id:
generation_task_id:
model_id:
model_profile_version:
scoring_policy_version:
dimension_scores: {}
weighted_score:
risk_band: low | medium | high | blocked
dominant_risk_factors: []
unknown_capability_dependencies: []
required_preflight_repairs: []
recommended_attempts:
production_switch_review_required:
```

如果任务依赖 `unknown` 模型能力，不能因为总分低而判为低风险。把风险至少升级一级，或在账号快照中先验证能力。

## 3. 风险等级与阻断条件

初始风险带可按归一化分值设置：

```text
low:     0–24%
medium: 25–49%
high:   50–74%
blocked: ≥75% 或命中硬阻断
```

这些阈值同样属于内部策略，必须通过实测校准。

### 3.1 硬阻断

出现以下任一项时，不得直接提交：

- 请求超出已核验的时长、模态或参考素材数量。
- 依赖的模型能力为 `unsupported`。
- 地区、账号或产品入口不具备所需功能。
- 参考素材权利、肖像、声音或隐私状态不允许使用。
- Task 与 Shot、连续性或锁定剧情事实冲突。
- 原子模式下存在未标记内部切镜、时空跳跃或多景别。
- 首帧和尾帧状态互相矛盾。
- 高风险危险动作没有安全或制作替代方案。
- 成本超过硬预算且未获批准。

### 3.2 提交前预修复

高风险任务先执行最小化：

1. 删除不承担剧情信息的背景动作。
2. 减少同时运动主体。
3. 把小物体精细操作改成清楚的大动作或插入镜头。
4. 缩短动作链。
5. 固定机位。
6. 把多人对白改为单人镜头加反应镜头。
7. 把声音改为后期制作。
8. 拆成多个原子 Task。
9. 如果仍高风险，评估真人或混合制作。

不要删除关键证据、人物行动结果或用户锁定钩子。

## 4. Attempt 协议

### 4.1 Attempt 记录

每次请求保存：

```yaml
generation_attempt_id:
generation_task_id:
attempt_index:
submitted_at:
provider_entry:
region:
account_capabilities_snapshot:
model_id:
model_build_or_revision:
model_profile_hash:
request_parameters:
prompt_hash:
reference_asset_ids: []
reference_asset_hashes: []
seed_if_available:
actual_cost:
currency:
provider_status:
provider_failure_code:
provider_failure_message:
returned_asset_ids: []
runtime_seconds:
operator_or_agent:
```

不要自动重试失败请求。先分类失败，确认费用、幂等性和输入是否需要变化，再创建新的 Attempt。

### 4.2 Attempt 数量

初始建议：

- 低风险：计划 2–3 次，满足验收即提前停止。
- 中风险：计划 3–5 次；第二次仍同类失败时先修改 Task。
- 高风险：不要直接靠堆 Attempt；先拆镜或改制作方式。
- 阻断：不得提交。

这不是官方成功率保证。项目预算、供应商限额和真实数据优先。

### 4.3 可比较性

比较候选时区分：

- 参数不变的统计重复。
- 只改变随机种子的重复。
- 修改提示词后的新任务版本。
- 更换参考资产后的新任务版本。
- 更换模型或制作方式。

修改 Shot 意图、动作结果或制作方式时，创建 Task 新版本，不要假装是相同条件下的 Attempt。

### 4.4 Attempt 验收维度

每次分别评分：

```yaml
identity_fidelity:
wardrobe_prop_continuity:
action_completion:
action_order:
spatial_fidelity:
framing_and_camera:
physical_plausibility:
dialogue_lipsync:
audio_quality:
prompt_alignment:
first_frame_match:
last_frame_match:
usable_duration:
repairability_in_post:
```

每项必须附证据时间码。总分不能掩盖阻断错误。

## 5. 失败分类

### 5.1 请求与能力失败

- `CAPABILITY_MISMATCH`：请求了未支持或未知能力。
- `REGION_ACCOUNT_MISMATCH`：账号、地区或入口能力不同。
- `REFERENCE_LIMIT_EXCEEDED`：输入数量或时长超限。
- `PROVIDER_REJECTED`：供应商拒绝请求。
- `PROVIDER_TIMEOUT`：超时或服务失败。

### 5.2 主体与连续性失败

- `IDENTITY_DRIFT`：脸、年龄、发型或人物身份漂移。
- `SUBJECT_COUNT_ERROR`：新增、删除或复制人物。
- `WARDROBE_DRIFT`：服装或妆造改变。
- `PROP_DRIFT`：道具外观、数量、位置或所在手错误。
- `STATE_CONTINUITY_ERROR`：伤势、污渍、姿势、门窗等状态不连续。

### 5.3 动作与空间失败

- `ACTION_INCOMPLETE`：主要动作没有完成。
- `ACTION_ORDER_ERROR`：动作顺序错误。
- `HAND_PROP_FAILURE`：手部、小物体或接触关系异常。
- `SPATIAL_RELATION_ERROR`：左右、前后、距离、视线或轴线错误。
- `OCCLUSION_RECOVERY_ERROR`：遮挡后主体身份或位置改变。
- `PHYSICS_ERROR`：穿模、漂浮、无因果变形或错误碰撞。

### 5.4 摄影与剪辑失败

- `FRAMING_DRIFT`：主导景别或主体构图漂移。
- `CAMERA_PATH_ERROR`：运镜路径、速度或方向错误。
- `UNPLANNED_CUT`：产生额外切镜。
- `SHOT_BOUNDARY_ERROR`：多镜头边界不符合时间线计划。
- `FIRST_FRAME_MISMATCH`：起始状态不匹配。
- `LAST_FRAME_MISMATCH`：结束状态不可承接。

### 5.5 声音失败

- `SPEAKER_ATTRIBUTION_ERROR`：对白归属错误。
- `LIPSYNC_ERROR`：口型与对白不同步。
- `DIALOGUE_CONTENT_ERROR`：台词内容变化或新增。
- `AUDIO_ARTIFACT`：声音破裂、跳变或不可用。
- `AV_SYNC_ERROR`：动作、对白和音效错位。

### 5.6 内容与生产失败

- `UNAUTHORIZED_CONTENT`：生成未授权事实、人物、品牌或敏感内容。
- `RIGHTS_OR_PRIVACY_BLOCK`：资产权利或隐私条件不满足。
- `SAFETY_BLOCK`：危险内容没有可接受方案。
- `COST_OVERRUN`：重试或后期成本超过阈值。
- `NO_USABLE_RANGE`：存在画面但没有足够连续可剪区间。

## 6. 分支修复矩阵

不要对所有失败应用同一线性降级列表。

| 失败 | 首选修复 | 第二选择 | 最终出口 |
|---|---|---|---|
| 身份漂移 | 使用更清楚的角色主参考，减少同屏人物 | 拆为单人镜头和反应镜头 | 真人、换模或合成换脸仅在权利允许时 |
| 人物数量错误 | 删除背景人物，固定主体数量和位置 | 用建立镜头与单人镜头分开完成 | 真人或静态插入 |
| 服装/道具漂移 | 当前场景参考置顶，明确状态 | 单独生成道具插入镜头 | 真人补拍或合成 |
| 手部失败 | 放大动作、减少手指精度 | 拆“拿起”与“结果”为两个镜头 | 真人手部特写 |
| 动作未完成 | 缩短动作链，延长可用时间 | 拆成动作镜头与结果镜头 | 真人表演 |
| 空间错误 | 强化首帧、平面位置和方向 | 固定机位，减少移动主体 | 真人走戏或二维合成 |
| 遮挡后漂移 | 删除遮挡或缩短遮挡时间 | 在遮挡点切镜并分别生成 | 合成两个片段 |
| 物理异常 | 简化交互，避免复杂材质 | 拆原因与结果 | 实拍、VFX 或静态图形 |
| 构图漂移 | 固定机位和主导景别，强化首帧 | 降低主体移动 | 后期裁切或真人 |
| 运镜失败 | 固定机位 | 把运镜拆成后期数字推拉 | 真人轨道/稳定器拍摄 |
| 非计划切镜 | 强制单原子 Shot | 缩短时长和事件数 | 时间线自行组装 |
| 首尾帧不匹配 | 强化对应参考和状态 | 在动作完成点选择可用区间 | 遮挡转场、补反应镜头 |
| 唇形失败 | 缩短为单人短句 | 静音生成后 ADR | 真人同期声 |
| 说话人错误 | 一镜只保留一个说话者 | 画外对白加反应镜头 | ADR 或真人 |
| 声画不同步 | 分离声音生产 | 后期拟音和配音 | 真人同期声 |
| 未授权内容 | 删除错误资产并重新审核 | 收紧事实白名单 | 阻断并人工处理 |
| 无可用区间 | 修改 Task 后重新生成 | 改模型或拆镜 | 真人/混合/删除非必要动作 |

修复必须保留：

- 原始 Task 和 Attempt。
- 失败类别及时间码。
- 修改前后差异。
- 事实不变量检查。
- 修复策略版本。

## 7. Media Asset 验收

### 7.1 建立资产

对每个返回文件创建：

```yaml
asset_id:
origin_type: generation_attempt
origin_id:
file_hash:
container:
codec:
duration_seconds:
frame_rate:
resolution:
color_space:
audio_format:
internal_shot_boundaries: []
quality_scores:
blocking_defects: []
post_repairable_defects: []
usable_ranges: []
rights_status:
field_provenance:
```

不要因为 Attempt 状态为成功就把 Asset 标为可用。

### 7.2 可用区间

每段可用区间记录：

```yaml
range_id:
source_in:
source_out:
matched_shot_refs: []
head_handle_available:
tail_handle_available:
accepted_criteria: []
known_defects: []
audio_usable:
```

一个 Asset 内部意外生成多个镜头时，填写 `internal_shot_boundaries`。只使用与 Shot List 相符的区间。

### 7.3 阻断缺陷

以下通常阻断该区间进入剪辑：

- 核心人物身份错误。
- 关键动作结果错误。
- 道具或证据改变。
- 未授权新增内容。
- 时空或镜头边界错误。
- 无法通过裁剪保留的严重物理异常。
- 尾帧无法承接且没有合法转场方案。

轻微背景瑕疵只有在不破坏剧情、连续性和平台质量时才允许后期修复。

## 8. Timeline Clip 装配

选中 Asset 后创建：

```yaml
timeline_clip_id:
asset_id:
shot_ids: []
source_in:
source_out:
timeline_in:
timeline_out:
head_handle:
tail_handle:
speed: 1.0
audio_links: []
transition_in:
transition_out:
selection_reason:
remaining_defects: []
```

检查：

- `source_out - source_in` 与目标剪辑时长一致。
- 速度变化不会破坏动作、口型或物理。
- 前后 Handles 足够。
- Clip 首尾状态与相邻 Clip 可衔接。
- 声音链接指向正确音频 Asset。
- 每个 must-have Coverage 已经由合格 Clip 覆盖，而不只是“计划中有 Shot”。

禁止使用“整段生成结果”作为默认源区间。

## 9. 真人、AI 与混合制作切换

### 9.1 逐镜选择

使用以下条件：

| 条件 | AI 优先 | 真人优先 | 混合优先 |
|---|---|---|---|
| 人物精确表演 | 低要求或无可辨识真人 | 长对白、复杂细微表演 | 真人表演加环境/VFX |
| 手部小道具 | 简单大动作 | 关键证据操作、交换、装配 | 真人手部插入生成环境 |
| 危险场景 | 可安全虚构且无需真实主体 | 可控、安全、许可齐全 | 真人近景加生成危险远景 |
| 不可能环境 | AI | 搭景成本可接受 | 真人前景加生成背景 |
| 多人唇形 | 非核心或后期配音 | 多人长对白 | 真人对白加生成扩景 |
| 严格品牌/产品 | 仅有合法高质量参考且通过测试 | 产品外观必须完全准确 | 真人产品插入加生成氛围 |
| 连续长镜头 | 简单运动 | 复杂表演和空间调度 | 多段生成/实拍通过遮挡合成 |

### 9.2 切换阈值

触发制作方式复核：

- 两次 Attempt 出现相同阻断失败且改写提示词没有改善。
- 达到 Task 最大 Attempt 数。
- 预计重试成本超过真人或混合方案。
- 关键动作、身份或连续性无法在可用区间同时成立。
- 任务依赖未知或账号不可用能力。
- 后期修复会改变人物身份、剧情事实或关键证据。

最终切换不得自动执行。输出比较报告，由项目负责人批准。

### 9.3 混合制作交接

混合方案至少记录：

- 实拍底板或生成底板。
- 前景、背景、人物和道具分层。
- 跟踪点和摄影机数据。
- 遮罩、深度、透明通道需求。
- 帧率、分辨率、快门、色彩空间和镜头畸变。
- 光线方向和阴影。
- 声音制作方式。
- Composite Recipe 和输入资产 ID。

无法提供这些交接条件时，不要把“后期合成”当作万能修复。

## 10. 停止、升级与回滚

### 10.1 停止条件

满足任一条件即停止重试：

- 已有 Asset 满足全部阻断验收条件和最低质量阈值。
- 达到最大 Attempt 数或预算。
- 连续两次出现相同阻断失败且没有新的修复变量。
- 新 Attempt 比当前最佳候选引入更多严重错误。
- 权利、安全、隐私或合规状态变为阻断。
- 供应商能力与项目需求不匹配。

### 10.2 升级人工处理

以下必须人工决定：

- 修改剧情事实。
- 更换人物身份、声音或参考主体。
- 从 AI 切换到真人或混合制作。
- 接受包含已知缺陷的素材。
- 超预算继续尝试。
- 使用可能受限的肖像、声音、品牌或素材。

### 10.3 回滚

保留：

- 当前最佳 Task 版本。
- 当前最佳 Asset。
- 失败 Attempt。
- 所有差异和评分。

新修复方案失败时，回滚到最近一个通过事实不变量和权利检查的 Task 版本，而不是覆盖历史。

## 11. 实测回写

### 11.1 回写目的

真实 Attempt 数据用于校准内部策略，不用于修改官方能力声明。

记录：

```yaml
observation_id:
model_id:
model_build_or_revision:
provider_entry:
region:
account_tier:
date_range:
task_cohort:
sample_size:
attempt_count:
first_pass_acceptance_rate:
usable_asset_rate:
median_attempts_to_accept:
failure_distribution:
cost_distribution:
confidence_interval:
review_protocol:
```

样本不足时标记 `insufficient_sample`，不要给出普遍性结论。

### 11.2 版本隔离

- 模型构建、产品入口或请求参数变化后，新建观察批次。
- 不合并不同地区、账号等级或分辨率的数据。
- 内部建议必须引用对应观察批次。
- 超过项目设定期限的观察标记 `stale`。

### 11.3 更新注册表

只把以下信息写入 `empirical_observations`：

- 已执行的任务类型。
- 样本量。
- 通过率及置信区间。
- 主要失败分布。
- 适用条件和日期。

不要把单个成功案例写成“模型擅长”，也不要把单次失败写成“不支持”。

## 12. 示例

### 12.1 初始风险

```yaml
risk_assessment_id: RISK-GT-024-A
generation_task_id: GT-024-A
model_id: bytedance-seedance-2.0
scoring_policy_version: 1.0.0
dimension_scores:
  identity_count: 2
  simultaneous_motion: 1
  action_chain: 1
  hand_prop_precision: 2
  spatial_constraint: 2
  continuity_constraint: 2
  dialogue_lipsync: 0
  camera_motion: 0
  framing_lock: 1
  occlusion_reflection: 0
  physics: 1
  environment_complexity: 0
  audio_complexity: 1
  multi_shot_complexity: 0
risk_band: medium
dominant_risk_factors:
  - 两名人物身份和视线必须同时正确
  - 小道具从右手移动到桌面中央
recommended_attempts: 3
production_switch_review_required: false
```

### 12.2 Attempt 失败与修复

```yaml
generation_attempt_id: GA-024-A-01
generation_task_id: GT-024-A
provider_status: completed
returned_asset_ids: [MA-024-A-01]
blocking_defects:
  - failure_type: PROP_DRIFT
    evidence: 2.7秒后录音笔从右手消失，3.1秒在左手重新出现
  - failure_type: LAST_FRAME_MISMATCH
    evidence: 尾帧录音笔仍在人物手中
decision: reject
repair_branch:
  - 增加录音笔道具参考
  - 把“沿桌面推行”改为更大的直线动作
  - 保持固定机位
```

第二次仍发生手部失败时，不继续堆叠文字：

```text
拆为：
GT-024-B1：林夏右手把录音笔放到桌面中央。
GT-024-B2：经理看向桌面中央的录音笔。

如果 B1 两次仍失败：
→ 真人拍摄手部插入镜头
→ 或使用静态道具特写加明确音效
```

只有合格 Asset 的可用区间才能建立 Timeline Clip，并记录入点、出点、Handles 和选片理由。

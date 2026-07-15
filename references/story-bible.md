# Story Bible 建立与维护手册

## 目录

- [1. 目的与边界](#1-目的与边界)
- [2. 建立顺序](#2-建立顺序)
- [3. 通用字段与来源要求](#3-通用字段与来源要求)
- [4. 人物档案](#4-人物档案)
- [5. 关系与知情范围](#5-关系与知情范围)
- [6. 地点与空间档案](#6-地点与空间档案)
- [7. 道具档案](#7-道具档案)
- [8. 时间线与世界规则](#8-时间线与世界规则)
- [9. 视觉与声音锚点](#9-视觉与声音锚点)
- [10. 固定事实与可变状态](#10-固定事实与可变状态)
- [11. 场景状态快照](#11-场景状态快照)
- [12. 更新、冲突与版本管理](#12-更新冲突与版本管理)
- [13. 支持真人、Seedance 与混合制作](#13-支持真人seedance-与混合制作)
- [14. 正反例](#14-正反例)
- [15. 错误路由](#15-错误路由)
- [16. 完成门禁](#16-完成门禁)

## 1. 目的与边界

使用 Story Bible 维护跨 Scene、Shot、Task、Attempt 和 Clip 需要一致的叙事与视听事实。

Story Bible 回答：

- 这个人是谁。
- 他与谁是什么关系。
- 他知道什么、不知道什么。
- 他在每个场景穿什么、处于什么状态。
- 地点有哪些固定结构和出入口。
- 道具属于谁、在哪里、如何变化。
- 世界遵守哪些规则。
- 哪些信息绝对不能被下游修改。

Story Bible 不负责：

- 决定景别和运镜。
- 代替 Blocking Plan。
- 代替 Continuity Ledger 的逐镜状态。
- 代替 Fact Ledger 的来源证明。
- 代替 Rights Manifest 的授权结论。

保持以下边界：

```text
Fact Ledger：证明剧情事实是什么、来自哪里
Story Bible：组织跨场景持续有效的创作事实
Continuity Ledger：记录逐镜开始与结束状态
Blocking Plan：记录人物和摄影机前的空间执行方案
```

## 2. 建立顺序

按以下顺序建立：

1. 读取 Source Manifest 和 Fact Ledger。
2. 创建人物、地点和道具稳定 ID。
3. 区分固定属性与可变状态。
4. 建立人物关系和知情范围。
5. 建立地点结构和空间约束。
6. 建立道具归属和状态变化。
7. 建立剧情时间线和世界规则。
8. 提取视觉、声音和表演锚点。
9. 为每个 Scene 创建入场和离场状态快照。
10. 验证所有字段的来源或推断标记。

不要先写丰富人物小传再找原文依据。

## 3. 通用字段与来源要求

为每类条目使用：

```yaml
entry_id:
entry_type:
canonical_name:
aliases:
status:
source_refs:
fact_ids:
field_provenance:
first_valid_scene:
last_valid_scene:
notes:
```

### 3.1 字段级来源

为每个叙事或视觉字段标记：

```yaml
value:
source_refs:
fact_ids:
transformation_type: verbatim | visualized | inferred | authorized_addition
authorization_id:
confidence:
locked:
```

不得只给整个人物档案挂一个总来源。

### 3.2 未知值

使用：

```yaml
value: unknown
confidence: 0
```

不要用“默认年轻漂亮”“典型办公室”“普通西装”等陈词替代未知值。

### 3.3 推断值

只在制作必须且不会改变剧情时建立推断值。记录：

- 推断依据。
- 受影响 Scene。
- 可替换方案。
- 是否需要用户确认。

推断值不得设置 `locked: true`。

## 4. 人物档案

### 4.1 核心身份

记录：

```yaml
character_id:
name:
aliases:
role_in_story:
age_range:
gender_if_explicit:
occupation:
social_identity:
relationship_ids:
first_appearance_scene:
last_appearance_scene:
```

只记录原文明确或用户授权的信息。不要根据职业、姓名或外貌推断年龄、性别、族群或阶层。

### 4.2 外观锚点

记录能够维持跨镜一致性的特征：

```yaml
appearance_anchor:
  face:
  hair:
  body_build:
  distinguishing_features:
  accessories:
  prohibited_changes:
```

优先记录具体可见特征，不写“高级感”“有故事的脸”。

可执行：

```text
左眉尾有一条短疤；黑色齐肩直发；银色细框眼镜。
```

不可执行：

```text
长得很有宿命感。
```

### 4.3 服装

按 Scene 或连续剧情段记录：

```yaml
wardrobe_state_id:
character_id:
scene_ids:
base_garments:
colors:
materials:
footwear:
accessories:
damage_or_dirt:
change_trigger_beat:
reference_asset_ids:
```

不要只写“商务装”。写明可识别服装组合和变化节点。

### 4.4 说话方式

记录：

```yaml
speech_style:
  vocabulary_level:
  sentence_length:
  rhythm:
  politeness:
  recurring_phrases:
  dialect_or_accent:
  prohibited_patterns:
```

只把原文稳定表现出的特点写为固定风格。单句激动对白不等于人物长期说话习惯。

### 4.5 行为与表演

区分：

```yaml
fixed_behavioral_traits:
scene_specific_performance_state:
```

把“习惯先整理袖口再发言”记录为固定行为锚点，前提是原文反复支持。

把“此刻呼吸急促”记录为场景状态，不要升级为固定性格。

### 4.6 人物目标

按剧情区段记录：

```yaml
goal_state_id:
character_id:
valid_from_beat:
valid_until_beat:
goal:
obstacle:
known_plan:
hidden_plan:
result:
```

人物目标会变化，不要把全剧目标写成永远有效。

## 5. 关系与知情范围

### 5.1 关系档案

为每对关键人物记录：

```yaml
relationship_id:
character_a:
character_b:
relationship_type:
public_status:
private_status:
power_balance:
valid_from_beat:
valid_until_beat:
change_beat_ids:
source_refs:
```

关系必须有方向时，分别记录双方认知。例如一方认为是盟友，另一方实际在利用他。

### 5.2 知情范围

为关键秘密建立：

```yaml
knowledge_item_id:
fact_id:
known_by:
unknown_to:
suspected_by:
learned_at_beat:
revealed_by:
public_from_beat:
```

在写 Beat 和 Shot 时检查人物是否提前使用尚未知的信息。

### 5.3 秘密与谎言

区分：

- 客观事实。
- 人物知道的事实。
- 人物相信但错误的内容。
- 人物说出的谎言。
- 观众知道但人物不知道的信息。

不要把谎言覆盖为 Story Bible 的客观事实。

### 5.4 权力关系

记录可改变场面调度和反应的权力状态：

```yaml
power_state_id:
scene_id:
dominant_character_id:
subordinate_character_ids:
evidence:
change_beat_id:
```

只记录剧情支持的状态，不用“气场更强”替代证据。

## 6. 地点与空间档案

### 6.1 地点身份

记录：

```yaml
location_id:
canonical_name:
aliases:
interior_exterior:
parent_location_id:
story_function:
scene_ids:
```

同一办公室在不同 Scene 复用同一 `location_id`，但创建不同场景状态。

### 6.2 固定结构

记录：

```yaml
layout:
  coordinate_system:
  dimensions_if_known:
  entrances_and_exits:
  windows:
  fixed_furniture:
  fixed_objects:
  level_changes:
  reflective_surfaces:
  practical_lights:
```

只有来源或已批准设计支持时才填写具体尺寸和位置。

### 6.3 方向和轴线基础

记录空间中的稳定参照：

```yaml
screen_direction_defaults:
primary_action_axis:
alternative_axis:
eyeline_landmarks:
```

不要在 Story Bible 冻结每个 Shot 的轴线侧；把逐场执行交给 Blocking Plan。

### 6.4 光线与时间

记录：

```yaml
lighting_baseline:
  time_of_day:
  source_direction:
  color_character:
  practical_sources:
  weather_effect:
```

区分“地点常态”和“本 Scene 临时状态”。停电应记录为 Scene 状态，不要覆盖地点常态。

### 6.5 环境声音

记录：

```yaml
ambient_sound_baseline:
  room_tone:
  exterior_sources:
  repeating_events:
  prohibited_sounds:
```

例如会议室持续听见中央空调低频声；不要只写“压迫的环境音”。

### 6.6 竖屏与安全区需求

记录地点在竖屏构图中的风险：

- 多人横向排布是否过宽。
- 关键门口是否位于 UI 遮挡侧。
- 重要道具是否容易落入字幕区。
- 前中后景是否可形成纵深。

不要把平台安全区数值写死在地点档案中；引用 Platform Profile。

## 7. 道具档案

### 7.1 基础字段

记录：

```yaml
prop_id:
canonical_name:
aliases:
appearance:
owner_id:
custodian_id:
first_appearance_scene:
story_function:
reference_asset_ids:
```

### 7.2 状态变化

记录：

```yaml
prop_state_id:
prop_id:
valid_from_beat:
valid_until_beat:
location_id:
holder_character_id:
handedness:
orientation:
open_closed_state:
contents:
damage:
visibility:
change_trigger_beat:
```

为杯中液体、门、手机屏幕、文件封条、武器保险等易跳变状态建立明确字段。

### 7.3 信息道具

对合同、录音笔、手机、照片、印章等记录：

```yaml
information_payload:
who_can_read_or_hear:
first_revealed_beat:
verification_status:
```

不要根据道具类型编造其中内容。

### 7.4 手部连续性

记录道具进入和离开人物手中的 Beat。逐镜持有手由 Continuity Ledger 维护，但 Story Bible 应保存关键归属和交接节点。

## 8. 时间线与世界规则

### 8.1 剧情时间线

记录：

```yaml
timeline_event_id:
story_time:
scene_ids:
beat_ids:
event:
causal_predecessors:
duration_if_known:
certainty:
```

区分成片呈现顺序和故事真实顺序。

### 8.2 回忆、梦境与想象

记录：

```yaml
reality_layer_id:
type: present | flashback | dream | imagination | screen_content | surveillance
entry_beat:
exit_beat:
visual_rules:
audio_rules:
```

不要把回忆内容当作当前时间状态。

### 8.3 世界规则

奇幻、科幻、古装或特殊现实题材记录：

```yaml
world_rule_id:
rule:
scope:
exceptions:
first_demonstrated_beat:
violation_consequence:
locked:
```

只记录剧情需要且有依据的规则。不要为了补设定制造无关百科。

### 8.4 规则一致性

检查：

- 能力是否在首次建立前被使用。
- 规则是否为某个角色突然失效。
- 代价是否被后续忽略。
- 时间旅行、预知或身份变换是否有状态记录。

发现冲突时不要自行创造新规则解释。

## 9. 视觉与声音锚点

### 9.1 角色参考

为 Seedance 或混合制作记录：

```yaml
reference_asset_ids:
reference_purpose:
approved_traits:
traits_to_ignore:
rights_status:
```

不要把未经确认的参考图细节写入剧情事实。

### 9.2 场景参考

区分：

- 空间布局参考。
- 材质和色彩参考。
- 灯光参考。
- 构图参考。
- 不应继承的内容。

### 9.3 道具参考

记录尺寸、颜色、标记、开合方式和使用方向。关键证据道具优先使用稳定参考。

### 9.4 声音锚点

记录：

- 人物音色参考。
- 语言和口音。
- 地点底噪。
- 重复声音线索。
- 不能改变的声音身份。

不得把未经授权的真实人物声音作为默认参考。

## 10. 固定事实与可变状态

### 10.1 固定事实

通常包括：

- 人物身份。
- 核心关系。
- 已确认外貌锚点。
- 地点固定结构。
- 道具基本身份。
- 世界规则。
- 关键历史事件。

只有 Fact Ledger 支持时才锁定。

### 10.2 可变状态

通常包括：

- 服装。
- 伤势和污渍。
- 情绪和表演强度。
- 人物位置。
- 道具持有人和位置。
- 门窗、灯光和屏幕状态。
- 知情范围。
- 权力关系。

为可变状态记录有效区间和变化 Beat。

### 10.3 状态转换

每次转换记录：

```yaml
state_transition_id:
entity_id:
field:
from_value:
to_value:
trigger_beat_id:
effective_scene_id:
source_refs:
```

没有触发 Beat 的状态变化必须标记为连续性风险。

## 11. 场景状态快照

为每个 Scene 建立：

```yaml
scene_state_id:
scene_id:
entry:
  character_states:
  wardrobe_states:
  prop_states:
  location_state:
  knowledge_states:
  world_rule_states:
exit:
  character_states:
  wardrobe_states:
  prop_states:
  location_state:
  knowledge_states:
  world_rule_states:
```

验证：

- Scene 入口能承接上一个相关 Scene 的出口。
- 时间跳跃有明确说明。
- 服装和伤势变化有发生空间。
- 道具没有瞬移。
- 人物没有提前知道信息。

Story Bible 维护 Scene 级快照；逐 Shot 状态由 Continuity Ledger 细化。

## 12. 更新、冲突与版本管理

### 12.1 更新触发

在以下情况更新 Story Bible：

- 用户批准剧本修订。
- Fact Ledger 新增或废弃事实。
- Scene 或 Beat 边界改变。
- 关键视觉设计获批准。
- 参考素材发生替换。
- 实拍或生成结果暴露新的连续性约束。

### 12.2 更新流程

1. 保存旧版本。
2. 更新来源和事实引用。
3. 生成字段级差异。
4. 标记受影响的 Scene、Beat、Shot、Task、Asset 和 Clip。
5. 重新运行相关校验。
6. 不自动覆盖已锁定事实。

### 12.3 冲突优先级

按以下顺序处理：

```text
用户锁定事实
→ 已批准剧本修订
→ 原稿明确事实
→ Story Bible 已批准设计
→ 制作推断
→ 模型输出
```

模型输出永远不能反向覆盖剧本事实。

### 12.4 视觉参考冲突

当参考图与原文冲突时：

- 保留原文事实。
- 标记参考图不合格或限制继承字段。
- 不因模型更容易生成而改变人物身份或关键道具。

### 12.5 并行场景合并

并行处理多个 Scene 后：

1. 按稳定 ID 合并。
2. 检查同名人物是否误建多个 ID。
3. 检查同一地点是否误拆。
4. 检查服装、道具和知情范围状态。
5. 检查世界规则是否冲突。
6. 由统一事实台账裁决，不使用后写覆盖前写。

## 13. 支持真人、Seedance 与混合制作

### 13.1 真人制作

补充：

- 选角限制。
- 服装可执行性。
- 化妆和伤势连续性。
- 道具备份。
- 场地固定结构。
- 表演和口音要求。

不要在 Story Bible 记录具体 Take 结果；把它放入 Take 和 Continuity 记录。

### 13.2 Seedance

补充：

- 人物参考素材 ID。
- 不可变化的外观锚点。
- 场景参考 ID。
- 道具参考 ID。
- 容易漂移的特征。
- 多人物身份区分。
- 首帧和尾帧需保持的状态。

只记录跨任务稳定信息，不把每个 Task 的提示词复制到 Story Bible。

### 13.3 混合制作

补充：

- 真人与生成角色的比例和尺度。
- 光向和色温。
- 镜头视场和景深基准。
- 服装边缘和头发遮罩风险。
- Clean Plate 和跟踪参考。
- 真实声音与生成声音的身份一致性。

## 14. 正反例

### 14.1 人物锚点

正确：

```text
CHAR-01：黑色齐肩直发，左眉尾短疤，银色细框眼镜；SCN-01至SCN-04穿深灰西装。
```

错误：

```text
CHAR-01：冷艳、强势、很有高级感。
```

后者不能维持视觉一致性。

### 14.2 固定与可变状态

正确：

```text
固定：右手无名指戴银色戒指。
可变：BEAT-18后摘下戒指并放入口袋。
```

错误：

```text
有时戴戒指，有时不戴，看画面需要。
```

### 14.3 声明与事实

原文中反派说女主偷了文件。

正确：

- Story Bible 记录“反派作出指控”。
- 文件真实去向保持未知或引用客观事实。

错误：

- 直接把“女主是小偷”写入人物身份。

### 14.4 地点

正确：

```text
会议室固定结构：长桌一张；主门位于长桌短边；落地窗在主门对面。
```

前提是来源或批准设计明确。

错误：

```text
会议室充满资本压迫感。
```

### 14.5 道具

正确：

```text
录音笔首次由女主右手拿出；BEAT-06后位于桌面中央；经理未触碰。
```

错误：

```text
录音笔象征女主终于夺回命运。
```

象征解释不能代替状态记录。

### 14.6 模型输出反写

Seedance 生成结果让人物外套变成红色。

正确：

- 将 Asset 标记为服装漂移。
- 保留 Story Bible 中深灰外套。

错误：

- 为适配生成结果把后续所有镜头改成红色外套。

## 15. 错误路由

| 错误 | 严重级别 | 返回阶段 | 处理 |
|---|---|---|---|
| Story Bible 字段无来源 | error | Fact/来源 | 补来源、改为推断或删除 |
| 推断字段被锁定 | blocker | Story Bible | 取消锁定并标记推断 |
| 人物身份冲突 | blocker | Fact Ledger | 裁决主事实，废弃下游冲突 |
| 别名误合并人物 | error | 实体解析 | 拆分人物并重连引用 |
| 人物提前知道秘密 | blocker | 知情范围 | 修复 learned_at Beat 或下游剧情 |
| 服装无触发变化 | error | 状态转换 | 补合法变化节点或恢复原状态 |
| 道具瞬移 | blocker | 道具状态 | 补交接 Beat 或修复连续性 |
| 地点结构自相矛盾 | error | 地点设计 | 统一布局并重做 Blocking |
| 世界规则被无解释破坏 | blocker | 事实/剧情 | 恢复规则或取得剧情修改授权 |
| 模型输出覆盖原稿 | blocker | 资产审核 | 淘汰或修复 Asset |
| 参考素材权利未知 | blocker | Rights Manifest | 禁止绑定正式 Task |
| Story Bible 与 Continuity 不一致 | blocker | 状态同步 | 根据有效上游事实重建下游状态 |
| 场景状态缺失 | error | Scene 快照 | 补 entry/exit 或标记未知 |
| 使用抽象词代替锚点 | warning | 视觉档案 | 改成可见、可听和可识别特征 |

## 16. 完成门禁

只有满足以下条件才允许冻结 Story Bible：

- 每个主要人物有稳定 ID、别名和来源。
- 人物身份、关系和知情范围已分开。
- 固定外观锚点可被画面识别。
- 服装按 Scene 或剧情区段记录。
- 每个主要地点有稳定 ID 和必要空间结构。
- 每个关键道具有归属、位置和状态变化。
- 剧情时间线与呈现顺序已区分。
- 世界规则有适用范围和例外。
- 固定事实与可变状态已分开。
- 每个关键状态变化有触发 Beat。
- 每个 Scene 有入口和出口状态快照。
- 所有推断、未知和授权新增已明确标记。
- 参考素材不会反向覆盖原稿事实。
- Story Bible 与 Fact Ledger 不冲突。
- 下游能够用稳定 ID 引用人物、地点、道具和状态。

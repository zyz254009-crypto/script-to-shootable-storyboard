# Seedance Generation Task 编译器

本文件规定如何把已经通过剧情保真、原子镜头、调度、连续性和时长审核的 `Shot` 编译为可提交、可复现、可降级的 `Generation Task`。不要在本阶段修剧情、补动机或偷偷增强钩子。

## 目录

1. [编译边界](#1-编译边界)
2. [输入前置条件](#2-输入前置条件)
3. [Generation Task 最小契约](#3-generation-task-最小契约)
4. [编译流程](#4-编译流程)
5. [参考素材与主体锁定](#5-参考素材与主体锁定)
6. [时间轴提示词语法](#6-时间轴提示词语法)
7. [首帧与尾帧](#7-首帧与尾帧)
8. [摄影机、动作与声音](#8-摄影机动作与声音)
9. [负面约束](#9-负面约束)
10. [多镜头与拆分例外](#10-多镜头与拆分例外)
11. [编译后校验](#11-编译后校验)
12. [完整示例](#12-完整示例)

## 1. 编译边界

严格区分下列对象：

```text
Shot
  = 成片中两个剪辑点之间的叙事与摄影设计

Generation Task
  = 一次稳定的模型请求意图，可对应一个或多个 Shot

Generation Attempt
  = 使用确定模型、参数和输入资产实际提交的一次请求

Media Asset
  = Attempt 返回并落盘的原始媒体结果

Timeline Clip
  = 时间线上对 Media Asset 某个可用区间的一次使用
```

默认映射为：

```text
1 Atomic Shot → 1 Generation Task → 1..N Attempts
```

不要把整个生成结果直接当成最终镜头。先创建 `Media Asset`，检查可用区间，再创建 `Timeline Clip`。

编译器只允许：

- 把已有 Shot 信息改写成模型可理解的明确指令。
- 选择、排序和裁剪已授权参考素材。
- 把复杂 Shot 拆成多个 Task。
- 为模型稳定性删除不承担剧情信息的装饰性动作。
- 把声音从联合生成切换到后期声音流程。

编译器不得：

- 新增原稿中不存在且未获授权的事实。
- 改变人物身份、关系、行动结果或关键证据。
- 使用“电影感”“压迫感”“宿命感”等词替代具体画面。
- 把 Shot 的导演解释栏原样复制成提示词。
- 用模型未知能力填补缺失生产信息。

## 2. 输入前置条件

只有同时满足以下条件才开始编译：

- `shot_id`、`beat_refs`、`source_refs` 可解析。
- `start_state` 与 `end_state` 明确。
- 主导景别、构图、主体、空间和主要动作明确。
- 动作、对白、反应和摄影运动具有可执行时间轴。
- `continuity_in` 与上一镜输出状态不冲突。
- 目标平台、画幅、目标时长和制作方式已经指定。
- 所有参考资产都具有稳定 `asset_id` 和权利状态。
- 模型注册表中存在目标模型档案，且档案未超过项目允许的陈旧期限。

遇到缺失状态时，返回责任阶段并标记 `unknown`。不要猜测人物站位、左右手、服装、伤势或道具状态。

## 3. Generation Task 最小契约

按共享 Schema 的最终字段名输出；在 Schema 尚未加载时，至少生成以下语义：

```yaml
generation_task_id:
schema_version:
shot_refs: []
source_refs: []
field_provenance: []

model_id:
model_profile_version:
model_profile_hash:
production_method: ai | hybrid
target_platform:
aspect_ratio:
requested_duration_seconds:

prompt:
prompt_language:
prompt_sections:
  subject_lock:
  environment_lock:
  initial_frame:
  timeline_events: []
  camera:
  audio:
  final_frame:
  continuity:
  negative_constraints: []

reference_assets:
  - asset_id:
    reference_type: character | wardrobe | environment | prop | composition | motion | camera | audio | first_frame | last_frame
    applies_to:
    priority: required | preferred | optional
    temporal_range:
    rights_status:

first_frame_state:
last_frame_state:
acceptance_criteria: []
risk_assessment_id:
fallback_strategy_ids: []
attempt_policy:
  minimum_attempts:
  maximum_attempts:
  stop_conditions: []
```

始终保存结构化 `prompt_sections`。可以另外渲染便于人工复制的单字符串 `prompt`，但不要只保存字符串。

## 4. 编译流程

### 4.1 加载模型档案

从 `model-registry.yaml` 读取：

- 官方支持能力。
- 内部生产建议。
- 项目或工作区真实测试结果。
- `unknown` 字段。
- 地区、账号、产品入口和构建版本约束。
- 档案核验日期及陈旧状态。

能力冲突时按以下优先级处理：

```text
本次账号能力快照
> 对应产品入口的官方资料
> 官方技术报告
> 经过版本绑定的内部实测
> 内部建议
```

实测结果不能把官方未声明的能力改写为“官方支持”；官方声明也不能被解释为“稳定成功”。

### 4.2 建立 Shot 事实白名单

从 Shot、Story Bible、Continuity Ledger 和 Fact Ledger 提取：

- 固定人物身份和外观。
- 当前服装、伤势、污渍和手持物。
- 场景的时间、天气、光线和空间关系。
- 当前 Beat 必须发生的动作与结果。
- 允许出现的对白和声音。
- 前镜留下的状态。
- 下一镜必须接住的状态。

只允许这些事实进入正向提示词。将导演解释、心理分析和未授权推断排除。

### 4.3 计算模型请求边界

确定：

- 请求时长与最终剪辑目标时长。
- 头尾 Handles。
- 是否允许原生声音。
- 是否使用参考图、参考视频或参考音频。
- 是否需要首帧、尾帧或两者。
- 是否需要把 Shot 拆成多个 Task。
- 是否应改为真人或混合制作。

请求时长不等于时间线使用时长：

```text
requested_duration
≥ head_handle + intended_usable_duration + tail_handle
```

不要为了凑满模型时长添加无意义动作。

### 4.4 编译身份与环境锁

将可重复识别的视觉特征放在提示词前部：

```text
主体：林夏，28岁，齐肩黑发，右眉尾小痣，灰色西装，白衬衫，无首饰。
道具：黑色录音笔始终在她右手。
环境：夜间会议室，冷白顶灯，长桌纵向延伸，玻璃门位于画面左后方。
```

只保留区分主体所需的稳定特征。不要堆叠与镜头无关的身高、履历、性格和故事背景。

### 4.5 编译时间轴事件

把 Shot 的事件图转换为局部时间轴。对白、动作和运镜可以重叠，不要机械相加。

每个事件记录：

```yaml
event_id:
start_seconds:
end_seconds:
event_type: action | expression | camera | dialogue | sound | environment
subject_id:
instruction:
depends_on: []
must_complete: true
```

如果事件无法在请求时长内完成，先退回时长与动作阶段，不要用更模糊的文字掩盖超时。

### 4.6 编译首尾状态

将 `start_state` 和 `end_state` 改写为可观察状态；不要写情绪结论。

```text
错误：尾帧中她占据了主动。
正确：尾帧中录音笔停在桌面中央；经理的手悬在半空；林夏直视经理。
```

### 4.7 生成验收条件

验收条件必须可观察、可打分：

- 主体身份与参考图一致。
- 黑色录音笔全程只在右手，放下后停在桌面中央。
- 单一近景，不产生额外切镜。
- 主要动作完成且次序正确。
- 尾帧符合下一 Shot 的承接状态。
- 无未授权人物、文字、品牌或额外道具。

不要使用“有感染力”“高级”“很抓人”等不可判定条件。

## 5. 参考素材与主体锁定

### 5.1 素材使用原则

每个参考必须：

- 使用稳定 `asset_id`，禁止只写文件名。
- 标明角色：身份、服装、场景、道具、构图、动作、运镜、音频、首帧或尾帧。
- 标明适用主体或时间范围。
- 标明优先级。
- 通过权利和隐私检查。
- 记录内容哈希和版本。

不要用同一参考同时承担互相冲突的用途。

### 5.2 参考选择顺序

优先选择：

1. 当前项目已通过连续性审核的角色主参考。
2. 当前场景服装与妆造参考。
3. 当前场景或首帧参考。
4. 关键道具参考。
5. 必要的动作或运镜参考。
6. 必要的声音参考。

超过模型输入预算时，删除与当前 Shot 无关的参考，不要压缩成拼图后假定模型仍能准确识别每格。

### 5.3 主体锁定包

为每个核心人物维护：

```yaml
subject_id:
canonical_reference_asset_ids: []
identity_features: []
current_wardrobe:
current_hair_makeup:
current_injury_or_dirt:
current_props:
screen_position:
facing_direction:
forbidden_variations: []
```

`forbidden_variations` 只能约束剧情和连续性相关变化，例如：

- 不改变发型和服装颜色。
- 不增加眼镜、首饰或伤口。
- 不交换道具所在手。

不要把族裔、年龄或身体特征写成贬损性负面词。

### 5.4 首尾帧参考

首帧参考用于锁定：

- 主体数量和位置。
- 景别与构图。
- 服装、道具和场景状态。
- 摄影机所在轴线一侧。

尾帧参考用于锁定：

- 动作完成位置。
- 道具最终位置。
- 下一镜所需姿势、视线和构图。

如果模型入口不支持直接尾帧控制，把尾帧降级为文字验收目标，并在注册表中保持该能力为 `unknown` 或 `unsupported`，不要伪造参数。

## 6. 时间轴提示词语法

### 6.1 推荐顺序

使用以下稳定顺序：

```text
[任务边界]
[主体锁定]
[环境锁定]
[起始画面]
[时间轴动作]
[摄影机]
[声音]
[尾帧]
[连续性]
[负面约束]
```

### 6.2 时间轴写法

使用局部秒数和连续动作：

```text
0.0–1.0秒：林夏站在画面右侧，右手握录音笔，手停在桌沿上方。
1.0–2.8秒：她把录音笔沿桌面推到画面中央。
2.0–3.4秒：经理低头看向录音笔，右手从文件上抬起。
3.4–5.0秒：林夏松手，保持直视；录音笔停在桌面中央。
```

允许事件重叠，但明确谁在做什么。不要写：

```text
她先愤怒，再释然，整个会议室气氛反转，所有人震惊。
```

### 6.3 时间粒度

- 使用 0.1 秒仅在确实需要精密同步时。
- 普通动作使用 0.5 秒左右的粒度。
- 不要把自然表演切成大量微指令。
- 对话、手部动作和摄影运动竞争注意力时，减少同时发生的事件。

### 6.4 提示词语言

优先使用目标模型和产品入口实测效果更稳定的语言；若没有实测结论，保持用户语言并保存结构化段落。翻译提示词时：

- 不翻译角色和资产 ID。
- 不改变动作次序。
- 不增删剧情事实。
- 保留时间码。
- 对每个翻译版本分别保存哈希。

## 7. 首帧与尾帧

### 7.1 首帧必须回答

- 有几名主要人物。
- 每人位于画面何处。
- 主导景别是什么。
- 摄影机角度是什么。
- 关键道具在哪里。
- 主体正在开始哪个动作。
- 背景中哪些元素必须存在。

### 7.2 尾帧必须回答

- 主要动作是否完成。
- 人物姿势、视线和画面位置。
- 道具最终位置和状态。
- 是否为下一镜保留动作连续性。
- 是否需要可用尾部 Handle。

### 7.3 Handle 设计

为可剪性预留：

- 头部：动作开始前的稳定姿势或环境状态。
- 尾部：动作完成后的稳定结果或反应。

不要用冻结不动的“死帧”代替自然 Handle；允许呼吸、眨眼和轻微衣物运动，但不得开始新的剧情动作。

## 8. 摄影机、动作与声音

### 8.1 摄影机

默认原子模式：

- 一个主导景别。
- 一个摄影意图。
- 固定机位或一个简单连续运镜。
- 不包含内部剪辑词。

把“镜头很有压迫感”改写为：

```text
固定低机位近景，镜头略低于人物眼睛，人物占画面上方三分之二。
```

### 8.2 动作

使用动词、路径、接触对象和终止状态：

```text
右手握住门把手 → 向下压到底 → 门打开约20厘米 → 手仍停在把手上
```

避免：

- “自然地做动作”。
- “表现出复杂情绪”。
- “戏剧性地转身”。
- 一个短镜头中连续完成多次不相关行为。

### 8.3 声音

先选择声音制作路径：

```text
native_joint
separate_ai_audio
production_sound
adr
foley_and_mix
silent_generation
```

多人对白、长对白或精确口型为高风险时，优先选择无对白表演画面加后期配音。不要把“支持原生声音”解释为所有语言、多人和长对白都能稳定同步。

提示词中明确：

- 谁说话。
- 对白开始和结束时间。
- 是否出画。
- 环境声是否连续。
- 音乐是否属于场内声。
- 哪些声音后期添加，不能要求模型生成。

## 9. 负面约束

### 9.1 写法

负面约束只针对高概率且会破坏当前 Shot 的错误：

```text
不新增人物；不改变灰色西装；不交换录音笔所在手；
不产生额外切镜；不出现字幕、标志或水印；不改变会议室布局。
```

### 9.2 分类

- 身份：不改变脸、年龄区间、发型和妆造。
- 数量：不新增或删除主体。
- 连续性：不交换左右手、服装、伤势和道具。
- 构图：不改变主导景别，不漂移到另一轴线侧。
- 动作：不重复动作，不改变动作顺序。
- 物理：不穿模，不产生漂浮或无因果变形。
- 编辑：不额外切镜，不跳时空。
- 文字：不生成字幕、水印、品牌或随机文字。
- 声音：不新增未授权对白或说话人。

### 9.3 限制

- 不要堆叠通用负面词库。
- 不要在负面约束中引入此前未出现的新物体。
- 不要用负面词掩盖正向指令缺失。
- 模型不支持独立负面提示参数时，把必要约束合并到结构化提示词，不伪造 API 字段。

## 10. 多镜头与拆分例外

Seedance 2.0 的官方资料表明模型具有多镜头叙事能力，但本 SKILL 默认不把能力声明当作稳定生产保证。

只有同时满足以下条件才允许一个 Task 包含多个 Shot：

- 用户或项目明确启用多镜头任务。
- 所有 Shot 属于同一连续叙事单元。
- 每个内部镜头具有明确时间边界。
- 主体、场景和动作复杂度处于可接受风险。
- 多镜头输出失败时已有单镜拆分方案。
- 验收器可以检测内部镜头边界。

复杂 Shot 拆分时，优先在以下位置断开：

- 动作接触点。
- 遮挡画面。
- 人物经过镜头。
- 道具填满画面。
- 视线转移点。
- 动作结果完成后。

每个子 Task 都保留共同的 `shot_refs`，并记录 `segment_index`、承接状态和重组方法。

## 11. 编译后校验

输出前逐项检查：

### 11.1 保真

- 每条动作、对白和结果都能映射到 Shot 或授权。
- 提示词没有新增人物、关系、证据或结果。
- 结构化字段与渲染字符串含义一致。

### 11.2 原子性

- 默认任务只有一个主导景别。
- 没有未标记切镜、地点跳跃或时间跳跃。
- 主要动作可在请求时长内完成。

### 11.3 连续性

- 首帧符合 `continuity_in`。
- 尾帧符合 `continuity_out`。
- 人物、服装、伤势、道具、左右手、视线和轴线无冲突。

### 11.4 能力

- 请求时长、输入数量和模态不超过已核验能力。
- `unknown` 能力没有被当作可用。
- 地区和账号限制来自本次运行快照。
- 官方能力、内部建议和实测结论没有混写。

### 11.5 可评估性

- 每个验收条件都可观察。
- 每个高风险点都有降级策略。
- Attempt、Media Asset 和 Timeline Clip 均可通过 ID 追踪。

## 12. 完整示例

### 12.1 输入 Shot

```yaml
shot_id: SH-024
beat_refs: [BEAT-011]
dominant_shot_size: close_up
requested_edit_duration_seconds: 5.0
subject_ids: [CHAR-LINXIA, CHAR-MANAGER]
start_state:
  CHAR-LINXIA:
    screen_position: right
    right_hand_prop: PROP-RECORDER
    gaze_target: CHAR-MANAGER
  PROP-RECORDER:
    position: in_right_hand
end_state:
  PROP-RECORDER:
    position: center_of_table
  CHAR-MANAGER:
    gaze_target: PROP-RECORDER
visible_action: 林夏把录音笔推到桌面中央并松手。
narrative_purpose: 让录音证据第一次进入所有人的视线。
```

### 12.2 编译结果

```yaml
generation_task_id: GT-024-A
shot_refs: [SH-024]
model_id: bytedance-seedance-2.0
requested_duration_seconds: 6
reference_assets:
  - asset_id: ASSET-LINXIA-CANONICAL-03
    reference_type: character
    applies_to: CHAR-LINXIA
    priority: required
  - asset_id: ASSET-MEETINGROOM-02
    reference_type: environment
    applies_to: SCENE-04
    priority: required
first_frame_state: 林夏位于画面右侧近景，右手握黑色录音笔，手停在桌沿上方。
last_frame_state: 录音笔停在桌面中央；林夏已经松手并直视经理；经理低头看录音笔。
prompt_sections:
  subject_lock: 林夏，齐肩黑发，灰色西装、白衬衫；经理，深蓝西装。人物外观与参考图一致。
  environment_lock: 夜间会议室，冷白顶灯，长桌，玻璃门位于左后方。
  initial_frame: 固定机位近景，林夏在画面右侧，录音笔在她右手。
  timeline_events:
    - 0.0–1.0秒：保持起始姿势，人物自然呼吸。
    - 1.0–3.0秒：林夏用右手把录音笔沿桌面推到画面中央。
    - 2.2–3.8秒：经理低头看向录音笔，右手从文件上抬起。
    - 3.8–5.2秒：林夏松开录音笔并直视经理；录音笔保持在桌面中央。
    - 5.2–6.0秒：保持动作结果，预留尾部剪辑余量。
  camera: 固定机位，主导近景，不推拉，不改变轴线。
  audio: 不生成对白；保留轻微衣料声和录音笔滑过木桌的摩擦声，最终声音可后期替换。
  final_frame: 录音笔位于桌面中央，林夏已松手，经理视线落在录音笔上。
  continuity: 录音笔只由林夏右手移动；服装、灯光、空间布局不改变。
  negative_constraints:
    - 不新增人物或道具
    - 不交换录音笔所在手
    - 不产生额外切镜
    - 不改变主导近景
    - 不出现字幕、水印、品牌或随机文字
acceptance_criteria:
  - 录音笔从林夏右手移动到桌面中央且动作只发生一次
  - 经理在录音笔停止前后低头看向它
  - 尾帧可承接下一镜录音笔特写
```

编译完成后，把风险评估和 Attempt 策略交给 `generation-risk-and-repair.md`。

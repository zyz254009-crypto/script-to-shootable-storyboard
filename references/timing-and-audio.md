# 时间、台词与声音生产

把对白、动作、反应、摄影运动和声音写入同一事件时间轴。使用事件依赖图的关键路径计算最低镜头时长；不要把能够同时发生的事件机械相加。让每句台词能够由具体角色在具体情境中说出口，并让每个必须声音形成“事件—录制或生成尝试—媒体资产—可用区间—时间线片段”的闭环。

## 目录

- [适用范围](#适用范围)
- [核心原则](#核心原则)
- [时间单位与时间基准](#时间单位与时间基准)
- [事件时间轴](#事件时间轴)
- [关键路径计算](#关键路径计算)
- [镜头时长与余量](#镜头时长与余量)
- [台词可说性](#台词可说性)
- [对白类型与口型](#对白类型与口型)
- [声音事件分类](#声音事件分类)
- [J-cut、L-cut 与声画桥](#j-cutl-cut-与声画桥)
- [Wild Track、Room Tone 与现场补录](#wild-trackroom-tone-与现场补录)
- [声音生产闭环](#声音生产闭环)
- [短剧声音节奏](#短剧声音节奏)
- [正反例](#正反例)
- [硬失败](#硬失败)
- [软警告](#软警告)
- [错误路由](#错误路由)
- [交付检查表](#交付检查表)

## 适用范围

在以下情况加载本手册：

- 镜头包含对白、旁白、画外对白、重叠对白或口型同步。
- 需要估算镜头最低时长。
- 动作、对白、反应和运镜可能同时发生。
- 使用 J-cut、L-cut、声画桥、Wild Track 或 Room Tone。
- 需要把长台词改成可说、可演、可剪的短剧台词。
- 需要检查 Seedance 原生声音、后期配音或真人同期声。
- 已有分镜只写“配紧张音乐”“人物激动地说”，没有时间和执行数据。

不要在本阶段新增人物动机、身份、证据、关系或剧情结果。台词精简必须保留锁定含义；改变事实或角色立场时，退回权限与剧情阶段。

## 核心原则

执行以下规则：

1. 把对白、动作、反应、摄影运动、拟音和音乐分别建成事件。
2. 为事件记录开始、结束、依赖和可重叠关系。
3. 使用依赖图的最长路径计算最低可执行时长。
4. 区分最终剪辑时长、拍摄或生成时长、源素材可用区间和 Handles。
5. 不用固定字数公式替代真人试读或目标语音实测。
6. 不让音乐替代关键信息。
7. 不让旁白复述画面已经清楚表达的内容。
8. 不让关键事实只存在于听觉渠道；若无障碍或静音观看会丢失信息，补充视觉冗余或字幕。
9. 把声音视为可跨镜连续的时间线对象，不把它锁死在单个 Shot 的备注栏。
10. 对每个声音事件保留来源、权利、制作方法和素材闭环。

## 时间单位与时间基准

### 使用统一秒值

内部计算统一使用秒，保留足够小数精度。显示帧号时，同时记录帧率。

```yaml
timebase_rate: 25
start_seconds: 1.24
end_seconds: 3.80
```

不要在同一项目中把 24、25、30 fps 的帧号直接相减。先转换到统一时间基准。

### 区分两种时间基准

使用：

```text
shot_local
```

表示相对某个 Shot 起点的时间。此时必须填写 `anchor_shot_id`。

使用：

```text
timeline_global
```

表示相对整条成片时间线起点的时间。

不要把局部 1.2 秒误写成全片 1.2 秒。

### 区分四种时长

```text
edit_duration_seconds
```

最终成片使用的 Shot 时长。

```text
capture_or_generation_duration_seconds
```

真人拍摄或模型生成所需的完整素材时长。

```text
usable_range
```

Media Asset 中通过质量审核、可供剪辑的源区间。

```text
head_handle_seconds / tail_handle_seconds
```

最终使用区间前后的可用余量。

不得把一次生成 8 秒直接等同于成片使用 8 秒。

## 事件时间轴

### 建立事件

为每个镜头至少检查以下事件类别：

```yaml
event_id:
event_class: action | dialogue | reaction | camera | audio | edit_hold
start_condition:
duration_seconds:
can_overlap:
dependencies:
required:
source_refs:
```

声音事件使用 `Audio Event` Schema；动作、摄影和反应事件可以由 Shot 时间设计器暂存，但必须能够映射回 Shot 的开始状态、动作和结束状态。

### 写明事件边界

使用可观察边界：

```text
开始：人物的手指碰到录音笔。
结束：录音笔停在桌面，手指完全离开。
```

不要写：

```text
开始：她准备反击。
结束：气氛达到高潮。
```

### 建立依赖关系

使用以下关系：

```text
finish_to_start
start_to_start
finish_to_finish
start_to_finish
```

为每条依赖记录 `minimum_gap_seconds`。

示例：

```yaml
- event_id: EVT-KEY-LANDS
  relation: finish_to_start
  minimum_gap_seconds: 0.10
```

含义是：当前事件必须在钥匙落桌事件结束至少 0.10 秒后开始。

### 标记允许重叠

常见可重叠组合：

- 人物说话时走向桌边。
- 摄影机缓慢横移时人物完成一句短台词。
- 画外对白延续到听者反应镜头。
- 环境底噪覆盖整个场景。
- 音乐在对白下方持续，但必须执行压低或让位。

常见不可重叠组合：

- 人物先看清短信，才能说出短信中的名字。
- 门真正关上后，锁舌声才能出现。
- 对方说出身份后，听者的独立反应才能成立。
- 一只手先放下杯子，才能拿起同一只手边的文件。

不要为节省时长强行让因果事件重叠。

## 关键路径计算

### 建立有向无环图

把事件视为节点，把依赖视为边。执行：

1. 验证所有依赖事件存在。
2. 验证事件没有依赖自身。
3. 检测循环依赖。
4. 按拓扑顺序计算每个事件最早开始和最早结束。
5. 取所有必需事件最早结束时间的最大值。
6. 加入必须的首尾可读停留和剪辑余量。

若存在循环，停止计算并返回时间设计阶段。不要任意打断一条依赖。

### 计算方式

对事件 `i`：

```text
earliest_start(i)
= 所有前置依赖约束允许的最晚开始时间

earliest_finish(i)
= earliest_start(i) + duration(i)

critical_path_duration
= max(earliest_finish(required_events))
```

不同依赖类型按对应开始或结束锚点计算。不得把所有事件时长相加。

### 示例

事件：

```text
A：人物抬起录音笔，1.2 秒。
B：人物说“你要的证据在这里”，1.8 秒，可与 A 同时开始。
C：录音笔落桌，0.4 秒，必须在 A 后半段发生。
D：经理看向录音笔，0.6 秒，必须在 C 结束后开始。
E：镜头保留经理反应，0.5 秒，接在 D 后。
```

如果 A 与 B 同时从 0 秒开始，C 在 0.8 秒开始，D 在 1.2 秒开始，E 在 1.8 秒开始，则最低事件时长约为 2.3 秒，而不是：

```text
1.2 + 1.8 + 0.4 + 0.6 + 0.5 = 4.5 秒
```

再根据口齿、动作稳定性和剪辑余量确定实际 Shot 时长。

### 关键路径字段

至少输出：

```yaml
timing_plan_id:
shot_id:
event_ids:
dependency_edges:
critical_event_ids:
critical_path_seconds:
edit_hold_head_seconds:
edit_hold_tail_seconds:
minimum_edit_duration_seconds:
planned_edit_duration_seconds:
capture_or_generation_duration_seconds:
head_handle_seconds:
tail_handle_seconds:
calculation_version:
```

`planned_edit_duration_seconds` 不得小于 `minimum_edit_duration_seconds`。

## 镜头时长与余量

### 先计算，再决定节奏

按以下顺序处理：

1. 完成事件图。
2. 计算最低执行时长。
3. 加入信息读取时间。
4. 加入表演停顿和反应。
5. 加入首尾稳定帧或真人拍摄余量。
6. 再根据平台和题材 Profile 判断是否需要拆镜或压缩。

不要先规定“每镜 3 秒”，再强迫所有动作和台词塞进去。

### 信息读取时间

对于手机、合同、数字、证件等可读信息，记录：

```yaml
readable_content:
character_count:
minimum_legibility_seconds:
font_or_prop_scale:
safe_zone_id:
```

用目标画幅和实际预览测试可读性。不要只凭文字长度估计。

### Handles

为真人素材和 AI 素材预留头尾余量，以便：

- 调整切点。
- 建立 J-cut 或 L-cut。
- 隐藏生成起始抖动。
- 做动作匹配。
- 添加转场或短溶接。

Handles 数值由生产 Profile 决定。若没有可靠 Profile，保留非零余量并标记待实测；不要凭空宣称某个平台固定需要多少帧。

## 台词可说性

### 执行五项测试

对每句对白执行：

1. **角色测试**：这句话是否符合角色身份、知识范围和当前关系？
2. **口腔测试**：真人能否在计划情绪和动作下自然说完？
3. **意图测试**：角色为什么现在说，而不是作者为什么想让观众知道？
4. **信息测试**：是否包含观众已经从画面看见的重复信息？
5. **剪辑测试**：句中是否有自然停顿、信息重音和可切点？

任一测试失败，先压缩、拆句、转动作或调整 Coverage。不得为追求短句改变锁定事实。

### 记录可计算字段

```yaml
dialogue_block_id:
speaker_character_id:
text:
language_profile_id:
character_count:
estimated_syllable_or_character_units:
target_pace:
pace_units_per_minute:
pause_seconds:
breath_seconds:
emphasis_units:
overlap_audio_event_ids:
tested_read_duration_seconds:
tested_by: human_read | tts | generated_voice | estimate_only
meaning_fact_ids:
compression_allowed:
```

中文口语不要直接套用英文 WPM。通过 `language_profile_id` 指定中文字符、音节或词组口径，并记录实测时长。

### 使用真人试读或语音实测

优先级：

```text
角色化真人试读
→ 目标配音或生成音色实测
→ 校准过的语言 Profile
→ 粗略估算
```

激烈争执不一定更快；哭泣、喘息、压低声音、边跑边说都会降低可说速度。把这些条件写入 `delivery`。

### 精简台词

优先删除：

- 画面已经表达的动作复述。
- 角色双方都知道的背景说明。
- 同一信息的连续同义反复。
- 作者式心理解释。
- 不改变回应的口头填充。

优先保留：

- 立场。
- 目标。
- 威胁或代价。
- 新信息。
- 可被下一句回应的动作性语言。
- 角色独有的措辞。

正例：

```text
原句：
“我已经知道你就是那个私下改了合同的人，所以你现在再怎么解释也没有任何意义。”

压缩：
“合同是你改的。别解释。”
```

前提是“她已经知道”与“合同被对方修改”均来自原稿。若事实尚未揭示，不得提前说出。

反例：

```text
为了爽点改成：
“合同是你改的，警察已经在楼下。”
```

若原稿没有报警事实，该句属于未授权新增。

### 让台词具有回应关系

把对话写成行动交换：

```text
A 提出要求。
B 拒绝或改变条件。
A 出示证据。
B 改变行动。
```

不要写成轮流朗读背景材料。

### 控制称呼和信息重复

现实对话中不会每句重复姓名、职位和关系。仅在以下情况使用明确称呼：

- 改变权力关系。
- 防止多人场景指向不清。
- 故意公开身份。
- 完成讽刺、威胁或情感转折。

## 对白类型与口型

### 同期对白 `sync_dialogue`

声音来源人物在画面中可见并需要口型匹配。

必须记录：

- 说话角色。
- 完整文字。
- 计划时长。
- 口型是否必须同步。
- 是否允许后期配音。
- 表演状态。
- 拍摄或生成方法。

多人同画面说话时，谨慎要求多人口型。若模型风险高，拆为单人镜头、画外延续或后期配音，但不得改变谁说了什么。

### 画外对白 `offscreen_dialogue`

说话者属于当前场景，但不在当前画面内。

用于：

- 保留听者反应。
- 缩短对话切换。
- 隐藏口型或生成缺陷。
- 让声音先于说话者入画。

不要把不属于场景空间的旁白误标为画外对白。

### 旁白 `voice_over`

旁白可以跨越时空，不一定来自当前场景。

使用旁白前检查：

- 是否来自原稿。
- 是否提供画面无法直接获得的信息。
- 是否改变叙事视角。
- 是否泄露本应延迟的悬念。
- 是否需要字幕和来源授权。

不要用旁白解释演员动作的意义：

```text
坏：
旁白：“她终于决定反击。”

好：
她把工牌压在辞职信上；若原稿本来有第一人称旁白，只保留旁白中画面无法表达的时间或背景信息。
```

### 重叠对白

为重叠对白记录：

```yaml
overlap_audio_event_ids:
overlap_start_seconds:
overlap_end_seconds:
dominant_speaker_id:
intelligibility_priority:
```

若两句都承载关键事实，不要完全重叠到无法听清。可把一方降为打断词或改用连续事件，但必须保持原意。

## 声音事件分类

使用既有枚举：

```text
sync_dialogue
offscreen_dialogue
voice_over
ambience
foley
music
wild_track
j_cut
l_cut
sound_effect
silence
room_tone
```

### 环境声 `ambience`

描述空间持续存在的声音环境：

- 空调。
- 街道。
- 办公室键盘。
- 雨声。
- 餐厅人声。

记录开始状态、结束状态和跨镜连续性。场景内环境声无故消失会暴露剪点。

### 拟音 `foley`

同步可见动作：

- 放下钥匙。
- 衣料摩擦。
- 脚步。
- 纸张翻动。

拟音时间必须锚定动作相位。不要用夸张撞击声替代画面中没有发生的力度。

### 音效 `sound_effect`

用于界面提示、门锁、警报、特殊装置等。若音效证明关键事实，补充屏幕、灯光或人物动作等视觉冗余。

### 音乐 `music`

记录：

```yaml
music_cue_id:
start:
end:
dramatic_function:
ducking_required:
dialogue_conflict_ranges:
rights_record_ids:
```

不要写“上燃曲”“配悬疑音乐”就结束。说明音乐从哪里进入、何时让位、何时停止，以及它服务哪个 Beat。

### 沉默 `silence`

沉默是主动设计，不是缺少声音文件。记录：

- 哪些声音仍然存在。
- 哪些声音被抽掉。
- 沉默从哪个事件开始。
- 哪个动作或声音结束沉默。

“全场安静”通常仍有 Room Tone。

## J-cut、L-cut 与声画桥

### J-cut

下一 Shot 或下一 Scene 的声音先进入，画面随后切换。

记录：

```yaml
event_type: j_cut
source_shot_id:
target_shot_id:
audio_lead_seconds:
trigger_event_id:
editorial_purpose:
```

用于：

- 提前建立下一空间。
- 加速对话。
- 连接因果。
- 制造合法的信息预期。

不得用 J-cut 提前泄露原稿尚未发生的事实。

### L-cut

前一 Shot 的声音延续到下一画面。

用于：

- 保留听者反应。
- 延续一句台词或环境声。
- 压缩说话者画面。
- 用声音维持空间连续。

记录延续区间和目标 Clip。不要只写“声音延续”。

### 声画桥

声音可以跨场连接相似或因果相关事件：

```text
法槌声提前进入签字画面
→ 下一场切到法庭
```

前提是法庭事实已存在于原稿或获授权。不要为了“高级”新增不存在的场景。

## Wild Track、Room Tone 与现场补录

### Wild Track

把 Wild Track 定义为脱离正式画面条次、单独录制的对白、群体声或环境动作声。

在以下情况设为必须：

- 长对白需要后期修补。
- 现场噪声高。
- 画外对白需要独立使用。
- 群体反应需要可控层次。
- 关键动作声可能被衣物或设备掩盖。

记录：

```yaml
wild_track_id:
audio_event_ids:
speaker_ids:
text_or_action:
performance_match_take_ids:
room_tone_profile_id:
required_variants:
recording_status:
media_asset_ids:
```

不要把 Wild Track 当作任意改词的机会。文字仍受事实和对白授权约束。

### Room Tone

每个主要声学空间记录足够的 Room Tone，并绑定：

```yaml
room_tone_profile_id:
location_id:
scene_ids:
recording_condition:
media_asset_ids:
usable_ranges:
```

若场景声学状态变化，例如空调关闭、门打开、雨势加大，建立不同 Profile。

### 现场补录与 ADR

若需要后期配音，记录：

- 原同期声资产。
- 替换原因。
- 台词是否改变。
- 口型适配范围。
- 表演参考。
- 声学匹配要求。
- 用户或版权授权。

不得静默用后期配音修改角色立场。

## 声音生产闭环

### 建立 Audio Production

每个声音生产对象至少包含：

```yaml
audio_production_id:
audio_event_ids:
method: location_recording | studio_recording | generated | library | composite
status:
attempts:
selected_media_asset_ids:
timeline_clip_ids:
event_closures:
mix_requirements:
field_provenance:
```

### 记录 Attempt

每次录制或生成尝试记录：

```yaml
attempt_id:
attempt_number:
source_or_model:
parameters:
status:
result_media_asset_ids:
usable_ranges:
acceptance_scores:
selection_status:
rejection_reasons:
```

不要覆盖失败尝试。失败原因可用于重录、换制作方法或修正时间计划。

### 验证闭环

每个必须声音事件必须形成：

```text
Audio Event
→ Audio Production Attempt
→ Media Asset
→ usable_range
→ Timeline Clip
→ event_closure: complete
```

只写“后期加音效”不算闭环。

### 验收分数

至少评估：

```text
intelligibility
performance
noise
sync
continuity
overall
```

阈值由项目质量配置决定。若没有配置，不得自行宣称通过；标记待审核。

## 短剧声音节奏

### 让声音承担明确功能

每个重点声音至少承担一种功能：

- 提供新信息。
- 触发注意力转移。
- 完成笑点。
- 建立危险。
- 连接镜头。
- 保护剪点。
- 兑现钩子。
- 形成角色权力变化。

删除仅因“短视频要热闹”而添加的无目的提示音。

### 处理密集对白

当对白密集时：

1. 先删除重复解释。
2. 把可以同时发生的动作与对白并行。
3. 为关键新信息保留停顿。
4. 用听者反应或 Insert 提供剪辑空间。
5. 降低摄影运动复杂度。
6. 不牺牲可懂度来追求速度。

### 处理爽点

爽点声音要锚定可见结果：

```text
录音播放出经理原话
→ 经理松开合同
→ 会议室停止翻页
```

不要只用重低音或“砰”声宣告反转，却没有事实变化。

### 处理悬疑

让声音来源可追踪或有意延迟揭示：

- 门外脚步靠近。
- 手机在无人桌面震动。
- 房间内出现不属于当前人物的呼吸。

若声音来源永远不解释，必须由 Hook Contract 合法延期或开放结局授权。

## 正反例

### 时间关键路径

```text
坏：
对白 2 秒 + 放钥匙 1 秒 + 推镜 2 秒 = 镜头至少 5 秒。

好：
对白、放钥匙和缓慢推镜从同一时刻开始；钥匙落桌后保留 0.5 秒反应。通过依赖图计算最低 2.7 秒，再加入头尾余量。
```

```text
坏：
为了控制在 3 秒，让人物一边读完短信、一边在读完前回答短信内容。

好：
“读清短信”是回答的前置事件；若关键路径超时，拆镜或缩短已授权台词。
```

### 台词可说性

```text
坏：
“关于三年前你利用职务之便偷偷篡改合同并且导致公司损失这件事情，我今天必须让所有董事都知道真相。”

好：
她把旧合同投到屏幕上：“三年前，合同是你改的。”
```

```text
坏：
人物边全速奔跑边平稳说完四行解释性台词。

好：
记录喘息和可说速度；将必要信息压成短句，其余延后或交给已存在的画面证据。
```

### 同期与画外

```text
坏：
镜头拍听者反应，但声音栏没有说明谁在画外说话。

好：
AUE-021 标为 offscreen_dialogue，绑定说话角色、文字、起止时间和听者反应 Shot。
```

```text
坏：
多人同画面同时说关键证据，要求每个人口型都精准。

好：
保留主说话者同期口型；其余打断词分层录制，关键事实不重叠。
```

### J-cut 与 L-cut

```text
坏：
下一场警笛提前进入，但原稿没有警察或警车。

好：
下一场工厂警报已在原稿中；警报提前 0.4 秒进入当前门关闭的尾部，连接危险升级。
```

```text
坏：
台词延续到下一镜，但下一镜中人物嘴部仍在说另一句。

好：
L-cut 延续到听者无口型反应镜头，并记录音画重叠区间。
```

### Wild Track 与 Room Tone

```text
坏：
“后期随便补一句。”

好：
拍摄现场按同一表演强度录制两版 Wild Track，绑定原台词事实 ID 和 Room Tone Profile。
```

```text
坏：
对白剪接处办公室底噪突然消失。

好：
用同一空间状态的 Room Tone 覆盖剪点，并验证环境声连续性。
```

### 旁白

```text
坏：
画面已经拍到她撕掉合同，旁白再说“她撕掉了合同”。

好：
删除重复旁白；若原稿旁白包含“三小时前合同已经失效”且画面无法表达，则保留该信息并标记来源。
```

### 音乐

```text
坏：
“这里上燃曲，突出她很强。”

好：
录音证据播放完后，音乐从低频脉冲进入；经理松手时停止，给合同落桌声让位。
```

## 硬失败

出现以下任一项，必须退回相应阶段：

- 使用简单加法计算可并行事件，导致错误时长。
- 事件依赖图存在循环。
- `planned_edit_duration_seconds` 小于关键路径最低时长。
- 局部与全局时间基准混用。
- Shot 没有区分剪辑时长和拍摄或生成时长。
- 对白无法在目标表演状态下说完。
- 精简台词改变锁定事实、角色立场或事件结果。
- 新增对白事实没有 `authorization_id`。
- 同期对白要求口型同步，却没有说话者、文字或时间。
- 重叠对白导致两个关键事实都不可懂。
- J-cut 或 L-cut 提前或延后了不存在的剧情事实。
- 关键声音只写在备注中，没有 Audio Event。
- 关键声音没有来源、权利或制作方法。
- 必须声音没有形成 Attempt、Asset、usable range 和 Timeline Clip 闭环。
- Timeline Clip 使用了 Media Asset 的不可用区间。
- 关键事实只靠声音传达，且没有字幕、视觉冗余或明确无障碍豁免。
- 音乐掩盖关键对白或拟音。
- Room Tone 状态与场景不一致。

## 软警告

以下情况允许保留，但必须记录理由：

- 对白速度高于已校准语言 Profile 的常用范围。
- 一句台词包含三个以上独立信息点。
- 人物边执行高精度手部动作边说长台词。
- 依赖自动生成多人口型。
- 使用旁白传递可由简单画面表达的信息。
- J-cut 或 L-cut 跨越较长时间，可能造成空间误读。
- 音乐持续覆盖整个场景，没有明确进入、退出或让位点。
- 使用拟音强化动作力度，可能改变动作观感。
- 同一空间存在多个 Room Tone Profile，但切换点未说明。
- Wild Track 与原表演强度不匹配。
- Handles 过短，难以调整剪点。
- 仅使用估算值，没有真人或目标语音实测。

## 错误路由

| 问题 | 返回阶段 | 处理 |
|---|---|---|
| 台词新增事实 | 权限与事实台账 | 删除新增或取得授权 |
| 台词含义漂移 | 剧本分析 | 恢复事实和人物立场 |
| 关键路径超时 | 时间设计 | 并行合法事件、压缩或拆镜 |
| 对白不可说 | 台词编辑 | 试读、拆句、压缩重复 |
| 动作不可并行 | 调度 | 重排动作相位 |
| 无可用剪点 | Coverage | 增加反应、Insert 或声音覆盖 |
| 口型风险高 | 制作决策 | 拆镜、画外延续或后期配音 |
| 声音来源不明 | Audio Event | 补来源、角色和空间关系 |
| 音频资产不闭环 | Audio Production | 补 Attempt、Asset、Clip |
| 环境声断裂 | 连续性与混音 | 补 Room Tone 或匹配 Profile |
| 关键事实静音不可懂 | 视觉转译 | 补字幕或可见证据 |

## 交付检查表

- [ ] 所有事件使用统一时间基准和帧率说明。
- [ ] 每个 Shot 建立动作、对白、反应、摄影和声音事件。
- [ ] 所有依赖引用存在，依赖图无环。
- [ ] 最低时长由关键路径得出，而不是机械相加。
- [ ] 剪辑时长、拍摄或生成时长、可用区间和 Handles 已分开。
- [ ] 每句台词通过角色、口腔、意图、信息和剪辑测试。
- [ ] 中文或其他语言使用对应语言 Profile，并尽量完成实测试读。
- [ ] 台词压缩没有改变锁定事实。
- [ ] 同期、画外、旁白和重叠对白分类准确。
- [ ] 口型、后期配音和跨镜延续要求明确。
- [ ] J-cut、L-cut 和声画桥记录具体起止时间与叙事用途。
- [ ] Wild Track、Room Tone、拟音和音乐需求已结构化。
- [ ] 必须声音形成 Audio Event 到 Timeline Clip 的生产闭环。
- [ ] 关键事实具有字幕或视觉冗余。
- [ ] 所有阻断问题均已解决，或交付明确标记为 blocked。

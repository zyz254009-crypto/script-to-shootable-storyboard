# 剪辑意图与 Coverage

先定义“观众何时需要看到什么”，再冻结最终 Shot。使用 Coverage Matrix 管理必拍、保险和可选覆盖；使用 Provisional Shot Intent 在调度、机位和镜头之间建立稳定中间层；只为明确的切镜动机增加镜头。

## 目录

- [适用范围](#适用范围)
- [核心对象与关系](#核心对象与关系)
- [Coverage 设计顺序](#coverage-设计顺序)
- [Coverage Matrix](#coverage-matrix)
- [Provisional Shot Intent](#provisional-shot-intent)
- [Coverage 角色](#coverage-角色)
- [优先级与最小充分覆盖](#优先级与最小充分覆盖)
- [切镜动机](#切镜动机)
- [动作、对白和反应覆盖](#动作对白和反应覆盖)
- [特殊覆盖](#特殊覆盖)
- [从 Intent 到正式 Shot](#从-intent-到正式-shot)
- [生产闭环](#生产闭环)
- [高频好坏例](#高频好坏例)
- [硬失败](#硬失败)
- [软警告](#软警告)
- [交付检查表](#交付检查表)

## 适用范围

在以下情况加载本手册：

- 一个场景包含对话、冲突、证据揭示或多人反应。
- 关键动作需要主镜头、插入、反应或保险覆盖。
- 已有分镜镜头很多，但没有明确剪辑目的。
- 已有分镜只有一个长主镜头，关键表演或信息无法调整。
- 需要设计 Action Match、视线切、J-cut、L-cut、遮挡或转场。
- 需要在 Coverage、Camera Setup 和正式 Shot 之间避免循环引用。

不要把 Coverage 理解为“每场都拍全景、中景、近景各一条”。Coverage 是信息、动作和表演的可剪保障，不是镜头套餐。

## 核心对象与关系

### Coverage Need

描述某个 Beat 或场景必须在剪辑中拥有的可见、可听能力。

例如：

```text
需要看清 A 把钥匙交给 B。
需要保留 B 不接钥匙的独立反应。
需要能在不改变对白的情况下缩短经理的长台词。
需要一个能够跨场转场的门关闭动作。
```

### Coverage Matrix

把 Coverage Need、优先级、角色、重叠范围、候选 Intent 和剪辑理由组织成矩阵。

### Provisional Shot Intent

在最终景别、焦段、机位和 Setup 冻结前，稳定记录一个候选镜头要完成的叙事和剪辑任务。

### Shot

Setup 优化后，从 Intent 冻结出的正式镜头。

关系：

```text
Beat
→ Coverage Need
↔ Provisional Shot Intent
↔ Camera Setup
→ Final Shot
→ Take / Generation Attempt
→ Media Asset usable range
→ Timeline Clip
```

Coverage Need 与 Shot 是多对多关系：

- 一个 Shot 可以满足多个相容 Need。
- 一个 Need 可以由多个候选 Shot 提供保险。
- 不要把 Coverage 作为 Shot 的父目录。

## Coverage 设计顺序

按以下顺序执行：

1. 读取 Beat、Hook Contract、Blocking Plan 和声音草案。
2. 标出每个 Beat 的必须信息和可省信息。
3. 标出必须看到的动作、反应和证据。
4. 标出必须听到的对白和可画外延续的声音。
5. 标出可用切点和不能切断的表演。
6. 建立 Coverage Need。
7. 为每个 Need 指定 `must_have`、`safety` 或 `optional`。
8. 创建 Provisional Shot Intent，不先冻结最终摄影参数。
9. 合并能够由同一 Intent 清楚满足的 Need。
10. 交给 Camera Setup 规划，用尽量少的 Setup 覆盖必拍 Intent。
11. 冻结正式 Shot。
12. 生产后验证素材与 Timeline Clip 是否真正闭环。

不要先写十几个 Shot，再反推每个 Shot 有什么用。

## Coverage Matrix

每条记录至少包含：

```yaml
coverage_id:
scene_id:
beat_ids:
required_information:
coverage_priority: must_have | safety | optional
coverage_role: master | two_shot | over_shoulder | single | reaction | insert | transition | clean_plate
candidate_shot_intent_ids:
action_overlap_range:
dialogue_overlap_range:
reaction_cut_points:
wild_track_required:
clean_plate_required:
editorial_reason:
```

### required_information

用观众必须获得的内容描述，不用摄影术语代替：

```text
坏：拍一个特写。
好：观众必须读清合同签字人与实际授权人不一致。
```

### action_overlap_range

记录不同 Coverage 需要重复的动作相位：

```text
钥匙交接 P1–P5
杯子落地 P0–P4
人物起身 P1–P3
```

没有重叠范围，主镜头和插入镜头可能无法动作匹配。

### dialogue_overlap_range

记录同一台词在不同 Coverage 中需要完整重复或部分重叠的区间。不要默认每个机位只拍自己画内人物的台词。

### reaction_cut_points

记录可切入反应的明确节点：

- 对方说出名字后。
- 证据出现在屏幕后。
- 钥匙落桌的声音后。
- 人物停顿开始时。

“适当时切反应”不可执行。

### editorial_reason

每项 Coverage 至少对应一种理由：

- 保留关键信息。
- 调节节奏。
- 压缩对白。
- 隐藏表演或生成缺陷。
- 建立空间。
- 保护动作连续性。
- 提供转场。
- 保存角色反应。
- 满足平台构图。

若没有理由，优先删除该 Coverage。

## Provisional Shot Intent

### 目的

使用 Shot Intent 解决以下循环：

```text
Coverage 想引用 Shot
Camera Setup 想覆盖 Shot
但正式 Shot 又必须等 Coverage 和 Setup 完成后才能冻结
```

先创建稳定的 `shot_intent_id`，再在 Setup 优化后映射到 `final_shot_id`。

### 最小字段

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

### Intent 应该冻结什么

冻结：

- 观众要看谁或什么。
- 要获得哪项信息或反应。
- 动作需要覆盖到哪个相位。
- 声音是否要跨入或跨出。
- 平台和构图的硬约束。
- 该 Intent 服务哪些 Coverage Need。

暂不冻结：

- 精确焦段。
- 最终机位坐标。
- 灯光方案。
- 最终景别边界。
- 最终 Shot 时长。

可以给出 `provisional_shot_size` 供 Setup 估算，但允许在不破坏 Coverage 目的的前提下调整。

### 状态流转

```text
proposed
→ allocated_to_setup
→ frozen_as_shot

或

proposed / allocated_to_setup
→ rejected
```

拒绝 Intent 时记录原因，并确认其 Coverage Need 已被其他 Intent 接管。不得删除唯一的 must-have Intent 后继续流程。

## Coverage 角色

角色描述剪辑功能，不强制对应固定景别。

### Master

覆盖完整空间关系和主要行动。

使用场景：

- 需要建立人物位置。
- 需要保留完整节奏和动作。
- 需要作为剪辑安全底板。

不要假定 Master 必须是全景；小空间可用双人中景承担。

### Two Shot

同时保留两人关系、距离和动作交换。

适合：

- 谈判。
- 交接。
- 同步反应。
- 一方控制另一方的空间。

### Over Shoulder

保留说话者与听者空间关系，同时突出一方。

检查：

- 前景肩部不遮挡关键表情。
- 正反打保持轴线。
- 肩部大小和人物距离匹配。

### Single

突出单个人物的台词、动作或反应。

不要为每句台词机械创建 Single。优先为信息变化、权力变化和可剪节点创建。

### Reaction

记录听者或旁观者因某个事件产生的可见反应。

独立 Reaction 应满足至少一项：

- 暴露新信息。
- 改变关系。
- 成为笑点或悬念。
- 为压缩台词提供切点。
- 保护动作或生成缺陷。

### Insert

让小道具、屏幕、文字、手部或局部动作可读。

Insert 必须回答“观众为什么现在必须看清它”。不要把每个道具都拍特写。

### Transition

提供空间、时间或段落连接：

- 关门。
- 遮挡。
- 动作匹配。
- 方向匹配。
- 声音桥。
- 光线或物体形状匹配。

### Clean Plate

记录无演员或无可变主体的干净背景，用于合成、修复、遮罩或移除。

### Safety

Safety 是优先级，不是单一镜头类型。它为高风险动作、关键台词或模型不稳定点提供替代。

## 优先级与最小充分覆盖

### must_have

缺失会导致：

- 关键 Beat 无法理解。
- 动作无法剪接。
- 钩子无法兑现。
- 对白无法压缩。
- 空间关系无法建立。
- 高风险制作没有可用替代。

所有 must-have 必须形成生产闭环。

### safety

用于：

- 关键动作的第二角度。
- 长台词的反应或插入。
- AI 生成失败的替代镜头。
- 越轴或空间模糊时的中性镜头。
- 合成需要的 Clean Plate。

### optional

用于风格、节奏或额外氛围。预算不足时优先删除。

### 最小充分原则

保留能够：

1. 讲清 Beat。
2. 保证关键动作可剪。
3. 保留关键反应。
4. 提供必要转场和保险。

的最少 Coverage。

避免：

```text
每场固定拍 Master + 双人 + 两个过肩 + 两个单人 + 所有道具特写
```

这会增加拍摄、生成、连戏和选片成本，并不自动提高质量。

## 切镜动机

每个正式 Shot 都要有切入和切出理由。优先使用以下动机：

### 信息变化

新证据、身份、危险或结果出现。

```text
合同翻到签名页
→ 切 Insert 让签名可读
```

### 注意力转移

人物看向新目标，观众需要跟随。

```text
人物听见门外声音并转头
→ 切门口
```

### 反应

听者的反应改变局势或完成笑点。

```text
主角报出真实身份
→ 切经理松开合同的手
```

### 动作匹配

在同一动作相位切换角度，保持连续和力量。

### 节奏

在停顿、句末、动作结果或情绪变化处切换。不要把“节奏快一点”当作无条件多切。

### 空间澄清

切到建立镜头、中性镜头或新轴线，帮助观众理解位置。

### 隐藏缺陷

用反应、插入、遮挡或声音覆盖表演、口型、手部或生成缺陷。不能用 Coverage 隐藏剧情逻辑缺失。

### 转场

利用动作、形状、方向、声音或遮挡连接下一场。

### 钩子兑现或延期

在承诺的关键信息出现时给出足够可读画面；不要在兑现点切走，让观众看不清证据。

### 无效切镜动机

- 因为已经过了两秒。
- 因为短视频必须一直切。
- 因为要有电影感。
- 因为每个人都应该有特写。
- 因为镜头列表看起来不够丰富。

## 动作、对白和反应覆盖

### 动作覆盖

对关键动作记录：

- 完整动作由哪个 Coverage 保存。
- 哪些辅助 Coverage 重复哪些相位。
- 可切入、可切出和禁止切断的相位。
- 道具状态在各相位的位置。

不要在接触动作中间随意切换到不匹配角度。

### 对白覆盖

根据剪辑需要决定：

- 哪条台词必须完整保留。
- 哪条台词可用画外声音继续。
- 哪段需要说话者画面。
- 哪段更需要听者反应。
- 哪些停顿和呼吸不能被剪掉。
- 哪些重叠对白必须同时记录。

允许 J-cut 和 L-cut，但把声音事件交给声音时间轴记录。Coverage Matrix 只记录剪辑需求和关联点。

### 反应覆盖

区分：

- 即时小反应：可保留在双人或关系镜头。
- 独立信息反应：创建 Reaction Intent。
- 群体反应：只在群体状态变化是 Beat 时保留。
- 延迟反应：记录触发点和延迟，不要把它错接到另一句台词。

### 表演连续性

多机位重复对白时，要求：

- 动作相位可重复。
- 语速、停顿和重音相近。
- 表演强度在可剪范围。
- 道具状态一致。

AI 多 Attempt 无法保证表演完全重复时，优先使用短动作、首尾状态和反应/插入覆盖。

## 特殊覆盖

### Wild Track

在现场单独录制环境声或对白，供剪辑覆盖。Coverage Matrix 标记是否必须，但具体声音生产由声音流程管理。

### Room Tone

保存空间底噪，避免对白剪接处声音断裂。

### Clean Plate

混合制作、移除人物、生成替换或遮罩修复时，将 Clean Plate 设为 must-have。

### Reference Plate

为 AI 或合成保存角色、道具和空间关系的参考画面。不要把参考画面误当最终可剪素材。

### Pick-up

仅补拍缺失的动作、台词、Insert 或 Reaction。Pick-up 必须指向未闭环 Coverage Need。

### Establishing

只有空间关系、时间地点或方向需要建立时使用。不要每场都用空镜开头。

### Cutaway

切到当前主要动作之外的相关画面，用于压缩、隐藏缺陷或增加信息。Cutaway 必须与当前 Beat 有明确关系。

## 从 Intent 到正式 Shot

按以下步骤冻结：

1. 汇总同一场景所有 must-have Intent。
2. 检查每个 Intent 的 Blocking 需求和平台约束。
3. 规划 Camera Setup，使一个 Setup 可覆盖多个相容 Intent。
4. 不因节省 Setup 而破坏轴线、视线、表演或信息可读性。
5. 为每个 Intent 确定正式主导景别、机位、动作和时长。
6. 分配稳定 `shot_id`。
7. 将 Intent 状态设为 `frozen_as_shot` 并写入 `final_shot_id`。
8. 更新 Coverage Matrix 的候选和最终满足关系。
9. 对被拒绝 Intent 写明替代 Shot。
10. 运行 Coverage、原子镜头、Blocking 和 Camera Setup 校验。

不要让 Coverage Matrix 直接引用尚未存在的 Shot ID。

## 生产闭环

计划阶段通过不等于已经可剪。生产后，must-have Coverage 必须形成：

```text
Coverage Need
→ Final Shot
→ 合格 Take 或 Generation Attempt
→ Media Asset 可用区间
→ Timeline Clip
```

检查：

- 素材是否真的包含所需动作相位。
- 关键台词和反应是否可用。
- 源入点、源出点和 Handles 是否足够。
- 生成素材内部是否意外出现切镜。
- 同一 Shot 的候选素材是否有选中和淘汰理由。
- 音画链接是否能完成预定切镜。

若只有 Shot 计划而没有可用素材，Coverage 仍未闭环。

## 高频好坏例

### 机械覆盖

```text
坏：
每个场景固定拍全景、双人、两个过肩、两个特写。

好：
本场 must-have 为钥匙交接、B 拒绝和门外脚步声；使用双人中景覆盖交接，B 单人反应保护拒绝，门把手 Insert 兑现声音目标。
```

```text
坏：
所有说话人每句台词都切特写。

好：
谈判前半保留双人关系；当 A 报出真实身份时切 B 的独立反应。
```

### required_information

```text
坏：需要一个漂亮的手机特写。
好：观众必须读清短信发送时间早于案发时间。
```

```text
坏：拍经理反应。
好：经理听见录音中自己的声音后，松开按住合同的手；该反应证明其指控失去控制。
```

### Provisional Shot Intent

```text
坏：
Coverage 直接指定 Shot-07，但 Shot-07 的机位和景别尚未设计。

好：
创建 Intent-07：清楚读取伪造签名；Setup 优化后冻结为 Shot-12 插入镜头。
```

```text
坏：
Intent 写“85mm、低机位、冷光”，却没有剪辑目的。

好：
Intent 写“在经理说完‘签字有效’后，让观众看清签名笔迹与主角姓名不一致”；摄影参数稍后冻结。
```

### 动作重叠

```text
坏：
主镜头拍杯子落地后，插入镜头只拍地上的碎杯。

好：
主镜头覆盖松手到碎裂 P1–P5；插入镜头重复 P2–P5，为动作匹配提供重叠。
```

```text
坏：
正反打中钥匙每次都在不同人手里。

好：
所有 Coverage 从钥匙仍在 A 右手的 P1 开始，B 拒绝后统一结束于钥匙留在桌面 P5。
```

### 对白覆盖

```text
坏：
A 的长台词只拍 A 特写，无法压缩。

好：
保留 A 完整单人，同时拍 B 的反应和合同 Insert；可在不破坏语义时缩短台词。
```

```text
坏：
反应镜头只拍静默的脸，没有对应台词范围。

好：
标记 B Reaction 覆盖 A 台词“你父亲也签了字”前一秒至后一秒。
```

```text
坏：
每次切反应都正好在句子中间，破坏重音。

好：
优先在信息词落下、停顿开始或听者动作启动处切入。
```

### 切镜动机

```text
坏：
镜头太久了，所以切到桌上的花瓶。

好：
对方说“录音已经删了”时，切到花瓶后的录音笔红灯，形成反证。
```

```text
坏：
为了节奏快，人物每说一句就切一次。

好：
在权力关系变化、证据揭示和独立反应处切换；同一谈判立场内保留稳定关系镜头。
```

```text
坏：
人物看向门口后仍切到无关空镜。

好：
沿视线切到门把手正在转动，完成注意力转移。
```

### 反应

```text
坏：
所有旁观者各拍一个惊讶特写。

好：
只保留会改变下一步行动的董事反应；其他人留在群体关系镜头中。
```

```text
坏：
反应镜头重复说话者已经表达的信息。

好：
听者把签字笔推回去，使拒绝成为新的行动结果。
```

### Insert

```text
坏：
拍戒指特写，因为戒指很重要。

好：
当人物声称自己未婚时，切到其手机照片中清晰可见的同款婚戒；Insert 提供反证。
```

```text
坏：
手机屏幕一闪而过，文字无法读清。

好：
为发送时间保留足够可读时长，并把屏幕放在平台安全区。
```

### Master

```text
坏：
Master 只是开场三秒全景，关键动作在画外发生。

好：
Master 完整覆盖两人从谈判到钥匙落桌的主要行动，可作为剪辑安全底板。
```

```text
坏：
为了拍完整 Master，让所有演员动作僵硬地面向摄影机。

好：
先完成自然调度，再选择能读清空间和主行动的 Master Setup。
```

### Safety 与 Optional

```text
坏：
把关键证据 Insert 标为 optional。

好：
证据内容无法从其他镜头读清时，将 Insert 标为 must_have。
```

```text
坏：
所有氛围空镜都标为 must_have。

好：
只有承担地点建立、时间转换或遮挡转场的空镜进入 must-have 或 safety。
```

### AI 生成覆盖

```text
坏：
让一个生成片段同时完成多人争执、手机文字、手部交接和群体反应。

好：
关系镜头保留主要争执；手机信息使用独立 Insert；手部失败时可用真人补拍或静态插入；群体反应降为 optional。
```

```text
坏：
生成失败后只重复同一任务。

好：
Coverage Matrix 预先提供固定机位 Safety、反应 Cutaway 和 Clean Plate，允许切换制作方式。
```

### 转场

```text
坏：
随机拍城市空镜作为每场转场。

好：
人物关上办公室门，下一场以家门从同方向打开开始；动作和方向共同完成转场。
```

```text
坏：
声音桥与画面无关，只为制造悬念。

好：
下一场法槌声提前进入当前人物签字的尾部，连接“决定”与“后果”。
```

## 硬失败

出现以下任一项，退回 Coverage 或编辑意图阶段：

- must-have Beat 没有对应 Coverage Need。
- Coverage Need 只写镜头类型，不写 required_information。
- Coverage Matrix 直接引用尚未创建的正式 Shot，且没有 Shot Intent 中间层。
- must-have Coverage 没有候选 Intent 或所有候选都被拒绝。
- 关键动作没有动作相位和重叠范围，无法匹配剪辑。
- 长对白没有可用于压缩或隐藏剪点的 Coverage，且时长超限。
- 关键反应、证据或钩子兑现没有足够可读画面。
- 正反打或动作 Coverage 违反 Blocking、轴线、视线或道具连续性。
- 切镜没有信息、注意力、动作、反应、空间、节奏、缺陷保护或转场理由。
- 为“丰富镜头”机械添加大量无叙事作用的 Coverage。
- 关键 Insert 的时长、构图或安全区不足以读取信息。
- 删除 Intent 后，其唯一 must-have Coverage 没有替代。
- 计划声称 Coverage 已完成，但生产后没有合格素材区间或 Timeline Clip。
- 用 Cutaway 隐藏剧情因果缺失、未授权改戏或关键表演缺失。

## 软警告

以下情况允许保留，但必须评估成本和收益：

- 一个 Shot 同时满足多个 Coverage Need。
- 同一 Need 有多个 Safety 候选，可能过度覆盖。
- Master 未覆盖全部场景，但完整覆盖主要行动。
- 使用反应镜头压缩对白，可能改变表演停顿。
- 使用 Insert 传递关键信息，但道具尺寸较小。
- 使用 J-cut 或 L-cut，声音时间轴尚待最终确认。
- 使用 Cutaway 隐藏 AI 手部、口型或物理缺陷。
- 多人场景依赖群体镜头，个别人物反应不可独立调整。
- Setup 数量较少，但换焦或演员走位复杂。
- Optional Coverage 数量接近 must-have 数量。
- 使用隐藏拼接或遮挡转场，生产数据需拆分为多个素材/Clip。
- Intent 的 provisional shot size 与最终 Setup 建议不同。

## 交付检查表

冻结正式镜头前逐项确认：

- [ ] 每个关键 Beat 都有明确 Coverage Need。
- [ ] 每个 Need 都写明 required_information。
- [ ] 每个 Need 都有 must-have、safety 或 optional 优先级。
- [ ] 每项 Coverage 都有剪辑理由。
- [ ] 关键动作已记录 action overlap range。
- [ ] 对白覆盖已记录重复范围、可切点和不可切断表演。
- [ ] 独立反应有明确触发点和叙事作用。
- [ ] 关键信息 Insert 具有足够可读时长和安全构图。
- [ ] Wild Track、Room Tone、Clean Plate 或 Reference Plate 需求已标记。
- [ ] 所有 Coverage 先引用 Provisional Shot Intent。
- [ ] Intent 只冻结叙事、动作、声音和平台约束，没有过早锁死摄影参数。
- [ ] 每个 rejected Intent 的 must-have Need 都有替代。
- [ ] Camera Setup 能覆盖必拍 Intent，且不牺牲轴线、表演或信息。
- [ ] 每个 Final Shot 都写明切入和切出动机。
- [ ] 没有按固定套餐机械添加镜头。
- [ ] 生产后将重新验证 Take/Attempt、Asset 可用区间与 Timeline Clip 闭环。

---
name: script-to-shootable-storyboard
description: "将剧本、故事梗概、对白稿、已有分镜或视频生成提示转换、检查并优化为可拍、可剪、适合 Seedance、真人或混合制作的原子分镜。用于剧本转分镜、分镜可拍化、心理描写视觉化、单镜主导景别拆分、短剧钩子与节奏、台词和声音时长、人物道具连续性、Seedance Generation Task、生成风险与失败降级；默认忠实转换，未获授权不得改写剧情。"
---

# 剧本转 Seedance 可拍分镜

把输入编译成摄像机、演员、声音、剪辑和 Seedance 能执行的镜头方案。优先保证剧情保真、画面可见、动作可执行、镜头原子化、声音可定位、连续性可追踪和失败可降级。

## 先锁定任务

1. 识别输入类型：`script`、`scene_draft`、`synopsis`、`dialogue_draft`、`existing_storyboard`、`seedance_prompt` 或混合输入。
2. 建立 JobSpec；从 [project-input-template.yaml](assets/project-input-template.yaml) 起步。
3. 锁定修改权限：
   - `faithful`：默认；只拆分、画面化和最小必要补全。
   - `visual`：可增强动作、构图、道具、声音和环境反应，但不新增剧情事实。
   - `pacing`：可拆合镜头、压缩和局部调序，但不改变核心因果。
   - `story`：仅在用户明确授权和提供授权范围后改写剧情。
4. 选择 `live`、`seedance`、`hybrid` 或逐镜决策。
5. 冻结原稿、版本、来源范围、锁定事实、假设和未知项。

读取 [workflow-modes.md](references/workflow-modes.md) 处理输入分流、权限和已有分镜优化。不得把“优化分镜”自动解释为“改写剧情”。

## 最小读取路径

- 剧本转分镜：先读 [workflow-modes.md](references/workflow-modes.md)、[script-analysis.md](references/script-analysis.md)、[abstract-to-visible.md](references/abstract-to-visible.md)、[atomic-shot-rules.md](references/atomic-shot-rules.md) 和 [storyboard-template.md](assets/storyboard-template.md)。
- 已有分镜优化：先读 [workflow-modes.md](references/workflow-modes.md)、[atomic-shot-rules.md](references/atomic-shot-rules.md)、[blocking-and-continuity.md](references/blocking-and-continuity.md) 和 [existing-storyboard-repair-template.md](assets/existing-storyboard-repair-template.md)。
- Seedance 生成适配：再读 [model-registry.yaml](references/model-registry.yaml)、[prompt-compiler.md](references/prompt-compiler.md)、[generation-risk-and-repair.md](references/generation-risk-and-repair.md) 和 [generation-task-template.md](assets/generation-task-template.md)。
- 交付或审查：再读 [schema-index.md](references/schema-index.md)、相关 Schema、[quality-report-template.md](assets/quality-report-template.md)、[rights-safety-compliance.md](references/rights-safety-compliance.md) 和 [source-catalog.md](references/source-catalog.md)。

## 执行主流程

按顺序执行，不要让下游补丁掩盖上游错误：

1. 冻结来源并建立 Source Manifest、Fact Ledger 和字段级 provenance。
2. 解析 Scene、人物、地点、时间、道具、对白和声音。
3. 建立 Story Bible，锁定人物身份、关系、外观锚点、知情范围和世界规则。
4. 按行动、信息、权力关系或局势变化拆 Beat；不要按句号或台词数量拆。
5. 从原剧情提取钩子；建立“承诺—观众问题—风险—延期—兑现”契约。
6. 把心理解释、作者评价和抽象氛围改成可见或可听证据。
7. 先设计人物站位、路线、动作相位、道具和轴线，再设计摄影机。
8. 标记必须看到、必须听到和可跨镜延续的事件。
9. 建立 must-have Coverage 和临时 Shot Intent，再规划 Camera Setup。
10. 冻结原子 Shot，计算动作、对白、反应、摄影机和声音的关键路径时长。
11. 写入镜头间连续性状态。
12. 逐镜选择真人、Seedance 或混合制作，并设置备用方案和切换条件。
13. 将每个 Seedance Shot 编译为 Generation Task；默认一镜一任务，多次 Attempt。
14. 执行质量门禁；按责任阶段定向修复，最多三轮最小补丁。
15. 输出分镜表、Seedance 任务表、差异报告、质量报告和风险/降级说明。

## 强制可拍规则

每个正式 Shot 默认必须同时满足：

- 只有一个连续时空。
- 只有一个主导景别；不得在同一镜号中同时写全景、近景和特写。
- 只有一个主要视觉行动单元和一个主要叙事目的。
- 只有一个主要摄影运动；复杂运动必须有完整路径和必要性。
- 明确主体、开始状态、可见动作和结束状态。
- 动作、对白、反应和运镜能在镜头时长内完成。
- 能追溯到原文事实或明确授权。
- 上一镜 `end_state` 能承接下一镜 `start_state`。

出现以下任一情况时拆镜：

- 主导景别明显跨级。
- 出现“切到、再切至、转到另一边”等隐含剪辑。
- 机位、方向、注意力中心、时空或独立信息结果改变。
- 反应或证据需要独立读取。
- 动作链、主体数、口型、手部、物理交互或运镜负载过高。

只有用户明确需要连续长镜头且方案可执行时，才设置 `long_take_exception: true`，并写出起止构图、摄影机路径、人物路径、失败点和拆镜备用方案。

读取：

- [shot-unit-contract.md](references/shot-unit-contract.md)：对象边界、ID、关系和字段级来源。
- [atomic-shot-rules.md](references/atomic-shot-rules.md)：原子镜头、主导景别、拆镜触发器和长镜头例外。
- [editing-and-coverage.md](references/editing-and-coverage.md)：Coverage、编辑闭环和切镜理由。

## 把空话变成画面

删除不能被摄像机或麦克风记录的解释，但保留其剧情信息。优先转译为：

1. 有结果的身体动作。
2. 人物与道具的状态变化。
3. 人物距离、站位或空间关系变化。
4. 明确、可重复表演的面部或手部变化。
5. 环境的物理反应。
6. 沉默、呼吸、脚步、物件声或必要对白。

不要写：

> 她终于不再隐忍，这个冷笑不是得意。

改写为：

> 她摘下工牌，压在辞职信上，把两样东西推到经理面前。

不得用“电影感、压迫感、宿命感、高级感”替代构图、光线、动作或声音。读取 [abstract-to-visible.md](references/abstract-to-visible.md)。

## 保持人物和空间连续

建立并逐镜更新：

- 人物左右位置、面朝方向、视线目标、姿势和动作相位。
- 服装、头发、妆容、污渍、伤势和表演强度。
- 道具位置、状态、持有手和移动路径。
- 门窗、灯光、屏幕内容、天气、时间和轴线状态。
- 对白、环境声、音乐和声画桥的跨镜状态。

先读取 [script-analysis.md](references/script-analysis.md) 与 [story-bible.md](references/story-bible.md)，再读取 [blocking-and-continuity.md](references/blocking-and-continuity.md)。

## 设计短剧钩子、节奏和台词

- 首屏尽快给出可见冲突、异常、证据、风险或未完成动作。
- 钩子必须来自原剧情；需要新增剧情时升级到 `story` 并记录授权。
- 每个钩子必须有兑现、合法延期或明确撤销，不得只堆悬念。
- 爽点必须表现为权力、信息、目标或物理状态的可见变化。
- 台词必须可说、可回应、可计时；不要让人物朗读作者解释。
- 同期长对白、多人精确口型或复杂抢话优先真人拍摄或分离声音生产。

按题材和平台读取：

- [hook-and-platform-profiles.md](references/hook-and-platform-profiles.md)
- [genre-profiles.md](references/genre-profiles.md)
- [timing-and-audio.md](references/timing-and-audio.md)

## 编译 Seedance 任务

不要把官方“支持某能力”写成稳定成功保证。先读取 [model-registry.yaml](references/model-registry.yaml)，再根据实际入口、地区、账号和构建记录运行快照。

每个 Generation Task 至少包含：

- 对应 Shot、时长、画幅和模型档案。
- 角色、场景、服装、道具和参考素材 ID。
- 首帧状态、单一主导景别、分段动作时间线和尾帧目标。
- 摄影机状态或一个简单连续运动。
- 对白、环境声和音效的时间点。
- 连续性目标、负面约束、验收条件、风险分数和降级路径。

默认策略：

```text
1 Atomic Shot → 1 Generation Task → 多个 Generation Attempt
```

多人长对白、复杂手部小道具、多阶段物理交互、复杂运镜和多镜头内部剪辑均提高风险。失败时依次减少主体、缩短动作、锁定机位、拆镜、分离声音、切换模型、改真人或混合制作。

读取：

- [prompt-compiler.md](references/prompt-compiler.md)
- [generation-risk-and-repair.md](references/generation-risk-and-repair.md)
- [cost-complexity.md](references/cost-complexity.md)

## 权利、安全和来源

未知的素材权利、肖像、声音、未成年人同意、隐私、平台政策或地区限制不得被自动修复为“已通过”。把这些问题路由给人工审核。

读取 [rights-safety-compliance.md](references/rights-safety-compliance.md) 和 [source-catalog.md](references/source-catalog.md)。对快速变化的模型规格、价格和平台政策重新核验，不沿用过期结论。

## 使用模板和 Schema

优先复制而不是重建：

- [storyboard-template.md](assets/storyboard-template.md) 或 [storyboard-template.csv](assets/storyboard-template.csv)
- [existing-storyboard-repair-template.md](assets/existing-storyboard-repair-template.md)
- [generation-task-template.md](assets/generation-task-template.md)
- [quality-report-template.md](assets/quality-report-template.md)
- [rights-manifest-template.yaml](assets/rights-manifest-template.yaml)

机器输出按 [schema-index.md](references/schema-index.md) 与 `references/schemas/` 中的 JSON Schema 组织。对象关系、字段名或枚举不确定时，读取对应 Schema，不自行创造近义字段。

## 执行审查梯队

按以下顺序审查；任一阻断项退回责任阶段：

1. 结构审：对象、ID、Schema、引用和流程顺序。
2. 人设与连续性审：身份、关系、外观、站位、轴线、道具和状态。
3. 爽点与节奏审：冲突启动、信息差、钩子承诺、延期和兑现。
4. 台词审：可说性、时长、回应关系、口型和声音生产。
5. 格式审：字段、表格、模板、提示词和机器可读性。
6. 一致性审：Source → Beat → Shot → Task → Attempt/Asset → Timeline。

运行：

```powershell
node scripts/validate-all.mjs --input <project.json> --pretty --require-validators
node scripts/run-regression-tests.mjs
node scripts/build-repair-plan.mjs --report <quality-report.json> --project <project.json> --pretty
node scripts/estimate-cost.mjs --input <project.json> --pretty
```

不要自动应用修复计划。禁止自动修改锁定事实、授权、权利、隐私、同意和合规状态。

## 交付门禁

只在以下条件全部满足时声明“方案通过”：

- 锁定事实保留率 100%，未授权新增事实为 0。
- 所有抽象来源均已转为可见或可听证据，抽象语言审查无 Error/Blocker。
- 正式 Shot 原子结构通过率 100%。
- must-have Coverage、相邻镜头连续性、关键声音、台词测时、钩子与爽点因果全部闭环。
- 人物知识状态、当前目标、关系有效区间、说话方式和行为锚点无冲突。
- 分镜、提示词、连续性、模型档案和制作方式互相一致。
- 阻断级权利、安全、隐私和合规遗漏为 0。
- 所有默认值、推断、调序、压缩和授权新增均出现在差异报告中。
- 全部适用验证器的 Blocker 与 Error 均为 0。

缺少真实生成、真人走戏或剪辑装配证据时，只能声明“方案通过”，不得声明“成品发布通过”。

# 项目说明

`script-to-shootable-storyboard` 是一个面向影视预制作的 Codex Skill。它把剧本、故事梗概、对白稿、已有分镜或视频生成提示，转换为可追溯、可拍摄、可剪辑，并可进一步交给真人拍摄、Seedance 或混合制作流程执行的原子分镜。

本文面向希望快速理解项目设计、评估接入方式或进行二次开发的使用者与维护者。直接安装和调用请先阅读 [README](README.md)，完整执行规则以 [SKILL.md](SKILL.md) 为准。

## 1. 项目解决什么问题

从文字故事到可执行镜头之间通常缺少一层结构化的“制作编译”过程。例如：

- 心理活动或抽象氛围无法被摄像机直接记录；
- 一个自然语言段落可能混合多个景别、动作、时空或隐含剪辑；
- 对白、反应、运镜和声音可能无法在设定时长内完成；
- 人物站位、视线、道具、服装和环境状态容易在相邻镜头间断裂；
- AI 视频任务可能因主体过多、动作链过长或物理交互复杂而难以稳定生成；
- 未经授权的剧情补写、来源不明素材和权利风险容易混入最终交付。

本项目通过明确的数据对象、分阶段工作流、模板、JSON Schema 和验证脚本，把这些问题前置到拍摄或生成之前处理。

## 2. 适用对象

- 编剧、导演、分镜师和制片团队：把文字方案整理为可讨论、可执行的镜头计划；
- AI 视频创作者：将原子镜头编译为一镜一任务的生成任务，并预先设计验收和降级方案；
- 短剧与竖屏内容团队：检查首屏钩子、节奏、台词时长、反应镜头和段尾兑现；
- 工具开发者：复用 Schema、模板和校验器，搭建自己的剧本分析、分镜或预制作管线；
- 审核与交付人员：检查来源追溯、连续性、权利安全和发布门禁。

它不是自动改写剧情的“灵感生成器”，也不把模型能力声明当作稳定成功保证。默认策略是忠实转换、最小必要补全和风险显式化。

## 3. 核心数据流

```text
原始输入
  ↓
JobSpec（任务参数与修改权限）
  ↓
Source Manifest + Fact Ledger（来源与事实锁定）
  ↓
Story Bible + Scene + Beat Sheet（人物、场景与剧情节拍）
  ↓
Blocking + Coverage + Camera Setup（调度、剪辑覆盖与机位）
  ↓
Atomic Shot List（可拍、可剪的原子镜头）
  ↓
Production Decision（真人 / Seedance / 混合制作）
  ↓
Generation Task + Attempt（生成任务、验收与失败降级）
  ↓
Timeline + Quality Report + Release Checklist（装配、质检与交付）
```

每一层都应能追溯到上游来源。项目不允许下游提示词或生成结果反向覆盖已锁定的剧情事实。

## 4. 工作流如何运行

### 4.1 冻结输入与权限

系统首先识别输入类型、制作方式、画幅、目标时长、平台和内容限制，并在 `JobSpec` 中锁定修改权限：

| 权限 | 可做的事情 | 主要限制 |
| --- | --- | --- |
| `faithful` | 拆分、画面化、最小必要补全 | 不新增剧情事实，不改变核心因果 |
| `visual` | 增强动作、构图、道具、声音和环境反应 | 仍不得改变剧情事实 |
| `pacing` | 拆合镜头、压缩重复、局部调整信息顺序 | 必须保留核心因果并记录差异 |
| `story` | 在授权范围内进行剧情改写 | 必须有明确授权、锁定元素和内容边界 |

未指定时默认使用 `faithful`。详细规则见 [工作流模式与权限控制](references/workflow-modes.md)。

### 4.2 把文字事实转成可见证据

项目区分“原稿事实”“视觉化”“推断补全”和“授权新增”。心理解释、作者评价或抽象氛围必须被转换为摄像机或麦克风可以记录的动作、状态变化、空间关系、表演、环境反应或声音，同时保持原剧情信息不变。

相关方法见 [抽象内容视觉化](references/abstract-to-visible.md) 与 [剧本分析](references/script-analysis.md)。

### 4.3 先调度，再定镜头

在冻结正式镜头前，工作流先设计人物站位、运动路线、道具状态、视线、轴线、必须看到/听到的事件和剪辑 Coverage，再规划机位。这样可以减少“镜头看起来漂亮，但动作不可执行或剪辑不闭环”的情况。

### 4.4 冻结原子镜头

一个正式镜头默认只包含：

- 一个连续时空；
- 一个主导景别；
- 一个主要视觉行动单元；
- 一个主要叙事目的；
- 一个主要摄影运动；
- 明确的起始状态、可见动作和结束状态。

如果景别、时空、机位、注意力中心或独立信息结果发生变化，通常需要拆镜。详见 [原子镜头规则](references/atomic-shot-rules.md) 与 [镜头对象契约](references/shot-unit-contract.md)。

### 4.5 选择制作方式并编译任务

项目支持按镜头选择 `live`、`seedance` 或 `hybrid`。每个 Seedance 镜头默认编译为一个 Generation Task，并允许多个 Attempt。任务需要包含首尾帧状态、动作时间线、参考素材、摄影机、声音、连续性目标、负面约束、验收条件、风险分数和降级路径。

生成失败时优先降低复杂度：减少主体、缩短动作、锁定机位、拆镜、分离声音、切换模型，或改用真人/混合制作，而不是悄悄删除关键剧情。

## 5. 仓库组成

| 路径 | 作用 |
| --- | --- |
| `SKILL.md` | Codex Skill 主入口、执行顺序和强制规则 |
| `agents/openai.yaml` | Codex 界面名称、简介和默认调用提示 |
| `assets/` | 项目输入、分镜、生成任务、质量报告和权利清单模板 |
| `references/` | 剧本分析、调度、连续性、声音、生成风险和权利安全方法论 |
| `references/schemas/` | 各阶段结构化产物的 JSON Schema |
| `scripts/` | 结构检查、项目验证、风险评分、成本估算、修复计划和回归测试 |

产物、Schema、验证器和模板之间的对应关系可在 [Schema 索引](references/schema-index.md) 中查询。

## 6. 输入与交付物

### 支持的输入

- 完整剧本或场景稿；
- 故事梗概；
- 以对白为主的初稿；
- 已有镜号、景别或动作描述的分镜；
- Seedance 或其他视频生成提示；
- 上述内容的混合输入。

### 典型交付物

- JobSpec、来源清单和事实台账；
- Story Bible、Scene 与 Beat Sheet；
- Blocking、Camera Setup、Coverage Matrix；
- Markdown、CSV 或结构化 JSON 分镜；
- Seedance Generation Task 与 Attempt 记录；
- 连续性台账、时间线、成本估算和风险说明；
- 差异报告、质量报告与发布检查清单。

实际交付范围由任务目标决定，不要求每次都生成全部对象。

## 7. 验证与质量门禁

项目脚本只依赖 Node.js 内置模块。常用检查如下：

```powershell
# 检查 Skill 目录结构和内部链接
node scripts/check-skill-structure.mjs

# 运行回归测试
node scripts/run-regression-tests.mjs

# 对项目数据执行聚合验证
node scripts/validate-all.mjs --input <project.json> --pretty --require-validators

# 根据质量报告生成最小修复建议
node scripts/build-repair-plan.mjs --report <quality-report.json> --project <project.json> --pretty

# 估算制作成本与失败成本
node scripts/estimate-cost.mjs --input <project.json> --pretty
```

验证器覆盖结构、来源、抽象语言、镜头原子性、调度、机位、Coverage、连续性、时间、声音、模型适配、提示词对齐、权利安全和时间线等方面。修复计划只提供建议，不会自动改动锁定事实或授权状态。

## 8. 设计边界

- 项目输出属于预制作方案；缺少真实生成、真人走戏或剪辑装配证据时，不能声明成品已达到发布标准。
- 模型规格、价格、地区可用性和平台政策会变化，制作前应重新核验。
- 素材权利、肖像、声音、隐私、未成年人同意和平台合规等未知状态必须交由人工审核。
- Schema 验证通过只代表结构和已编码规则通过，不替代导演、制片、法务或安全团队的专业判断。
- `story` 权限必须由用户明确授予；技术困难不能成为自动改变剧情的理由。

## 9. 二次开发建议

扩展新的产物或规则时，建议保持以下对应关系：

```text
方法说明
  ↔ 模板
  ↔ JSON Schema
  ↔ 验证器
  ↔ 测试夹具与回归测试
```

新增字段时先确认它属于哪个阶段、由谁产生、引用哪些上游 ID、由哪个验证器负责，以及失败后应退回哪个责任阶段。不要创建与现有字段含义相近但命名不同的平行结构。

提交变更前至少运行结构检查和回归测试；若修改 Schema、模板或验证逻辑，还应使用有效与无效测试夹具验证通过和失败路径。

## 10. 延伸阅读

- [README](README.md)：安装、快速开始和常用命令；
- [SKILL.md](SKILL.md)：完整执行规范；
- [工作流模式](references/workflow-modes.md)：输入分流与修改权限；
- [调度与连续性](references/blocking-and-continuity.md)：站位、轴线、道具和状态管理；
- [剪辑与 Coverage](references/editing-and-coverage.md)：镜头覆盖与剪辑闭环；
- [提示词编译](references/prompt-compiler.md)：从镜头到生成任务；
- [生成风险与修复](references/generation-risk-and-repair.md)：风险评分和降级路径；
- [权利、安全与合规](references/rights-safety-compliance.md)：人工审核门禁。

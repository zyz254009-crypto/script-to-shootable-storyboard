# Script to Shootable Storyboard

将剧本、故事梗概、对白稿、已有分镜或视频生成提示，转换为忠实、可拍、可剪，并适合 Seedance、真人或混合制作的原子分镜。

这个项目以 Codex Skill 的形式提供一套完整的影视预制作工作流：从来源冻结、剧情分析和心理描写视觉化，到镜头拆分、场面调度、连续性管理、声音计时、生成任务编译、风险评分和交付检查。项目同时包含可复用模板、JSON Schema、命令行验证器与回归测试。

## 核心能力

- 忠实转换：默认只进行拆分、画面化和最小必要补全，未经授权不改写剧情。
- 原子镜头：约束每个镜头的连续时空、主导景别、主要动作和摄影运动。
- 可拍与可剪：检查动作、对白、反应、运镜、声音、Coverage 和镜头时长是否闭环。
- 连续性管理：追踪人物站位、视线、轴线、服装、道具、环境与声画状态。
- Seedance 适配：将镜头编译为一镜一任务的 Generation Task，并配置验收条件和失败降级路径。
- 真人/生成/混合制作：支持逐镜选择制作方式，并管理混合制作交接要求。
- 权利与安全：对素材来源、肖像、声音、隐私、同意和平台合规设置人工审核门禁。
- 机器可验证：提供 40 余个 JSON Schema、多组验证器、成本估算和修复计划工具。

## 适用场景

- 剧本或故事梗概转专业分镜
- 已有分镜的可拍化、原子化与连续性修复
- 心理描写、抽象氛围和作者评价的视觉化
- 竖屏短剧的首屏钩子、节奏、爽点与台词时长设计
- Seedance 视频生成任务拆解与提示词编译
- 真人拍摄、AI 生成和混合制作的前期规划
- 分镜方案的结构、时长、版权、安全与交付质量审查

## 工作流程

```text
输入冻结
  → 剧情与人物分析
  → Story Bible / Beat Sheet
  → 抽象内容视觉化
  → Blocking 与 Coverage
  → 原子 Shot
  → 真人 / Seedance / 混合制作决策
  → Generation Task
  → 质量验证与风险降级
  → 分镜表、任务表和质量报告
```

## 安装

需要 Git 和 Node.js 18 或更高版本。项目脚本只使用 Node.js 内置模块，无需安装 npm 依赖。

将项目克隆到 Codex Skills 目录：

```powershell
git clone https://github.com/zyz254009-crypto/script-to-shootable-storyboard.git "$env:USERPROFILE\.codex\skills\script-to-shootable-storyboard"
```

重新打开 Codex 任务后，可通过 `$script-to-shootable-storyboard` 调用。

## 快速开始

1. 复制 [项目输入模板](assets/project-input-template.yaml)，填写原稿类型、制作方式、画幅、时长、修改权限和来源信息。
2. 在 Codex 中附上剧本或已有分镜，并使用类似提示：

   ```text
   使用 $script-to-shootable-storyboard，把这份剧本转换为忠实、可拍、可剪的原子镜头与 Seedance 生成任务。
   ```

3. 根据交付目标选用项目模板：

   - [Markdown 分镜模板](assets/storyboard-template.md)
   - [CSV 分镜模板](assets/storyboard-template.csv)
   - [已有分镜修复模板](assets/existing-storyboard-repair-template.md)
   - [Seedance 生成任务模板](assets/generation-task-template.md)
   - [质量报告模板](assets/quality-report-template.md)

4. 使用验证器检查生成的项目数据：

   ```powershell
   node scripts/validate-all.mjs --input <project.json> --pretty --require-validators
   ```

## 常用命令

```powershell
# 检查 Skill 目录结构和内部链接
node scripts/check-skill-structure.mjs

# 运行完整回归测试
node scripts/run-regression-tests.mjs

# 验证项目数据
node scripts/validate-all.mjs --input <project.json> --pretty --require-validators

# 根据质量报告生成最小修复计划（不会自动修改项目）
node scripts/build-repair-plan.mjs --report <quality-report.json> --project <project.json> --pretty

# 估算制作成本与失败成本
node scripts/estimate-cost.mjs --input <project.json> --pretty
```

## 目录结构

```text
.
├── SKILL.md                    # Skill 主入口与完整工作流
├── agents/openai.yaml          # Codex 界面元数据
├── assets/                     # 输入、分镜、任务和报告模板
├── references/                 # 方法论、规则、模型档案和制作规范
│   └── schemas/                # 机器可读的 JSON Schema
└── scripts/                    # 验证、测试、风险评分、成本和修复工具
```

## 设计原则

- 剧情事实必须可追溯到原稿或明确授权。
- 摄像机和麦克风无法记录的解释，必须转换为可见或可听证据。
- 一个原子镜头默认对应一个 Generation Task，并允许多次生成尝试。
- 生成失败时优先降低复杂度，而不是偷偷改变剧情。
- 未知的权利、隐私、同意和合规状态必须交给人工审核。

## 验证状态

当前版本已通过：

- Skill 结构与内部链接检查
- 102 项回归测试
- 全部 JavaScript 文件语法检查

## 贡献

欢迎提交 Issue 或 Pull Request。提交前请运行结构检查和回归测试，并确保新增 Schema、模板、引用文档和验证规则之间保持一致。

## 许可证

本项目采用 [MIT License](LICENSE) 开源。

> 本项目中的权利、安全与合规检查用于辅助制作决策，不构成法律意见。模型能力、价格和平台政策可能变化，实际制作前请重新核验。

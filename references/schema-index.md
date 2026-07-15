# Schema 索引

用于快速定位产物、Schema、校验器和模板。字段细节以 `references/schemas/*.schema.json` 为准。

| 产物 | Schema | 主要校验器 | 模板/参考 |
|---|---|---|---|
| JobSpec | `job-spec.schema.json` | `validate-schema.mjs`, `validate-all.mjs` | `assets/project-input-template.yaml`, `workflow-modes.md` |
| Source Manifest | `source-manifest.schema.json` | `validate-schema.mjs`, `validate-source-trace.mjs` | `script-analysis.md` |
| Fact Ledger | `fact-ledger.schema.json` | `validate-schema.mjs`, `validate-source-trace.mjs` | `script-analysis.md`, `shot-unit-contract.md` |
| Story Bible | `story-bible.schema.json` | `validate-schema.mjs`, `validate-continuity.mjs` | `story-bible.md` |
| Scene / Beat Sheet | `scene.schema.json`, `beat-sheet.schema.json` | `validate-schema.mjs`, `review-abstract-language.mjs`, `validate-hook-contract.mjs` | `script-analysis.md`, `abstract-to-visible.md` |
| Hook Contract | `hook-contract.schema.json` | `validate-hook-contract.mjs` | `hook-and-platform-profiles.md`, `genre-profiles.md` |
| Blocking / Camera Setup | `blocking-plan.schema.json`, `camera-setup.schema.json` | `validate-blocking.mjs`, `validate-camera-setup.mjs` | `blocking-and-continuity.md` |
| Shot List | `shot-list.schema.json` | `validate-atomic-shots.mjs`, `validate-timing.mjs`, `validate-coverage.mjs`, `validate-continuity.mjs` | `assets/storyboard-template.md`, `assets/storyboard-template.csv` |
| Existing Storyboard Repair | `shot-list.schema.json`, `difference-report.schema.json` | `validate-atomic-shots.mjs`, `validate-source-trace.mjs` | `assets/existing-storyboard-repair-template.md`, `workflow-modes.md` |
| Audio / Dialogue | `audio-event.schema.json`, `dialogue-block.schema.json` | `validate-audio-pipeline.mjs`, `validate-timing.mjs` | `timing-and-audio.md` |
| Generation Task / Attempt | `generation-task.schema.json`, `generation-attempt.schema.json` | `validate-model-capabilities.mjs`, `validate-prompt-alignment.mjs`, `score-generation-risk.mjs` | `assets/generation-task-template.md`, `prompt-compiler.md`, `model-registry.yaml` |
| Timeline / Media | `timeline.schema.json`, `media-asset.schema.json` | `validate-timeline.mjs` | `editing-and-coverage.md` |
| Rights / Safety | `rights-manifest.schema.json`, `safety-risk-register.schema.json` | `validate-rights-safety.mjs` | `assets/rights-manifest-template.yaml`, `rights-safety-compliance.md` |
| Quality / Release | `quality-report.schema.json`, `release-checklist.schema.json` | `validate-all.mjs`, `check-skill-structure.mjs` | `assets/quality-report-template.md` |
| Repair Plan | `repair-patch.schema.json` | `build-repair-plan.mjs` | `generation-risk-and-repair.md` |

运行时 `validation-aggregate` 不是正式 `quality-report.schema.json` 对象；正式交付时必须转写为质量报告。

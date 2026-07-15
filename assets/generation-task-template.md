# Seedance 生成任务模板

本模板对应 `generation-task.schema.json`。Generation Task 是模型请求计划，不等于 Shot、Attempt、Media Asset 或 Timeline Clip。

## 字段说明

| 字段 | 中文说明 |
|---|---|
| `shot_ids / task_mode` | 关联分镜及原子、分段或多镜头例外模式 |
| `model_profile` | 固定供应商入口、地区、模型构建、能力核验时间和注册表版本 |
| `reference_assets` | 仅引用已登记且权利可用的图像、视频和音频资产 |
| `first_frame / last_frame_target` | 生成首尾构图与连续性目标 |
| `subject_lock` | 人物身份锚点、参考素材和不可漂移属性 |
| `timeline_prompt` | 按局部秒数排列的可见动作、摄影和声音要求 |
| `negative_constraints` | 只写当前镜头高概率且会破坏结果的错误 |
| `risk_assessment` | 0–100 总风险及 0–5 分项风险 |
| `fallback_plan` | 按失败类别进入重试、拆镜、实拍或合成的出口 |

## 最小示例

```yaml
schema_version: 1.0.0
created_at: "2026-06-25T09:20:00+08:00"
created_by_stage: seedance-compile
source_hash: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
generation_task_id: GT-DEMO-001
job_id: JOB-DEMO-001
shot_ids:
  - SHOT-DEMO-001
task_mode: atomic_shot

model_profile:
  model_profile_id: BYTEDANCE-SEEDANCE-2-0-DEMO
  registry_version: 1.0.0
  model_profile_hash: "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
  provider: ByteDance
  product_entry: Seedance 2.0 项目实际使用入口
  account_region: CN
  model_build_or_revision: account-visible-revision-demo
  capability_verified_at: "2026-06-25T08:00:00+08:00"
  capability_status: verified

duration_seconds: 7
aspect_ratio: "9:16"

reference_assets:
  images:
    - asset_id: ASSET-CHAR-LINXIA-REF-001
      purpose: character_identity
      priority: required
    - asset_id: ASSET-ROOM-REF-001
      purpose: location
      priority: preferred
  videos: []
  audio: []

first_frame:
  description: 竖屏近景；林夏位于画面右侧，右手握黑色录音笔，手停在桌沿上方。
  reference_asset_id: ASSET-CHAR-LINXIA-REF-001
  composition_hash: "1111111111111111111111111111111111111111111111111111111111111111"
  continuity_state_hash: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"

last_frame_target:
  description: 录音笔停在桌面中央；林夏右手离开录音笔并抬眼直视经理。
  composition_hash: "2222222222222222222222222222222222222222222222222222222222222222"
  continuity_state_hash: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"

subject_lock:
  - subject_id: CHAR-LINXIA-001
    identity_anchor: 齐肩黑发、灰色西装、白衬衫；人物外观与已批准参考图一致。
    reference_asset_ids:
      - ASSET-CHAR-LINXIA-REF-001
    locked_attributes:
      - 齐肩黑发
      - 灰色西装
      - 白衬衫
      - 录音笔起始时位于右手

environment:
  location_id: LOCATION-MEETINGROOM-001
  time_of_day: 夜间
  physical_description: 现代会议室，长桌位于中央，玻璃门在左后方。
  lighting: 冷白顶灯，人物脸部曝光稳定。
  weather_or_atmosphere: 室内安静，无烟雾和天气效果。
  environment_reference_asset_ids:
    - ASSET-ROOM-REF-001

timeline_prompt:
  - segment_id: SEG-GT001-001
    start_seconds: 0
    end_seconds: 3.5
    shot_id: SHOT-DEMO-001
    visual_instruction: 林夏把右手中的黑色录音笔平稳放到桌面中央并松手；录音笔不变形、不换手。
    camera_instruction: 固定眼平近景，画面不切换，主导景别保持近景。
    audio_event_ids:
      - AUDIO-DEMO-RECORDER-TAP-001
    required_end_state: 录音笔停在桌面中央，林夏右手完全松开。
  - segment_id: SEG-GT001-002
    start_seconds: 3.5
    end_seconds: 5
    shot_id: SHOT-DEMO-001
    visual_instruction: 林夏抬眼看向画面左侧的经理，肩膀与身体保持稳定。
    camera_instruction: 机位和构图不变，不推进，不摇移。
    audio_event_ids: []
    required_end_state: 林夏直视经理，录音笔保持在桌面中央。

audio_requirements:
  mode: post_only
  audio_event_ids:
    - AUDIO-DEMO-RECORDER-TAP-001
  post_dub_fallback: true
  lip_sync_character_ids: []
  language_profile_id: LANG-ZH-CN-001

negative_constraints:
  - category: prop
    instruction: 不交换录音笔所在手，不增加第二支录音笔，不让录音笔变形。
    severity: blocking
  - category: camera
    instruction: 不产生额外切镜，不改变主导近景，不移动摄影机。
    severity: blocking
  - category: text
    instruction: 画面内不生成字幕、标志、水印或新增可读文字。
    severity: major

continuity_targets:
  continuity_entry_ids:
    - CONT-DEMO-START-001
    - CONT-DEMO-END-001
  required_start_state_hash: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
  required_end_state_hash: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"
  locked_character_ids:
    - CHAR-LINXIA-001
  locked_prop_ids:
    - PROP-RECORDER-001
  locked_environment_state_ids:
    - ENVSTATE-ROOM-NIGHT-001

risk_assessment:
  overall_score: 32
  risk_level: medium
  identity_risk: 1
  hand_prop_risk: 3
  lip_sync_risk: 0
  camera_motion_risk: 0
  spatial_risk: 1
  physics_risk: 2
  composition_drift_risk: 1
  multi_shot_boundary_risk: 1
  audio_risk: 1
  risk_rule_version: 1.0.0

fallback_plan:
  - order: 1
    failure_category: hand_or_prop
    action: 强化右手和录音笔首帧参考，缩短放置动作，并固定摄影机。
    next_method: retry_seedance
    required_asset_ids:
      - ASSET-CHAR-LINXIA-REF-001
    maximum_attempts_before_switch: 3
  - order: 2
    failure_category: hand_or_prop
    action: 将镜头改为真人固定机位拍摄，保留同一首尾状态。
    next_method: live_action
    required_asset_ids: []
    maximum_attempts_before_switch: 1

authorization_ids:
  - AUTH-USER-BRIEF-001

field_provenance:
  /timeline_prompt/0/visual_instruction:
    - provenance_id: PROV-GT-ACTION-001
      fact_ids:
        - FACT-DEMO-ACTION-001
      transformation_type: visualized
      derived_by_stage: seedance-compile
      confidence: 1.0
```

# 可拍分镜模板

本模板对应 `shot-list.schema.json`。一个 Shot 默认只保留一个主导景别、连续时空、主要动作和叙事目的；长镜头必须显式声明例外。

## 字段说明

| 字段 | 中文说明 |
|---|---|
| `shot_id / sequence` | 镜头唯一编号与成片顺序 |
| `scene_id / beat_ids / fact_ids` | 场景、剧情节拍及锁定事实来源 |
| `source_spans / authorization_ids` | 原文范围或授权新增依据，至少提供一类 |
| `coverage_role / coverage_priority` | 剪辑覆盖角色与必拍等级 |
| `edit_duration_seconds` | 最终预计使用时长 |
| `capture_or_generation_duration_seconds` | 实拍或生成请求时长，包含余量 |
| `dominant_shot_size` | 单一主导景别 |
| `start_composition / end_composition` | 起止构图与主体屏幕位置 |
| `long_take_exception_*` | 长镜头例外理由、连续路径和拆镜备用；普通原子镜头留空 |
| `start_state / end_state` | 可供前后镜承接的状态快照 |
| `visible_action` | 摄像机可记录的主要动作，不写心理解释 |
| `timing.events` | 动作、对白、反应、摄影和声音的可重叠时间事件 |
| `production_decision` | 真人、Seedance、混合或合成的逐镜决策 |
| `field_provenance` | 关键字段到原文事实或授权的逐字段追踪 |

CSV 是 Shot 对象的无损扁平映射：数组与对象统一使用单行 JSON，`source_spans_json`、`camera_motion_json`、`production_decision_json` 与 `long_take_exception_reason / continuous_camera_path / long_take_fallback_plan` 必须能还原为 Schema 中的完整对象，包括 `required_handoff_asset_ids`。不得把多条镜头塞进一个 CSV 单元格。

## 最小示例

```yaml
schema_version: 1.0.0
created_at: "2026-06-25T09:10:00+08:00"
created_by_stage: atomic-shot-design
source_hash: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
shot_list_id: SHOTLIST-DEMO-001
job_id: JOB-DEMO-001
scene_ids:
  - SCENE-DEMO-001

shots:
  - shot_id: SHOT-DEMO-001
    sequence: 1
    scene_id: SCENE-DEMO-001
    beat_ids:
      - BEAT-DEMO-001
    source_spans:
      - source_document_id: SOURCE-SCRIPT-DEMO-001
        source_revision: r1
        stable_span:
          span_id: SPAN-DEMO-001
          line_start: 12
          line_end: 13
    authorization_ids: []
    fact_ids:
      - FACT-DEMO-ACTION-001

    camera_setup_id: CAMERA-SETUP-DEMO-001
    blocking_plan_id: BLOCKING-DEMO-001
    coverage_need_ids:
      - COVERAGE-DEMO-REACTION-001
    coverage_role: reaction
    coverage_priority: must_have

    edit_duration_seconds: 5
    capture_or_generation_duration_seconds: 7
    head_handle_seconds: 1
    tail_handle_seconds: 1

    dominant_shot_size: close_up
    start_composition:
      shot_size: close_up
      subject_ids:
        - CHAR-LINXIA-001
      framing: 林夏位于画面右侧，肩部以上入画，视线朝画面左侧。
      screen_regions:
        - subject_id: CHAR-LINXIA-001
          anchor:
            x: 0.68
            y: 0.48
          depth_plane: midground
      headroom: standard
      look_room_direction: screen_left
    end_composition:
      shot_size: close_up
      subject_ids:
        - CHAR-LINXIA-001
      framing: 构图不变，林夏松开右手后抬眼直视经理。
      screen_regions:
        - subject_id: CHAR-LINXIA-001
          anchor:
            x: 0.68
            y: 0.48
          depth_plane: midground
      headroom: standard
      look_room_direction: screen_left
    allowed_composition_drift: same_size_minor
    long_take_exception: false

    camera_angle: eye_level
    camera_position: 长桌右侧，位于既定轴线同侧，镜头朝向林夏。
    camera_motion:
      motion_type: locked
      path: 三脚架固定机位，全程不移动。
      complexity: none
      stabilization: tripod

    primary_subject_id: CHAR-LINXIA-001
    supporting_subject_ids: []
    start_state:
      summary: 林夏右手握黑色录音笔，手停在桌沿上方，视线落在经理身上。
      continuity_entry_id: CONT-DEMO-START-001
      state_hash: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
      character_state_ids:
        - CHARSTATE-LINXIA-START-001
      prop_state_ids:
        - PROPSTATE-RECORDER-HAND-001
      environment_state_ids:
        - ENVSTATE-ROOM-NIGHT-001
    visible_action: 林夏把右手中的黑色录音笔放到桌面中央，松手，随后抬眼看向经理。
    end_state:
      summary: 录音笔停在桌面中央；林夏右手离开录音笔并直视经理。
      continuity_entry_id: CONT-DEMO-END-001
      state_hash: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"
      character_state_ids:
        - CHARSTATE-LINXIA-END-001
      prop_state_ids:
        - PROPSTATE-RECORDER-TABLE-001
      environment_state_ids:
        - ENVSTATE-ROOM-NIGHT-001

    dialogue_block_ids: []
    audio_event_ids:
      - AUDIO-DEMO-RECORDER-TAP-001
    prop_ids:
      - PROP-RECORDER-001

    timing:
      timebase_rate:
        frames_per_second: 25
        drop_frame: false
      timeline_origin_seconds: 0
      events:
        - event_id: EV-SH001-ACTION
          event_type: action
          timebase: shot_local
          start_seconds: 0.5
          end_seconds: 3.5
          may_overlap: true
          dependencies: []
          description: 林夏把录音笔放到桌面中央并松手。
          critical: true
        - event_id: EV-SH001-REACTION
          event_type: reaction
          timebase: shot_local
          start_seconds: 3.5
          end_seconds: 4.5
          may_overlap: false
          dependencies:
            - event_id: EV-SH001-ACTION
              relation: finish_to_start
              minimum_gap_seconds: 0
          description: 林夏抬眼直视经理。
          critical: true
      critical_path_event_ids:
        - EV-SH001-ACTION
        - EV-SH001-REACTION
      critical_path_duration_seconds: 4
      calculation_status: computed
      calculation_rule_version: 1.0.0

    continuity_in_entry_ids:
      - CONT-DEMO-START-001
    continuity_out_entry_ids:
      - CONT-DEMO-END-001
    narrative_purpose: 用录音笔落桌的动作把关键证据推入冲突中心。

    production_decision:
      primary_method: seedance
      fallback_method: live
      switch_conditions:
        - 连续三次生成仍出现手部与录音笔接触错误。
      required_handoff_asset_ids:
        - ASSET-CHAR-LINXIA-REF-001
      decision_reason: 单人固定机位动作适合原子生成；保留真人拍摄降级出口。
    generation_risk_score: 32

    platform_profile_id: PLATFORM-VERTICAL-DEMO-001
    safe_zone_id: SAFEZONE-VERTICAL-DEMO-001
    subtitle_zone_id: SUBZONE-VERTICAL-DEMO-001
    ui_occlusion_zone_ids:
      - UIZONE-RIGHT-DEMO-001

    field_provenance:
      /visible_action:
        - provenance_id: PROV-SHOT-ACTION-001
          fact_ids:
            - FACT-DEMO-ACTION-001
          transformation_type: visualized
          derived_by_stage: atomic-shot-design
          confidence: 1.0

field_provenance:
  /shots:
    - provenance_id: PROV-SHOTLIST-001
      fact_ids:
        - FACT-DEMO-ACTION-001
      transformation_type: visualized
      derived_by_stage: atomic-shot-design
      confidence: 1.0
```

#!/usr/bin/env node
import { artifactId, directExecution, findObjectsWithKey, isArtifactCandidate, issue, makeReport, runValidatorCli } from "./lib/core.mjs";

const VALIDATOR = "validate-timeline";
const HELP = "Usage: node validate-timeline.mjs <project.json>\nValidate source ranges, timeline ranges, handles, and clip status.";

export async function validateTimeline(project, { inputPath } = {}) {
  const issues = [];
  for (const { value: clip, pointer } of findObjectsWithKey(project, "timeline_clip_id")) {
    if (!isArtifactCandidate(clip, "timeline-clip.schema.json", pointer)) continue;
    const id = artifactId(clip);
    if (!(clip.source_out_seconds > clip.source_in_seconds)) issues.push(issue({ severity: "error", rule_id: "TIMELINE-001", artifact_id: id, field_path: pointer, evidence: "Source out must be greater than source in.", repair_owner: "editor" }));
    if (!(clip.timeline_out_seconds > clip.timeline_in_seconds)) issues.push(issue({ severity: "error", rule_id: "TIMELINE-002", artifact_id: id, field_path: pointer, evidence: "Timeline out must be greater than timeline in.", repair_owner: "editor" }));
    if ((clip.head_handle_seconds ?? 0) < 0 || (clip.tail_handle_seconds ?? 0) < 0) issues.push(issue({ severity: "error", rule_id: "TIMELINE-003", artifact_id: id, field_path: pointer, evidence: "Handles cannot be negative.", repair_owner: "editor" }));
    if (clip.track?.track_type === "audio" && !(clip.audio_event_ids?.length > 0)) issues.push(issue({ severity: "error", rule_id: "TIMELINE-004", artifact_id: id, field_path: `${pointer}/audio_event_ids`, evidence: "Audio clip is not linked to an audio event.", repair_owner: "sound-editor" }));
    if (clip.status === "approved" && !(clip.shot_ids?.length > 0)) issues.push(issue({ severity: "blocker", rule_id: "TIMELINE-005", artifact_id: id, field_path: `${pointer}/shot_ids`, evidence: "Approved clip has no shot linkage.", repair_owner: "editorial-review" }));
  }
  return makeReport({ validator: VALIDATOR, inputPath, issues });
}
if (directExecution(import.meta.url)) await runValidatorCli({ validator: VALIDATOR, validate: validateTimeline, help: HELP });

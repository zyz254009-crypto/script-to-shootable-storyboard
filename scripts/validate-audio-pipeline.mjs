#!/usr/bin/env node
import { artifactId, directExecution, findObjectsWithKey, issue, makeReport, runValidatorCli } from "./lib/core.mjs";

const VALIDATOR = "validate-audio-pipeline";
const HELP = "Usage: node validate-audio-pipeline.mjs <project.json>\nValidate event-to-attempt-to-asset-to-timeline audio closure.";

export async function validateAudioPipeline(project, { inputPath } = {}) {
  const issues = [];
  for (const { value: production, pointer } of findObjectsWithKey(project, "audio_production_id")) {
    const id = artifactId(production);
    if (["selected", "placed", "approved"].includes(production.status) && !(production.selected_media_asset_ids?.length > 0)) issues.push(issue({ severity: "error", rule_id: "AUDIO-001", artifact_id: id, field_path: `${pointer}/selected_media_asset_ids`, evidence: "Selected audio production has no selected media asset.", repair_owner: "sound-editor" }));
    if (["placed", "approved"].includes(production.status) && !(production.timeline_clip_ids?.length > 0)) issues.push(issue({ severity: "blocker", rule_id: "AUDIO-002", artifact_id: id, field_path: `${pointer}/timeline_clip_ids`, evidence: "Placed audio production has no timeline clip.", repair_owner: "sound-editor" }));
    const closures = production.event_closures ?? [];
    for (const eventId of production.audio_event_ids ?? []) {
      const closure = closures.find((x) => x.audio_event_id === eventId);
      if (!closure || (production.status === "approved" && closure.closure_status !== "complete")) issues.push(issue({ severity: production.status === "approved" ? "blocker" : "warning", rule_id: "AUDIO-003", artifact_id: id, field_path: `${pointer}/event_closures`, evidence: `Audio event ${eventId} is not fully closed.`, repair_owner: "sound-editor" }));
    }
  }
  return makeReport({ validator: VALIDATOR, inputPath, issues });
}
if (directExecution(import.meta.url)) await runValidatorCli({ validator: VALIDATOR, validate: validateAudioPipeline, help: HELP });

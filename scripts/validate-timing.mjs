#!/usr/bin/env node

import {
  artifactId,
  directExecution,
  exitCodeForIssues,
  findObjectsWithKey,
  issue,
  joinPointer,
  joinPointerPath,
  makeReport,
  runValidatorCli,
} from "./lib/core.mjs";

const VALIDATOR = "validate-timing";
const EPSILON = 1e-6;

function eventDuration(event) {
  return Number(event.end_seconds) - Number(event.start_seconds);
}

function dependencyThreshold(dependency, predecessor, current) {
  const gap = Number(dependency.minimum_gap_seconds ?? 0);
  switch (dependency.relation) {
    case "finish_to_start":
      return Number(predecessor.end_seconds) + gap;
    case "start_to_start":
      return Number(predecessor.start_seconds) + gap;
    case "finish_to_finish":
      return Number(predecessor.end_seconds) + gap;
    case "start_to_finish":
      return Number(predecessor.start_seconds) + gap;
    default:
      return Number.NaN;
  }
}

function dependencyActual(dependency, current) {
  switch (dependency.relation) {
    case "finish_to_start":
    case "start_to_start":
      return Number(current.start_seconds);
    case "finish_to_finish":
    case "start_to_finish":
      return Number(current.end_seconds);
    default:
      return Number.NaN;
  }
}

function earliestStartConstraint(
  dependency,
  predecessorStart,
  predecessorDuration,
  currentDuration,
) {
  const gap = Number(dependency.minimum_gap_seconds ?? 0);
  const predecessorEnd = predecessorStart + predecessorDuration;
  switch (dependency.relation) {
    case "finish_to_start":
      return predecessorEnd + gap;
    case "start_to_start":
      return predecessorStart + gap;
    case "finish_to_finish":
      return predecessorEnd + gap - currentDuration;
    case "start_to_finish":
      return predecessorStart + gap - currentDuration;
    default:
      return Number.NaN;
  }
}

export function computeCriticalPath(events) {
  const byId = new Map(events.map((event) => [event.event_id, event]));
  const indegree = new Map(events.map((event) => [event.event_id, 0]));
  const outgoing = new Map(events.map((event) => [event.event_id, []]));

  for (const event of events) {
    for (const dependency of event.dependencies ?? []) {
      if (!byId.has(dependency.event_id)) continue;
      outgoing.get(dependency.event_id).push(event.event_id);
      indegree.set(event.event_id, indegree.get(event.event_id) + 1);
    }
  }

  const queue = [...indegree.entries()]
    .filter(([, degree]) => degree === 0)
    .map(([id]) => id);
  const order = [];
  while (queue.length > 0) {
    const id = queue.shift();
    order.push(id);
    for (const next of outgoing.get(id) ?? []) {
      indegree.set(next, indegree.get(next) - 1);
      if (indegree.get(next) === 0) queue.push(next);
    }
  }

  if (order.length !== events.length) {
    return {
      hasCycle: true,
      cycleEventIds: [...indegree.entries()]
        .filter(([, degree]) => degree > 0)
        .map(([id]) => id),
      duration: Number.NaN,
      eventIds: [],
      earliestStarts: new Map(),
    };
  }

  const earliestStarts = new Map();
  const parent = new Map();
  for (const id of order) {
    const current = byId.get(id);
    const currentDuration = eventDuration(current);
    let earliest = 0;
    let criticalParent = null;
    for (const dependency of current.dependencies ?? []) {
      const predecessor = byId.get(dependency.event_id);
      if (!predecessor) continue;
      const candidate = earliestStartConstraint(
        dependency,
        earliestStarts.get(predecessor.event_id) ?? 0,
        eventDuration(predecessor),
        currentDuration,
      );
      if (Number.isFinite(candidate) && candidate > earliest) {
        earliest = candidate;
        criticalParent = predecessor.event_id;
      }
    }
    earliestStarts.set(id, Math.max(0, earliest));
    parent.set(id, criticalParent);
  }

  let lastId = null;
  let duration = 0;
  for (const event of events) {
    const end = (earliestStarts.get(event.event_id) ?? 0) + eventDuration(event);
    if (end > duration) {
      duration = end;
      lastId = event.event_id;
    }
  }
  const eventIds = [];
  while (lastId) {
    eventIds.unshift(lastId);
    lastId = parent.get(lastId);
  }
  return {
    hasCycle: false,
    cycleEventIds: [],
    duration,
    eventIds,
    earliestStarts,
  };
}

function validateEventBasics(events, pointer, artifact, issues) {
  const byId = new Map();
  events.forEach((event, index) => {
    const eventPath = joinPointer(pointer, index);
    if (!event || typeof event !== "object") {
      issues.push(
        issue({
          severity: "error",
          rule_id: "TIMING-EVENT-001",
          artifact_id: artifact,
          field_path: eventPath,
          evidence: "Timed event must be an object.",
          repair_owner: "timing-editor",
          autofix_allowed: false,
        }),
      );
      return;
    }
    if (typeof event.event_id !== "string" || !event.event_id) {
      issues.push(
        issue({
          severity: "error",
          rule_id: "TIMING-EVENT-002",
          artifact_id: artifact,
          field_path: joinPointer(eventPath, "event_id"),
          evidence: "Timed event requires a non-empty event_id.",
          repair_owner: "timing-editor",
          autofix_allowed: false,
        }),
      );
    } else if (byId.has(event.event_id)) {
      issues.push(
        issue({
          severity: "error",
          rule_id: "TIMING-EVENT-003",
          artifact_id: artifact,
          field_path: joinPointer(eventPath, "event_id"),
          evidence: `Duplicate timed event ID ${event.event_id}.`,
          repair_owner: "timing-editor",
          autofix_allowed: false,
        }),
      );
    } else {
      byId.set(event.event_id, { event, index });
    }
    if (
      !Number.isFinite(event.start_seconds) ||
      !Number.isFinite(event.end_seconds) ||
      event.end_seconds <= event.start_seconds
    ) {
      issues.push(
        issue({
          severity: "error",
          rule_id: "TIMING-EVENT-004",
          artifact_id: artifact,
          field_path: eventPath,
          evidence: `Event requires finite start/end with end > start; received ${event.start_seconds}..${event.end_seconds}.`,
          repair_owner: "timing-editor",
          autofix_allowed: false,
        }),
      );
    }
  });
  return byId;
}

function validateDependencies(events, byId, pointer, artifact, issues) {
  events.forEach((event, index) => {
    const eventPath = joinPointer(pointer, index);
    for (const [dependencyIndex, dependency] of (
      event.dependencies ?? []
    ).entries()) {
      const dependencyPath = joinPointer(
        joinPointer(eventPath, "dependencies"),
        dependencyIndex,
      );
      const predecessor = byId.get(dependency.event_id)?.event;
      if (!predecessor) {
        issues.push(
          issue({
            severity: "error",
            rule_id: "TIMING-DEPENDENCY-001",
            artifact_id: artifact,
            field_path: joinPointer(dependencyPath, "event_id"),
            evidence: `Dependency event ${dependency.event_id} does not exist in this timing graph.`,
            repair_owner: "timing-editor",
            autofix_allowed: false,
          }),
        );
        continue;
      }
      if (
        ![
          "finish_to_start",
          "start_to_start",
          "finish_to_finish",
          "start_to_finish",
        ].includes(dependency.relation)
      ) {
        issues.push(
          issue({
            severity: "error",
            rule_id: "TIMING-DEPENDENCY-002",
            artifact_id: artifact,
            field_path: joinPointer(dependencyPath, "relation"),
            evidence: `Unknown dependency relation ${dependency.relation}.`,
            repair_owner: "timing-editor",
            autofix_allowed: false,
          }),
        );
        continue;
      }
      const required = dependencyThreshold(dependency, predecessor, event);
      const actual = dependencyActual(dependency, event);
      if (
        Number.isFinite(required) &&
        Number.isFinite(actual) &&
        actual + EPSILON < required
      ) {
        issues.push(
          issue({
            severity: "error",
            rule_id: "TIMING-DEPENDENCY-003",
            artifact_id: artifact,
            field_path: dependencyPath,
            evidence: `${event.event_id} violates ${dependency.relation} on ${dependency.event_id}: ${actual.toFixed(
              3,
            )} < required ${required.toFixed(3)} seconds.`,
            repair_owner: "timing-editor",
            autofix_allowed: false,
          }),
        );
      }
    }
  });
}

function validateShotTiming(shot, pointer, issues) {
  const id = artifactId(shot);
  const timing = shot.timing;
  if (!timing || !Array.isArray(timing.events)) {
    issues.push(
      issue({
        severity: "error",
        rule_id: "TIMING-PLAN-001",
        artifact_id: id,
        field_path: joinPointerPath(pointer, "timing", "events"),
        evidence: "Shot requires a timing.events array.",
        repair_owner: "timing-editor",
        autofix_allowed: false,
      }),
    );
    return;
  }
  const eventsPointer = joinPointerPath(pointer, "timing", "events");
  const byId = validateEventBasics(timing.events, eventsPointer, id, issues);
  validateDependencies(timing.events, byId, eventsPointer, id, issues);

  const validEvents = timing.events.filter(
    (event) =>
      event &&
      typeof event.event_id === "string" &&
      Number.isFinite(event.start_seconds) &&
      Number.isFinite(event.end_seconds) &&
      event.end_seconds > event.start_seconds,
  );
  if (validEvents.length !== timing.events.length) return;

  const result = computeCriticalPath(validEvents);
  if (result.hasCycle) {
    issues.push(
      issue({
        severity: "blocker",
        rule_id: "TIMING-CYCLE-001",
        artifact_id: id,
        field_path: eventsPointer,
        evidence: `Timing dependency cycle contains: ${result.cycleEventIds.join(
          ", ",
        )}.`,
        repair_owner: "timing-editor",
        autofix_allowed: false,
      }),
    );
    if (timing.calculation_status !== "invalid_cycle") {
      issues.push(
        issue({
          severity: "error",
          rule_id: "TIMING-STATUS-001",
          artifact_id: id,
          field_path: joinPointerPath(pointer, "timing", "calculation_status"),
          evidence:
            "calculation_status must be invalid_cycle while a dependency cycle exists.",
          repair_owner: "timing-editor",
          autofix_allowed: true,
        }),
      );
    }
    return;
  }

  const fps = Number(timing.timebase_rate?.frames_per_second);
  const tolerance = Number.isFinite(fps) && fps > 0 ? 1 / fps + EPSILON : 0.001;
  if (
    Number.isFinite(timing.critical_path_duration_seconds) &&
    Math.abs(timing.critical_path_duration_seconds - result.duration) >
      tolerance
  ) {
    issues.push(
      issue({
        severity: "error",
        rule_id: "TIMING-CRITICAL-001",
        artifact_id: id,
        field_path: joinPointer(
          pointer,
          "timing/critical_path_duration_seconds",
        ),
        evidence: `Declared critical path ${timing.critical_path_duration_seconds}s differs from computed ${result.duration.toFixed(
          3,
        )}s.`,
        repair_owner: "timing-editor",
        autofix_allowed: true,
      }),
    );
  }

  const declaredPath = timing.critical_path_event_ids ?? [];
  const missingCriticalIds = declaredPath.filter((eventId) => !byId.has(eventId));
  if (missingCriticalIds.length > 0) {
    issues.push(
      issue({
        severity: "error",
        rule_id: "TIMING-CRITICAL-002",
        artifact_id: id,
        field_path: joinPointerPath(pointer, "timing", "critical_path_event_ids"),
        evidence: `Critical path references missing events: ${missingCriticalIds.join(
          ", ",
        )}.`,
        repair_owner: "timing-editor",
        autofix_allowed: true,
      }),
    );
  } else if (
    declaredPath.length > 0 &&
    declaredPath.join("|") !== result.eventIds.join("|")
  ) {
    issues.push(
      issue({
        severity: "warning",
        rule_id: "TIMING-CRITICAL-003",
        artifact_id: id,
        field_path: joinPointerPath(pointer, "timing", "critical_path_event_ids"),
        evidence: `Declared path [${declaredPath.join(
          ", ",
        )}] differs from one computed longest path [${result.eventIds.join(
          ", ",
        )}]. Check ties and dependency intent.`,
        repair_owner: "timing-editor",
        autofix_allowed: false,
      }),
    );
  }

  const capture = Number(shot.capture_or_generation_duration_seconds);
  const edit = Number(shot.edit_duration_seconds);
  const head = Number(shot.head_handle_seconds ?? 0);
  const tail = Number(shot.tail_handle_seconds ?? 0);
  if (
    [capture, edit, head, tail].every(Number.isFinite) &&
    capture + EPSILON < edit + head + tail
  ) {
    issues.push(
      issue({
        severity: "error",
        rule_id: "TIMING-HANDLES-001",
        artifact_id: id,
        field_path: joinPointer(
          pointer,
          "capture_or_generation_duration_seconds",
        ),
        evidence: `Capture/generation duration ${capture}s cannot contain edit ${edit}s plus ${head}s head and ${tail}s tail handles.`,
        repair_owner: "timing-editor",
        autofix_allowed: false,
      }),
    );
  }
  if (Number.isFinite(capture) && result.duration > capture + tolerance) {
    issues.push(
      issue({
        severity: "error",
        rule_id: "TIMING-DURATION-001",
        artifact_id: id,
        field_path: joinPointer(pointer, "timing"),
        evidence: `Computed critical path ${result.duration.toFixed(
          3,
        )}s exceeds capture/generation duration ${capture}s.`,
        repair_owner: "timing-editor",
        autofix_allowed: false,
      }),
    );
    if (timing.calculation_status !== "over_duration") {
      issues.push(
        issue({
          severity: "error",
          rule_id: "TIMING-STATUS-002",
          artifact_id: id,
          field_path: joinPointerPath(pointer, "timing", "calculation_status"),
          evidence:
            "calculation_status must be over_duration while the critical path exceeds available duration.",
          repair_owner: "timing-editor",
          autofix_allowed: true,
        }),
      );
    }
  } else if (timing.calculation_status === "over_duration") {
    issues.push(
      issue({
        severity: "warning",
        rule_id: "TIMING-STATUS-003",
        artifact_id: id,
        field_path: joinPointerPath(pointer, "timing", "calculation_status"),
        evidence:
          "calculation_status says over_duration, but the computed critical path fits.",
        repair_owner: "timing-editor",
        autofix_allowed: true,
      }),
    );
  }

  for (const [index, event] of validEvents.entries()) {
    const origin =
      event.timebase === "timeline_global"
        ? Number(timing.timeline_origin_seconds ?? 0)
        : 0;
    const upperBound = origin + capture;
    if (Number.isFinite(capture) && event.end_seconds > upperBound + tolerance) {
      issues.push(
        issue({
          severity: "error",
          rule_id: "TIMING-BOUNDS-001",
          artifact_id: id,
          field_path: joinPointer(
            joinPointer(eventsPointer, index),
            "end_seconds",
          ),
          evidence: `Event ${event.event_id} ends at ${event.end_seconds}s beyond available bound ${upperBound}s.`,
          repair_owner: "timing-editor",
          autofix_allowed: false,
        }),
      );
    }
  }
}

function validateAudioTimeline(data, issues) {
  const foundEvents = findObjectsWithKey(data, "audio_event_id").filter(
    (found) => Object.hasOwn(found.value, "event_type"),
  );
  if (foundEvents.length === 0) return 0;
  const events = foundEvents.map((found) => ({
    event_id: found.value.audio_event_id,
    start_seconds: found.value.timing?.start_seconds,
    end_seconds: found.value.timing?.end_seconds,
    dependencies: found.value.dependencies ?? [],
    _pointer: found.pointer,
    _source: found.value,
  }));
  const byId = validateEventBasics(
    events,
    "/audio_events",
    "AUDIO-TIMELINE",
    issues,
  );
  validateDependencies(
    events,
    byId,
    "/audio_events",
    "AUDIO-TIMELINE",
    issues,
  );
  const validEvents = events.filter(
    (event) =>
      typeof event.event_id === "string" &&
      Number.isFinite(event.start_seconds) &&
      Number.isFinite(event.end_seconds) &&
      event.end_seconds > event.start_seconds,
  );
  if (validEvents.length === events.length) {
    const result = computeCriticalPath(validEvents);
    if (result.hasCycle) {
      issues.push(
        issue({
          severity: "blocker",
          rule_id: "TIMING-AUDIO-CYCLE-001",
          artifact_id: "AUDIO-TIMELINE",
          field_path: "/audio_events",
          evidence: `Audio dependency cycle contains: ${result.cycleEventIds.join(
            ", ",
          )}.`,
          repair_owner: "audio-editor",
          autofix_allowed: false,
        }),
      );
    }
  }
  for (const event of foundEvents) {
    const timing = event.value.timing ?? {};
    if (
      timing.timebase === "shot_local" &&
      (!timing.anchor_shot_id ||
        !event.value.shot_ids?.includes(timing.anchor_shot_id))
    ) {
      issues.push(
        issue({
          severity: "error",
          rule_id: "TIMING-AUDIO-ANCHOR-001",
          artifact_id: event.value.audio_event_id,
          field_path: joinPointerPath(
            event.pointer,
            "timing",
            "anchor_shot_id",
          ),
          evidence:
            "Shot-local audio requires anchor_shot_id and that ID must appear in shot_ids.",
          repair_owner: "audio-editor",
          autofix_allowed: false,
        }),
      );
    }
    if (
      ["sync_dialogue", "offscreen_dialogue", "voice_over"].includes(
        event.value.event_type,
      )
    ) {
      const tested = Number(event.value.delivery?.tested_read_duration_seconds);
      const available = Number(timing.end_seconds) - Number(timing.start_seconds);
      if (!Number.isFinite(tested) || tested <= 0) {
        issues.push(
          issue({
            severity: "error",
            rule_id: "TIMING-DIALOGUE-READ-001",
            artifact_id: event.value.audio_event_id,
            field_path: joinPointerPath(event.pointer, "delivery", "tested_read_duration_seconds"),
            evidence: "Dialogue requires a measured or calibrated read duration.",
            repair_owner: "dialogue-editor",
            autofix_allowed: false,
          }),
        );
      } else if (Number.isFinite(available) && tested > available + 0.001) {
        issues.push(
          issue({
            severity: "error",
            rule_id: "TIMING-DIALOGUE-READ-002",
            artifact_id: event.value.audio_event_id,
            field_path: joinPointer(event.pointer, "timing"),
            evidence: `Tested read duration ${tested}s exceeds available audio interval ${available.toFixed(3)}s.`,
            repair_owner: "dialogue-editor",
            autofix_allowed: false,
          }),
        );
      }
    }
  }
  return foundEvents.length;
}

export async function validateTiming(data, context = {}) {
  const issues = [];
  const shots = findObjectsWithKey(data, "shot_id").filter((found) =>
    Object.hasOwn(found.value, "visible_action"),
  );
  for (const found of shots) {
    validateShotTiming(found.value, found.pointer, issues);
  }
  const audioEventsChecked = validateAudioTimeline(data, issues);
  if (shots.length === 0 && audioEventsChecked === 0) {
    issues.push(
      issue({
        severity: "blocker",
        rule_id: "TIMING-INPUT-001",
        evidence: "No shot timing plans or audio events were found.",
        repair_owner: "project-orchestrator",
        autofix_allowed: false,
      }),
    );
  }
  const exitCode = exitCodeForIssues(issues);
  return makeReport({
    validator: VALIDATOR,
    inputPath: context.inputPath,
    issues,
    exitCode,
    metadata: {
      shots_checked: shots.length,
      audio_events_checked: audioEventsChecked,
    },
  });
}

const HELP = `
Usage: node validate-timing.mjs <input.json>

Validate event intervals, dependency relations, cycles, event critical paths,
capture/edit durations, handles, calculation status, and audio-event anchors.
Overlapping action, dialogue, reaction, camera, and sound events are evaluated
through their dependency graph rather than mechanically added.

Exit codes:
  0  Passed (warnings/suggestions may remain)
  1  Contains repairable timing errors
  2  JSON, configuration, or execution failure
  3  Requires human authorization/judgment
`;

if (directExecution(import.meta.url)) {
  await runValidatorCli({
    validator: VALIDATOR,
    validate: validateTiming,
    help: HELP,
  });
}

export default validateTiming;

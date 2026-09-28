// Core re-entry logic: when a change entry tags the artifact types it
// affects, the deal must re-enter at the EARLIEST stage among those types -
// not necessarily stage 1. This is the one module that owns that rule, and
// it is exercised directly by server/tests/reentry.test.ts.
import type Database from "better-sqlite3";
import type { Artifact, ArtifactType, ChangeEntry, Iteration, Stage } from "../types.js";

export interface LogChangeEntryInput {
  dealId: number;
  summary: string;
  reason: string | null;
  requestedBy: string;
  artifactTypeKeys: string[];
}

export interface LogChangeEntryResult {
  changeEntry: ChangeEntry;
  newIteration: Iteration;
  earliestAffectedStage: Stage;
}

/**
 * Given a set of artifact type keys a change touches, returns the stage
 * with the lowest order_index among the stages that own those types.
 */
export function computeEarliestAffectedStage(db: Database.Database, artifactTypeKeys: string[]): Stage {
  if (artifactTypeKeys.length === 0) {
    throw new Error("A change entry must tag at least one artifact type");
  }
  const placeholders = artifactTypeKeys.map(() => "?").join(",");
  const stage = db
    .prepare(
      `SELECT s.* FROM stages s
       JOIN artifact_types at ON at.owning_stage_id = s.id
       WHERE at.key IN (${placeholders})
       ORDER BY s.order_index ASC
       LIMIT 1`
    )
    .get(...artifactTypeKeys) as Stage | undefined;
  if (!stage) {
    throw new Error(`No stage owns any of the tagged artifact types: ${artifactTypeKeys.join(", ")}`);
  }
  return stage;
}

/**
 * Logs a change entry against the deal's current (in_progress) iteration,
 * marks the affected artifacts stale (directly tagged + everything owned by
 * a stage at or after the earliest affected stage), and opens a new
 * iteration starting at that earliest affected stage.
 */
export function logChangeEntryAndReenter(db: Database.Database, input: LogChangeEntryInput): LogChangeEntryResult {
  const { dealId, summary, reason, requestedBy, artifactTypeKeys } = input;

  const currentIteration = db
    .prepare("SELECT * FROM iterations WHERE deal_id = ? AND status = 'in_progress' ORDER BY round_number DESC LIMIT 1")
    .get(dealId) as Iteration | undefined;
  if (!currentIteration) {
    throw new Error(`Deal ${dealId} has no in-progress iteration to log a change against`);
  }

  const earliestAffectedStage = computeEarliestAffectedStage(db, artifactTypeKeys);

  const runTxn = db.transaction(() => {
    const changeEntryId = db
      .prepare(
        `INSERT INTO change_entries (deal_id, iteration_id, summary, reason, requested_by, created_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`
      )
      .run(dealId, currentIteration.id, summary, reason, requestedBy).lastInsertRowid as number;

    const insertTag = db.prepare(
      "INSERT INTO change_entry_artifact_tags (change_entry_id, artifact_type_key) VALUES (?, ?)"
    );
    for (const key of artifactTypeKeys) insertTag.run(changeEntryId, key);

    // Every artifact whose owning stage is at or after the earliest
    // affected stage is now stale, whether or not it was directly tagged -
    // downstream work built on top of an earlier-stage artifact that changed.
    const currentArtifacts = db
      .prepare(
        `SELECT a.*, at.owning_stage_id FROM artifacts a
         JOIN artifact_types at ON at.key = a.artifact_type_key
         JOIN stages s ON s.id = at.owning_stage_id
         WHERE a.deal_id = ? AND a.status = 'current' AND s.order_index >= ?`
      )
      .all(dealId, earliestAffectedStage.order_index) as (Artifact & { owning_stage_id: number })[];

    const markStale = db.prepare("UPDATE artifacts SET status = 'stale' WHERE id = ?");
    const insertImpact = db.prepare(
      "INSERT INTO change_impacts (change_entry_id, artifact_id, reason) VALUES (?, ?, ?)"
    );
    const taggedSet = new Set(artifactTypeKeys);
    for (const artifact of currentArtifacts) {
      markStale.run(artifact.id);
      insertImpact.run(
        changeEntryId,
        artifact.id,
        taggedSet.has(artifact.artifact_type_key) ? "directly_tagged" : "downstream"
      );
    }

    db.prepare("UPDATE iterations SET status = 'complete', completed_at = datetime('now') WHERE id = ?").run(
      currentIteration.id
    );

    const nextRound = currentIteration.round_number + 1;
    const newIterationId = db
      .prepare(
        `INSERT INTO iterations (deal_id, round_number, entry_stage_id, status, trigger_change_entry_id, started_at)
         VALUES (?, ?, ?, 'in_progress', ?, datetime('now'))`
      )
      .run(dealId, nextRound, earliestAffectedStage.id, changeEntryId).lastInsertRowid as number;

    db.prepare("UPDATE change_entries SET resulting_iteration_id = ? WHERE id = ?").run(
      newIterationId,
      changeEntryId
    );

    db.prepare("UPDATE deals SET current_stage_id = ?, updated_at = datetime('now') WHERE id = ?").run(
      earliestAffectedStage.id,
      dealId
    );

    const changeEntry = db.prepare("SELECT * FROM change_entries WHERE id = ?").get(changeEntryId) as ChangeEntry;
    const newIteration = db.prepare("SELECT * FROM iterations WHERE id = ?").get(newIterationId) as Iteration;
    return { changeEntry, newIteration, earliestAffectedStage };
  });

  return runTxn();
}

/**
 * Advances a deal to the next stage within its current iteration, once the
 * current stage's checklist is complete. No-ops (returns null) at the last
 * stage - the deal instead awaits a change entry or is marked won/lost.
 */
export function advanceToNextStage(db: Database.Database, dealId: number): Stage | null {
  const deal = db.prepare("SELECT * FROM deals WHERE id = ?").get(dealId) as { current_stage_id: number } | undefined;
  if (!deal) throw new Error(`Deal ${dealId} not found`);

  const currentStage = db.prepare("SELECT * FROM stages WHERE id = ?").get(deal.current_stage_id) as Stage;
  const nextStage = db
    .prepare("SELECT * FROM stages WHERE order_index = ?")
    .get(currentStage.order_index + 1) as Stage | undefined;
  if (!nextStage) return null;

  db.prepare("UPDATE deals SET current_stage_id = ?, updated_at = datetime('now') WHERE id = ?").run(
    nextStage.id,
    dealId
  );
  return nextStage;
}

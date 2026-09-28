// Read-side queries for the impact view: which artifacts a given change
// entry marked stale, and why (directly tagged vs. downstream of an
// earlier-stage change). The writes happen in reentry.ts at the moment the
// change entry is logged.
import type Database from "better-sqlite3";
import type { Artifact, ChangeImpact } from "../types.js";

export interface ImpactedArtifact extends Artifact {
  reason: ChangeImpact["reason"];
  artifact_label: string;
  owning_stage_name: string;
  current_version_status: Artifact["status"];
}

export function getImpactForChangeEntry(db: Database.Database, changeEntryId: number): ImpactedArtifact[] {
  return db
    .prepare(
      `SELECT a.*, ci.reason, at.label AS artifact_label, s.name AS owning_stage_name,
              a.status AS current_version_status
       FROM change_impacts ci
       JOIN artifacts a ON a.id = ci.artifact_id
       JOIN artifact_types at ON at.key = a.artifact_type_key
       JOIN stages s ON s.id = at.owning_stage_id
       WHERE ci.change_entry_id = ?
       ORDER BY s.order_index ASC`
    )
    .all(changeEntryId) as ImpactedArtifact[];
}

export function getStaleArtifactsForDeal(db: Database.Database, dealId: number): Artifact[] {
  return db
    .prepare("SELECT * FROM artifacts WHERE deal_id = ? AND status = 'stale' ORDER BY created_at DESC")
    .all(dealId) as Artifact[];
}

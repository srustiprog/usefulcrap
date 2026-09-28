import { Router } from "express";
import { db } from "../db/index.js";
import { logChangeEntryAndReenter } from "../services/reentry.js";
import { getImpactForChangeEntry } from "../services/impact.js";
import type { ChangeEntry } from "../types.js";

export const changeEntriesRouter = Router();

function withTags(changeEntry: ChangeEntry) {
  const tags = db
    .prepare("SELECT artifact_type_key FROM change_entry_artifact_tags WHERE change_entry_id = ?")
    .all(changeEntry.id) as { artifact_type_key: string }[];
  return { ...changeEntry, tags: tags.map((t) => t.artifact_type_key) };
}

changeEntriesRouter.get("/deals/:id/change-entries", (req, res) => {
  const dealId = Number(req.params.id);
  const entries = db
    .prepare("SELECT * FROM change_entries WHERE deal_id = ? ORDER BY created_at DESC")
    .all(dealId) as ChangeEntry[];
  res.json(entries.map(withTags));
});

changeEntriesRouter.post("/deals/:id/change-entries", (req, res) => {
  const dealId = Number(req.params.id);
  const { summary, reason, requestedBy, artifactTypeKeys } = req.body ?? {};
  if (!summary || !requestedBy || !Array.isArray(artifactTypeKeys) || artifactTypeKeys.length === 0) {
    return res
      .status(400)
      .json({ error: "summary, requestedBy and a non-empty artifactTypeKeys array are required" });
  }
  try {
    const result = logChangeEntryAndReenter(db, {
      dealId,
      summary,
      reason: reason ?? null,
      requestedBy,
      artifactTypeKeys,
    });
    res.status(201).json({
      changeEntry: withTags(result.changeEntry),
      newIteration: result.newIteration,
      earliestAffectedStage: result.earliestAffectedStage,
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

changeEntriesRouter.get("/change-entries/:id", (req, res) => {
  const id = Number(req.params.id);
  const entry = db.prepare("SELECT * FROM change_entries WHERE id = ?").get(id) as ChangeEntry | undefined;
  if (!entry) return res.status(404).json({ error: "Change entry not found" });
  res.json(withTags(entry));
});

changeEntriesRouter.get("/change-entries/:id/impact", (req, res) => {
  const id = Number(req.params.id);
  const entry = db.prepare("SELECT * FROM change_entries WHERE id = ?").get(id);
  if (!entry) return res.status(404).json({ error: "Change entry not found" });
  res.json(getImpactForChangeEntry(db, id));
});

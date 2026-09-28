import { Router } from "express";
import { db } from "../db/index.js";
import type { Artifact, Iteration } from "../types.js";

export const artifactsRouter = Router();

artifactsRouter.get("/deals/:id/artifacts", (req, res) => {
  const dealId = Number(req.params.id);
  const artifacts = db
    .prepare("SELECT * FROM artifacts WHERE deal_id = ? ORDER BY created_at DESC")
    .all(dealId);
  res.json(artifacts);
});

// Publish a new version of an artifact for the deal's current iteration.
// Any existing "current" artifact of the same type is superseded.
artifactsRouter.post("/deals/:id/artifacts", (req, res) => {
  const dealId = Number(req.params.id);
  const { artifact_type_key, name, notes } = req.body ?? {};
  if (!artifact_type_key || !name) {
    return res.status(400).json({ error: "artifact_type_key and name are required" });
  }
  const artifactType = db.prepare("SELECT * FROM artifact_types WHERE key = ?").get(artifact_type_key);
  if (!artifactType) return res.status(404).json({ error: "Unknown artifact_type_key" });

  const iteration = db
    .prepare("SELECT * FROM iterations WHERE deal_id = ? ORDER BY round_number DESC LIMIT 1")
    .get(dealId) as Iteration | undefined;
  if (!iteration) return res.status(400).json({ error: "Deal has no active iteration" });

  const create = db.transaction(() => {
    const priorCurrent = db
      .prepare(
        "SELECT * FROM artifacts WHERE deal_id = ? AND artifact_type_key = ? AND status IN ('current', 'stale')"
      )
      .all(dealId, artifact_type_key) as Artifact[];
    const maxVersion = db
      .prepare("SELECT COALESCE(MAX(version), 0) AS m FROM artifacts WHERE deal_id = ? AND artifact_type_key = ?")
      .get(dealId, artifact_type_key) as { m: number };

    for (const old of priorCurrent) {
      db.prepare("UPDATE artifacts SET status = 'superseded' WHERE id = ?").run(old.id);
    }

    const id = db
      .prepare(
        `INSERT INTO artifacts (deal_id, artifact_type_key, name, version, iteration_id, status, notes, created_at)
         VALUES (?, ?, ?, ?, ?, 'current', ?, datetime('now'))`
      )
      .run(dealId, artifact_type_key, name, maxVersion.m + 1, iteration.id, notes ?? null).lastInsertRowid;
    return id;
  });

  const id = create();
  res.status(201).json(db.prepare("SELECT * FROM artifacts WHERE id = ?").get(id));
});

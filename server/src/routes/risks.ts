import { Router } from "express";
import { db } from "../db/index.js";
import type { AssumptionRisk, Iteration } from "../types.js";

export const risksRouter = Router();

risksRouter.get("/deals/:id/risks", (req, res) => {
  const dealId = Number(req.params.id);
  const risks = db
    .prepare("SELECT * FROM assumptions_risks WHERE deal_id = ? ORDER BY created_at DESC")
    .all(dealId);
  res.json(risks);
});

risksRouter.post("/deals/:id/risks", (req, res) => {
  const dealId = Number(req.params.id);
  const { type, description } = req.body ?? {};
  if (type !== "assumption" && type !== "risk") {
    return res.status(400).json({ error: "type must be 'assumption' or 'risk'" });
  }
  if (!description) return res.status(400).json({ error: "description is required" });

  const iteration = db
    .prepare("SELECT * FROM iterations WHERE deal_id = ? ORDER BY round_number DESC LIMIT 1")
    .get(dealId) as Iteration | undefined;

  const id = db
    .prepare(
      `INSERT INTO assumptions_risks (deal_id, iteration_id, type, description, status, created_at)
       VALUES (?, ?, ?, ?, 'open', datetime('now'))`
    )
    .run(dealId, iteration?.id ?? null, type, description).lastInsertRowid;
  res.status(201).json(db.prepare("SELECT * FROM assumptions_risks WHERE id = ?").get(id));
});

risksRouter.patch("/risks/:id", (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare("SELECT * FROM assumptions_risks WHERE id = ?").get(id) as AssumptionRisk | undefined;
  if (!existing) return res.status(404).json({ error: "Not found" });
  const { status } = req.body ?? {};
  if (!["open", "resolved", "accepted"].includes(status)) {
    return res.status(400).json({ error: "status must be open, resolved or accepted" });
  }
  db.prepare("UPDATE assumptions_risks SET status = ? WHERE id = ?").run(status, id);
  res.json(db.prepare("SELECT * FROM assumptions_risks WHERE id = ?").get(id));
});

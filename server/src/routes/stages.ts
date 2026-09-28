// Stages and their checklist items are configurable data, not hardcoded:
// this router is how a user edits the exit-criteria checklist per stage.
import { Router } from "express";
import { db } from "../db/index.js";
import type { Stage, StageChecklistItem } from "../types.js";

export const stagesRouter = Router();

stagesRouter.get("/stages", (_req, res) => {
  const stages = db.prepare("SELECT * FROM stages ORDER BY order_index").all() as Stage[];
  const items = db
    .prepare("SELECT * FROM stage_checklist_items ORDER BY stage_id, order_index")
    .all() as StageChecklistItem[];
  const result = stages.map((stage) => ({
    ...stage,
    checklist_items: items.filter((i) => i.stage_id === stage.id),
  }));
  res.json(result);
});

stagesRouter.post("/stages/:stageId/checklist-items", (req, res) => {
  const stageId = Number(req.params.stageId);
  const { text, is_required = true } = req.body ?? {};
  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "text is required" });
  }
  const stage = db.prepare("SELECT * FROM stages WHERE id = ?").get(stageId);
  if (!stage) return res.status(404).json({ error: "Stage not found" });

  const maxOrder = db
    .prepare("SELECT COALESCE(MAX(order_index), 0) AS m FROM stage_checklist_items WHERE stage_id = ?")
    .get(stageId) as { m: number };
  const id = db
    .prepare("INSERT INTO stage_checklist_items (stage_id, text, order_index, is_required) VALUES (?, ?, ?, ?)")
    .run(stageId, text, maxOrder.m + 1, is_required ? 1 : 0).lastInsertRowid;
  const item = db.prepare("SELECT * FROM stage_checklist_items WHERE id = ?").get(id);
  res.status(201).json(item);
});

stagesRouter.patch("/checklist-items/:itemId", (req, res) => {
  const itemId = Number(req.params.itemId);
  const existing = db.prepare("SELECT * FROM stage_checklist_items WHERE id = ?").get(itemId) as
    | StageChecklistItem
    | undefined;
  if (!existing) return res.status(404).json({ error: "Checklist item not found" });

  const { text, order_index, is_required } = req.body ?? {};
  db.prepare(
    "UPDATE stage_checklist_items SET text = ?, order_index = ?, is_required = ? WHERE id = ?"
  ).run(
    text ?? existing.text,
    order_index ?? existing.order_index,
    is_required === undefined ? existing.is_required : is_required ? 1 : 0,
    itemId
  );
  res.json(db.prepare("SELECT * FROM stage_checklist_items WHERE id = ?").get(itemId));
});

stagesRouter.delete("/checklist-items/:itemId", (req, res) => {
  const itemId = Number(req.params.itemId);
  db.prepare("DELETE FROM stage_checklist_items WHERE id = ?").run(itemId);
  res.status(204).end();
});

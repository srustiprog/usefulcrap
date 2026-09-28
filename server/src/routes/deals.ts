import { Router } from "express";
import { db } from "../db/index.js";
import { advanceToNextStage } from "../services/reentry.js";
import type { Deal, DealChecklistStatus, Iteration, Stage, StageChecklistItem } from "../types.js";

export const dealsRouter = Router();

function getCurrentIteration(dealId: number): Iteration | undefined {
  return db
    .prepare("SELECT * FROM iterations WHERE deal_id = ? ORDER BY round_number DESC LIMIT 1")
    .get(dealId) as Iteration | undefined;
}

// Pipeline board: every deal plus enough to render a card (stage, round, progress).
dealsRouter.get("/deals", (_req, res) => {
  const deals = db.prepare("SELECT * FROM deals ORDER BY updated_at DESC").all() as Deal[];
  const result = deals.map((deal) => {
    const iteration = getCurrentIteration(deal.id);
    const stage = db.prepare("SELECT * FROM stages WHERE id = ?").get(deal.current_stage_id) as Stage;
    let progress = { total: 0, complete: 0 };
    if (iteration) {
      const items = db
        .prepare("SELECT id FROM stage_checklist_items WHERE stage_id = ?")
        .all(deal.current_stage_id) as { id: number }[];
      const done = db
        .prepare(
          `SELECT COUNT(*) c FROM deal_checklist_status
           WHERE iteration_id = ? AND is_complete = 1 AND checklist_item_id IN (${
             items.map(() => "?").join(",") || "NULL"
           })`
        )
        .get(iteration.id, ...items.map((i) => i.id)) as { c: number };
      progress = { total: items.length, complete: done.c };
    }
    return { ...deal, stage, iteration, checklist_progress: progress };
  });
  res.json(result);
});

dealsRouter.post("/deals", (req, res) => {
  const { name, customer, industry, description } = req.body ?? {};
  if (!name || !customer || !industry) {
    return res.status(400).json({ error: "name, customer and industry are required" });
  }
  const firstStage = db.prepare("SELECT * FROM stages ORDER BY order_index LIMIT 1").get() as Stage;

  const create = db.transaction(() => {
    const dealId = db
      .prepare(
        `INSERT INTO deals (name, customer, industry, description, status, current_stage_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'active', ?, datetime('now'), datetime('now'))`
      )
      .run(name, customer, industry, description ?? null, firstStage.id).lastInsertRowid as number;
    db.prepare(
      `INSERT INTO iterations (deal_id, round_number, entry_stage_id, status, trigger_change_entry_id, started_at)
       VALUES (?, 1, ?, 'in_progress', NULL, datetime('now'))`
    ).run(dealId, firstStage.id);
    return dealId;
  });
  const dealId = create();
  res.status(201).json(db.prepare("SELECT * FROM deals WHERE id = ?").get(dealId));
});

dealsRouter.get("/deals/:id", (req, res) => {
  const dealId = Number(req.params.id);
  const deal = db.prepare("SELECT * FROM deals WHERE id = ?").get(dealId) as Deal | undefined;
  if (!deal) return res.status(404).json({ error: "Deal not found" });

  const stages = db.prepare("SELECT * FROM stages ORDER BY order_index").all() as Stage[];
  const iterations = db
    .prepare("SELECT * FROM iterations WHERE deal_id = ? ORDER BY round_number")
    .all(dealId) as Iteration[];
  const currentIteration = iterations[iterations.length - 1];

  const checklistItems = db
    .prepare("SELECT * FROM stage_checklist_items WHERE stage_id = ? ORDER BY order_index")
    .all(deal.current_stage_id) as StageChecklistItem[];
  const statusRows = currentIteration
    ? (db
        .prepare("SELECT * FROM deal_checklist_status WHERE iteration_id = ?")
        .all(currentIteration.id) as DealChecklistStatus[])
    : [];
  const statusByItem = new Map(statusRows.map((s) => [s.checklist_item_id, s]));
  const checklist = checklistItems.map((item) => ({
    ...item,
    is_complete: Boolean(statusByItem.get(item.id)?.is_complete),
    completed_at: statusByItem.get(item.id)?.completed_at ?? null,
  }));

  const artifacts = db
    .prepare("SELECT * FROM artifacts WHERE deal_id = ? ORDER BY created_at DESC")
    .all(dealId);
  const risks = db
    .prepare("SELECT * FROM assumptions_risks WHERE deal_id = ? ORDER BY created_at DESC")
    .all(dealId);

  res.json({
    deal,
    stages,
    currentIteration,
    iterationCount: iterations.length,
    checklist,
    artifacts,
    risks,
  });
});

dealsRouter.patch("/deals/:id", (req, res) => {
  const dealId = Number(req.params.id);
  const existing = db.prepare("SELECT * FROM deals WHERE id = ?").get(dealId) as Deal | undefined;
  if (!existing) return res.status(404).json({ error: "Deal not found" });

  const { name, customer, industry, description, status } = req.body ?? {};
  db.prepare(
    `UPDATE deals SET name = ?, customer = ?, industry = ?, description = ?, status = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    name ?? existing.name,
    customer ?? existing.customer,
    industry ?? existing.industry,
    description ?? existing.description,
    status ?? existing.status,
    dealId
  );
  res.json(db.prepare("SELECT * FROM deals WHERE id = ?").get(dealId));
});

// Toggle a checklist item for the deal's current iteration.
dealsRouter.post("/deals/:id/checklist/:itemId/toggle", (req, res) => {
  const dealId = Number(req.params.id);
  const itemId = Number(req.params.itemId);
  const iteration = getCurrentIteration(dealId);
  if (!iteration) return res.status(404).json({ error: "Deal has no active iteration" });

  const existing = db
    .prepare("SELECT * FROM deal_checklist_status WHERE iteration_id = ? AND checklist_item_id = ?")
    .get(iteration.id, itemId) as DealChecklistStatus | undefined;

  if (existing) {
    const next = existing.is_complete ? 0 : 1;
    db.prepare("UPDATE deal_checklist_status SET is_complete = ?, completed_at = ? WHERE id = ?").run(
      next,
      next ? new Date().toISOString() : null,
      existing.id
    );
  } else {
    db.prepare(
      "INSERT INTO deal_checklist_status (deal_id, iteration_id, checklist_item_id, is_complete, completed_at) VALUES (?, ?, ?, 1, datetime('now'))"
    ).run(dealId, iteration.id, itemId);
  }
  res.json({ ok: true });
});

// Advance the deal to the next stage within the current iteration. Requires
// every required checklist item on the current stage to be complete.
dealsRouter.post("/deals/:id/advance", (req, res) => {
  const dealId = Number(req.params.id);
  const deal = db.prepare("SELECT * FROM deals WHERE id = ?").get(dealId) as Deal | undefined;
  if (!deal) return res.status(404).json({ error: "Deal not found" });

  const iteration = getCurrentIteration(dealId);
  if (!iteration || iteration.status !== "in_progress") {
    return res.status(400).json({ error: "Deal has no in-progress iteration" });
  }

  const requiredItems = db
    .prepare("SELECT id FROM stage_checklist_items WHERE stage_id = ? AND is_required = 1")
    .all(deal.current_stage_id) as { id: number }[];
  const incomplete = requiredItems.filter((item) => {
    const row = db
      .prepare("SELECT is_complete FROM deal_checklist_status WHERE iteration_id = ? AND checklist_item_id = ?")
      .get(iteration.id, item.id) as { is_complete: number } | undefined;
    return !row?.is_complete;
  });
  if (incomplete.length > 0) {
    return res.status(400).json({ error: "Required checklist items are incomplete", incomplete_count: incomplete.length });
  }

  const nextStage = advanceToNextStage(db, dealId);
  if (!nextStage) {
    db.prepare("UPDATE iterations SET status = 'complete', completed_at = datetime('now') WHERE id = ?").run(
      iteration.id
    );
    return res.json({ done: true, message: "Deal completed its final stage for this iteration" });
  }
  res.json({ done: false, nextStage });
});

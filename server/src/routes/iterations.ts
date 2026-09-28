// Iteration timeline: every round for a deal, in order, with the change
// entry that opened it (if any) and the change entry(ies) logged during it.
import { Router } from "express";
import { db } from "../db/index.js";
import type { ChangeEntry, Iteration, Stage } from "../types.js";

export const iterationsRouter = Router();

iterationsRouter.get("/deals/:id/iterations", (req, res) => {
  const dealId = Number(req.params.id);
  const iterations = db
    .prepare("SELECT * FROM iterations WHERE deal_id = ? ORDER BY round_number")
    .all(dealId) as Iteration[];

  const result = iterations.map((iteration) => {
    const entryStage = db.prepare("SELECT * FROM stages WHERE id = ?").get(iteration.entry_stage_id) as Stage;
    const triggerChangeEntry = iteration.trigger_change_entry_id
      ? (db.prepare("SELECT * FROM change_entries WHERE id = ?").get(iteration.trigger_change_entry_id) as ChangeEntry)
      : null;
    const changeEntriesLogged = db
      .prepare("SELECT * FROM change_entries WHERE iteration_id = ? ORDER BY created_at")
      .all(iteration.id) as ChangeEntry[];
    const tagsByChangeEntry = new Map<number, string[]>();
    for (const ce of changeEntriesLogged) {
      const tags = db
        .prepare("SELECT artifact_type_key FROM change_entry_artifact_tags WHERE change_entry_id = ?")
        .all(ce.id) as { artifact_type_key: string }[];
      tagsByChangeEntry.set(
        ce.id,
        tags.map((t) => t.artifact_type_key)
      );
    }
    return {
      iteration,
      entryStage,
      triggerChangeEntry,
      changeEntriesLogged: changeEntriesLogged.map((ce) => ({ ...ce, tags: tagsByChangeEntry.get(ce.id) ?? [] })),
    };
  });

  res.json(result);
});

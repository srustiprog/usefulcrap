import { Router } from "express";
import { db } from "../db/index.js";
import type { ArtifactType } from "../types.js";

export const artifactTypesRouter = Router();

artifactTypesRouter.get("/artifact-types", (_req, res) => {
  const types = db
    .prepare(
      `SELECT at.*, s.name AS owning_stage_name, s.order_index AS owning_stage_order
       FROM artifact_types at JOIN stages s ON s.id = at.owning_stage_id
       ORDER BY s.order_index`
    )
    .all() as (ArtifactType & { owning_stage_name: string; owning_stage_order: number })[];
  res.json(types);
});

import cors from "cors";
import express from "express";
import { artifactsRouter } from "./routes/artifacts.js";
import { artifactTypesRouter } from "./routes/artifactTypes.js";
import { changeEntriesRouter } from "./routes/changeEntries.js";
import { dealsRouter } from "./routes/deals.js";
import { iterationsRouter } from "./routes/iterations.js";
import { risksRouter } from "./routes/risks.js";
import { stagesRouter } from "./routes/stages.js";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  app.use("/api", stagesRouter);
  app.use("/api", artifactTypesRouter);
  app.use("/api", dealsRouter);
  app.use("/api", iterationsRouter);
  app.use("/api", artifactsRouter);
  app.use("/api", changeEntriesRouter);
  app.use("/api", risksRouter);

  return app;
}

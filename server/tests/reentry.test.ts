// Tests for the re-entry rule: a deal must re-enter at the EARLIEST stage
// among the artifact types a change entry tags, not necessarily stage 1.
// Uses a fresh in-memory SQLite database per test, independent of the
// file-backed db singleton in src/db/index.ts.
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { advanceToNextStage, computeEarliestAffectedStage, logChangeEntryAndReenter } from "../src/services/reentry.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaSql = fs.readFileSync(path.join(__dirname, "../src/db/schema.sql"), "utf-8");

let db: Database.Database;
let dealId: number;

const STAGES = [
  "Intake",
  "Discovery & Gap Analysis",
  "Solution Options",
  "Scope & Effort",
  "Internal Review",
  "Customer Readout",
] as const;

// One artifact type per stage, keyed by lowercase stage index for readability
// in tests: type_1 is owned by stage 1, type_2 by stage 2, etc.
function stageArtifactType(stageOrder: number): string {
  return `type_${stageOrder}`;
}

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec(schemaSql);

  const insertStage = db.prepare("INSERT INTO stages (id, name, order_index) VALUES (?, ?, ?)");
  STAGES.forEach((name, i) => insertStage.run(i + 1, name, i + 1));

  const insertType = db.prepare("INSERT INTO artifact_types (key, label, owning_stage_id) VALUES (?, ?, ?)");
  STAGES.forEach((_, i) => insertType.run(stageArtifactType(i + 1), `Type ${i + 1}`, i + 1));

  dealId = db
    .prepare(
      `INSERT INTO deals (name, customer, industry, current_stage_id, status)
       VALUES ('Test Deal', 'Test Co', 'Testing', 6, 'active')`
    )
    .run().lastInsertRowid as number;
  // Deal starts as if it has already progressed to the final stage in round 1.
  db.prepare(
    `INSERT INTO iterations (id, deal_id, round_number, entry_stage_id, status, started_at)
     VALUES (1, ?, 1, 1, 'in_progress', datetime('now'))`
  ).run(dealId);

  // One "current" artifact per stage, all produced in round 1.
  const insertArtifact = db.prepare(
    `INSERT INTO artifacts (deal_id, artifact_type_key, name, version, iteration_id, status)
     VALUES (?, ?, ?, 1, 1, 'current')`
  );
  STAGES.forEach((_, i) => insertArtifact.run(dealId, stageArtifactType(i + 1), `Artifact ${i + 1}`));
});

describe("computeEarliestAffectedStage", () => {
  it("returns the stage owning a single tagged artifact type", () => {
    const stage = computeEarliestAffectedStage(db, [stageArtifactType(4)]);
    expect(stage.order_index).toBe(4);
  });

  it("returns the lowest order_index stage among several tagged types", () => {
    const stage = computeEarliestAffectedStage(db, [stageArtifactType(5), stageArtifactType(2), stageArtifactType(6)]);
    expect(stage.order_index).toBe(2);
  });

  it("throws when given no artifact type keys", () => {
    expect(() => computeEarliestAffectedStage(db, [])).toThrow();
  });

  it("throws when given an artifact type key no stage owns", () => {
    expect(() => computeEarliestAffectedStage(db, ["does_not_exist"])).toThrow();
  });
});

describe("logChangeEntryAndReenter", () => {
  it("re-enters at the earliest affected stage, not stage 1, when only a late-stage artifact is tagged", () => {
    const result = logChangeEntryAndReenter(db, {
      dealId,
      summary: "Customer wants deck reformatted",
      reason: null,
      requestedBy: "Tester",
      artifactTypeKeys: [stageArtifactType(6)], // Customer Readout deck only
    });

    expect(result.earliestAffectedStage.order_index).toBe(6);
    expect(result.newIteration.entry_stage_id).toBe(result.earliestAffectedStage.id);
    expect(result.newIteration.round_number).toBe(2);

    const deal = db.prepare("SELECT * FROM deals WHERE id = ?").get(dealId) as { current_stage_id: number };
    expect(deal.current_stage_id).toBe(result.earliestAffectedStage.id);
  });

  it("re-enters at an early stage when an early-stage artifact is tagged, even though the deal is further along", () => {
    // Deal is at the final stage (6), but the change touches the Discovery
    // (stage 2) artifact - it must NOT re-enter at stage 1, and must NOT
    // stay at stage 6; it goes back to stage 2.
    const result = logChangeEntryAndReenter(db, {
      dealId,
      summary: "Customer identified a missed requirement from discovery",
      reason: null,
      requestedBy: "Tester",
      artifactTypeKeys: [stageArtifactType(2)],
    });

    expect(result.earliestAffectedStage.order_index).toBe(2);
    expect(result.earliestAffectedStage.order_index).not.toBe(1);

    const deal = db.prepare("SELECT * FROM deals WHERE id = ?").get(dealId) as { current_stage_id: number };
    const stage2 = db.prepare("SELECT * FROM stages WHERE order_index = 2").get() as { id: number };
    expect(deal.current_stage_id).toBe(stage2.id);
  });

  it("uses the minimum stage among multiple tagged artifact types spanning different stages", () => {
    const result = logChangeEntryAndReenter(db, {
      dealId,
      summary: "Scope and estimate both need rework",
      reason: null,
      requestedBy: "Tester",
      artifactTypeKeys: [stageArtifactType(5), stageArtifactType(3)],
    });
    expect(result.earliestAffectedStage.order_index).toBe(3);
  });

  it("marks the directly tagged artifact and all downstream artifacts stale, but leaves earlier-stage artifacts current", () => {
    logChangeEntryAndReenter(db, {
      dealId,
      summary: "Gap analysis needs rework",
      reason: null,
      requestedBy: "Tester",
      artifactTypeKeys: [stageArtifactType(3)], // Solution Options
    });

    const artifacts = db.prepare("SELECT * FROM artifacts WHERE deal_id = ?").all(dealId) as {
      artifact_type_key: string;
      status: string;
    }[];
    const byType = new Map(artifacts.map((a) => [a.artifact_type_key, a.status]));

    // Stages 1-2 (before the earliest affected stage) are untouched.
    expect(byType.get(stageArtifactType(1))).toBe("current");
    expect(byType.get(stageArtifactType(2))).toBe("current");
    // Stage 3 onward (at or after the earliest affected stage) is stale.
    expect(byType.get(stageArtifactType(3))).toBe("stale");
    expect(byType.get(stageArtifactType(4))).toBe("stale");
    expect(byType.get(stageArtifactType(5))).toBe("stale");
    expect(byType.get(stageArtifactType(6))).toBe("stale");
  });

  it("records directly_tagged vs downstream reasons in change_impacts", () => {
    const result = logChangeEntryAndReenter(db, {
      dealId,
      summary: "Scope doc needs rework",
      reason: null,
      requestedBy: "Tester",
      artifactTypeKeys: [stageArtifactType(4)],
    });

    const impacts = db
      .prepare("SELECT a.artifact_type_key, ci.reason FROM change_impacts ci JOIN artifacts a ON a.id = ci.artifact_id WHERE ci.change_entry_id = ?")
      .all(result.changeEntry.id) as { artifact_type_key: string; reason: string }[];
    const byType = new Map(impacts.map((i) => [i.artifact_type_key, i.reason]));

    expect(byType.get(stageArtifactType(4))).toBe("directly_tagged");
    expect(byType.get(stageArtifactType(5))).toBe("downstream");
    expect(byType.get(stageArtifactType(6))).toBe("downstream");
    expect(byType.has(stageArtifactType(3))).toBe(false);
  });

  it("completes the prior iteration and starts a new one at the next round number", () => {
    const result = logChangeEntryAndReenter(db, {
      dealId,
      summary: "Round 2 trigger",
      reason: null,
      requestedBy: "Tester",
      artifactTypeKeys: [stageArtifactType(4)],
    });

    const priorIteration = db.prepare("SELECT * FROM iterations WHERE id = 1").get() as { status: string };
    expect(priorIteration.status).toBe("complete");
    expect(result.newIteration.status).toBe("in_progress");
    expect(result.newIteration.round_number).toBe(2);
    expect(result.newIteration.trigger_change_entry_id).toBe(result.changeEntry.id);
    expect(result.changeEntry.resulting_iteration_id).toBe(result.newIteration.id);
  });

  it("supports multiple successive re-entries, each computed independently", () => {
    const first = logChangeEntryAndReenter(db, {
      dealId,
      summary: "First change",
      reason: null,
      requestedBy: "Tester",
      artifactTypeKeys: [stageArtifactType(5)],
    });
    expect(first.newIteration.round_number).toBe(2);
    expect(first.earliestAffectedStage.order_index).toBe(5);

    // A second, earlier-stage change entry logged in round 2 should push
    // the deal back further, to round 3 entering at stage 2.
    const second = logChangeEntryAndReenter(db, {
      dealId,
      summary: "Second, earlier change",
      reason: null,
      requestedBy: "Tester",
      artifactTypeKeys: [stageArtifactType(2)],
    });
    expect(second.newIteration.round_number).toBe(3);
    expect(second.earliestAffectedStage.order_index).toBe(2);
  });

  it("throws if the deal has no in-progress iteration", () => {
    db.prepare("UPDATE iterations SET status = 'complete' WHERE deal_id = ?").run(dealId);
    expect(() =>
      logChangeEntryAndReenter(db, {
        dealId,
        summary: "Should fail",
        reason: null,
        requestedBy: "Tester",
        artifactTypeKeys: [stageArtifactType(2)],
      })
    ).toThrow();
  });
});

describe("advanceToNextStage", () => {
  it("moves the deal to the next stage by order_index", () => {
    db.prepare("UPDATE deals SET current_stage_id = 2 WHERE id = ?").run(dealId);
    const next = advanceToNextStage(db, dealId);
    expect(next?.order_index).toBe(3);
    const deal = db.prepare("SELECT current_stage_id FROM deals WHERE id = ?").get(dealId) as {
      current_stage_id: number;
    };
    expect(deal.current_stage_id).toBe(next?.id);
  });

  it("returns null when already at the final stage", () => {
    db.prepare("UPDATE deals SET current_stage_id = 6 WHERE id = ?").run(dealId);
    const next = advanceToNextStage(db, dealId);
    expect(next).toBeNull();
  });
});

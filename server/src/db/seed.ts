// Seeds the database with configurable pipeline stages and a handful of
// FICTIONAL demo deals. No real customer data - this is local-only sample
// data to exercise the pipeline board, iteration timeline, and impact view.
import { db, resetDatabase } from "./index.js";

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().replace("T", " ").slice(0, 19);
}

function seed(): void {
  db.exec("PRAGMA foreign_keys = OFF;");
  for (const table of [
    "change_impacts",
    "change_entry_artifact_tags",
    "change_entries",
    "assumptions_risks",
    "deal_checklist_status",
    "artifacts",
    "iterations",
    "deals",
    "artifact_types",
    "stage_checklist_items",
    "stages",
  ]) {
    db.exec(`DELETE FROM ${table};`);
  }
  db.exec("PRAGMA foreign_keys = ON;");

  const insertStage = db.prepare("INSERT INTO stages (id, name, order_index) VALUES (?, ?, ?)");
  const stages = [
    [1, "Intake"],
    [2, "Discovery & Gap Analysis"],
    [3, "Solution Options"],
    [4, "Scope & Effort"],
    [5, "Internal Review"],
    [6, "Customer Readout"],
  ] as const;
  stages.forEach(([id, name], i) => insertStage.run(id, name, i + 1));

  const insertItem = db.prepare(
    "INSERT INTO stage_checklist_items (stage_id, text, order_index, is_required) VALUES (?, ?, ?, 1)"
  );
  const checklist: Record<number, string[]> = {
    1: [
      "Deal registered with sponsor and budget confirmed",
      "NDA / confidentiality agreement executed",
      "Initial customer discovery call scheduled",
    ],
    2: [
      "Current-state business processes documented",
      "Gap analysis workshop completed with customer SMEs",
      "Gaps categorized and prioritized with customer stakeholders",
    ],
    3: [
      "At least two solution options drafted (standard vs. custom)",
      "Options reviewed against customer's gap list",
      "Preferred option validated with customer sponsor",
    ],
    4: [
      "Scope document drafted covering all in-scope gaps",
      "Effort estimate built and cross-checked with delivery lead",
      "Assumptions and risks logged for the estimate",
    ],
    5: [
      "Solution reviewed by internal deal desk / architecture board",
      "Pricing and commercial terms sanity-checked",
      "Open risks have owners and mitigation plans",
    ],
    6: [
      "Readout deck finalized and internally approved",
      "Customer readout meeting scheduled",
      "Customer feedback captured and logged",
    ],
  };
  for (const [stageId, items] of Object.entries(checklist)) {
    items.forEach((text, i) => insertItem.run(Number(stageId), text, i + 1));
  }
  const itemIdsByStage: Record<number, number[]> = {};
  for (const stageId of Object.keys(checklist).map(Number)) {
    itemIdsByStage[stageId] = db
      .prepare("SELECT id FROM stage_checklist_items WHERE stage_id = ? ORDER BY order_index")
      .all(stageId)
      .map((r: any) => r.id);
  }

  const insertType = db.prepare(
    "INSERT INTO artifact_types (key, label, owning_stage_id) VALUES (?, ?, ?)"
  );
  const artifactTypes: [string, string, number][] = [
    ["intake_brief", "Intake Brief", 1],
    ["gap_analysis", "Gap Analysis", 2],
    ["solution_options_doc", "Solution Options Doc", 3],
    ["scope_doc", "Scope Document", 4],
    ["estimate", "Effort Estimate", 4],
    ["review_notes", "Internal Review Notes", 5],
    ["deck", "Customer Readout Deck", 6],
  ];
  for (const [key, label, stageId] of artifactTypes) insertType.run(key, label, stageId);

  const insertDeal = db.prepare(`
    INSERT INTO deals (name, customer, industry, description, status, current_stage_id, created_at, updated_at)
    VALUES (@name, @customer, @industry, @description, @status, @current_stage_id, @created_at, @updated_at)
  `);
  const insertIteration = db.prepare(`
    INSERT INTO iterations (deal_id, round_number, entry_stage_id, status, trigger_change_entry_id, started_at, completed_at)
    VALUES (@deal_id, @round_number, @entry_stage_id, @status, @trigger_change_entry_id, @started_at, @completed_at)
  `);
  const insertArtifact = db.prepare(`
    INSERT INTO artifacts (deal_id, artifact_type_key, name, version, iteration_id, status, notes, created_at)
    VALUES (@deal_id, @artifact_type_key, @name, @version, @iteration_id, @status, @notes, @created_at)
  `);
  const insertChecklistStatus = db.prepare(`
    INSERT INTO deal_checklist_status (deal_id, iteration_id, checklist_item_id, is_complete, completed_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertChangeEntry = db.prepare(`
    INSERT INTO change_entries (deal_id, iteration_id, summary, reason, requested_by, created_at, resulting_iteration_id)
    VALUES (@deal_id, @iteration_id, @summary, @reason, @requested_by, @created_at, @resulting_iteration_id)
  `);
  const insertTag = db.prepare(
    "INSERT INTO change_entry_artifact_tags (change_entry_id, artifact_type_key) VALUES (?, ?)"
  );
  const insertImpact = db.prepare(
    "INSERT INTO change_impacts (change_entry_id, artifact_id, reason) VALUES (?, ?, ?)"
  );
  const updateIterationTrigger = db.prepare(
    "UPDATE iterations SET trigger_change_entry_id = ? WHERE id = ?"
  );

  function completeStagesThrough(
    dealId: number,
    iterationId: number,
    entryStageOrder: number,
    fullyCompleteThroughOrder: number,
    partialStageOrder?: number,
    partialCount = 0
  ) {
    for (let order = entryStageOrder; order <= fullyCompleteThroughOrder; order++) {
      const stageId = order;
      for (const itemId of itemIdsByStage[stageId]) {
        insertChecklistStatus.run(dealId, iterationId, itemId, 1, daysAgo(1));
      }
    }
    if (partialStageOrder) {
      const items = itemIdsByStage[partialStageOrder];
      items.forEach((itemId, i) => {
        insertChecklistStatus.run(dealId, iterationId, itemId, i < partialCount ? 1 : 0, i < partialCount ? daysAgo(1) : null);
      });
    }
  }

  // --- Deal A: Northwind Refining - S/4HANA Rollout (round 1, mid-pipeline) ---
  const dealA = insertDeal.run({
    name: "S/4HANA Rollout",
    customer: "Northwind Refining",
    industry: "Oil & Gas",
    description: "Greenfield S/4HANA rollout across two refineries, replacing a legacy ERP.",
    status: "active",
    current_stage_id: 3,
    created_at: daysAgo(40),
    updated_at: daysAgo(2),
  }).lastInsertRowid as number;
  const iterA1 = insertIteration.run({
    deal_id: dealA,
    round_number: 1,
    entry_stage_id: 1,
    status: "in_progress",
    trigger_change_entry_id: null,
    started_at: daysAgo(40),
    completed_at: null,
  }).lastInsertRowid as number;
  insertArtifact.run({ deal_id: dealA, artifact_type_key: "intake_brief", name: "Intake Brief v1", version: 1, iteration_id: iterA1, status: "current", notes: null, created_at: daysAgo(38) });
  insertArtifact.run({ deal_id: dealA, artifact_type_key: "gap_analysis", name: "Gap Analysis v1", version: 1, iteration_id: iterA1, status: "current", notes: null, created_at: daysAgo(20) });
  completeStagesThrough(dealA, iterA1, 1, 2, 3, 1);

  // --- Deal D: Frontier Petrochemicals - Environmental Compliance Suite (just started) ---
  const dealD = insertDeal.run({
    name: "Environmental Compliance Suite",
    customer: "Frontier Petrochemicals",
    industry: "Oil & Gas",
    description: "Emissions tracking and regulatory reporting add-on for an existing SAP landscape.",
    status: "active",
    current_stage_id: 1,
    created_at: daysAgo(5),
    updated_at: daysAgo(1),
  }).lastInsertRowid as number;
  const iterD1 = insertIteration.run({
    deal_id: dealD,
    round_number: 1,
    entry_stage_id: 1,
    status: "in_progress",
    trigger_change_entry_id: null,
    started_at: daysAgo(5),
    completed_at: null,
  }).lastInsertRowid as number;
  completeStagesThrough(dealD, iterD1, 1, 0, 1, 1);

  // --- Deal B: Meridian Manufacturing - Plant Consolidation (round 2, re-entered at Scope & Effort) ---
  const dealB = insertDeal.run({
    name: "Plant Consolidation Program",
    customer: "Meridian Manufacturing",
    industry: "Manufacturing",
    description: "Consolidating four plant instances onto a single SAP tenant.",
    status: "active",
    current_stage_id: 4,
    created_at: daysAgo(90),
    updated_at: daysAgo(3),
  }).lastInsertRowid as number;
  const iterB1 = insertIteration.run({
    deal_id: dealB,
    round_number: 1,
    entry_stage_id: 1,
    status: "complete",
    trigger_change_entry_id: null,
    started_at: daysAgo(90),
    completed_at: daysAgo(30),
  }).lastInsertRowid as number;
  completeStagesThrough(dealB, iterB1, 1, 6);
  const b1Artifacts = {
    intake_brief: insertArtifact.run({ deal_id: dealB, artifact_type_key: "intake_brief", name: "Intake Brief v1", version: 1, iteration_id: iterB1, status: "current", notes: null, created_at: daysAgo(88) }).lastInsertRowid as number,
    gap_analysis: insertArtifact.run({ deal_id: dealB, artifact_type_key: "gap_analysis", name: "Gap Analysis v1", version: 1, iteration_id: iterB1, status: "current", notes: null, created_at: daysAgo(75) }).lastInsertRowid as number,
    solution_options_doc: insertArtifact.run({ deal_id: dealB, artifact_type_key: "solution_options_doc", name: "Solution Options v1", version: 1, iteration_id: iterB1, status: "current", notes: null, created_at: daysAgo(60) }).lastInsertRowid as number,
    scope_doc: insertArtifact.run({ deal_id: dealB, artifact_type_key: "scope_doc", name: "Scope Document v1", version: 1, iteration_id: iterB1, status: "superseded", notes: null, created_at: daysAgo(45) }).lastInsertRowid as number,
    estimate: insertArtifact.run({ deal_id: dealB, artifact_type_key: "estimate", name: "Effort Estimate v1", version: 1, iteration_id: iterB1, status: "superseded", notes: null, created_at: daysAgo(45) }).lastInsertRowid as number,
    review_notes: insertArtifact.run({ deal_id: dealB, artifact_type_key: "review_notes", name: "Internal Review Notes v1", version: 1, iteration_id: iterB1, status: "stale", notes: null, created_at: daysAgo(35) }).lastInsertRowid as number,
    deck: insertArtifact.run({ deal_id: dealB, artifact_type_key: "deck", name: "Readout Deck v1", version: 1, iteration_id: iterB1, status: "stale", notes: null, created_at: daysAgo(31) }).lastInsertRowid as number,
  };
  const changeB1 = insertChangeEntry.run({
    deal_id: dealB,
    iteration_id: iterB1,
    summary: "Customer added two more plants to consolidation scope after readout",
    reason: "Meridian's plant in Ohio and a newly acquired plant in Texas must now be included in the same wave.",
    requested_by: "J. Alvarez (Customer PMO)",
    created_at: daysAgo(30),
    resulting_iteration_id: null,
  }).lastInsertRowid as number;
  insertTag.run(changeB1, "scope_doc");
  insertTag.run(changeB1, "estimate");
  insertImpact.run(changeB1, b1Artifacts.scope_doc, "directly_tagged");
  insertImpact.run(changeB1, b1Artifacts.estimate, "directly_tagged");
  insertImpact.run(changeB1, b1Artifacts.review_notes, "downstream");
  insertImpact.run(changeB1, b1Artifacts.deck, "downstream");
  const iterB2 = insertIteration.run({
    deal_id: dealB,
    round_number: 2,
    entry_stage_id: 4,
    status: "in_progress",
    trigger_change_entry_id: changeB1,
    started_at: daysAgo(30),
    completed_at: null,
  }).lastInsertRowid as number;
  db.prepare("UPDATE change_entries SET resulting_iteration_id = ? WHERE id = ?").run(iterB2, changeB1);
  insertArtifact.run({ deal_id: dealB, artifact_type_key: "scope_doc", name: "Scope Document v2", version: 2, iteration_id: iterB2, status: "current", notes: "Adds Ohio and Texas plants", created_at: daysAgo(10) });
  insertArtifact.run({ deal_id: dealB, artifact_type_key: "estimate", name: "Effort Estimate v2", version: 2, iteration_id: iterB2, status: "current", notes: null, created_at: daysAgo(8) });
  completeStagesThrough(dealB, iterB2, 4, 3, 4, 2);

  // --- Deal C: Coastal Utilities - Grid Modernization (round 3, two change entries) ---
  const dealC = insertDeal.run({
    name: "Grid Modernization Program",
    customer: "Coastal Utilities",
    industry: "Utilities",
    description: "Smart-grid asset management and outage response solution across the service territory.",
    status: "active",
    current_stage_id: 5,
    created_at: daysAgo(150),
    updated_at: daysAgo(1),
  }).lastInsertRowid as number;
  const iterC1 = insertIteration.run({ deal_id: dealC, round_number: 1, entry_stage_id: 1, status: "complete", trigger_change_entry_id: null, started_at: daysAgo(150), completed_at: daysAgo(95) }).lastInsertRowid as number;
  completeStagesThrough(dealC, iterC1, 1, 6);
  const c1 = {
    intake_brief: insertArtifact.run({ deal_id: dealC, artifact_type_key: "intake_brief", name: "Intake Brief v1", version: 1, iteration_id: iterC1, status: "current", notes: null, created_at: daysAgo(148) }).lastInsertRowid as number,
    gap_analysis: insertArtifact.run({ deal_id: dealC, artifact_type_key: "gap_analysis", name: "Gap Analysis v1", version: 1, iteration_id: iterC1, status: "superseded", notes: null, created_at: daysAgo(130) }).lastInsertRowid as number,
    solution_options_doc: insertArtifact.run({ deal_id: dealC, artifact_type_key: "solution_options_doc", name: "Solution Options v1", version: 1, iteration_id: iterC1, status: "superseded", notes: null, created_at: daysAgo(115) }).lastInsertRowid as number,
    scope_doc: insertArtifact.run({ deal_id: dealC, artifact_type_key: "scope_doc", name: "Scope Document v1", version: 1, iteration_id: iterC1, status: "superseded", notes: null, created_at: daysAgo(105) }).lastInsertRowid as number,
    estimate: insertArtifact.run({ deal_id: dealC, artifact_type_key: "estimate", name: "Effort Estimate v1", version: 1, iteration_id: iterC1, status: "superseded", notes: null, created_at: daysAgo(105) }).lastInsertRowid as number,
    review_notes: insertArtifact.run({ deal_id: dealC, artifact_type_key: "review_notes", name: "Internal Review Notes v1", version: 1, iteration_id: iterC1, status: "superseded", notes: null, created_at: daysAgo(98) }).lastInsertRowid as number,
    deck: insertArtifact.run({ deal_id: dealC, artifact_type_key: "deck", name: "Readout Deck v1", version: 1, iteration_id: iterC1, status: "superseded", notes: null, created_at: daysAgo(96) }).lastInsertRowid as number,
  };
  const changeC1 = insertChangeEntry.run({
    deal_id: dealC,
    iteration_id: iterC1,
    summary: "Customer flagged a missed integration with their existing outage management system",
    reason: "OMS integration was assumed out of scope but is actually required for go-live.",
    requested_by: "R. Chen (Customer IT Director)",
    created_at: daysAgo(95),
    resulting_iteration_id: null,
  }).lastInsertRowid as number;
  insertTag.run(changeC1, "gap_analysis");
  insertImpact.run(changeC1, c1.gap_analysis, "directly_tagged");
  insertImpact.run(changeC1, c1.solution_options_doc, "downstream");
  insertImpact.run(changeC1, c1.scope_doc, "downstream");
  insertImpact.run(changeC1, c1.estimate, "downstream");
  insertImpact.run(changeC1, c1.review_notes, "downstream");
  insertImpact.run(changeC1, c1.deck, "downstream");
  const iterC2 = insertIteration.run({ deal_id: dealC, round_number: 2, entry_stage_id: 2, status: "complete", trigger_change_entry_id: changeC1, started_at: daysAgo(95), completed_at: daysAgo(25) }).lastInsertRowid as number;
  db.prepare("UPDATE change_entries SET resulting_iteration_id = ? WHERE id = ?").run(iterC2, changeC1);
  completeStagesThrough(dealC, iterC2, 2, 6);
  const c2 = {
    gap_analysis: insertArtifact.run({ deal_id: dealC, artifact_type_key: "gap_analysis", name: "Gap Analysis v2", version: 2, iteration_id: iterC2, status: "current", notes: "Adds OMS integration gap", created_at: daysAgo(90) }).lastInsertRowid as number,
    solution_options_doc: insertArtifact.run({ deal_id: dealC, artifact_type_key: "solution_options_doc", name: "Solution Options v2", version: 2, iteration_id: iterC2, status: "current", notes: null, created_at: daysAgo(75) }).lastInsertRowid as number,
    scope_doc: insertArtifact.run({ deal_id: dealC, artifact_type_key: "scope_doc", name: "Scope Document v2", version: 2, iteration_id: iterC2, status: "superseded", notes: null, created_at: daysAgo(60) }).lastInsertRowid as number,
    estimate: insertArtifact.run({ deal_id: dealC, artifact_type_key: "estimate", name: "Effort Estimate v2", version: 2, iteration_id: iterC2, status: "superseded", notes: null, created_at: daysAgo(60) }).lastInsertRowid as number,
    review_notes: insertArtifact.run({ deal_id: dealC, artifact_type_key: "review_notes", name: "Internal Review Notes v2", version: 2, iteration_id: iterC2, status: "stale", notes: null, created_at: daysAgo(50) }).lastInsertRowid as number,
    deck: insertArtifact.run({ deal_id: dealC, artifact_type_key: "deck", name: "Readout Deck v2", version: 2, iteration_id: iterC2, status: "stale", notes: null, created_at: daysAgo(26) }).lastInsertRowid as number,
  };
  const changeC2 = insertChangeEntry.run({
    deal_id: dealC,
    iteration_id: iterC2,
    summary: "Customer wants one substation removed from scope to hit budget",
    reason: "Budget pressure from the customer's capital committee; substation 4 can be phased separately.",
    requested_by: "R. Chen (Customer IT Director)",
    created_at: daysAgo(25),
    resulting_iteration_id: null,
  }).lastInsertRowid as number;
  insertTag.run(changeC2, "scope_doc");
  insertTag.run(changeC2, "estimate");
  insertImpact.run(changeC2, c2.scope_doc, "directly_tagged");
  insertImpact.run(changeC2, c2.estimate, "directly_tagged");
  insertImpact.run(changeC2, c2.review_notes, "downstream");
  insertImpact.run(changeC2, c2.deck, "downstream");
  const iterC3 = insertIteration.run({ deal_id: dealC, round_number: 3, entry_stage_id: 4, status: "in_progress", trigger_change_entry_id: changeC2, started_at: daysAgo(25), completed_at: null }).lastInsertRowid as number;
  db.prepare("UPDATE change_entries SET resulting_iteration_id = ? WHERE id = ?").run(iterC3, changeC2);
  insertArtifact.run({ deal_id: dealC, artifact_type_key: "scope_doc", name: "Scope Document v3", version: 3, iteration_id: iterC3, status: "current", notes: "Removes substation 4", created_at: daysAgo(15) });
  insertArtifact.run({ deal_id: dealC, artifact_type_key: "estimate", name: "Effort Estimate v3", version: 3, iteration_id: iterC3, status: "current", notes: null, created_at: daysAgo(12) });
  completeStagesThrough(dealC, iterC3, 4, 4, 5, 1);

  // --- Assumptions & risks ---
  const insertRisk = db.prepare(`
    INSERT INTO assumptions_risks (deal_id, iteration_id, type, description, status, created_at)
    VALUES (@deal_id, @iteration_id, @type, @description, @status, @created_at)
  `);
  insertRisk.run({ deal_id: dealB, iteration_id: iterB2, type: "risk", description: "Texas plant network team has not confirmed cutover window availability.", status: "open", created_at: daysAgo(9) });
  insertRisk.run({ deal_id: dealB, iteration_id: iterB1, type: "assumption", description: "Existing data migration tooling from wave 1 can be reused for new plants.", status: "accepted", created_at: daysAgo(44) });
  insertRisk.run({ deal_id: dealC, iteration_id: iterC3, type: "risk", description: "Removing substation 4 may require re-negotiating the phase-2 SOW timeline.", status: "open", created_at: daysAgo(14) });
  insertRisk.run({ deal_id: dealC, iteration_id: iterC2, type: "assumption", description: "OMS integration uses a documented REST API with no legacy SOAP fallback needed.", status: "resolved", created_at: daysAgo(88) });
  insertRisk.run({ deal_id: dealA, iteration_id: iterA1, type: "risk", description: "Second refinery site has not yet confirmed its go-live blackout window.", status: "open", created_at: daysAgo(15) });

  console.log("Seed complete:");
  console.log(`  Deals: ${(db.prepare("SELECT COUNT(*) c FROM deals").get() as any).c}`);
  console.log(`  Iterations: ${(db.prepare("SELECT COUNT(*) c FROM iterations").get() as any).c}`);
  console.log(`  Artifacts: ${(db.prepare("SELECT COUNT(*) c FROM artifacts").get() as any).c}`);
  console.log(`  Change entries: ${(db.prepare("SELECT COUNT(*) c FROM change_entries").get() as any).c}`);
}

resetDatabase();
seed();

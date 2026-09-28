-- Deal Tracker schema. All data stays local in SQLite; no external services.

PRAGMA foreign_keys = ON;

-- Configurable pipeline stages, in default order.
CREATE TABLE IF NOT EXISTS stages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  order_index INTEGER NOT NULL UNIQUE
);

-- Editable exit-criteria checklist template for each stage.
CREATE TABLE IF NOT EXISTS stage_checklist_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stage_id INTEGER NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  is_required INTEGER NOT NULL DEFAULT 1
);

-- Artifact categories (gap analysis, scope doc, deck, estimate, ...) and the
-- stage that "owns" them. Used to compute the earliest affected stage when a
-- change entry tags artifacts, and to cascade staleness downstream.
CREATE TABLE IF NOT EXISTS artifact_types (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  owning_stage_id INTEGER NOT NULL REFERENCES stages(id)
);

CREATE TABLE IF NOT EXISTS deals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  customer TEXT NOT NULL,
  industry TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'won', 'lost')),
  current_stage_id INTEGER NOT NULL REFERENCES stages(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One row per iteration round for a deal. Round 1 has no trigger; every
-- later round was caused by a change entry logged against the prior round.
CREATE TABLE IF NOT EXISTS iterations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deal_id INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  entry_stage_id INTEGER NOT NULL REFERENCES stages(id),
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'complete')),
  trigger_change_entry_id INTEGER, -- change_entries.id that caused this round; null for round 1
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  UNIQUE (deal_id, round_number)
);

-- Per-iteration checklist completion (a stage revisited in a later round
-- starts its checklist over).
CREATE TABLE IF NOT EXISTS deal_checklist_status (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deal_id INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  iteration_id INTEGER NOT NULL REFERENCES iterations(id) ON DELETE CASCADE,
  checklist_item_id INTEGER NOT NULL REFERENCES stage_checklist_items(id),
  is_complete INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  UNIQUE (iteration_id, checklist_item_id)
);

CREATE TABLE IF NOT EXISTS artifacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deal_id INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  artifact_type_key TEXT NOT NULL REFERENCES artifact_types(key),
  name TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  iteration_id INTEGER NOT NULL REFERENCES iterations(id),
  status TEXT NOT NULL DEFAULT 'current' CHECK (status IN ('current', 'stale', 'superseded')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- A logged customer/internal feedback event. Tags which artifact types it
-- affects; the deal re-enters at the earliest stage among those types.
CREATE TABLE IF NOT EXISTS change_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deal_id INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  iteration_id INTEGER NOT NULL REFERENCES iterations(id), -- iteration this change was logged against
  summary TEXT NOT NULL,
  reason TEXT,
  requested_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resulting_iteration_id INTEGER REFERENCES iterations(id) -- the new round this change spawned
);

CREATE TABLE IF NOT EXISTS change_entry_artifact_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  change_entry_id INTEGER NOT NULL REFERENCES change_entries(id) ON DELETE CASCADE,
  artifact_type_key TEXT NOT NULL REFERENCES artifact_types(key),
  UNIQUE (change_entry_id, artifact_type_key)
);

-- Records exactly which artifacts a change entry marked stale, and why
-- (directly tagged vs. downstream of an earlier stage), for the impact view.
CREATE TABLE IF NOT EXISTS change_impacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  change_entry_id INTEGER NOT NULL REFERENCES change_entries(id) ON DELETE CASCADE,
  artifact_id INTEGER NOT NULL REFERENCES artifacts(id),
  reason TEXT NOT NULL CHECK (reason IN ('directly_tagged', 'downstream'))
);

CREATE TABLE IF NOT EXISTS assumptions_risks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deal_id INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  iteration_id INTEGER REFERENCES iterations(id),
  type TEXT NOT NULL CHECK (type IN ('assumption', 'risk')),
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'accepted')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_iterations_deal ON iterations(deal_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_deal ON artifacts(deal_id);
CREATE INDEX IF NOT EXISTS idx_change_entries_deal ON change_entries(deal_id);
CREATE INDEX IF NOT EXISTS idx_checklist_status_iteration ON deal_checklist_status(iteration_id);

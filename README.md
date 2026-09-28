# Deal Solutioning Tracker

Local-only MVP for tracking large enterprise SAP deals through structured
solutioning stages, including repeated iteration rounds triggered by customer
feedback. All data stays on your machine in a SQLite file - there are no
external services or network calls, and the seed data is entirely fictional.

## Stack

- **server/**: Node + Express + TypeScript API, SQLite via `better-sqlite3`.
- **client/**: React + Vite + TypeScript, plain CSS.

## Core concept: iteration rounds

A deal moves through six configurable stages (Intake → Discovery & Gap
Analysis → Solution Options → Scope & Effort → Internal Review → Customer
Readout), each with an editable checklist of exit criteria.

When customer feedback arrives, you log a **change entry**: what changed, why,
who asked, and which artifact types it affects (gap analysis, scope doc,
deck, estimate, ...). The deal then opens a new **iteration round** and
re-enters at the *earliest* stage among the affected artifact types - not
necessarily stage 1. All artifacts owned by that stage or any stage after it
are marked stale; the impact view shows exactly which ones and why. This
rule lives in one module, `server/src/services/reentry.ts`, and is covered by
`server/tests/reentry.test.ts`.

## Screens

1. **Pipeline board** - deals as cards grouped by current stage.
2. **Deal detail** - stage stepper (with the round's re-entry point marked),
   checklist for the current stage, artifact list, assumptions/risks.
3. **Iteration timeline** - every round in order with its change entries.
4. **Impact view** - for a change entry, which artifacts are now stale,
   split into directly tagged vs. downstream.

## Running it locally

```bash
# API (http://localhost:4000)
cd server
npm install
npm run seed   # populates SQLite with fictional demo deals
npm run dev

# Client (http://localhost:5173), in a second terminal
cd client
npm install
npm run dev
```

The Vite dev server proxies `/api` to `http://localhost:4000`.

## Tests

```bash
cd server
npm test
```

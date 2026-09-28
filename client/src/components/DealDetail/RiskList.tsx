import { useState } from "react";
import { api } from "../../api/client";
import type { AssumptionRisk } from "../../types";

interface Props {
  dealId: number;
  risks: AssumptionRisk[];
  onChanged: () => void;
}

export default function RiskList({ dealId, risks, onChanged }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<"assumption" | "risk">("risk");
  const [description, setDescription] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!description) return;
    await api.createRisk(dealId, { type, description });
    setDescription("");
    setShowForm(false);
    onChanged();
  }

  async function cycleStatus(risk: AssumptionRisk) {
    const next = risk.status === "open" ? "resolved" : risk.status === "resolved" ? "accepted" : "open";
    await api.updateRiskStatus(risk.id, next);
    onChanged();
  }

  return (
    <div className="panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>Assumptions & risks</h3>
        <button className="link-btn" onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Cancel" : "+ Add"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} style={{ display: "flex", gap: 8, margin: "10px 0" }}>
          <select value={type} onChange={(e) => setType(e.target.value as "assumption" | "risk")}>
            <option value="risk">Risk</option>
            <option value="assumption">Assumption</option>
          </select>
          <input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <button className="btn btn-primary" type="submit">
            Save
          </button>
        </form>
      )}

      {risks.length === 0 && <div className="empty-state">None logged.</div>}
      {risks.map((r) => (
        <div className="risk-row" key={r.id}>
          <div>
            <span className="badge badge-stale" style={{ marginRight: 6 }}>
              {r.type}
            </span>
            {r.description}
          </div>
          <button className="btn" onClick={() => cycleStatus(r)} title="Click to cycle status">
            {r.status}
          </button>
        </div>
      ))}
    </div>
  );
}

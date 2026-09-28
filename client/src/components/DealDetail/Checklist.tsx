import { useState } from "react";
import { api } from "../../api/client";
import type { ChecklistEntry } from "../../types";

interface Props {
  dealId: number;
  checklist: ChecklistEntry[];
  onChanged: () => void;
}

export default function Checklist({ dealId, checklist, onChanged }: Props) {
  const [advancing, setAdvancing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requiredIncomplete = checklist.filter((c) => c.is_required && !c.is_complete).length;

  async function toggle(itemId: number) {
    await api.toggleChecklistItem(dealId, itemId);
    onChanged();
  }

  async function advance() {
    setAdvancing(true);
    setError(null);
    setMessage(null);
    try {
      const result = await api.advanceDeal(dealId);
      setMessage(result.done ? result.message ?? "Final stage complete" : `Advanced to ${result.nextStage?.name}`);
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAdvancing(false);
    }
  }

  return (
    <div className="panel">
      <h3>Exit criteria checklist</h3>
      {checklist.length === 0 && <div className="empty-state">No checklist items for this stage.</div>}
      {checklist.map((item) => (
        <label className={`checklist-row ${item.is_complete ? "complete" : ""}`} key={item.id}>
          <input type="checkbox" checked={item.is_complete} onChange={() => toggle(item.id)} />
          <span>{item.text}</span>
          {!item.is_required && <span className="artifact-meta">(optional)</span>}
        </label>
      ))}
      {error && <div className="error-banner" style={{ marginTop: 10 }}>{error}</div>}
      {message && <div style={{ fontSize: 12, color: "var(--success)", marginTop: 10 }}>{message}</div>}
      <div style={{ marginTop: 12 }}>
        <button className="btn btn-primary" onClick={advance} disabled={advancing || requiredIncomplete > 0}>
          {advancing ? "Advancing…" : "Advance to next stage"}
        </button>
        {requiredIncomplete > 0 && (
          <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 10 }}>
            {requiredIncomplete} required item{requiredIncomplete > 1 ? "s" : ""} remaining
          </span>
        )}
      </div>
    </div>
  );
}

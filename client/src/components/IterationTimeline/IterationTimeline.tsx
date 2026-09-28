import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { IterationTimelineEntry } from "../../types";
import ImpactView from "../ImpactView/ImpactView";

interface Props {
  dealId: number;
}

export default function IterationTimeline({ dealId }: Props) {
  const [entries, setEntries] = useState<IterationTimelineEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedChangeEntryId, setSelectedChangeEntryId] = useState<number | null>(null);

  useEffect(() => {
    api
      .getIterations(dealId)
      .then(setEntries)
      .catch((err) => setError((err as Error).message));
  }, [dealId]);

  if (selectedChangeEntryId !== null) {
    return <ImpactView changeEntryId={selectedChangeEntryId} onBack={() => setSelectedChangeEntryId(null)} />;
  }

  if (error) return <div className="error-banner">{error}</div>;

  return (
    <div className="timeline">
      {entries.map(({ iteration, entryStage, triggerChangeEntry, changeEntriesLogged }) => (
        <div className="timeline-round" key={iteration.id}>
          <div className="timeline-marker">
            <div className="dot">R{iteration.round_number}</div>
          </div>
          <div className="timeline-content">
            <h4>
              Round {iteration.round_number} - entered at {entryStage.name}
            </h4>
            <div className="artifact-meta">
              {new Date(iteration.started_at).toLocaleDateString()}
              {iteration.completed_at && ` → ${new Date(iteration.completed_at).toLocaleDateString()}`}
              {" · "}
              {iteration.status === "in_progress" ? "in progress" : "complete"}
            </div>
            {triggerChangeEntry && (
              <div className="artifact-meta" style={{ marginTop: 6 }}>
                Triggered by change entry: <em>{triggerChangeEntry.summary}</em>
              </div>
            )}
            {changeEntriesLogged.map((ce) => (
              <div className="change-entry-card" key={ce.id} onClick={() => setSelectedChangeEntryId(ce.id)}>
                <strong>{ce.summary}</strong>
                <div className="artifact-meta">
                  by {ce.requested_by} on {new Date(ce.created_at).toLocaleDateString()} · tags:{" "}
                  {ce.tags.join(", ")}
                </div>
                {ce.reason && <div style={{ marginTop: 4 }}>{ce.reason}</div>}
                <div className="link-btn" style={{ marginTop: 6 }}>
                  View impact →
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {entries.length === 0 && <div className="empty-state">No iterations yet.</div>}
    </div>
  );
}

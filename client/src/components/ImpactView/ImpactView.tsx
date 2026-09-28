import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { ImpactedArtifact } from "../../types";

interface Props {
  changeEntryId: number;
  onBack: () => void;
}

const statusClass: Record<ImpactedArtifact["status"], string> = {
  current: "badge-current",
  stale: "badge-stale",
  superseded: "badge-superseded",
};

export default function ImpactView({ changeEntryId, onBack }: Props) {
  const [impact, setImpact] = useState<ImpactedArtifact[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getImpact(changeEntryId)
      .then(setImpact)
      .catch((err) => setError((err as Error).message));
  }, [changeEntryId]);

  const directlyTagged = impact?.filter((a) => a.reason === "directly_tagged") ?? [];
  const downstream = impact?.filter((a) => a.reason === "downstream") ?? [];

  return (
    <div className="panel">
      <div className="impact-header">
        <h3 style={{ margin: 0 }}>Impact of this change</h3>
        <button className="link-btn" onClick={onBack}>
          ← Back to timeline
        </button>
      </div>
      {error && <div className="error-banner">{error}</div>}
      {impact && impact.length === 0 && <div className="empty-state">No artifacts were affected.</div>}

      {directlyTagged.length > 0 && (
        <>
          <h4 style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase" }}>
            Directly tagged
          </h4>
          {directlyTagged.map((a) => (
            <ImpactRow key={a.id} artifact={a} />
          ))}
        </>
      )}

      {downstream.length > 0 && (
        <>
          <h4 style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", marginTop: 16 }}>
            Downstream (built on top of the changed stage)
          </h4>
          {downstream.map((a) => (
            <ImpactRow key={a.id} artifact={a} />
          ))}
        </>
      )}
    </div>
  );
}

function ImpactRow({ artifact }: { artifact: ImpactedArtifact }) {
  return (
    <div className="impact-artifact">
      <div>
        <div>{artifact.name}</div>
        <div className="reason-tag">
          {artifact.artifact_label} · {artifact.owning_stage_name} · v{artifact.version}
        </div>
      </div>
      <span className={`badge ${statusClass[artifact.status]}`}>{artifact.status}</span>
    </div>
  );
}

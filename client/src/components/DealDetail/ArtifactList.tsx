import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { Artifact, ArtifactType } from "../../types";

interface Props {
  dealId: number;
  artifacts: Artifact[];
  onChanged: () => void;
}

const statusClass: Record<Artifact["status"], string> = {
  current: "badge-current",
  stale: "badge-stale",
  superseded: "badge-superseded",
};

export default function ArtifactList({ dealId, artifacts, onChanged }: Props) {
  const [types, setTypes] = useState<ArtifactType[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [typeKey, setTypeKey] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getArtifactTypes().then((t) => {
      setTypes(t);
      setTypeKey(t[0]?.key ?? "");
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!typeKey || !name) {
      setError("Artifact type and name are required");
      return;
    }
    try {
      await api.createArtifact(dealId, { artifact_type_key: typeKey, name });
      setName("");
      setShowForm(false);
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>Artifacts</h3>
        <button className="link-btn" onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Cancel" : "+ Publish version"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} style={{ display: "flex", gap: 8, margin: "10px 0" }}>
          <select value={typeKey} onChange={(e) => setTypeKey(e.target.value)}>
            {types.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label} ({t.owning_stage_name})
              </option>
            ))}
          </select>
          <input placeholder="Artifact name" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn btn-primary" type="submit">
            Save
          </button>
        </form>
      )}
      {error && <div className="error-banner">{error}</div>}

      {artifacts.length === 0 && <div className="empty-state">No artifacts yet.</div>}
      {artifacts.map((a) => (
        <div className="artifact-row" key={a.id}>
          <div>
            <div>{a.name}</div>
            <div className="artifact-meta">
              v{a.version} · {new Date(a.created_at).toLocaleDateString()}
            </div>
          </div>
          <span className={`badge ${statusClass[a.status]}`}>{a.status}</span>
        </div>
      ))}
    </div>
  );
}

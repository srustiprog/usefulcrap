import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { ArtifactType } from "../../types";

interface Props {
  dealId: number;
  onLogged: (resultMessage: string) => void;
}

export default function ChangeEntryForm({ dealId, onLogged }: Props) {
  const [types, setTypes] = useState<ArtifactType[]>([]);
  const [summary, setSummary] = useState("");
  const [reason, setReason] = useState("");
  const [requestedBy, setRequestedBy] = useState("");
  const [tags, setTags] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    api.getArtifactTypes().then(setTypes);
  }, []);

  function toggleTag(key: string) {
    setTags((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!summary || !requestedBy || tags.size === 0) {
      setError("Summary, requested by, and at least one affected artifact are required");
      return;
    }
    setSaving(true);
    try {
      const result = await api.logChangeEntry(dealId, {
        summary,
        reason: reason || undefined,
        requestedBy,
        artifactTypeKeys: Array.from(tags),
      });
      setSummary("");
      setReason("");
      setRequestedBy("");
      setTags(new Set());
      setOpen(false);
      onLogged(
        `Round ${result.newIteration.round_number} started - deal re-entered at "${result.earliestAffectedStage.name}"`
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <div className="panel">
        <button className="btn btn-primary" onClick={() => setOpen(true)}>
          + Log change entry
        </button>
      </div>
    );
  }

  return (
    <div className="panel">
      <h3>Log a change entry</h3>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: -6 }}>
        Tag which artifacts this feedback affects. The deal will re-enter at the earliest stage among them.
      </p>
      <form className="change-entry-form" onSubmit={submit}>
        <input
          placeholder="What changed? (summary)"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
        />
        <input placeholder="Why? (reason, optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <input
          placeholder="Who asked? (requested by)"
          value={requestedBy}
          onChange={(e) => setRequestedBy(e.target.value)}
        />
        <div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>Affected artifacts</div>
          <div className="tag-checkboxes">
            {types.map((t) => (
              <span
                key={t.key}
                className={`tag-checkbox ${tags.has(t.key) ? "checked" : ""}`}
                onClick={() => toggleTag(t.key)}
              >
                {t.label}
              </span>
            ))}
          </div>
        </div>
        {error && <div className="error-banner">{error}</div>}
        <div>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? "Logging…" : "Log change & re-enter"}
          </button>
          <button className="btn" type="button" style={{ marginLeft: 8 }} onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

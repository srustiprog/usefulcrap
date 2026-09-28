import { useState } from "react";
import { api } from "../../api/client";

interface Props {
  onCreated: () => void;
}

export default function NewDealForm({ onCreated }: Props) {
  const [name, setName] = useState("");
  const [customer, setCustomer] = useState("");
  const [industry, setIndustry] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name || !customer || !industry) {
      setError("Name, customer and industry are required");
      return;
    }
    setSaving(true);
    try {
      await api.createDeal({ name, customer, industry, description: description || undefined });
      onCreated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="new-deal-form" onSubmit={submit}>
      {error && <div className="error-banner full-row">{error}</div>}
      <input placeholder="Deal name" value={name} onChange={(e) => setName(e.target.value)} />
      <input placeholder="Customer" value={customer} onChange={(e) => setCustomer(e.target.value)} />
      <input placeholder="Industry" value={industry} onChange={(e) => setIndustry(e.target.value)} />
      <div />
      <textarea
        className="full-row"
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
      />
      <div className="full-row">
        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? "Creating…" : "Create deal"}
        </button>
      </div>
    </form>
  );
}

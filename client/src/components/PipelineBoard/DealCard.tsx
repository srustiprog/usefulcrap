import type { DealSummary } from "../../types";

interface Props {
  deal: DealSummary;
  onClick: () => void;
}

export default function DealCard({ deal, onClick }: Props) {
  const pct = deal.checklist_progress.total
    ? Math.round((deal.checklist_progress.complete / deal.checklist_progress.total) * 100)
    : 0;

  return (
    <div className="deal-card" onClick={onClick}>
      <div className="deal-name">{deal.name}</div>
      <div className="deal-customer">
        {deal.customer} · {deal.industry}
      </div>
      <div className="deal-meta">
        <span className="round-badge">Round {deal.iteration?.round_number ?? 1}</span>
        <span>
          {deal.checklist_progress.complete}/{deal.checklist_progress.total} checklist
        </span>
      </div>
      <div className="progress-bar">
        <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

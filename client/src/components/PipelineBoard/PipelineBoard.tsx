import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { DealSummary, Stage } from "../../types";
import DealCard from "./DealCard";
import NewDealForm from "./NewDealForm";

interface Props {
  onSelectDeal: (dealId: number) => void;
}

export default function PipelineBoard({ onSelectDeal }: Props) {
  const [stages, setStages] = useState<Stage[]>([]);
  const [deals, setDeals] = useState<DealSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showNewDeal, setShowNewDeal] = useState(false);

  async function load() {
    try {
      const [stageList, dealList] = await Promise.all([api.getStages(), api.getDeals()]);
      setStages(stageList);
      setDeals(dealList);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Pipeline board</h2>
        <button className="btn btn-primary" onClick={() => setShowNewDeal((s) => !s)}>
          {showNewDeal ? "Cancel" : "+ New deal"}
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {showNewDeal && (
        <NewDealForm
          onCreated={() => {
            setShowNewDeal(false);
            load();
          }}
        />
      )}

      <div className="board-columns">
        {stages.map((stage) => (
          <div className="board-column" key={stage.id}>
            <h3>{stage.name}</h3>
            {deals
              .filter((d) => d.current_stage_id === stage.id)
              .map((deal) => (
                <DealCard key={deal.id} deal={deal} onClick={() => onSelectDeal(deal.id)} />
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}

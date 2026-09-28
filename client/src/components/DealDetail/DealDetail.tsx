import { useCallback, useEffect, useState } from "react";
import { api } from "../../api/client";
import type { DealDetail as DealDetailData } from "../../types";
import ArtifactList from "./ArtifactList";
import ChangeEntryForm from "./ChangeEntryForm";
import Checklist from "./Checklist";
import RiskList from "./RiskList";
import StageStepper from "./StageStepper";
import IterationTimeline from "../IterationTimeline/IterationTimeline";

interface Props {
  dealId: number;
}

type Tab = "overview" | "timeline";

export default function DealDetail({ dealId }: Props) {
  const [data, setData] = useState<DealDetailData | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const detail = await api.getDeal(dealId);
      setData(detail);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [dealId]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <div className="error-banner">{error}</div>;
  if (!data) return <div className="empty-state">Loading…</div>;

  const { deal, stages, currentIteration, iterationCount, checklist, artifacts, risks } = data;

  return (
    <div>
      <div className="deal-header">
        <div>
          <h2>{deal.name}</h2>
          <div className="deal-sub">
            {deal.customer} · {deal.industry} · {deal.status}
          </div>
        </div>
        <span className="round-badge">
          Round {currentIteration.round_number} of {iterationCount}
        </span>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === "overview" ? "active" : ""}`} onClick={() => setTab("overview")}>
          Overview
        </button>
        <button className={`tab ${tab === "timeline" ? "active" : ""}`} onClick={() => setTab("timeline")}>
          Iteration timeline
        </button>
      </div>

      {notice && <div style={{ fontSize: 13, color: "var(--success)", marginBottom: 12 }}>{notice}</div>}

      {tab === "overview" && (
        <>
          <div className="panel">
            <h3>Stage progress</h3>
            <StageStepper stages={stages} currentStageId={deal.current_stage_id} iteration={currentIteration} />
          </div>
          <Checklist dealId={dealId} checklist={checklist} onChanged={load} />
          <ArtifactList dealId={dealId} artifacts={artifacts} onChanged={load} />
          <RiskList dealId={dealId} risks={risks} onChanged={load} />
          <ChangeEntryForm
            dealId={dealId}
            onLogged={(message) => {
              setNotice(message);
              setTab("timeline");
              load();
            }}
          />
        </>
      )}

      {tab === "timeline" && <IterationTimeline dealId={dealId} />}
    </div>
  );
}

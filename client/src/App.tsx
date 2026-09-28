import { useState } from "react";
import PipelineBoard from "./components/PipelineBoard/PipelineBoard";
import DealDetail from "./components/DealDetail/DealDetail";

type View = { screen: "board" } | { screen: "deal"; dealId: number };

export default function App() {
  const [view, setView] = useState<View>({ screen: "board" });

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>Deal Solutioning Tracker</h1>
          <div className="subtitle">Local-only · SAP solutioning pipeline</div>
        </div>
        {view.screen !== "board" && (
          <button className="btn" onClick={() => setView({ screen: "board" })}>
            ← Pipeline board
          </button>
        )}
      </header>
      <main className="app-main">
        {view.screen === "board" && (
          <PipelineBoard onSelectDeal={(dealId) => setView({ screen: "deal", dealId })} />
        )}
        {view.screen === "deal" && <DealDetail dealId={view.dealId} />}
      </main>
    </div>
  );
}

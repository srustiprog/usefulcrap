import type { Iteration, Stage } from "../../types";

interface Props {
  stages: Stage[];
  currentStageId: number;
  iteration: Iteration;
}

export default function StageStepper({ stages, currentStageId, iteration }: Props) {
  const currentStage = stages.find((s) => s.id === currentStageId);

  return (
    <div>
      <div className="stepper">
        {stages.map((stage, i) => {
          const isDone = currentStage ? stage.order_index < currentStage.order_index : false;
          const isCurrent = stage.id === currentStageId;
          const isEntry = stage.id === iteration.entry_stage_id;
          const classes = ["stepper-step", isDone && "done", isCurrent && "current", isEntry && "entry"]
            .filter(Boolean)
            .join(" ");
          return (
            <div className="stepper-step-wrap" key={stage.id} style={{ display: "contents" }}>
              <div className={classes}>
                <div className="stepper-dot">{isDone ? "✓" : stage.order_index}</div>
                <span>{stage.name}</span>
              </div>
              {i < stages.length - 1 && <div className="stepper-line" />}
            </div>
          );
        })}
      </div>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 12 }}>
        Round {iteration.round_number} re-entered at <strong>{stages.find((s) => s.id === iteration.entry_stage_id)?.name}</strong> (orange dot)
        {iteration.status === "complete" && " · this round is complete"}
      </p>
    </div>
  );
}

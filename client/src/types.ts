export type DealStatus = "active" | "won" | "lost";
export type IterationStatus = "in_progress" | "complete";
export type ArtifactStatus = "current" | "stale" | "superseded";
export type ImpactReason = "directly_tagged" | "downstream";
export type RiskType = "assumption" | "risk";
export type RiskStatus = "open" | "resolved" | "accepted";

export interface Stage {
  id: number;
  name: string;
  order_index: number;
}

export interface StageChecklistItem {
  id: number;
  stage_id: number;
  text: string;
  order_index: number;
  is_required: number;
}

export interface ChecklistEntry extends StageChecklistItem {
  is_complete: boolean;
  completed_at: string | null;
}

export interface ArtifactType {
  key: string;
  label: string;
  owning_stage_id: number;
  owning_stage_name: string;
  owning_stage_order: number;
}

export interface Deal {
  id: number;
  name: string;
  customer: string;
  industry: string;
  description: string | null;
  status: DealStatus;
  current_stage_id: number;
  created_at: string;
  updated_at: string;
}

export interface Iteration {
  id: number;
  deal_id: number;
  round_number: number;
  entry_stage_id: number;
  status: IterationStatus;
  trigger_change_entry_id: number | null;
  started_at: string;
  completed_at: string | null;
}

export interface DealSummary extends Deal {
  stage: Stage;
  iteration: Iteration | null;
  checklist_progress: { total: number; complete: number };
}

export interface Artifact {
  id: number;
  deal_id: number;
  artifact_type_key: string;
  name: string;
  version: number;
  iteration_id: number;
  status: ArtifactStatus;
  notes: string | null;
  created_at: string;
}

export interface ChangeEntry {
  id: number;
  deal_id: number;
  iteration_id: number;
  summary: string;
  reason: string | null;
  requested_by: string;
  created_at: string;
  resulting_iteration_id: number | null;
  tags: string[];
}

export interface AssumptionRisk {
  id: number;
  deal_id: number;
  iteration_id: number | null;
  type: RiskType;
  description: string;
  status: RiskStatus;
  created_at: string;
}

export interface DealDetail {
  deal: Deal;
  stages: Stage[];
  currentIteration: Iteration;
  iterationCount: number;
  checklist: ChecklistEntry[];
  artifacts: Artifact[];
  risks: AssumptionRisk[];
}

export interface IterationTimelineEntry {
  iteration: Iteration;
  entryStage: Stage;
  triggerChangeEntry: ChangeEntry | null;
  changeEntriesLogged: ChangeEntry[];
}

export interface ImpactedArtifact extends Artifact {
  reason: ImpactReason;
  artifact_label: string;
  owning_stage_name: string;
}

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

export interface ArtifactType {
  key: string;
  label: string;
  owning_stage_id: number;
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

export interface DealChecklistStatus {
  id: number;
  deal_id: number;
  iteration_id: number;
  checklist_item_id: number;
  is_complete: number;
  completed_at: string | null;
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
}

export interface ChangeEntryArtifactTag {
  id: number;
  change_entry_id: number;
  artifact_type_key: string;
}

export interface ChangeImpact {
  id: number;
  change_entry_id: number;
  artifact_id: number;
  reason: ImpactReason;
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

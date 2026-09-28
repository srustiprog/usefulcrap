// Thin fetch wrapper around the local Express API. No external services -
// this only ever talks to the Node server running on localhost.
import type {
  ArtifactType,
  ChangeEntry,
  DealDetail,
  DealSummary,
  ImpactedArtifact,
  Iteration,
  IterationTimelineEntry,
  Stage,
} from "../types";

const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  getStages: () => request<(Stage & { checklist_items: any[] })[]>("/stages"),
  getArtifactTypes: () => request<ArtifactType[]>("/artifact-types"),

  getDeals: () => request<DealSummary[]>("/deals"),
  getDeal: (id: number) => request<DealDetail>(`/deals/${id}`),
  createDeal: (body: { name: string; customer: string; industry: string; description?: string }) =>
    request<DealSummary>("/deals", { method: "POST", body: JSON.stringify(body) }),

  toggleChecklistItem: (dealId: number, itemId: number) =>
    request<{ ok: true }>(`/deals/${dealId}/checklist/${itemId}/toggle`, { method: "POST" }),

  advanceDeal: (dealId: number) =>
    request<{ done: boolean; message?: string; nextStage?: Stage }>(`/deals/${dealId}/advance`, {
      method: "POST",
    }),

  getIterations: (dealId: number) => request<IterationTimelineEntry[]>(`/deals/${dealId}/iterations`),

  createArtifact: (dealId: number, body: { artifact_type_key: string; name: string; notes?: string }) =>
    request(`/deals/${dealId}/artifacts`, { method: "POST", body: JSON.stringify(body) }),

  getChangeEntries: (dealId: number) => request<ChangeEntry[]>(`/deals/${dealId}/change-entries`),
  logChangeEntry: (
    dealId: number,
    body: { summary: string; reason?: string; requestedBy: string; artifactTypeKeys: string[] }
  ) =>
    request<{ changeEntry: ChangeEntry; newIteration: Iteration; earliestAffectedStage: Stage }>(
      `/deals/${dealId}/change-entries`,
      { method: "POST", body: JSON.stringify(body) }
    ),
  getImpact: (changeEntryId: number) => request<ImpactedArtifact[]>(`/change-entries/${changeEntryId}/impact`),

  createRisk: (dealId: number, body: { type: "assumption" | "risk"; description: string }) =>
    request(`/deals/${dealId}/risks`, { method: "POST", body: JSON.stringify(body) }),
  updateRiskStatus: (riskId: number, status: "open" | "resolved" | "accepted") =>
    request(`/risks/${riskId}`, { method: "PATCH", body: JSON.stringify({ status }) }),
};

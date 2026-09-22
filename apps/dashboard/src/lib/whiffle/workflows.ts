import type {
  Problem,
  Workflow,
  WorkflowAction,
  WorkflowAttempt,
  WorkflowGraph,
  WorkflowRun,
  WorkflowStep,
} from "@whiffle/core";

export type WorkflowDetail = Workflow & { problems: Problem[] };
export type WorkflowRunDetail = WorkflowRun & {
  steps: WorkflowStep[];
  attempts: WorkflowAttempt[];
};
export interface WorkflowLaunch {
  inputs: Record<string, unknown>;
  supervisor: { delegateType: string } | { instanceId: string } | null;
  workspace: { path: string; machineId: string };
}

async function request<T>(
  path: string,
  method = "GET",
  body?: unknown
): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method,
    ...(body === undefined
      ? {}
      : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `The hub answered ${response.status}.`);
  }
  return response.json() as Promise<T>;
}
const id = encodeURIComponent;
export const loadWorkflows = () =>
  request<{ workflows: Workflow[] }>("workflows");
export const loadWorkflow = (key: string) =>
  request<WorkflowDetail>(`workflows/${id(key)}`);
export const createWorkflow = (
  body: { name: string; graph: WorkflowGraph } | { markdown: string }
) => request<WorkflowDetail>("workflows", "POST", body);
export const saveWorkflow = (
  key: string,
  body: { name: string; description: string; graph: WorkflowGraph }
) => request<WorkflowDetail>(`workflows/${id(key)}`, "PUT", body);
export const deleteWorkflow = (key: string) =>
  request<{ ok: boolean }>(`workflows/${id(key)}`, "DELETE");
export const loadWorkflowRuns = (key: string) =>
  request<{ runs: WorkflowRun[] }>(`workflows/${id(key)}/runs`);
export const launchWorkflow = (key: string, body: WorkflowLaunch) =>
  request<{ runId: string }>(`workflows/${id(key)}/runs`, "POST", body);
export const loadWorkflowRun = (key: string) =>
  request<WorkflowRunDetail>(`workflow-runs/${id(key)}`);
export const cancelWorkflowRun = (key: string) =>
  request<unknown>(`workflow-runs/${id(key)}/cancel`, "POST");
export const rerunWorkflow = (key: string, fromNodeId: string) =>
  request<{ runId: string }>(`workflow-runs/${id(key)}/rerun`, "POST", {
    fromNodeId,
  });
export const answerWorkflow = (
  key: string,
  stepId: string,
  choice: string,
  note?: string
) =>
  request<{ ok: boolean }>(`workflow-runs/${id(key)}/answer`, "POST", {
    stepId,
    choice,
    note,
  });
export const steerWorkflow = (key: string, action: WorkflowAction) =>
  request<unknown>(`workflow-runs/${id(key)}/steer`, "POST", { action });
export const submitWorkflowResult = (
  key: string,
  instanceId: string,
  result: unknown
) =>
  request<unknown>(`workflow-steps/${id(key)}/result`, "POST", {
    instanceId,
    result,
  });
export async function workflowMarkdown(key: string): Promise<string> {
  const response = await fetch(`/api/workflows/${id(key)}/markdown`);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `The hub answered ${response.status}.`);
  }
  return text;
}

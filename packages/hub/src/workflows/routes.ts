import type { WorkflowAction, WorkflowGraph } from "@whiffle/core";
import { validateWorkflow } from "@whiffle/core";
import { Elysia, t } from "elysia";
import type { DbShape } from "../db";
import { type createWorkflowEngine, publicRun } from "./engine";

export function workflowRoutes(
  db: DbShape,
  engine: ReturnType<typeof createWorkflowEngine>,
  presence: (id: string) => string | undefined
) {
  const refusal = (error: unknown) =>
    new Response(error instanceof Error ? error.message : String(error), {
      status: 400,
    });
  const attempt = async (action: () => unknown) => {
    try {
      return await action();
    } catch (error) {
      return refusal(error);
    }
  };
  const save = (
    body: { name?: string; graph: WorkflowGraph; description?: string },
    id: string = crypto.randomUUID()
  ) => {
    if (!(body.name?.trim() && body.graph)) {
      throw new Error("A workflow needs a name and a graph.");
    }
    const problems = validateWorkflow(body.graph, {
      workflowId: id,
      resolveWorkflow: (target) =>
        target === id
          ? { id, name: body.name ?? id, graph: body.graph }
          : db.getWorkflow(target),
    });
    const cycle = problems.find((problem) =>
      problem.message.startsWith("Workflow call cycle:")
    );
    if (cycle) {
      throw new Error(cycle.message);
    }
    const slug = body.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    if (!slug) {
      throw new Error("The workflow name needs at least one letter or number.");
    }
    return {
      ...db.putWorkflow({
        id,
        name: body.name.trim(),
        slug,
        graph: body.graph,
        description: body.description ?? "",
      }),
      problems,
    };
  };
  const actor = (instanceId: string) => {
    const [row] = db.getInstancesByIds([instanceId]);
    if (!row || row.canDelegate === false) {
      throw new Error(
        "Only a session that may delegate can run or steer workflows."
      );
    }
    return row;
  };
  return new Elysia()
    .get("/api/workflows", () => ({ workflows: db.listWorkflows() }))
    .post("/api/workflows", { body: t.Any() }, ({ body }) =>
      attempt(() => save(body as Parameters<typeof save>[0]))
    )
    .get("/api/workflows/:id", ({ params }) => {
      const row = db.getWorkflow(params.id);
      return row
        ? {
            ...row,
            problems: validateWorkflow(row.graph, {
              workflowId: row.id,
              resolveWorkflow: db.getWorkflow,
            }),
          }
        : new Response("Workflow not found.", { status: 404 });
    })
    .put("/api/workflows/:id", { body: t.Any() }, ({ body, params }) =>
      attempt(() => {
        const row = db.getWorkflow(params.id);
        if (!row) {
          throw new Error("Workflow not found.");
        }
        return save(body as Parameters<typeof save>[0], row.id);
      })
    )
    .delete("/api/workflows/:id", ({ params }) =>
      attempt(() => {
        const row = db.getWorkflow(params.id);
        if (!row) {
          throw new Error("Workflow not found.");
        }
        if (
          db
            .listWorkflowRuns(row.id)
            .some((run) => ["running", "waiting"].includes(run.status))
        ) {
          throw new Error("A workflow with a live run cannot be deleted.");
        }
        db.deleteWorkflow(row.id);
        return { ok: true };
      })
    )
    .get("/api/workflows/:id/runs", ({ params }) => ({
      runs: db
        .listWorkflowRuns(db.getWorkflow(params.id)?.id ?? params.id)
        .map(publicRun),
    }))
    .post("/api/workflows/:id/runs", { body: t.Any() }, ({ params, body }) =>
      attempt(() => {
        const input = body as Parameters<typeof engine.launch>[1] & {
          instanceId?: string;
        };
        if (input.instanceId) {
          const row = actor(input.instanceId);
          return engine.launch(params.id, {
            inputs: input.inputs,
            workspace: input.workspace ?? {
              path: row.cwd,
              machineId: row.machineId,
            },
            supervisor: { instanceId: row.id },
            launchedBy: `agent:${row.id}`,
          });
        }
        return engine.launch(params.id, {
          inputs: input.inputs,
          workspace: input.workspace,
          supervisor: input.supervisor,
        });
      })
    )
    .get("/api/workflow-runs/:id", ({ params }) =>
      attempt(() => {
        const detail = engine.detail(params.id);
        return {
          ...detail,
          steps: detail.steps.map((step) => ({
            ...step,
            ...(step.status === "running" &&
            step.instanceId &&
            presence(step.instanceId) !== "running"
              ? {
                  status:
                    presence(step.instanceId) === "unknown"
                      ? "unknown"
                      : "pending",
                }
              : {}),
          })),
        };
      })
    )
    .post("/api/workflow-runs/:id/cancel", ({ params }) =>
      attempt(() => engine.cancel(params.id))
    )
    .post(
      "/api/workflow-runs/:id/answer",
      {
        body: t.Object({
          stepId: t.String(),
          choice: t.String(),
          note: t.Optional(t.String()),
        }),
      },
      ({ params, body }) =>
        attempt(async () => {
          await engine.answer(params.id, body.stepId, body.choice, body.note);
          return { ok: true };
        })
    )
    .post(
      "/api/workflow-runs/:id/steer",
      {
        body: t.Object({
          instanceId: t.Optional(t.String()),
          action: t.Unknown(),
        }),
      },
      ({ params, body }) =>
        attempt(() => {
          if (body.instanceId) {
            actor(body.instanceId);
          }
          return engine.steer(
            params.id,
            body.action as WorkflowAction,
            body.instanceId
          );
        })
    )
    .post(
      "/api/workflow-runs/:id/rerun",
      { body: t.Object({ fromNodeId: t.String() }) },
      ({ params, body }) =>
        attempt(() => {
          const run = db.getWorkflowRun(params.id);
          if (!run) {
            throw new Error("Workflow run not found.");
          }
          if (
            !run.graph.nodes.some(
              (node) => node.id === body.fromNodeId && node.kind !== "start"
            )
          ) {
            throw new Error("Choose an existing node to re-run from.");
          }
          return engine.launch(run.workflowId, {
            inputs: run.inputs,
            workspace: { path: run.workspace, machineId: run.machineId },
            supervisor: run.supervisorInstanceId
              ? { instanceId: run.supervisorInstanceId }
              : undefined,
            rerunOfRunId: run.id,
            fromNodeId: body.fromNodeId,
          });
        })
    )
    .post(
      "/api/workflow-steps/:id/result",
      { body: t.Object({ instanceId: t.String(), result: t.Unknown() }) },
      ({ params, body }) =>
        attempt(() =>
          engine.submitResult(params.id, body.instanceId, body.result)
        )
    );
}

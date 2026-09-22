import type { Problem, WorkflowGraph } from "@whiffle/core";
import { compileWorkflow, validateWorkflow } from "@whiffle/core";
import {
  programInputs,
  typecheckProgram,
  workflowProgramCheck,
} from "@whiffle/core/workflow-sandbox";
import { Elysia, t } from "elysia";
import type { DbShape } from "../db";
import { type createWorkflowRuntime, publicRun } from "./runtime";

export function workflowRoutes(
  db: DbShape,
  runtime: ReturnType<typeof createWorkflowRuntime>,
  presence: (id: string) => string | undefined,
  skills: {
    changed: () => void;
    check: (name: string, workflowId: string | undefined) => Promise<void>;
  }
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
  const save = async (
    input: {
      description?: string;
      graph?: WorkflowGraph;
      name?: string;
      program?: string;
    },
    id: string = crypto.randomUUID()
  ) => {
    if (!input.name?.trim()) {
      throw new Error("A workflow needs a name.");
    }
    if (!(input.graph || input.program)) {
      throw new Error(
        "A workflow needs either a graph (the editor's model) or a program."
      );
    }
    if (input.graph && input.program) {
      throw new Error(
        "A workflow is authored either as a graph or as a program, never both."
      );
    }
    // A program that will not compile or typecheck is refused with the
    // diagnostics; a graph whose *authoring* rules fail still saves and is
    // refused at launch instead (§9.3), because the editor autosaves.
    let problems: Problem[] = [];
    let program = input.program ?? "";
    if (input.graph) {
      const fatal = workflowProgramCheck(input.graph);
      if (fatal.length) {
        return Response.json({ problems: fatal }, { status: 400 });
      }
      problems = validateWorkflow(input.graph, {
        workflowId: id,
        resolveWorkflow: (target) =>
          target === id
            ? {
                id,
                name: input.name ?? id,
                graph: input.graph as WorkflowGraph,
              }
            : db.getWorkflow(target),
      });
      // A call cycle is the one graph problem that cannot be left for launch:
      // it is a property of the fleet's saved graphs, not of this one.
      const cycle = problems.find((problem) =>
        problem.message.startsWith("Workflow call cycle:")
      );
      if (cycle) {
        return Response.json({ problems: [cycle] }, { status: 400 });
      }
      ({ program } = compileWorkflow(input.graph));
    } else {
      const fatal = typecheckProgram(program);
      if (fatal.length) {
        return Response.json({ problems: fatal }, { status: 400 });
      }
    }
    const slug = input.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    if (!slug) {
      throw new Error("The workflow name needs at least one letter or number.");
    }
    const old = db.getWorkflow(id);
    await skills.check(`wf-${slug}`, old?.id);
    if (db.listSkills().some((skill) => skill.name === `wf-${slug}`)) {
      throw new Error(
        `Workflow slug ${slug} collides with operator-installed skill wf-${slug}.`
      );
    }
    const stored = db.putWorkflow({
      id,
      name: input.name.trim(),
      slug,
      graph: input.graph ?? null,
      program,
      origin: input.graph ? "editor" : "code",
      inputs: await programInputs(program),
      description: input.description ?? old?.description ?? "",
    });
    skills.changed();
    return { ...stored, problems };
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
    .post("/api/workflows", { body: t.Any() }, ({ body, set }) =>
      attempt(async () => {
        const saved = await save(body as Parameters<typeof save>[0]);
        if (!(saved instanceof Response)) {
          set.status = 201;
        }
        return saved;
      })
    )
    .get("/api/workflows/:id/program", ({ params }) => {
      const row = db.getWorkflow(params.id);
      return row
        ? new Response(row.program, {
            headers: { "content-type": "text/typescript; charset=utf-8" },
          })
        : new Response("Workflow not found.", { status: 404 });
    })
    .get("/api/workflows/:id", ({ params }) =>
      attempt(() => {
        const row = db.getWorkflow(params.id);
        if (!row) {
          return new Response("Workflow not found.", { status: 404 });
        }
        return {
          ...row,
          problems: row.graph
            ? validateWorkflow(row.graph, {
                workflowId: row.id,
                checkProgram: workflowProgramCheck,
                resolveWorkflow: db.getWorkflow,
              })
            : typecheckProgram(row.program),
        };
      })
    )
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
        skills.changed();
        return { ok: true };
      })
    )
    .get("/api/workflows/:id/runs", ({ params }) => ({
      runs: db
        .listWorkflowRuns(db.getWorkflow(params.id)?.id ?? params.id)
        .map((run) => publicRun(run, db.listWorkflowEffects(run.id))),
    }))
    .post("/api/workflows/:id/runs", { body: t.Any() }, ({ params, body }) =>
      attempt(() => {
        const input = body as Parameters<typeof runtime.launch>[1] & {
          instanceId?: string;
        };
        if (input.instanceId) {
          const row = actor(input.instanceId);
          return runtime.launch(params.id, {
            inputs: input.inputs,
            workspace: input.workspace ?? {
              path: row.cwd,
              machineId: row.machineId,
            },
            supervisor: { instanceId: row.id },
            launchedBy: `agent:${row.id}`,
          });
        }
        return runtime.launch(params.id, {
          inputs: input.inputs,
          workspace: input.workspace,
          supervisor: input.supervisor,
        });
      })
    )
    .get("/api/workflow-runs/:id", ({ params }) =>
      attempt(() => {
        const detail = runtime.detail(params.id);
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
    .get("/api/workflow-runs/:id/effects", ({ params }) => ({
      effects: runtime.effects(params.id),
    }))
    .post("/api/workflow-runs/:id/cancel", ({ params }) =>
      attempt(() => runtime.cancel(params.id))
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
          await runtime.answer(params.id, body.stepId, body.choice, body.note);
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
          return runtime.steer(
            params.id,
            body.action as Parameters<typeof runtime.steer>[1],
            body.instanceId
          );
        })
    )
    .post(
      "/api/workflow-runs/:id/rerun",
      { body: t.Object({ fromNodeId: t.Optional(t.String()) }) },
      ({ params, body }) =>
        attempt(() => runtime.rerun(params.id, body.fromNodeId))
    )
    .post(
      "/api/workflow-steps/:id/result",
      { body: t.Object({ instanceId: t.String(), result: t.Unknown() }) },
      ({ params, body }) =>
        attempt(() =>
          runtime.submitResult(params.id, body.instanceId, body.result)
        )
    )
    .post(
      "/api/workflow-runs/:id/state/:name",
      { body: t.Object({ instanceId: t.String(), value: t.Unknown() }) },
      ({ params, body }) =>
        attempt(() => {
          const [row] = db.getInstancesByIds([body.instanceId]);
          if (!row || row.workflowRunId !== params.id) {
            throw new Error("This session is not a step of that workflow run.");
          }
          return runtime.writeState(params.id, params.name, body.value);
        })
    )
    .get("/api/workflow-runs/:id/state/:name", ({ params, query }) =>
      attempt(() => {
        const [row] = db.getInstancesByIds([String(query.instanceId ?? "")]);
        if (!row || row.workflowRunId !== params.id) {
          throw new Error("This session is not a step of that workflow run.");
        }
        return { value: runtime.readState(params.id, params.name) ?? null };
      })
    );
}

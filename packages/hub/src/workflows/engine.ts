import type {
  Envelope,
  PermissionResult,
  SpawnPayload,
  WorkflowAction,
  WorkflowGraph,
  WorkflowNode,
  WorkflowRun,
} from "@whiffle/core";
import {
  evaluateWhen,
  renderPrompt,
  validateWorkflow,
  workflowPath,
} from "@whiffle/core";
import Ajv from "ajv";
import type {
  DbShape,
  WorkflowAttemptRow,
  WorkflowRunRow,
  WorkflowStepRow,
} from "../db";

interface Scope {
  edges: Record<string, "fired" | "skipped">;
  forced?: string;
  graph: WorkflowGraph;
  index?: number;
  item?: unknown;
  loops: Record<string, number>;
  parentStep?: string;
  result?: unknown;
  status: "running" | "done" | "failed";
  steps: Record<string, string>;
}
type Runtime = Record<string, unknown> & {
  scopes: Record<string, Scope>;
  note: string;
  findings: Record<string, string[]>;
  retryPending: Record<string, string>;
  notifications: { id: string; body: string }[];
  maps: Record<string, { items: unknown[]; scopes: string[]; next: number }>;
};
type Run = WorkflowRunRow & { runtime: Runtime };
type StepNode = Extract<WorkflowNode, { kind: "step" }>;
export interface WorkflowEngineDeps {
  broadcast: (frame: {
    runId: string;
    run: Omit<WorkflowRunRow, "runtime"> & Pick<WorkflowRun, "edges" | "loops">;
    step?: WorkflowStepRow;
    attempt?: WorkflowAttemptRow;
  }) => void;
  command: (
    machineId: string,
    cwd: string,
    cmd: string
  ) => Promise<{ exitCode: number; output: string }>;
  db: DbShape;
  emit: (envelope: Envelope) => void;
  halt: (machineId: string, instanceId: string) => Promise<void>;
  online: (machineId: string) => boolean;
  park: (envelope: Envelope) => void;
  settle: (requestId: string) => void;
  spawn: (machineId: string, payload: SpawnPayload) => Promise<void>;
  supervisor: (
    type: string,
    workspace: string,
    machineId: string,
    prompt: string
  ) => Promise<string>;
}
const active = (run: WorkflowRunRow) =>
  run.status === "running" || run.status === "waiting";
const reason = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
export const publicRun = ({ runtime, ...run }: WorkflowRunRow) => {
  const { scopes } = runtime as Runtime;
  const names = new Map<string, string>([["root", "root"]]);
  const nameOf = (id: string): string => {
    const known = names.get(id);
    if (known) {
      return known;
    }
    const scope = scopes[id];
    const parent = Object.entries(scopes).find(([, candidate]) =>
      Object.values(candidate.steps).includes(scope.parentStep ?? "")
    );
    const nodeId =
      parent &&
      Object.entries(parent[1].steps).find(
        ([, stepId]) => stepId === scope.parentStep
      )?.[0];
    if (!(parent && nodeId) || scope.index === undefined) {
      throw new Error(`Missing map parent for workflow scope ${id}.`);
    }
    const prefix = parent[0] === "root" ? "" : `${nameOf(parent[0])}.`;
    const name = `${prefix}${nodeId}[${scope.index}]`;
    names.set(id, name);
    return name;
  };
  return {
    ...run,
    edges: Object.fromEntries(
      Object.entries(scopes).map(([id, scope]) => [
        nameOf(id),
        { ...scope.edges },
      ])
    ),
    loops: Object.fromEntries(
      Object.entries(scopes).map(([id, scope]) => [
        nameOf(id),
        { ...scope.loops },
      ])
    ),
  };
};

export function createWorkflowEngine(deps: WorkflowEngineDeps) {
  const { db } = deps;
  const ajv = new Ajv({ allErrors: true, strict: false });
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const locks = new Map<string, Promise<unknown>>();
  const runOf = (id: string): Run => {
    const run = db.getWorkflowRun(id);
    if (!run) {
      throw new Error(`No workflow run ${id}.`);
    }
    return run as Run;
  };
  const stepOf = (id: string) => {
    const step = db.getWorkflowStep(id);
    if (!step) {
      throw new Error(`No workflow step ${id}.`);
    }
    return step;
  };
  const refreshActive = (run: Run): boolean => {
    const stored = runOf(run.id);
    if (!active(stored)) {
      Object.assign(run, stored);
      return false;
    }
    return true;
  };
  const latest = (step: WorkflowStepRow) =>
    db.listWorkflowAttempts(step.id).at(-1);
  const scopeOf = (run: Run, step: WorkflowStepRow) => {
    const scope = Object.values(run.runtime.scopes).find(
      (entry) => entry.steps[step.nodeId] === step.id
    );
    if (!scope) {
      throw new Error(`Missing scope for step ${step.id}.`);
    }
    return scope;
  };
  const nodeOf = (scope: Scope, step: WorkflowStepRow) => {
    const node = scope.graph.nodes.find((entry) => entry.id === step.nodeId);
    if (!node) {
      throw new Error(`Missing node ${step.nodeId}.`);
    }
    return node;
  };
  const write = (
    run: Run,
    step?: WorkflowStepRow,
    attempt?: WorkflowAttemptRow,
    steps: WorkflowStepRow[] = []
  ) => {
    db.workflowTransition(run, step, attempt, steps);
    deps.broadcast({ runId: run.id, run: publicRun(run), step, attempt });
    for (const changed of steps) {
      deps.broadcast({ runId: run.id, run: publicRun(run), step: changed });
    }
  };
  const serial = <T>(
    runId: string,
    action: () => T | Promise<T>
  ): Promise<T> => {
    const previous = locks.get(runId) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(action);
    locks.set(runId, next);
    return next.finally(() => {
      if (locks.get(runId) === next) {
        locks.delete(runId);
      }
    });
  };
  const clearTimer = (id: string) => {
    clearTimeout(timers.get(id));
    timers.delete(id);
  };
  const send = (
    run: Run,
    instanceId: string,
    body: string,
    queued = false,
    messageId?: string
  ) => {
    const [instance] = db.getInstancesByIds([instanceId]);
    if (!instance) {
      throw new Error(
        `No instance ${instanceId} to receive the workflow message.`
      );
    }
    deps.emit({
      verb: "send",
      machineId: instance.machineId,
      instanceId,
      payload: {
        instanceId,
        message: {
          type: "user",
          ...(messageId ? { uuid: messageId } : {}),
          message: { role: "user", content: body },
          parent_tool_use_id: null,
          origin: {
            kind: "peer",
            from: run.id,
            name: db.getWorkflow(run.workflowId)?.name ?? run.workflowId,
            fromSession: run.supervisorInstanceId ?? run.id,
          },
          ...(queued ? { shouldQuery: false } : {}),
        },
      },
    });
  };
  const flushNotifications = (run: Run) => {
    if (!run.supervisorInstanceId) {
      return;
    }
    const [supervisor] = db.getInstancesByIds([run.supervisorInstanceId]);
    if (
      !(
        supervisor &&
        deps.online(supervisor.machineId) &&
        ["running", "starting"].includes(supervisor.status)
      )
    ) {
      return;
    }
    while (run.runtime.notifications.length) {
      const [notification] = run.runtime.notifications;
      send(run, supervisor.id, notification.body, true, notification.id);
      run.runtime.notifications.shift();
      write(run);
    }
  };
  const notify = (run: Run, body: string, id: string = crypto.randomUUID()) => {
    if (!run.runtime.notifications.some((entry) => entry.id === id)) {
      run.runtime.notifications.push({ id, body });
    }
    write(run);
    flushNotifications(run);
  };
  const report = (run: Run, step?: WorkflowStepRow) => {
    if (!run.supervisorInstanceId) {
      return;
    }
    const name = db.getWorkflow(run.workflowId)?.name ?? run.workflowId;
    const title = step ? nodeOf(scopeOf(run, step), step).title : "";
    const header = step
      ? `[Workflow ${name} — step ${title} ${step.status}]`
      : `[Workflow ${name} — ${run.status}]`;
    notify(
      run,
      `${header}\n\n${step?.failure ?? run.failure ?? JSON.stringify(step ? step.result : run.result, null, 2)}`
    );
  };
  const stopStep = (run: Run, step: WorkflowStepRow) => {
    clearTimer(step.id);
    deps.settle(step.id);
    if (step.instanceId && deps.online(run.machineId)) {
      deps.emit({
        verb: "stop",
        machineId: run.machineId,
        instanceId: step.instanceId,
        payload: { instanceId: step.instanceId },
      });
    }
  };
  const finish = (
    run: Run,
    status: "done" | "failed" | "cancelled",
    failure: string | null = null,
    result: unknown = null
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: terminal transitions stop owned sessions, cascade to children, and settle the parent node.
  ) => {
    run.status = status;
    run.failure = failure;
    run.result = result;
    run.endedAt = new Date();
    for (const child of db
      .listWorkflowRuns()
      .filter((entry) => entry.parentRunId === run.id && active(entry))) {
      finish(child as Run, "cancelled");
    }
    for (const step of db.listWorkflowSteps(run.id)) {
      if (
        step.instanceId &&
        db.getInstancesByIds([step.instanceId])[0]?.workflowRunId === run.id &&
        !["pending", "running", "waiting"].includes(step.status)
      ) {
        stopStep(run, step);
      }
      if (["pending", "running", "waiting"].includes(step.status)) {
        stopStep(run, step);
        step.status = step.status === "pending" ? "skipped" : "cancelled";
        step.endedAt = new Date();
        const attempt = latest(step);
        if (attempt && !attempt.endedAt) {
          attempt.endedAt = new Date();
          attempt.failure = status;
        }
        write(run, step, attempt);
      }
    }
    write(run);
    report(run);
    if (run.parentRunId && run.parentStepId) {
      const { parentRunId, parentStepId } = run;
      serial(parentRunId, async () => {
        const parent = runOf(parentRunId);
        if (!active(parent)) {
          return;
        }
        const step = stepOf(parentStepId);
        if (step.status !== "running") {
          return;
        }
        const scope = scopeOf(parent, step);
        if (run.status === "done") {
          pass(parent, scope, step, run.result);
        } else {
          step.result = { failure: run.failure ?? run.status };
          fail(parent, scope, step, run.failure ?? run.status);
        }
        await schedule(parent);
      }).catch(console.error);
    }
  };
  const promptScope = (
    run: Run,
    scope: Scope,
    step: WorkflowStepRow,
    number: number,
    previousError = ""
  ) => ({
    inputs: run.inputs,
    steps: Object.fromEntries(
      Object.entries(scope.steps).map(([id, stepId]) => [
        id,
        { result: stepOf(stepId).result },
      ])
    ),
    attempt: {
      number,
      previousError,
      gateFindings: run.runtime.findings[step.id] ?? [],
    },
    workspace: run.workspace,
    supervisor: { note: run.runtime.note },
    map: { item: scope.item, index: scope.index },
  });
  const createScope = (
    run: Run,
    id: string,
    graph: WorkflowGraph,
    parentStep?: string,
    item?: unknown,
    index?: number,
    prepare?: (scope: Scope, steps: WorkflowStepRow[]) => void
  ) => {
    const scope: Scope = {
      graph,
      steps: Object.fromEntries(
        graph.nodes.map((node) => [node.id, crypto.randomUUID()])
      ),
      edges: {},
      loops: {},
      parentStep,
      item,
      index,
      status: "running",
    };
    run.runtime.scopes[id] = scope;
    const steps: WorkflowStepRow[] = graph.nodes.map((node) => ({
      id: scope.steps[node.id],
      runId: run.id,
      nodeId: node.id,
      kind: node.kind,
      status: "pending",
      instanceId: null,
      childRunId: null,
      result: null,
      failure: null,
      mapIndex: index ?? null,
      startedAt: null,
      endedAt: null,
    }));
    prepare?.(scope, steps);
    write(run, undefined, undefined, steps);
    return scope;
  };
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: ending a map body settles its sessions and nested map/workflow children without disturbing sibling items.
  const settleScope = (run: Run, scope: Scope) => {
    for (const stepId of Object.values(scope.steps)) {
      const step = stepOf(stepId);
      if (step.instanceId) {
        stopStep(run, step);
      }
      if (step.childRunId) {
        const child = runOf(step.childRunId);
        if (active(child)) {
          finish(child, "cancelled");
        }
      }
      if (step.kind === "map" && run.runtime.maps[step.id]) {
        for (const childId of run.runtime.maps[step.id].scopes) {
          const child = run.runtime.scopes[childId];
          if (child.status === "running") {
            child.status = "failed";
            settleScope(run, child);
          }
        }
      }
      if (!["pending", "running", "waiting"].includes(step.status)) {
        continue;
      }
      step.status = step.status === "pending" ? "skipped" : "cancelled";
      step.endedAt = new Date();
      const attempt = latest(step);
      if (attempt && !attempt.endedAt) {
        attempt.endedAt = new Date();
        attempt.failure = `map-body-${scope.status}`;
      }
      write(run, step, attempt);
    }
  };
  const resetFrom = (
    run: Run,
    scope: Scope,
    id: string,
    changed: WorkflowStepRow[],
    seen = new Set<string>()
  ) => {
    if (seen.has(id)) {
      return;
    }
    seen.add(id);
    const step = {
      ...(changed.find((entry) => entry.id === scope.steps[id]) ??
        stepOf(scope.steps[id])),
    };
    if (step.status === "running" || step.status === "waiting") {
      throw new Error(`Loop cannot restart active node ${id}.`);
    }
    step.status = "pending";
    if (step.kind === "workflow") {
      step.childRunId = null;
    }
    if (
      step.instanceId &&
      db.getInstancesByIds([step.instanceId])[0]?.workflowRunId !== run.id
    ) {
      step.instanceId = null;
    }
    step.failure = null;
    step.endedAt = null;
    changed.push(step);
    for (const edge of scope.graph.edges.filter(
      (entry) => entry.from.node === id && entry.maxIterations === undefined
    )) {
      delete scope.edges[edge.id];
      resetFrom(run, scope, edge.to.node, changed, seen);
    }
  };
  const route = (
    run: Run,
    scope: Scope,
    step: WorkflowStepRow,
    ports: string[],
    attempt?: WorkflowAttemptRow
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: routing atomically handles failure ports, fan-out, and bounded cycle activation.
  ) => {
    const node = nodeOf(scope, step);
    const changed: WorkflowStepRow[] = [];
    const edges = scope.graph.edges.filter(
      (edge) => edge.from.node === node.id
    );
    for (const port of ports) {
      if (
        node.failedPorts?.includes(port) ||
        (port === "fail" && !edges.some((edge) => edge.from.port === port))
      ) {
        if (scope.parentStep) {
          scope.status = "failed";
          write(run, step, attempt);
          settleScope(run, scope);
          return;
        }
        write(run, step, attempt);
        finish(
          run,
          "failed",
          step.failure ?? `unwired-port:${node.id}.${port}`
        );
        return;
      }
    }
    for (const edge of edges) {
      const fired =
        ports.includes(edge.from.port) && evaluateWhen(edge.when, step.result);
      if (edge.maxIterations !== undefined) {
        if (!fired) {
          continue;
        }
        scope.loops[edge.id] = (scope.loops[edge.id] ?? 0) + 1;
        if (scope.loops[edge.id] > edge.maxIterations) {
          write(run, step, attempt);
          finish(run, "failed", `loop-bound:${edge.id}`);
          return;
        }
        changed.push(step);
        resetFrom(run, scope, edge.to.node, changed);
        if (step.kind === "check") {
          run.runtime.findings[scope.steps[edge.to.node]] =
            (step.result as { findings?: string[] }).findings ?? [];
        }
      }
      scope.edges[edge.id] = fired ? "fired" : "skipped";
    }
    write(run, step, attempt, changed);
  };
  const pass = (
    run: Run,
    scope: Scope,
    step: WorkflowStepRow,
    result: unknown,
    ports: string[] = ["out"],
    attempt?: WorkflowAttemptRow
  ) => {
    clearTimer(step.id);
    step.status = "passed";
    step.result = result;
    step.failure = null;
    step.endedAt = new Date();
    route(run, scope, step, ports, attempt);
    if (step.kind === "step") {
      report(run, step);
    }
  };
  const fail = (
    run: Run,
    scope: Scope,
    step: WorkflowStepRow,
    failure: string,
    attempt?: WorkflowAttemptRow
  ) => {
    clearTimer(step.id);
    step.status = "failed";
    step.failure = failure;
    if (step.kind === "workflow") {
      step.result = { failure };
    }
    step.endedAt = new Date();
    route(run, scope, step, ["fail"], attempt);
    if (step.kind === "step") {
      report(run, step);
    }
  };
  const arm = (
    run: Run,
    step: WorkflowStepRow,
    deadline: number,
    ask = false
  ) => {
    clearTimer(step.id);
    timers.set(
      step.id,
      setTimeout(
        () => {
          serial(run.id, async () => {
            const current = runOf(run.id);
            const currentStep = stepOf(step.id);
            if (
              !(
                active(current) &&
                ["running", "waiting"].includes(currentStep.status)
              )
            ) {
              return;
            }
            if (ask) {
              finish(current, "failed", "ask-timeout");
              return;
            }
            if (currentStep.instanceId) {
              await deps.halt(current.machineId, currentStep.instanceId);
            }
            await ended(current, currentStep, "attempt-timeout");
          }).catch((error) => {
            const current = runOf(run.id);
            if (active(current)) {
              finish(current, "failed", reason(error));
            }
          });
        },
        Math.max(1, deadline - Date.now())
      )
    );
  };
  const attemptStep = async (
    run: Run,
    scope: Scope,
    step: WorkflowStepRow,
    node: StepNode,
    previousError = ""
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: one dispatch validates context, preserves the session on retry, and persists the exact model contract before spawning.
  ) => {
    const number = (latest(step)?.number ?? 0) + 1;
    const name = db.getWorkflow(run.workflowId)?.name ?? run.workflowId;
    const rendered = renderPrompt(
      node.prompt,
      promptScope(run, scope, step, number, previousError)
    );
    const { note } = run.runtime;
    run.runtime.note = "";
    const body = `[Hand-off from the ${name} workflow — step ${node.title}, not the user]\n\n${rendered}\n\nWhen the work is done, call submit_result exactly once with an object matching this schema, then end your turn. Do not describe the result in prose instead of calling it.\n${JSON.stringify(node.outputSchema, null, 2)}${run.supervisorInstanceId ? "" : "\nThere is nobody to ask. Decide, and record any assumption in your result."}${note ? `\nSupervisor note: ${note}` : ""}${previousError ? `\nPrevious attempt: ${previousError}\n${previousError === "no-result" ? "You ended without calling submit_result. Call it now with an object matching the schema." : "Correct the error and call submit_result."}` : ""}`;
    let resume: SpawnPayload["resume"];
    const instance = step.instanceId
      ? db.getInstancesByIds([step.instanceId])[0]
      : undefined;
    const needsSpawn = !(
      instance && ["running", "starting"].includes(instance.status)
    );
    if (step.instanceId && needsSpawn) {
      if (!instance?.sessionId) {
        throw new Error(
          `${previousError}\nThe step has no session key to resume; a retry cannot start a fresh session.`
        );
      }
      resume = { sessionKey: instance.sessionId };
    } else if (!step.instanceId && node.context.mode === "continue") {
      const source = stepOf(scope.steps[node.context.from]);
      const sourceInstance = source.instanceId
        ? db.getInstancesByIds([source.instanceId])[0]
        : undefined;
      if (!sourceInstance?.sessionId) {
        throw new Error("The upstream step has no session key to fork.");
      }
      resume = { sessionKey: sourceInstance.sessionId, fork: true };
    }
    step.instanceId ??= crypto.randomUUID();
    step.status = "running";
    step.startedAt ??= new Date();
    step.endedAt = null;
    const attempt: WorkflowAttemptRow = {
      id: crypto.randomUUID(),
      stepId: step.id,
      number,
      renderedPrompt: body,
      result: null,
      failure: null,
      startedAt: new Date(),
      endedAt: null,
    };
    delete run.runtime.retryPending[step.id];
    write(run, step, attempt);
    if (needsSpawn) {
      await deps.spawn(run.machineId, {
        instanceId: step.instanceId,
        cwd: run.workspace,
        harness: node.harness,
        model: node.model,
        effort: node.effort,
        skills: node.skills,
        denyTools:
          node.harness === "claude"
            ? [
                ...(node.denyTools ?? []),
                ...(run.supervisorInstanceId ? [] : ["AskUserQuestion"]),
              ]
            : undefined,
        resume,
        permissionMode: "bypassPermissions",
        canDelegate: false,
        title: `${name} · ${node.title}`,
        ...(run.supervisorInstanceId
          ? { parent: { instanceId: run.supervisorInstanceId } }
          : {}),
        workflowRunId: run.id,
        workflowStepId: step.id,
      });
    }
    if (!refreshActive(run)) {
      stopStep(run, step);
      return;
    }
    send(run, step.instanceId, body);
    arm(
      run,
      step,
      attempt.startedAt.getTime() + (node.timeoutMinutes ?? 60) * 60_000
    );
  };
  const parkAsk = (
    run: Run,
    scope: Scope,
    step: WorkflowStepRow,
    node: Extract<WorkflowNode, { kind: "ask" }>
  ) => {
    const context = promptScope(run, scope, step, 1);
    const question = renderPrompt(node.question, context);
    const options = node.options.map((option) => ({
      ...option,
      label: renderPrompt(option.label, context),
    }));
    deps.park({
      verb: "frames",
      machineId: run.machineId,
      instanceId: step.id,
      requestId: step.id,
      payload: {
        kind: "permission_request",
        instanceId: step.id,
        requestId: step.id,
        workflowRunId: run.id,
        workflowStepId: step.id,
        requestKind: "question",
        toolName: "AskUserQuestion",
        input: {
          questions: [
            {
              question,
              header: node.title.slice(0, 30),
              options,
              multiSelect: false,
              allowOther: node.allowOther,
            },
          ],
        },
        ...(node.answeredBy === "supervisor" ? { routedTo: "parent" } : {}),
      },
    });
    if (node.answeredBy === "supervisor" && run.supervisorInstanceId) {
      notify(
        run,
        `[Workflow ${db.getWorkflow(run.workflowId)?.name} — question ${node.title}]\n${question}\n${JSON.stringify(options)}\nAnswer with steer_workflow using action {type:"answer",stepId:"${step.id}",choice:"<label>"}.`,
        step.id
      );
    }
    if (node.waitFor) {
      arm(
        run,
        step,
        (step.startedAt?.getTime() ?? Date.now()) + node.waitFor * 3_600_000,
        true
      );
    }
  };
  const check = async (
    run: Run,
    scope: Scope,
    step: WorkflowStepRow,
    node: Extract<WorkflowNode, { kind: "check" }>,
    input: unknown
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: the deterministic gate dispatches its five rule kinds and collects all findings.
  ) => {
    const findings: string[] = [];
    const context = promptScope(run, scope, step, 1);
    for (const rule of node.rules) {
      if (rule.kind === "schema") {
        const validate = ajv.compile(rule.schema);
        if (!validate(input)) {
          findings.push(ajv.errorsText(validate.errors));
        }
      } else if (rule.kind === "regex") {
        if (
          new RegExp(rule.pattern).test(
            String(workflowPath(input, rule.path))
          ) !== rule.mustMatch
        ) {
          findings.push(`Regex ${rule.pattern} failed at ${rule.path}.`);
        }
      } else if (rule.kind === "forbidden-words") {
        const value = String(workflowPath(input, rule.path)).toLowerCase();
        const found = rule.words.filter((word) =>
          value.includes(word.toLowerCase())
        );
        if (found.length) {
          findings.push(`Forbidden words at ${rule.path}: ${found.join(", ")}`);
        }
      } else {
        const cmd =
          rule.kind === "command"
            ? renderPrompt(rule.cmd, context)
            : `test -e '${renderPrompt(rule.path, context).replaceAll("'", "'\\''")}'`;
        // biome-ignore lint/performance/noAwaitInLoops: command gates share the workspace and must retain authored order.
        const output = await deps.command(run.machineId, run.workspace, cmd);
        if (!refreshActive(run)) {
          return;
        }
        if (
          output.exitCode !== (rule.kind === "command" ? rule.expectExit : 0)
        ) {
          findings.push(`${cmd}: exit ${output.exitCode}\n${output.output}`);
        }
      }
    }
    pass(
      run,
      scope,
      step,
      findings.length ? { result: input, findings } : input,
      [findings.length ? "fail" : "pass"]
    );
    if (findings.length) {
      for (const edge of scope.graph.edges.filter(
        (entry) => entry.from.node === node.id && entry.from.port === "fail"
      )) {
        run.runtime.findings[scope.steps[edge.to.node]] = findings;
      }
      write(run);
    }
  };
  const incomingResult = (scope: Scope, node: WorkflowNode) => {
    const edge = scope.graph.edges.find(
      (entry) => entry.to.node === node.id && scope.edges[entry.id] === "fired"
    );
    return edge ? stepOf(scope.steps[edge.from.node]).result : {};
  };
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: the scheduler is an explicit seven-kind state machine over scoped graphs, joins, and bounded maps.
  const schedule = async (run: Run): Promise<void> => {
    let moved = true;
    while (active(run) && moved) {
      moved = false;
      for (const scope of Object.values(run.runtime.scopes)) {
        if (scope.status !== "running") {
          continue;
        }
        for (const node of scope.graph.nodes) {
          if (!active(run) || scope.status !== "running") {
            break;
          }
          const step = stepOf(scope.steps[node.id]);
          if (
            node.kind === "workflow" &&
            step.status === "running" &&
            step.childRunId
          ) {
            const child = db.getWorkflowRun(step.childRunId);
            if (!child) {
              step.status = "pending";
              write(run, step);
              moved = true;
              continue;
            }
            if (!active(child)) {
              if (child.status === "done") {
                pass(run, scope, step, child.result);
              } else {
                step.result = { failure: child.failure ?? child.status };
                fail(run, scope, step, child.failure ?? child.status);
              }
              moved = true;
            }
            continue;
          }
          if (node.kind === "map" && step.status === "running") {
            const map = run.runtime.maps[step.id];
            let live = map.scopes.filter(
              (id) => run.runtime.scopes[id].status === "running"
            ).length;
            while (map.next < map.items.length && live < node.concurrency) {
              const index = map.next;
              map.next += 1;
              const id = crypto.randomUUID();
              map.scopes.push(id);
              createScope(run, id, node.body, step.id, map.items[index], index);
              live += 1;
              moved = true;
            }
            if (map.next === map.items.length && live === 0) {
              const failed = map.scopes
                .filter((id) => run.runtime.scopes[id].status === "failed")
                .map((id) => run.runtime.scopes[id].index);
              pass(
                run,
                scope,
                step,
                failed.length
                  ? { failed }
                  : {
                      items: map.scopes.map(
                        (id) => run.runtime.scopes[id].result
                      ),
                    },
                [failed.length ? "fail" : "out"]
              );
              moved = true;
            }
            continue;
          }
          if (step.status !== "pending") {
            continue;
          }
          const incoming = scope.graph.edges.filter(
            (edge) =>
              edge.to.node === node.id && edge.maxIterations === undefined
          );
          const loopFired =
            scope.forced === node.id ||
            scope.graph.edges.some(
              (edge) =>
                edge.to.node === node.id &&
                edge.maxIterations !== undefined &&
                scope.edges[edge.id] === "fired"
            );
          if (
            node.kind !== "start" &&
            !loopFired &&
            incoming.some((edge) => !scope.edges[edge.id])
          ) {
            continue;
          }
          if (
            node.kind !== "start" &&
            !loopFired &&
            !incoming.some((edge) => scope.edges[edge.id] === "fired")
          ) {
            step.status = "skipped";
            step.endedAt = new Date();
            for (const edge of scope.graph.edges.filter(
              (entry) =>
                entry.from.node === node.id && entry.maxIterations === undefined
            )) {
              scope.edges[edge.id] = "skipped";
            }
            write(run, step);
            moved = true;
            continue;
          }
          if (
            node.kind === "step" &&
            db
              .listWorkflowSteps(run.id)
              .filter(
                (entry) => entry.kind === "step" && entry.status === "running"
              ).length >= (run.graph.settings?.concurrency ?? 4)
          ) {
            continue;
          }
          moved = true;
          if (scope.forced === node.id) {
            scope.forced = undefined;
          }
          for (const edge of scope.graph.edges.filter(
            (entry) =>
              entry.to.node === node.id && entry.maxIterations !== undefined
          )) {
            delete scope.edges[edge.id];
          }
          step.startedAt ??= new Date();
          const input = incomingResult(scope, node);
          try {
            switch (node.kind) {
              case "start":
                pass(run, scope, step, run.inputs);
                break;
              case "step":
                // biome-ignore lint/performance/noAwaitInLoops: persist and issue each spawn before counting the next against the concurrency cap.
                await attemptStep(run, scope, step, node);
                break;
              case "check":
                await check(run, scope, step, node, input);
                break;
              case "branch": {
                const matched = node.cases.find((entry) =>
                  evaluateWhen(entry.when, input)
                );
                if (!matched) {
                  throw new Error("Branch has no matching case.");
                }
                pass(run, scope, step, input, [matched.port]);
                break;
              }
              case "ask":
                step.status = "waiting";
                run.status = "waiting";
                write(run, step);
                parkAsk(run, scope, step, node);
                break;
              case "map": {
                const items = workflowPath(
                  promptScope(run, scope, step, 1),
                  node.over
                );
                if (!Array.isArray(items)) {
                  throw new Error(`Map path ${node.over} is not an array.`);
                }
                run.runtime.maps[step.id] = { items, scopes: [], next: 0 };
                step.status = "running";
                write(run, step);
                break;
              }
              case "workflow": {
                const context = promptScope(run, scope, step, 1);
                const inputs = Object.fromEntries(
                  Object.entries(node.inputs).map(([key, value]) => [
                    key,
                    value.includes("{{")
                      ? renderPrompt(value, context)
                      : workflowPath(context, value),
                  ])
                );
                step.status = "running";
                step.childRunId ??= crypto.randomUUID();
                write(run, step);
                const child = await engine.launch(node.workflowId, {
                  id: step.childRunId,
                  inputs,
                  workspace: { path: run.workspace, machineId: run.machineId },
                  supervisor: run.supervisorInstanceId
                    ? { instanceId: run.supervisorInstanceId }
                    : undefined,
                  parentRunId: run.id,
                  parentStepId: step.id,
                });
                step.childRunId = child.runId;
                if (!refreshActive(run)) {
                  finish(runOf(child.runId), "cancelled");
                  return;
                }
                write(run, step);
                break;
              }
              case "end": {
                const context = promptScope(run, scope, step, 1);
                const result = Object.fromEntries(
                  Object.entries(node.outputs).map(([key, path]) => [
                    key,
                    workflowPath(context, path),
                  ])
                );
                step.status = "passed";
                step.result = result;
                step.endedAt = new Date();
                scope.status = "done";
                scope.result = result;
                write(run, step);
                if (scope.parentStep) {
                  settleScope(run, scope);
                } else {
                  finish(run, "done", null, result);
                }
                break;
              }
              default:
                throw new Error("Unknown workflow node kind.");
            }
          } catch (error) {
            if (!refreshActive(run)) {
              return;
            }
            if (step.childRunId && !db.getWorkflowRun(step.childRunId)) {
              step.childRunId = null;
            }
            fail(run, scope, step, reason(error));
          }
        }
        if (
          scope.parentStep &&
          scope.status === "running" &&
          !Object.values(scope.steps).some((id) =>
            ["pending", "running", "waiting"].includes(stepOf(id).status)
          )
        ) {
          scope.status = "done";
          scope.result = null;
          write(run);
          settleScope(run, scope);
          moved = true;
        }
      }
    }
    if (active(run)) {
      const steps = db.listWorkflowSteps(run.id);
      if (
        steps.some((step) =>
          ["pending", "running", "waiting"].includes(step.status)
        )
      ) {
        run.status = steps.some((step) => step.status === "waiting")
          ? "waiting"
          : "running";
        write(run);
      } else {
        finish(run, "done");
      }
    }
  };
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: a terminal frame either records success, retries the same session under its cap, or routes failure.
  const ended = async (run: Run, step: WorkflowStepRow, error?: string) => {
    if (!active(run) || step.status !== "running") {
      return;
    }
    const scope = scopeOf(run, step);
    const node = nodeOf(scope, step);
    if (node.kind !== "step") {
      return;
    }
    const attempt = latest(step);
    if (!attempt || attempt.endedAt) {
      return;
    }
    clearTimer(step.id);
    attempt.endedAt = new Date();
    if (!error && attempt.result !== null) {
      pass(run, scope, step, attempt.result, ["out"], attempt);
    } else {
      attempt.failure = error ?? "no-result";
      if (attempt.number <= (node.retries ?? 2)) {
        run.runtime.retryPending[step.id] = attempt.failure;
        write(run, step, attempt);
        try {
          await attemptStep(run, scope, step, node, attempt.failure);
        } catch (failure) {
          fail(run, scope, step, reason(failure));
        }
      } else {
        fail(run, scope, step, attempt.failure, attempt);
      }
    }
    await schedule(run);
  };
  const answer = async (
    run: Run,
    stepId: string,
    choice: string,
    note?: string,
    supervisor = false
  ) => {
    const step = stepOf(stepId);
    if (step.runId !== run.id || step.status !== "waiting" || !active(run)) {
      throw new Error("This workflow step is not waiting for an answer.");
    }
    const scope = scopeOf(run, step);
    const node = nodeOf(scope, step);
    if (node.kind !== "ask") {
      throw new Error("Only Ask nodes accept answers.");
    }
    if (supervisor && node.answeredBy !== "supervisor") {
      throw new Error("This question must be answered by the operator.");
    }
    const context = promptScope(run, scope, step, 1);
    const option = node.options.find(
      (entry) => renderPrompt(entry.label, context) === choice
    );
    if (!(option || node.allowOther)) {
      throw new Error("Choose one of the question's options.");
    }
    deps.settle(step.id);
    clearTimer(step.id);
    pass(run, scope, step, { choice, ...(note ? { note } : {}) }, [
      option?.label ?? "other",
    ]);
    await schedule(run);
  };
  const prepareRerun = (old: Run, fromNodeId: string) => {
    const upstream = new Set<string>();
    const downstream = new Set<string>();
    const walk = (nodeId: string, reverse: boolean, seen: Set<string>) => {
      for (const edge of old.graph.edges.filter(
        (entry) =>
          entry.maxIterations === undefined &&
          (reverse ? entry.to.node : entry.from.node) === nodeId
      )) {
        const next = reverse ? edge.from.node : edge.to.node;
        if (!seen.has(next)) {
          seen.add(next);
          walk(next, reverse, seen);
        }
      }
    };
    walk(fromNodeId, true, upstream);
    downstream.add(fromNodeId);
    walk(fromNodeId, false, downstream);
    const copies = new Map<string, WorkflowStepRow>();
    for (const nodeId of upstream) {
      const source = stepOf(old.runtime.scopes.root.steps[nodeId]);
      if (!["passed", "failed", "skipped"].includes(source.status)) {
        throw new Error(`Upstream node ${nodeId} has not completed.`);
      }
      copies.set(nodeId, source);
    }
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: atomically seed copied ancestors, skip unrelated branches, and retain the original edge decisions.
    return (scope: Scope, steps: WorkflowStepRow[]) => {
      scope.forced = fromNodeId;
      for (const step of steps) {
        const copy = copies.get(step.nodeId);
        if (copy) {
          Object.assign(step, {
            status: copy.status,
            result: copy.result,
            failure: copy.failure,
            instanceId: copy.instanceId,
            endedAt: new Date(),
          });
        } else if (!downstream.has(step.nodeId)) {
          step.status = "skipped";
          step.endedAt = new Date();
        }
      }
      for (const edge of old.graph.edges) {
        if (!downstream.has(edge.from.node)) {
          scope.edges[edge.id] =
            copies.has(edge.from.node) &&
            old.runtime.scopes.root.edges[edge.id] === "fired"
              ? "fired"
              : "skipped";
        }
      }
    };
  };
  const engine = {
    instanceLive(instanceId: string) {
      const [instance] = db.getInstancesByIds([instanceId]);
      if (instance?.workflowRunId && instance.workflowStepId) {
        const run = db.getWorkflowRun(instance.workflowRunId);
        if (run && !active(run)) {
          stopStep(run as Run, stepOf(instance.workflowStepId));
        }
      }
      for (const run of db
        .listWorkflowRuns()
        .filter((entry) => entry.supervisorInstanceId === instanceId)) {
        if ((run.runtime as Runtime).notifications.length) {
          flushNotifications(run as Run);
        }
      }
    },
    specFor(stepId: string) {
      const step = stepOf(stepId);
      const run = runOf(step.runId);
      const node = nodeOf(scopeOf(run, step), step);
      if (node.kind !== "step") {
        throw new Error("Only model steps own harness sessions.");
      }
      return {
        skills: node.skills,
        denyTools:
          node.harness === "claude"
            ? [
                ...(node.denyTools ?? []),
                ...(run.supervisorInstanceId ? [] : ["AskUserQuestion"]),
              ]
            : undefined,
      };
    },
    detail(id: string) {
      const run = runOf(id);
      const steps = db.listWorkflowSteps(id);
      return {
        ...publicRun(run),
        steps,
        attempts: steps.flatMap((step) => db.listWorkflowAttempts(step.id)),
      };
    },
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: launch refuses invalid inputs and supervision before pinning the graph and its optional upstream results.
    async launch(
      workflowId: string,
      options: {
        id?: string;
        inputs?: Record<string, unknown>;
        workspace?: { path: string; machineId: string };
        supervisor?: { instanceId: string } | { delegateType: string } | null;
        launchedBy?: string;
        rerunOfRunId?: string;
        fromNodeId?: string;
        parentRunId?: string;
        parentStepId?: string;
      }
    ): Promise<{ runId: string }> {
      const workflow = db.getWorkflow(workflowId);
      if (!workflow) {
        throw new Error(`No workflow ${workflowId}.`);
      }
      const graph = options.rerunOfRunId
        ? runOf(options.rerunOfRunId).graph
        : workflow.graph;
      let chosen = options.supervisor;
      if (chosen === undefined && !options.parentRunId) {
        chosen = graph.settings?.defaultSupervisor;
      }
      const problems = validateWorkflow(graph, {
        supervised: !!chosen,
        workflowId: workflow.id,
        resolveWorkflow: db.getWorkflow,
      });
      if (problems.length) {
        throw new Error(problems.map((problem) => problem.message).join("\n"));
      }
      if (
        !(options.workspace?.path && deps.online(options.workspace.machineId))
      ) {
        throw new Error("Choose a workspace directory on a connected machine.");
      }
      const inputs = { ...options.inputs };
      const start = graph.nodes.find((node) => node.kind === "start");
      if (start?.kind !== "start") {
        throw new Error("Missing Start.");
      }
      for (const input of start.inputs) {
        if (inputs[input.name] === undefined && input.default !== undefined) {
          inputs[input.name] = input.default;
        }
        if (
          input.required &&
          (inputs[input.name] === undefined || inputs[input.name] === "")
        ) {
          throw new Error(`Input ${input.name} is required.`);
        }
        if (
          inputs[input.name] !== undefined &&
          typeof inputs[input.name] !== "string"
        ) {
          throw new Error(`Input ${input.name} must be text.`);
        }
        if (
          input.type === "select" &&
          inputs[input.name] !== undefined &&
          !input.options?.includes(String(inputs[input.name]))
        ) {
          throw new Error(`Input ${input.name} must be one of its options.`);
        }
      }
      const id = options.id ?? crypto.randomUUID();
      let depth = 1;
      for (
        let ancestor = options.parentRunId;
        ancestor;
        ancestor = runOf(ancestor).parentRunId ?? undefined
      ) {
        depth += 1;
      }
      if (depth > 8) {
        throw new Error("workflow-depth");
      }
      const rerun =
        options.rerunOfRunId && options.fromNodeId
          ? prepareRerun(runOf(options.rerunOfRunId), options.fromNodeId)
          : undefined;
      let supervisorInstanceId: string | null = null;
      if (chosen && "instanceId" in chosen) {
        const [instance] = db.getInstancesByIds([chosen.instanceId]);
        if (
          !(
            instance &&
            deps.online(instance.machineId) &&
            ["running", "starting"].includes(instance.status)
          )
        ) {
          throw new Error("The supervisor must be a live session.");
        }
        supervisorInstanceId = instance.id;
      } else if (chosen) {
        supervisorInstanceId = await deps.supervisor(
          chosen.delegateType,
          options.workspace.path,
          options.workspace.machineId,
          `Supervise workflow ${workflow.name}, run ${id}.\n${workflow.description}\nReceive its reports and answer its questions. Use steer_workflow for note, retry, answer, or cancel; the graph controls routing.`
        );
      }
      const run: Run = {
        id,
        workflowId: workflow.id,
        graph,
        inputs,
        workspace: options.workspace.path,
        machineId: options.workspace.machineId,
        supervisorInstanceId,
        status: "running",
        result: null,
        failure: null,
        startedAt: new Date(),
        endedAt: null,
        rerunOfRunId: options.rerunOfRunId ?? null,
        parentRunId: options.parentRunId ?? null,
        parentStepId: options.parentStepId ?? null,
        launchedBy: options.launchedBy ?? "dashboard",
        runtime: {
          scopes: {},
          note: "",
          findings: {},
          retryPending: {},
          notifications: [],
          maps: {},
        },
      };
      createScope(
        run,
        "root",
        run.graph,
        undefined,
        undefined,
        undefined,
        rerun
      );
      serial(id, () => schedule(run)).catch((error) =>
        finish(runOf(id), "failed", reason(error))
      );
      return { runId: id };
    },
    submitResult(stepId: string, instanceId: string, result: unknown) {
      const step = stepOf(stepId);
      const run = runOf(step.runId);
      const [instance] = db.getInstancesByIds([instanceId]);
      if (
        !instance ||
        instance.workflowStepId !== step.id ||
        step.instanceId !== instanceId
      ) {
        throw new Error("This instance does not own the workflow step.");
      }
      if (!active(run) || step.status !== "running") {
        throw new Error("This workflow step is not running.");
      }
      const node = nodeOf(scopeOf(run, step), step);
      const attempt = latest(step);
      if (node.kind !== "step" || !attempt || attempt.endedAt) {
        throw new Error("There is no active attempt.");
      }
      if (attempt.result !== null) {
        throw new Error("A result was already recorded. End your turn now.");
      }
      const validate = ajv.compile(node.outputSchema);
      if (!validate(result)) {
        throw new Error(ajv.errorsText(validate.errors, { separator: "\n" }));
      }
      attempt.result = result;
      write(run, step, attempt);
      return "Recorded. End your turn now.";
    },
    observe(instanceId: string, error?: string) {
      const [instance] = db.getInstancesByIds([instanceId]);
      if (!(instance?.workflowStepId && instance.workflowRunId)) {
        return false;
      }
      const { workflowRunId, workflowStepId } = instance;
      const observedAttempt = latest(stepOf(workflowStepId))?.id;
      serial(workflowRunId, async () => {
        const step = stepOf(workflowStepId);
        if (latest(step)?.id !== observedAttempt) {
          return;
        }
        await ended(runOf(workflowRunId), step, error);
      }).catch(console.error);
      return true;
    },
    cancel(id: string) {
      return serial(id, () => {
        const run = runOf(id);
        if (!active(run)) {
          throw new Error("This workflow run has already ended.");
        }
        finish(run, "cancelled");
        return publicRun(run);
      });
    },
    answer(id: string, stepId: string, choice: string, note?: string) {
      return serial(id, () => answer(runOf(id), stepId, choice, note));
    },
    settleQuestion(stepId: string, result: PermissionResult) {
      const step = db.getWorkflowStep(stepId);
      if (step?.kind !== "ask") {
        return false;
      }
      serial(step.runId, async () => {
        const run = runOf(step.runId);
        if (!active(run)) {
          return;
        }
        if (result.behavior === "deny") {
          finish(run, "cancelled");
          return;
        }
        const answers = (
          result.updatedInput as
            | { answers?: Record<string, string> }
            | undefined
        )?.answers;
        const choice = answers && Object.values(answers)[0];
        if (!choice) {
          throw new Error("A workflow question needs a choice.");
        }
        await answer(run, step.id, choice);
      }).catch(console.error);
      return true;
    },
    steer(id: string, action: WorkflowAction, caller?: string) {
      // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: four bounded supervisor actions each enforce their own run and step state.
      return serial(id, async () => {
        const run = runOf(id);
        if (caller && caller !== run.supervisorInstanceId) {
          throw new Error("Only this workflow run's supervisor may steer it.");
        }
        switch (action.type) {
          case "note":
            if (!active(run)) {
              throw new Error("This workflow run has ended.");
            }
            run.runtime.note = action.text;
            write(run);
            break;
          case "cancel":
            if (!active(run)) {
              throw new Error("This workflow run has already ended.");
            }
            finish(run, "cancelled");
            break;
          case "answer":
            await answer(run, action.stepId, action.choice, action.note, true);
            break;
          case "retry": {
            const step = stepOf(action.stepId);
            if (
              step.runId !== id ||
              step.status !== "failed" ||
              run.status === "cancelled" ||
              run.status === "done"
            ) {
              throw new Error(
                "Retry requires a failed step of this workflow run."
              );
            }
            const scope = scopeOf(run, step);
            const node = nodeOf(scope, step);
            if (node.kind !== "step") {
              throw new Error("Only model steps have attempts to retry.");
            }
            run.status = "running";
            run.failure = null;
            run.endedAt = null;
            scope.status = "running";
            const reset: WorkflowStepRow[] = [];
            resetFrom(run, scope, step.nodeId, reset);
            write(run, undefined, undefined, reset);
            for (let parentId = scope.parentStep; parentId; ) {
              const parent = stepOf(parentId);
              const parentScope = scopeOf(run, parent);
              parentScope.status = "running";
              const downstream: WorkflowStepRow[] = [];
              for (const edge of parentScope.graph.edges.filter(
                (entry) =>
                  entry.from.node === parent.nodeId &&
                  entry.maxIterations === undefined
              )) {
                delete parentScope.edges[edge.id];
                resetFrom(run, parentScope, edge.to.node, downstream);
              }
              parent.status = "running";
              parent.result = null;
              parent.failure = null;
              parent.endedAt = null;
              write(run, parent, undefined, downstream);
              parentId = parentScope.parentStep;
            }
            await attemptStep(run, scope, step, node, step.failure ?? "");
            await schedule(run);
            break;
          }
          default:
            throw new Error(
              "Steering supports note, retry, answer, and cancel only."
            );
        }
        return publicRun(run);
      });
    },
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: reconnect drains durable reports and deferred stops before resuming live runs.
    recover(machineId: string) {
      for (const row of db.listWorkflowRuns()) {
        if ((row.runtime as Runtime).notifications.length) {
          flushNotifications(row as Run);
        }
        if (row.machineId === machineId && !active(row)) {
          for (const step of db.listWorkflowSteps(row.id)) {
            const instance = step.instanceId
              ? db.getInstancesByIds([step.instanceId])[0]
              : undefined;
            if (
              instance?.workflowRunId === row.id &&
              ["running", "starting"].includes(instance.status)
            ) {
              stopStep(row as Run, step);
            }
          }
        }
      }
      for (const row of db
        .listWorkflowRuns()
        .filter((run) => active(run) && run.machineId === machineId)) {
        // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: restart recovery distinguishes live attempts, dead sessions, and durable questions before scheduling.
        serial(row.id, async () => {
          const run = runOf(row.id);
          for (const step of db.listWorkflowSteps(row.id)) {
            const scope = scopeOf(run, step);
            const node = nodeOf(scope, step);
            if (step.status === "waiting" && node.kind === "ask") {
              parkAsk(run, scope, step, node);
            }
            if (
              step.status !== "running" ||
              node.kind !== "step" ||
              !step.instanceId
            ) {
              continue;
            }
            const [instance] = db.getInstancesByIds([step.instanceId]);
            const attempt = latest(step);
            const retryPending = run.runtime.retryPending[step.id];
            if (retryPending) {
              // biome-ignore lint/performance/noAwaitInLoops: recover each recorded retry before scheduling further work.
              await attemptStep(run, scope, step, node, retryPending);
              continue;
            }
            if (
              instance &&
              ["running", "starting"].includes(instance.status) &&
              attempt
            ) {
              arm(
                run,
                step,
                attempt.startedAt.getTime() +
                  (node.timeoutMinutes ?? 60) * 60_000
              );
            } else if (
              instance &&
              ["sleeping", "error", "stopped"].includes(instance.status)
            ) {
              await ended(
                run,
                step,
                instance.lastError ??
                  "Session stopped before the attempt completed."
              );
            }
          }
          await schedule(run);
        }).catch(console.error);
      }
    },
  };
  return engine;
}

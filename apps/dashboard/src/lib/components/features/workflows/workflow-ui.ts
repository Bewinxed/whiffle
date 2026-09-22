import type { WorkflowGraph, WorkflowNode } from "@whiffle/core";
import {
  IconBoxDuo,
  IconCpuDuo,
  IconHookDuo,
  IconRocketDuo,
  IconSubagentDuo,
  IconToolQuestion,
  IconToolTodo,
  IconWorkflow,
} from "$lib/icons";
import { newId } from "$lib/whiffle/id";

export const kinds = [
  {
    kind: "start",
    title: "Start",
    group: "Flow",
    meaning: "Inputs for this workflow",
    icon: IconRocketDuo,
  },
  {
    kind: "end",
    title: "End",
    group: "Flow",
    meaning: "Return the final outputs",
    icon: IconBoxDuo,
  },
  {
    kind: "branch",
    title: "Branch",
    group: "Flow",
    meaning: "Follow the first matching case",
    icon: IconSubagentDuo,
  },
  {
    kind: "map",
    title: "Map",
    group: "Flow",
    meaning: "Run a graph for each item",
    icon: IconHookDuo,
  },
  {
    kind: "workflow",
    title: "Workflow",
    group: "Flow",
    meaning: "Launch a child workflow",
    icon: IconWorkflow,
  },
  {
    kind: "step",
    title: "Step",
    group: "Work",
    meaning: "Give a model a bounded task",
    icon: IconCpuDuo,
  },
  {
    kind: "check",
    title: "Check",
    group: "Work",
    meaning: "Verify a result with code",
    icon: IconToolTodo,
  },
  {
    kind: "ask",
    title: "Ask",
    group: "People",
    meaning: "Pause for a human choice",
    icon: IconToolQuestion,
  },
] as const;

export function newNode(
  kind: WorkflowNode["kind"],
  position = { x: 80, y: 120 }
): WorkflowNode {
  const base = {
    id: `${kind}-${newId().slice(0, 8)}`,
    title: kinds.find((entry) => entry.kind === kind)?.title ?? kind,
    position,
  };
  switch (kind) {
    case "start":
      return { ...base, kind, inputs: [] };
    case "end":
      return { ...base, kind, outputs: {} };
    case "step":
      return {
        ...base,
        kind,
        harness: "claude",
        model: "",
        prompt: "",
        outputSchema: { type: "object", properties: {} },
        context: { mode: "fresh" },
        retries: 2,
        timeoutMinutes: 60,
      };
    case "check":
      return { ...base, kind, rules: [] };
    case "branch":
      return {
        ...base,
        kind,
        cases: [
          { port: "match", when: { path: "result.pass", op: "truthy" } },
          { port: "else" },
        ],
      };
    case "map":
      return {
        ...base,
        kind,
        over: "",
        concurrency: 4,
        body: { nodes: [newNode("start")], edges: [] },
      };
    case "workflow":
      return { ...base, kind, workflowId: "", inputs: {} };
    case "ask":
      return {
        ...base,
        kind,
        question: "",
        options: [{ label: "Continue" }, { label: "Stop" }],
        allowOther: false,
        answeredBy: "operator",
      };
    default:
      throw new Error(`Unknown node kind: ${kind}`);
  }
}

export function upstream(graph: WorkflowGraph, nodeId: string): WorkflowNode[] {
  const seen = new Set<string>([nodeId]);
  const visit = (id: string) => {
    for (const edge of graph.edges.filter((entry) => entry.to.node === id)) {
      if (seen.has(edge.from.node)) {
        continue;
      }
      seen.add(edge.from.node);
      visit(edge.from.node);
    }
  };
  visit(nodeId);
  return graph.nodes.filter((node) => node.id !== nodeId && seen.has(node.id));
}

function schemaPaths(schema: unknown, path: string): string[] {
  if (!schema || typeof schema !== "object") {
    return [path];
  }
  const shape = schema as {
    type?: string;
    properties?: Record<string, unknown>;
    items?: unknown;
  };
  if (shape.type === "array") {
    return [path, `${path}.length`, ...schemaPaths(shape.items, `${path}[*]`)];
  }
  return [
    path,
    ...Object.entries(shape.properties ?? {}).flatMap(([key, value]) =>
      schemaPaths(value, `${path}.${key}`)
    ),
  ];
}
export function templatePaths(graph: WorkflowGraph, nodeId: string): string[] {
  const start = graph.nodes.find((node) => node.kind === "start");
  return [
    "workspace",
    "attempt.number",
    "attempt.previousError",
    "attempt.gateFindings",
    "supervisor.note",
    ...(start?.kind === "start"
      ? start.inputs.map((input) => `inputs.${input.name}`)
      : []),
    ...upstream(graph, nodeId).flatMap((node) =>
      node.kind === "step"
        ? schemaPaths(node.outputSchema, `steps.${node.id}.result`)
        : [`steps.${node.id}.result`]
    ),
  ];
}
export function duration(
  start: Date | string | null,
  end: Date | string | null,
  now: number
): string {
  if (!start) {
    return "—";
  }
  const seconds = Math.max(
    0,
    Math.floor(
      ((end ? new Date(end).getTime() : now) - new Date(start).getTime()) / 1000
    )
  );
  return seconds < 60
    ? `${seconds}s`
    : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

import dagre from "@dagrejs/dagre";
import { parseDocument, stringify } from "yaml";
import type {
  Problem,
  Workflow,
  WorkflowCheckRule,
  WorkflowEdge,
  WorkflowGraph,
  WorkflowInput,
  WorkflowNode,
  WorkflowSchema,
  WorkflowWhen,
} from "./workflow";
import { workflowPorts } from "./workflow";

const HEADER = /^### ([\w-]+) · (\w+)(.*)$/;
const ATTRIBUTE = /^([\w-]+):/;
const CONDITION =
  /^(\S+) (eq|neq|gt|lt|contains|matches|truthy|falsy)(?: (.*))?$/;
const KINDS = [
  "start",
  "step",
  "check",
  "branch",
  "map",
  "workflow",
  "ask",
  "end",
];
const SPACE = /\s/;
const SCHEMA_ARRAY = /"(?:\\.|[^"\\])*"|'(?:[^']|'')*'|(\w+\[\])/g;
const IDENTIFIER = /^[\w-]+$/;
const REGEX_RULE = /^regex (\S+) \/(.*)\/ (must-match|must-not-match)$/;
const COMMAND_RULE = /^command (.*?)(?: expectExit:(-?\d+))?$/;
const LINE_PREFIX = /^Line \d+: /;
const EDGE_ID = /\s+id:("(?:\\.|[^"\\])*"|\S+)$/;
const EDGE_MAX = /\s+\(max (\d+)\)$/;
const MAP_FENCE = /^(~{3,})workflow$/;
const TILDES = /^~+/gm;
const PROMPT_ESCAPE = /^(?:\\|### |```|~~~)/;
const INLINE_ASK = /^(.*?) options: (.*?)( allowOther)?$/s;
const BRANCH_CASE = /^("(?:\\.|[^"\\])*"|'(?:[^']|'')*'|[^:]+):\s*(.*)$/;

function yaml(text: string): unknown {
  const doc = parseDocument(text, { uniqueKeys: true });
  if (doc.errors.length) {
    throw new Error(doc.errors.map((error) => error.message).join("\n"));
  }
  return doc.toJS({ maxAliasCount: 0 });
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function string(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be text.`);
  }
  return value;
}

function strings(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${label} must be a list of strings.`);
  }
  return value;
}

function number(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }
  return value;
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${label} must be true or false.`);
  }
  return value;
}

function mapping(value: unknown, label: string): Record<string, string> {
  return Object.fromEntries(
    Object.entries(object(value, label)).map(([key, item]) => [
      key,
      string(item, label),
    ])
  );
}

function onlyKeys(value: Record<string, unknown>, keys: string[]): void {
  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) {
      throw new Error(`Unknown field ${key}.`);
    }
  }
}

/** Split attributes without splitting quoted strings, JSON, or template paths. */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: a single scanner keeps quoted and nested attribute values intact.
function tokens(text: string): string[] {
  const result: string[] = [];
  let start = 0;
  let depth = 0;
  let quote = "";
  for (let i = 0; i <= text.length; i += 1) {
    const char = text[i];
    if (quote) {
      if (char === "\\" && quote === '"') {
        i += 1;
      } else if (char === quote) {
        quote = "";
      }
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === "[" || char === "{") {
      depth += 1;
    } else if (char === "]" || char === "}") {
      depth -= 1;
    } else if (i === text.length || (depth === 0 && SPACE.test(char))) {
      if (i > start) {
        result.push(text.slice(start, i));
      }
      start = i + 1;
    }
  }
  if (quote || depth !== 0) {
    throw new Error("Unclosed quote or collection.");
  }
  return result;
}

function schema(value: unknown): WorkflowSchema {
  if (typeof value === "string") {
    if (value.endsWith("[]")) {
      return { type: "array", items: schema(value.slice(0, -2)) };
    }
    if (
      ![
        "string",
        "number",
        "integer",
        "boolean",
        "object",
        "array",
        "null",
      ].includes(value)
    ) {
      throw new Error(`Unknown schema type ${value}.`);
    }
    return { type: value };
  }
  const fields = object(value, "schema");
  if (typeof fields.type === "string") {
    return fields;
  }
  return {
    type: "object",
    properties: Object.fromEntries(
      Object.entries(fields).map(([key, field]) => [key, schema(field)])
    ),
    required: Object.keys(fields),
  };
}

function readSchema(text: string): WorkflowSchema {
  // YAML flow scalars cannot contain brackets; quote the documented string[] shorthand.
  return schema(
    yaml(
      text.replace(SCHEMA_ARRAY, (match, array: string | undefined) =>
        array ? JSON.stringify(array) : match
      )
    )
  );
}

function condition(text: string): WorkflowWhen {
  const match = CONDITION.exec(text.trim());
  if (!match) {
    throw new Error("Expected condition: path op value.");
  }
  const [, path, op, value] = match;
  if (!["truthy", "falsy"].includes(op) && value === undefined) {
    throw new Error(`${op} needs a value.`);
  }
  return {
    path,
    op: op as WorkflowWhen["op"],
    ...(value === undefined ? {} : { value: yaml(value) }),
  };
}

function inputs(value: unknown): WorkflowInput[] {
  if (!Array.isArray(value)) {
    throw new Error("inputs must be a list.");
  }
  return value.map((entry) => {
    if (typeof entry === "string") {
      return { name: entry, label: entry, type: "text", required: true };
    }
    const row = object(entry, "input");
    onlyKeys(row, ["name", "label", "type", "required", "default", "options"]);
    const name = string(row.name, "input name");
    const type = row.type ?? "text";
    if (!["text", "path", "select"].includes(String(type))) {
      throw new Error(`Unknown input type ${type}.`);
    }
    return {
      name,
      label: string(row.label ?? name, "input label"),
      type: type as WorkflowInput["type"],
      required: boolean(row.required ?? true, "input required"),
      ...(row.default === undefined
        ? {}
        : { default: string(row.default, "input default") }),
      ...(row.options === undefined
        ? {}
        : { options: strings(row.options, "input options") }),
    };
  });
}

interface Section {
  attrs: string;
  body: { text: string; line: number }[];
  id: string;
  kind: string;
  line: number;
}

function attributes(section: Section): Record<string, unknown> {
  const attrs: Record<string, unknown> = {};
  for (const token of tokens(section.attrs.trim())) {
    const match = ATTRIBUTE.exec(token);
    if (match) {
      if (Object.hasOwn(attrs, match[1])) {
        throw new Error(`Duplicate attribute ${match[1]}.`);
      }
      attrs[match[1]] = yaml(token.slice(match[0].length));
    } else if (section.kind === "step" && !attrs.harness) {
      const slash = token.indexOf("/");
      if (slash < 1) {
        throw new Error("Step requires harness/model.");
      }
      attrs.harness = token.slice(0, slash);
      attrs.model = token.slice(slash + 1);
    } else if (section.kind === "workflow" && !attrs.workflowId) {
      attrs.workflowId = token;
    } else {
      throw new Error(`Unknown attribute ${token}.`);
    }
  }
  return attrs;
}

function checkRule(text: string): WorkflowCheckRule {
  if (text.startsWith("schema:")) {
    return { kind: "schema", schema: readSchema(text.slice(7).trim()) };
  }
  if (text.startsWith("forbidden-words ")) {
    const colon = text.indexOf(":");
    if (colon < 0) {
      throw new Error("forbidden-words requires path: words.");
    }
    const rest = text.slice(colon + 1).trim();
    return {
      kind: "forbidden-words",
      path: text.slice(16, colon).trim(),
      words: rest.startsWith("[")
        ? strings(yaml(rest), "words")
        : rest.split(",").map((word) => word.trim()),
    };
  }
  if (text.startsWith("regex ")) {
    const match = REGEX_RULE.exec(text);
    if (!match) {
      throw new Error(
        "Expected regex path /pattern/ must-match or must-not-match."
      );
    }
    const [, , pattern] = match;
    new RegExp(pattern).test("");
    return {
      kind: "regex",
      path: match[1],
      pattern,
      mustMatch: match[3] === "must-match",
    };
  }
  if (text.startsWith("file-exists ")) {
    return {
      kind: "file-exists",
      path: string(yaml(text.slice(12)), "file path"),
    };
  }
  if (text.startsWith("command ")) {
    const match = COMMAND_RULE.exec(text);
    if (!match) {
      throw new Error("Expected command text expectExit:N.");
    }
    return {
      kind: "command",
      cmd: string(yaml(match[1]), "command"),
      expectExit: Number(match[2] ?? 0),
    };
  }
  throw new Error(`Unknown check rule: ${text}`);
}

const NODE_ATTRS: Record<string, string[]> = {
  start: [],
  step: [
    "harness",
    "model",
    "effort",
    "delegateType",
    "skills",
    "denyTools",
    "context",
    "retries",
    "timeoutMinutes",
  ],
  check: [],
  branch: [],
  map: ["concurrency"],
  workflow: ["workflowId"],
  ask: ["answeredBy", "allowOther", "waitFor"],
  end: [],
};

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: each node kind owns a distinct documented body grammar.
function node(
  section: Section,
  frontInputs: WorkflowInput[],
  problem: (line: number, message: string) => void
): WorkflowNode {
  if (!KINDS.includes(section.kind)) {
    throw new Error(`Unknown node kind ${section.kind}.`);
  }
  const attrs = attributes(section);
  for (const key of Object.keys(attrs)) {
    if (
      !["title", "notes", "failedPorts", ...NODE_ATTRS[section.kind]].includes(
        key
      )
    ) {
      throw new Error(`Unknown ${section.kind} attribute ${key}.`);
    }
  }
  const base = {
    id: section.id,
    title: string(attrs.title ?? section.id, "title"),
    position: { x: 0, y: 0 },
    ...(attrs.notes === undefined
      ? {}
      : { notes: string(attrs.notes, "notes") }),
    ...(attrs.failedPorts === undefined
      ? {}
      : { failedPorts: strings(attrs.failedPorts, "failedPorts") }),
  };
  const lines = section.body.filter((line) => line.text.trim());
  const body = section.body
    .map((line) => line.text)
    .join("\n")
    .trim();
  const fields = (keys: string[]) => {
    const data = object(yaml(body), `${section.kind} body`);
    onlyKeys(data, keys);
    return data;
  };
  const readLines = <T>(read: (text: string) => T): T[] =>
    lines.flatMap((line) => {
      try {
        return [read(line.text.trim())];
      } catch (error) {
        problem(
          line.line,
          error instanceof Error ? error.message : String(error)
        );
        return [];
      }
    });
  switch (section.kind) {
    case "start":
      if (body) {
        throw new Error("Start inputs belong in frontmatter.");
      }
      return { ...base, kind: "start", inputs: frontInputs };
    case "step": {
      const [first] = lines;
      if (!first?.text.startsWith("schema:")) {
        throw new Error("Step body must begin with schema:.");
      }
      const harness = string(attrs.harness, "harness");
      if (!["claude", "opencode", "pi"].includes(harness)) {
        throw new Error(`Unknown harness ${harness}.`);
      }
      const context = attrs.context ?? "fresh";
      let policy: Extract<WorkflowNode, { kind: "step" }>["context"];
      if (context === "fresh") {
        policy = { mode: "fresh" };
      } else if (
        typeof context === "string" &&
        context.startsWith("continue:")
      ) {
        policy = { mode: "continue", from: context.slice(9) };
      } else {
        const data = object(context, "context");
        if (data.mode === "fresh") {
          policy = { mode: "fresh" };
        } else if (data.mode === "continue") {
          policy = {
            mode: "continue",
            from: string(data.from, "context.from"),
          };
        } else {
          throw new Error("context must be fresh or continue:<nodeId>.");
        }
      }
      if (
        attrs.effort !== undefined &&
        !["low", "medium", "high", "max"].includes(String(attrs.effort))
      ) {
        throw new Error("Unknown effort.");
      }
      return {
        ...base,
        kind: "step",
        harness: harness as "claude" | "opencode" | "pi",
        model: string(attrs.model, "model"),
        context: policy,
        prompt: section.body
          .slice(section.body.indexOf(first) + 1)
          .map((line) =>
            line.text.startsWith("\\") ? line.text.slice(1) : line.text
          )
          .join("\n")
          .trim(),
        outputSchema: readSchema(first.text.slice(7).trim()),
        ...(attrs.effort === undefined
          ? {}
          : { effort: attrs.effort as "low" | "medium" | "high" | "max" }),
        ...(attrs.delegateType === undefined
          ? {}
          : { delegateType: string(attrs.delegateType, "delegateType") }),
        ...(attrs.skills === undefined
          ? {}
          : { skills: strings(attrs.skills, "skills") }),
        ...(attrs.denyTools === undefined
          ? {}
          : { denyTools: strings(attrs.denyTools, "denyTools") }),
        ...(attrs.retries === undefined
          ? {}
          : { retries: number(attrs.retries, "retries") }),
        ...(attrs.timeoutMinutes === undefined
          ? {}
          : { timeoutMinutes: number(attrs.timeoutMinutes, "timeoutMinutes") }),
      };
    }
    case "check":
      return { ...base, kind: "check", rules: readLines(checkRule) };
    case "branch":
      return {
        ...base,
        kind: "branch",
        cases: readLines((text) => {
          const match = BRANCH_CASE.exec(text);
          if (!match) {
            throw new Error(
              "Expected case port: path op value, or port: else."
            );
          }
          const port = string(yaml(match[1]), "case port");
          const when = match[2].trim();
          return {
            port,
            ...(when === "else" ? {} : { when: condition(when) }),
          };
        }),
      };
    case "ask": {
      const inline = INLINE_ASK.exec(body);
      const data = inline
        ? {
            question: inline[1],
            options: inline[2].startsWith("{{") ? [inline[2]] : yaml(inline[2]),
          }
        : fields(["question", "options"]);
      const { options } = data;
      if (!Array.isArray(options)) {
        throw new Error("Ask options must be a list.");
      }
      if (
        attrs.answeredBy !== undefined &&
        !["operator", "supervisor"].includes(String(attrs.answeredBy))
      ) {
        throw new Error("answeredBy must be operator or supervisor.");
      }
      return {
        ...base,
        kind: "ask",
        question: string(data.question, "question"),
        options: options.map((entry) => {
          if (typeof entry === "string") {
            return { label: entry };
          }
          const option = object(entry, "option");
          onlyKeys(option, ["label", "description"]);
          return {
            label: string(option.label, "option label"),
            ...(option.description === undefined
              ? {}
              : {
                  description: string(option.description, "option description"),
                }),
          };
        }),
        allowOther: boolean(attrs.allowOther ?? !!inline?.[3], "allowOther"),
        ...(attrs.answeredBy === undefined
          ? {}
          : { answeredBy: attrs.answeredBy as "operator" | "supervisor" }),
        ...(attrs.waitFor === undefined
          ? {}
          : { waitFor: number(attrs.waitFor, "waitFor") }),
      };
    }
    case "workflow": {
      const data = fields(["workflowId", "input"]);
      return {
        ...base,
        kind: "workflow",
        workflowId: string(data.workflowId ?? attrs.workflowId, "workflowId"),
        inputs: mapping(data.input ?? {}, "input"),
      };
    }
    case "map": {
      const fence = section.body.findIndex((line) => MAP_FENCE.test(line.text));
      if (
        fence < 0 ||
        section.body.at(-1)?.text !== section.body[fence].text.slice(0, -8)
      ) {
        throw new Error(
          "Map body needs a ~~~workflow fenced nested Markdown graph."
        );
      }
      const data = object(
        yaml(
          section.body
            .slice(0, fence)
            .map((line) => line.text)
            .join("\n")
        ),
        "map"
      );
      onlyKeys(data, ["over"]);
      const nested = parseWorkflowMarkdown(
        section.body
          .slice(fence + 1, -1)
          .map((line) => line.text)
          .join("\n")
      );
      for (const issue of nested.problems) {
        problem(
          section.body[fence].line + (issue.line ?? 1),
          issue.message.replace(LINE_PREFIX, "")
        );
      }
      return {
        ...base,
        kind: "map",
        over: string(data.over, "over"),
        concurrency: number(attrs.concurrency ?? 4, "concurrency"),
        body: nested.graph,
      };
    }
    case "end":
      return {
        ...base,
        kind: "end",
        outputs: mapping(fields(["outputs"]).outputs, "outputs"),
      };
    default:
      throw new Error(`Unknown node kind ${section.kind}.`);
  }
}

/** Position-free graphs are laid out independently, including each map body. */
function layout(graph: WorkflowGraph): void {
  const placed = new dagre.graphlib.Graph({ multigraph: true });
  placed.setGraph({
    rankdir: "LR",
    nodesep: 48,
    ranksep: 80,
    marginx: 24,
    marginy: 24,
  });
  placed.setDefaultEdgeLabel(() => ({}));
  for (const entry of graph.nodes) {
    placed.setNode(entry.id, { width: 260, height: 120 });
  }
  for (const edge of graph.edges) {
    if (placed.hasNode(edge.from.node) && placed.hasNode(edge.to.node)) {
      placed.setEdge(edge.from.node, edge.to.node, {}, edge.id);
    }
  }
  dagre.layout(placed);
  for (const entry of graph.nodes) {
    const point = placed.node(entry.id);
    entry.position = { x: point.x - 130, y: point.y - 60 };
  }
}

function edgeLine(text: string, graph: WorkflowGraph): WorkflowEdge[] {
  let rest = text.trim();
  let id: string | undefined;
  const explicitId = EDGE_ID.exec(rest);
  if (explicitId) {
    id = string(yaml(explicitId[1]), "edge id");
    rest = rest.slice(0, explicitId.index);
  }
  let when: WorkflowWhen | undefined;
  const whenStart = rest.indexOf(" [when ");
  if (whenStart >= 0) {
    if (!rest.endsWith("]")) {
      throw new Error("Unclosed edge condition.");
    }
    when = condition(rest.slice(whenStart + 7, -1));
    rest = rest.slice(0, whenStart);
  }
  const max = EDGE_MAX.exec(rest);
  if (max) {
    rest = rest.slice(0, max.index);
  }
  const parts = tokens(rest);
  if (
    parts.length % 2 !== 1 ||
    parts.some((part, index) => index % 2 === 1 && part !== "->")
  ) {
    throw new Error("Expected a -> b edge.");
  }
  const endpoints = parts.filter((_, index) => index % 2 === 0);
  if (endpoints.length < 2) {
    throw new Error("Expected a -> b edge.");
  }
  if (endpoints.length > 2 && (id || when || max)) {
    throw new Error("Edge attributes require one edge per line.");
  }
  return endpoints.slice(1).map((target, index) => {
    const source = endpoints[index];
    const dot = source.indexOf(".");
    const from = dot < 0 ? source : source.slice(0, dot);
    const sourceNode = graph.nodes.find((entry) => entry.id === from);
    if (!(IDENTIFIER.test(from) && IDENTIFIER.test(target))) {
      throw new Error(
        "Node ids in edges use letters, digits, underscores and hyphens."
      );
    }
    if (!(sourceNode && graph.nodes.some((entry) => entry.id === target))) {
      throw new Error("Edge names a missing node.");
    }
    return {
      id: id ?? `edge-${graph.edges.length + index + 1}`,
      from: {
        node: from,
        port:
          dot < 0
            ? workflowPorts(sourceNode)[0]
            : string(yaml(source.slice(dot + 1)), "port"),
      },
      to: { node: target },
      ...(max ? { maxIterations: Number(max[1]) } : {}),
      ...(when ? { when } : {}),
    };
  });
}

export interface ParsedWorkflowMarkdown {
  description: string;
  edgeLines: Record<string, number>;
  graph: WorkflowGraph;
  name: string;
  nodeLines: Record<string, number>;
  problems: Problem[];
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: the scanner tracks frontmatter, node bodies and nested fences so prompt code is not parsed as flow.
export function parseWorkflowMarkdown(text: string): ParsedWorkflowMarkdown {
  const graph: WorkflowGraph = { nodes: [], edges: [] };
  const result: ParsedWorkflowMarkdown = {
    graph,
    name: "",
    description: "",
    problems: [],
    nodeLines: {},
    edgeLines: {},
  };
  const problem = (line: number, message: string) =>
    result.problems.push({ line, message: `Line ${line}: ${message}` });
  const lines = text.replaceAll("\r\n", "\n").split("\n");
  if (lines[0] !== "---") {
    problem(1, "Workflow must start with YAML frontmatter.");
    return result;
  }
  const end = lines.indexOf("---", 1);
  if (end < 0) {
    problem(1, "Unclosed YAML frontmatter.");
    return result;
  }
  let frontInputs: WorkflowInput[] = [];
  try {
    const front = object(yaml(lines.slice(1, end).join("\n")), "frontmatter");
    for (const key of Object.keys(front)) {
      if (
        ![
          "name",
          "description",
          "inputs",
          "concurrency",
          "supervisor",
          "defaultProject",
          "defaultMachine",
        ].includes(key)
      ) {
        throw new Error(`Unknown frontmatter field ${key}.`);
      }
    }
    result.name = string(front.name, "name");
    result.description = string(front.description ?? "", "description");
    frontInputs = inputs(front.inputs ?? []);
    graph.settings = {
      concurrency: number(front.concurrency ?? 4, "concurrency"),
    };
    if (front.supervisor !== undefined) {
      if (front.supervisor === null || front.supervisor === "none") {
        graph.settings.defaultSupervisor = null;
      } else {
        const supervisor = object(front.supervisor, "supervisor");
        graph.settings.defaultSupervisor =
          supervisor.delegateType === undefined
            ? {
                instanceId: string(
                  supervisor.instanceId,
                  "supervisor.instanceId"
                ),
              }
            : {
                delegateType: string(
                  supervisor.delegateType,
                  "supervisor.delegateType"
                ),
              };
      }
    }
    for (const key of ["defaultProject", "defaultMachine"] as const) {
      if (front[key] !== undefined) {
        graph.settings[key] = string(front[key], key);
      }
    }
  } catch (error) {
    problem(2, error instanceof Error ? error.message : String(error));
  }
  const sections: Section[] = [];
  const flow: { text: string; line: number }[] = [];
  let current: Section | undefined;
  let inFlow = false;
  let fence = "";
  let nested = "";
  for (let i = end + 1; i < lines.length; i += 1) {
    const textLine = lines[i];
    if (inFlow) {
      if (textLine === "```") {
        inFlow = false;
      } else if (textLine.trim()) {
        flow.push({ text: textLine, line: i + 1 });
      }
      continue;
    }
    if (nested) {
      current?.body.push({ text: textLine, line: i + 1 });
      if (textLine === nested) {
        nested = "";
      }
      continue;
    }
    if (fence) {
      current?.body.push({ text: textLine, line: i + 1 });
      if (textLine === fence) {
        fence = "";
      }
      continue;
    }
    const mapFence = MAP_FENCE.exec(textLine);
    if (mapFence) {
      [, nested] = mapFence;
      current?.body.push({ text: textLine, line: i + 1 });
      continue;
    }
    if (textLine === "```flow") {
      inFlow = true;
      current = undefined;
      continue;
    }
    if (textLine.startsWith("```") || textLine.startsWith("~~~")) {
      fence = textLine.slice(0, 3);
    }
    const header = HEADER.exec(textLine);
    if (header) {
      current = {
        id: header[1],
        kind: header[2],
        attrs: header[3],
        line: i + 1,
        body: [],
      };
      sections.push(current);
      result.nodeLines[current.id] = i + 1;
    } else if (current) {
      current.body.push({ text: textLine, line: i + 1 });
    } else if (textLine.trim()) {
      problem(i + 1, "Expected a node section or fenced flow block.");
    }
  }
  if (inFlow || fence || nested) {
    problem(lines.length, "Unclosed fenced block.");
  }
  for (const section of sections) {
    while (section.body.at(-1)?.text === "") {
      section.body.pop();
    }
    try {
      graph.nodes.push(node(section, frontInputs, problem));
    } catch (error) {
      problem(
        section.line,
        error instanceof Error ? error.message : String(error)
      );
    }
  }
  if (!sections.some((section) => section.kind === "start")) {
    graph.nodes.unshift({
      id: "start",
      kind: "start",
      title: "start",
      position: { x: 0, y: 0 },
      inputs: frontInputs,
    });
    result.nodeLines.start = 2;
  }
  for (const line of flow) {
    try {
      const edges = edgeLine(line.text, graph);
      graph.edges.push(...edges);
      for (const edge of edges) {
        result.edgeLines[edge.id] = line.line;
      }
    } catch (error) {
      problem(
        line.line,
        error instanceof Error ? error.message : String(error)
      );
    }
  }
  if (!result.problems.length) {
    layout(graph);
  }
  return result;
}

const json = (value: unknown): string => JSON.stringify(value);
const attr = (key: string, value: unknown) =>
  value === undefined ? "" : ` ${key}:${json(value)}`;
const showWhen = (when: WorkflowWhen) =>
  `${when.path} ${when.op}${when.value === undefined ? "" : ` ${json(when.value)}`}`;

function serializeRule(rule: WorkflowCheckRule): string {
  switch (rule.kind) {
    case "schema":
      return `schema: ${json(rule.schema)}`;
    case "regex":
      return `regex ${rule.path} /${rule.pattern}/ ${rule.mustMatch ? "must-match" : "must-not-match"}`;
    case "forbidden-words":
      return `forbidden-words ${rule.path}: ${json(rule.words)}`;
    case "file-exists":
      return `file-exists ${json(rule.path)}`;
    case "command":
      return `command ${json(rule.cmd)} expectExit:${rule.expectExit}`;
    default:
      throw new Error("Unknown check rule.");
  }
}

function serializeNode(entry: WorkflowNode): string {
  let header = `### ${entry.id} · ${entry.kind}${attr("title", entry.title)}${attr("notes", entry.notes)}${attr("failedPorts", entry.failedPorts)}`;
  let body = "";
  switch (entry.kind) {
    case "start":
      break;
    case "step":
      for (const key of NODE_ATTRS.step) {
        header += attr(key, entry[key as keyof typeof entry]);
      }
      body = `schema: ${json(entry.outputSchema)}\n${entry.prompt
        .trim()
        .split("\n")
        .map((line) => (PROMPT_ESCAPE.test(line) ? `\\${line}` : line))
        .join("\n")}`;
      break;
    case "check":
      body = entry.rules.map(serializeRule).join("\n");
      break;
    case "branch":
      body = entry.cases
        .map(
          (item) =>
            `${json(item.port)}: ${item.when ? showWhen(item.when) : "else"}`
        )
        .join("\n");
      break;
    case "ask":
      header +=
        attr("allowOther", entry.allowOther) +
        attr("answeredBy", entry.answeredBy) +
        attr("waitFor", entry.waitFor);
      body = `question: ${json(entry.question)}\noptions: ${json(entry.options)}`;
      break;
    case "workflow":
      body = `workflowId: ${json(entry.workflowId)}\ninput: ${json(entry.inputs)}`;
      break;
    case "map": {
      header += attr("concurrency", entry.concurrency);
      const nested = serializeWorkflowMarkdown({
        name: entry.title,
        description: "",
        graph: entry.body,
      }).trimEnd();
      const fence = "~".repeat(
        Math.max(
          2,
          ...Array.from(nested.matchAll(TILDES), (match) => match[0].length)
        ) + 1
      );
      body = `over: ${json(entry.over)}\n${fence}workflow\n${nested}\n${fence}`;
      break;
    }
    case "end":
      body = `outputs: ${json(entry.outputs)}`;
      break;
    default:
      throw new Error("Unknown node kind.");
  }
  return `${header}\n${body}`.trimEnd();
}

export function serializeWorkflowMarkdown(
  workflow: Pick<Workflow, "name" | "description" | "graph">
): string {
  const { graph } = workflow;
  const start = graph.nodes.find((entry) => entry.kind === "start");
  const { settings } = graph;
  const front = stringify({
    name: workflow.name,
    ...(workflow.description ? { description: workflow.description } : {}),
    inputs: start?.inputs ?? [],
    concurrency: settings?.concurrency ?? 4,
    ...(settings?.defaultSupervisor === undefined
      ? {}
      : { supervisor: settings.defaultSupervisor }),
    ...(settings?.defaultProject === undefined
      ? {}
      : { defaultProject: settings.defaultProject }),
    ...(settings?.defaultMachine === undefined
      ? {}
      : { defaultMachine: settings.defaultMachine }),
  });
  const edges = graph.edges.map(
    (edge) =>
      `${edge.from.node}.${json(edge.from.port)} -> ${edge.to.node}${edge.maxIterations === undefined ? "" : ` (max ${edge.maxIterations})`}${edge.when ? ` [when ${showWhen(edge.when)}]` : ""}${attr("id", edge.id)}`
  );
  return `---\n${front}---\n\n${graph.nodes.map(serializeNode).join("\n\n")}\n\n\`\`\`flow\n${edges.join("\n")}\n\`\`\`\n`;
}

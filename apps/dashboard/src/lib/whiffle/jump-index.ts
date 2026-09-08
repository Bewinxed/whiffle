import type { SDKSessionInfo } from "@whiffle/core";
import { sessionTitle, transcriptHref } from "./links";

export interface JumpRow {
  detail: string;
  hay: string;
  href: string;
  id: string;
  label: string;
  labelLower: string;
}

export interface JumpGroup {
  name: string;
  rows: JumpRow[];
}

export interface JumpIndex {
  groups: JumpGroup[];
  recent: JumpGroup[];
}

export interface JumpIndexInput {
  onlineMachines: ReadonlyArray<{
    machineId: string;
    hostname: string;
    os: string;
  }>;
  projects: ReadonlyArray<{ id: string; name: string; cwd: string }>;
  running: ReadonlyArray<{ id: string; cwd: string; activityLabel: string }>;
  stored: ReadonlyArray<{
    machineId: string;
    hostname: string;
    catalog: SDKSessionInfo[];
  }>;
}

const RECENT_PER_MACHINE = 8;
const GROUPS = ["Projects", "Machines", "Running sessions", "Recent sessions"];
const CAPS: Record<string, number> = {
  Projects: 8,
  Machines: 8,
  "Running sessions": 8,
  "Recent sessions": 16,
};
const leaf = (path: string) => path.split("/").filter(Boolean).pop() ?? path;

export function buildJumpIndex(input: JumpIndexInput): JumpIndex {
  const groups = GROUPS.map((name) => ({ name, rows: [] as JumpRow[] }));
  const recentStored: JumpRow[] = [];
  for (const project of input.projects) {
    groups[0].rows.push({
      id: `project:${project.id}`,
      label: project.name,
      detail: project.cwd,
      href: `/project/${project.id}`,
      hay: "",
      labelLower: "",
    });
  }
  for (const machine of input.onlineMachines) {
    groups[1].rows.push({
      id: `machine:${machine.machineId}`,
      label: machine.hostname,
      detail: `${machine.os} · start a session here`,
      href: `/session?machine=${machine.machineId}`,
      hay: "",
      labelLower: "",
    });
  }
  for (const instance of input.running) {
    groups[2].rows.push({
      id: `live:${instance.id}`,
      label: leaf(instance.cwd) || instance.id,
      detail: `${instance.cwd || "—"} · ${instance.activityLabel}`,
      href: `/session/${instance.id}`,
      hay: "",
      labelLower: "",
    });
  }
  for (const machine of input.stored) {
    for (const [i, info] of machine.catalog.entries()) {
      const row: JumpRow = {
        id: `stored:${machine.machineId}:${info.sessionId}`,
        label: sessionTitle(info),
        detail: `${machine.hostname} · ${info.cwd ?? ""}`,
        href: transcriptHref(info),
        hay: "",
        labelLower: "",
      };
      groups[3].rows.push(row);
      if (i < RECENT_PER_MACHINE) {
        recentStored.push(row);
      }
    }
  }
  for (const group of groups) {
    for (const row of group.rows) {
      row.labelLower = row.label.toLowerCase();
      row.hay = `${row.label} ${row.detail}`.toLowerCase();
    }
  }
  return {
    groups: groups.filter((group) => group.rows.length > 0),
    recent: [
      ...groups.slice(0, 3),
      { name: GROUPS[3], rows: recentStored },
    ].filter((group) => group.rows.length > 0),
  };
}

function matches(haystack: string, needle: string): boolean {
  let at = 0;
  for (const char of needle) {
    const found = haystack.indexOf(char, at);
    if (found === -1) {
      return false;
    }
    at = found + 1;
  }
  return true;
}

export function filterJumpIndex(index: JumpIndex, query: string): JumpGroup[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return index.recent;
  }
  return index.groups
    .map((group) => {
      const ranked: { row: JumpRow; tier: number }[] = [];
      for (const row of group.rows) {
        let tier: number;
        if (row.labelLower.startsWith(needle)) {
          tier = 0;
        } else if (row.labelLower.includes(needle)) {
          tier = 1;
        } else if (row.hay.includes(needle)) {
          tier = 2;
        } else if (matches(row.hay, needle)) {
          tier = 3;
        } else {
          continue;
        }
        ranked.push({ row, tier });
      }
      return {
        name: group.name,
        rows: ranked
          .sort((a, b) => a.tier - b.tier)
          .slice(0, CAPS[group.name])
          .map(({ row }) => row),
      };
    })
    .filter((group) => group.rows.length > 0);
}

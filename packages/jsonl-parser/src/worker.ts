/**
 * Worker entry for parallel transcript parsing. Spawned by pool.ts —
 * not part of the public API surface, but shipped as a build entry so
 * `new Worker(new URL("./worker.js", import.meta.url))` resolves from dist.
 */

import { readTranscript } from "./file.ts";
import { typeFilter } from "./scan.ts";
import { extractDoc, type ExtractOptions, type TranscriptDoc } from "./text.ts";
import type { LocatedRecord, ParseStats } from "./types.ts";

export interface WorkerTask {
  files: string[];
  /** "docs" returns extracted TranscriptDocs; "records" returns parsed records. */
  mode: "docs" | "records";
  /** Restrict to these record types via byte prefilter (e.g. ["user","assistant"]). */
  types?: string[];
  extract?: ExtractOptions;
}

export interface WorkerFileResult {
  path: string;
  docs?: TranscriptDoc[];
  records?: LocatedRecord[];
  stats: ParseStats;
  error?: string;
}

export async function runTask(task: WorkerTask): Promise<WorkerFileResult[]> {
  const prefilter = task.types ? typeFilter(...task.types) : undefined;
  const results: WorkerFileResult[] = [];
  for (const path of task.files) {
    try {
      const { records, stats } = await readTranscript(path, { prefilter });
      if (task.mode === "docs") {
        const docs: TranscriptDoc[] = [];
        for (const located of records) {
          const doc = extractDoc(located.record, task.extract);
          if (doc) {
            docs.push(doc);
          }
        }
        results.push({ path, docs, stats });
      } else {
        results.push({ path, records, stats });
      }
    } catch (error) {
      results.push({
        path,
        stats: { lines: 0, parsed: 0, invalid: 0, bytes: 0 },
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return results;
}

declare const self: { onmessage: ((event: MessageEvent) => void) | null } | undefined;
declare function postMessage(message: unknown): void;

// This module is also imported on the main thread (pool.ts uses runTask as
// the no-worker fallback), where registering a global onmessage handler
// would pin the event loop open. Only self-register inside a real worker.
import { isMainThread } from "node:worker_threads";

if (!isMainThread && typeof self !== "undefined" && self !== null) {
  self.onmessage = async (event: MessageEvent) => {
    const results = await runTask(event.data as WorkerTask);
    postMessage(results);
  };
}

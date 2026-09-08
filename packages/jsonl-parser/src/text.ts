/**
 * Text extraction: turn transcript records into indexable documents.
 *
 * On a real 1 GB corpus the searchable message/thinking text is ~2.3% of the
 * bytes — everything else is tool results, metadata, and envelopes. This
 * module defines the document shape the BM25 layers consume.
 */

import type { AssistantRecord, ContentBlock, TranscriptRecord, UserRecord } from "./types.ts";

/** A normalized, harness-agnostic searchable document. */
export interface TranscriptDoc {
  /** Which harness produced it (claude-code, opencode, ...). */
  harness: string;
  sessionId: string;
  /** Record uuid (claude-code) or message id (opencode). */
  id: string;
  role: "user" | "assistant";
  /** ISO timestamp when known. */
  timestamp?: string;
  /** Message + thinking text. */
  text: string;
  /** Names of tools invoked in this record, space-joined (searchable facet). */
  tools?: string;
  cwd?: string;
  model?: string;
  /** True for sidechain/subagent records. */
  sidechain?: boolean;
}

export interface ExtractOptions {
  /** Include thinking blocks (default true). */
  thinking?: boolean;
  /** Include stringified tool_use inputs, capped per block (default 0 = off). */
  toolInputBytes?: number;
  /** Skip system-injected user records (isMeta) (default true). */
  skipMeta?: boolean;
}

function blocksToText(
  content: string | ContentBlock[] | undefined,
  options: ExtractOptions,
): { text: string; tools: string[] } {
  const tools: string[] = [];
  if (typeof content === "string") {
    return { text: content, tools };
  }
  if (!Array.isArray(content)) {
    return { text: "", tools };
  }
  const parts: string[] = [];
  for (const block of content) {
    switch (block.type) {
      case "text":
        parts.push(block.text as string);
        break;
      case "thinking":
        if (options.thinking !== false) {
          parts.push(block.thinking as string);
        }
        break;
      case "tool_use": {
        tools.push(block.name as string);
        const cap = options.toolInputBytes ?? 0;
        if (cap > 0) {
          try {
            parts.push(JSON.stringify(block.input).slice(0, cap));
          } catch {
            // circular or non-serializable input: skip
          }
        }
        break;
      }
      default:
        break;
    }
  }
  return { text: parts.join("\n"), tools };
}

/**
 * Extract a searchable document from a record, or null when the record has
 * no indexable text (tool_result-only user records, metadata records, ...).
 */
export function extractDoc(
  record: TranscriptRecord,
  options: ExtractOptions = {},
): TranscriptDoc | null {
  if (record.type !== "user" && record.type !== "assistant") {
    return null;
  }
  const r = record as UserRecord | AssistantRecord;
  if (record.type === "user" && options.skipMeta !== false && (r as UserRecord).isMeta) {
    return null;
  }
  const message = r.message;
  if (!message) {
    return null;
  }
  const { text, tools } = blocksToText(message.content, options);
  if (!text && tools.length === 0) {
    return null;
  }
  return {
    harness: "claude-code",
    sessionId: r.sessionId ?? "",
    id: r.uuid ?? "",
    role: record.type,
    timestamp: r.timestamp,
    text,
    tools: tools.length > 0 ? tools.join(" ") : undefined,
    cwd: r.cwd,
    model: record.type === "assistant" ? (message as { model?: string }).model : undefined,
    sidechain: r.isSidechain === true ? true : undefined,
  };
}

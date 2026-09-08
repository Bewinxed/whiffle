/**
 * Byte-level line scanning and lazy parsing.
 *
 * Design: newline scanning over raw bytes runs at ~3.5 GB/s single-threaded;
 * JSON.parse runs at ~0.5 GB/s. So the scanner yields cheap line spans and
 * lets callers decide — via a byte-level prefilter — which lines are worth
 * materializing. A 5 MB tool_result line that the caller filters out costs
 * one indexOf, not a parse.
 */

import type { LocatedRecord, ParseStats, TranscriptRecord } from "./types.ts";

const NEWLINE = 10;
const decoder = new TextDecoder();

export interface LineSpan {
  /** 1-based line number. */
  line: number;
  /** Byte offset of line start. */
  offset: number;
  /** Byte length excluding newline. */
  byteLength: number;
}

/** Iterate non-empty line spans in a buffer. Zero allocation per line beyond the span. */
export function* lineSpans(buf: Uint8Array, baseOffset = 0): Generator<LineSpan> {
  let start = 0;
  let line = 0;
  const len = buf.length;
  while (start < len) {
    let nl = buf.indexOf(NEWLINE, start);
    if (nl === -1) {
      nl = len;
    }
    line++;
    if (nl > start) {
      yield { line, offset: baseOffset + start, byteLength: nl - start };
    }
    start = nl + 1;
  }
}

/**
 * A prefilter decides from raw bytes whether a line should be parsed.
 * Return false to skip without decoding or parsing.
 */
export type BytePrefilter = (buf: Uint8Array, span: LineSpan, base: number) => boolean;

/** Build a prefilter that requires at least one of the given substrings in the line. */
export function includesAny(...needles: string[]): BytePrefilter {
  const encoded = needles.map((n) => new TextEncoder().encode(n));
  return (buf, span, base) => {
    const local = span.offset - base;
    const view = buf.subarray(local, local + span.byteLength);
    return encoded.some((needle) => indexOfBytes(view, needle) !== -1);
  };
}

/** Prefilter matching the record `type` discriminator, e.g. typeFilter("user", "assistant"). */
export function typeFilter(...types: string[]): BytePrefilter {
  return includesAny(...types.map((t) => `"type":"${t}"`));
}

/** Naive byte search (memchr-accelerated on the first byte). Fine for short needles. */
function indexOfBytes(haystack: Uint8Array, needle: Uint8Array): number {
  const first = needle[0];
  if (first === undefined) {
    return 0;
  }
  const max = haystack.length - needle.length;
  let i = -1;
  while ((i = haystack.indexOf(first, i + 1)) !== -1 && i <= max) {
    let j = 1;
    while (j < needle.length && haystack[i + j] === needle[j]) {
      j++;
    }
    if (j === needle.length) {
      return i;
    }
  }
  return -1;
}

export interface ScanOptions {
  /** Skip lines failing this byte-level test before any decode/parse. */
  prefilter?: BytePrefilter;
  /** Byte offset the buffer starts at within its file (for incremental tails). */
  baseOffset?: number;
  /** Line number the buffer starts at within its file. */
  baseLine?: number;
  /** Collect per-pass counters. */
  stats?: ParseStats;
}

/**
 * Parse records out of a JSONL buffer. Invalid JSON lines are counted and
 * skipped, never thrown (crash-truncated tails and corrupt writes exist in
 * real corpora). Unknown record types pass through as OtherRecord.
 */
export function* parseRecords(
  buf: Uint8Array,
  options: ScanOptions = {},
): Generator<LocatedRecord> {
  const base = options.baseOffset ?? 0;
  const lineBase = options.baseLine ?? 0;
  const stats = options.stats;
  if (stats) {
    stats.bytes += buf.length;
  }
  for (const span of lineSpans(buf, base)) {
    if (stats) {
      stats.lines++;
    }
    if (options.prefilter && !options.prefilter(buf, span, base)) {
      continue;
    }
    const local = span.offset - base;
    const text = decoder.decode(buf.subarray(local, local + span.byteLength));
    let record: TranscriptRecord;
    try {
      record = JSON.parse(text) as TranscriptRecord;
    } catch {
      if (stats) {
        stats.invalid++;
      }
      continue;
    }
    if (typeof record !== "object" || record === null) {
      if (stats) {
        stats.invalid++;
      }
      continue;
    }
    if (stats) {
      stats.parsed++;
    }
    yield {
      record,
      line: lineBase + span.line,
      offset: span.offset,
      byteLength: span.byteLength,
    };
  }
}

export function newStats(): ParseStats {
  return { lines: 0, parsed: 0, invalid: 0, bytes: 0 };
}

export interface TranscriptHit {
  cwd: string | null;
  docId: string;
  harness: string;
  instanceId?: string;
  machineId: string;
  model: string | null;
  role: string;
  score: number;
  sessionId: string;
  sidechain: boolean;
  snippet: string;
  timestamp: string | null;
}

export class JumpTranscriptSearch {
  hits = $state<TranscriptHit[]>([]);
  pending = $state(false);
  #timer: ReturnType<typeof setTimeout> | undefined;
  #controller: AbortController | undefined;

  update(query: string) {
    clearTimeout(this.#timer);
    // Any keystroke invalidates whatever is in flight — otherwise a stale
    // response can land during the debounce window and publish old hits.
    // Clearing the field keeps the aborted request's `finally` from touching
    // `pending`, which now belongs to the query being scheduled.
    this.#controller?.abort();
    this.#controller = undefined;
    const q = query.trim();
    if (q.length < 2) {
      this.hits = [];
      this.pending = false;
      return;
    }
    this.pending = true;
    this.#timer = setTimeout(() => this.#run(q), 150);
  }

  async #run(q: string) {
    this.#controller?.abort();
    const controller = new AbortController();
    this.#controller = controller;
    try {
      const response = await fetch(
        `/api/search?${new URLSearchParams({ q, limit: "20" })}`,
        { signal: controller.signal }
      );
      if (!response.ok) {
        throw new Error(`Transcript search failed: ${response.status}`);
      }
      const { hits } = (await response.json()) as { hits: TranscriptHit[] };
      if (controller.signal.aborted) {
        return;
      }
      const seen = new Set<string>();
      const next = hits
        .filter((hit) => {
          if (seen.has(hit.sessionId)) {
            return false;
          }
          seen.add(hit.sessionId);
          return true;
        })
        .slice(0, 10);
      // Stable rows preserve Command's keyboard selection across refreshes.
      if (
        next.length !== this.hits.length ||
        next.some((hit, i) => hit.docId !== this.hits[i].docId)
      ) {
        this.hits = next;
      }
    } catch {
      if (!controller.signal.aborted) {
        this.hits = [];
      }
    } finally {
      if (this.#controller === controller) {
        this.pending = false;
      }
    }
  }
}

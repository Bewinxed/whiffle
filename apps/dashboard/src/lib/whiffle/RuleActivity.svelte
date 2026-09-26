<script lang="ts">
  import {
    loadRuleActivity,
    message,
    type RuleActivity,
    since,
    times,
  } from "./rules";

  /**
   * What the rule has caught, and what each session said it did about it.
   *
   * This panel is load-bearing rather than decorative. A session reads the
   * reply and is asked to acknowledge it, but never sees the rule's name, id or
   * fire count, so this is the only surface where the mechanism is visible. It is also
   * what makes the tool a session calls honest: that tool says the note reaches
   * the user, and this is the place it reaches.
   */
  let { ruleId }: { ruleId: string } = $props();

  let rows = $state<RuleActivity[]>([]);
  let failed = $state<string | undefined>(undefined);
  let loading = $state(true);

  $effect(() => {
    const id = ruleId;
    loading = true;
    failed = undefined;
    loadRuleActivity(id)
      .then((payload) => {
        if (id !== ruleId) {
          return;
        }
        rows = payload.activity;
      })
      .catch((error: unknown) => {
        if (id !== ruleId) {
          return;
        }
        failed = message(error);
      })
      .finally(() => {
        if (id === ruleId) {
          loading = false;
        }
      });
  });

  const waiting = $derived(
    rows.filter((row) => row.status === "pending").length
  );
</script>

<section
  class="flex flex-col gap-4 rounded-[var(--radius-lg)] bg-card p-5 shadow-md"
>
  <div class="flex flex-col gap-1">
    <h2 class="text-body font-medium">What it has caught</h2>
    <p class="max-w-prose text-label text-muted-foreground">
      Sessions see the reply but never this rule's name or history, so this is
      the only place it is visible. Anything a session wrote back appears here.
    </p>
  </div>

  {#if loading}
    <p class="text-meta text-muted-foreground">Loading…</p>
  {:else if failed}
    <p class="text-meta text-warning" role="alert">{failed}</p>
  {:else if rows.length === 0}
    <p class="text-meta text-muted-foreground">
      It has not caught anything yet. Nothing to see is the good outcome.
    </p>
  {:else}
    {#if waiting > 0}
      <p class="text-label text-warning">
        {waiting}
        {waiting === 1 ? 'session is' : 'sessions are'}
        still being reminded — nothing written back yet.
      </p>
    {/if}
    <ul class="flex flex-col gap-3">
      {#each rows as row (row.instanceId)}
        <li
          class="flex flex-col gap-1.5 rounded-[var(--radius-md)] bg-muted/40 p-4"
        >
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <span class="flex items-baseline gap-2">
              <span class="font-mono text-label text-foreground"
                >{row.where}</span
              >
              {#if row.harness}
                <span class="text-label text-muted-foreground"
                  >{row.harness}</span
                >
              {/if}
            </span>
            <span class="text-label text-muted-foreground">
              {times(row.totalFires)}, last {since(row.lastFiredAt)}
            </span>
          </div>

          {#if row.status === 'pending'}
            <p class="text-label text-warning">
              Reminded {times(row.fireCount)} since it last wrote back.
            </p>
          {/if}

          {#if row.ackNote}
            <!-- The session's own words. Quoted rather than paraphrased: what it
                 claims it did is the thing worth reading closely. -->
            <blockquote
              class="border-l border-border pl-3 text-meta text-foreground"
            >
              {row.ackNote}
            </blockquote>
            <span class="text-label text-muted-foreground"
              >Written back {since(row.ackedAt)}.</span
            >
          {:else if row.status !== 'pending'}
            <p class="text-label text-muted-foreground">
              Settled without a note.
            </p>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</section>

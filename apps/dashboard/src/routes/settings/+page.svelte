<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { fade } from "svelte/transition";
  import { toast } from "svelte-sonner";
  import { replaceState } from "$app/navigation";
  import { page } from "$app/state";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Switch } from "$lib/components/ui/switch";
  import { formatDistanceToNow } from "$lib/utils/time";
  import {
    type OpenRouterState,
    saveSuggestSetting,
    suggestions,
  } from "$lib/whiffle/suggest.svelte";
  import {
    loadSupervisor,
    type SupervisorStatus,
    saveSupervisorConfig,
  } from "$lib/whiffle/supervisor";
  import type { PageData } from "./$types";

  /**
   * Hub-wide connections. OpenRouter is connected by OAuth PKCE: the hub holds
   * the verifier and the key, the browser only carries the operator to
   * OpenRouter and the `code` back.
   */
  let { data }: { data: PageData } = $props();

  /** Reduced motion swaps states in place, with no crossfade. */
  let still = $state(false);
  const swap = (duration: number) => ({ duration: still ? 0 : duration });

  let openrouter = $state<OpenRouterState>(untrack(() => data.openrouter));
  let exchanging = $state(false);
  let connecting = $state(false);
  let disconnecting = $state(false);
  let openrouterError = $state<string | null>(untrack(() => data.error));
  let savingSuggest = $state(false);

  const phase = $derived.by(() => {
    if (exchanging) {
      return "exchanging";
    }
    return openrouter.connected ? "connected" : "disconnected";
  });

  async function readOpenRouter() {
    openrouter = await (await fetch("/api/openrouter")).json();
    suggestions.enabled = openrouter.connected && openrouter.suggestWhileTyping;
  }

  async function connect() {
    connecting = true;
    openrouterError = null;
    const response = await fetch("/api/openrouter/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callbackUrl: `${location.origin}/settings` }),
    });
    if (!response.ok) {
      openrouterError = `${response.status} ${await response.text()}`;
      connecting = false;
      return;
    }
    const { authUrl } = (await response.json()) as { authUrl: string };
    location.href = authUrl;
  }

  async function exchange(code: string) {
    exchanging = true;
    openrouterError = null;
    const response = await fetch("/api/openrouter/exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (response.ok) {
      await readOpenRouter();
      toast.success("OpenRouter is connected.");
    } else {
      openrouterError = `${response.status} ${await response.text()}`;
    }
    exchanging = false;
  }

  async function disconnect() {
    disconnecting = true;
    openrouterError = null;
    const response = await fetch("/api/openrouter", { method: "DELETE" });
    if (response.ok) {
      await readOpenRouter();
    } else {
      openrouterError = `${response.status} ${await response.text()}`;
    }
    disconnecting = false;
  }

  async function setSuggest(on: boolean) {
    savingSuggest = true;
    openrouterError = null;
    try {
      await saveSuggestSetting(on);
      openrouter.suggestWhileTyping = on;
    } catch (error) {
      openrouterError = error instanceof Error ? error.message : String(error);
    }
    savingSuggest = false;
  }

  // ── supervisor ──────────────────────────────────────────────────────────

  let supervisor = $state<SupervisorStatus | null>(null);
  let supervisorError = $state<string | null>(null);
  let enabled = $state(false);
  let baseUrl = $state("");
  let model = $state("");
  let apiKey = $state("");
  let saving = $state(false);

  async function readSupervisor() {
    try {
      supervisor = await loadSupervisor();
      const { config } = supervisor;
      ({ enabled } = config);
      baseUrl = config.baseUrl ?? "";
      model = config.model ?? "";
    } catch (error) {
      supervisorError = error instanceof Error ? error.message : String(error);
    }
  }

  async function saveSupervisor(event: SubmitEvent) {
    event.preventDefault();
    saving = true;
    supervisorError = null;
    try {
      await saveSupervisorConfig({
        enabled,
        baseUrl: baseUrl.trim(),
        model: model.trim(),
        ...(apiKey === "" ? {} : { apiKey }),
      });
      apiKey = "";
      toast.success("Supervisor settings saved.");
      await readSupervisor();
    } catch (error) {
      supervisorError = error instanceof Error ? error.message : String(error);
    }
    saving = false;
  }

  const reach = $derived.by(
    (): { tone: "wait" | "off" | "bad" | "ok"; text: string } => {
      if (!supervisor) {
        return { tone: "wait", text: "Checking the server…" };
      }
      const { status } = supervisor;
      if (!status.configured) {
        return {
          tone: "off",
          text: "Not configured. Set a server URL and a model to turn it on.",
        };
      }
      if (!status.reachable) {
        return {
          tone: "bad",
          text: `The server at ${supervisor.config.baseUrl} did not answer.`,
        };
      }
      return {
        tone: "ok",
        text: status.resolvedModel
          ? `The server answers, and runs ${status.resolvedModel}.`
          : "The server answers.",
      };
    }
  );

  /** Morphing cards measure their content so the height change is animated. */
  let openrouterHeight = $state(0);
  let reachHeight = $state(0);

  /**
   * OpenRouter's redirect back lands here with `?code=`: exchange it, then
   * strip it from the URL. In that order on purpose — the router is not up
   * while the page is still hydrating, and SvelteKit refuses `replaceState`
   * until it is; by the time the exchange has answered, it is.
   */
  async function finishConnect(code: string) {
    await exchange(code);
    const url = new URL(page.url);
    url.searchParams.delete("code");
    replaceState(url, page.state);
  }

  onMount(() => {
    const code = page.url.searchParams.get("code");
    if (code) {
      // biome-ignore lint/complexity/noVoid: the exchange reports its own outcome in page state
      void finishConnect(code);
    }
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    still = query.matches;
    const follow = () => {
      still = query.matches;
    };
    query.addEventListener("change", follow);

    // biome-ignore lint/complexity/noVoid: the read reports its own outcome in page state
    void readSupervisor();
    return () => query.removeEventListener("change", follow);
  });
</script>

<svelte:head>
  <title>Settings · Whiffle</title>
</svelte:head>

<div class="page">
  <div class="col">
    <section aria-labelledby="openrouter-heading" class="panel">
      <header class="head">
        <h2 id="openrouter-heading">OpenRouter</h2>
        <p>Used to ask Jev yes/no questions for meaning-based rules.</p>
      </header>

      <div
        class="morph"
        style:block-size={openrouterHeight ? `${openrouterHeight}px` : undefined}
      >
        <div class="stack" bind:clientHeight={openrouterHeight}>
          {#key phase}
            <div class="row state" in:fade={swap(300)} out:fade={swap(100)}>
              {#if phase === 'exchanging'}
                <p aria-live="polite" class="status">
                  <span aria-hidden="true" class="pulse"></span>
                  Finishing the connection with OpenRouter…
                </p>
              {:else if phase === 'connected' && openrouter.connectedAt !== null}
                <p class="status connected">
                  <svg aria-hidden="true" class="check" viewBox="0 0 20 20">
                    <circle cx="10" cy="10" r="10"></circle>
                    <path d="M6.2 10.4l2.5 2.5 5.1-5.6"></path>
                  </svg>
                  Connected
                  {formatDistanceToNow(new Date(openrouter.connectedAt))}
                </p>
                <Button
                  class="press"
                  disabled={disconnecting}
                  onclick={disconnect}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {disconnecting ? 'Disconnecting…' : 'Disconnect'}
                </Button>
              {:else}
                <p class="status">Not connected</p>
                <Button
                  class="press"
                  disabled={connecting}
                  onclick={connect}
                  type="button"
                >
                  {connecting ? 'Opening OpenRouter…' : 'Connect OpenRouter'}
                </Button>
              {/if}
            </div>
          {/key}
        </div>
      </div>

      <!-- biome-ignore lint/a11y/noLabelWithoutControl: wraps the <Switch> component; the native control it renders is not visible to Biome -->
      <label class="row setting">
        <span class="copy">
          <span class="label">Suggest skills and MCP servers while typing</span>
          <span class="hint">
            {#if openrouter.connected}
              Jev reads the message as you write it and offers chips you can add
              to it. The session's tools are not changed.
            {:else}
              Needs OpenRouter — connect it above
            {/if}
          </span>
        </span>
        <Switch
          checked={openrouter.suggestWhileTyping}
          disabled={!openrouter.connected || savingSuggest}
          onCheckedChange={setSuggest}
        />
      </label>

      {#if openrouterError}
        <p class="error" role="alert">{openrouterError}</p>
      {/if}
    </section>

    <form
      aria-labelledby="supervisor-heading"
      class="panel"
      onsubmit={saveSupervisor}
    >
      <header class="head">
        <h2 id="supervisor-heading">Supervisor</h2>
        <p>
          The OpenAI-compatible server that judges turns for LLM rules and
          autopilot.
        </p>
      </header>

      <!-- biome-ignore lint/a11y/noLabelWithoutControl: wraps the <Switch> component; the native control it renders is not visible to Biome -->
      <label class="row setting">
        <span class="copy">
          <span class="label">Enabled</span>
          <span class="hint">
            {enabled ? 'LLM rules and autopilot are judged by this server.' : 'Off — LLM rules and autopilot do nothing.'}
          </span>
        </span>
        <Switch bind:checked={enabled} />
      </label>

      <div class="fields">
        <!-- biome-ignore lint/a11y/noLabelWithoutControl: wraps the <Input> component; the native control it renders is not visible to Biome -->
        <label class="field">
          <span class="label">Server URL</span>
          <Input
            autocomplete="off"
            class="font-mono text-label md:text-label"
            placeholder="http://localhost:8080/v1"
            spellcheck="false"
            bind:value={baseUrl}
          />
        </label>
        <!-- biome-ignore lint/a11y/noLabelWithoutControl: wraps the <Input> component; the native control it renders is not visible to Biome -->
        <label class="field">
          <span class="label">Model</span>
          <Input
            autocomplete="off"
            class="font-mono text-label md:text-label"
            placeholder="qwen3"
            spellcheck="false"
            bind:value={model}
          />
        </label>
        <!-- biome-ignore lint/a11y/noLabelWithoutControl: wraps the <Input> component; the native control it renders is not visible to Biome -->
        <label class="field wide">
          <span class="label">API key</span>
          <Input
            autocomplete="off"
            placeholder="Leave blank to keep the stored key"
            type="password"
            bind:value={apiKey}
          />
        </label>
      </div>

      <div
        class="morph"
        style:block-size={reachHeight ? `${reachHeight}px` : undefined}
      >
        <div class="stack" bind:clientHeight={reachHeight}>
          {#key reach.text}
            <p
              aria-live="polite"
              class="reach"
              data-tone={reach.tone}
              in:fade={swap(300)}
              out:fade={swap(100)}
            >
              <span aria-hidden="true" class="dot"></span>
              {reach.text}
            </p>
          {/key}
        </div>
      </div>

      {#if supervisorError}
        <p class="error" role="alert">{supervisorError}</p>
      {/if}

      <div class="actions">
        <Button class="press" disabled={saving} type="submit">
          {saving ? 'Saving…' : 'Save supervisor'}
        </Button>
      </div>
    </form>
  </div>
</div>

<style>
  .page {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-6);
    container: settings / inline-size;
  }

  .col {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    max-inline-size: 42rem;
    margin-inline: auto;
  }

  .panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    padding: var(--space-5);
    border-radius: var(--radius-lg);
    background: var(--surface-raised);
    box-shadow: var(--shadow-tile);
  }

  .head {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);

    & h2 {
      margin: 0;
      font-size: var(--text-body);
      font-weight: 500;
      color: var(--ink-strong);
      text-wrap: balance;
    }

    & p {
      margin: 0;
      max-inline-size: 60ch;
      font-size: var(--text-label);
      color: var(--ink-muted);
      text-wrap: pretty;
    }
  }

  .copy {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .label {
    font-size: var(--text-label);
    color: var(--ink-strong);
  }

  .hint {
    max-inline-size: 52ch;
    font-size: var(--text-label);
    color: var(--ink-muted);
    text-wrap: pretty;
  }

  /* Label and control side by side when there is room, stacked when not. */
  .row {
    display: flex;
    flex-direction: column;
    align-items: start;
    gap: var(--space-3);

    @container settings (inline-size > 30rem) {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
    }
  }

  .setting {
    cursor: pointer;
    padding-block-start: var(--space-4);
    border-block-start: 1px solid var(--border-hairline);

    /* A setting that cannot be changed right now reads as such. */
    &:has(:disabled) {
      cursor: default;

      & .label {
        color: var(--ink-muted);
      }
    }

    & :global([data-slot="switch-thumb"]) {
      transition: transform var(--dur-panel) var(--ease-in-out);
    }
  }

  /* A card whose content swaps: the height is measured and tweened. */
  .morph {
    interpolate-size: allow-keywords;
    overflow: clip;
    overflow-clip-margin: var(--space-2);

    @media (prefers-reduced-motion: no-preference) {
      transition: block-size var(--dur-panel) var(--ease-out);
    }
  }

  .stack {
    display: grid;

    & > * {
      grid-area: 1 / 1;
    }
  }

  .status {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    margin: 0;
    font-size: var(--text-label);
    color: var(--ink-muted);

    &.connected {
      color: var(--ink-strong);
    }
  }

  .check {
    inline-size: 18px;
    block-size: 18px;
    flex: none;
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;

    & circle {
      fill: color-mix(in oklab, var(--success-9) 16%, transparent);
      stroke: none;
    }

    & path {
      stroke: var(--success-11);
      stroke-width: 1.8;
      stroke-dasharray: 12;
      stroke-dashoffset: 0;
    }

    @media (prefers-reduced-motion: no-preference) {
      & path {
        animation: draw var(--c-500) var(--ease-out) var(--dur-control) both;
      }
    }
  }

  @keyframes draw {
    from {
      stroke-dashoffset: 12;
    }
  }

  .pulse {
    inline-size: 8px;
    block-size: 8px;
    border-radius: 50%;
    background: var(--ink-muted);
    opacity: 0.6;

    @media (prefers-reduced-motion: no-preference) {
      animation: breathe var(--breath) var(--ease-in-out) infinite;
    }
  }

  @keyframes breathe {
    50% {
      opacity: 0.2;
    }
  }

  .fields {
    display: grid;
    gap: var(--space-4);

    @container settings (inline-size > 30rem) {
      grid-template-columns: 1fr 1fr;

      & .wide {
        grid-column: 1 / -1;
      }
    }
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .reach {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    margin: 0;
    font-size: var(--text-label);
    color: var(--ink-muted);
    text-wrap: pretty;

    & .dot {
      inline-size: 7px;
      block-size: 7px;
      flex: none;
      border-radius: 50%;
      background: var(--ink-muted);
      opacity: 0.5;
      translate: 0 -1px;
    }

    &[data-tone="ok"] .dot {
      background: var(--success-9);
      opacity: 1;
    }

    &[data-tone="bad"] .dot {
      background: var(--warning-9);
      opacity: 1;
    }
  }

  .error {
    margin: 0;
    font-size: var(--text-label);
    color: var(--destructive);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    opacity: 1;
    transition: opacity var(--dur-panel) var(--ease-out);

    @starting-style {
      opacity: 0;
    }
  }

  .actions {
    display: flex;
    justify-content: end;
  }

  .panel :global(.press) {
    @media (prefers-reduced-motion: no-preference) {
      transition:
        transform var(--dur-control) var(--ease-out),
        background-color var(--dur-control) var(--ease-out);

      &:active:not(:disabled) {
        transform: scale(0.97);
      }
    }

    @media (pointer: coarse) {
      min-block-size: 44px;
    }
  }
</style>

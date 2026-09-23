<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { toast } from "svelte-sonner";
  import { replaceState } from "$app/navigation";
  import { page } from "$app/state";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Switch } from "$lib/components/ui/switch";
  import { formatDistanceToNow } from "$lib/utils/time";
  import {
    loadSupervisor,
    type SupervisorStatus,
    saveSupervisorConfig,
  } from "$lib/whiffle/supervisor";
  import type { OpenRouterState } from "./+page";
  import type { PageData } from "./$types";

  /**
   * Hub-wide connections. OpenRouter is connected by OAuth PKCE: the hub holds
   * the verifier and the key, the browser only carries the user to OpenRouter
   * and the `code` back.
   */
  let { data }: { data: PageData } = $props();

  let openrouter = $state<OpenRouterState>(untrack(() => data.openrouter));
  let connecting = $state(false);
  let exchanging = $state(false);
  let disconnecting = $state(false);
  let openrouterError = $state<string | null>(untrack(() => data.error));

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
      openrouter = await (await fetch("/api/openrouter")).json();
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
      openrouter = { connected: false, connectedAt: null };
    } else {
      openrouterError = `${response.status} ${await response.text()}`;
    }
    disconnecting = false;
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

  const reach = $derived.by(() => {
    if (!supervisor) {
      return "Checking the server…";
    }
    const { status } = supervisor;
    if (!status.configured) {
      return "Not configured. Set a server URL and a model to turn it on.";
    }
    if (!status.reachable) {
      return `The server at ${supervisor.config.baseUrl} did not answer.`;
    }
    return status.resolvedModel
      ? `The server answers, and runs ${status.resolvedModel}.`
      : "The server answers.";
  });

  onMount(() => {
    const code = page.url.searchParams.get("code");
    if (code) {
      const url = new URL(page.url);
      url.searchParams.delete("code");
      replaceState(url, page.state);
      // biome-ignore lint/complexity/noVoid: the exchange reports its own outcome in page state
      void exchange(code);
    }
    // biome-ignore lint/complexity/noVoid: the read reports its own outcome in page state
    void readSupervisor();
  });
</script>

<svelte:head>
  <title>Settings · Whiffle</title>
</svelte:head>

<div class="flex-1 overflow-y-auto p-6">
  <div class="mx-auto flex max-w-2xl flex-col gap-6">
    <section
      aria-labelledby="openrouter-heading"
      class="flex flex-col gap-4 rounded-[var(--radius-panel)] bg-card p-5 shadow-md"
    >
      <div class="flex flex-col gap-1">
        <h2 class="text-body font-medium" id="openrouter-heading">
          OpenRouter
        </h2>
        <p class="max-w-prose text-micro text-muted-foreground">
          Used to ask Jev yes/no questions for meaning-based rules.
        </p>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3">
        {#if exchanging}
          <p aria-live="polite" class="text-caption text-muted-foreground">
            Finishing the connection with OpenRouter…
          </p>
        {:else if openrouter.connected && openrouter.connectedAt !== null}
          <p class="text-caption text-foreground">
            Connected {formatDistanceToNow(new Date(openrouter.connectedAt))}
          </p>
          <Button
            disabled={disconnecting}
            onclick={disconnect}
            size="sm"
            type="button"
            variant="outline"
          >
            {disconnecting ? 'Disconnecting…' : 'Disconnect'}
          </Button>
        {:else}
          <p class="text-caption text-muted-foreground">Not connected</p>
          <Button disabled={connecting} onclick={connect} type="button">
            {connecting ? 'Opening OpenRouter…' : 'Connect OpenRouter'}
          </Button>
        {/if}
      </div>

      {#if openrouterError}
        <p
          class="text-micro whitespace-pre-wrap break-words text-destructive"
          role="alert"
        >
          {openrouterError}
        </p>
      {/if}
    </section>

    <form
      aria-labelledby="supervisor-heading"
      class="flex flex-col gap-4 rounded-[var(--radius-panel)] bg-card p-5 shadow-md"
      onsubmit={saveSupervisor}
    >
      <div class="flex flex-col gap-1">
        <h2 class="text-body font-medium" id="supervisor-heading">
          Supervisor
        </h2>
        <p class="max-w-prose text-micro text-muted-foreground">
          The OpenAI-compatible server that judges turns for LLM rules and
          autopilot.
        </p>
      </div>

      <!-- biome-ignore lint/a11y/noLabelWithoutControl: wraps the <Switch> component; the native control it renders is not visible to Biome -->
      <label class="flex w-fit items-center gap-3">
        <Switch bind:checked={enabled} />
        <span class="text-caption">{enabled ? 'Enabled' : 'Off'}</span>
      </label>

      <div class="grid gap-4 sm:grid-cols-2">
        <!-- biome-ignore lint/a11y/noLabelWithoutControl: wraps the <Input> component; the native control it renders is not visible to Biome -->
        <label class="flex flex-col gap-1.5 text-caption">
          Server URL
          <Input
            autocomplete="off"
            class="font-mono text-sm md:text-sm"
            placeholder="http://localhost:8080/v1"
            spellcheck="false"
            bind:value={baseUrl}
          />
        </label>
        <!-- biome-ignore lint/a11y/noLabelWithoutControl: wraps the <Input> component; the native control it renders is not visible to Biome -->
        <label class="flex flex-col gap-1.5 text-caption">
          Model
          <Input
            autocomplete="off"
            class="font-mono text-sm md:text-sm"
            placeholder="qwen3"
            spellcheck="false"
            bind:value={model}
          />
        </label>
      </div>

      <!-- biome-ignore lint/a11y/noLabelWithoutControl: wraps the <Input> component; the native control it renders is not visible to Biome -->
      <label class="flex flex-col gap-1.5 text-caption">
        API key
        <Input
          autocomplete="off"
          placeholder="Leave blank to keep the stored key"
          type="password"
          bind:value={apiKey}
        />
      </label>

      <p aria-live="polite" class="text-caption text-muted-foreground">
        {reach}
      </p>

      {#if supervisorError}
        <p class="text-micro text-destructive" role="alert">
          {supervisorError}
        </p>
      {/if}

      <div class="flex justify-end">
        <Button disabled={saving} type="submit">
          {saving ? 'Saving…' : 'Save supervisor'}
        </Button>
      </div>
    </form>
  </div>
</div>

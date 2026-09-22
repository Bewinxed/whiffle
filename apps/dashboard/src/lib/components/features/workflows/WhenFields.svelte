<script lang="ts">
  import type { WorkflowWhen } from "@whiffle/core";
  import JsonField from "./JsonField.svelte";

  let {
    value,
    onchange,
  }: {
    value: WorkflowWhen | undefined;
    onchange: (value: WorkflowWhen | undefined) => void;
  } = $props();
</script>
<label
  >When<select
    onchange={(event) => onchange(event.currentTarget.value === 'always' ? undefined : { path: 'result.pass', op: 'truthy' })}
    value={value ? 'condition' : 'always'}
  >
    <option value="always">Always</option>
    <option value="condition">Condition</option>
  </select></label
>
{#if value}
  <label
    >Path<input
      oninput={(event) => value && onchange({ ...value, path: event.currentTarget.value })}
      value={value.path}
    ></label
  ><label
    >Operator<select
      onchange={(event) => value && onchange({ ...value, op: event.currentTarget.value as WorkflowWhen['op'] })}
      value={value.op}
    >
      {#each ['eq','neq','gt','lt','contains','matches','truthy','falsy'] as op (op)}
        <option>{op}</option>
      {/each}
    </select></label
  >
  {#if value.op !== 'truthy' && value.op !== 'falsy'}
    <JsonField
      label="Compare with (JSON)"
      onchange={(next) => value && onchange({ ...value, value: next })}
      value={value.value ?? ''}
    />
  {/if}
{/if}

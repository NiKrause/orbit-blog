<script lang="ts">
  import { _ } from 'svelte-i18n';
  import type { AiInputSchema } from '$lib/ai/types.js';
  import {
    isImageUiProperty,
    isInputSchemaStructureSupported,
    orderPropertyKeys,
  } from '$lib/ai/inputSchema.js';
  import AiImageField from './AiImageField.svelte';

  interface Props {
    schema: AiInputSchema | null | undefined;
    values?: Record<string, unknown>;
    /** Values are svelte-i18n keys; omit `_` (manifest-level) in callers if needed. */
    fieldErrors?: Record<string, string>;
  }

  let {
    schema = null,
    values = $bindable({}),
    fieldErrors = {},
  }: Props = $props();

  const keys = $derived(
    schema && isInputSchemaStructureSupported(schema)
      ? orderPropertyKeys(schema)
      : [],
  );

  const manifestBad = $derived(
    schema != null && !isInputSchemaStructureSupported(schema),
  );

  function setValue(key: string, v: unknown) {
    values = { ...values, [key]: v };
  }
</script>

{#if manifestBad}
  <p class="text-xs m-0" style="color: var(--danger);" role="alert" data-testid="ai-schema-manifest-invalid">
    {$_('ai_schema_manifest_invalid')}
  </p>
{:else if schema && keys.length > 0}
  <div class="space-y-3 max-w-md pt-2 border-t" style="border-color: var(--border);" data-testid="ai-schema-fields">
    <p class="text-xs font-medium m-0" style="color: var(--text-secondary);">
      {$_('ai_schema_section_label')}
    </p>
    {#each keys as key (key)}
      {@const prop = schema!.properties[key]}
      {@const err = fieldErrors[key]}
      {#if prop}
        <div class="space-y-1">
          <label
            for={isImageUiProperty(prop)
              ? `ai-schema-field-${key}-file`
              : `ai-schema-field-${key}`}
            class="block text-xs font-medium m-0"
            style="color: var(--text-secondary);"
          >
            {$_(prop.titleKey)}
          </label>
          {#if prop.type === 'boolean'}
            <input
              id="ai-schema-field-{key}"
              type="checkbox"
              class="rounded border"
              style="border-color: var(--border);"
              checked={values[key] === true}
              onchange={(e) => {
                const t = e.currentTarget;
                setValue(key, t.checked);
              }}
              data-testid="ai-schema-field-{key}"
            />
          {:else if prop.type === 'string' && prop.enum && prop.enum.length > 0}
            <!-- Enum option values are vendor/API tokens; labels use prop.titleKey only (AC5: no per-option i18n in 4.1). -->
            <select
              id="ai-schema-field-{key}"
              class="input w-full text-sm rounded border bg-transparent px-2 py-1.5"
              style="border-color: var(--border); color: var(--text);"
              value={typeof values[key] === 'string' ? values[key] : ''}
              onchange={(e) => setValue(key, e.currentTarget.value)}
              data-testid="ai-schema-field-{key}"
            >
              {#if !schema!.required?.includes(key)}
                <option value="">—</option>
              {/if}
              {#each prop.enum as opt (opt)}
                <option value={opt}>{opt}</option>
              {/each}
            </select>
          {:else if isImageUiProperty(prop)}
            <AiImageField
              fieldId="ai-schema-field-{key}"
              selectedCid={typeof values[key] === 'string' ? values[key] : ''}
              onSelectCid={(cid) => setValue(key, cid)}
            />
          {:else if prop.type === 'string'}
            <input
              id="ai-schema-field-{key}"
              type="text"
              class="input w-full text-sm rounded border bg-transparent px-2 py-1.5"
              style="border-color: var(--border); color: var(--text);"
              value={typeof values[key] === 'string' ? values[key] : String(values[key] ?? '')}
              oninput={(e) => setValue(key, e.currentTarget.value)}
              data-testid="ai-schema-field-{key}"
            />
          {:else if prop.type === 'number'}
            <input
              id="ai-schema-field-{key}"
              type="number"
              step="any"
              min={prop.minimum}
              max={prop.maximum}
              class="input w-full text-sm rounded border bg-transparent px-2 py-1.5"
              style="border-color: var(--border); color: var(--text);"
              value={values[key] === '' || values[key] === undefined ? '' : String(values[key])}
              oninput={(e) => {
                const raw = e.currentTarget.value;
                setValue(key, raw === '' ? '' : Number(raw));
              }}
              data-testid="ai-schema-field-{key}"
            />
          {:else if prop.type === 'integer'}
            <input
              id="ai-schema-field-{key}"
              type="number"
              step="1"
              min={prop.minimum}
              max={prop.maximum}
              class="input w-full text-sm rounded border bg-transparent px-2 py-1.5"
              style="border-color: var(--border); color: var(--text);"
              value={values[key] === '' || values[key] === undefined ? '' : String(values[key])}
              oninput={(e) => {
                const raw = e.currentTarget.value;
                if (raw === '') {
                  setValue(key, '');
                  return;
                }
                const n = Number(raw);
                setValue(key, Number.isNaN(n) ? raw : n);
              }}
              data-testid="ai-schema-field-{key}"
            />
          {/if}
          {#if err}
            <p class="text-xs m-0" style="color: var(--danger);" role="alert" data-testid="ai-schema-field-error-{key}">
              {$_(err)}
            </p>
          {/if}
        </div>
      {/if}
    {/each}
  </div>
{/if}

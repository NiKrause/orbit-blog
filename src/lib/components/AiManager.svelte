<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { IPFS_VIDEO_GATEWAY } from '$lib/utils/videoEmbedUtils.js';
  import {
    aiDB,
    helia,
    identitySeed32,
    isRTL,
    mediaDB,
  } from '$lib/store.js';
  import {
    AI_INGEST_ERROR_KEYS,
    AiIngestError,
    ingestRemoteVideoToMedia,
  } from '$lib/mediaIngest.js';
  import {
    getManifestById,
    getProviderModelForId,
    listKlingI2vManifests,
  } from '$lib/ai/modelRegistry.js';
  import {
    initialValuesForSchema,
    isInputSchemaStructureSupported,
    validateAiInputSchema,
  } from '$lib/ai/inputSchema.js';
  import AiSchemaFields from './AiSchemaFields.svelte';
  import {
    loadAiCredentialDetailed,
    saveAiCredential,
  } from '$lib/ai/aiCredentialStore.js';
  import { maskApiKeyLast4 } from '$lib/ai/maskApiKey.js';
  import { FetchAiHttpTransport } from '$lib/ai/fetchAiHttpTransport.js';
  import { buildSubmitJobInput } from '$lib/ai/buildSubmitJobInput.js';
  import {
    AI_JOB_ERROR_KEYS,
    AiTransportError,
    mapAiTransportError,
  } from '$lib/ai/aiJobErrors.js';
  import {
    createPendingAiRunDoc,
    patchAiRun,
    type AiRunDocPatch,
  } from '$lib/ai/aiRunDocument.js';
  import { textBodyMergeModeForManifest } from '$lib/ai/aiOutputTextMerge.js';
  import RelaySyncLed from './RelaySyncLed.svelte';
  import { getRelayPinnedCidBase } from '$lib/relay/relayEnv.js';
  import { startRelayPinPolling, type RelayLedState } from '$lib/services/relayPinStatus.js';
  import type { AiJobLifecycleStatus, AiModelManifest } from '$lib/ai/types.js';

  interface AiManagerProps {
    /** Append HTML video embed for this CID into draft content (`videoEmbedUtils.appendVideoEmbedToContent`). */
    onInsertVideoEmbed?: (cid: string) => void;
    /** Add CID to `selectedMedia` without duplicating (`videoEmbedUtils.addCidToSelectedMedia`). */
    onAddVideoToSelectedMedia?: (cid: string) => void;
    /** FR-8c: when `fetchResult` includes `outputText`, merge into draft per manifest `output.textBodyMerge`. */
    onMergeOutputText?: (text: string, mode: 'append' | 'replace') => void;
  }

  let {
    onInsertVideoEmbed,
    onAddVideoToSelectedMedia,
    onMergeOutputText,
  }: AiManagerProps = $props();

  const manifests: AiModelManifest[] = listKlingI2vManifests();
  let selectedModelId = $state(manifests[0]?.id ?? '');
  /**
   * Dynamic job-input values for the selected model’s `inputSchema` (Story 4.1).
   * **Epic 5 Run gating:** read `inputValues` with `validateAiInputSchema` (from `$lib/ai`) against
   * `getManifestById(selectedModelId)?.inputSchema`, or use the derived `canSubmitInputs`
   * flag exposed on `data-can-submit-inputs` on the schema section wrapper for UI tests.
   */
  let inputValues = $state<Record<string, unknown>>({});

  let baseUrl = $state('');
  let apiKeyInput = $state('');
  /** Last four characters of the saved API key (for mask display only). */
  let keyLast4Suffix = $state<string | null>(null);
  let editingKey = $state(false);
  let saveError = $state('');
  let decryptFailed = $state(false);
  let saving = $state(false);
  let loadingCredential = $state(false);

  let loadSeq = 0;
  /** Incremented when `selectedModelId` changes — abandons in-flight runs. */
  let runEpoch = 0;
  let jobPhase = $state<'idle' | 'running' | 'succeeded' | 'failed'>('idle');
  /** Last `pollStatus` lifecycle for UX (queued vs running). */
  let lastPollLifecycle = $state<AiJobLifecycleStatus | null>(null);
  let jobErrorKey = $state<string | null>(null);
  let resultAssetUrl = $state<string | null>(null);
  let jobRunning = $state(false);
  /** Run epoch when the job last reached `succeeded` (for ingest gating). */
  let successRunEpoch = $state(0);
  let ingestedCid = $state<string | null>(null);
  let ingestErrorKey = $state<string | null>(null);
  let ingesting = $state(false);

  /** FR-7c: same relay LED progression as AI image inputs after output video is in IPFS (Story 4.3). */
  let outputRelayLedState = $state<RelayLedState>('idle');
  let reduceMotion = $state(false);

  $effect(() => {
    selectedModelId;
    runEpoch += 1;
    jobPhase = 'idle';
    lastPollLifecycle = null;
    jobErrorKey = null;
    resultAssetUrl = null;
    jobRunning = false;
    successRunEpoch = 0;
    ingestedCid = null;
    ingestErrorKey = null;
    ingesting = false;
  });

  $effect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reduceMotion = mq.matches;
    const onChange = () => {
      reduceMotion = mq.matches;
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  });

  $effect(() => {
    const cid = ingestedCid?.trim();
    const base = getRelayPinnedCidBase();
    if (!cid || !base) {
      outputRelayLedState = 'idle';
      return;
    }
    const ac = new AbortController();
    outputRelayLedState = 'yellow';
    const stop = startRelayPinPolling({
      cid,
      pinnedBase: base,
      signal: ac.signal,
      onState: (s) => {
        outputRelayLedState = s;
      },
    });
    return () => {
      ac.abort();
      stop();
    };
  });

  $effect(() => {
    const id = selectedModelId;
    const m = getManifestById(id);
    const s = m?.inputSchema;
    if (s && isInputSchemaStructureSupported(s)) {
      inputValues = initialValuesForSchema(s);
    } else {
      inputValues = {};
    }
  });

  const inputSchemaForModel = $derived.by(() => getManifestById(selectedModelId)?.inputSchema);

  /**
   * Single pass: `validateAiInputSchema` + per-field errors for `AiSchemaFields` (omit manifest `_` key).
   * True when there is no `inputSchema`, or validation passes (Epic 5 Run gate).
   */
  const aiInputValidation = $derived.by(() => {
    const schema = inputSchemaForModel;
    if (!schema) {
      return { ok: true as const, inlineErrors: {} as Record<string, string> };
    }
    const r = validateAiInputSchema(schema, inputValues);
    if (r.ok === false) {
      const inlineErrors: Record<string, string> = {};
      for (const [k, msg] of Object.entries(r.fieldErrors)) {
        if (k !== '_' && typeof msg === 'string') inlineErrors[k] = msg;
      }
      return { ok: false as const, inlineErrors };
    }
    return { ok: true as const, inlineErrors: {} as Record<string, string> };
  });

  const canSubmitInputs = $derived(aiInputValidation.ok);
  const inputFieldErrors = $derived(aiInputValidation.inlineErrors);

  $effect(() => {
    const id = selectedModelId;
    const db = $aiDB;
    const seed = $identitySeed32;
    const seq = ++loadSeq;
    loadingCredential = true;
    saveError = '';
    void (async () => {
      try {
        if (!id || !db || !seed) {
          if (seq === loadSeq) {
            baseUrl = '';
            keyLast4Suffix = null;
            apiKeyInput = '';
            editingKey = true;
            decryptFailed = false;
            loadingCredential = false;
          }
          return;
        }
        const providerModelId = getProviderModelForId(id);
        if (!providerModelId) {
          if (seq === loadSeq) {
            loadingCredential = false;
          }
          return;
        }
        const result = await loadAiCredentialDetailed(db, seed, providerModelId);
        if (seq !== loadSeq) return;
        if (result.status === 'ok') {
          baseUrl = result.credential.baseUrl.trim();
          keyLast4Suffix = result.credential.apiKey.slice(-4);
          apiKeyInput = '';
          editingKey = false;
          decryptFailed = false;
        } else if (result.status === 'decrypt_failed') {
          baseUrl = '';
          keyLast4Suffix = null;
          apiKeyInput = '';
          editingKey = true;
          decryptFailed = true;
        } else {
          baseUrl = '';
          keyLast4Suffix = null;
          apiKeyInput = '';
          editingKey = true;
          decryptFailed = false;
        }
      } finally {
        if (seq === loadSeq) {
          loadingCredential = false;
        }
      }
    })();
  });

  async function handleSave() {
    saveError = '';
    const url = baseUrl.trim();
    if (!url) {
      saveError = $_('ai_credential_validation_url');
      return;
    }
    const db = $aiDB;
    const seed = $identitySeed32;
    if (!db || !seed) {
      saveError = $_('ai_credential_db_not_ready');
      return;
    }
    const providerModelId = getProviderModelForId(selectedModelId);
    if (!providerModelId) {
      saveError = $_('ai_credential_validation_model');
      return;
    }

    let apiKeyToSave = apiKeyInput.trim();
    if (!apiKeyToSave) {
      if (keyLast4Suffix && !editingKey) {
        const r = await loadAiCredentialDetailed(db, seed, providerModelId);
        if (r.status !== 'ok') {
          saveError = $_('ai_credential_validation_key');
          return;
        }
        apiKeyToSave = r.credential.apiKey;
      } else {
        saveError = $_('ai_credential_validation_key');
        return;
      }
    }

    saving = true;
    try {
      await saveAiCredential(db, seed, {
        modelId: providerModelId,
        baseUrl: url,
        apiKey: apiKeyToSave,
      });
      apiKeyInput = '';
      keyLast4Suffix = apiKeyToSave.slice(-4);
      editingKey = false;
      decryptFailed = false;
    } catch {
      saveError = $_('ai_credential_save_error');
    } finally {
      saving = false;
    }
  }

  function handleChangeKey() {
    keyLast4Suffix = null;
    apiKeyInput = '';
    editingKey = true;
    saveError = '';
    decryptFailed = false;
  }

  let canSave = $derived(
    $aiDB != null && $identitySeed32 != null && !loadingCredential,
  );

  /** AC1: Run requires saved per-model credentials (not merely a typed key). */
  const hasSavedCredential = $derived(
    !decryptFailed && baseUrl.trim().length > 0 && keyLast4Suffix !== null && !editingKey,
  );

  const canRunGeneration = $derived(
    canSubmitInputs &&
      hasSavedCredential &&
      $aiDB != null &&
      $identitySeed32 != null &&
      !loadingCredential &&
      !jobRunning,
  );

  function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  async function handleRunGeneration() {
    jobErrorKey = null;
    resultAssetUrl = null;
    ingestedCid = null;
    ingestErrorKey = null;
    successRunEpoch = 0;
    lastPollLifecycle = null;
    const epoch = runEpoch;
    const db = $aiDB;
    const seed = $identitySeed32;
    const manifest = getManifestById(selectedModelId);
    const providerModelId = getProviderModelForId(selectedModelId);
    if (!db || !seed || !manifest || !providerModelId) {
      jobErrorKey = AI_JOB_ERROR_KEYS.unknown;
      jobPhase = 'failed';
      return;
    }

    let runDoc = createPendingAiRunDoc({
      manifestModelId: manifest.id,
      providerModelId,
      inputValues,
    });
    const persistRun = async (patch: AiRunDocPatch) => {
      runDoc = patchAiRun(runDoc, patch);
      try {
        await db.put(runDoc);
      } catch {
        /* FR-8b: persistence must not block generation; avoid logging doc payloads (NFR-1). */
      }
    };
    try {
      await db.put(runDoc);
    } catch {
      /* same */
    }

    jobRunning = true;
    jobPhase = 'running';
    lastPollLifecycle = 'queued';
    try {
      const credResult = await loadAiCredentialDetailed(db, seed, providerModelId);
      if (epoch !== runEpoch) return;
      if (credResult.status !== 'ok') {
        jobErrorKey = 'ai_credential_validation_key';
        jobPhase = 'failed';
        await persistRun({ status: 'failed', errorKey: 'ai_credential_validation_key' });
        return;
      }
      const { baseUrl: bu, apiKey } = credResult.credential;
      const transport = new FetchAiHttpTransport();
      const submitInput = buildSubmitJobInput(manifest, inputValues);
      const opts = { baseUrl: bu.trim(), apiKey };
      const { jobId } = await transport.submitJob(submitInput, opts);
      if (epoch !== runEpoch) return;
      await persistRun({ status: 'queued', providerJobId: jobId });
      const pollIntervalMs = 2000;
      const maxPolls = 180;
      for (let i = 0; i < maxPolls; i += 1) {
        if (epoch !== runEpoch) return;
        const poll = await transport.pollStatus({ jobId }, opts);
        if (epoch !== runEpoch) return;
        lastPollLifecycle = poll.status;
        if (poll.status === 'succeeded') {
          successRunEpoch = epoch;
          jobPhase = 'succeeded';
          await persistRun({
            status: 'succeeded',
            lastPollLifecycle: 'succeeded',
            providerJobId: jobId,
          });
          try {
            const out = await transport.fetchResult({ jobId }, opts);
            if (epoch !== runEpoch) return;
            resultAssetUrl = out.assetUrl ?? null;
            const ot = out.outputText?.trim();
            if (ot && onMergeOutputText) {
              onMergeOutputText(ot, textBodyMergeModeForManifest(manifest));
            }
            if (resultAssetUrl) {
              await persistRun({ resultAssetUrl });
            }
          } catch {
            resultAssetUrl = null;
          }
          return;
        }
        if (poll.status === 'failed') {
          jobPhase = 'failed';
          jobErrorKey = AI_JOB_ERROR_KEYS.pollFailed;
          await persistRun({
            status: 'failed',
            errorKey: AI_JOB_ERROR_KEYS.pollFailed,
            lastPollLifecycle: 'failed',
            providerJobId: jobId,
          });
          return;
        }
        await sleep(pollIntervalMs);
      }
      jobPhase = 'failed';
      jobErrorKey = AI_JOB_ERROR_KEYS.timeout;
      await persistRun({ status: 'failed', errorKey: AI_JOB_ERROR_KEYS.timeout });
    } catch (e) {
      if (epoch !== runEpoch) return;
      jobPhase = 'failed';
      const errKey = e instanceof AiTransportError ? e.i18nKey : mapAiTransportError(e);
      jobErrorKey = errKey;
      await persistRun({ status: 'failed', errorKey: errKey });
    } finally {
      if (epoch === runEpoch) {
        jobRunning = false;
      }
    }
  }

  const canImportVideo = $derived(
    jobPhase === 'succeeded' &&
      resultAssetUrl != null &&
      resultAssetUrl.length > 0 &&
      ingestedCid == null &&
      !ingesting &&
      $mediaDB != null &&
      $helia != null &&
      runEpoch === successRunEpoch,
  );

  async function handleImportVideoToLibrary() {
    ingestErrorKey = null;
    const url = resultAssetUrl;
    const db = $mediaDB;
    const h = $helia;
    const epoch = runEpoch;
    if (!url?.trim()) {
      ingestErrorKey = AI_INGEST_ERROR_KEYS.network;
      return;
    }
    if (!db || !h) {
      ingestErrorKey = 'ai_image_media_not_ready';
      return;
    }
    if (epoch !== successRunEpoch) return;
    ingesting = true;
    try {
      const { cid } = await ingestRemoteVideoToMedia({
        assetUrl: url.trim(),
        mediaDB: db,
        helia: h,
      });
      if (epoch !== runEpoch || epoch !== successRunEpoch) return;
      ingestedCid = cid;
    } catch (e) {
      if (epoch !== runEpoch) return;
      ingestErrorKey =
        e instanceof AiIngestError ? e.i18nKey : AI_INGEST_ERROR_KEYS.network;
    } finally {
      ingesting = false;
    }
  }

  function handleInsertVideo() {
    const cid = ingestedCid;
    if (!cid || !onInsertVideoEmbed) return;
    onInsertVideoEmbed(cid);
  }

  function handleAddVideoToSelected() {
    const cid = ingestedCid;
    if (!cid || !onAddVideoToSelectedMedia) return;
    onAddVideoToSelectedMedia(cid);
  }
</script>

<div
  class="p-4 rounded-md space-y-3"
  style="background-color: var(--bg-tertiary); border: 1px solid var(--border);"
  dir={$isRTL ? 'rtl' : 'ltr'}
>
  <h3 id="post-form-ai-heading" class="text-sm font-medium m-0" style="color: var(--text);">
    {$_('ai_panel_title')}
  </h3>

  <p class="text-xs m-0" style="color: var(--text-secondary);">
    {$_('ai_panel_placeholder')}
  </p>

  <div class="space-y-1.5">
    <label
      for="post-form-ai-model-select"
      class="block text-xs font-medium m-0"
      style="color: var(--text-secondary);"
    >
      {$_('ai_model_section_label')}
    </label>
    <select
      id="post-form-ai-model-select"
      class="input w-full max-w-md text-sm rounded border bg-transparent px-2 py-1.5"
      style="border-color: var(--border); color: var(--text);"
      bind:value={selectedModelId}
      data-testid="ai-model-select"
    >
      {#each manifests as m (m.id)}
        <option value={m.id}>{$_(m.labelKey)}</option>
      {/each}
    </select>
  </div>

  <div
    class="space-y-3 max-w-md pt-2 border-t"
    style="border-color: var(--border);"
  >
    <p class="text-xs font-medium m-0" style="color: var(--text-secondary);">
      {$_('ai_credential_section_label')}
    </p>

  <div class="space-y-1.5 max-w-md">
    <label
      for="ai-credential-base-url"
      class="block text-xs font-medium m-0"
      style="color: var(--text-secondary);"
    >
      {$_('ai_credential_base_url')}
    </label>
    <input
      id="ai-credential-base-url"
      type="url"
      autocomplete="off"
      class="input w-full text-sm rounded border bg-transparent px-2 py-1.5"
      style="border-color: var(--border); color: var(--text);"
      bind:value={baseUrl}
      disabled={loadingCredential}
      data-testid="ai-credential-base-url"
    />
  </div>

  <div class="space-y-1.5 max-w-md">
    <span class="block text-xs font-medium m-0" style="color: var(--text-secondary);">
      {$_('ai_credential_api_key')}
    </span>
    {#if decryptFailed}
      <p class="text-xs m-0" style="color: var(--text-secondary);">
        {$_('ai_credential_decrypt_failed')}
      </p>
    {/if}
    {#if keyLast4Suffix && !editingKey}
      <p
        class="text-xs font-mono m-0 py-1.5 px-2 rounded border"
        style="border-color: var(--border); color: var(--text);"
        data-testid="ai-credential-key-masked"
        aria-label={$_('ai_credential_key_saved_aria')}
      >
        {$_('ai_credential_key_saved_with_mask', {
          values: { mask: maskApiKeyLast4(keyLast4Suffix) },
        })}
      </p>
      <button
        type="button"
        class="btn-ghost btn-sm"
        onclick={handleChangeKey}
        data-testid="ai-credential-change-key"
      >
        {$_('ai_credential_change_key')}
      </button>
    {:else}
      <input
        id="ai-credential-api-key"
        type="password"
        autocomplete="new-password"
        class="input w-full text-sm rounded border bg-transparent px-2 py-1.5"
        style="border-color: var(--border); color: var(--text);"
        bind:value={apiKeyInput}
        disabled={loadingCredential}
        data-testid="ai-credential-api-key"
      />
    {/if}
  </div>

  {#if saveError}
    <p class="text-xs m-0" style="color: var(--danger);" role="alert">
      {saveError}
    </p>
  {/if}

  <div class="flex flex-wrap gap-2 items-center {$isRTL ? 'flex-row-reverse' : ''}">
    <button
      type="button"
      class="btn btn-sm"
      onclick={handleSave}
      disabled={!canSave || saving}
      data-testid="ai-credential-save"
    >
      {saving ? $_('ai_credential_saving') : $_('ai_credential_save')}
    </button>
    {#if !canSave && !loadingCredential}
      <span class="text-xs" style="color: var(--text-secondary);">
        {$_('ai_credential_db_not_ready')}
      </span>
    {/if}
  </div>
  </div>

  <div class="max-w-md" data-testid="ai-schema-section" data-can-submit-inputs={String(canSubmitInputs)}>
    <AiSchemaFields
      schema={inputSchemaForModel}
      bind:values={inputValues}
      fieldErrors={inputFieldErrors}
    />
  </div>

  <div
    class="max-w-md space-y-2 pt-2 border-t"
    style="border-color: var(--border);"
    data-testid="ai-job-section"
    data-can-run-generation={String(canRunGeneration)}
  >
    <div class="flex flex-wrap gap-2 items-center {$isRTL ? 'flex-row-reverse' : ''}">
      <button
        type="button"
        class="btn btn-sm"
        disabled={!canRunGeneration}
        onclick={() => void handleRunGeneration()}
        data-testid="ai-run-generation"
      >
        {jobRunning ? $_('ai_job_running_action') : $_('ai_run_generation')}
      </button>
    </div>

    {#if jobRunning || jobPhase === 'running'}
      <p
        class="text-xs m-0 flex items-center gap-2 {$isRTL ? 'flex-row-reverse' : ''}"
        style="color: var(--text-secondary);"
        data-testid="ai-job-status"
        aria-live="polite"
      >
        <span
          class="inline-block h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin shrink-0"
          style="color: var(--accent);"
          aria-hidden="true"
        ></span>
        {#if lastPollLifecycle === 'queued'}
          {$_('ai_job_status_queued')}
        {:else}
          {$_('ai_job_status_running')}
        {/if}
      </p>
    {:else if jobPhase === 'succeeded'}
      <p
        class="text-xs m-0 flex items-center gap-2 {$isRTL ? 'flex-row-reverse' : ''}"
        style="color: var(--text-secondary);"
        data-testid="ai-job-succeeded"
      >
        {$_('ai_job_status_succeeded')}
      </p>
      {#if resultAssetUrl}
        <p
          class="text-xs font-mono m-0 break-all flex flex-wrap items-baseline gap-x-1 {$isRTL ? 'flex-row-reverse' : ''}"
          data-testid="ai-job-result-url"
        >
          <span>{$_('ai_job_result_url_hint')}:</span>
          <a href={resultAssetUrl} class="underline" target="_blank" rel="noopener noreferrer"
            >{resultAssetUrl}</a
          >
        </p>
      {/if}
      {#if resultAssetUrl && ingestedCid == null}
        <div class="flex flex-wrap gap-2 items-center {$isRTL ? 'flex-row-reverse' : ''}">
          <button
            type="button"
            class="btn btn-sm"
            disabled={!canImportVideo}
            onclick={() => void handleImportVideoToLibrary()}
            data-testid="ai-import-video"
          >
            {ingesting ? $_('ai_import_video_importing') : $_('ai_import_video_to_library')}
          </button>
        </div>
        {#if ingestErrorKey}
          <p
            class="text-xs m-0"
            style="color: var(--danger);"
            role="alert"
            data-testid="ai-ingest-error"
          >
            {$_(ingestErrorKey)}
          </p>
        {/if}
      {/if}
      {#if ingestedCid}
        <div class="space-y-2" data-testid="ai-video-ingested-block">
          <div class="relative w-full max-w-md">
            <RelaySyncLed state={outputRelayLedState} reducedMotion={reduceMotion} />
            <!-- svelte-ignore a11y_media_has_caption -->
            <video
              class="w-full max-w-md rounded-md border"
              style="border-color: var(--border);"
              controls
              preload="metadata"
              src={`${IPFS_VIDEO_GATEWAY}${ingestedCid}`}
              data-testid="ai-job-video-preview"
            ></video>
          </div>
          <div class="flex flex-wrap gap-2 {$isRTL ? 'flex-row-reverse' : ''}">
            <button
              type="button"
              class="btn btn-sm"
              onclick={handleInsertVideo}
              disabled={!onInsertVideoEmbed}
              data-testid="ai-video-insert-post"
            >
              {$_('ai_video_insert_into_post')}
            </button>
            <button
              type="button"
              class="btn btn-sm btn-outline"
              onclick={handleAddVideoToSelected}
              disabled={!onAddVideoToSelectedMedia}
              data-testid="ai-video-add-selected"
            >
              {$_('ai_video_add_to_selected_media')}
            </button>
          </div>
        </div>
      {/if}
    {:else if jobPhase === 'failed' && jobErrorKey}
      <p class="text-xs m-0" style="color: var(--danger);" role="alert" data-testid="ai-job-error">
        {$_(jobErrorKey)}
      </p>
    {/if}
  </div>
</div>

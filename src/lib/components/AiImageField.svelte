<script lang="ts">
  /**
   * Story 4.2: image input for AI job schema fields (`x-ui: "image"`).
   * Bound value is the **IPFS CID string** (same OrbitDB + Helia path as {@link MediaUploader}).
   */
  import { _ } from 'svelte-i18n';
  import { helia, isRTL, mediaDB } from '$lib/store.js';
  import { unixfs } from '@helia/unixfs';
  import { CID } from 'multiformats/cid';
  import { error } from '$lib/utils/logger.js';
  import {
    logImageUploadIpfsStored,
    logImageUploadMediaDbRegistered,
  } from '$lib/utils/imageUploadDiagnostics.js';
  import RelaySyncLed from './RelaySyncLed.svelte';
  import { getRelayPinnedCidBase, relayOnlyIpfsUrlForCid } from '$lib/relay/relayEnv.js';
  import { startRelayPinPolling, type RelayLedState } from '$lib/services/relayPinStatus.js';

  interface Props {
    fieldId: string;
    /** Current CID (empty if none). */
    selectedCid: string;
    onSelectCid: (cid: string) => void;
  }

  let { fieldId, selectedCid, onSelectCid }: Props = $props();

  let fileInput = $state<HTMLInputElement | null>(null);
  let uploading = $state(false);
  type ImageRow = { _id: string; cid: string; name: string; type: string; createdAt?: string; url?: string };
  let imageRows = $state<ImageRow[]>([]);
  let fs = $state<ReturnType<typeof unixfs> | undefined>(undefined);
  const mediaCache = new Map<string, string>();

  const ready = $derived($mediaDB != null && $helia != null);

  let relayLedState = $state<RelayLedState>('idle');
  let selectedPreviewLocal = $state<string | null>(null);
  let reduceMotion = $state(false);
  /** `mediaDB` document `createdAt` for `selectedCid` — gates relay LED until `lastSyncedAt` ≥ this. */
  let selectedContentCreatedAtIso = $state<string | undefined>(undefined);

  const pinBase = $derived(getRelayPinnedCidBase());

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
    if (!selectedCid?.trim()) {
      selectedContentCreatedAtIso = undefined;
    }
  });

  /** When CID is bound without local upload/pick state (e.g. draft reload), fill `createdAt` from `mediaDB` rows once loaded. */
  $effect(() => {
    const cid = selectedCid?.trim();
    if (!cid || selectedContentCreatedAtIso !== undefined) return;
    const row = imageRows.find((r) => r.cid === cid);
    if (row?.createdAt) {
      selectedContentCreatedAtIso = row.createdAt;
    }
  });

  $effect(() => {
    const cid = selectedCid?.trim();
    if (!cid) {
      selectedPreviewLocal = null;
      return;
    }
    let cancelled = false;
    void getBlobUrl(cid).then((u) => {
      if (!cancelled) selectedPreviewLocal = u;
    });
    return () => {
      cancelled = true;
    };
  });

  $effect(() => {
    const cid = selectedCid?.trim();
    const base = getRelayPinnedCidBase();
    if (!cid || !base) {
      relayLedState = 'idle';
      return;
    }
    const ac = new AbortController();
    relayLedState = 'yellow';
    const mediaAddr = $mediaDB?.address?.toString?.()?.trim() ?? '';
    const stop = startRelayPinPolling({
      cid,
      pinnedBase: base,
      signal: ac.signal,
      mediaDbAddress: mediaAddr || undefined,
      mediaContentCreatedAtIso: selectedContentCreatedAtIso,
      pollDebugLabel: `ai-image:${fieldId}`,
      onState: (s) => {
        relayLedState = s;
      },
    });
    return () => {
      ac.abort();
      stop();
    };
  });

  const thumbSrc = $derived.by(() => {
    const cid = selectedCid?.trim();
    if (!cid) return null as string | null;
    if (selectedPreviewLocal) return selectedPreviewLocal;
    const relay = relayOnlyIpfsUrlForCid(cid);
    return relay || null;
  });

  $effect(() => {
    if ($helia) {
      fs = unixfs($helia as Parameters<typeof unixfs>[0]);
    }
  });

  function formatCidHint(cid: string): string {
    const t = cid.trim();
    if (t.length <= 14) return t;
    return `${t.slice(0, 6)}…${t.slice(-4)}`;
  }

  async function getBlobUrl(cid: string): Promise<string | null> {
    if (!fs && $helia) {
      fs = unixfs($helia as Parameters<typeof unixfs>[0]);
    }
    if (!fs) {
      return relayOnlyIpfsUrlForCid(cid) || null;
    }
    if (mediaCache.has(cid)) return mediaCache.get(cid)!;
    try {
      const parsed = CID.parse(cid);
      const chunks: Uint8Array[] = [];
      for await (const chunk of fs.cat(parsed)) {
        chunks.push(chunk);
      }
      const fileData = new Uint8Array(
        chunks.reduce<number[]>((acc, val) => [...acc, ...Array.from(val)], []),
      );
      const blob = new Blob([fileData]);
      const url = URL.createObjectURL(blob);
      mediaCache.set(cid, url);
      return url;
    } catch {
      return relayOnlyIpfsUrlForCid(cid) || null;
    }
  }

  async function loadImages() {
    const db = $mediaDB;
    if (!db) {
      imageRows = [];
      return;
    }
    try {
      const allMedia = await db.all();
      const rows: ImageRow[] = [];
      for (const entry of allMedia) {
        const media = entry.value as {
          _id?: string;
          cid?: string;
          name?: string;
          type?: string;
          createdAt?: string;
        };
        if (media?.type?.startsWith('image/') && media.cid) {
          const url = (await getBlobUrl(media.cid)) ?? undefined;
          rows.push({
            _id: media._id ?? '',
            cid: media.cid,
            name: media.name ?? '',
            type: media.type,
            ...(typeof media.createdAt === 'string' ? { createdAt: media.createdAt } : {}),
            url,
          });
        }
      }
      imageRows = rows;
    } catch (e) {
      error('AiImageField loadImages', e);
    }
  }

  $effect(() => {
    const db = $mediaDB;
    if (!db) {
      imageRows = [];
      return;
    }
    void loadImages();
    const handler = () => void loadImages();
    db.events.on('update', handler);
    return () => {
      db.events.removeListener('update', handler);
    };
  });

  async function uploadFiles(files: FileList | File[]) {
    const db = $mediaDB;
    const h = $helia;
    if (!db || !h || !fs) {
      fs = h ? unixfs(h as Parameters<typeof unixfs>[0]) : fs;
    }
    if (!db || !$helia) return;
    if (!fs) fs = unixfs($helia as Parameters<typeof unixfs>[0]);
    uploading = true;
    try {
      const list = Array.from(files);
      for (const file of list) {
        if (!file.type.startsWith('image/')) continue;
        if (file.size > 10 * 1024 * 1024) {
          throw new Error(`File ${file.name} is too large. Maximum size is 10MB`);
        }
        const buffer = await file.arrayBuffer();
        const fileBytes = new Uint8Array(buffer);
        const cid = await fs.addBytes(fileBytes);
        const cidStr = cid.toString();
        logImageUploadIpfsStored('AiImageField', {
          name: file.name,
          type: file.type,
          size: file.size,
          cid: cidStr,
          bytesOnWire: fileBytes.byteLength,
        });
        const mediaId = crypto.randomUUID();
        const createdAt = new Date().toISOString();
        const record = {
          _id: mediaId,
          name: file.name,
          type: file.type,
          size: file.size,
          cid: cidStr,
          createdAt,
        };
        await db.put(record);
        logImageUploadMediaDbRegistered('AiImageField', {
          record,
          mediaDbAddress: db.address?.toString?.(),
        });
        selectedContentCreatedAtIso = createdAt;
        onSelectCid(cidStr);
      }
      await loadImages();
    } catch (e) {
      error('AiImageField upload', e);
    } finally {
      uploading = false;
    }
  }

  function handleFileInput(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      void uploadFiles(input.files);
      input.value = '';
    }
  }

  function pickFromLibrary(row: ImageRow) {
    selectedContentCreatedAtIso = row.createdAt;
    onSelectCid(row.cid);
  }

  /** FR-7e: clear job input and remove `Media` row like {@link MediaUploader} delete. */
  async function removeSelectedImage(e: MouseEvent | TouchEvent) {
    e.preventDefault();
    e.stopPropagation();
    const cid = selectedCid?.trim();
    const db = $mediaDB;
    if (!cid) {
      selectedContentCreatedAtIso = undefined;
      onSelectCid('');
      return;
    }
    if (db) {
      try {
        const all = await db.all();
        for (const entry of all) {
          const m = entry.value as { _id?: string; cid?: string };
          if (m?.cid === cid && m._id) {
            await db.del(m._id);
            break;
          }
        }
      } catch (err) {
        error('AiImageField removeSelectedImage', err);
      }
    }
    const cached = mediaCache.get(cid);
    if (cached) {
      try {
        URL.revokeObjectURL(cached);
      } catch {
        /* ignore */
      }
      mediaCache.delete(cid);
    }
    selectedContentCreatedAtIso = undefined;
    onSelectCid('');
    await loadImages();
  }
</script>

<div
  class="space-y-2"
  dir={$isRTL ? 'rtl' : 'ltr'}
  data-testid="ai-image-field"
>
  {#if !ready}
    <p class="text-xs m-0" style="color: var(--text-secondary);">
      {$_('ai_image_media_not_ready')}
    </p>
  {:else}
    <div class="flex flex-wrap gap-2 items-center {$isRTL ? 'flex-row-reverse' : ''}">
      <button
        type="button"
        class="btn-ghost btn-sm"
        disabled={uploading}
        onclick={() => fileInput?.click()}
        data-testid="ai-image-upload-btn"
      >
        {uploading ? $_('ai_image_uploading') : $_('ai_image_upload')}
      </button>
      <input
        bind:this={fileInput}
        id="{fieldId}-file"
        type="file"
        class="hidden"
        accept="image/*"
        onchange={handleFileInput}
      />
    </div>

    <p class="text-xs font-medium m-0" style="color: var(--text-secondary);">
      {$_('ai_image_pick_library')}
    </p>
    <div
      class="grid grid-cols-4 gap-1 max-h-28 overflow-y-auto rounded border p-1"
      style="border-color: var(--border);"
      data-testid="ai-image-library-grid"
    >
      {#each imageRows as m (m._id + m.cid)}
        {@const gridSrc = m.url || relayOnlyIpfsUrlForCid(m.cid)}
        <button
          type="button"
          class="relative overflow-hidden rounded border p-0 h-14 w-full hover:opacity-90"
          style="border-color: {selectedCid === m.cid ? 'var(--accent)' : 'var(--border)'};"
          onclick={() => pickFromLibrary(m)}
          aria-label={$_('ai_image_pick_aria', { values: { name: m.name || formatCidHint(m.cid) } })}
        >
          {#if gridSrc}
            <img src={gridSrc} alt="" class="h-full w-full object-cover" />
          {:else}
            <div
              class="h-full w-full flex items-center justify-center text-[10px] opacity-60"
              style="background: var(--bg-tertiary); color: var(--text-secondary);"
            >
              …
            </div>
          {/if}
        </button>
      {/each}
    </div>

    {#if selectedCid}
      <div class="space-y-1">
        <div
          class="relative inline-block max-w-full rounded border overflow-hidden"
          style="border-color: var(--border);"
          data-testid="ai-image-selected-thumb-wrap"
        >
          {#if thumbSrc}
            <img
              src={thumbSrc}
              alt=""
              class="block max-h-36 w-auto max-w-full object-contain bg-black/5"
              data-testid="ai-image-selected-thumb"
            />
          {/if}
          {#if pinBase}
            <RelaySyncLed state={relayLedState} reducedMotion={reduceMotion} />
          {/if}
          <button
            type="button"
            class="absolute top-1 z-[3] min-h-8 min-w-8 flex items-center justify-center rounded-full bg-red-500 hover:bg-red-600 text-white text-sm font-medium leading-none shadow-sm"
            style="inset-inline-start: 0.25rem;"
            aria-label={$_('ai_image_remove_aria')}
            onclick={(e) => void removeSelectedImage(e)}
            ontouchend={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void removeSelectedImage(e);
            }}
            data-testid="ai-image-remove-input"
          >
            ×
          </button>
        </div>
        {#if !pinBase}
          <p class="text-xs m-0" style="color: var(--text-secondary);" data-testid="ai-relay-preview-disabled">
            {$_('ai_relay_preview_not_configured')}
          </p>
        {/if}
        <p
          class="text-xs font-mono m-0 py-1 px-2 rounded border"
          style="border-color: var(--border); color: var(--text);"
          data-testid="ai-image-selected-hint"
          aria-live="polite"
        >
          {$_('ai_image_selected_label')}
          {formatCidHint(selectedCid)}
        </p>
      </div>
    {/if}
  {/if}
</div>

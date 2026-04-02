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

  interface Props {
    fieldId: string;
    /** Current CID (empty if none). */
    selectedCid: string;
    onSelectCid: (cid: string) => void;
  }

  let { fieldId, selectedCid, onSelectCid }: Props = $props();

  let fileInput = $state<HTMLInputElement | null>(null);
  let uploading = $state(false);
  type ImageRow = { _id: string; cid: string; name: string; type: string; url?: string };
  let imageRows = $state<ImageRow[]>([]);
  let fs = $state<ReturnType<typeof unixfs> | undefined>(undefined);
  const mediaCache = new Map<string, string>();

  const ready = $derived($mediaDB != null && $helia != null);

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
      return `https://dweb.link/ipfs/${cid}`;
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
      return `https://dweb.link/ipfs/${cid}`;
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
        };
        if (media?.type?.startsWith('image/') && media.cid) {
          const url = (await getBlobUrl(media.cid)) ?? undefined;
          rows.push({
            _id: media._id ?? '',
            cid: media.cid,
            name: media.name ?? '',
            type: media.type,
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
        const mediaId = crypto.randomUUID();
        await db.put({
          _id: mediaId,
          name: file.name,
          type: file.type,
          size: file.size,
          cid: cidStr,
          createdAt: new Date().toISOString(),
        });
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

  function pickFromLibrary(cid: string) {
    onSelectCid(cid);
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
        <button
          type="button"
          class="relative overflow-hidden rounded border p-0 h-14 w-full hover:opacity-90"
          style="border-color: {selectedCid === m.cid ? 'var(--accent)' : 'var(--border)'};"
          onclick={() => pickFromLibrary(m.cid)}
          aria-label={$_('ai_image_pick_aria', { values: { name: m.name || formatCidHint(m.cid) } })}
        >
          <img
            src={m.url || `https://dweb.link/ipfs/${m.cid}`}
            alt=""
            class="h-full w-full object-cover"
          />
        </button>
      {/each}
    </div>

    {#if selectedCid}
      <p
        class="text-xs font-mono m-0 py-1 px-2 rounded border"
        style="border-color: var(--border); color: var(--text);"
        data-testid="ai-image-selected-hint"
        aria-live="polite"
      >
        {$_('ai_image_selected_label')}
        {formatCidHint(selectedCid)}
      </p>
    {/if}
  {/if}
</div>

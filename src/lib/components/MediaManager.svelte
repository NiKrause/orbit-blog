<script lang="ts">
  import { onMount } from 'svelte';
  import { _ } from 'svelte-i18n';
  import { createEventDispatcher } from 'svelte';
  import { unixfs } from '@helia/unixfs';
  import { CID } from 'multiformats/cid';
  import { helia, mediaDB } from '$lib/store';
  import { error } from '../utils/logger.js';
  import MediaUploader from './MediaUploader.svelte';

  interface Props {
    selectedMedia: string[];
    showMediaUploader: boolean;
  }

  let { selectedMedia, showMediaUploader }: Props = $props();

  const dispatch = createEventDispatcher<{
    mediaSelected: { mediaCid: string };
    mediaRemoved: { mediaId: string };
    toggleUploader: {};
  }>();

  // IPFS and media handling
  let fs: ReturnType<typeof unixfs>;
  let mediaCache = new Map<string, string>();
  let selectedMediaDetails = $state<Array<{ cid: string; name: string; type: string; url?: string }>>([]);

  onMount(() => {
    initUnixFs();
    loadSelectedMediaDetails();
  });

  // Watch for changes in selectedMedia
  $effect(() => {
    loadSelectedMediaDetails();
  });

  function initUnixFs() {
    if ($helia && !fs) {
      fs = unixfs($helia as any);
    }
  }

  async function getBlobUrl(cid: string): Promise<string | null> {
    if (!fs) initUnixFs();
    if (mediaCache.has(cid)) return mediaCache.get(cid);

    try {
      const parsedCid = CID.parse(cid);
      const chunks = [];
      for await (const chunk of fs.cat(parsedCid)) {
        chunks.push(chunk);
      }

      const fileData = new Uint8Array(chunks.reduce((acc, val) => [...acc, ...val], []));
      const blob = new Blob([fileData]);
      const url = URL.createObjectURL(blob);
      mediaCache.set(cid, url);
      return url;
    } catch (_error) {
      error('Error fetching from IPFS:', _error);
      return `https://dweb.link/ipfs/${cid}`;
    }
  }

  async function loadSelectedMediaDetails() {
    if (!$mediaDB || selectedMedia.length === 0) {
      selectedMediaDetails = [];
      return;
    }

    try {
      const allMedia = await $mediaDB.all();
      const mediaMap = allMedia.map(entry => entry.value);
      
      selectedMediaDetails = await Promise.all(
        selectedMedia.map(async (cid) => {
          const media = mediaMap.find(m => m.cid === cid);
          if (media) {
            const url = await getBlobUrl(cid);
            return {
              cid,
              name: media.name,
              type: media.type,
              url
            };
          }
          return {
            cid,
            name: `Unknown (${cid.slice(0, 8)}...)`,
            type: 'unknown',
            url: await getBlobUrl(cid)
          };
        })
      );
    } catch (_error) {
      error('Error loading selected media details:', _error);
    }
  }

  function handleMediaSelected(mediaCid: string) {
    dispatch('mediaSelected', { mediaCid });
  }

  function removeSelectedMedia(mediaId: string) {
    dispatch('mediaRemoved', { mediaId });
  }

  function toggleMediaUploader() {
    dispatch('toggleUploader');
  }
</script>

<div class="space-y-4">
  <div class="flex space-x-2">
    <button
      type="button"
      onclick={toggleMediaUploader}
      class="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300"
    >
      {showMediaUploader ? $_('hide_media_library') : $_('add_media')}
    </button>
  </div>

  {#if showMediaUploader}
    <MediaUploader onMediaSelected={handleMediaSelected} />
  {/if}

  {#if selectedMediaDetails.length > 0}
    <div class="selected-media">
      <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{$_('selected_media')}</h4>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {#each selectedMediaDetails as media}
          <div class="relative bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
            {#if media.type.startsWith('image/') && media.url}
              <img 
                src={media.url} 
                alt={media.name} 
                class="w-full h-24 object-cover"
              />
            {:else if media.type.startsWith('video/')}
              <div class="w-full h-24 bg-gray-600 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            {:else}
              <div class="w-full h-24 bg-gray-600 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            {/if}
            
            <div class="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1">
              <div class="truncate">{media.name}</div>
            </div>
            
            <button 
              type="button"
              class="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
              onclick={() => removeSelectedMedia(media.cid)}
              title="Remove media"
            >
              ×
            </button>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

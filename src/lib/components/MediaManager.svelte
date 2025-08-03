<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { createEventDispatcher } from 'svelte';
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

  {#if selectedMedia.length > 0}
    <div class="selected-media">
      <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{$_('selected_media')}</h4>
      <div class="flex flex-wrap gap-2">
        {#each selectedMedia as mediaId}
          <div class="bg-gray-100 dark:bg-gray-700 rounded px-2 py-1 text-sm flex items-center">
            <span class="truncate max-w-[150px]">{mediaId}</span>
            <button 
              type="button"
              class="ml-2 text-red-500 hover:text-red-700"
              onclick={() => removeSelectedMedia(mediaId)}
            >
              ×
            </button>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<script lang="ts">
  import { onMount } from 'svelte';
  import { mediaDB, helia } from '../store';
  import { unixfs } from '@helia/unixfs';

  let { onMediaSelected = (mediaCid: string) => {} } = $props();

  let dragActive = $state(false);
  let uploading = $state(false);
  let mediaList = $state([]);
  let errorMessage = $state('');
  let fs; // UnixFS instance

  onMount(async () => {
    if ($mediaDB) {
      loadMedia();
      
      // Initialize UnixFS
      if ($helia) {
        fs = unixfs($helia);
      }
      
      // Listen for media database updates
      $mediaDB.events.on('update', async (entry) => {
        if (entry?.payload?.op === 'PUT') {
          await loadMedia();
        } else if (entry?.payload?.op === 'DEL') {
          await loadMedia();
        }
      });
    }
  });

  async function loadMedia() {
    try {
      const allMedia = await $mediaDB.all();
      mediaList = allMedia.map(entry => entry.value);
    } catch (error) {
      console.error('Error loading media:', error);
      errorMessage = 'Failed to load media';
    }
  }

  function handleDragOver(event) {
    event.preventDefault();
    if (!dragActive) dragActive = true;
  }

  function handleDragLeave() {
    dragActive = false;
  }

  async function handleDrop(event) {
    event.preventDefault();
    dragActive = false;
    
    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) {
      await uploadFiles(files);
    }
  }

  async function handleFileInput(event) {
    const files = Array.from(event.target.files);
    if (files.length > 0) {
      await uploadFiles(files);
    }
  }

  async function uploadFiles(files) {
    if (!$mediaDB || !$helia) {
      errorMessage = 'Media database or IPFS not initialized';
      return;
    }
    
    if (!fs) {
      fs = unixfs($helia);
    }
    
    uploading = true;
    errorMessage = '';
    
    try {
      for (const file of files) {
        // File size validation (limit to 10MB)
        if (file.size > 10 * 1024 * 1024) {
          throw new Error(`File ${file.name} is too large. Maximum size is 10MB`);
        }
        
        // Read file as arrayBuffer
        const buffer = await file.arrayBuffer();
        const fileBytes = new Uint8Array(buffer);
        
        // Add to IPFS
        const cid = await fs.addBytes(fileBytes);
        
        // Store metadata in OrbitDB
        const mediaId = crypto.randomUUID();
        await $mediaDB.put({
          _id: mediaId,
          name: file.name,
          type: file.type,
          size: file.size,
          cid: cid.toString(),
          createdAt: new Date().toISOString()
        });
      }
      
      await loadMedia();
    } catch (error) {
      console.error('Error uploading files:', error);
      errorMessage = error.message || 'Failed to upload files';
    } finally {
      uploading = false;
    }
  }

  async function selectMedia(media) {
    onMediaSelected(media.cid);
  }

  async function deleteMedia(mediaId, event) {
    event.stopPropagation();
    try {
      await $mediaDB.del(mediaId);
      await loadMedia();
    } catch (error) {
      console.error('Error deleting media:', error);
      errorMessage = 'Failed to delete media';
    }
  }

  function getMediaPreviewUrl(media) {
    if (!media || !media.cid) return '';
    return `https://ipfs.io/ipfs/${media.cid}`;
  }
</script>

<div class="media-uploader bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
  <h3 class="text-xl font-bold mb-4 text-gray-900 dark:text-white">Media Library</h3>
  
  <!-- Drag and drop area -->
  <div 
    class="drag-area border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center mb-4
           {dragActive ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700' : ''}"
    ondragover={handleDragOver}
    ondragleave={handleDragLeave}
    ondrop={handleDrop}
  >
    <p class="mb-2 text-gray-700 dark:text-gray-300">
      {#if uploading}
        Uploading...
      {:else}
        Drag files here or click to upload
      {/if}
    </p>
    <input 
      type="file" 
      id="file-input" 
      class="hidden" 
      onchange={handleFileInput} 
      multiple 
      accept="image/*,video/*,audio/*"
    />
    <label 
      for="file-input" 
      class="cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded inline-block"
    >
      Select Files
    </label>
  </div>
  
  {#if errorMessage}
    <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
      {errorMessage}
    </div>
  {/if}
  
  <!-- Media gallery -->
  <div class="media-gallery grid grid-cols-3 gap-4 mt-4">
    {#each mediaList as media (media._id)}
      <div 
        class="media-item relative border rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
        onclick={() => selectMedia(media)}
      >
        {#if media.type.startsWith('image/')}
          <img src={getMediaPreviewUrl(media)} alt={media.name} class="w-full h-24 object-cover" />
        {:else if media.type.startsWith('video/')}
          <div class="w-full h-24 bg-gray-700 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        {:else}
          <div class="w-full h-24 bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
        {/if}
        <div class="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 truncate">
          {media.name}
        </div>
        <button 
          class="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center"
          onclick={(e) => deleteMedia(media._id, e)}
        >
          ×
        </button>
      </div>
    {/each}
  </div>
</div>

<style>
  .media-gallery {
    max-height: 300px;
    overflow-y: auto;
  }
</style> 
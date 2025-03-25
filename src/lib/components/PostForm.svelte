<script lang="ts">
  import type { Category } from '$lib/types';
  import { marked } from 'marked';
  import DOMPurify from 'dompurify';
  import { postsDB, categories, selectedPostId, identity } from '$lib/store';
  import MediaUploader from './MediaUploader.svelte';

  let title = '';
  let content = '';
  let category: Category = 'Bitcoin';
  let showPreview = false;
  let showMediaUploader = false;
  let selectedMedia = [];

  async function handleSubmit() {
    console.log('Creating new post:', { title, category });
    if (title && content && category) {
      try {
        const _id = crypto.randomUUID();
        console.log('Creating post with _id:', _id);
        await $postsDB.put({
          _id,
          title,
          content,
          category,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          identity: $identity.id,
          mediaIds: selectedMedia, // Include attached media IDs
        });
        //get all posts
        const posts = await $postsDB.all();
        console.log('All posts:', posts);

        console.info('Post created successfully');
        title = '';
        content = '';
        category = 'Bitcoin';
        selectedMedia = [];
        showPreview = false;
        
        $selectedPostId = _id;
      } catch (error) {
        console.error('Error creating post:', error);
      }
    }
  }

  function renderMarkdown(content: string): string {
    const rawHtml = marked(content);
    return DOMPurify.sanitize(rawHtml);
  }

  function handleMediaSelected(mediaCid: string) {
    console.log('handleMediaSelected', mediaCid);
    if (!selectedMedia.includes(mediaCid)) {
      selectedMedia = [...selectedMedia, mediaCid];
      
      // Add markdown for the media to the content
      content += `\n\n![Media](ipfs://${selectedMedia})`;
    }
    
    // Hide the media uploader after selection
    showMediaUploader = false;
  }

  async function removeSelectedMedia(mediaId: string) {
    selectedMedia = selectedMedia.filter(id => id !== mediaId);
    
    // Remove the markdown reference to this media from the content
    content = content.replace(`\n\n![Media](ipfs://${mediaId})`, '');
  }
</script>

<form on:submit|preventDefault={handleSubmit} class="space-y-4 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
  <h2 class="text-2xl font-bold mb-4 text-gray-900 dark:text-white">Create New Post</h2>
  
  <div>
    <label for="title" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
    <input
      id="title"
      type="text"
      bind:value={title}
      class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
      required
    />
  </div>

  <div>
    <label for="category" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
    <select
      id="category"
      bind:value={category}
      class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
    >
      {#each $categories as cat}
        <option value={cat}>{cat}</option>
      {/each}
    </select>
  </div>

  <div>
    <div class="flex justify-between items-center mb-2">
      <label for="content" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Content (Markdown)</label>
      <div class="flex space-x-2">
        <button
          type="button"
          on:click={() => showMediaUploader = !showMediaUploader}
          class="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300"
        >
          {showMediaUploader ? 'Hide Media Library' : 'Add Media'}
        </button>
        <button
          type="button"
          on:click={() => showPreview = !showPreview}
          class="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300"
        >
          {showPreview ? 'Show Editor' : 'Show Preview'}
        </button>
      </div>
    </div>

    {#if showMediaUploader}
      <MediaUploader onMediaSelected={handleMediaSelected} />
    {/if}

    {#if showPreview}
      <div class="prose dark:prose-invert max-w-none min-h-[200px] p-4 border rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600">
        {@html renderMarkdown(content || '*Preview will appear here...*')}
      </div>
    {:else}
      <textarea
        id="content"
        bind:value={content}
        rows="6"
        class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        required
        placeholder="# Your markdown content here...

## Supported markdown features:
- Headers (# for h1, ## for h2, etc.)
- **Bold** and *italic* text
- Lists (ordered and unordered)
- [Links](https://example.com)
- `Code blocks`
- > Blockquotes"
      ></textarea>
    {/if}
  </div>

  {#if selectedMedia.length > 0}
    <div class="selected-media">
      <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Selected Media:</h4>
      <div class="flex flex-wrap gap-2">
        {#each selectedMedia as mediaId}
          <div class="bg-gray-100 dark:bg-gray-700 rounded px-2 py-1 text-sm flex items-center">
            <span class="truncate max-w-[150px]">{mediaId}</span>
            <button 
              type="button"
              class="ml-2 text-red-500 hover:text-red-700"
              on:click={() => removeSelectedMedia(mediaId)}
            >
              ×
            </button>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <button
    type="submit"
    class="w-full bg-indigo-600 dark:bg-indigo-500 text-white py-2 px-4 rounded-md hover:bg-indigo-700 dark:hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors"
  >
    Create Post
  </button>
</form>
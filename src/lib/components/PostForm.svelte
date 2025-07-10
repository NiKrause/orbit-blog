<script lang="ts">
  import { preventDefault } from 'svelte/legacy';
  import { _, locale } from 'svelte-i18n';

  import type { Category } from '$lib/types.js';
  import { marked } from 'marked';
  import DOMPurify from 'dompurify';
  import { postsDB, categories, selectedPostId, identity, enabledLanguages, isRTL } from '$lib/store.js';
  import MediaUploader from './MediaUploader.svelte';
  import { encryptPost } from '$lib/cryptoUtils.js';
  import PostPasswordPrompt from './PostPasswordPrompt.svelte';

  let title = $state('');
  let content = $state('');
  let category: Category = $state('');
  let showPreview = $state(false);
  let showMediaUploader = $state(false);
  let selectedMedia = $state<string[]>([]);
  let isTranslating = $state(false);
  let translationError = $state('');
  let translationStatuses = $state<Record<string, 'success' | 'error' | 'default'>>({});
  let isEncrypting = $state(false);
  let showPasswordPrompt = $state(false);
  let encryptionPassword = $state('');
  let encryptionError = $state('');
  let published = $state(false);

  async function handleSubmit() {
    console.log('Creating new post:', { title, category });
    if (title && content && category) {
      try {
        const _id = crypto.randomUUID();
        console.log('Creating post with _id:', _id);
        
        let postData = {
          _id,
          title,
          content,
          language: $locale,
          category,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          identity: $identity.id,
          mediaIds: selectedMedia,
          published
        };

        if (isEncrypting) {
          console.log('Encrypting post', encryptionPassword);
          const encryptedData = await encryptPost({ title, content }, encryptionPassword);
          postData = {
            ...postData,
            title: encryptedData.encryptedTitle,
            content: encryptedData.encryptedContent,
            isEncrypted: true
          };
        }

        await $postsDB.put(postData);
        //get all posts
        const posts = await $postsDB.all();
        console.log('All posts:', posts);

        console.info('Post created successfully');
        title = '';
        content = '';
        category = '';
        selectedMedia = [];
        showPreview = false;
        isEncrypting = false;
        encryptionPassword = '';
        
        $selectedPostId = _id;
      } catch (_error) {
        console.error('Error creating post:', _error);
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
    content = content.replace(`\n\n![Media](ipfs://${mediaId})`, '');
  }

  // async function handleTranslate() {
  //   if (!title || !content || !category) {
  //     translationError = $_('fill_required_fields');
  //     return;
  //   }

  //   isTranslating = true;
  //   translationError = '';
  //   translationStatuses = Object.fromEntries([...$enabledLanguages].map(lang => [lang, 'default']));

  //   try {
  //     const result = await TranslationService.translateAndSavePost({
  //       post: {
  //         title,
  //         content,
  //         category,
  //         language: $locale,
  //         isEncrypted: isEncrypting
  //       },
  //       encryptionPassword: encryptionPassword,
  //       postsDB: $postsDB,
  //       identity: $identity,
  //       mediaIds: selectedMedia,
  //       onStatusUpdate: (lang, status) => {
  //         translationStatuses = {
  //           ...translationStatuses,
  //           [lang]: status === 'processing' ? 'default' : status
  //         };
  //       }
  //     });

  //     if (result.success) {
  //       translationStatuses = result.translationStatuses;
  //       // Clear form after successful translation
  //       title = '';
  //       content = '';
  //       category = '';
  //       selectedMedia = [];
  //       showPreview = false;
  //     } else {
  //       translationError = result.error;
  //       translationStatuses = result.translationStatuses;
  //     }
  //   } catch (error) {
  //     translationError = $_('translation_failed');
  //   } finally {
  //     isTranslating = false;
  //   }
  // }

  async function handleEncrypt() {
    if (!title || !content) {
      encryptionError = $_('fill_required_fields');
      return;
    }
    showPasswordPrompt = true;
  }

  async function handlePasswordSubmit(event: CustomEvent) {
    console.log('handlePasswordSubmit', event);
    encryptionPassword = event.detail.password;
    isEncrypting = true;
    showPasswordPrompt = false;
    encryptionError = '';
  }

  async function handlePostDecrypted(event: CustomEvent) {
    const decryptedData = event.detail.post;
    console.log('handlePostDecrypted', decryptedData);
    // Update the post data
    title = decryptedData.title;
    content = decryptedData.content;
    showPasswordPrompt = false;
    encryptionError = '';
  }
</script>

<form onsubmit={preventDefault(handleSubmit)} data-testid="post-form" class="space-y-4 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md {$isRTL ? 'rtl' : 'ltr'}">
  <h2 class="text-2xl font-bold mb-4 text-gray-900 dark:text-white">{$_('create_new_post')}</h2>
  
  <div>
    <label for="title" class="block text-sm font-medium text-gray-700 dark:text-gray-300">{$_('title')}</label>
    <input
      id="title"
      type="text"
      data-testid="post-title-input"
      bind:value={title}
      class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
      required
    />
  </div>

  <div>
    <label for="category" class="block text-sm font-medium text-gray-700 dark:text-gray-300">{$_('category')}</label>
    <select
      id="category"
      data-testid="category-select"
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
      <label for="content" class="block text-sm font-medium text-gray-700 dark:text-gray-300">{$_('content')}</label>
      <div class="flex space-x-2">
        <button
          type="button"
          onclick={() => showMediaUploader = !showMediaUploader}
          class="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300"
        >
          {showMediaUploader ? $_('hide_media_library') : $_('add_media')}
        </button>
        <button
          type="button"
          onclick={() => showPreview = !showPreview}
          class="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300"
        >
          {showPreview ? $_('show_editor') : $_('show_preview')}
        </button>
      </div>
    </div>

    {#if showMediaUploader}
      <MediaUploader onMediaSelected={handleMediaSelected} />
    {/if}

    {#if showPreview}
      <div class="prose dark:prose-invert max-w-none min-h-[200px] p-4 border rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600">
        {@html renderMarkdown(content || `*${$_('preview_will_appear_here')}...*`)}
      </div>
    {:else}
      <textarea
        id="content"
        data-testid="post-content-input"
        bind:value={content}
        rows="6"
        class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        required
        placeholder={$_('markdown_placeholder')}
      ></textarea>
    {/if}
  </div>

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

  <div class="flex justify-between items-center mt-4">
    <div class="flex items-center space-x-2">
      <input
        type="checkbox"
        id="publish"
        bind:checked={published}
        class="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
      />
      <label for="publish" class="text-sm text-gray-700 dark:text-gray-300">{$_('publish_post')}</label>
    </div>

    <button
      type="button"
      onclick={handleEncrypt}
      class="inline-flex items-center gap-2 bg-indigo-600 dark:bg-indigo-500 text-white py-2 px-4 rounded-md hover:bg-indigo-700 dark:hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors"
    >
      <!-- {#if isEncrypting}
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd" />
        </svg>
        {$_('post_will_be_encrypted')}
      {:else} -->
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clip-rule="evenodd" />
        </svg>
        {$_('encrypt_post')}
      <!-- {/if} -->
    </button>

    <!-- <button
      type="button"
      onclick={handleTranslate}
      disabled={isTranslating}
      class="inline-flex items-center gap-2 bg-indigo-600 dark:bg-indigo-500 text-white py-2 px-4 rounded-md hover:bg-indigo-700 dark:hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors disabled:opacity-50"
    >
      <div class="grid grid-cols-3 gap-1">
        {#each [...$enabledLanguages] as lang}
          <LanguageStatusLED 
            language={lang} 
            status={
              translationStatuses[lang] === 'success' ? 'success' :
              translationStatuses[lang] === 'error' ? 'error' : 
              'default'
            }
          />
        {/each}
      </div>
      {#if isTranslating}
        {$_('translating')}...
      {:else}
        {$_('translate_and_post')}
      {/if}
    </button> -->
    
    <button
      type="submit"
      data-testid="publish-post-button"
      class="bg-indigo-600 dark:bg-indigo-500 text-white py-2 px-4 rounded-md hover:bg-indigo-700 dark:hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors"
    >
      {$_('create_post')}
    </button>
  </div>

  {#if translationError}
    <div class="mt-2 text-red-600 dark:text-red-400">
      {translationError}
    </div>
  {/if}

  {#if encryptionError}
    <div class="mt-2 text-red-600 dark:text-red-400">
      {encryptionError}
    </div>
  {/if}
</form>

{#if showPasswordPrompt}
  <PostPasswordPrompt 
    post={{ title, content }}
    on:cancel={() => showPasswordPrompt = false}
    mode={'encrypt'}
    on:postDecrypted={handlePostDecrypted}
    on:passwordSubmitted={handlePasswordSubmit}
  />
{/if}

<style>
  /* RTL specific styles */
  :global([dir="rtl"]) .flex {
    flex-direction: row-reverse;
  }

  :global([dir="rtl"]) .space-x-2 > * + * {
    margin-right: 0.5rem;
    margin-left: 0;
  }

  :global([dir="rtl"]) .gap-2 > * + * {
    margin-right: 0.5rem;
    margin-left: 0;
  }

</style>
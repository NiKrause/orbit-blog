<script lang="ts">
  import { preventDefault } from 'svelte/legacy';
  import { _, locale } from 'svelte-i18n';

  import type { Category } from '$lib/types.js';
  import { postsDB, categories, selectedPostId, identity, enabledLanguages, isRTL } from '$lib/store.js';
  import { encryptPost } from '$lib/cryptoUtils.js';
  import PostPasswordPrompt from './PostPasswordPrompt.svelte';
  import MediaManager from './MediaManager.svelte';
  import ContentEditor from './ContentEditor.svelte';
  import MediaUploader from './MediaUploader.svelte';
import { handleMediaSelection, removeMediaFromContent, validateEncryptionFields } from '$lib/utils/postUtils.js';
import { renderContent } from '$lib/services/MarkdownRenderer.js';
import MultiSelect from './MultiSelect.svelte';
import { MarkdownImportResolver } from '$lib/services/MarkdownImportResolver.js';
import { info } from '$lib/utils/logger.js';
import MarkdownHelp from './MarkdownHelp.svelte';

  let title = $state('');
  let content = $state('');
  let category: Category = $state('');
  let selectedCategories = $state<string[]>([]);
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

  // Import resolution state
  let isResolvingImports = $state(false);
  let importResolutionError = $state('');
  let importResolutionResult = $state<any>(null);

  async function handleSubmit() {
    
    if (title && content && selectedCategories.length > 0) {
      try {
        const _id = crypto.randomUUID();
        console.log('Creating post with _id:', _id);
        
        // Ensure identity is available before creating post
        if (!$identity || !$identity.id) {
          console.error('Identity not available when creating post');
          alert('Identity not initialized. Please wait for the app to fully load.');
          return;
        }
        
        // Support both single category (backward compatibility) and multiple categories
        const categoryData = selectedCategories.length > 0 ? selectedCategories : (category ? [category] : []);
        
        let postData = {
          _id,
          title,
          content,
          language: $locale,
          category: categoryData.length === 1 ? categoryData[0] : categoryData[0] || '', // Keep single category for backward compatibility
          categories: categoryData, // New field for multiple categories
          createdAt: Date.now(),
          updatedAt: Date.now(),
          identity: $identity.id,
          mediaIds: selectedMedia,
          published
        };
        
        console.log('PostData with identity:', {...postData, identity: postData.identity });

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
        selectedCategories = [];
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

  function handleMediaSelected(mediaCid: string) {
    console.log('handleMediaSelected', mediaCid);
    const result = handleMediaSelection(mediaCid, selectedMedia, content);
    selectedMedia = result.updatedMedia;
    content = result.updatedContent;
    showMediaUploader = false;
  }

  async function removeSelectedMedia(mediaId: string) {
    const result = removeMediaFromContent(mediaId, selectedMedia, content);
    selectedMedia = result.updatedMedia;
    content = result.updatedContent;
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
    const validationError = validateEncryptionFields(title, content);
    if (validationError) {
      encryptionError = validationError;
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

  // Function to handle resolving physical imports
  async function handleResolveImports() {
    if (!content) return;
    
    isResolvingImports = true;
    importResolutionError = '';
    importResolutionResult = null;
    
    try {
      info('Resolving physical imports in content...');
      const result = await MarkdownImportResolver.resolvePhysicalImports(content);
      
      if (result.success) {
        content = result.resolvedContent;
        importResolutionResult = result;
        info(`Successfully resolved ${result.resolvedImports.length} physical imports`);
      } else {
        importResolutionError = `Failed to resolve some imports: ${result.errors.map(e => e.error).join(', ')}`;
        importResolutionResult = result;
      }
    } catch (error) {
      console.error('Error resolving imports:', error);
      importResolutionError = error instanceof Error ? error.message : 'Unknown error occurred';
    } finally {
      isResolvingImports = false;
    }
  }

  // Check if content has physical imports
  let hasPhysicalImports = $derived(content ? MarkdownImportResolver.hasPhysicalImports(content) : false);
</script>

<form onsubmit={preventDefault(handleSubmit)} data-testid="post-form" class="space-y-4 bg-gray-50 dark:bg-gray-800 p-6 rounded-lg shadow-md {$isRTL ? 'rtl' : 'ltr'}">
  <h2 class="text-2xl font-bold mb-4 text-gray-900 dark:text-white">{$_('create_new_post')}</h2>
  
  <div>
    <label for="title" class="block text-sm font-medium text-gray-700 dark:text-gray-300">{$_('title')}</label>
<input
      id="title"
      type="text"
      data-testid="post-title-input"
      bind:value={title}
      class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
      required
    />
  </div>

  <div>
    <label for="categories" class="block text-sm font-medium text-gray-700 dark:text-gray-300">{$_('categories')}</label>
    <MultiSelect
      id="categories"
      bind:values={selectedCategories}
      options={$categories}
      placeholder="Select categories..."
    />
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
        {#if hasPhysicalImports}
        <button
          type="button"
          onclick={handleResolveImports}
          disabled={isResolvingImports}
          class="text-sm text-green-600 dark:text-green-400 hover:text-green-500 dark:hover:text-green-300 disabled:opacity-50"
        >
          {#if isResolvingImports}
            🔄 Resolving...
          {:else}
            🔗 Resolve Imports
          {/if}
        </button>
        {/if}
        <MarkdownHelp />
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
{@html renderContent(content || `*${$_('preview_will_appear_here')}...*`)}
      </div>
    {:else}
<textarea
        id="content"
        data-testid="post-content-input"
        bind:value={content}
        rows="6"
        class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        required
        placeholder={$_('markdown_placeholder')}
      ></textarea>
    {/if}
  </div>

  <MediaManager 
    selectedMedia={selectedMedia}
    showMediaUploader={false}
    on:mediaRemoved={(e) => removeSelectedMedia(e.detail.mediaId)}
  />

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

  {#if importResolutionError}
    <div class="mt-2 text-red-600 dark:text-red-400">
      Import Resolution Error: {importResolutionError}
    </div>
  {/if}

  {#if importResolutionResult && importResolutionResult.resolvedImports.length > 0}
    <div class="mt-2 p-3 bg-green-50 dark:bg-green-900 rounded-md border border-green-200 dark:border-green-700">
      <h4 class="text-green-800 dark:text-green-200 font-medium text-sm">✅ Physical Imports Resolved</h4>
      <ul class="mt-1 text-green-700 dark:text-green-300 text-xs space-y-1">
        {#each importResolutionResult.resolvedImports as resolvedImport}
          <li>• {resolvedImport.title || 'Untitled'} from {resolvedImport.url}</li>
        {/each}
      </ul>
      {#if importResolutionResult.errors.length > 0}
        <div class="mt-2">
          <h5 class="text-red-800 dark:text-red-200 font-medium text-xs">Some imports failed:</h5>
          <ul class="mt-1 text-red-700 dark:text-red-300 text-xs space-y-1">
            {#each importResolutionResult.errors as error}
              <li>• {error.url}: {error.error}</li>
            {/each}
          </ul>
        </div>
      {/if}
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


</style>
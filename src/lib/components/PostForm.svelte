<script lang="ts">
  import { preventDefault } from 'svelte/legacy';
  import { _, locale } from 'svelte-i18n';

  import type { Category, Post } from '$lib/types.js';
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
import { loadWebAuthnVarsigCredential } from '@le-space/orbitdb-identity-provider-webauthn-did';

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

  function shortIdentity(value?: string | null): string {
    if (!value) return 'not available';
    if (value.length <= 24) return value;
    return `${value.slice(0, 12)}...${value.slice(-8)}`;
  }

  function buildPrePostIdentityNotice(): string {
    const activeDid = $identity?.id || '';
    const activeType = $identity?.type === 'webauthn-varsig' ? 'hardware-passkey' : 'session/software';
    const sessionDid = typeof window !== 'undefined'
      ? sessionStorage.getItem('sessionIdentityDid')
      : null;
    const storedPasskeyDid = loadWebAuthnVarsigCredential()?.did
      || (typeof window !== 'undefined' ? sessionStorage.getItem('passkeyIdentityDid') : null);

    return [
      'Identity check before posting:',
      `Active signer type: ${activeType}`,
      `Active signer DID: ${shortIdentity(activeDid)}`,
      `Session DID: ${shortIdentity(sessionDid)}`,
      `Passkey DID: ${shortIdentity(storedPasskeyDid)}`,
      '',
      'Continue and publish this post?'
    ].join('\n');
  }

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

        const writerSessionActive = typeof window !== 'undefined' && sessionStorage.getItem('identityMode') === 'passkey';
        if (!writerSessionActive) {
          alert('Publishing is blocked in reader mode. Activate passkey writer mode first.');
          return;
        }

        const proceed = window.confirm(buildPrePostIdentityNotice());
        if (!proceed) return;
        
        // Support both single category (backward compatibility) and multiple categories
        const categoryData = selectedCategories.length > 0 ? selectedCategories : (category ? [category] : []);
        
        let postData: Partial<Post> = {
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

<form onsubmit={preventDefault(handleSubmit)} data-testid="post-form" class="card p-6 space-y-4 {$isRTL ? 'rtl' : 'ltr'}">
  <h2 class="text-lg font-semibold mb-2" style="color: var(--text);">{$_('create_new_post')}</h2>
  
  <div>
    <label for="title" class="block text-xs font-medium mb-1" style="color: var(--text-secondary);">{$_('title')}</label>
    <input
      id="title"
      type="text"
      data-testid="post-title-input"
      bind:value={title}
      class="input"
      required
    />
  </div>

  <div>
    <label for="categories" class="block text-xs font-medium mb-1" style="color: var(--text-secondary);">{$_('categories')}</label>
    <MultiSelect
      id="categories"
      bind:values={selectedCategories}
      options={$categories}
      placeholder="Select categories..."
    />
  </div>

  <div>
    <div class="flex justify-between items-center mb-2">
      <label for="content" class="block text-xs font-medium" style="color: var(--text-secondary);">{$_('content')}</label>
      <div class="flex gap-2">
        <button
          type="button"
          onclick={() => showMediaUploader = !showMediaUploader}
          class="btn-ghost btn-sm"
        >
          {showMediaUploader ? $_('hide_media_library') : $_('add_media')}
        </button>
        {#if hasPhysicalImports}
        <button
          type="button"
          onclick={handleResolveImports}
          disabled={isResolvingImports}
          class="btn-ghost btn-sm disabled:opacity-50"
        >
          {isResolvingImports ? 'Resolving...' : 'Resolve Imports'}
        </button>
        {/if}
        <MarkdownHelp />
        <button
          type="button"
          onclick={() => showPreview = !showPreview}
          class="btn-ghost btn-sm"
        >
          {showPreview ? $_('show_editor') : $_('show_preview')}
        </button>
      </div>
    </div>

    {#if showMediaUploader}
      <MediaUploader onMediaSelected={handleMediaSelected} />
    {/if}

    {#if showPreview}
      <div class="prose dark:prose-invert max-w-none min-h-[200px] p-4 rounded-md" style="background-color: var(--bg-tertiary); border: 1px solid var(--border);">
{@html renderContent(content || `*${$_('preview_will_appear_here')}...*`)}
      </div>
    {:else}
      <textarea
        id="content"
        data-testid="post-content-input"
        bind:value={content}
        rows="6"
        class="input"
        style="min-height: 150px;"
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

  <div class="flex justify-between items-center pt-3" style="border-top: 1px solid var(--border);">
    <div class="flex items-center gap-2">
      <input
        type="checkbox"
        id="publish"
        bind:checked={published}
        class="rounded"
        style="border-color: var(--border); color: var(--accent);"
      />
      <label for="publish" class="text-sm" style="color: var(--text-secondary);">{$_('publish_post')}</label>
    </div>

    <div class="flex gap-2">
      <button
        type="button"
        onclick={handleEncrypt}
        class="btn-outline inline-flex items-center gap-1.5"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clip-rule="evenodd" />
        </svg>
        {$_('encrypt_post')}
      </button>
      
      <button
        type="submit"
        data-testid="publish-post-button"
        class="btn-primary"
      >
        {$_('create_post')}
      </button>
    </div>
  </div>

  {#if translationError}
    <div class="mt-2 text-sm" style="color: var(--danger);">{translationError}</div>
  {/if}

  {#if encryptionError}
    <div class="mt-2 text-sm" style="color: var(--danger);">{encryptionError}</div>
  {/if}

  {#if importResolutionError}
    <div class="mt-2 text-sm" style="color: var(--danger);">Import Resolution Error: {importResolutionError}</div>
  {/if}

  {#if importResolutionResult && importResolutionResult.resolvedImports.length > 0}
    <div class="mt-2 p-3 rounded-md" style="background-color: var(--bg-tertiary); border: 1px solid var(--border);">
      <h4 class="font-medium text-sm" style="color: var(--success);">Physical Imports Resolved</h4>
      <ul class="mt-1 text-xs space-y-1" style="color: var(--text-secondary);">
        {#each importResolutionResult.resolvedImports as resolvedImport}
          <li>{resolvedImport.title || 'Untitled'} from {resolvedImport.url}</li>
        {/each}
      </ul>
      {#if importResolutionResult.errors.length > 0}
        <div class="mt-2">
          <h5 class="font-medium text-xs" style="color: var(--danger);">Some imports failed:</h5>
          <ul class="mt-1 text-xs space-y-1" style="color: var(--danger);">
            {#each importResolutionResult.errors as error}
              <li>{error.url}: {error.error}</li>
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
  :global([dir="rtl"]) .flex {
    flex-direction: row-reverse;
  }
</style>

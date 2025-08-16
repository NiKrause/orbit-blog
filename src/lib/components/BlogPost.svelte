<script lang="ts">
  import { onMount } from 'svelte';
  import { run, preventDefault } from 'svelte/legacy';

  // Third-party imports
  import { renderContent, renderMermaidDiagrams } from '$lib/services/MarkdownRenderer.js';
  import { _, locale } from 'svelte-i18n';
  import { derived } from 'svelte/store';
  import { unixfs } from '@helia/unixfs';

  // Local imports
  import type { BlogPost, Comment } from '$lib/types.js';
  import { commentsDB, mediaDB, helia, isRTL, posts } from '$lib/store.js';
  import { formatTimestamp, formatTimestampLong } from '$lib/dateUtils.js';
  import { postsDB, categories, selectedPostId, identity, enabledLanguages } from '$lib/store.js';
  import { isEncryptedPost } from '$lib/cryptoUtils.js';
  import PostPasswordPrompt from './PostPasswordPrompt.svelte';
  import { info, debug, error } from '../utils/logger.js'

  /**
   * Component props interface
   */
  interface Props {
    /** The blog post to display */
    post: BlogPost;
  }

  // Props
  let { post }: Props = $props();

  // State variables
  let newComment = $state('');
  let commentAuthor = $state('');
  let comments: Comment[] = $state([]);
  let postMedia = $state([]);
  let fs = $state();
  let renderedContent = $state('');
  
  // Cache for IPFS content
  let mediaCache = new Map();

  let title = $state('');
  let content = $state('');
  let category: Category = $state('');
  let selectedMedia = $state<string[]>([]);
  let isEncrypted = $state(false);
  let showPasswordPrompt = $state(false);
  let decryptionError = $state('');

  // Create a reactive date formatter that updates when locale changes
  const reactiveDateFormatter = derived(locale, ($locale) => {
    return (timestamp: number | string) => formatTimestamp(timestamp);
  });

  // Create a reactive long-form date formatter for main post dates
  const reactiveDateFormatterLong = derived(locale, ($locale) => {
    return (timestamp: number | string) => formatTimestampLong(timestamp);
  });

  // IPFS Related Functions
  /**
   * Initializes the UnixFS instance for IPFS operations
   * @returns {boolean} True if initialization successful, false otherwise
   */
  function initUnixFs(): boolean {
    if ($helia) {
      fs = unixfs($helia);
      return true;
    }
    return false;
  }

  /**
   * Retrieves a blob URL for an IPFS CID
   * @param {string} cid - The IPFS content identifier
   * @returns {Promise<string|null>} The blob URL or gateway URL as fallback
   */
  async function getBlobUrl(cid: string): Promise<string | null> {
    if (!fs && !initUnixFs()) return null;
    if (mediaCache.has(cid)) return mediaCache.get(cid);
    
    try {
      const chunks = [];
      for await (const chunk of fs.cat(cid)) {
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

// Content Related Functions
function updateRenderedContent(): void {
  // Use local content variable if available, otherwise fall back to post.content
  const contentToRender = content || post?.content;
  if (contentToRender) {
    const newContent = renderContent(contentToRender);
    // Only update if content actually changed to prevent unnecessary re-renders
    if (newContent !== renderedContent) {
      info('Updating rendered content');
      renderedContent = newContent;
      // Wait for next tick to ensure content is in DOM
      setTimeout(async () => {
        await renderMermaidDiagrams();
        // Add accordion event listeners after content is rendered
        addAccordionEventListeners();
      }, 0);
    }
  }
}

  // Media Related Functions
  /**
   * Loads and caches media associated with the current post
   */
  async function loadPostMedia(): Promise<void> {
    if (!$mediaDB || !post.mediaIds) return;
    
    try {
      const allMedia = await $mediaDB.all();
      const mediaMap = allMedia.map(entry => entry.value);
      const existingMediaMap = new Map(postMedia.map(m => [m.cid, m.url]));
      
      initUnixFs();
      
      postMedia = await Promise.all(
        post.mediaIds?.map(async cid => {
          const media = mediaMap.find(m => m.cid === cid);
          if (media) {
            return {
              ...media,
              url: existingMediaMap.get(media.cid) || await getBlobUrl(media.cid)
            };
          }
          return null;
        }) || []
      ).then(results => results.filter(Boolean));
    } catch (_error) {
      error('Error loading media:',_error);
    }
  }

  // Comment Related Functions
  /**
   * Loads comments for the current post
   */
  async function loadComments(): Promise<void> {
    if (!$commentsDB) return;
    
    try {
      const allComments = await $commentsDB.all();
      comments = allComments
        .map(entry => entry.value)
        .filter(comment => comment.postId === post._id);
    } catch (_error) {
      error('Error loading comments:', _error);
    }
  }

  /**
   * Adds a new comment to the post
   */
  async function addComment(): Promise<void> {
    if (!newComment.trim() || !commentAuthor.trim() || !$commentsDB) return;
    
    try {
      const _id = crypto.randomUUID();
      await $commentsDB.put({
        _id,
        postId: post._id,
        content: newComment,
        author: commentAuthor,
        createdAt: new Date().toISOString()
      });
      
      newComment = '';
      commentAuthor = '';
      await loadComments();
    } catch (_error) {
      error('Error adding comment:', _error);
    }
  }


  // Lifecycle and Effects
  onMount(async () => {
    if ($mediaDB && post) {
      await loadPostMedia();
    }
    updateRenderedContent();
  });

  // Remove this effect as it causes unnecessary re-renders
  // updateRenderedContent is already called in onMount and the selectedPostId effect

  $effect(async () => {
    if ($selectedPostId) {
      const post = await $postsDB.get($selectedPostId);
      info('post', post);
      if (post) {
        title = post.value.title;
        content = post.value.content;
        category = post.value.category;
        selectedMedia = post.value.mediaIds || [];
        info('post', post);
        isEncrypted = post.value.isEncrypted || isEncryptedPost({ title, content });
        info('isEncryptedPost function', isEncryptedPost({ title, content }));
        info('isEncrypted', isEncrypted);
        if (isEncrypted) {
          showPasswordPrompt = true;
        } else {
          // Update rendered content when not encrypted
          updateRenderedContent();
        }
        if ($commentsDB) {
        loadComments();
        
        $commentsDB.events.on('update', async (entry) => {
          if (entry?.payload?.op === 'PUT') {
            const comment = entry.payload.value;
            if (comment.postId === post._id) {
              await loadComments();
            }
          } else if (entry?.payload?.op === 'DEL') {
            await loadComments();
          }
        });
      }
      }
    }
  });



  // Add accordion event listeners to prevent scrolling issues
  function addAccordionEventListeners(): void {
    // Wait a bit to ensure DOM is fully rendered
    setTimeout(() => {
      const accordions = document.querySelectorAll('.accordion');
      
      accordions.forEach((accordion) => {
        const summary = accordion.querySelector('summary');
        
        if (summary && !summary.dataset.listenerAdded) {
          // Remove any existing listeners first
          summary.removeEventListener('click', handleAccordionClick);
          
          // Add our custom click handler  
          summary.addEventListener('click', handleAccordionClick);
          summary.dataset.listenerAdded = 'true';
        }
      });
    }, 100);
  }
  
  // Separate function to handle accordion clicks
  function handleAccordionClick(e) {
    // Prevent default behavior that might cause issues
    e.preventDefault();
    e.stopPropagation();
    
    // Find the details element
    const summary = e.currentTarget;
    const details = summary.closest('details');
    
    if (details) {
      details.open = !details.open;
    }
  }


  function passwordSubmitted(event: CustomEvent) {
    info('passwordSubmitted', event.detail.password);
    // Handle password submission for BlogPost component if needed
    // This function exists for compatibility with PostPasswordPrompt
  }

  async function handlePostDecrypted(event: CustomEvent) {
    info('handlePostDecrypted');
    const decryptedData = event.detail.post;
    
    // Update local state
    title = decryptedData.title;
    content = decryptedData.content;
    
    // Update the global posts store
    if ($postsDB) {
      const currentPost = await $postsDB.get(post._id);
      if (currentPost) {
        const updatedPost = {
          ...currentPost.value,
          title: decryptedData.title,
          content: decryptedData.content,
          isDecrypted: true
        };
        // Update the posts store
        $posts = $posts.map(p => {
          if (p._id === post._id) {
            return updatedPost;
          }
          return p;
        });
      }
    }
    
    // Update rendered content
    renderedContent = renderContent(decryptedData.content);
    
    showPasswordPrompt = false;
    decryptionError = '';
    
    // Wait for next tick to ensure content is in DOM
    setTimeout(async () => {
      await renderMermaidDiagrams();
    }, 0);
  }
</script>

<style>

  /* Add accordion styles */
  :global(.accordion-wrapper) {
    margin: 1rem 0;
  }

  :global(.accordion) {
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    overflow: hidden;
  }

  :global(.accordion-header) {
    padding: 1rem;
    background-color: #f9fafb;
    cursor: pointer;
    font-weight: 600;
    display: block;
    user-select: none;
  }

  /* Dark mode support */
  :global(.dark .accordion) {
    border-color: #4b5563;
  }

  :global(.dark .accordion-header) {
    background-color: #374151;
  }

  :global(.accordion-header:hover) {
    background-color: #f3f4f6;
  }

  :global(.dark .accordion-header:hover) {
    background-color: #4b5563;
  }

  :global(.accordion-content) {
    padding: 1rem;
  }

  /* Add arrow indicator */
  :global(.accordion-header::after) {
    content: '▼';
    float: right;
    transform: rotate(0);
    transition: transform 0.2s ease;
  }

  :global(details[open] .accordion-header::after) {
    transform: rotate(180deg);
  }

  /* Add to your existing styles */
  :global(.mermaid) {
    margin: 1rem 0;
    background-color: white;
    padding: 1rem;
    border-radius: 0.5rem;
  }

  /* Dark mode support */
  :global(.dark .mermaid) {
    background-color: #1f2937;
  }
</style>

<article data-testid="blog-post" class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
  {#if isEncrypted && showPasswordPrompt}
    <PostPasswordPrompt 
      mode={isEncrypted ? 'decrypt' : 'encrypt'}
      post={{ title, content }}
      on:postDecrypted={handlePostDecrypted}
      on:cancel={() => {
        info('cancel');
        showPasswordPrompt = false;
      }}
      on:passwordSubmitted={passwordSubmitted}
    />
  {:else}
    <h1 data-testid="post-title" class="text-4xl font-bold mb-2 text-gray-900 dark:text-white">{title}</h1>
    <div class="text-sm text-gray-500 dark:text-gray-400 mb-4">
      <div class="flex flex-wrap gap-2 mb-2">
        <span title={post.identity || 'Unknown'}>
          {$_('by')} {post.identity ? `...${post.identity.slice(-5)}` : $_('unknown')}
        </span>
        <span>{$reactiveDateFormatterLong(post.createdAt || post.date)}</span>
        {#if post.updatedAt && post.updatedAt !== post.createdAt}
          <span>({$_('updated')}: {$reactiveDateFormatterLong(post.updatedAt)})</span>
        {/if}
      </div>
      {#if post.categories && post.categories.length > 0}
        <div class="flex flex-wrap gap-2">
          {#each post.categories as categoryItem}
            <span class="px-2 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 rounded-full whitespace-nowrap flex-shrink-0">
              {categoryItem}
            </span>
          {/each}
        </div>
      {:else if post.category}
        <div class="mt-1">
          <span class="px-2 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 rounded-full whitespace-nowrap flex-shrink-0">
            {post.category}
          </span>
        </div>
      {/if}
    </div>
    
    <div data-testid="post-content" class="prose dark:prose-invert max-w-none mb-6">
      {@html renderedContent}
    </div>

    <section class="mt-8">
      <h3 class="text-xl font-bold mb-4 text-gray-900 dark:text-white">{$_('comments')} ({comments.length})</h3>
      {#each comments as comment}
        <div class="mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div class="flex items-center mb-2">
            <strong class="text-gray-900 dark:text-white">{comment.author}</strong>
            <span class="ml-2 text-sm text-gray-500 dark:text-gray-400">
              {$reactiveDateFormatter(comment.createdAt)}
            </span>
          </div>
          <p class="text-gray-700 dark:text-gray-300">{comment.content}</p>
        </div>
      {/each}

       <!-- Display attached media gallery if there are media items -->
      {#if postMedia.length > 0}
      <div class="mt-4 mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <h3 class="text-lg font-medium mb-2 text-gray-900 dark:text-white">{$_('media')}</h3>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {#each postMedia as media}
            {#if media.type.startsWith('image/')}
              <a href={media.url || `https://ipfs.io/ipfs/${media.cid}`} target="_blank" rel="noopener noreferrer" 
                 ontouchend={(e) => {e.preventDefault(); window.open(media.url || `https://ipfs.io/ipfs/${media.cid}`, '_blank')}}
                 class="block overflow-hidden rounded-lg">
                <img src={media.url || `https://ipfs.io/ipfs/${media.cid}`} alt={media.name}
                     class="w-full h-auto object-cover" />
              </a>
            {:else if media.type.startsWith('video/')}
              <video controls class="w-full rounded-lg">
                <source src={media.url || `https://ipfs.io/ipfs/${media.cid}`} type={media.type}>
                <track kind="captions" src="" label="No captions available" default>
                {$_('browser_no_video_support')}
              </video>
            {:else if media.type.startsWith('audio/')}
              <audio controls class="w-full">
                <source src={media.url || `https://ipfs.io/ipfs/${media.cid}`} type={media.type}>
                {$_('browser_no_audio_support')}
              </audio>
            {:else}
              <a href={media.url || `https://ipfs.io/ipfs/${media.cid}`} 
                 target="_blank" 
                 rel="noopener noreferrer"
                 ontouchend={(e) => {e.preventDefault(); window.open(media.url || `https://ipfs.io/ipfs/${media.cid}`, '_blank')}}
                 class="flex items-center p-3 bg-gray-100 dark:bg-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500 transition">
                <span class="truncate">{media.name} ({(media.size / 1024).toFixed(2)} KB)</span>
              </a>
            {/if}
          {/each}
        </div>
      </div>
    {/if}

      <form onsubmit={preventDefault(addComment)} class="mt-6">
        <div class="mb-4">
          <input
            type="text"
            bind:value={commentAuthor}
            placeholder={$_('your_name')}
            required
            class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
        <div class="mb-4">
          <textarea
            bind:value={newComment}
            placeholder={$_('write_a_comment')}
            required
            class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-h-[100px]"
          ></textarea>
        </div>
        <button 
          type="submit"
          class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition"
        >
          {$_('add_comment')}
        </button>
      </form>
    </section>
  {/if}
</article>
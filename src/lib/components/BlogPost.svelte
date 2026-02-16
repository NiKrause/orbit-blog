<script lang="ts">
  import { onMount } from 'svelte';
  import { run, preventDefault } from 'svelte/legacy';

  // Third-party imports
  import { renderContent, renderMermaidDiagrams } from '$lib/services/MarkdownRenderer.js';
  import { _, locale } from 'svelte-i18n';
  import { derived } from 'svelte/store';
  import { unixfs } from '@helia/unixfs';

  // Local imports
  import type { BlogPost, Comment, Category } from '$lib/types.js';
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
  let fs = $state<any>();
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
      fs = unixfs($helia as any);
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
    const activePostId = post?._id || $selectedPostId;
    if (!activePostId) return;
    
    try {
      const allComments = await $commentsDB.all();
      comments = allComments
        .map(entry => entry.value)
        .filter(comment => comment.postId === activePostId);
    } catch (_error) {
      error('Error loading comments:', _error);
    }
  }

  /**
   * Adds a new comment to the post
   */
  async function addComment(): Promise<void> {
    if (!newComment.trim() || !commentAuthor.trim() || !$commentsDB) return;
    const activePostId = post?._id || $selectedPostId;
    if (!activePostId) return;
    
    try {
      const _id = crypto.randomUUID();
      await $commentsDB.put({
        _id,
        postId: activePostId,
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

  $effect(() => {
    if (!$selectedPostId) return;

    let isDisposed = false;
    let commentsUpdateHandler: ((entry: any) => Promise<void>) | null = null;

    // Async operations should be wrapped in an IIFE
    (async () => {
      const postEntry = await $postsDB.get($selectedPostId);
      info('post', postEntry);
      if (!postEntry || isDisposed) return;

      const activePostId = postEntry.value?._id || postEntry.key || $selectedPostId;

      title = postEntry.value.title;
      content = postEntry.value.content;
      category = postEntry.value.category;
      selectedMedia = postEntry.value.mediaIds || [];
      info('post', postEntry);
      isEncrypted = postEntry.value.isEncrypted || isEncryptedPost({ title, content });
      info('isEncryptedPost function', isEncryptedPost({ title, content }));
      info('isEncrypted', isEncrypted);
      if (isEncrypted) {
        showPasswordPrompt = true;
      } else {
        // Update rendered content when not encrypted
        updateRenderedContent();
      }

      if ($commentsDB) {
        await loadComments();

        commentsUpdateHandler = async (entry) => {
          if (isDisposed) return;

          if (entry?.payload?.op === 'PUT') {
            const comment = entry.payload.value;
            if (comment?.postId === activePostId) {
              await loadComments();
            }
          } else if (entry?.payload?.op === 'DEL') {
            await loadComments();
          }
        };

        $commentsDB.events.on('update', commentsUpdateHandler);
      }
    })();

    return () => {
      isDisposed = true;
      if (commentsUpdateHandler && $commentsDB) {
        $commentsDB.events.removeListener('update', commentsUpdateHandler);
      }
    };
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
  :global(.accordion-wrapper) {
    margin: 1rem 0;
  }
  :global(.accordion) {
    border: 1px solid var(--border);
    border-radius: 6px;
    overflow: hidden;
  }
  :global(.accordion-header) {
    padding: 0.75rem 1rem;
    background-color: var(--bg-tertiary);
    cursor: pointer;
    font-weight: 600;
    font-size: 0.875rem;
    display: block;
    user-select: none;
    color: var(--text);
  }
  :global(.accordion-header:hover) {
    background-color: var(--bg-hover);
  }
  :global(.accordion-content) {
    padding: 1rem;
  }
  :global(.accordion-header::after) {
    content: '\25BC';
    float: right;
    transform: rotate(0);
    transition: transform 0.2s ease;
    font-size: 0.625rem;
    color: var(--text-muted);
  }
  :global(details[open] .accordion-header::after) {
    transform: rotate(180deg);
  }
  :global(.mermaid) {
    margin: 1rem 0;
    background-color: var(--bg-secondary);
    padding: 1rem;
    border-radius: 6px;
    border: 1px solid var(--border);
  }
</style>

<article data-testid="blog-post" class="p-6">
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
    <h1 data-testid="post-title" class="text-2xl font-semibold mb-2" style="color: var(--text);">{title}</h1>
    <div class="text-sm mb-4" style="color: var(--text-muted);">
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
        <div class="flex flex-wrap gap-1.5">
          {#each post.categories as categoryItem}
            <span class="badge">{categoryItem}</span>
          {/each}
        </div>
      {:else if post.category}
        <div class="mt-1">
          <span class="badge">{post.category}</span>
        </div>
      {/if}
    </div>
    
    <div data-testid="post-content" class="prose dark:prose-invert max-w-none mb-8">
      {@html renderedContent}
    </div>

    <div class="divider"></div>

    <section class="mt-6">
      <h3 class="text-sm font-semibold mb-4" style="color: var(--text);">{$_('comments')} ({comments.length})</h3>
      {#each comments as comment}
        <div class="mb-3 p-3 rounded-md" style="border: 1px solid var(--border-subtle); background-color: var(--bg-tertiary);">
          <div class="flex items-center mb-1.5">
            <strong class="text-sm" style="color: var(--text);">{comment.author}</strong>
            <span class="ml-2 text-xs" style="color: var(--text-muted);">
              {$reactiveDateFormatter(comment.createdAt)}
            </span>
          </div>
          <p class="text-sm" style="color: var(--text-secondary);">{comment.content}</p>
        </div>
      {/each}

      {#if postMedia.length > 0}
      <div class="mt-4 mb-6 p-4 rounded-md" style="border: 1px solid var(--border); background-color: var(--bg-tertiary);">
        <h3 class="text-sm font-medium mb-2" style="color: var(--text);">{$_('media')}</h3>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {#each postMedia as media}
            {#if media.type.startsWith('image/')}
              <a href={media.url || `https://ipfs.io/ipfs/${media.cid}`} target="_blank" rel="noopener noreferrer" 
                 ontouchend={(e) => {e.preventDefault(); window.open(media.url || `https://ipfs.io/ipfs/${media.cid}`, '_blank')}}
                 class="block overflow-hidden rounded-md">
                <img src={media.url || `https://ipfs.io/ipfs/${media.cid}`} alt={media.name}
                     class="w-full h-auto object-cover" />
              </a>
            {:else if media.type.startsWith('video/')}
              <video controls class="w-full rounded-md">
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
                 class="flex items-center p-3 rounded-md transition-colors"
                 style="background-color: var(--bg-tertiary); border: 1px solid var(--border);">
                <span class="truncate text-sm" style="color: var(--text-secondary);">{media.name} ({(media.size / 1024).toFixed(2)} KB)</span>
              </a>
            {/if}
          {/each}
        </div>
      </div>
    {/if}

      <form onsubmit={preventDefault(addComment)} class="mt-6">
        <div class="mb-3">
          <input
            type="text"
            bind:value={commentAuthor}
            placeholder={$_('your_name')}
            required
            class="input"
          />
        </div>
        <div class="mb-3">
          <textarea
            bind:value={newComment}
            placeholder={$_('write_a_comment')}
            required
            class="input"
            style="min-height: 80px;"
          ></textarea>
        </div>
        <button 
          type="submit"
          class="btn-primary"
        >
          {$_('add_comment')}
        </button>
      </form>
    </section>
  {/if}
</article>

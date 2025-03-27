<script lang="ts">
  import { run, preventDefault } from 'svelte/legacy';

  import { marked } from 'marked';
  import type { BlogPost, Comment } from '$lib/types';
  import { commentsDB, mediaDB, helia } from '$lib/store';
  import { unixfs } from '@helia/unixfs';
  import { onMount } from 'svelte';
  import { DateTime } from 'luxon';
  import DOMPurify from 'dompurify';

  interface Props {
    post: BlogPost;
  }

  let { post }: Props = $props();

  let newComment = $state('');
  let commentAuthor = $state('');
  let comments: Comment[] = $state([]);
  let postMedia = $state([]);
  let fs = $state();
  let mediaCache = new Map(); // Cache for IPFS content

  // Configure marked options
  marked.setOptions({
    gfm: true, // GitHub Flavored Markdown
    breaks: true, // Convert line breaks to <br>
    headerIds: true, // Add IDs to headers
    mangle: false, // Don't escape HTML
    sanitize: false // Allow HTML
  });

  // At the top of the script section, after imports
  const accordionExtension = {
    name: 'accordion',
    level: 'block',
    start(src) {
      return src.match(/^----\s*\n/)?.index;
    },
    tokenizer(src, tokens) {
      const rule = /^----\s*\n(#{1,6}\s*(.+?))\n([\s\S]*?)(?=\n----|\n$)/;
      const match = rule.exec(src);
      if (match) {
        const [raw, headerLine, title, content] = match;
        const token = {
          type: 'accordion',
          raw,
          headerLine,
          title: title.trim(),
          content: content.trim(),
          tokens: [],
          contentTokens: []
        };
        
        // Parse the header and content as markdown
        this.lexer.inline(headerLine.trim(), token.tokens);
        this.lexer.blockTokens(content.trim(), token.contentTokens);
        
        return token;
      }
    },
    renderer(token) {
      const accordionId = `accordion-${Math.random().toString(36).substr(2, 9)}`;
      return `
        <div class="accordion-wrapper">
          <details class="accordion" id="${accordionId}">
            <summary class="accordion-header">
              ${this.parser.parseInline(token.tokens)}
            </summary>
            <div class="accordion-content">
              ${this.parser.parse(token.contentTokens)}
            </div>
          </details>
        </div>`;
    },
    childTokens: ['tokens', 'contentTokens']
  };

  // Move renderer setup into a function
  function setupRenderer() {
    const renderer = new marked.Renderer();
    const defaultImageRenderer = renderer.image.bind(renderer);
    
    // First handle images
    renderer.image = (href, title, text) => {
      if (href.startsWith('ipfs://')) {
        const mediaId = href.replace('ipfs://', '');
        const media = mediaCache.get(mediaId);
        if (media) {
          return defaultImageRenderer(media, title, text);
        } else if (media) {
          return defaultImageRenderer(`https://dweb.link/ipfs/${media.cid}`, title, text);
        }
      }
      return defaultImageRenderer(href, title, text);
    };

    marked.use({ renderer, extensions: [accordionExtension] });
  }

  function initUnixFs() {
    if ($helia) {
      fs = unixfs($helia);
      return true;
    }
    return false;
  }

  async function getFileFromIPFS(cid) {
    console.log('getFileFromIPFS', cid);
    if (!fs && !initUnixFs()) {
      return null;
    }
    
    // Check cache first
    if (mediaCache.has(cid)) {
      return mediaCache.get(cid);
    }
    
    try {
      const chunks = [];
      for await (const chunk of fs.cat(cid)) {
        chunks.push(chunk);
      }
      
      const fileData = new Uint8Array(chunks.reduce((acc, val) => [...acc, ...val], []));
      const blob = new Blob([fileData]);
      const url = URL.createObjectURL(blob);
      
      // Store in cache
      mediaCache.set(cid, url);
      return url;
    } catch (error) {
      console.error(`Error fetching from IPFS (${cid}):`, error);
      // Fall back to gateway URL
      return `https://dweb.link/ipfs/${cid}`;
    }
  }

  // Load media URLs asynchronously
  async function loadMediaUrls() {
    console.log('loadMediaUrls', postMedia);
    for (const media of postMedia) {
      if (!media.url) {
        media.url = await getFileFromIPFS(media.cid) || `https://ipfs.io/ipfs/${media.cid}`;
      }
    }
    // Force reactivity update
    postMedia = [...postMedia];
  }
  // Load media for this post
  async function loadPostMedia() {
    console.log('loadPostMedia', post);
    if (!$mediaDB || !post.mediaIds) return;
    
    try {
      const allMedia = await $mediaDB.all();
      console.log('allMedia', allMedia);
      const mediaMap = allMedia.map(entry => entry.value);
      postMedia = post.mediaIds?.map(cid => {
        const media = mediaMap.find(m => m.cid === cid);
        if (media) {
          return { ...media, url: null }; // Add url property to store fetched content
        }
        return null;
      }).filter(Boolean) || [];
      
      initUnixFs();
      loadMediaUrls();
    } catch (error) {
      console.error('Error loading media:', error);
    }
  }

  async function loadComments() {
    console.log('loadComments', post);
    if (!$commentsDB) return;
    
    try {
      const allComments = await $commentsDB.all();
      comments = allComments
        .map(entry => entry.value)
        .filter(comment => comment.postId === post._id);
    } catch (error) {
      console.error('Error loading comments:', error);
    }
  }

  // Add a comment using the commentsDB
  async function addComment() {
    console.log('addComment', newComment, commentAuthor, $commentsDB);
    if (!newComment.trim() || !commentAuthor.trim() || !$commentsDB) return;
    console.log("commentsDB", $commentsDB);
    try {
      const _id = crypto.randomUUID();
      const comment = await $commentsDB.put({
        _id,
        postId: post._id,
        content: newComment,
        author: commentAuthor,
        createdAt: new Date().toISOString()
      });
      console.log('comment added', comment);
      newComment = '';
      commentAuthor = '';
      
      await loadComments();
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  }

  // Listen for database changes
  run(() => {
    if ($commentsDB) {
      loadComments();
      
      $commentsDB.events.on('update', async (entry) => {
        if (entry?.payload?.op === 'PUT') {
          const comment = entry.payload.value;
          // Only update our comments list if the comment belongs to this post
          if (comment.postId === post._id) {
            await loadComments();
          }
        } else if (entry?.payload?.op === 'DEL') {
          await loadComments();
        }
      });
    }
  });

  // React to Helia being available
  run(() => {
    if ($helia && !fs) {
      initUnixFs();
      if (postMedia.length > 0) {
        loadMediaUrls();
      }
    }
  });

  onMount(async () => {
    if ($mediaDB && post) {
      await loadPostMedia();
      setupRenderer();
    }
  });

  // Remove the reactive post statement since we handle initial load in onMount
  run(() => {
    if (post) {

        if ($mediaDB) {
          loadPostMedia().then(() => {
            setupRenderer();
          }); 
        }
    }
  });

  function renderContent(content: string): string {
    return DOMPurify.sanitize(marked(content), {
      ADD_TAGS: ['details', 'summary', 'div'],
      ADD_ATTR: ['id', 'class', 'aria-controls', 'aria-expanded', 'aria-labelledby', 'role'],
      ALLOW_DATA_ATTR: true
    });
  }

  let renderedContent = $derived(renderContent(post.content));

  function formatDate(dateString: string): string {
    if (!dateString) return '';
    return DateTime.fromISO(dateString).toLocaleString(DateTime.DATETIME_MED);
  }
</script>

<style>
  /* ... existing styles ... */

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
</style>

<article class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
  <h1 class="text-2xl font-bold mb-2 text-gray-900 dark:text-white">{post.title}</h1>
  <div class="flex space-x-4 text-sm text-gray-500 dark:text-gray-400 mb-4">
    <span title={post.identity || 'Unknown'}>
      By {post.identity ? `...${post.identity.slice(-5)}` : 'Unknown'}
    </span>
    <span>{formatDate(post.createdAt)}</span>
    {#if post.updatedAt && post.updatedAt !== post.createdAt}
      <span>(Updated: {formatDate(post.updatedAt)})</span>
    {/if}
    <span class="px-2 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 rounded-full">
      {post.category}
    </span>
  </div>
  
 
  
  <div class="prose dark:prose-invert max-w-none mb-6">
    {@html renderedContent}
  </div>

  <section class="mt-8">
    <h3 class="text-xl font-bold mb-4 text-gray-900 dark:text-white">Comments ({comments.length})</h3>
    {#each comments as comment}
      <div class="mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <div class="flex items-center mb-2">
          <strong class="text-gray-900 dark:text-white">{comment.author}</strong>
          <span class="ml-2 text-sm text-gray-500 dark:text-gray-400">
            {DateTime.fromISO(comment.createdAt).toLocaleString(DateTime.DATETIME_MED)}
          </span>
        </div>
        <p class="text-gray-700 dark:text-gray-300">{comment.content}</p>
      </div>
    {/each}

     <!-- Display attached media gallery if there are media items -->
  {#if postMedia.length > 0}
  <div class="mt-4 mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
    <h3 class="text-lg font-medium mb-2 text-gray-900 dark:text-white">Media</h3>
    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {#each postMedia as media}
        {#if media.type.startsWith('image/')}
          <a href={media.url || `https://ipfs.io/ipfs/${media.cid}`} target="_blank" rel="noopener noreferrer" 
             class="block overflow-hidden rounded-lg">
            <img src={media.url || `https://ipfs.io/ipfs/${media.cid}`} alt={media.name}
                 class="w-full h-auto object-cover" />
          </a>
        {:else if media.type.startsWith('video/')}
          <video controls class="w-full rounded-lg">
            <source src={media.url || `https://ipfs.io/ipfs/${media.cid}`} type={media.type}>
            Your browser does not support the video tag.
          </video>
        {:else if media.type.startsWith('audio/')}
          <audio controls class="w-full">
            <source src={media.url || `https://ipfs.io/ipfs/${media.cid}`} type={media.type}>
            Your browser does not support the audio tag.
          </audio>
        {:else}
          <a href={media.url || `https://ipfs.io/ipfs/${media.cid}`} 
             target="_blank" rel="noopener noreferrer" 
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
          placeholder="Your name"
          required
          class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
      </div>
      <div class="mb-4">
        <textarea
          bind:value={newComment}
          placeholder="Write a comment..."
          required
          class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-h-[100px]"
        ></textarea>
      </div>
      <button 
        type="submit"
        class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition"
      >
        Add Comment
      </button>
    </form>
  </section>
</article>
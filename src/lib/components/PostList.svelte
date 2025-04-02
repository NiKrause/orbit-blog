<script lang="ts">
  import { run } from 'svelte/legacy';
  import { _, locale } from 'svelte-i18n';

  import { posts, selectedPostId, identity, postsDB, aiApiKey, aiApiUrl, enabledLanguages, isRTL } from '$lib/store.js';
  import { formatDate, formatTimestamp } from '$lib/dateUtils.js';

  import { marked } from 'marked';
  import DOMPurify from 'dompurify';
  import type { Post, Category } from '$lib/types.js';
  import { onMount } from 'svelte';
  import { categories } from '$lib/store.js';
  import BlogPost from './BlogPost.svelte';
  import MediaUploader from './MediaUploader.svelte';
  import { TranslationService } from '$lib/services/translationService.js';
  
  // Import html2pdf for PDF generation
  import html2pdf from 'html2pdf.js';

  import LanguageStatusLED from './LanguageStatusLED.svelte';
  import { encryptPost } from '$lib/cryptoUtils.js';
  import PostPasswordPrompt from './PostPasswordPrompt.svelte';

  let searchQuery = $state('');
  let selectedCategory: Category | 'All' = $state('All');
  // let selectedPostId: string | null = null;
  let hoveredPostId = $state<string | null>(null); // Track the ID of the hovered post
  let editMode = $state(false); // Track if we're in edit mode
  let editedTitle = $state('');
  let editedContent = $state('');
  let editedCategory: Category = $state();
  let editedUpdatedAt = $state('');
  let editedCreatedAt = $state('');
  let showHistory = $state(false);
  let postHistory = $state<Post[]>([]);
  let showMediaUploader = $state(false);
  let selectedMedia = $state<string[]>([]);
  let showDeleteConfirm = $state(false);
  let postToDelete = $state<Post | null>(null);

  let searchTerm = $state('');
  let displayedPosts = $state([]);

  // Add these state variables with the other state declarations at the top
  let isTranslating = $state(false);
  let translationError = $state('');

  let translationStatuses = $state<Record<string, 'success' | 'error' | 'default'>>({});

  let showPreview = $state(false);

  // Add these state variables at the top with other state declarations
  let isEncrypting = $state(false);
  let showPasswordPrompt = $state(false);
  let encryptionPassword = $state('');
  let encryptionError = $state('');

  // Combined filtering function
  function filterPosts() {
    const currentLanguage = $locale;
    
    // First check if there are any posts in the current language
    const hasPostsInCurrentLanguage = $posts.some(post => post.language === currentLanguage);
    return $posts
      .filter(post => {
        // Language filter
        const matchesLanguage = hasPostsInCurrentLanguage 
          ? post.language === currentLanguage
          : post.language === undefined && post.translatedFrom === undefined;
        // Category filter
        const matchesCategory = selectedCategory === 'All' || selectedCategory === undefined || 
                              post.category === selectedCategory;

        // Search term filter
        const matchesSearch = !searchTerm || 
                            post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            post.content.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesLanguage && matchesCategory && matchesSearch;
      })
      .sort((a, b) => (b.createdAt || b.date) - (a.createdAt || a.date));
  }

  // Update displayed posts when any filter changes
  // $effect(() => {
  //   // displayedPosts = filterPosts();
  // });

  // Watch for changes in posts, locale, selectedCategory, and searchTerm
  $effect(() => {
    const _ = [$posts, $locale, selectedCategory, searchTerm];
    displayedPosts = filterPosts();
  });

  let selectedPost = $derived($selectedPostId ? displayedPosts.find(post => post._id === $selectedPostId) : null);
  $effect(() => {
    console.log('selectedPost', selectedPost);
  });

  onMount(() => {
    console.log('PostList component mounted');
    if (displayedPosts.length > 0 && !$selectedPostId) {
      $selectedPostId = displayedPosts[0]._id;
    }
  });

  run(() => {
    if (displayedPosts.length > 0 && (!$selectedPostId || !displayedPosts.find(post => post._id === $selectedPostId))) {
      $selectedPostId = displayedPosts[0]._id;
    }
  });

  function renderMarkdown(content: string): string {
    // Process the markdown
    const contentWithBreaks = content.replace(/\n(?!\n)/g, '  \n');
    const rawHtml = marked(contentWithBreaks);
    return DOMPurify.sanitize(rawHtml);
  }

  function selectPost(postId: string) {
    $selectedPostId = postId;
    editMode = false; // Exit edit mode when selecting a different post
    // Additional logic for when a post is selected
  }

  function editPost(post: Post, event: MouseEvent) {
    event.stopPropagation();
    editedTitle = post.title;
    editedContent = post.content;
    editedCategory = post.category;
    editedUpdatedAt = new Date(post.updatedAt).toISOString().slice(0, 16);
    editedCreatedAt = new Date(post.createdAt).toISOString().slice(0, 16);
    selectedMedia = post.mediaIds || [];
    editMode = true;
  }

  async function saveEditedPost() {
    if (selectedPost && editedTitle && editedContent) {
      try {
        let updatedPost = {
          _id: selectedPost._id,
          title: editedTitle,
          content: editedContent,
          language: $locale,
          category: editedCategory,
          createdAt: new Date(editedCreatedAt).getTime(),
          updatedAt: new Date(editedUpdatedAt).getTime(),
          identity: $identity.id,
          mediaIds: selectedMedia
        };

        // If post is being encrypted or was previously encrypted
        if (isEncrypting || selectedPost.isEncrypted) {
          const encryptedData = await encryptPost(
            { title: editedTitle, content: editedContent }, 
            encryptionPassword
          );
          updatedPost = {
            ...updatedPost,
            title: encryptedData.encryptedTitle,
            content: encryptedData.encryptedContent,
            isEncrypted: true
          };
        }

        await $postsDB.put(updatedPost);
        console.info('Post updated successfully', updatedPost);
        editMode = false;
        isEncrypting = false;
        encryptionPassword = '';
        $selectedPostId = updatedPost._id;
      } catch (error) {
        console.error('Error updating post:', error);
      }
    }
  }

  async function deletePost(post: Post, event: MouseEvent) {
    event.stopPropagation();
    postToDelete = post;
    showDeleteConfirm = true;
  }

  async function confirmDelete() {
    if (!postToDelete) return;
    
    try {
      // First get all translations of this post by matching title/content across languages
      const allPosts = $posts;
      const relatedPosts = allPosts.filter(p => 
        // If this is a translated post, find all posts with same translatedFrom
        (postToDelete.translatedFrom && p.translatedFrom === postToDelete.translatedFrom) ||
        // If this is an original post, find all posts that were translated from it
        (p.translatedFrom === postToDelete._id)
      );
      
      // Add the original post to the deletion list if not already included
      if (!relatedPosts.includes(postToDelete)) {
        relatedPosts.push(postToDelete);
      }

      // Delete all related posts
      for (const post of relatedPosts) {
        await $postsDB.del(post._id);
      }

      console.info('Posts deleted successfully');
      if ($selectedPostId === postToDelete._id && displayedPosts.length > 1) {
        $selectedPostId = displayedPosts[0]._id;
      }
      showDeleteConfirm = false;
      postToDelete = null;
    } catch (error) {
      console.error('Error deleting posts:', error);
    }
  }

  function truncateTitle(title: string, maxLength: number): string {
    return title.length > maxLength ? title.slice(0, maxLength) + '...' : title;
  }

  async function viewPostHistory(post: Post, event: MouseEvent) {
    event.stopPropagation();
    showHistory = true;
    
    // Get all operations for this post
    const history = [];
    for await (const entry of $postsDB.log.iterator({ reverse: true })) {
      if (entry?.payload?.value?._id === post._id) {
        history.push({
          ...entry.payload.value,
          timestamp: entry.payload.value.updatedAt 
        });
      }
    }
    postHistory = history;
  }

  function restoreVersion(historicalPost: Post) {
    editedTitle = historicalPost.title;
    editedContent = historicalPost.content;
    editedCategory = historicalPost.category;
    editMode = true;
    showHistory = false;
  }

  function handleMediaSelected(mediaCid: string) {
    if (!selectedMedia.includes(mediaCid)) {
      selectedMedia = [...selectedMedia, mediaCid];
      editedContent += `\n\n![Media](ipfs://${mediaCid})`;
    }
    showMediaUploader = false;
  }

  function removeSelectedMedia(mediaId: string) {
    selectedMedia = selectedMedia.filter(id => id !== mediaId);
    editedContent = editedContent.replace(`\n\n![Media](ipfs://${mediaId})`, '');
  }

  // Function to export the selected post as PDF
  function exportToPdf() {
    if (!selectedPost) return;
    
    // Create a temporary div to render the post content
    const element = document.createElement('div');
    element.className = 'pdf-export';
    
    element.innerHTML = `
      <style>
        .pdf-export {
          font-family: 'Arial', sans-serif;
          padding: 20px;
          max-width: 800px;
          margin: 0 auto;
        }
        h1 {
          font-size: 22px;
          margin-bottom: 16px;
          color: #333;
        }
        .meta {
          font-size: 12px;
          color: #666;
          margin-bottom: 20px;
          text-align: right;
        }
        .content {
          font-size: 14px;
          line-height: 1.5;
        }
        .content p {
          margin-bottom: 1em;
        }
        .content br {
          display: block;
          content: "";
          margin-top: 0.5em;
        }
        /* Fix for bullet points */
        .content ul {
          list-style-type: disc;
          padding-left: 2em;
          margin-bottom: 1em;
        }
        .content ol {
          list-style-type: decimal;
          padding-left: 2em;
          margin-bottom: 1em;
        }
        .content li {
          margin-bottom: 0.5em;
          display: list-item;
          vertical-align: middle;
          line-height: 1.4;
        }
        /* Fix bullet alignment */
        .content ul li::before,
        .content ol li::before {
          vertical-align: middle;
        }
        img {
          max-width: 100%;
          height: auto;
        }
        .category {
          display: inline-block;
          padding: 3px 8px;
          background: #f0f0f0;
          border-radius: 12px;
          font-size: 12px;
          margin-right: 10px;
        }
      </style>
      <h1>${selectedPost.title}</h1>
      <div class="meta">
        <span>${formatTimestamp(selectedPost.createdAt)}</span>
        ${selectedPost.updatedAt && selectedPost.updatedAt !== selectedPost.createdAt 
          ? `<span>(Updated: ${formatTimestamp(selectedPost.updatedAt)})</span>` 
          : ''}
      </div>
      <div class="content">
        ${renderMarkdown(selectedPost.content)}
      </div>
    `;
    
    // Append temporarily to the document to ensure images load
    document.body.appendChild(element);
    
    // Configure the PDF options
    const options = {
      margin: [10, 10, 10, 10],
      filename: `${selectedPost.title.replace(/[^a-z0-9]/gi, '_')}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    
    // Generate the PDF
    html2pdf().from(element).set(options).save()
      .then(() => {
        // Remove the temporary element after PDF generation
        document.body.removeChild(element);
      });
  }

  async function exportToLatex() {
    if (!selectedPost) return;
    
    // Basic LaTeX document structure
    const latexContent = `\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage{graphicx}
\\title{${selectedPost.title.replace(/[&$%#_{}]/g, '\\$&')}}
\\author{${selectedPost.identity ? `...${selectedPost.identity.slice(-5)}` : 'Unknown'}}
\\date{${formatTimestamp(selectedPost.createdAt)}${
  selectedPost.updatedAt && selectedPost.updatedAt !== selectedPost.createdAt 
    ? `\\\\Updated: ${formatTimestamp(selectedPost.updatedAt)}` 
    : ''
}}

\\begin{document}
\\maketitle

${convertMarkdownToLatex(selectedPost.content)}

\\end{document}`;

    // Create and download the .tex file
    const blob = new Blob([latexContent], { type: 'application/x-tex' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedPost.title.replace(/[^a-z0-9]/gi, '_')}.tex`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function convertMarkdownToLatex(markdown: string): string {
    // This is a very basic conversion - you'd want to use a proper parser
    return markdown
      .replace(/#{1,6} (.+)/g, (_, title) => `\\section{${title}}`) // Headers
      .replace(/\*\*(.+?)\*\*/g, '\\textbf{$1}') // Bold
      .replace(/\*(.+?)\*/g, '\\textit{$1}') // Italic
      .replace(/!\[(.+?)\]\((.+?)\)/g, '\\includegraphics{$2}') // Images
      .replace(/[&$%#_{}]/g, '\\$&'); // Escape special characters
  }

  // Add a function to check write permissions
  function hasWriteAccess(): boolean {
    if (!$postsDB || !$identity) return false;
    return $postsDB.access.write.includes($identity.id) || $postsDB.access.write.includes("*");
  }

  // Modify the handleTranslate function similarly to the PostForm version
  async function handleTranslate() {
    isTranslating = true;
    translationError = '';
    translationStatuses = Object.fromEntries([...$enabledLanguages].map(lang => [lang, 'default']));

    try {
      const post = {
        title: editedTitle,
        content: editedContent,
        category: editedCategory,
        language: $locale
      };

      const result = await TranslationService.translateAndSavePost({
        post,
        postsDB: $postsDB,
        identity: $identity,
        mediaIds: selectedMedia,
        timestamps: {
          createdAt: new Date(editedCreatedAt).getTime(),
          updatedAt: new Date(editedUpdatedAt).getTime()
        }
      });

      if (result.success) {
        translationStatuses = result.translationStatuses;
        editMode = false;
      } else {
        translationError = result.error;
        translationStatuses = result.translationStatuses;
      }
    } catch (error) {
      translationError = $_('translation_failed');
    } finally {
      isTranslating = false;
    }
  }

  // Add this function to handle encryption request
  async function handleEncrypt() {
    if (!editedTitle || !editedContent) {
      encryptionError = $_('fill_required_fields');
      return;
    }
    showPasswordPrompt = true;
  }


  async function postDecrypted(event: CustomEvent) {
    try {
      const decryptedData = event.detail.post;
      editedTitle = decryptedData.title;
      editedContent = decryptedData.content;
      showPasswordPrompt = false;
      encryptionError = '';
      
      // Update both selectedPost and the post in displayedPosts
      const decryptedPost = {
        ...selectedPost,
        title: decryptedData.title,
        content: decryptedData.content
      };
      selectedPost = decryptedPost;
      
      // Update the post in displayedPosts array
      const postIndex = displayedPosts.findIndex(p => p._id === selectedPost._id);
      if (postIndex !== -1) {
        displayedPosts[postIndex] = decryptedPost;
        displayedPosts = [...displayedPosts]; // Trigger reactivity
      }
      
      editMode = false;
    } catch (error) {
      encryptionError = $_('invalid_password');
    }
  }

</script>

<div class="space-y-4 {$isRTL ? 'rtl' : 'ltr'}">
  <div class="flex space-x-4 mb-6">
    <input
      type="text"
      placeholder={$_('search_posts')}
      bind:value={searchQuery}
      class="flex-1 rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
    />
    <label for="edit-category" class="block text-sm font-medium text-gray-700 dark:text-gray-300">{$_('category')}</label>
    <select
      id="edit-category"
      bind:value={selectedCategory}
      class="rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
    >
      <option value="All">{$_('all')}</option>
      {#each [...$categories].sort((a, b) => b.localeCompare(a)) as cat}
        <option value={cat}>{cat}</option>
      {/each}
    </select> 
  </div>

  <div class="grid grid-cols-12 gap-6 responsive-grid">
    <!-- Post List -->
    <div class="col-span-4 bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 h-fit">
      <h2 class="text-xl font-semibold mb-4 text-gray-900 dark:text-white">{$_('blog_posts')}</h2>
      <div class="space-y-2">
        {#each displayedPosts as post (post._id)}
          <div class="post-item w-full text-left p-3 rounded-md transition-colors cursor-pointer bg-white dark:bg-gray-800"
            onclick={() => selectPost(post._id)}
            onmouseover={() => hoveredPostId = post._id}
            onmouseout={() => hoveredPostId = null}
            ontouchstart={(e) => { e.preventDefault(); }}
            ontouchend={(e) => { e.preventDefault(); }}
            role="button"
            tabindex="0"
            onkeydown={(e) => e.key === 'Enter' && selectPost(post._id)}
            class:active={hoveredPostId === post._id}
            data-post-id={post._id}
          >
            <div class="post-content">
              <!-- Only show buttons if user has write access -->
              {#if hasWriteAccess()}
                <div class="flex justify-end space-x-2 action-buttons {hoveredPostId === post._id ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300 ease-in-out">
                  <button
                    type="button"
                    class="p-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 touch-manipulation"
                    onclick={(e) => {e.stopPropagation(); editPost(post, e)}}
                    ontouchend={(e) => {e.stopPropagation(); editPost(post, e)}}
                    title={$_('edit_post')}
                    aria-label={$_('edit_post')}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                  </button>
                  <button
                    class="p-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                    onclick={(e) => deletePost(post, e)}
                    title={$_('delete_post')}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                    </svg>
                  </button>
                  <button
                    class="p-1 text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
                    onclick={(e) => viewPostHistory(post, e)}
                    title={$_('view_history')}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"/>
                    </svg>
                  </button>
                </div>
              {/if}
              <div class="flex justify-between items-start">
                <div class="flex-1">
                  <h3 class="font-medium text-gray-900 dark:text-white overflow-hidden whitespace-nowrap" title={post.title}>
                    {truncateTitle(post.title, 40)}
                  </h3>
                  <div class="flex justify-between text-sm text-gray-500 dark:text-gray-400 mt-1">
                    <span>
                      {formatTimestamp(post.createdAt || post.date)}
                    </span>
                    <span class="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 rounded-full text-xs">
                      {post.category}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>

    <!-- Selected Post Content -->
    <div class="col-span-8">
      {#if selectedPost}
        {#if editMode}
          <!-- Edit Form -->
          <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold mb-4 text-gray-900 dark:text-white">{$_('edit_post')}</h2>
            
            <div class="space-y-4">
              <div>
                <label for="edit-title" class="block text-sm font-medium text-gray-700 dark:text-gray-300">{$_('title')}</label>
                <input
                  id="edit-title"
                  type="text"
                  bind:value={editedTitle}
                  class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label for="edit-category" class="block text-sm font-medium text-gray-700 dark:text-gray-300">{$_('category')}</label>
                <select
                  id="edit-category"
                  bind:value={editedCategory}
                  class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                >
                  <option value="All">{$_('all')}</option>
                  {#each [...$categories].sort((a, b) => b.localeCompare(a)) as cat}
                    <option value={cat}>{cat}</option>
                  {/each}
                </select>
              </div>

              <div>
                <label for="edit-updated-at" class="block text-sm font-medium text-gray-700 dark:text-gray-300">{$_('last_updated')}</label>
                <input
                  id="edit-updated-at"
                  type="datetime-local"
                  bind:value={editedUpdatedAt}
                  class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label for="edit-created-at" class="block text-sm font-medium text-gray-700 dark:text-gray-300">{$_('created_at')}</label>
                <input
                  id="edit-created-at"
                  type="datetime-local"
                  bind:value={editedCreatedAt}
                  class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>

              <div>
                <div class="flex justify-between items-center mb-2">
                  <label for="edit-content" class="block text-sm font-medium text-gray-700 dark:text-gray-300">{$_('content')}</label>
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
                    {@html renderMarkdown(editedContent || `*${$_('preview_will_appear_here')}...*`)}
                  </div>
                {:else}
                  <textarea
                    id="edit-content"
                    bind:value={editedContent}
                    rows="10"
                    class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    required
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

              <div class="flex space-x-4 justify-end">
                <button
                  type="button"
                  onclick={() => editMode = false}
                  class="bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-100 py-2 px-4 rounded-md hover:bg-gray-400 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors"
                >
                  {$_('cancel')}
                </button>
                <button
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
                </button>
                <button
                  type="button"
                  onclick={handleEncrypt}
                  class="inline-flex items-center gap-2 bg-indigo-600 dark:bg-indigo-500 text-white py-2 px-4 rounded-md hover:bg-indigo-700 dark:hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors"
                >
                  {#if isEncrypting || selectedPost.isEncrypted}
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd" />
                    </svg>
                    {$_('post_will_be_encrypted')}
                  {:else}
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clip-rule="evenodd" />
                    </svg>
                    {$_('encrypt_post')}
                  {/if}
                </button>
                <button
                  type="button"
                  onclick={saveEditedPost}
                  class="bg-indigo-600 dark:bg-indigo-500 text-white py-2 px-4 rounded-md hover:bg-indigo-700 dark:hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors"
                >
                  {$_('save_changes')}
                </button>
              </div>
            </div>
          </div>
        {:else}
          <!-- View Mode -->
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md">
            <!-- Replace Export Buttons with small icons -->
            <div class="flex justify-end p-2 space-x-2">
              <button
                type="button"
                onclick={exportToPdf}
                class="text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 p-1"
                title={$_('export_as_pdf')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                  <path d="M14 11a1 1 0 01-1 1H7a1 1 0 110-2h6a1 1 0 011 1z" />
                </svg>
              </button>
              <button
                type="button"
                onclick={exportToLatex}
                class="text-gray-600 hover:text-green-600 dark:text-gray-400 dark:hover:text-green-400 p-1"
                title={$_('export_as_latex')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                  <path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd" />
                </svg>
              </button>
            </div>
            <BlogPost post={selectedPost} />
          </div>
        {/if}
      {:else}
        <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md text-center text-gray-500 dark:text-gray-400">
          <p>{$_('select_post_to_view')}</p>
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- Add this modal for showing history -->
{#if showHistory}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
      <h3 class="text-xl font-bold mb-4">{$_('post_history')}</h3>
      <div class="space-y-4">
        {#each postHistory as version}
          <div class="border dark:border-gray-700 p-4 rounded">
            <div class="flex justify-between mb-2">
              <span class="text-sm text-gray-500">{formatTimestamp(version.createdAt)}</span>
              <button
                class="text-blue-600 hover:text-blue-800"
                onclick={() => restoreVersion(version)}
              >
                {$_('restore_this_version')}
              </button>
            </div>
            <h4 class="font-bold">{version.title}</h4>
            <div class="relative">
              <p class="text-sm text-gray-600 dark:text-gray-400 cursor-help">{version.content ? version.content.substring(0, version.content.length > 100 ? 100 : version.content.length) : $_('no_content')}...</p>
              {#if version.content && version.content.length > 100}
                <div class="content-tooltip">
                  <div class="tooltip-content">
                    {version.content}
                  </div>
                </div>
              {/if}
            </div>
          </div>
        {/each}
      </div>
      <button
        class="mt-4 bg-gray-200 dark:bg-gray-700 px-4 py-2 rounded"
        onclick={() => showHistory = false}
      >
        {$_('close')}
      </button>
    </div>
  </div>
{/if}

<!-- Add this modal for confirming deletion -->
{#if showDeleteConfirm}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full">
      <h3 class="text-xl font-bold mb-4 text-gray-900 dark:text-white">{$_('confirm_delete')}</h3>
      <p class="text-gray-600 dark:text-gray-300 mb-6">
        {$_('delete_post_confirm')} "{postToDelete?.title}"? {$_('this_will_delete_all_translations')}
      </p>
      <div class="flex justify-end space-x-4">
        <button
          class="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          onclick={() => {
            showDeleteConfirm = false;
            postToDelete = null;
          }}
        >
          {$_('cancel')}
        </button>
        <button
          class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          onclick={confirmDelete}
        >
          {$_('delete')}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if showPasswordPrompt}
  <PostPasswordPrompt
    mode={isEncrypting ? 'encrypt' : 'decrypt'}
    on:cancel={() => showPasswordPrompt = false}
    post={{
      title: editedTitle,
      content: editedContent
    }}

    on:postDecrypted={postDecrypted}
  />
{/if} 
<style>

  h3 {
    max-width: 100%; 
  }

  /* Add transition styles for opacity */
  .transition-opacity {
    transition: opacity 0.3s ease-in-out;
  }


  @media (max-width: 768px) {
    .responsive-grid {
      grid-template-columns: 1fr; /* Stack the columns on smaller screens */
    }
  }

  /* Tooltip styles */
  .relative {
    position: relative;
  }
  
  .content-tooltip .tooltip-content {
    visibility: hidden;
    position: absolute;
    z-index: 100;
    width: 300px;
    max-height: 200px;
    overflow-y: auto;
    bottom: 125%;
    left: 50%;
    transform: translateX(-50%);
    background-color: #fff;
    color: #333;
    padding: 0.75rem;
    border-radius: 0.5rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    opacity: 0;
    transition: opacity 0.3s, visibility 0.3s;
  }
  
  /* Dark mode support */
  @media (prefers-color-scheme: dark) {
    .content-tooltip .tooltip-content {
      background-color: #374151;
      color: #e5e7eb;
    }
  }
  
  /* Show tooltip on hover */
  .relative:hover .content-tooltip .tooltip-content {
    visibility: visible;
    opacity: 1;
  }

  .post-item {
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
    user-select: none;
    position: relative;
    margin-bottom: 0.5rem;
    border: 1px solid transparent;
  }

  /* Active state for touch feedback */
  .post-item.active {
    background-color: rgba(0, 0, 0, 0.05);
  }

  /* Dark mode active state */
  :global(.dark) .post-item.active {
    background-color: rgba(255, 255, 255, 0.05);
  }

  .post-item:hover {
    border-color: #e5e7eb;
  }

  /* Improve touch target size for buttons */
  .action-buttons button {
    min-width: 44px;
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Add specific mobile styles */
  @media (max-width: 768px) {
    .post-item {
      padding: 12px; /* Larger touch target */
    }

    .action-buttons {
      opacity: 1 !important; /* Always show buttons on mobile */
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
    }
  }

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

  :global([dir="rtl"]) .text-left {
    text-align: right;
  }

  :global([dir="rtl"]) .ml-1 {
    margin-right: 0.25rem;
    margin-left: 0;
  }

  :global([dir="rtl"]) .mr-1 {
    margin-left: 0.25rem;
    margin-right: 0;
  }

</style>

<script lang="ts">
  import { run } from 'svelte/legacy';

  import { posts, selectedPostId, identity, postsDB } from '$lib/store';
  import { DateTime } from 'luxon';
  import { formatDate, formatTimestamp } from '$lib/dateUtils';

  import { marked } from 'marked';
  import DOMPurify from 'dompurify';
  import type { Post, Category } from '$lib/types';
  import { onMount } from 'svelte';
  import { categories } from '$lib/store';
  import BlogPost from './BlogPost.svelte';
  import MediaUploader from './MediaUploader.svelte';
  // Import html2pdf for PDF generation
  import html2pdf from 'html2pdf.js';

  let searchQuery = $state('');
  let selectedCategory: Category | 'All' = $state('All');
  // let selectedPostId: string | null = null;
  let hoveredPostId = $state(null); // Track the ID of the hovered post
  let editMode = $state(false); // Track if we're in edit mode
  let editedTitle = $state('');
  let editedContent = $state('');
  let editedCategory: Category = $state();
  let showHistory = $state(false);
  let postHistory = $state([]);
  let showMediaUploader = $state(false);
  let selectedMedia = $state([]);

  let filteredPosts = $derived($posts
    .filter(post => {
      const matchesSearch = post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         post.content.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || post.category === selectedCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())); // Sort by date, newest first

  let selectedPost = $derived($selectedPostId ? filteredPosts.find(post => post._id === $selectedPostId) : null);

  onMount(() => {
    if (filteredPosts.length > 0 && !$selectedPostId) {
      $selectedPostId = filteredPosts[0]._id; // Select the first (latest) post
    }
  });

  run(() => {
    if (filteredPosts.length > 0 && (!$selectedPostId || !filteredPosts.find(post => post._id === $selectedPostId))) {
      $selectedPostId = filteredPosts[0]._id;
    }
  });

  function renderMarkdown(content: string): string {
    // Convert single newlines to <br> tags before rendering markdown
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
    selectedMedia = post.mediaIds || []; // Initialize with existing media
    editMode = true;
  }

  async function saveEditedPost() {
    if (selectedPost && editedTitle && editedContent) {
      try {
        const updatedPost = {
          ...selectedPost,
          title: editedTitle,
          content: editedContent,
          category: editedCategory,
          updatedAt: new Date().toISOString(),
          identity: $identity.id,
          mediaIds: selectedMedia
        };
        await $postsDB.del(selectedPost._id);
        await $postsDB.put(updatedPost);
        // Update the posts store with the new data
        // console.log('updatedPost', updatedPost);
        // $posts = $posts.map(post => 
        //   post._id === selectedPost._id ? updatedPost : post
        // );
        console.info('Post updated successfully', updatedPost);
        editMode = false;
        $selectedPostId = updatedPost._id;
      } catch (error) {
        console.error('Error updating post:', error);
      }
    }
  }

  async function deletePost(post: Post, event: MouseEvent) {
    console.log('Deleting post:', post);
    event.stopPropagation(); 
    try {
      const postId = post._id;
      await $postsDB.del(postId);
      console.info('Post deleted successfully');
      if ($selectedPostId === postId && filteredPosts.length > 1) {
        $selectedPostId = filteredPosts[0]._id;
      }
    } catch (error) {
      console.error('Error deleting post:', error);
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
          timestamp: entry.payload.value.date 
            ? DateTime.fromISO(entry.payload.value.date).toLocaleString(DateTime.DATETIME_MED)
            : 'No date available'
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
    
    // Add some basic styling for the PDF
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
        <span>${formatDate(selectedPost.date)}</span>
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
\\date{${formatDate(selectedPost.date)}}

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
</script>

<div class="space-y-6">
  <div class="flex space-x-4 mb-6">
    <input
      type="text"
      placeholder="Search posts..."
      bind:value={searchQuery}
      class="flex-1 rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
    />
    <label for="edit-category" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
    <select
      id="edit-category"
      bind:value={selectedCategory}
      class="rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
    >
      <option value="All">All</option>
      {#each [...$categories].sort((a, b) => b.localeCompare(a)) as cat}
        <option value={cat}>{cat}</option>
      {/each}
    </select> 
  </div>

  <div class="grid grid-cols-12 gap-6 responsive-grid">
    <!-- Post List -->
    <div class="col-span-4 bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 h-fit">
      <h2 class="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Blog Posts</h2>
      <div class="space-y-2">
        {#each filteredPosts as post, index (post._id || post.title + index)}
          <div
            class="w-full text-left p-3 rounded-md transition-colors cursor-pointer"
            onmouseover={() => hoveredPostId = post._id}
            onmouseout={() => hoveredPostId = null}
            onclick={() => selectPost(post._id)}
          >
            <!-- Only show buttons if user has write access -->
            {#if hasWriteAccess()}
              <div class="flex justify-end space-x-2 {hoveredPostId === post._id ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300 ease-in-out">
                <button
                  class="p-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                  onclick={(e) => editPost(post, e)}
                  title="Edit post"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                </button>
                <button
                  class="p-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                  onclick={(e) => deletePost(post, e)}
                  title="Delete post"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                  </svg>
                </button>
                <button
                  class="p-1 text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
                  onclick={(e) => viewPostHistory(post, e)}
                  title="View history"
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
                  <span>{formatDate(post.date)}</span>
                  <span class="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 rounded-full text-xs">
                    {post.category}
                  </span>
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
            <h2 class="text-2xl font-bold mb-4 text-gray-900 dark:text-white">Edit Post</h2>
            
            <div class="space-y-4">
              <div>
                <label for="edit-title" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
                <input
                  id="edit-title"
                  type="text"
                  bind:value={editedTitle}
                  class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label for="edit-category" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
                <select
                  id="edit-category"
                  bind:value={editedCategory}
                  class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                >
                  <option value="All">All</option>
                  {#each [...$categories].sort((a, b) => b.localeCompare(a)) as cat}
                    <option value={cat}>{cat}</option>
                  {/each}
                </select>
              </div>

              <div>
                <div class="flex justify-between items-center mb-2">
                  <label for="edit-content" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Content (Markdown)</label>
                  <button
                    type="button"
                    onclick={() => showMediaUploader = !showMediaUploader}
                    class="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300"
                  >
                    {showMediaUploader ? 'Hide Media Library' : 'Add Media'}
                  </button>
                </div>

                {#if showMediaUploader}
                  <MediaUploader onMediaSelected={handleMediaSelected} />
                {/if}

                <textarea
                  id="edit-content"
                  bind:value={editedContent}
                  rows="10"
                  class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  required
                ></textarea>
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
                  Cancel
                </button>
                <button
                  type="button"
                  onclick={saveEditedPost}
                  class="bg-indigo-600 dark:bg-indigo-500 text-white py-2 px-4 rounded-md hover:bg-indigo-700 dark:hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors"
                >
                  Save Changes
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
                title="Export as PDF"
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
                title="Export as LaTeX"
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
          <p>Select a post to view its content</p>
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- Add this modal for showing history -->
{#if showHistory}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
      <h3 class="text-xl font-bold mb-4">Post History</h3>
      <div class="space-y-4">
        {#each postHistory as version}
          <div class="border dark:border-gray-700 p-4 rounded">
            <div class="flex justify-between mb-2">
              <span class="text-sm text-gray-500">{formatDate(version.date)}</span>
              <button
                class="text-blue-600 hover:text-blue-800"
                onclick={() => restoreVersion(version)}
              >
                Restore this version
              </button>
            </div>
            <h4 class="font-bold">{version.title}</h4>
            <div class="relative">
              <p class="text-sm text-gray-600 dark:text-gray-400 cursor-help">{version.content ? version.content.substring(0, version.content.length > 100 ? 100 : version.content.length) : 'No content'}...</p>
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
        Close
      </button>
    </div>
  </div>
{/if}

<style>
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Ensure the parent container has enough width */
  .title-container {
    max-width: 100%;
  }

  /* Ensure the title is styled correctly */
  h3 {
    max-width: 100%; /* Adjust as needed */
  }

  /* Add transition styles for opacity */
  .transition-opacity {
    transition: opacity 0.3s ease-in-out;
  }

  /* Ensure buttons are hidden by default */
  .post-buttons {
    opacity: 0;
  }

  /* Show buttons on hover */
  .post:hover .post-buttons {
    opacity: 1;
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
</style>
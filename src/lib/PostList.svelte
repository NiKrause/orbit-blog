<script lang="ts">
  import { posts } from './store';
  import { marked } from 'marked';
  import DOMPurify from 'dompurify';
  import type { Post, Category } from './types';
  import CommentSection from './CommentSection.svelte';
  import { onMount } from 'svelte';
  import { postsDB } from './store';

  let searchQuery = '';
  let selectedCategory: Category | 'All' = 'All';
  let selectedPostId: string | null = null;

  $: filteredPosts = $posts.filter(post => {
    const matchesSearch = post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         post.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || post.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  $: selectedPost = selectedPostId ? filteredPosts.find(post => post._id === selectedPostId) : null;

  onMount(() => {
    if (filteredPosts.length > 0 && !selectedPostId) {
      selectedPostId = filteredPosts[0].id;
    }
  });

  $: if (filteredPosts.length > 0 && (!selectedPostId || !filteredPosts.find(post => post._id === selectedPostId))) {
    selectedPostId = filteredPosts[0]._id;
  }

  function renderMarkdown(content: string): string {
    const rawHtml = marked(content);
    return DOMPurify.sanitize(rawHtml);
  }

  async function deletePost(post: Post, event: MouseEvent) {
    console.log('Deleting post:', post);
    event.stopPropagation(); // Prevent triggering the post selection
    try {
      const postId = post._id;
      await $postsDB.del(postId);
      console.info('Post deleted successfully');
      // If the deleted post was selected, select another post
      if (selectedPostId === postId && filteredPosts.length > 1) {
        selectedPostId = filteredPosts[0]._id;
      }
    } catch (error) {
      console.error('Error deleting post:', error);
    }
  }

  async function dropAndSync() {
    try {
      // Drop the local database
      await $postsDB.drop();
      console.info('Local database dropped successfully');
      
      console.info('resyncing from network');
    } catch (error) {
      console.error('Error during drop and sync:', error);
    }
  }
</script>

<div class="space-y-6">
  <!-- New Sync Button -->
  <div class="flex justify-end">
    <button
      on:click={dropAndSync}
      class="bg-purple-600 dark:bg-purple-500 text-white py-2 px-4 rounded-md hover:bg-purple-700 dark:hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors flex items-center gap-2"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd" />
      </svg>
      Drop Posts & Sync from Network
    </button>
  </div>

  <div class="flex space-x-4 mb-6">
    <input
      type="text"
      placeholder="Search posts..."
      bind:value={searchQuery}
      class="flex-1 rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
    />
    
    <select
      bind:value={selectedCategory}
      class="rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
    >
      <option value="All">All Categories</option>
      <option value="Bitcoin">Bitcoin</option>
      <option value="Ethereum">Ethereum</option>
      <option value="DeFi">DeFi</option>
      <option value="NFTs">NFTs</option>
      <option value="Trading">Trading</option>
    </select>
  </div>

  <div class="grid grid-cols-12 gap-6">
    <!-- Post List -->
    <div class="col-span-4 bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 h-fit">
      <h2 class="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Blog Posts</h2>
      <div class="space-y-2">
        {#each filteredPosts as post (post._id)}
          <button
            class="w-full text-left p-3 rounded-md transition-colors {selectedPostId === post._id ? 'bg-indigo-50 dark:bg-indigo-900/50 border-indigo-500' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}"
            on:click={() => selectedPostId = post._id}
          >
            <div class="flex justify-between items-start">
              <div class="flex-1">
                <h3 class="font-medium truncate text-gray-900 dark:text-white">{post.title}</h3>
                <div class="flex justify-between text-sm text-gray-500 dark:text-gray-400 mt-1">
                  <span>{post.date}</span>
                  <span class="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 rounded-full text-xs">
                    {post.category}
                  </span>
                </div>
              </div>
              <button
                on:click={(e) => deletePost(post, e)}
                class="ml-2 p-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                title="Delete post"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                </svg>
              </button>
            </div>
          </button>
        {/each}
      </div>
    </div>

    <!-- Selected Post Content -->
    <div class="col-span-8">
      {#if selectedPost}
        <article class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h2 class="text-2xl font-bold mb-2 text-gray-900 dark:text-white">{selectedPost.title}</h2>
          <div class="flex space-x-4 text-sm text-gray-500 dark:text-gray-400 mb-4">
            <span>{selectedPost.date}</span>
            <span class="px-2 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 rounded-full">
              {selectedPost.category}
            </span>
          </div>
          <div class="prose dark:prose-invert max-w-none mb-6">
            {@html renderMarkdown(selectedPost.content)}
          </div>
          <CommentSection post={selectedPost} />
        </article>
      {:else}
        <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md text-center text-gray-500 dark:text-gray-400">
          <p>Select a post to view its content</p>
        </div>
      {/if}
    </div>
  </div>
</div>
<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { postsDB } from '$lib/store';
  import type { Post } from '$lib/types';
  import { info, error } from '../utils/logger'

  interface Props {
    post: Post;
  }

  let { post = $bindable() }: Props = $props();

  let newComment = $state('');
  let author = $state('');

  async function handleSubmit() {
    info('Adding comment to post:', post._id);
    if (newComment && author) {
      try {
        const comment = {
          _id: crypto.randomUUID(),
          content: newComment,
          author,
          date: new Date().toISOString().split('T')[0]
        };

        // Update the local post object with the new comment
        post = {
          ...post,
          comments: [...post.comments, comment]
        };

        // Delete the old post first
        info('Deleting post:', post);
        await $postsDB.del(post._id);
        info('Adding post again with new comments:', post);
        // Then add the updated post as a new entry
        await $postsDB.put(post)

        info('Comment added successfully');
        newComment = '';
        author = '';
      } catch (error) {
        error('Error adding comment:', error);
      }
    }
  }

  async function deleteComment(commentId: string) {
    try {
      // Filter out the deleted comment
      post = {
        ...post,
        comments: post.comments.filter(comment => comment._id !== commentId)
      };

      // Delete the old post first
      info('Deleting post:', post);
      await $postsDB.del(post._id);
      
      // Then add the updated post as a new entry
      await $postsDB.put(post);

      info('Comment deleted successfully');
    } catch (error) {
      error('Error deleting comment:', error);
    }
  }
</script>

<div class="mt-6 border-t dark:border-gray-700 pt-6">
  <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white">{$_('comments')} ({post.comments.length})</h3>
  
  <div class="space-y-4 mb-6">
    {#each post.comments as comment (comment._id)}
      <div class="bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
        <div class="flex justify-between items-center mb-2">
          <span class="font-medium text-gray-900 dark:text-white">{comment.author}</span>
          <div class="flex items-center gap-2">
            <span class="text-sm text-gray-500 dark:text-gray-400">{comment.date}</span>
            <button
              onclick={() => deleteComment(comment._id)}
              class="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
              title={$_('delete_comment')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
        <p class="text-gray-700 dark:text-gray-300">{comment.content}</p>
      </div>
    {/each}
  </div>

  <form class="space-y-4">
    <div>
      <label for="author" class="block text-sm font-medium text-gray-700 dark:text-gray-300">{$_('your_name')}</label>
      <input
        id="author"
        type="text"
        bind:value={author}
        class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        required
      />
    </div>

    <div>
      <label for="comment" class="block text-sm font-medium text-gray-700 dark:text-gray-300">{$_('comment')}</label>
      <textarea
        id="comment"
        bind:value={newComment}
        rows="3"
        class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        required
      ></textarea>
    </div>

    <button
      type="button"
      onclick={handleSubmit}
      class="bg-indigo-600 dark:bg-indigo-500 text-white py-2 px-4 rounded-md hover:bg-indigo-700 dark:hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors"
    >
      {$_('add_comment')}
    </button>
  </form>
</div>
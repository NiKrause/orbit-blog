<script lang="ts">
  import { preventDefault } from 'svelte/legacy';

  import { posts } from '../store';
  import type { Category } from '../types';

  let title = $state('');
  let content = $state('');
  let author = $state('');
  let category: Category = $state('Other');

  const categories: Category[] = ['Technology', 'Programming', 'Design', 'Other'];

  function handleSubmit() {
    if (!title.trim() || !content.trim() || !author.trim()) return;

    posts.update(currentPosts => [
      {
        id: crypto.randomUUID(),
        title,
        content,
        author,
        category,
        createdAt: new Date().toISOString().split('T')[0],
        comments: []
      },
      ...currentPosts
    ]);

    title = '';
    content = '';
    author = '';
    category = 'Other';
  }
</script>

<form onsubmit={preventDefault(handleSubmit)} class="new-post-form">
  <h2>Create New Post</h2>
  
  <input
    type="text"
    bind:value={title}
    placeholder="Post title"
    required
  />
  
  <input
    type="text"
    bind:value={author}
    placeholder="Your name"
    required
  />

  <select bind:value={category}>
    {#each categories as cat}
      <option value={cat}>{cat}</option>
    {/each}
  </select>
  
  <textarea
    bind:value={content}
    placeholder="Write your post in Markdown..."
    required
  ></textarea>
  
  <button type="submit">Publish Post</button>
</form>

<style>
  .new-post-form {
    margin-bottom: 2rem;
    padding: 1rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  input, textarea, select {
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
  }

  textarea {
    min-height: 200px;
    font-family: monospace;
  }

  button {
    align-self: flex-start;
  }
</style>
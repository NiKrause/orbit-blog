<script lang="ts">
  import { postsDB } from './store';
  import type { Category } from './types';

  let title = '';
  let content = '';
  let author = '';
  let category: Category = 'Other';

  const categories: Category[] = ['Technology', 'Programming', 'Design', 'Other'];

  async function handleSubmit() {
    if (!title.trim() || !content.trim() || !author.trim()) return;

    await $postsDB.put({
      _id: crypto.randomUUID(),
      title,
      content,
      author,
      category,
      createdAt: new Date().toISOString().split('T')[0],
      comments: []
    });
    const all = await $postsDB.all()
    console.log("all",all)
    title = '';
    content = '';
    author = '';
    category = 'Other';
  }
</script>

<form on:submit|preventDefault={handleSubmit} class="new-post-form">
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
    background-color: #4CAF50; /* Green background */
    color: white;
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
    transition: background-color 0.3s ease;
  }

  button:hover {
    background-color: #45a049; /* Darker green on hover */
  }

  button:active {
    background-color: #3d8b40; /* Even darker when clicked */
  }

  button:disabled {
    background-color: #cccccc;
    cursor: not-allowed;
  }
</style>
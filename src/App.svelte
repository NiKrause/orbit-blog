<script lang="ts">
  import { filteredPosts, searchQuery, selectedCategory } from './lib/store';
  import BlogPost from './lib/BlogPost.svelte';
  import NewPost from './lib/NewPost.svelte';

  const categories = ['All', 'Technology', 'Programming', 'Design', 'Other'];
</script>

<main>
  <h1>My Svelte Blog</h1>
  
  <div class="filters">
    <input
      type="text"
      bind:value={$searchQuery}
      placeholder="Search posts..."
      class="search-input"
    />
    
    <select bind:value={$selectedCategory} class="category-select">
      {#each categories as category}
        <option value={category}>{category}</option>
      {/each}
    </select>
  </div>
  
  <NewPost />
  
  <section class="blog-posts">
    {#each $filteredPosts as post (post.id)}
      <BlogPost {post} />
    {/each}
  </section>
</main>

<style>
  main {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
  }

  h1 {
    text-align: center;
    margin-bottom: 2rem;
  }

  .filters {
    display: flex;
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .search-input, .category-select {
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
  }

  .search-input {
    flex: 1;
  }

  .blog-posts {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }
</style>
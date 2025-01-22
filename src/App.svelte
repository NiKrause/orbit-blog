<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { IPFSAccessController } from '@orbitdb/core';
  import { heliaStore, orbitStore, postsDB, filteredPosts, searchQuery, selectedCategory } from './lib/store';
  import BlogPost from './lib/BlogPost.svelte';
  import NewPost from './lib/NewPost.svelte';
  
  import { posts } from './lib/store';
  const categories = ['All', 'Technology', 'Programming', 'Design', 'Other'];
  $:console.log("posts", $posts)
  $:console.log("filteredPosts", $filteredPosts)
  
  onMount(async () => {
    $postsDB = await $orbitStore.open('blog-posts', { 
      type: 'documents',
      create: true,
      overwrite: false,
      directory: './orbitdb/nameops',
      AccessController: IPFSAccessController({
          // write: [this.orbitdb.identity.id],
          write: ["*"]
      }),
    })
    let currentPosts = await $postsDB.all()
    if(currentPosts.length === 0){
     for(const post of $posts){
      await $postsDB.put(post)
     }
    }
    else $posts = currentPosts.map(entry => entry.value)
    
    $postsDB?.events.on('update', async (entry) => {
      if(entry?.payload?.op === 'PUT'){
        $posts = [...$posts, entry.payload.value]
      }else if(entry?.payload?.op === 'DEL'){
        $posts = $posts.filter(post => post._id !== entry.payload.key)
      }
  })
  })  

  onDestroy(async () => {
    await $postsDB.close()
    await $orbitStore.close()
    await $heliaStore.close()
  })
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
    {#each $filteredPosts as post (post._id)}
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
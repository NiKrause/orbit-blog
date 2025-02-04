<script lang="ts">
  import { marked } from 'marked';
  import type { BlogPost, Comment } from './types';
  import { posts } from './store';

  export let post: BlogPost;

  let newComment = '';
  let commentAuthor = '';

  // Configure marked options
  marked.setOptions({
    gfm: true, // GitHub Flavored Markdown
    breaks: true, // Convert line breaks to <br>
    headerIds: true, // Add IDs to headers
    mangle: false, // Don't escape HTML
    sanitize: false // Allow HTML
  });

  function addComment() {
    if (!newComment.trim() || !commentAuthor.trim()) return;

    const comment: Comment = {
      id: crypto.randomUUID(),
      content: newComment,
      author: commentAuthor,
      createdAt: new Date().toISOString().split('T')[0]
    };

    posts.update(currentPosts => {
      const updatedPosts = currentPosts.map(p => {
        if (p.id === post.id) {
          return { ...p, comments: [...p.comments, comment] };
        }
        return p;
      });
      return updatedPosts;
    });

    newComment = '';
    commentAuthor = '';
  }

  $: renderedContent = marked(post.content);
</script>

<article class="blog-post">
  <h2>{post.title}</h2>
  <div class="metadata">
    <span>By {post.author}</span>
    <span>Posted on {post.createdAt}</span>
    <span class="category">Category: {post.category}</span>
  </div>
  <div class="content">
    {@html renderedContent}
  </div>

  <section class="comments">
    <h3>Comments ({post.comments.length})</h3>
    {#each post.comments as comment}
      <div class="comment">
        <strong>{comment.author}</strong>
        <span class="comment-date">{comment.createdAt}</span>
        <p>{comment.content}</p>
      </div>
    {/each}

    <form on:submit|preventDefault={addComment} class="comment-form">
      <input
        type="text"
        bind:value={commentAuthor}
        placeholder="Your name"
        required
      />
      <textarea
        bind:value={newComment}
        placeholder="Write a comment..."
        required
      ></textarea>
      <button type="submit">Add Comment</button>
    </form>
  </section>
</article>

<style>
  .blog-post {
    margin-bottom: 2rem;
    padding: 1rem;
    border: 1px solid #ccc;
    border-radius: 4px;
  }

  .metadata {
    color: #666;
    margin-bottom: 1rem;
  }

  .metadata span {
    margin-right: 1rem;
  }

  .category {
    background: #f0f0f0;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
  }

  .content :global(h1) {
    font-size: 2em;
    margin-bottom: 1rem;
  }

  .content :global(h2) {
    font-size: 1.5em;
    margin: 1rem 0;
  }

  .content :global(ul), .content :global(ol) {
    margin-left: 2rem;
    margin-bottom: 1rem;
  }

  .content :global(p) {
    margin-bottom: 1rem;
    line-height: 1.6;
  }

  .content :global(code) {
    background: #f4f4f4;
    padding: 0.2em 0.4em;
    border-radius: 3px;
    font-family: monospace;
  }

  .content :global(pre) {
    background: #f4f4f4;
    padding: 1rem;
    border-radius: 4px;
    overflow-x: auto;
    margin-bottom: 1rem;
  }

  .content :global(blockquote) {
    border-left: 4px solid #ccc;
    margin: 1rem 0;
    padding-left: 1rem;
    color: #666;
  }

  .comments {
    margin-top: 2rem;
  }

  .comment {
    margin: 1rem 0;
    padding: 0.5rem;
    background: #f5f5f5;
    border-radius: 4px;
  }

  .comment-date {
    color: #666;
    font-size: 0.9em;
    margin-left: 1rem;
  }

  .comment-form {
    margin-top: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  input, textarea {
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
  }

  textarea {
    min-height: 100px;
  }
</style>
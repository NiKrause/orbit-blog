<script lang="ts">
  import { _ } from 'svelte-i18n';

  interface Props {
    message?: string;
  }

  let { message = $_('connecting_network_loading_blog') }: Props = $props();
</script>

<div class="loading-overlay">
  <div class="loading-container">
    <h2 class="loading-title">{$_('loading_peer_to_peer_blog')}</h2>
    <p class="loading-message">{message}</p>
    <div class="progress-container">
      <div class="progress-bar"></div>
    </div>
  </div>
</div>

<style>
  .loading-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
    backdrop-filter: blur(5px);
  }

  .loading-container {
    background-color: #fff;
    border-radius: 8px;
    padding: 2rem;
    width: 90%;
    max-width: 500px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
    text-align: center;
  }

  .loading-title {
    font-size: 1.5rem;
    margin-bottom: 1rem;
    color: #333;
  }

  .loading-message {
    margin-bottom: 2rem;
    color: #666;
  }

  .progress-container {
    height: 8px;
    background-color: #eee;
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 1rem;
  }

  .progress-bar {
    height: 100%;
    background: linear-gradient(90deg, #4f46e5, #818cf8);
    animation: loading 2s infinite ease-in-out;
    background-size: 200% 100%;
    border-radius: 4px;
  }

  :global(.dark) .loading-container {
    background-color: #1f2937;
  }

  :global(.dark) .loading-title {
    color: #f3f4f6;
  }

  :global(.dark) .loading-message {
    color: #d1d5db;
  }

  :global(.dark) .progress-container {
    background-color: #374151;
  }

  @keyframes loading {
    0% {
      width: 0%;
    }
    50% {
      width: 70%;
    }
    100% {
      width: 100%;
    }
  }
</style> 
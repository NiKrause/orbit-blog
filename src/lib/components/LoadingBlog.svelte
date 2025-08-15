<script lang="ts">
  import { _, locale } from 'svelte-i18n';
  import { getVersionString } from '$lib/utils/buildInfo.js';
  import { derived } from 'svelte/store';

  interface LoadingState {
    step: string;
    detail?: string;
    progress?: number;
  }

  interface Props {
    message?: string;
    loadingState?: LoadingState;
  }

  let { 
    message = $_('connecting_network_loading_blog'),
    loadingState = { step: 'initializing', detail: '', progress: 0 }
  }: Props = $props();

  // Map loading steps to user-friendly messages
  const stepMessages = {
    'initializing': $_('initializing'),
    'connecting_peers': $_('connecting_to_peers'),
    'identifying_db': $_('identifying_database'),
    'loading_settings': $_('loading_blog_settings'),
    'loading_posts': $_('loading_posts'),
    'loading_comments': $_('loading_comments'),
    'loading_media': $_('loading_media'),
    'complete': $_('loading_complete')
  };

  // Create a reactive version string that updates when locale changes
  const reactiveVersionString = derived(locale, ($locale) => {
    return getVersionString();
  });
</script>

<div class="loading-overlay" data-testid="loading-overlay">
  <div class="loading-container">
    <h2 class="loading-title">{$_('loading_peer_to_peer_blog')}</h2>
    <p class="loading-message" data-testid="loading-message">{stepMessages[loadingState.step] || message}</p>
    {#if loadingState.detail}
      <p class="loading-detail">{loadingState.detail}</p>
    {/if}
    <div class="progress-container">
      <div class="progress-bar" style="width: {loadingState.progress}%" data-testid="progress-bar"></div>
    </div>
    <p class="version-text">{$reactiveVersionString}</p>
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
    transition: width 0.3s ease-in-out;
    border-radius: 4px;
  }

  .version-text {
    font-size: 0.6rem;
    color: #999;
    margin-top: 0.5rem;
  }

  .loading-detail {
    font-size: 0.8rem;
    color: #666;
    margin-bottom: 1rem;
    font-style: italic;
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

  :global(.dark) .version-text {
    color: #6b7280;
  }

  :global(.dark) .loading-detail {
    color: #9ca3af;
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
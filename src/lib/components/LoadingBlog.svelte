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
    <div class="progress-track">
      <div class="progress-fill" style="width: {loadingState.progress}%" data-testid="progress-bar"></div>
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
    background-color: rgba(0, 0, 0, 0.6);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
    backdrop-filter: blur(8px);
  }

  .loading-container {
    background-color: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 2rem;
    width: 90%;
    max-width: 420px;
    box-shadow: var(--shadow-lg);
    text-align: center;
  }

  .loading-title {
    font-size: 1.1rem;
    font-weight: 600;
    margin-bottom: 0.75rem;
    color: var(--text);
  }

  .loading-message {
    font-size: 0.8rem;
    margin-bottom: 1.5rem;
    color: var(--text-secondary);
  }

  .progress-track {
    height: 3px;
    background-color: var(--bg-tertiary);
    border-radius: 2px;
    overflow: hidden;
    margin-bottom: 1rem;
  }

  .progress-fill {
    height: 100%;
    background-color: var(--accent);
    transition: width 0.3s ease-in-out;
    border-radius: 2px;
  }

  .version-text {
    font-size: 0.6rem;
    color: var(--text-muted);
    margin-top: 0.5rem;
  }

  .loading-detail {
    font-size: 0.75rem;
    color: var(--text-muted);
    margin-bottom: 1rem;
    font-style: italic;
  }
</style> 

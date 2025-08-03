<script lang="ts">
  import { _ } from 'svelte-i18n';
import { renderContent } from '$lib/services/MarkdownRenderer.js';

  interface Props {
    content: string;
    showPreview: boolean;
    rows?: number;
    placeholder?: string;
    id?: string;
    required?: boolean;
  }

  let { 
    content = $bindable(), 
    showPreview = $bindable(), 
    rows = 6, 
    placeholder = '',
    id = 'content',
    required = true 
  }: Props = $props();

  function togglePreview() {
    showPreview = !showPreview;
  }
</script>

<div>
  <div class="flex justify-between items-center mb-2">
    <label for={id} class="block text-sm font-medium text-gray-700 dark:text-gray-300">{$_('content')}</label>
    <button
      type="button"
      onclick={togglePreview}
      class="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300"
    >
      {showPreview ? $_('show_editor') : $_('show_preview')}
    </button>
  </div>

  {#if showPreview}
    <div class="prose dark:prose-invert max-w-none min-h-[200px] p-4 border rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600">
{@html renderContent(content || `*${$_('preview_will_appear_here')}...*`)}
    </div>
  {:else}
    <textarea
      {id}
      bind:value={content}
      {rows}
      {required}
      placeholder={placeholder || $_('markdown_placeholder')}
      class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
    ></textarea>
  {/if}
</div>

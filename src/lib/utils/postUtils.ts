import { get } from 'svelte/store';
import { _ } from 'svelte-i18n';
import { renderContent } from '../services/MarkdownRenderer';

/**
 * Renders markdown content safely using the centralized MarkdownRenderer
 */
export function renderMarkdown(content: string): string {
  // Process the markdown with line breaks for PostList compatibility
  const contentWithBreaks = content.replace(/\n(?!\n)/g, '  \n');
  return renderContent(contentWithBreaks);
}

/**
 * Handles media selection and updates content with markdown
 */
export function handleMediaSelection(
  mediaCid: string, 
  selectedMedia: string[], 
  content: string
): { updatedMedia: string[], updatedContent: string } {
  if (!selectedMedia.includes(mediaCid)) {
    const updatedMedia = [...selectedMedia, mediaCid];
    const updatedContent = content + `\n\n![Media](ipfs://${mediaCid})`;
    return { updatedMedia, updatedContent };
  }
  return { updatedMedia: selectedMedia, updatedContent: content };
}

/**
 * Removes selected media from list and content
 */
export function removeMediaFromContent(
  mediaId: string, 
  selectedMedia: string[], 
  content: string
): { updatedMedia: string[], updatedContent: string } {
  const updatedMedia = selectedMedia.filter(id => id !== mediaId);
  const updatedContent = content.replace(`\n\n![Media](ipfs://${mediaId})`, '');
  return { updatedMedia, updatedContent };
}

/**
 * Validates required fields for encryption
 */
export function validateEncryptionFields(title: string, content: string): string | null {
  if (!title || !content) {
    return get(_)('fill_required_fields');
  }
  return null;
}

/**
 * Truncates title to specified length with ellipsis
 */
export function truncateTitle(title: string, maxLength: number): string {
  return title.length > maxLength ? title.slice(0, maxLength) + '...' : title;
}

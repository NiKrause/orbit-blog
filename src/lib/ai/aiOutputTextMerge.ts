/**
 * FR-8c: merge provider text artifacts into the post draft per manifest rules (Story 5.2 Task 5).
 */

import type { AiModelManifest } from './types.js';

export function textBodyMergeModeForManifest(manifest: AiModelManifest | undefined): 'append' | 'replace' {
  const m = manifest?.output?.textBodyMerge;
  return m === 'replace' ? 'replace' : 'append';
}

export function mergeProviderTextIntoPostBody(
  content: string,
  text: string,
  mode: 'append' | 'replace',
): string {
  const t = text.trim();
  if (!t) return content;
  if (mode === 'replace') return t;
  const c = content.trimEnd();
  if (!c) return t;
  return `${c}\n\n${t}`;
}

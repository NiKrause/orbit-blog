import assert from 'node:assert/strict';
import {
  mergeProviderTextIntoPostBody,
  textBodyMergeModeForManifest,
} from '../src/lib/ai/aiOutputTextMerge.js';
import type { AiModelManifest } from '../src/lib/ai/types.js';

describe('aiOutputTextMerge (Story 5.2 FR-8c)', () => {
  it('textBodyMergeModeForManifest defaults to append', () => {
    assert.strictEqual(textBodyMergeModeForManifest(undefined), 'append');
    assert.strictEqual(textBodyMergeModeForManifest({} as AiModelManifest), 'append');
    assert.strictEqual(
      textBodyMergeModeForManifest({ id: 'x', labelKey: 'k', model: 'm' }),
      'append',
    );
  });

  it('honours replace', () => {
    const m: AiModelManifest = {
      id: 'x',
      labelKey: 'k',
      model: 'm',
      output: { textBodyMerge: 'replace' },
    };
    assert.strictEqual(textBodyMergeModeForManifest(m), 'replace');
  });

  it('mergeProviderTextIntoPostBody append and replace', () => {
    assert.strictEqual(mergeProviderTextIntoPostBody('a', '  ', 'append'), 'a');
    assert.strictEqual(mergeProviderTextIntoPostBody('line1', 'line2', 'append'), 'line1\n\nline2');
    assert.strictEqual(mergeProviderTextIntoPostBody('', 'only', 'append'), 'only');
    assert.strictEqual(mergeProviderTextIntoPostBody('old', 'new', 'replace'), 'new');
  });
});

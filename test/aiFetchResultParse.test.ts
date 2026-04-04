import assert from 'node:assert/strict';
import { extractOutputText } from '../src/lib/ai/aiFetchResultParse.js';

describe('extractOutputText (Story 5.2 FR-8c)', () => {
  it('reads top-level text fields', () => {
    assert.strictEqual(
      extractOutputText({ text: '  hello  ' }, 'https://x/v.mp4'),
      'hello',
    );
    assert.strictEqual(extractOutputText({ caption: 'cap' }), 'cap');
  });

  it('reads nested data / output objects', () => {
    assert.strictEqual(
      extractOutputText({ data: { text: 'inner' } }),
      'inner',
    );
    assert.strictEqual(
      extractOutputText({ output: { message: 'm1' } }),
      'm1',
    );
  });

  it('skips duplicate asset URL and raw http URLs', () => {
    const u = 'https://cdn.example/out.mp4';
    assert.strictEqual(extractOutputText({ text: u }, u), undefined);
    assert.strictEqual(extractOutputText({ text: 'https://evil/x' }), undefined);
  });

  it('prefers first non-url candidate', () => {
    assert.strictEqual(
      extractOutputText({ caption: 'ok', text: 'https://a.com/z.mp4' }),
      'ok',
    );
  });
});

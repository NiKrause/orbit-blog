import assert from 'node:assert/strict';
import { maskApiKeyLast4 } from '../src/lib/ai/maskApiKey.js';

describe('maskApiKeyLast4', () => {
  it('returns empty for empty input', () => {
    assert.equal(maskApiKeyLast4(''), '');
  });

  it('shows bullets plus full string when length <= 4', () => {
    assert.equal(maskApiKeyLast4('ab'), '••••••ab');
    assert.equal(maskApiKeyLast4('wxyz'), '••••••wxyz');
  });

  it('shows bullets plus last four for longer keys', () => {
    assert.equal(maskApiKeyLast4('sk-test-secret-key'), `••••••${'sk-test-secret-key'.slice(-4)}`);
  });
});

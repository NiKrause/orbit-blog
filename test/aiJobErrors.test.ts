import assert from 'node:assert/strict';
import {
  AI_JOB_ERROR_KEYS,
  AiTransportError,
  mapAiTransportError,
  mapHttpStatusToAiJobErrorKey,
} from '../src/lib/ai/aiJobErrors.js';

describe('mapHttpStatusToAiJobErrorKey', () => {
  it('maps auth, forbidden, rate limit, server, client, CORS', () => {
    assert.strictEqual(mapHttpStatusToAiJobErrorKey(401), AI_JOB_ERROR_KEYS.auth);
    assert.strictEqual(mapHttpStatusToAiJobErrorKey(403), AI_JOB_ERROR_KEYS.forbidden);
    assert.strictEqual(mapHttpStatusToAiJobErrorKey(429), AI_JOB_ERROR_KEYS.rateLimit);
    assert.strictEqual(mapHttpStatusToAiJobErrorKey(500), AI_JOB_ERROR_KEYS.httpServer);
    assert.strictEqual(mapHttpStatusToAiJobErrorKey(404), AI_JOB_ERROR_KEYS.httpClient);
    assert.strictEqual(mapHttpStatusToAiJobErrorKey(0), AI_JOB_ERROR_KEYS.corsOrBlocked);
  });
});

describe('mapAiTransportError', () => {
  it('returns key from AiTransportError', () => {
    assert.strictEqual(
      mapAiTransportError(new AiTransportError(AI_JOB_ERROR_KEYS.network)),
      AI_JOB_ERROR_KEYS.network,
    );
  });

  it('maps TypeError to network', () => {
    assert.strictEqual(mapAiTransportError(new TypeError('Failed to fetch')), AI_JOB_ERROR_KEYS.network);
  });

  it('maps Response when provided', () => {
    const res = new Response(null, { status: 403 });
    assert.strictEqual(mapAiTransportError(new Error('x'), res), AI_JOB_ERROR_KEYS.forbidden);
  });

  it('maps AbortError to aborted key', () => {
    const err = new DOMException('Aborted', 'AbortError');
    assert.strictEqual(mapAiTransportError(err), AI_JOB_ERROR_KEYS.aborted);
  });
});

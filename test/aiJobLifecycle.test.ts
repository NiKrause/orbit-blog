import assert from 'node:assert/strict';
import { MockAiHttpTransport } from '../src/lib/ai/mockAiHttpTransport.js';
import { AiTransportError, AI_JOB_ERROR_KEYS } from '../src/lib/ai/aiJobErrors.js';

describe('MockAiHttpTransport job lifecycle (Story 5.1)', () => {
  it('runs submit → poll until succeeded → fetchResult', async () => {
    const t = new MockAiHttpTransport();
    const { jobId } = await t.submitJob({
      model: 'kwaivgi/kling-v3.0-pro/image-to-video',
      body: { prompt: 'x' },
    });
    assert.ok(jobId.length > 0);

    let last: Awaited<ReturnType<MockAiHttpTransport['pollStatus']>> | undefined;
    for (let i = 0; i < 10; i += 1) {
      last = await t.pollStatus({ jobId });
      if (last.status === 'succeeded' || last.status === 'failed') break;
    }
    assert.strictEqual(last?.status, 'succeeded');

    const out = await t.fetchResult({ jobId });
    assert.ok(out.assetUrl?.includes(jobId));
  });

  it('poll fails after markFailed', async () => {
    const t = new MockAiHttpTransport();
    const { jobId } = await t.submitJob({ model: 'm', body: {} });
    t.markFailed(jobId);
    const p = await t.pollStatus({ jobId });
    assert.strictEqual(p.status, 'failed');
  });
});

describe('AiTransportError', () => {
  it('carries i18n key for FetchAiHttpTransport', () => {
    const e = new AiTransportError(AI_JOB_ERROR_KEYS.network);
    assert.strictEqual(e.i18nKey, AI_JOB_ERROR_KEYS.network);
  });
});

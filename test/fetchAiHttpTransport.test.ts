import assert from 'node:assert/strict';
import { FetchAiHttpTransport } from '../src/lib/ai/fetchAiHttpTransport.js';

describe('FetchAiHttpTransport (mocked fetch)', () => {
  const orig = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = orig;
  });

  it('submitJob reads predictionId from JSON', async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ predictionId: 'pred-1', status: 'queued' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    const t = new FetchAiHttpTransport();
    const r = await t.submitJob(
      { model: 'm', body: { prompt: 'x' } },
      { baseUrl: 'https://api.atlascloud.ai', apiKey: 'k' },
    );
    assert.strictEqual(r.jobId, 'pred-1');
  });

  it('submitJob throws mapped error on HTTP 401', async () => {
    globalThis.fetch = async () => new Response('', { status: 401 });
    const t = new FetchAiHttpTransport();
    await assert.rejects(
      () => t.submitJob({ model: 'm', body: {} }, { baseUrl: 'https://api.example.com', apiKey: 'k' }),
      (e: unknown) => e instanceof Error && e.message === 'ai_job_error_auth',
    );
  });

  it('fetchResult returns outputText alongside assetUrl', async () => {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          status: 'completed',
          output: { url: 'https://cdn.example/v.mp4', caption: 'scene A' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    const t = new FetchAiHttpTransport();
    const r = await t.fetchResult(
      { jobId: 'j1' },
      { baseUrl: 'https://api.atlascloud.ai', apiKey: 'k' },
    );
    assert.strictEqual(r.assetUrl, 'https://cdn.example/v.mp4');
    assert.strictEqual(r.outputText, 'scene A');
  });
});

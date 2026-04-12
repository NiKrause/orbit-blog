import assert from 'node:assert/strict';
import { FetchAiHttpTransport, sanitizeAiLogValue } from '../src/lib/ai/fetchAiHttpTransport.js';
import { aiLog } from '../src/lib/utils/logger.js';

describe('FetchAiHttpTransport (mocked fetch)', () => {
  const orig = globalThis.fetch;
  const origDebug = aiLog.debug;
  const origError = aiLog.error;
  const origInfo = aiLog.info;
  const origWarn = aiLog.warn;
  const origTrace = aiLog.trace;

  afterEach(() => {
    globalThis.fetch = orig;
    aiLog.debug = origDebug;
    aiLog.error = origError;
    aiLog.info = origInfo;
    aiLog.warn = origWarn;
    aiLog.trace = origTrace;
  });

  it('redacts secrets and prompt-like fields when verbose logging is disabled', () => {
    const sanitized = sanitizeAiLogValue(
      {
        Authorization: 'Bearer secret-token',
        prompt: 'make the camera slowly push in',
        image_url: 'https://cdn.example/video.mp4?token=secret',
        duration: 5,
      },
      { verbose: false },
    ) as Record<string, unknown>;

    assert.strictEqual(sanitized.Authorization, '[redacted]');
    assert.strictEqual(sanitized.prompt, '[redacted:30 chars]');
    assert.strictEqual(sanitized.image_url, 'https://cdn.example/video.mp4?<redacted>');
    assert.strictEqual(sanitized.duration, 5);
  });

  it('submitJob reads predictionId from JSON', async () => {
    const debugCalls: Array<{ message: unknown; args: unknown[] }> = [];
    aiLog.debug = (message: unknown, ...args: unknown[]) => {
      debugCalls.push({ message, args });
    };
    aiLog.error = () => {};
    aiLog.info = () => {};
    aiLog.warn = () => {};
    aiLog.trace = () => {};
    globalThis.fetch = async () =>
      new Response(JSON.stringify({
        code: 200,
        message: '',
        data: {
          id: 'pred-1',
          status: 'processing',
          urls: {
            get: 'https://api.atlascloud.ai/api/v1/model/prediction/pred-1',
          },
        },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    const t = new FetchAiHttpTransport();
    const r = await t.submitJob(
      { model: 'm', body: { prompt: 'x' } },
      { baseUrl: 'https://api.atlascloud.ai', apiKey: 'k' },
    );
    assert.strictEqual(r.jobId, 'pred-1');
    assert.strictEqual(r.resultUrl, 'https://api.atlascloud.ai/api/v1/model/prediction/pred-1');

    const requestLog = debugCalls.find((entry) => entry.message === 'AI transport submitJob request');
    const responseLog = debugCalls.find((entry) => entry.message === 'AI transport submitJob response');
    assert.ok(requestLog, 'expected submitJob request log');
    assert.ok(responseLog, 'expected submitJob response log');
    assert.deepStrictEqual(requestLog?.args[0], {
      operation: 'submitJob',
      method: 'POST',
      url: 'https://api.atlascloud.ai/api/v1/model/generateVideo',
      headers: {
        Authorization: '[redacted]',
        'Content-Type': 'application/json',
      },
      body: {
        model: 'm',
        prompt: 'x',
      },
    });
    assert.deepStrictEqual(responseLog?.args[0], {
      operation: 'submitJob',
      url: 'https://api.atlascloud.ai/api/v1/model/generateVideo',
      status: 200,
      ok: true,
      type: 'default',
      contentType: 'application/json',
      body: {
        code: 200,
        message: '',
        data: {
          id: 'pred-1',
          status: 'processing',
          urls: {
            get: 'https://api.atlascloud.ai/api/v1/model/prediction/pred-1',
          },
        },
      },
    });
  });

  it('submitJob throws mapped error on HTTP 401', async () => {
    aiLog.debug = () => {};
    aiLog.error = () => {};
    aiLog.info = () => {};
    aiLog.warn = () => {};
    aiLog.trace = () => {};
    globalThis.fetch = async () => new Response('', { status: 401 });
    const t = new FetchAiHttpTransport();
    await assert.rejects(
      () => t.submitJob({ model: 'm', body: {} }, { baseUrl: 'https://api.example.com', apiKey: 'k' }),
      (e: unknown) => e instanceof Error && e.message === 'ai_job_error_auth',
    );
  });

  it('fetchResult returns outputText alongside assetUrl', async () => {
    aiLog.debug = () => {};
    aiLog.error = () => {};
    aiLog.info = () => {};
    aiLog.warn = () => {};
    aiLog.trace = () => {};
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          code: 200,
          data: {
            status: 'completed',
            outputs: ['https://cdn.example/v.mp4'],
            caption: 'scene A',
          },
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

  it('pollStatus reads nested atlas status from the result url', async () => {
    let fetchedUrl = '';
    aiLog.debug = () => {};
    aiLog.error = () => {};
    aiLog.info = () => {};
    aiLog.warn = () => {};
    aiLog.trace = () => {};
    globalThis.fetch = async (input: RequestInfo | URL) => {
      fetchedUrl = String(input);
      return new Response(
        JSON.stringify({
          code: 200,
          data: {
            status: 'processing',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    };
    const t = new FetchAiHttpTransport();
    const r = await t.pollStatus(
      {
        jobId: 'pred-1',
        resultUrl: 'https://api.atlascloud.ai/api/v1/model/prediction/pred-1',
      },
      { baseUrl: 'https://api.atlascloud.ai', apiKey: 'k' },
    );
    assert.strictEqual(fetchedUrl, 'https://api.atlascloud.ai/api/v1/model/prediction/pred-1');
    assert.strictEqual(r.status, 'running');
  });

  it('logs provider body before throwing badResponse when prediction id is missing', async () => {
    const errorCalls: Array<{ message: unknown; args: unknown[] }> = [];
    aiLog.debug = () => {};
    aiLog.error = (message: unknown, ...args: unknown[]) => {
      errorCalls.push({ message, args });
    };
    aiLog.info = () => {};
    aiLog.warn = () => {};
    aiLog.trace = () => {};

    globalThis.fetch = async () =>
      new Response(JSON.stringify({ accepted: true, status: 'queued' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

    const t = new FetchAiHttpTransport();
    await assert.rejects(
      () => t.submitJob({ model: 'm', body: { prompt: 'x' } }, { baseUrl: 'https://api.atlascloud.ai', apiKey: 'k' }),
      (e: unknown) => e instanceof Error && e.message === 'ai_job_error_bad_response',
    );

    const missingIdLog = errorCalls.find((entry) => entry.message === 'AI transport submitJob missing prediction id');
    assert.ok(missingIdLog, 'expected missing prediction id log');
    assert.deepStrictEqual(missingIdLog?.args[0], {
      operation: 'submitJob',
      url: 'https://api.atlascloud.ai/api/v1/model/generateVideo',
      body: {
        accepted: true,
        status: 'queued',
      },
    });
  });
});

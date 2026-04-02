import assert from 'node:assert/strict';
import {
  AI_INGEST_ERROR_KEYS,
  AiIngestError,
  ingestRemoteVideoToMedia,
} from '../src/lib/mediaIngest.js';

describe('ingestRemoteVideoToMedia', () => {
  it('throws AiIngestError on opaque response', async () => {
    const fetchImpl = async () =>
      ({ type: 'opaque', ok: false, status: 0 }) as unknown as Response;
    await assert.rejects(
      () =>
        ingestRemoteVideoToMedia({
          assetUrl: 'https://x.test/a.mp4',
          mediaDB: { put: async () => {} },
          helia: {},
          fetchImpl,
        }),
      (e: unknown) =>
        e instanceof AiIngestError &&
        e.i18nKey === AI_INGEST_ERROR_KEYS.corsOrBlocked,
    );
  });

  it('throws tooLarge when body exceeds maxBytes', async () => {
    const big = new Uint8Array(11 * 1024 * 1024);
    const fetchImpl = async () =>
      new Response(big, {
        status: 200,
        headers: { 'Content-Type': 'video/mp4' },
      });
    await assert.rejects(
      () =>
        ingestRemoteVideoToMedia({
          assetUrl: 'https://x.test/big.mp4',
          mediaDB: { put: async () => {} },
          helia: {},
          maxBytes: 1024,
          fetchImpl,
        }),
      (e: unknown) =>
        e instanceof AiIngestError &&
        e.i18nKey === AI_INGEST_ERROR_KEYS.tooLarge,
    );
  });

  it('throws network on fetch TypeError', async () => {
    const fetchImpl = async () => {
      throw new TypeError('fail');
    };
    await assert.rejects(
      () =>
        ingestRemoteVideoToMedia({
          assetUrl: 'https://x.test/a.mp4',
          mediaDB: { put: async () => {} },
          helia: {},
          fetchImpl,
        }),
      (e: unknown) =>
        e instanceof AiIngestError &&
        e.i18nKey === AI_INGEST_ERROR_KEYS.network,
    );
  });

  it('throws http on non-OK response', async () => {
    const fetchImpl = async () =>
      new Response(null, { status: 503, statusText: 'No' });
    await assert.rejects(
      () =>
        ingestRemoteVideoToMedia({
          assetUrl: 'https://x.test/a.mp4',
          mediaDB: { put: async () => {} },
          helia: {},
          fetchImpl,
        }),
      (e: unknown) =>
        e instanceof AiIngestError && e.i18nKey === AI_INGEST_ERROR_KEYS.http,
    );
  });
});

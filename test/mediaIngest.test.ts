import assert from 'node:assert/strict';
import {
  DEFAULT_MEDIA_MAX_FILE_SIZE_MB,
  formatMediaMaxFileSizeMb,
  parseMediaMaxFileSizeMb,
} from '../src/lib/mediaConfig.js';
import {
  AI_INGEST_ERROR_KEYS,
  AiIngestError,
  ingestRemoteVideoToMedia,
} from '../src/lib/mediaIngest.js';

describe('ingestRemoteVideoToMedia', () => {
  it('parses invalid media size config back to the default', () => {
    assert.strictEqual(
      parseMediaMaxFileSizeMb('not-a-number'),
      DEFAULT_MEDIA_MAX_FILE_SIZE_MB,
    );
    assert.strictEqual(parseMediaMaxFileSizeMb(0), DEFAULT_MEDIA_MAX_FILE_SIZE_MB);
  });

  it('parses and formats a configured media size label', () => {
    assert.strictEqual(parseMediaMaxFileSizeMb('250'), 250);
    assert.strictEqual(formatMediaMaxFileSizeMb(100), '100 MB');
    assert.strictEqual(formatMediaMaxFileSizeMb(12.5), '12.5 MB');
  });

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

  it('throws tooLarge when Content-Length exceeds maxBytes before buffering', async () => {
    const fetchImpl = async () =>
      new Response(null, {
        status: 200,
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Length': String(11 * 1024 * 1024),
        },
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

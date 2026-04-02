/**
 * Web Crypto in Node: ensure subtle + getRandomValues (Node 20+ or polyfill).
 */
import { webcrypto } from 'node:crypto';
if (!globalThis.crypto?.subtle) {
  (globalThis as unknown as { crypto: Crypto }).crypto = webcrypto as unknown as Crypto;
}

import assert from 'node:assert/strict';
import { decryptApiKey, encryptApiKey } from '../src/lib/ai/aiCredentialCrypto.js';
import {
  credentialDocumentId,
  deleteAiCredential,
  listAiCredentialModelIds,
  loadAiCredential,
  loadAiCredentialDetailed,
  saveAiCredential,
} from '../src/lib/ai/aiCredentialStore.js';
import type { AiCredentialDocument } from '../src/lib/ai/credentialTypes.js';

describe('aiCredentialCrypto', () => {
  /** Deterministic 32-byte IKM (same shape as convertTo32BitSeed output). */
  const seed = new Uint8Array(32);
  for (let i = 0; i < 32; i++) seed[i] = i + 1;

  it('round-trips API key with identity seed', async () => {
    const secret = 'sk-atlas-example-not-real';
    const enc = await encryptApiKey(seed, secret);
    const out = await decryptApiKey(seed, enc);
    assert.equal(out, secret);
  });

  it('fails decrypt with wrong seed', async () => {
    const other = new Uint8Array(32);
    other.fill(7);
    const enc = await encryptApiKey(seed, 'same-plaintext');
    await assert.rejects(() => decryptApiKey(other, enc));
  });

  it('fails decrypt when ciphertext is tampered', async () => {
    const enc = await encryptApiKey(seed, 'x');
    const bad: typeof enc = {
      ...enc,
      ciphertextB64: enc.ciphertextB64.slice(0, -4) + 'XXXX',
    };
    await assert.rejects(() => decryptApiKey(seed, bad));
  });

  it('saveAiCredential stores encrypted payload (mock db)', async () => {
    const stored = new Map<string, unknown>();
    const aiDb = {
      put: async (doc: Record<string, unknown>) => {
        stored.set(doc._id as string, doc);
      },
      get: async (id: string) => ({ value: stored.get(id) }),
    };

    await saveAiCredential(aiDb, seed, {
      modelId: 'kwaivgi/kling-v3.0-pro/image-to-video',
      baseUrl: 'https://api.example.com',
      apiKey: 'k-test',
    });

    const raw = stored.get(credentialDocumentId('kwaivgi/kling-v3.0-pro/image-to-video')) as AiCredentialDocument;
    assert.ok(raw);
    assert.equal(raw.schemaVersion, 1);
    assert.equal(raw.baseUrl, 'https://api.example.com');
    assert.ok(raw.encryptedApiKey.ciphertextB64.length > 0);
    assert.ok(!JSON.stringify(raw).includes('k-test'), 'plaintext key must not appear in stored doc');
  });

  it('loadAiCredential decrypts after save (mock db)', async () => {
    const stored = new Map<string, unknown>();
    const aiDb = {
      put: async (doc: Record<string, unknown>) => {
        stored.set(doc._id as string, doc);
      },
      get: async (id: string) => ({ value: stored.get(id) }),
    };

    const modelId = 'model-b';
    await saveAiCredential(aiDb, seed, {
      modelId,
      baseUrl: 'https://a.com',
      apiKey: 'secret-z',
    });

    const loaded = await loadAiCredential(aiDb, seed, modelId);
    assert.ok(loaded);
    assert.equal(loaded.apiKey, 'secret-z');
    assert.equal(loaded.baseUrl, 'https://a.com');
  });

  it('saveAiCredential rejects empty or whitespace modelId', async () => {
    const aiDb = { put: async () => {}, get: async () => null };
    await assert.rejects(
      () => saveAiCredential(aiDb, seed, { modelId: '', baseUrl: 'https://x.com', apiKey: 'k' }),
      /modelId must be a non-empty string/
    );
    await assert.rejects(
      () => saveAiCredential(aiDb, seed, { modelId: '   ', baseUrl: 'https://x.com', apiKey: 'k' }),
      /modelId must be a non-empty string/
    );
  });

  it('loadAiCredentialDetailed returns decrypt_failed when decrypt fails (wrong seed)', async () => {
    const stored = new Map<string, unknown>();
    const aiDb = {
      put: async (doc: Record<string, unknown>) => {
        stored.set(doc._id as string, doc);
      },
      get: async (id: string) => ({ value: stored.get(id) }),
    };
    await saveAiCredential(aiDb, seed, {
      modelId: 'm1',
      baseUrl: 'https://a.com',
      apiKey: 'secret',
    });
    const otherSeed = new Uint8Array(32);
    otherSeed.fill(9);
    const detailed = await loadAiCredentialDetailed(aiDb, otherSeed, 'm1');
    assert.equal(detailed.status, 'decrypt_failed');
  });

  it('loadAiCredentialDetailed returns missing when no row', async () => {
    const aiDb = {
      get: async () => ({ value: undefined }),
    };
    const r = await loadAiCredentialDetailed(aiDb, seed, 'nope');
    assert.equal(r.status, 'missing');
  });

  it('loadAiCredential returns null when decrypt fails (wrong seed)', async () => {
    const stored = new Map<string, unknown>();
    const aiDb = {
      put: async (doc: Record<string, unknown>) => {
        stored.set(doc._id as string, doc);
      },
      get: async (id: string) => ({ value: stored.get(id) }),
    };
    await saveAiCredential(aiDb, seed, {
      modelId: 'm1',
      baseUrl: 'https://a.com',
      apiKey: 'secret',
    });
    const otherSeed = new Uint8Array(32);
    otherSeed.fill(9);
    const loaded = await loadAiCredential(aiDb, otherSeed, 'm1');
    assert.equal(loaded, null);
  });
});

describe('aiCredentialStore multi-model', () => {
  const seed = new Uint8Array(32);
  for (let i = 0; i < 32; i++) seed[i] = i + 1;

  function createMockAiDb() {
    const stored = new Map<string, unknown>();
    return {
      aiDb: {
        put: async (doc: Record<string, unknown>) => {
          stored.set(doc._id as string, doc);
        },
        get: async (id: string) => ({ value: stored.get(id) }),
        all: async () =>
          Array.from(stored.entries()).map(([key, value]) => ({ key, value })),
        del: async (id: string) => {
          stored.delete(id);
        },
      },
    };
  }

  it('saves two models with distinct documents; updating A does not change B', async () => {
    const { aiDb } = createMockAiDb();
    await saveAiCredential(aiDb, seed, {
      modelId: 'vendor/model-a',
      baseUrl: 'https://a.example.com',
      apiKey: 'key-a',
    });
    await saveAiCredential(aiDb, seed, {
      modelId: 'vendor/model-b',
      baseUrl: 'https://b.example.com',
      apiKey: 'key-b',
    });

    const ids = await listAiCredentialModelIds(aiDb);
    assert.deepEqual(ids, ['vendor/model-a', 'vendor/model-b']);

    await saveAiCredential(aiDb, seed, {
      modelId: 'vendor/model-a',
      baseUrl: 'https://a-updated.com',
      apiKey: 'key-a-new',
    });

    const a = await loadAiCredential(aiDb, seed, 'vendor/model-a');
    const b = await loadAiCredential(aiDb, seed, 'vendor/model-b');
    assert.ok(a && b);
    assert.equal(a.baseUrl, 'https://a-updated.com');
    assert.equal(a.apiKey, 'key-a-new');
    assert.equal(b.baseUrl, 'https://b.example.com');
    assert.equal(b.apiKey, 'key-b');
  });

  it('deleteAiCredential removes one model only', async () => {
    const { aiDb } = createMockAiDb();
    await saveAiCredential(aiDb, seed, {
      modelId: 'x',
      baseUrl: 'https://x.com',
      apiKey: 'kx',
    });
    await saveAiCredential(aiDb, seed, {
      modelId: 'y',
      baseUrl: 'https://y.com',
      apiKey: 'ky',
    });
    await deleteAiCredential(aiDb, 'x');
    assert.deepEqual(await listAiCredentialModelIds(aiDb), ['y']);
    assert.equal(await loadAiCredential(aiDb, seed, 'x'), null);
    assert.ok(await loadAiCredential(aiDb, seed, 'y'));
  });
});

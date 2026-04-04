import assert from 'node:assert/strict';
import {
  AI_RUN_DOC_PREFIX,
  createPendingAiRunDoc,
  newAiRunDocumentId,
  patchAiRun,
  snapshotAiInputs,
} from '../src/lib/ai/aiRunDocument.js';

describe('aiRunDocument (FR-8b)', () => {
  it('newAiRunDocumentId uses run prefix', () => {
    const id = newAiRunDocumentId();
    assert.ok(id.startsWith(AI_RUN_DOC_PREFIX));
    assert.ok(id.length > AI_RUN_DOC_PREFIX.length + 4);
  });

  it('snapshotAiInputs deep-clones JSON data', () => {
    const src = { a: 1, nested: { b: 'x' } };
    const snap = snapshotAiInputs(src);
    assert.deepStrictEqual(snap, src);
    assert.notStrictEqual(snap, src);
    assert.notStrictEqual(snap.nested, src.nested);
    (snap as { nested: { b: string } }).nested.b = 'y';
    assert.strictEqual(src.nested.b, 'x');
  });

  it('createPendingAiRunDoc sets pending status and snapshots inputs', () => {
    const doc = createPendingAiRunDoc({
      runId: 'run:test-1',
      manifestModelId: 'kling-i2v-1',
      providerModelId: 'kwaivgi/kling-v3.0-pro/image-to-video',
      inputValues: { prompt: 'hello' },
    });
    assert.strictEqual(doc._id, 'run:test-1');
    assert.strictEqual(doc.schemaVersion, 1);
    assert.strictEqual(doc.kind, 'aiRun');
    assert.strictEqual(doc.status, 'pending');
    assert.strictEqual(doc.manifestModelId, 'kling-i2v-1');
    assert.strictEqual(doc.providerModelId, 'kwaivgi/kling-v3.0-pro/image-to-video');
    assert.deepStrictEqual(doc.inputsSnapshot, { prompt: 'hello' });
    assert.match(doc.createdAt, /^\d{4}-/);
    assert.strictEqual(doc.updatedAt, doc.createdAt);
  });

  it('patchAiRun bumps updatedAt and merges fields', () => {
    const base = createPendingAiRunDoc({
      runId: 'run:p',
      manifestModelId: 'm1',
      providerModelId: 'p/m',
      inputValues: {},
    });
    const t0 = base.updatedAt;
    const next = patchAiRun(base, {
      status: 'queued',
      providerJobId: 'job-99',
    });
    assert.strictEqual(next.status, 'queued');
    assert.strictEqual(next.providerJobId, 'job-99');
    assert(next.updatedAt >= t0);
    const failed = patchAiRun(next, { status: 'failed', errorKey: 'ai_job_error_network' });
    assert.strictEqual(failed.status, 'failed');
    assert.strictEqual(failed.errorKey, 'ai_job_error_network');
    assert.strictEqual(failed.providerJobId, 'job-99');
  });

  it('mock aiDB.put receives terminal document sequence', async () => {
    const puts: unknown[] = [];
    const db = {
      async put(doc: unknown) {
        puts.push(doc);
      },
    };
    let runDoc = createPendingAiRunDoc({
      runId: 'run:seq',
      manifestModelId: 'mid',
      providerModelId: 'prov/m',
      inputValues: { x: 1 },
    });
    await db.put(runDoc);
    const persist = async (patch: Parameters<typeof patchAiRun>[1]) => {
      runDoc = patchAiRun(runDoc, patch);
      await db.put(runDoc);
    };
    await persist({ status: 'queued', providerJobId: 'j1' });
    await persist({ status: 'succeeded', lastPollLifecycle: 'succeeded' });
    assert.strictEqual(puts.length, 3);
    assert.strictEqual((puts[0] as { status: string }).status, 'pending');
    assert.strictEqual((puts[1] as { status: string }).status, 'queued');
    assert.strictEqual((puts[1] as { providerJobId: string }).providerJobId, 'j1');
    assert.strictEqual((puts[2] as { status: string }).status, 'succeeded');
  });
});

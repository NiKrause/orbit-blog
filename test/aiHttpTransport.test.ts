import assert from 'node:assert/strict';
import { MockAiHttpTransport } from '../src/lib/ai/mockAiHttpTransport.js';

describe('MockAiHttpTransport', () => {
  it('submitJob returns a job id without network', async () => {
    const t = new MockAiHttpTransport();
    const { jobId } = await t.submitJob(
      { model: 'kwaivgi/kling-v3.0-pro/image-to-video', body: { prompt: 'test' } },
      { apiKey: 'secret-key-do-not-log', baseUrl: 'https://api.example.com' }
    );
    assert.match(jobId, /^mock-job-\d+$/);
  });

  it('pollStatus progresses queued → running → succeeded', async () => {
    const t = new MockAiHttpTransport();
    const { jobId } = await t.submitJob({ model: 'm', body: {} });

    const p1 = await t.pollStatus({ jobId });
    assert.equal(p1.status, 'queued');

    const p2 = await t.pollStatus({ jobId });
    assert.equal(p2.status, 'running');

    const p3 = await t.pollStatus({ jobId });
    assert.equal(p3.status, 'succeeded');
  });

  it('fetchResult returns assetUrl after success path', async () => {
    const t = new MockAiHttpTransport();
    const { jobId } = await t.submitJob({ model: 'm', body: {} });
    await t.pollStatus({ jobId });
    await t.pollStatus({ jobId });
    await t.pollStatus({ jobId });

    const out = await t.fetchResult({ jobId });
    assert.ok(out.assetUrl?.includes(jobId));
  });

  it('fetchResult throws if job has not reached succeeded', async () => {
    const t = new MockAiHttpTransport();
    const { jobId } = await t.submitJob({ model: 'm', body: {} });
    await assert.rejects(() => t.fetchResult({ jobId }), /not completed successfully/);
    await t.pollStatus({ jobId });
    await assert.rejects(() => t.fetchResult({ jobId }), /not completed successfully/);
  });

  it('pollStatus unknown job returns failed', async () => {
    const t = new MockAiHttpTransport();
    const r = await t.pollStatus({ jobId: 'missing' });
    assert.equal(r.status, 'failed');
  });

  it('markFailed yields failed poll', async () => {
    const t = new MockAiHttpTransport();
    const { jobId } = await t.submitJob({ model: 'm', body: {} });
    t.markFailed(jobId);
    const r = await t.pollStatus({ jobId });
    assert.equal(r.status, 'failed');
  });
});

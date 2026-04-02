import type {
  AiFetchResultInput,
  AiFetchResultOutput,
  AiHttpTransport,
  AiHttpTransportOptions,
  AiPollStatusInput,
  AiPollStatusResult,
  AiSubmitJobInput,
  AiSubmitJobResult,
} from './types.js';

type InternalJob = {
  pollCount: number;
  failed?: boolean;
  /** Set when `pollStatus` has returned `succeeded` at least once for this job. */
  completedSuccessfully?: boolean;
};

/**
 * In-memory transport for tests and UI development without Atlas network calls.
 * Does not perform logging (NFR-1 friendly).
 */
export class MockAiHttpTransport implements AiHttpTransport {
  private nextId = 1;
  private readonly jobs = new Map<string, InternalJob>();

  async submitJob(input: AiSubmitJobInput, _options?: AiHttpTransportOptions): Promise<AiSubmitJobResult> {
    const jobId = `mock-job-${this.nextId++}`;
    this.jobs.set(jobId, { pollCount: 0 });
    return {
      jobId,
      raw: { model: input.model, submitted: true },
    };
  }

  async pollStatus(input: AiPollStatusInput, _options?: AiHttpTransportOptions): Promise<AiPollStatusResult> {
    const job = this.jobs.get(input.jobId);
    if (!job) {
      return { status: 'failed', raw: { reason: 'unknown_job' } };
    }
    job.pollCount += 1;
    if (job.failed) {
      return { status: 'failed', raw: { reason: 'mock_failure' } };
    }
    if (job.pollCount === 1) {
      return { status: 'queued', raw: { attempt: job.pollCount } };
    }
    if (job.pollCount === 2) {
      return { status: 'running', raw: { attempt: job.pollCount } };
    }
    job.completedSuccessfully = true;
    return { status: 'succeeded', raw: { attempt: job.pollCount } };
  }

  async fetchResult(input: AiFetchResultInput, _options?: AiHttpTransportOptions): Promise<AiFetchResultOutput> {
    const job = this.jobs.get(input.jobId);
    if (!job || job.failed) {
      throw new Error(`mock: cannot fetch result for job ${input.jobId}`);
    }
    if (!job.completedSuccessfully) {
      throw new Error(`mock: job ${input.jobId} has not completed successfully yet`);
    }
    return {
      assetUrl: `https://example.invalid/mock-output/${input.jobId}.mp4`,
      raw: { jobId: input.jobId },
    };
  }

  /** Test helper: mark a job as failed before polling completes. */
  markFailed(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (job) job.failed = true;
  }

  /** Test helper: inspect poll count. */
  getPollCount(jobId: string): number | undefined {
    return this.jobs.get(jobId)?.pollCount;
  }
}

/**
 * Vendor-neutral AI HTTP job types for M1 (Atlas and others implement the same contract at the transport layer).
 */
export type AiJobLifecycleStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export interface AiSubmitJobInput {
  /** Provider model id e.g. kwaivgi/kling-v3.0-pro/image-to-video */
  model: string;
  /** JSON-serializable body per provider queue API */
  body: Record<string, unknown>;
}

export interface AiSubmitJobResult {
  jobId: string;
  raw?: unknown;
}

export interface AiPollStatusInput {
  jobId: string;
}

export interface AiPollStatusResult {
  status: AiJobLifecycleStatus;
  raw?: unknown;
}

export interface AiFetchResultInput {
  jobId: string;
}

/** Result pointer after the job succeeds (e.g. video URL or inline payload reference). */
export interface AiFetchResultOutput {
  /** HTTPS URL to generated asset when provider returns a URL */
  assetUrl?: string;
  raw?: unknown;
}

export interface AiHttpTransportOptions {
  baseUrl?: string;
  /** Never log this value; transports must treat as secret. */
  apiKey?: string;
}

/**
 * HTTP-side adapter for async AI jobs (submit → poll → fetch).
 * Real implementation may use fetch(); tests use {@link MockAiHttpTransport}.
 */
export interface AiHttpTransport {
  submitJob(input: AiSubmitJobInput, options?: AiHttpTransportOptions): Promise<AiSubmitJobResult>;

  pollStatus(input: AiPollStatusInput, options?: AiHttpTransportOptions): Promise<AiPollStatusResult>;

  fetchResult(input: AiFetchResultInput, options?: AiHttpTransportOptions): Promise<AiFetchResultOutput>;
}

/**
 * Subset of JSON Schema for dynamic job inputs (Story 4.1).
 * Root must be `type: "object"` with `properties`; optional `required`, `x-order`.
 */
export interface AiInputPropertySchema {
  type: 'string' | 'number' | 'integer' | 'boolean';
  /** i18n key for field label. */
  titleKey: string;
  enum?: string[];
  minimum?: number;
  maximum?: number;
  /**
   * Story 4.2: `image` renders library + upload for `type: 'string'` (no `enum`).
   * Bound value is the **CID string** (same persistence as post media; Epic 5 maps to URLs for Atlas).
   */
  'x-ui'?: 'image';
}

export interface AiInputSchema {
  type: 'object';
  required?: string[];
  properties: Record<string, AiInputPropertySchema>;
  /** If present and lists every property key exactly once, this order wins (AC2). */
  'x-order'?: string[];
}

/** Registered model entry for UI + transport (full JSON Schema in Epic 4). */
export interface AiModelManifest {
  /** Stable id for selection state (not the provider model string). */
  id: string;
  /** svelte-i18n dictionary key for the option label. */
  labelKey: string;
  /** Provider `model` id for {@link AiSubmitJobInput.model} (e.g. Atlas). */
  model: string;
  /** Optional JSON Schema subset describing provider job body fields (Story 4.1). */
  inputSchema?: AiInputSchema;
}

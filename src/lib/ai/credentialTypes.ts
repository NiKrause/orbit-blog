/**
 * AI OrbitDB credential documents (Epic 2). API keys are never stored plaintext.
 */

/** Stored alongside ciphertext for AES-GCM (v1). */
export interface AiEncryptedApiKeyPayload {
  v: 1;
  alg: 'AES-GCM';
  /** Random 12-byte IV, standard base64 */
  ivB64: string;
  /** Ciphertext, standard base64 */
  ciphertextB64: string;
}

/** One row per model id in the AI documents database. */
export interface AiCredentialDocument {
  schemaVersion: 1;
  modelId: string;
  baseUrl: string;
  encryptedApiKey: AiEncryptedApiKeyPayload;
}

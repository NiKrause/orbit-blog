/**
 * Identity-bound AES-256-GCM for AI provider API keys.
 * Uses HKDF-SHA256 from the same 32-byte seed as OrbitDB identity (see convertTo32BitSeed).
 *
 * Does not use translation Settings keys (aiApiKey / aiApiUrl).
 */

import type { AiEncryptedApiKeyPayload } from './credentialTypes.js';

/** HKDF info string — changing it rotates derived keys for all credentials. */
export const AI_CREDENTIAL_HKDF_INFO = 'bolt-orbitdb-blog-ai-credential-v1';

function getSubtle(): SubtleCrypto {
  const c = globalThis.crypto;
  if (!c?.subtle) {
    throw new Error(
      'Web Crypto subtle is unavailable; ensure Node 20+ or assign globalThis.crypto from node:crypto webcrypto in tests'
    );
  }
  return c.subtle;
}

function u8ToB64(u8: Uint8Array): string {
  let s = '';
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]!);
  return btoa(s);
}

function b64ToU8(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function to32ByteSeed(identitySeed32: Uint8Array | Buffer): Uint8Array {
  const u8 = identitySeed32 instanceof Uint8Array ? identitySeed32 : new Uint8Array(identitySeed32);
  if (u8.length !== 32) {
    throw new Error('identity seed must be 32 bytes');
  }
  return u8;
}

async function deriveAesKey(identitySeed32: Uint8Array | Buffer): Promise<CryptoKey> {
  /** Copy so `BufferSource` is a concrete ArrayBuffer-backed view (TS + Web Crypto). */
  const ikm = new Uint8Array(to32ByteSeed(identitySeed32));
  const subtle = getSubtle();
  const baseKey = await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveKey']);
  const info = new TextEncoder().encode(AI_CREDENTIAL_HKDF_INFO);
  /** Salt empty: IKM is already a high-entropy 32-byte secret; HKDF `info` separates this use from other HKDF-derived keys. */
  return subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0),
      info,
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a UTF-8 API key for storage in OrbitDB.
 */
export async function encryptApiKey(
  identitySeed32: Uint8Array | Buffer,
  plaintextApiKey: string
): Promise<AiEncryptedApiKeyPayload> {
  const key = await deriveAesKey(identitySeed32);
  const iv = new Uint8Array(12);
  const c = globalThis.crypto;
  if (!c?.getRandomValues) {
    throw new Error('Web Crypto getRandomValues is unavailable');
  }
  c.getRandomValues(iv);
  const pt = new TextEncoder().encode(plaintextApiKey);
  const subtle = getSubtle();
  const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, key, pt));
  return {
    v: 1,
    alg: 'AES-GCM',
    ivB64: u8ToB64(iv),
    ciphertextB64: u8ToB64(ct),
  };
}

/**
 * Decrypt API key bytes previously produced by encryptApiKey.
 */
export async function decryptApiKey(
  identitySeed32: Uint8Array | Buffer,
  payload: AiEncryptedApiKeyPayload
): Promise<string> {
  if (payload.v !== 1 || payload.alg !== 'AES-GCM') {
    throw new Error('Unsupported encrypted API key format');
  }
  const key = await deriveAesKey(identitySeed32);
  const iv = new Uint8Array(b64ToU8(payload.ivB64));
  const ct = new Uint8Array(b64ToU8(payload.ciphertextB64));
  const subtle = getSubtle();
  const pt = await subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return new TextDecoder().decode(pt);
}

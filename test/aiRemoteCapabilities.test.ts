import assert from 'node:assert/strict';
import {
  AI_REMOTE_PROTOCOL_VERSION,
  decodeAiCapabilitiesPayload,
  encodeAiCapabilitiesPayload,
  LE_SPACE_AI_CAPABILITIES_TOPIC,
  validateAiCapabilitiesPayload,
} from '../src/lib/ai/aiRemoteCapabilities.js';

describe('AI remote capabilities payload (story 6.1)', () => {
  it('exports stable topic and protocol version', () => {
    assert.equal(AI_REMOTE_PROTOCOL_VERSION, 1);
    assert.match(LE_SPACE_AI_CAPABILITIES_TOPIC, /^le-space\./);
  });

  it('validateAiCapabilitiesPayload accepts well-formed v1 payload', () => {
    const raw = { protocolVersion: 1, models: ['kwaivgi-kling-v3-pro-i2v'] };
    const r = validateAiCapabilitiesPayload(raw, AI_REMOTE_PROTOCOL_VERSION);
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.deepEqual(r.value.models, ['kwaivgi-kling-v3-pro-i2v']);
    }
  });

  it('validateAiCapabilitiesPayload rejects version mismatch', () => {
    const raw = { protocolVersion: 99, models: ['a'] };
    const r = validateAiCapabilitiesPayload(raw, AI_REMOTE_PROTOCOL_VERSION);
    assert.equal(r.ok, false);
  });

  it('validateAiCapabilitiesPayload rejects empty models', () => {
    assert.equal(
      validateAiCapabilitiesPayload({ protocolVersion: 1, models: [] }, AI_REMOTE_PROTOCOL_VERSION).ok,
      false,
    );
    assert.equal(
      validateAiCapabilitiesPayload({ protocolVersion: 1, models: [''] }, AI_REMOTE_PROTOCOL_VERSION).ok,
      false,
    );
  });

  it('encode + decode round-trip', () => {
    const payload = {
      protocolVersion: AI_REMOTE_PROTOCOL_VERSION,
      models: ['kwaivgi-kling-v3-pro-i2v', 'kwaivgi-kling-v3-std-i2v'],
    };
    const bytes = encodeAiCapabilitiesPayload(payload);
    const back = decodeAiCapabilitiesPayload(bytes, AI_REMOTE_PROTOCOL_VERSION);
    assert.equal(back.ok, true);
    if (back.ok) {
      assert.deepEqual(back.value, payload);
    }
  });

  it('decodeAiCapabilitiesPayload returns ok:false for invalid JSON bytes', () => {
    const bytes = new TextEncoder().encode('{not json');
    const r = decodeAiCapabilitiesPayload(bytes, AI_REMOTE_PROTOCOL_VERSION);
    assert.equal(r.ok, false);
  });

  it('decodeAiCapabilitiesPayload returns ok:false for empty input', () => {
    assert.equal(decodeAiCapabilitiesPayload(new Uint8Array(0), AI_REMOTE_PROTOCOL_VERSION).ok, false);
  });
});

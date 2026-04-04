import assert from 'node:assert/strict';
import { buildSubmitJobInput, cidOrHttpToImageUrl } from '../src/lib/ai/buildSubmitJobInput.js';
import type { AiModelManifest } from '../src/lib/ai/types.js';

describe('cidOrHttpToImageUrl', () => {
  it('passes through https URLs', () => {
    assert.strictEqual(cidOrHttpToImageUrl('https://example.com/x.jpg'), 'https://example.com/x.jpg');
  });

  it('maps bare CID to dweb gateway URL', () => {
    const cid = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';
    assert.strictEqual(cidOrHttpToImageUrl(cid), `https://dweb.link/ipfs/${cid}`);
  });
});

describe('buildSubmitJobInput', () => {
  it('maps manifest model and Kling-like body fields', () => {
    const manifest: AiModelManifest = {
      id: 'kwaivgi-kling-v3-pro-i2v',
      labelKey: 'ai_model_kling_v3_pro_i2v',
      model: 'kwaivgi/kling-v3.0-pro/image-to-video',
      inputSchema: {
        type: 'object',
        required: ['prompt'],
        properties: {
          prompt: { type: 'string', titleKey: 'ai_schema_field_prompt' },
          image: { type: 'string', titleKey: 'ai_schema_field_image_url', 'x-ui': 'image' },
          duration: { type: 'integer', minimum: 1, maximum: 60, titleKey: 'ai_schema_field_duration' },
        },
      },
    };
    const input = buildSubmitJobInput(manifest, {
      prompt: 'hello',
      image: 'bafybeig',
      duration: 10,
    });
    assert.strictEqual(input.model, 'kwaivgi/kling-v3.0-pro/image-to-video');
    assert.strictEqual(input.body.prompt, 'hello');
    assert.strictEqual(input.body.image_url, 'https://dweb.link/ipfs/bafybeig');
    assert.strictEqual(input.body.duration, 10);
  });

  it('uses first schema-ordered x-ui:image only when multiple are present', () => {
    const manifest: AiModelManifest = {
      id: 'm',
      labelKey: 'ai_model_kling_v3_pro_i2v',
      model: 'kwaivgi/kling-v3.0-pro/image-to-video',
      inputSchema: {
        type: 'object',
        required: ['prompt'],
        properties: {
          prompt: { type: 'string', titleKey: 'ai_schema_field_prompt' },
          image: { type: 'string', titleKey: 'ai_schema_field_image_url', 'x-ui': 'image' },
          imageB: { type: 'string', titleKey: 'ai_schema_field_image_url', 'x-ui': 'image' },
        },
      },
    };
    const input = buildSubmitJobInput(manifest, {
      prompt: 'x',
      image: 'bafyFIRST',
      imageB: 'bafySECOND',
    });
    assert.strictEqual(input.body.image_url, 'https://dweb.link/ipfs/bafyFIRST');
    assert.strictEqual((input.body as { imageB?: string }).imageB, undefined);
  });
});

import assert from 'node:assert/strict';
import {
  getManifestById,
  getProviderModelForId,
  listKlingI2vManifests,
} from '../src/lib/ai/modelRegistry.js';

describe('Kling I2V model registry (story 3.2)', () => {
  it('lists exactly Pro and Standard with Atlas model strings', () => {
    const list = listKlingI2vManifests();
    assert.equal(list.length, 2);
    const models = list.map((m) => m.model).sort();
    assert.deepEqual(
      models,
      ['kwaivgi/kling-v3.0-pro/image-to-video', 'kwaivgi/kling-v3.0-std/image-to-video'].sort(),
    );
  });

  it('resolves provider model by manifest id', () => {
    assert.equal(
      getProviderModelForId('kwaivgi-kling-v3-pro-i2v'),
      'kwaivgi/kling-v3.0-pro/image-to-video',
    );
    assert.equal(
      getProviderModelForId('kwaivgi-kling-v3-std-i2v'),
      'kwaivgi/kling-v3.0-std/image-to-video',
    );
    assert.equal(getManifestById('missing'), undefined);
  });
});

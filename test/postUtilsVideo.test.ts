import assert from 'node:assert/strict';
import {
  addCidToSelectedMedia,
  appendVideoEmbedToContent,
  removeVideoEmbedFromContent,
} from '../src/lib/utils/videoEmbedUtils.js';

describe('videoEmbedUtils (Story 5.2)', () => {
  const cid = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';

  it('appendVideoEmbedToContent adds video block with data-ipfs-cid', () => {
    const out = appendVideoEmbedToContent('hello', cid);
    assert.match(out, /data-ipfs-cid="/);
    assert.match(out, new RegExp(cid));
    assert.ok(out.includes('<video'));
  });

  it('removeVideoEmbedFromContent strips the block', () => {
    const withVid = appendVideoEmbedToContent('x', cid);
    const stripped = removeVideoEmbedFromContent(cid, withVid);
    assert.equal(stripped, 'x');
  });

  it('addCidToSelectedMedia dedupes', () => {
    assert.deepEqual(addCidToSelectedMedia('a', ['a']), ['a']);
    assert.deepEqual(addCidToSelectedMedia('b', ['a']), ['a', 'b']);
  });
});

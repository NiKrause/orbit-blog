import { withBitswap } from '@helia/bitswap';
import { withHTTP } from '@helia/http';
import { withLibp2p } from '@helia/libp2p';
import * as dagCbor from '@ipld/dag-cbor';
import * as dagJson from '@ipld/dag-json';
import { createHeliaLight, type HeliaInit } from 'helia';
import type { Libp2p } from 'libp2p';
import * as json from 'multiformats/codecs/json';
import { sha512 } from 'multiformats/hashes/sha2';

/**
 * Build the Helia 7 stack around the app's configured libp2p node.
 *
 * Helia 7 no longer accepts `libp2p` in `createHelia`. Networking and block
 * brokers are composed explicitly so OrbitDB keeps using the deterministic
 * libp2p identity and persistent stores created by Orbit Blog.
 */
export function createHeliaWithLibp2p(libp2pNode: Libp2p, init: HeliaInit = {}) {
  return withBitswap(
    withLibp2p(
      withHTTP(
        createHeliaLight({
          ...init,
          codecs: [dagCbor, dagJson, json, ...(init.codecs ?? [])],
          hashers: [sha512, ...(init.hashers ?? [])],
        }),
      ),
      libp2pNode,
    ),
  );
}

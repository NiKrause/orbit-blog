import HDKey from "hdkey";
import { keys } from 'libp2p-crypto';
/**
 * Make an sha256 hash
 * @param (string) input
 * @returns {Promise<string>}
 */
export declare function sha256(input: any): Promise<string>;
/**
 * ConvertTo32BitSeed: Takes our masterSeed with 64 bit and converts it deterministically to 32 bit seed
 * @param origSeed
 * @returns {Buffer}
 */
export declare function convertTo32BitSeed(origSeed: any): Buffer<ArrayBufferLike>;
/**
 * Generates a master seed from a mnemonic and a password
 * @type {{return: string}}
 */
export declare const generateMasterSeed: (mnemonicSeedphrase: any, password: any, toHex?: boolean) => string | Buffer<ArrayBufferLike>;
/**
 * libp2p needs a PeerId which we generate from a seed phrase
 */
import type { PeerId } from '@libp2p/interface';
import type { PrivateKey } from 'libp2p-crypto';
export declare function createPeerIdFromSeedPhrase(seedPhrase: string): Promise<{
    peerId: PeerId;
    privateKey: PrivateKey;
}>;
export declare const createHdKeyFromMasterKey: (masterseed: any, network: any) => HDKey;
export declare function generateAndSerializeKey(seed: Uint8Array): Promise<string>;
export declare function createKeyPairFromPrivateKey(privateKey: Buffer): Promise<keys.supportedKeys.ed25519.Ed25519PrivateKey>;
export declare function localStorageStore(key: any, initialValue: any): import("svelte/store").Writable<any>;
//# sourceMappingURL=utils.d.ts.map
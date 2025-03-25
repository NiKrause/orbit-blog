/**
 *
 * Create an IdentityProvider either an
 * - OrbitDBIdentityProviderDID or
 * - EthereumIdentityProvider
 *
 * //TODO open the seed decryption dialog if seed is encrypted
 *
 * @param type {string} 'ed25519' (for DID) or 'ethereum' (for Web3 or Metamask-wallet) support
 * @param seed a 32bit seed
 * @param ipfs the Helia instance
 * @returns {Promise<{identities: module:Identities~Identities, identity: {id: string, publicKey: Object, signatures: Object, type: string, sign: Function, verify: Function}, identityProvider}>}
 */
export declare function createIdentityProvider(type: string | undefined, seed: any, ipfs: any): Promise<{
    identities: any;
    identity: any;
    identityProvider: any;
} | undefined>;
export default createIdentityProvider;
//# sourceMappingURL=identityProvider.d.ts.map
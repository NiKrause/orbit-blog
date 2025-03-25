/**
 * From a seed generate an identity and start an OrbitDB instance
 *
 * @param type {string} [type='ed25519'] default or 'ethereum' for web3/Metamask support
 * @param masterseed {string} our 64bit masterseed generated from the seedPhrase
 * @param helia the ipfs (Helia) instance to create an OrbitDB instance.
 *
 * @returns {Promise<{import('@orbitdb/core').OrbitDB}>}
 */
export declare const getIdentityAndCreateOrbitDB: (type: string | undefined, masterseed: any, helia: any) => Promise<any>;
//# sourceMappingURL=getIdendityAndCreateOrbitDB.d.ts.map
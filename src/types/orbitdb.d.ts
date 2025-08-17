declare module '@orbitdb/core' {
  export function createOrbitDB(options: any): any;
  export function IPFSAccessController(options: any): any;
  export function useIdentityProvider(provider: any): void;
  
  // Identities is a factory function that returns an object with methods
  export function Identities(options: { ipfs: any, keystore?: any, path?: string, storage?: any }): Promise<{
    createIdentity(options?: { id?: string, provider?: any }): Promise<any>;
    verifyIdentity(identity: any): Promise<boolean>;
    getIdentity(hash: string): Promise<any>;
    sign(identity: any, data: string): Promise<string>;
    verify(signature: string, publicKey: string, data: string): Promise<boolean>;
    keystore: any;
  }>;
}

declare module '@orbitdb/identity-provider-ethereum' {
  export default class EthereumIdentityProvider {
    constructor(options?: any);
    static type: string;
  }
}

declare module '@orbitdb/identity-provider-did' {
  export default class OrbitDBIdentityProviderDID {
    constructor(options?: any);
    static type: string;
  }
}

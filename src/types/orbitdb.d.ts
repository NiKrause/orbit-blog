declare module '@orbitdb/core' {
  export function createOrbitDB(options: any): any;
  export function IPFSAccessController(options: any): any;
  export function createIdentities(options: { ipfs: any }): Promise<any>;
  export function useIdentityProvider(provider: any): void;
  
  export interface Identities {
    identity: any;
    identities: any;
  }
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

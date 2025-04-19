// src/lib/orbitdb.ts
import { convertTo32BitSeed, generateMasterSeed } from './utils.js';
import createIdentityProvider from './identityProvider.js';
import type { HeliaInstance } from './types.js';

export async function getIdentity(_helia: HeliaInstance, seedPhrase: string) {
  // let seedPhrase = localStorage.getItem('seedPhrase');
  const masterSeed = generateMasterSeed(seedPhrase, "password")  
  const identitySeed = convertTo32BitSeed(masterSeed)
  const type = 'ed25519' 
  const idProvider = await createIdentityProvider(type, identitySeed, _helia)
  if (!idProvider) {
    throw new Error('Failed to create identity provider');
  }
  const _ourIdentity = idProvider.identity
  const _identities =  idProvider.identities  
  return { identity:_ourIdentity, identities:_identities }
}
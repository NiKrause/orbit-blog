// src/lib/orbitdb.ts
import { convertTo32BitSeed, generateMasterSeed } from './utils';
import createIdentityProvider from './identityProvider';

export async function getIdentity(_helia) {
  let seedPhrase = localStorage.getItem('seedPhrase');
  const masterSeed = generateMasterSeed(seedPhrase, "password")  
  const identitySeed = convertTo32BitSeed(masterSeed)
  const type = 'ed25519' 
  const idProvider = await createIdentityProvider(type, identitySeed, _helia)
  const _ourIdentity = idProvider.identity
  const _identities =  idProvider.identities  
  return { identity:_ourIdentity, identities:_identities }
}
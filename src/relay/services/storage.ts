import { LevelBlockstore } from 'blockstore-level'
import { LevelDatastore } from 'datastore-level'
import { join } from 'path'
import { loadOrCreateSelfKey } from '@libp2p/config'

export async function initializeStorage(hostDirectory: string) {
  const datastore = new LevelDatastore(join(hostDirectory, '/', 'ipfs', '/', 'data'))
  await datastore.open()
  
  const blockstore = new LevelBlockstore(join(hostDirectory, '/', 'ipfs', '/', 'blocks'))
  await blockstore.open()
  
  // @libp2p/config currently resolves a separate interface-datastore version,
  // so this cast avoids private-field type incompatibility across duplicates.
  const privateKey = await loadOrCreateSelfKey(datastore as any)
  
  return { datastore, blockstore, privateKey }
}

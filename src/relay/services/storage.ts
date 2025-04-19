import { LevelBlockstore } from 'blockstore-level'
import { LevelDatastore } from 'datastore-level'
import { join } from 'path'
import { loadOrCreateSelfKey } from '@libp2p/config'

export async function initializeStorage(hostDirectory: string) {
  const datastore = new LevelDatastore(join(hostDirectory, '/', 'ipfs', '/', 'data'))
  await datastore.open()
  
  const blockstore = new LevelBlockstore(join(hostDirectory, '/', 'ipfs', '/', 'blocks'))
  await blockstore.open()
  
  const privateKey = await loadOrCreateSelfKey(datastore)
  
  return { datastore, blockstore, privateKey }
}

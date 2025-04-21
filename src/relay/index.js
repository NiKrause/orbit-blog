import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import 'dotenv/config'
import { createLibp2p } from 'libp2p'
import { createHelia } from 'helia'
import { createLibp2pConfig } from './config/libp2p.js'
import { initializeStorage } from './services/storage.js'
import { DatabaseService } from './services/database.js'
import { MetricsServer } from './services/metrics.js'
import { setupEventHandlers } from './events/handlers.js'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { privateKeyFromProtobuf } from '@libp2p/crypto/keys'
import { logger, enable } from '@libp2p/logger'

const log = logger('le-space:relay')
 
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Add the test private key
const TEST_PRIVATE_KEY = '08011240821cb6bc3d4547fcccb513e82e4d718089f8a166b23ffcd4a436754b6b0774cf07447d1693cd10ce11ef950d7517bad6e9472b41a927cd17fc3fb23f8c70cd99'

async function main() {
  // enable("libp2p:*,le-space:relay")
  log('Starting relay server')
  const isTestMode = process.argv.includes('--test')
  let privateKey

  const hostDirectory = join(__dirname, '..', 'pinning-service')
  const storage = await initializeStorage(hostDirectory)
  const blockstore = storage.blockstore
  const datastore = storage.datastore

  if (isTestMode) {
    log('Running in test mode with fixed private key')
    privateKey = privateKeyFromProtobuf(uint8ArrayFromString(TEST_PRIVATE_KEY, 'hex'))
  } else {
    privateKey = storage.privateKey
  }
  
  const libp2p = await createLibp2p(createLibp2pConfig(privateKey))
  const ipfs = await createHelia({ libp2p, datastore, blockstore })
  
  const databaseService = new DatabaseService()
  await databaseService.initialize(ipfs)
  
  const cleanupEventHandlers = setupEventHandlers(libp2p, databaseService)
  
  const metricsServer = new MetricsServer()
  metricsServer.start()
  
  log(libp2p.peerId.toString())
  console.log('p2p addr: ', libp2p.getMultiaddrs().map((ma) => ma.toString()))
  
  // Handle graceful shutdown
  process.on('SIGINT', handleShutdown)
  process.on('SIGTERM', handleShutdown)
  process.on('unhandledRejection', (error) => {
    console.error('Unhandled rejection:', error)
  })

  async function handleShutdown() {
    log('Received shutdown signal. Cleaning up...')
    cleanupEventHandlers()
    await databaseService.cleanup()
    process.exit(0)
  }
}

main().catch(console.error)
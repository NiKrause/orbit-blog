import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import 'dotenv/config'
import { createLibp2p } from 'libp2p'
import { createLibp2pConfig } from './config/libp2p.js'
import { initializeStorage } from './services/storage.js'
import { PinningService } from './services/pinning.js'
import { MetricsServer } from './services/metrics.js'
import { setupEventHandlers } from './events/handlers.js'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { privateKeyFromProtobuf } from '@libp2p/crypto/keys'
import { logger, enable } from '@libp2p/logger'
const log = logger('le-space:relay')
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const TEST_PRIVATE_KEY = process.env.TEST_PRIVATE_KEY

async function main() {
  log('Starting relay server')
  const isTestMode = process.argv.includes('--test')
  let privateKey

  // const hostDirectory = join(__dirname, '..', 'pinning-service')
  const storage = await initializeStorage('./orbitdb/pinning-service')
  const blockstore = storage.blockstore
  const datastore = storage.datastore

  if (isTestMode) {
    log('Running in test mode with fixed private key')
    privateKey = privateKeyFromProtobuf(uint8ArrayFromString(TEST_PRIVATE_KEY, 'hex'))
  } else {
    privateKey = storage.privateKey
  }
  
  const libp2p = await createLibp2p(createLibp2pConfig(privateKey))

  const pinningDisabled = process.env.DISABLE_PINNING === 'true'
  const pinningService = pinningDisabled ? null : new PinningService()
  if (pinningService) {
    await pinningService.initialize(libp2p, datastore, blockstore)
  } else {
    log('Pinning service disabled via DISABLE_PINNING=true')
  }

  await setupEventHandlers(libp2p, pinningService || {
    syncAllOrbitDBRecords: async () => {}
  })
  const metricsServer = new MetricsServer()
  metricsServer.start()
  
  log(libp2p.peerId.toString())
  console.log('p2p addr: ', libp2p.getMultiaddrs().map((ma) => ma.toString()))
  
  // Handle graceful shutdown
  process.on('SIGINT', handleShutdown)
  process.on('SIGTERM', handleShutdown)
  process.on('unhandledRejection', (error) => {
    console.error('Unhandled rejection:', error)
    handleShutdown()
  })

  if (libp2p.connectionManager) {
    libp2p.connectionManager.addEventListener('peer:disconnect', (evt) => {
      console.log('hangup', evt.detail)
    })
  } else {
    console.error('ConnectionManager is not initialized. Cannot add event listener.');
  }

  async function handleShutdown() {
    if (pinningService) {
      await pinningService.cleanup()
    }
    await datastore.close()
    await blockstore.close()
    log('Received shutdown signal. Cleaning up...')
    // cleanupEventHandlers()
    // await databaseService.cleanup()
    process.exit(0)
  }
}

main().catch(console.error)

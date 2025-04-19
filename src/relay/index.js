import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { createLibp2p } from 'libp2p'
import { createHelia } from 'helia'
import { createLibp2pConfig } from './config/libp2p.js'
import { initializeStorage } from './services/storage.js'
import { DatabaseService } from './services/database.js'
import { MetricsServer } from './services/metrics.js'
import { setupEventHandlers } from './events/handlers.js'
import { log, info } from './utils/logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function main() {
  log('Starting relay server')

  const hostDirectory = join(__dirname, '..', 'pinning-service')
  const { datastore, blockstore, privateKey } = await initializeStorage(hostDirectory)
  
  const libp2p = await createLibp2p(createLibp2pConfig(privateKey))
  const ipfs = await createHelia({ libp2p, datastore, blockstore })
  
  const databaseService = new DatabaseService()
  await databaseService.initialize(ipfs)
  
  setupEventHandlers(libp2p, databaseService)
  
  const metricsServer = new MetricsServer()
  metricsServer.start()
  
  info(libp2p.peerId.toString())
  info('p2p addr: ', libp2p.getMultiaddrs().map((ma) => ma.toString()))
  
  // Handle graceful shutdown
  process.on('SIGINT', handleShutdown)
  process.on('SIGTERM', handleShutdown)
  process.on('unhandledRejection', (error) => {
    console.error('Unhandled rejection:', error)
  })

  async function handleShutdown() {
    console.log('Received shutdown signal. Cleaning up...')
    await databaseService.cleanup()
    process.exit(0)
  }
}

main().catch(console.error)
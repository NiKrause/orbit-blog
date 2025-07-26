import { logger, enable } from '@libp2p/logger'
import { loggingConfig } from '../config/logging.js'

// Conditional logging based on configuration
const baseLogger = logger('le-space:relay')

// Enable logging conditionally
if (loggingConfig.enableGeneralLogs) {
  enable("le-space:relay:*")
}

// Sync-specific logger that's always enabled when sync logs are enabled
const syncLogger = logger('le-space:relay:sync')
if (loggingConfig.enableSyncLogs) {
  enable("le-space:relay:sync")
}

// Configurable logging functions
export const log = loggingConfig.enableGeneralLogs ? baseLogger : () => {}
export const info = loggingConfig.enableGeneralLogs ? baseLogger : () => {}
export const syncLog = loggingConfig.enableSyncLogs ? syncLogger : () => {}

// Database sync statistics logger
export const logSyncStats = (dbType, address, peerId, recordCounts, previousCounts = {}) => {
  if (!loggingConfig.enableSyncStats) return
  
  const timestamp = new Date().toISOString()
  const changes = {
    posts: (recordCounts.posts || 0) - (previousCounts.posts || 0),
    comments: (recordCounts.comments || 0) - (previousCounts.comments || 0),
    media: (recordCounts.media || 0) - (previousCounts.media || 0)
  }
  
  const hasChanges = Object.values(changes).some(change => change !== 0)
  
  if (hasChanges || loggingConfig.enableSyncLogs) {
    console.log(`[${timestamp}] 🔄 DB_SYNC: ${dbType}`)  
    console.log(`  📍 Address: ${address}`)
    console.log(`  👤 Peer: ${peerId || 'local'}`)
    console.log(`  📊 Records: Posts=${recordCounts.posts || 0}, Comments=${recordCounts.comments || 0}, Media=${recordCounts.media || 0}`)
    if (hasChanges) {
      console.log(`  📈 Changes: Posts=${changes.posts >= 0 ? '+' : ''}${changes.posts}, Comments=${changes.comments >= 0 ? '+' : ''}${changes.comments}, Media=${changes.media >= 0 ? '+' : ''}${changes.media}`)
    }
    console.log('  ─────────────────────────────────────────────────────────')
  }
}

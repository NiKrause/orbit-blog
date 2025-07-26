import 'dotenv/config'

export const loggingConfig = {
  // General logging control
  enableGeneralLogs: process.env.ENABLE_GENERAL_LOGS === 'true' || false,
  
  // Database sync logging (always enabled for your use case)
  enableSyncLogs: process.env.ENABLE_SYNC_LOGS !== 'false',
  
  // Enable detailed sync statistics
  enableSyncStats: process.env.ENABLE_SYNC_STATS !== 'false',
  
  // Log levels for different components
  logLevels: {
    connection: process.env.LOG_LEVEL_CONNECTION === 'true' || false,
    peer: process.env.LOG_LEVEL_PEER === 'true' || false,
    database: process.env.LOG_LEVEL_DATABASE === 'true' || false,
    sync: process.env.LOG_LEVEL_SYNC !== 'false' // Default to true
  }
}

export default loggingConfig

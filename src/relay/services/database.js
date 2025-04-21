import { createOrbitDB } from '@orbitdb/core'
import { MetricsServer } from './metrics.js'

export class DatabaseService {
  constructor() {
    this.openDatabases = new Set()
    this.metrics = new MetricsServer()
    this.identityDatabases = new Map()
  }

  async initialize(ipfs) {
    this.orbitdb = await createOrbitDB({ ipfs })
  }

  async syncAllOrbitDBRecords(protocols) {
    const counts = {}
    const endTimer = this.metrics.startSyncTimer('all_databases')
    
    for (const protocol of protocols) {
      try {
        const db = await this.orbitdb.open(protocol)
        this.setupDatabaseListeners(db)
        this.openDatabases.add(db)
        this.metrics.trackSync('database_open', 'success')
      } catch (error) {
        console.error(`Error opening database ${protocol}:`, error)
        this.metrics.trackSync('database_open', 'error')
      }
    }
    
    endTimer() // Stop timing the sync operation
    return counts
  }

  setupDatabaseListeners(db) {
    db.events.on('join', async () => {
      const endTimer = this.metrics.startSyncTimer('database_join')
      try {
        const records = await db.all()
        if (db.name.startsWith('settings')) {
          await this.handleSettingsDatabase(db, records)
        }
        this.metrics.trackSync('database_join', 'success')
      } catch (error) {
        this.metrics.trackSync('database_join', 'error')
      } finally {
        endTimer()
      }
    })
  }

  async handleSettingsDatabase(db, records) {
    const postsDBRecord = records.find(record => record.key === 'postsDBAddress')
    if (postsDBRecord?.value.value) {
      try {
        const postsDB = await this.orbitdb.open(postsDBRecord.value.value)
      } catch (error) {
        console.error('Error opening posts database:', error)
      }
    }
  }
  async cleanup() {
    for (const db of this.openDatabases) {
      try {
        await db.close()
        this.openDatabases.delete(db)
      } catch (error) {
        console.error('Error closing database:', error)
      }
    }
    await this.orbitdb.stop()
  }
}

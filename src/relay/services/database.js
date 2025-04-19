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

  async getAllOrbitDBRecords(protocols) {
    const counts = {}
    for (const protocol of protocols) {
      try {
        const db = await this.orbitdb.open(protocol)
        this.setupDatabaseListeners(db)
        this.openDatabases.add(db)
        
        const identityId = db.identity.id
        if (!this.identityDatabases.has(identityId)) {
          this.identityDatabases.set(identityId, new Set())
        }
        this.identityDatabases.get(identityId).add(db.address.toString())
        
        this.metrics.orbitdbCounter.inc({ type: 'opendbs', identity: identityId })
        
        this.metrics.identityGauge.set(
          { identity: identityId }, 
          this.identityDatabases.get(identityId).size
        )
      } catch (error) {
        console.error(`Error opening database ${protocol}:`, error)
      }
    }
    return counts
  }

  setupDatabaseListeners(db) {
    db.events.on('join', async () => {
      const records = await db.all()
      if (db.name.startsWith('settings')) {
        await this.handleSettingsDatabase(db, records)
      }
    })
  }

  async handleSettingsDatabase(db, records) {
    const postsDBRecord = records.find(record => record.key === 'postsDBAddress')
    if (postsDBRecord?.value.value) {
      try {
        const postsDB = await this.orbitdb.open(postsDBRecord.value.value)
        this.metrics.orbitdbCounter.inc({ type: 'posts' })
        this.metrics.postsGauge.set({ database_address: postsDB.address.toString() }, await postsDB.all().length)
      } catch (error) {
        console.error('Error opening posts database:', error)
      }
    }
  }

  getIdentityMetrics() {
    const metrics = []
    for (const [identityId, databases] of this.identityDatabases.entries()) {
      metrics.push({
        identityId,
        databaseCount: databases.size,
        databases: Array.from(databases)
      })
    }
    return metrics.sort((a, b) => b.databaseCount - a.databaseCount)
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

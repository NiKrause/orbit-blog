import { createOrbitDB } from '@orbitdb/core'
import { MetricsServer } from './metrics.js'
import { logger } from '@libp2p/logger'
const log = logger('le-space:relay')

export class DatabaseService {
  constructor() {
    this.metrics = new MetricsServer()
    this.identityDatabases = new Map()
  }

  async initialize(ipfs) {
    this.orbitdb = await createOrbitDB({ ipfs })
  }

  async syncAllOrbitDBRecords(dbAddress) {
    log("syncing", dbAddress)
    let counts 
    const endTimer = this.metrics.startSyncTimer('all_databases')
      try {
        const db = await this.orbitdb.open(dbAddress)
        const records = await db.all()
        log(`records opened ${records.length} ${db.name}`)
        db.events.on('join', async () => { console.log("joined",db.name)})
        db.events.on('update', async () => { console.log("update",db.name)})
        db.events.on('error', async () => { console.log("error",db.name)})
        //this.setupDatabaseListeners(db)

        log('Database identity:', db.identity.id)       
        this.metrics.trackSync('database_open', 'success')
      } catch (error) {
        (`Error opening database ${dbAddress}:`, error)
        this.metrics.trackSync('database_open', 'error')
      }
    endTimer() // Stop timing the sync operation
    return counts
  }

  setupDatabaseListeners(db) {
    db.events.on('error', (error) => {
      log('database error', error)
      db.close()
    })
    db.events.on('join', async () => {
      log('joined', db.name)
      console.log("joined",db.name)
      // const endTimer = this.metrics.startSyncTimer('database_join')
      try {
        // log('syncing database', db.name)
        const count = await db.all()
        counts = count.length
        console.log("count",count)
        log('count', counts)
        // const records = await db.all()
        if (db.name.startsWith('settings')) {
          await this.handleSettingsDatabase(db, records)
        }
        db.close()
        // await ipfs1.blockstore.child.child.child.close()
        // this.metrics.trackSync('database_join', 'success')
      } catch (error) {
        // this.metrics.trackSync('database_join', 'error')
      } finally {
        endTimer()
      }
    })
  }

  async handleSettingsDatabase(db, records) {
    log('handleSettingsDatabase', db, records)
    const postsDBRecord = records.find(record => record.key === 'postsDBAddress')
    if (postsDBRecord?.value.value) {
      try {
        const postsDB = await this.orbitdb.open(postsDBRecord.value.value)
        log(`posts record count synced: ${postsDBRecord.name}`, (await postsDB.all()).length)
      } catch (_error) {
        log('Error opening posts database:', _error)
      }
    }
  }
}

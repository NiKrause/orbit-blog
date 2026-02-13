import { createOrbitDB } from '@orbitdb/core'
import { createHelia } from 'helia'
import { CID } from 'multiformats/cid'
import PQueue from 'p-queue'
import { syncLog } from '../utils/logger.js'

const ORBITDB_TOPIC_PREFIX = '/orbitdb/'
const CID_LIKE_PREFIXES = ['bafy', 'bafk', 'Qm']

const toRecordArray = (records) => {
  if (Array.isArray(records)) return records
  if (records && typeof records === 'object') {
    return Object.entries(records).map(([key, value]) => ({ key, value }))
  }
  return []
}

const extractCidCandidate = (value) => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed.startsWith('ipfs://')) return trimmed.slice('ipfs://'.length).split('/')[0]
  return trimmed
}

const looksLikeCid = (value) =>
  CID_LIKE_PREFIXES.some((prefix) => value.startsWith(prefix))

export class PinningService {
  constructor(options = {}) {
    this.allowedIdentities = new Set()
    this.pinnedDatabases = new Map()
    this.eventHandlers = new Map()
    this.updateTimers = new Map()
    this.processedCIDs = new Map()
    this.activeSyncs = new Set()
    this.queuedSyncs = new Set()
    this.syncQueue = new PQueue({ concurrency: options.concurrency || 2 })
    this.metrics = {
      totalPinnedDatabases: 0,
      syncOperations: 0,
      failedSyncs: 0,
      pinnedCids: 0
    }
    this.loadAllowedIdentities()
  }

  loadAllowedIdentities() {
    const envValue = process.env.PINNING_ALLOWED_IDENTITIES
    if (!envValue) {
      syncLog('No PINNING_ALLOWED_IDENTITIES configured; pinning all OrbitDB identities')
      return
    }

    for (const identity of envValue.split(',').map((value) => value.trim()).filter(Boolean)) {
      this.allowedIdentities.add(identity)
    }
    syncLog(`Loaded ${this.allowedIdentities.size} allowed identities for pinning`)
  }

  shouldPinDatabase(identityId) {
    if (this.allowedIdentities.size === 0) return true
    return this.allowedIdentities.has(identityId)
  }

  async initialize(libp2p, datastore, blockstore) {
    this.helia = await createHelia({ libp2p, datastore, blockstore })
    this.orbitdb = await createOrbitDB({ ipfs: this.helia })
    syncLog('Pinning service initialized')
  }

  async pinCid(cidString, context = '') {
    if (!cidString) return false
    try {
      const cid = CID.parse(cidString)
      await this.helia.pins.add(cid)
      this.metrics.pinnedCids += 1
      if (context) syncLog(`Pinned CID (${context}): ${cidString}`)
      return true
    } catch (error) {
      syncLog(`Failed to pin CID ${cidString}${context ? ` (${context})` : ''}:`, error?.message || error)
      return false
    }
  }

  collectCidsFromValue(value, cids) {
    if (value == null) return

    if (Array.isArray(value)) {
      for (const item of value) this.collectCidsFromValue(item, cids)
      return
    }

    if (typeof value === 'object') {
      for (const nested of Object.values(value)) this.collectCidsFromValue(nested, cids)
      return
    }

    const candidate = extractCidCandidate(value)
    if (!candidate || !looksLikeCid(candidate)) return

    try {
      CID.parse(candidate)
      cids.add(candidate)
    } catch {
      // Non-CID string, ignore.
    }
  }

  async processExistingCids(db, dbAddress) {
    const processed = this.processedCIDs.get(dbAddress) || new Set()
    const pending = new Set()

    if (typeof db.log?.iterator === 'function') {
      try {
        for await (const entry of db.log.iterator()) {
          if (entry?.hash && typeof entry.hash === 'string') {
            pending.add(entry.hash)
          }
        }
      } catch (error) {
        syncLog(`Error reading OrbitDB log iterator for ${db.name}:`, error?.message || error)
      }
    }

    try {
      const records = toRecordArray(await db.all())
      for (const record of records) {
        this.collectCidsFromValue(record?.value ?? record, pending)
      }
    } catch (error) {
      syncLog(`Error reading records for CID extraction from ${db.name}:`, error?.message || error)
    }

    for (const cid of pending) {
      if (processed.has(cid)) continue
      const pinned = await this.pinCid(cid, db.name)
      if (pinned) processed.add(cid)
    }

    this.processedCIDs.set(dbAddress, processed)
    syncLog(`CID sync for ${db.name}: ${processed.size} total pinned references`)
  }

  setupDatabaseListeners(db, dbAddress) {
    if (this.eventHandlers.has(dbAddress)) {
      const existing = this.eventHandlers.get(dbAddress)
      for (const [event, handler] of Object.entries(existing)) {
        db.events.removeListener(event, handler)
      }
    }

    const updateHandler = () => {
      if (this.updateTimers.has(dbAddress)) {
        clearTimeout(this.updateTimers.get(dbAddress))
      }

      const timer = setTimeout(async () => {
        try {
          await this.processExistingCids(db, dbAddress)
          const state = this.pinnedDatabases.get(dbAddress)
          if (state?.metadata) {
            state.metadata.lastSynced = new Date().toISOString()
            state.metadata.syncCount = (state.metadata.syncCount || 0) + 1
            this.pinnedDatabases.set(dbAddress, state)
          }
        } catch (error) {
          syncLog(`Error processing update event for ${db.name}:`, error?.message || error)
        } finally {
          this.updateTimers.delete(dbAddress)
        }
      }, 500)

      this.updateTimers.set(dbAddress, timer)
    }

    const joinHandler = async () => {
      try {
        await this.processExistingCids(db, dbAddress)
      } catch (error) {
        syncLog(`Error processing join event for ${db.name}:`, error?.message || error)
      }
    }

    const errorHandler = (error) => {
      syncLog(`Database error in ${db.name}:`, error?.message || error)
    }

    db.events.on('update', updateHandler)
    db.events.on('join', joinHandler)
    db.events.on('error', errorHandler)
    this.eventHandlers.set(dbAddress, {
      update: updateHandler,
      join: joinHandler,
      error: errorHandler
    })
  }

  async syncAndPinDatabase(dbAddress) {
    if (!dbAddress || this.activeSyncs.has(dbAddress)) return null
    this.activeSyncs.add(dbAddress)
    this.metrics.syncOperations += 1

    try {
      let db = this.pinnedDatabases.get(dbAddress)?.db
      if (!db) {
        db = await this.orbitdb.open(dbAddress)
      }

      const identityId = db?.identity?.id
      if (!this.shouldPinDatabase(identityId)) {
        syncLog(`Skipping ${db.name}: identity not in PINNING_ALLOWED_IDENTITIES`)
        return null
      }

      await this.processExistingCids(db, dbAddress)
      this.setupDatabaseListeners(db, dbAddress)

      const metadata = {
        name: db.name,
        type: db.type || 'unknown',
        identityId: identityId || null,
        lastSynced: new Date().toISOString(),
        syncCount: (this.pinnedDatabases.get(dbAddress)?.metadata?.syncCount || 0) + 1
      }

      if (!this.pinnedDatabases.has(dbAddress)) {
        this.metrics.totalPinnedDatabases += 1
      }

      this.pinnedDatabases.set(dbAddress, { db, metadata })
      syncLog(`Pinned OrbitDB database: ${db.name} (${dbAddress})`)
      return metadata
    } catch (error) {
      this.metrics.failedSyncs += 1
      syncLog(`Error syncing database ${dbAddress}:`, error?.message || error)
      return null
    } finally {
      this.activeSyncs.delete(dbAddress)
    }
  }

  async handleSubscriptionChange(topic) {
    if (!topic || !topic.startsWith(ORBITDB_TOPIC_PREFIX)) return

    if (this.queuedSyncs.has(topic) || this.activeSyncs.has(topic)) return
    this.queuedSyncs.add(topic)

    this.syncQueue
      .add(() => this.syncAndPinDatabase(topic))
      .finally(() => this.queuedSyncs.delete(topic))
      .catch((error) => syncLog(`Queue error for ${topic}:`, error?.message || error))
  }

  async handlePubsubMessage(message) {
    const topic = message?.topic
    if (!topic || !topic.startsWith(ORBITDB_TOPIC_PREFIX)) return
    await this.handleSubscriptionChange(topic)
  }

  getDetailedStats() {
    return {
      ...this.metrics,
      queueSize: this.syncQueue.size,
      queuePending: this.syncQueue.pending,
      pinnedDatabases: this.pinnedDatabases.size,
      allowedIdentities: this.allowedIdentities.size
    }
  }

  getPinnedDatabases() {
    return Array.from(this.pinnedDatabases.entries()).map(([address, value]) => ({
      address,
      ...value.metadata
    }))
  }

  async cleanup() {
    for (const timer of this.updateTimers.values()) clearTimeout(timer)
    this.updateTimers.clear()

    for (const [address, state] of this.pinnedDatabases.entries()) {
      const handlers = this.eventHandlers.get(address)
      if (handlers && state?.db?.events) {
        for (const [event, handler] of Object.entries(handlers)) {
          state.db.events.removeListener(event, handler)
        }
      }
      if (state?.db?.close) {
        try {
          await state.db.close()
        } catch (error) {
          syncLog(`Error closing pinned DB ${address}:`, error?.message || error)
        }
      }
    }

    this.eventHandlers.clear()
    this.pinnedDatabases.clear()

    if (this.orbitdb?.stop) {
      try {
        await this.orbitdb.stop()
      } catch (error) {
        syncLog('Error stopping OrbitDB in pinning cleanup:', error?.message || error)
      }
    }
  }
}

import { createOrbitDB } from '@orbitdb/core'
import { MetricsServer } from './metrics.js'
import { log, syncLog, logSyncStats } from '../utils/logger.js'
import { loggingConfig } from '../config/logging.js'

export class DatabaseService {
  constructor() {
    this.metrics = new MetricsServer()
    this.identityDatabases = new Map()
    this.databaseContexts = new Map() // Store database contexts for cross-referencing
    this.updateTimers = new Map() // Debouncing timers for update events
    this.openDatabases = new Map() // Track open databases to prevent duplicates
    this.eventHandlers = new Map() // Track event handlers for cleanup
  }

  async initialize(ipfs) {
    this.orbitdb = await createOrbitDB({ ipfs })
  }

  // Helper method to extract blog name from database name
  extractBlogName(dbName) {
    // Extract blog name from patterns like "freitags-blog-comments", "my-blog-posts", etc.
    const patterns = [
      /^(.+?)-(posts?|comments?|media|settings?)$/,
      /^(.+?)-(blog|site)-(posts?|comments?|media|settings?)$/,
      /^(.+?)$/
    ]
    
    for (const pattern of patterns) {
      const match = dbName.match(pattern)
      if (match) {
        return match[1].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
      }
    }
    return dbName
  }

  // Helper method to store database context
  storeDatabaseContext(dbAddress, context) {
    this.databaseContexts.set(dbAddress, context)
  }

  // Helper method to get related databases for a blog
  getRelatedDatabases(blogName) {
    const related = { posts: 0, comments: 0, media: 0, settings: 0 }
    
    for (const [address, context] of this.databaseContexts.entries()) {
      if (context.blogName === blogName) {
        if (context.type === 'posts') related.posts += context.recordCounts.posts
        else if (context.type === 'comments') related.comments += context.recordCounts.comments
        else if (context.type === 'media') related.media += context.recordCounts.media
        else if (context.type === 'settings') related.settings += context.recordCounts.posts + context.recordCounts.comments + context.recordCounts.media
      }
    }
    
    return related
  }

  async syncAllOrbitDBRecords(dbAddress) {
    syncLog("Starting sync for database:", dbAddress)
    let counts = { posts: 0, comments: 0, media: 0 }
    const endTimer = this.metrics.startSyncTimer('all_databases')
    
    try {
      // Check if database is already open to reuse connection
      let db
      if (this.openDatabases.has(dbAddress)) {
        syncLog(`Database already open, reusing existing connection for ${dbAddress}`)
        db = this.openDatabases.get(dbAddress)
      } else {
        db = await this.orbitdb.open(dbAddress)
        this.openDatabases.set(dbAddress, db)
        syncLog(`Database opened: ${db.name} (${db.type})`)
      }
      
      // Store previous counts if we have them
      const previousCounts = this.identityDatabases.get(dbAddress) || { posts: 0, comments: 0, media: 0 }
      
      // Fetch current records and counts
      const records = await db.all()
      
      // Debug: Log a sample record to understand the structure
      if (records.length > 0) {
        syncLog(`Sample record from ${db.name}:`, JSON.stringify(records[0], null, 2))
      }
      
      // Determine database type based on name and content
      let recordCounts = { posts: 0, comments: 0, media: 0 }
      let dbType = 'unknown'
      
      // Enhanced database type detection
      if (db.name.includes('posts') || db.name.includes('post')) {
        recordCounts.posts = records.length
        dbType = 'posts'
      } else if (db.name.includes('comments') || db.name.includes('comment')) {
        recordCounts.comments = records.length
        dbType = 'comments'
      } else if (db.name.includes('media')) {
        recordCounts.media = records.length
        dbType = 'media'
      } else if (db.name.includes('settings') || db.name.includes('config')) {
        dbType = 'settings'
        // Settings might contain various configuration data
        recordCounts = {
          posts: records.filter(r => 
            r.value?.type === 'post' || 
            r.key === 'post' || 
            (typeof r.value === 'object' && r.value?.title && r.value?.content)
          ).length,
          comments: records.filter(r => 
            r.value?.type === 'comment' || 
            r.key === 'comment' ||
            (typeof r.value === 'object' && r.value?.postId && r.value?.comment)
          ).length,
          media: records.filter(r => 
            r.value?.type === 'media' || 
            r.key === 'media' ||
            (typeof r.value === 'object' && (r.value?.filename || r.value?.url))
          ).length
        }
      } else {
        // For other databases, try to categorize by content
        recordCounts = {
          posts: records.filter(r => 
            r.value?.type === 'post' || 
            r.key === 'post' || 
            (typeof r.value === 'object' && r.value?.title && r.value?.content)
          ).length,
          comments: records.filter(r => 
            r.value?.type === 'comment' || 
            r.key === 'comment' ||
            (typeof r.value === 'object' && r.value?.postId && r.value?.comment)
          ).length,
          media: records.filter(r => 
            r.value?.type === 'media' || 
            r.key === 'media' ||
            (typeof r.value === 'object' && (r.value?.filename || r.value?.url))
          ).length
        }
      }
      
      // Extract blog context from database name
      const blogName = this.extractBlogName(db.name)
      
      // Store database context for cross-referencing
      this.storeDatabaseContext(dbAddress, {
        name: db.name,
        type: dbType,
        blogName,
        recordCounts,
        identity: db.identity?.id
      })
      
      // Update total counts
      counts = {
        posts: recordCounts.posts,
        comments: recordCounts.comments,
        media: recordCounts.media
      }
      
      syncLog(`Records found: ${records.length} total in ${db.name}`)
      
      // Enhanced logging with blog context
      const relatedCounts = this.getRelatedDatabases(blogName)
      const logContext = {
        dbType: dbType,
        blogName: blogName,
        currentDb: db.name,
        relatedCounts: relatedCounts,
        totalInBlog: relatedCounts.posts + relatedCounts.comments + relatedCounts.media + relatedCounts.settings
      }
      
      syncLog(`📝 Blog Context: "${blogName}" | Current DB: ${db.name} (${dbType}) | Related DBs: Posts=${relatedCounts.posts}, Comments=${relatedCounts.comments}, Media=${relatedCounts.media}, Settings=${relatedCounts.settings}`)
      
      // Log sync stats
      logSyncStats(db.type || 'unknown', dbAddress, db.identity?.id || 'unknown', counts, previousCounts)
      
      // Store current counts for next comparison
      this.identityDatabases.set(dbAddress, counts)
      
      // Clean up existing event listeners if they exist
      if (this.eventHandlers.has(dbAddress)) {
        const handlers = this.eventHandlers.get(dbAddress)
        for (const [event, handler] of Object.entries(handlers)) {
          db.events.removeListener(event, handler)
        }
      }
      
      // Create new event handlers
      const updateHandler = async () => { 
        syncLog(`Database updated: ${db.name}`)
        
        // Clear existing timer if it exists
        if (this.updateTimers.has(dbAddress)) {
          clearTimeout(this.updateTimers.get(dbAddress))
        }
        
        // Set a new timer to debounce multiple rapid updates
        const timer = setTimeout(async () => {
          try {
            const newRecords = await db.all()
            
            // Use the same logic as above for counting
            let newCounts = { posts: 0, comments: 0, media: 0 }
            
            if (db.name.includes('posts') || db.name.includes('post')) {
              newCounts.posts = newRecords.length
            } else if (db.name.includes('comments') || db.name.includes('comment')) {
              newCounts.comments = newRecords.length
            } else if (db.name.includes('media')) {
              newCounts.media = newRecords.length
            } else {
              newCounts = {
                posts: newRecords.filter(r => 
                  r.value?.type === 'post' || 
                  r.key === 'post' || 
                  (typeof r.value === 'object' && r.value?.title && r.value?.content)
                ).length,
                comments: newRecords.filter(r => 
                  r.value?.type === 'comment' || 
                  r.key === 'comment' ||
                  (typeof r.value === 'object' && r.value?.postId && r.value?.comment)
                ).length,
                media: newRecords.filter(r => 
                  r.value?.type === 'media' || 
                  r.key === 'media' ||
                  (typeof r.value === 'object' && (r.value?.filename || r.value?.url))
                ).length
              }
            }
            
            // Update the database context with new counts
            const context = this.databaseContexts.get(dbAddress)
            if (context) {
              context.recordCounts = newCounts
              this.databaseContexts.set(dbAddress, context)
            }
            
            // Get updated blog context
            const relatedCounts = this.getRelatedDatabases(blogName)
            syncLog(`📝 Blog Update: "${blogName}" | Updated DB: ${db.name} | Related DBs: Posts=${relatedCounts.posts}, Comments=${relatedCounts.comments}, Media=${relatedCounts.media}, Settings=${relatedCounts.settings}`)
            
            logSyncStats(db.type || 'unknown', dbAddress, db.identity?.id || 'unknown', newCounts, counts)
            this.identityDatabases.set(dbAddress, newCounts)
            
            // Clean up the timer
            this.updateTimers.delete(dbAddress)
          } catch (error) {
            syncLog(`Error processing update for ${db.name}:`, error.message)
          }
        }, 500) // 500ms debounce delay
        
        this.updateTimers.set(dbAddress, timer)
      }
      
      const errorHandler = async (error) => { 
        syncLog(`Database error in ${db.name}:`, error)
      }
      
      // Attach event listeners
      db.events.on('update', updateHandler)
      db.events.on('error', errorHandler)
      
      // Store handlers for cleanup
      this.eventHandlers.set(dbAddress, {
        update: updateHandler,
        error: errorHandler
      })
      
      syncLog(`Database identity: ${db.identity?.id}`)
      this.metrics.trackSync('database_open', 'success')
      
      // Keep database open for replication
      // Don't close immediately to allow for replication
      
    } catch (error) {
      syncLog(`Error opening database ${dbAddress}:`, error.message)
      this.metrics.trackSync('database_open', 'error')
    }
    
    endTimer() // Stop timing the sync operation
    return counts
  }

  setupDatabaseListeners(db) {
    db.events.on('error', (error) => {
      syncLog('database error', error)
      db.close()
    })
    db.events.on('join', async () => {
      syncLog('joined', db.name)
      // const endTimer = this.metrics.startSyncTimer('database_join')
      try {
        // log('syncing database', db.name)
        const count = await db.all()
        counts = count.length
        syncLog("count", count.length)
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
    syncLog('handleSettingsDatabase', db.name)
    const postsDBRecord = records.find(record => record.key === 'postsDBAddress')
    if (postsDBRecord?.value.value) {
      try {
        const postsDB = await this.orbitdb.open(postsDBRecord.value.value)
        const postsRecords = await postsDB.all()
        const postsCount = postsRecords.length
        
        // Log sync stats for the posts database
        logSyncStats('posts', postsDBRecord.value.value, db.identity.id, {
          posts: postsCount,
          comments: 0,
          media: 0
        })
        
        await postsDB.close()
      } catch (_error) {
        syncLog('Error opening posts database:', _error)
      }
    }
  }
}

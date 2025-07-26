import { identify } from '@libp2p/identify'
import PQueue from 'p-queue'
import { WebSocketsSecure } from '@multiformats/multiaddr-matcher'
import { log, syncLog } from '../utils/logger.js'
import { loggingConfig } from '../config/logging.js'

export function setupEventHandlers(libp2p, databaseService) {
  const cleanupFunctions = []

  const peerConnectHandler = async event => {
    const peer = event.detail
    try {
      if (loggingConfig.logLevels.peer) {
        log('peer:connect', peer)
      }
      await identify(peer)
    } catch (err) {
      if (err.code !== 'ERR_UNSUPPORTED_PROTOCOL') {
        if (loggingConfig.logLevels.peer) {
          console.error('Failed to identify peer:', err)
        }
      }
    }
  }
  libp2p.addEventListener('peer:connect', peerConnectHandler)
  cleanupFunctions.push(() => libp2p.removeEventListener('peer:connect', peerConnectHandler))
  libp2p.addEventListener('gossipsub:message', (event) => {
    if (loggingConfig.logLevels.peer) {
      log('gossipsub', event)
    }
  })

  // Certificate provision handler
  const certificateHandler = () => {
    console.log('A TLS certificate was provisioned')
  
    const interval = setInterval(() => {
      const mas = libp2p
        .getMultiaddrs()
        .filter(ma => WebSocketsSecure.exactMatch(ma) && ma.toString().includes('/sni/'))
        .map(ma => ma.toString())
  
      if (mas.length > 0) {
        console.log('addresses:')
        console.log(mas.join('\n'))
        clearInterval(interval)
      }
    }, 1_000)
  }
  libp2p.addEventListener('certificate:provision', certificateHandler)
  cleanupFunctions.push(() => libp2p.removeEventListener('certificate:provision', certificateHandler))

  // Peer disconnect handler
  const peerDisconnectHandler = async event => {
    // log('peer:disconnect', event.detail)
    libp2p.peerStore.delete(event.detail)
  }
  libp2p.addEventListener('peer:disconnect', peerDisconnectHandler)
  cleanupFunctions.push(() => libp2p.removeEventListener('peer:disconnect', peerDisconnectHandler))

  // Setup pubsub message handler
  const syncQueue = new PQueue({ concurrency: 2 })

  const syncOrbitDBHandler = (msg) => {
    if (msg?.topic?.startsWith('/orbitdb/')) {
      syncLog('subscription-change', msg.topic)
      syncQueue.add(() => databaseService.syncAllOrbitDBRecords(msg.topic))
    }
  }
  
  // Subscribe to OrbitDB topics
  const orbitDBTopic = '/orbitdb/' // OrbitDB topic prefix
  
  // Subscribe to pubsub messages for OrbitDB
  const pubsubMessageHandler = (event) => {
    const msg = event.detail
    syncLog('Received pubsub message:', msg.topic)
    if (msg.topic && msg.topic.startsWith('/orbitdb/')) {
      syncLog('OrbitDB topic message received:', msg.topic)
      syncQueue.add(() => databaseService.syncAllOrbitDBRecords(msg.topic))
    }
  }
  
  libp2p.services.pubsub.addEventListener('message', pubsubMessageHandler)
  
  // Add cleanup for pubsub subscription
  cleanupFunctions.push(() => {
    libp2p.services.pubsub.removeEventListener('message', pubsubMessageHandler)
  })

  // Connection open handler - simplified to just log connections if needed
  const connectionOpenHandler = async (event) => {
    const connection = event.detail
    if (loggingConfig.logLevels.connection) {
      log('connection:open', connection.remoteAddr.toString())
    }
  }

  libp2p.addEventListener('connection:open', connectionOpenHandler)
  cleanupFunctions.push(() => libp2p.removeEventListener('connection:open', connectionOpenHandler))

  // Monitor all pubsub events
  const pubsub = libp2p.services.pubsub

  // For subscription changes
  pubsub.addEventListener('subscription-change', (event) => {
    syncLog('Subscription change event:', event.detail)
    
    // Handle new subscriptions
    if (event.detail?.subscriptions) {
      event.detail.subscriptions.forEach(subscription => {
        syncLog('New subscription:', subscription)
        if (subscription.topic && subscription.topic.startsWith('/orbitdb/')) {
          syncLog('OrbitDB subscription detected:', subscription.topic)
          syncQueue.add(() => databaseService.syncAllOrbitDBRecords(subscription.topic))
        }
      })
    }
  })
  
  // Also listen for topic joins
  pubsub.addEventListener('gossipsub:subscription-change', (event) => {
    syncLog('Gossipsub subscription change:', event.detail)
    if (event.detail?.topic?.startsWith('/orbitdb/')) {
      syncLog('OrbitDB gossipsub topic:', event.detail.topic)
      syncQueue.add(() => databaseService.syncAllOrbitDBRecords(event.detail.topic))
    }
  })

  return () => {
    cleanupFunctions.forEach(cleanup => cleanup())
  }
}

import { identify } from '@libp2p/identify'
import { logger, enable } from '@libp2p/logger'

import { WebSocketsSecure } from '@multiformats/multiaddr-matcher'
const log = logger('le-space:relay')

export function setupEventHandlers(libp2p, databaseService) {
  const cleanupFunctions = []

  const peerConnectHandler = async event => {
    const peer = event.detail
    try {
      // log('peer:connect', peer)
      await identify(peer)
    } catch (err) {
      if (err.code !== 'ERR_UNSUPPORTED_PROTOCOL') {
        console.error('Failed to identify peer:', err)
      }
    }
  }
  libp2p.addEventListener('peer:connect', peerConnectHandler)
  cleanupFunctions.push(() => libp2p.removeEventListener('peer:connect', peerConnectHandler))
  libp2p.addEventListener('gossipsub:message', (event) => {
    log('gossipsub', event)
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
  const syncOrbitDBHandler = (msg) => {
    if (msg?.topic?.startsWith('/orbitdb/')) {
      const protocol = msg.topic.replace('/orbitdb/', '')
      databaseService.syncAllOrbitDBRecords(protocol)
    }
  }
  
  // Subscribe to OrbitDB topics
  // const orbitDBTopic = '/orbitdb/#' // wildcard topic for all OrbitDB messages
  // libp2p.services.pubsub.subscribe(orbitDBTopic)
  // libp2p.services.pubsub.addEventListener('message', syncOrbitDBHandler)
  
  // Add cleanup for pubsub subscription
  cleanupFunctions.push(() => {
    // libp2p.services.pubsub.unsubscribe(orbitDBTopic)
    // libp2p.services.pubsub.removeEventListener('message', syncOrbitDBHandler)
  })

  // Connection open handler - simplified to just log connections if needed
  const connectionOpenHandler = async (event) => {
    const connection = event.detail
    // log('connection:open', connection.remoteAddr.toString())
  }

  libp2p.addEventListener('connection:open', connectionOpenHandler)
  cleanupFunctions.push(() => libp2p.removeEventListener('connection:open', connectionOpenHandler))

  // Monitor all pubsub events
  const pubsub = libp2p.services.pubsub

  // For subscription changes
  pubsub.addEventListener('subscription-change', (event) => {
    event.detail?.subscriptions?.forEach(subscription => {
      syncOrbitDBHandler(subscription)
    })
  })

  return () => {
    cleanupFunctions.forEach(cleanup => cleanup())
  }
}

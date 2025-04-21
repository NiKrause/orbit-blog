import { identify } from '@libp2p/identify'
import { logger, enable } from '@libp2p/logger'

import { WebSocketsSecure } from '@multiformats/multiaddr-matcher'
const log = logger('le-space:relay')

export function setupEventHandlers(libp2p, databaseService) {
  const cleanupFunctions = []

  const peerConnectHandler = async event => {
    const peer = event.detail
    try {
      log('peer:connect', peer)
      await identify(peer)
    } catch (err) {
      if (err.code !== 'ERR_UNSUPPORTED_PROTOCOL') {
        console.error('Failed to identify peer:', err)
      }
    }
  }
  libp2p.addEventListener('peer:connect', peerConnectHandler)
  cleanupFunctions.push(() => libp2p.removeEventListener('peer:connect', peerConnectHandler))

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
    log('peer:disconnect', event.detail)
    libp2p.peerStore.delete(event.detail)
  }
  libp2p.addEventListener('peer:disconnect', peerDisconnectHandler)
  cleanupFunctions.push(() => libp2p.removeEventListener('peer:disconnect', peerDisconnectHandler))

  // Connection open handler
  const connectionOpenHandler = async (event) => {
    const connection = event.detail
    log('connection:open', connection.remoteAddr.toString())
    try {
      //identify the peer
        const identifyResult = await libp2p.services.identify.identify(connection)
        const orbitDBProtocols = identifyResult.protocols
          .filter(protocol => protocol.startsWith('/orbitdb/heads'))
          .map(protocol => protocol.replace('/orbitdb/heads', ''))
        log('orbitDBProtocols', orbitDBProtocols)
        //sync all orbitdb records async do not wait
        databaseService.syncAllOrbitDBRecords(orbitDBProtocols)
      
      // log('Connection identify result:', {
      //   peerId: identifyResult.peerId.toString(),
      //   protocols: orbitDBProtocols,
      //   protocolVersion: identifyResult.protocolVersion,
      //   agentVersion: identifyResult.agentVersion
      // })
    } catch (err) {
      if (err.code !== 'ERR_UNSUPPORTED_PROTOCOL') {
        log('Error during identify triggered by connection:open', err)
      }
    }
  }
  libp2p.addEventListener('connection:open', connectionOpenHandler)
  cleanupFunctions.push(() => libp2p.removeEventListener('connection:open', connectionOpenHandler))

  // Return cleanup function
  return () => {
    cleanupFunctions.forEach(cleanup => cleanup())
  }
}

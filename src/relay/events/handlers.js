import { identify } from '@libp2p/identify'
import { logger, enable } from '@libp2p/logger'
const log = logger('le-space:relay:events')
export function setupEventHandlers(libp2p, databaseService) {
  libp2p.addEventListener('peer:connect', async event => {
    const peer = event.detail
    try {
      log('peer:connect', peer)
      await identify(peer)
    } catch (err) {
      if (err.code !== 'ERR_UNSUPPORTED_PROTOCOL') {
        console.error('Failed to identify peer:', err)
      }
    }
  })

  libp2p.addEventListener('certificate:provision', () => {
    log('A TLS certificate was provisioned')
  
    const interval = setInterval(() => {
      const mas = libp2p
        .getMultiaddrs()
        .filter(ma => WebSocketsSecure.exactMatch(ma) && ma.toString().includes('/sni/'))
        .map(ma => ma.toString())
  
      if (mas.length > 0) {
        log('addresses:')
        log(mas.join('\n'))
        clearInterval(interval)
      }
    }, 1_000)
  })


  libp2p.addEventListener('peer:disconnect', async event => {
    log('peer:disconnect', event.detail)
    libp2p.peerStore.delete(event.detail)
  })

  libp2p.addEventListener('connection:open', async (event) => {
    const connection = event.detail
    try {
      const identifyResult = await libp2p.services.identify.identify(connection)
      const orbitDBProtocols = identifyResult.protocols
        .filter(protocol => protocol.startsWith('/orbitdb/heads'))
        .map(protocol => protocol.replace('/orbitdb/heads', ''))
      
      await databaseService.getAllOrbitDBRecords(orbitDBProtocols)
      
      log('Connection identify result:', {
        peerId: identifyResult.peerId.toString(),
        protocols: orbitDBProtocols,
        protocolVersion: identifyResult.protocolVersion,
        agentVersion: identifyResult.agentVersion
      })
    } catch (err) {
      if (err.code !== 'ERR_UNSUPPORTED_PROTOCOL') {
        console.error('Error during identify triggered by connection:open', err)
      }
    }
  })
}

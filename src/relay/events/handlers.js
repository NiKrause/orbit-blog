import { identify } from '@libp2p/identify'
import { log } from '../utils/logger.js'

export function setupEventHandlers(libp2p, databaseService) {
  libp2p.addEventListener('peer:connect', async event => {
    const peer = event.detail
    try {
      await identify(peer)
    } catch (err) {
      if (err.code !== 'ERR_UNSUPPORTED_PROTOCOL') {
        console.error('Failed to identify peer:', err)
      }
    }
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

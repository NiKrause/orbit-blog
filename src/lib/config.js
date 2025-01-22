import { identify } from '@libp2p/identify'
import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { circuitRelayTransport } from '@libp2p/circuit-relay-v2';
import { webRTC, webRTCDirect } from '@libp2p/webrtc';
import { autoNAT } from '@libp2p/autonat';
import { dcutr } from '@libp2p/dcutr';
import { ping } from '@libp2p/ping';

export const Libp2pOptions = {
  peerDiscovery: [
  ],
  addresses: {
    listen: ['/p2p-circuit', '/webrtc']
  },
  transports: [
    circuitRelayTransport(),
    webRTC(),
    webRTCDirect()
  ],
  connectionEncrypters: [noise()],
  streamMuxers: [yamux()],
  services: {
    ping: ping(),
    identify: identify(),
    pubsub: gossipsub({ allowPublishToZeroTopicPeers: true }),
    autonat: autoNAT(),
    dcutr: dcutr()
  }
}
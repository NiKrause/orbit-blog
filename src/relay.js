import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { circuitRelayTransport } from '@libp2p/circuit-relay-v2'
import { identify } from '@libp2p/identify'
import { webRTC } from '@libp2p/webrtc'
import { webSockets } from '@libp2p/websockets'
import { createLibp2p } from 'libp2p'
import * as filters from '@libp2p/websockets/filters'

import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { privateKeyFromProtobuf } from '@libp2p/crypto/keys'
import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { pubsubPeerDiscovery } from '@libp2p/pubsub-peer-discovery'
import { bootstrap } from '@libp2p/bootstrap'
import { tcp } from '@libp2p/tcp'
import { webRTC } from '@libp2p/webrtc'
import { circuitRelayTransport } from '@libp2p/circuit-relay-v2'
import { ping } from '@libp2p/ping'
import { dcutr } from '@libp2p/dcutr'
import { autoNAT } from '@libp2p/autonat'
// output of: console.log(server.peerId.privateKey.toString('hex'))
const relayPrivKey = '08011240821cb6bc3d4547fcccb513e82e4d718089f8a166b23ffcd4a436754b6b0774cf07447d1693cd10ce11ef950d7517bad6e9472b41a927cd17fc3fb23f8c70cd99'
// the peer id of the above key
// const relayId = '12D3KooWAJjbRkp8FPF5MKgMU53aUTxWkqvDrs4zc1VMbwRwfsbE'

const privateKey = privateKeyFromProtobuf(uint8ArrayFromString(relayPrivKey, 'hex'))

const server = await createLibp2p({
  privateKey,
  addresses: {
    listen: ['/ip4/0.0.0.0/tcp/12345/ws']
  },
  transports: [
    tcp(),
    webRTC(),
    webRTCDirect(),
    webTransport(),
    webSockets({
      filter: filters.all
    })
  ],
  peerDiscovery: [
		pubsubPeerDiscovery({
			interval: 10000,
			//topics: [pubsubPeerDiscoveryTopics], // defaults to ['_peer-discovery._p2p._pubsub'] //if we enable this too many will connect to us!
			listenOnly: false
		})
  ],
  connectionEncryption: [noise()],
  streamMuxers: [yamux()],
  services: {
    ping: ping(),
    autonat: autoNAT(),
    dcutr: dcutr(),
    identify: identify(),
    pubsub: gossipsub({
      allowPublishToZeroTopicPeers: true,
      canRelayMessage: true
    }),
    relay: circuitRelayServer({
      reservations: {
        maxReservations: 5000,
        reservationTtl: 1000,
        defaultDataLimit: BigInt(1024 * 1024 * 1024)
      }
    })
  }
})

server.addEventListener('peer:connect', async event => {
  console.log('peer:connect', event.detail)
})

server.addEventListener('peer:disconnect', async event => {
  console.log('peer:disconnect', event.detail)
  server.peerStore.delete(event.detail)
})

console.log(server.peerId.toString())
console.log('p2p addr: ', server.getMultiaddrs().map((ma) => ma.toString()))
// generates a deterministic address: /ip4/127.0.0.1/tcp/33519/ws/p2p/12D3KooWAJjbRkp8FPF5MKgMU53aUTxWkqvDrs4zc1VMbwRwfsbE
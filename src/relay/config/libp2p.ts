import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { circuitRelayTransport, circuitRelayServer } from '@libp2p/circuit-relay-v2'
import { identify, identifyPush } from '@libp2p/identify'
import { webRTC, webRTCDirect } from '@libp2p/webrtc'
import { webSockets } from '@libp2p/websockets'
import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { pubsubPeerDiscovery } from '@libp2p/pubsub-peer-discovery'
import { kadDHT, removePrivateAddressesMapper } from '@libp2p/kad-dht'
import { bootstrap } from '@libp2p/bootstrap'
import { tcp } from '@libp2p/tcp'
import { ping } from '@libp2p/ping'
import { autoNAT } from '@libp2p/autonat'
import { autoTLS } from '@ipshipyard/libp2p-auto-tls'
import { keychain } from '@libp2p/keychain'
import { prometheusMetrics } from '@libp2p/prometheus-metrics'
import type { Libp2pOptions } from 'libp2p'
import type { PrivateKey } from '@libp2p/interface'
import type { Datastore } from 'interface-datastore'

const appendAnnounce = (
  process.env.NODE_ENV === 'development'
    ? process.env.VITE_APPEND_ANNOUNCE_DEV
    : process.env.VITE_APPEND_ANNOUNCE
) || '';

const appendAnnounceArray = appendAnnounce
  .split(',')
  .map(addr => addr.trim())
  .filter(Boolean);

const RELAY_TCP_PORT = Number(process.env.RELAY_TCP_PORT || 9091)
const RELAY_WS_PORT = Number(process.env.RELAY_WS_PORT || 9092)
const RELAY_WEBRTC_PORT = Number(process.env.RELAY_WEBRTC_PORT || 9093)
const RELAY_LISTEN_IPV4 = process.env.RELAY_LISTEN_IPV4 || '0.0.0.0'
const RELAY_LISTEN_IPV6 = process.env.RELAY_LISTEN_IPV6 || '::'
const RELAY_DISABLE_IPV6 =
  process.env.RELAY_DISABLE_IPV6 === 'true' || process.env.RELAY_DISABLE_IPV6 === '1'
const RELAY_DISABLE_WEBRTC =
  process.env.RELAY_DISABLE_WEBRTC === 'true' || process.env.RELAY_DISABLE_WEBRTC === '1'

export const createLibp2pConfig = (privateKey: PrivateKey, datastore: Datastore): Libp2pOptions => ({
  privateKey,
  datastore,
  metrics: prometheusMetrics(),
  addresses: {
    listen: [
      `/ip4/${RELAY_LISTEN_IPV4}/tcp/${RELAY_TCP_PORT}`,
      // '/ip4/0.0.0.0/udp/9091/quic-v1',
      `/ip4/${RELAY_LISTEN_IPV4}/tcp/${RELAY_WS_PORT}/ws`,
      ...(!RELAY_DISABLE_WEBRTC ? [`/ip4/${RELAY_LISTEN_IPV4}/udp/${RELAY_WEBRTC_PORT}/webrtc-direct`] : []),
      ...(!RELAY_DISABLE_IPV6
        ? [
            `/ip6/${RELAY_LISTEN_IPV6}/tcp/${RELAY_TCP_PORT}`,
            `/ip6/${RELAY_LISTEN_IPV6}/tcp/${RELAY_WS_PORT}/ws`,
            ...(!RELAY_DISABLE_WEBRTC
              ? [`/ip6/${RELAY_LISTEN_IPV6}/udp/${RELAY_WEBRTC_PORT}/webrtc-direct`]
              : []),
          ]
        : []),
    ],
    ...(appendAnnounceArray.length > 0 && { appendAnnounce: appendAnnounceArray }),
  },
  transports: [
    circuitRelayTransport(),
    tcp(),
    // quic(),
    ...(!RELAY_DISABLE_WEBRTC ? [webRTC(), webRTCDirect()] : []),
    webSockets()
  ],
  peerDiscovery: [
    pubsubPeerDiscovery({
      interval: 5000, // Check every 5 seconds
      topics: ['todo._peer-discovery._p2p._pubsub'],
      listenOnly: false
    })
  ],
  connectionEncrypters: [noise()],
  connectionManager: {
    inboundStreamProtocolNegotiationTimeout: 30000,
    inboundUpgradeTimeout: 30000,
    outboundStreamProtocolNegotiationTimeout: 30000,
    outboundUpgradeTimeout: 30000,
    maxConnections: 1000,
    maxIncomingPendingConnections: 100,
    maxPeerAddrsToDial: 100,
    dialTimeout: 30000
  },
  connectionGater: {
    denyDialMultiaddr: () => false
  },
  streamMuxers: [yamux()],
  services: {
    ping: ping(),
    autonat: autoNAT(),
    aminoDHT: kadDHT({
      protocol: '/ipfs/kad/1.0.0',
      peerInfoMapper: removePrivateAddressesMapper
    }),
    // bootstrap: bootstrap({
    //   list: [
    //     '/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN',
    //     '/dnsaddr/bootstrap.libp2p.io/p2p/QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb',
    //     '/dnsaddr/bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt',
    //     '/dnsaddr/va1.bootstrap.libp2p.io/p2p/12D3KooWKnDdG3iXw9eTFijk3EWSunZcFi54Zka4wmtqtt6rPxc8',
    //     '/ip4/104.131.131.82/tcp/4001/p2p/QmaCpDMGvV2BGHeYERUEnRQAwe3N8SzbUtfsmvsqQLuvuJ'
    //   ]
    // }),
    relay: circuitRelayServer({
      // Development-friendly configuration
      hopTimeout: 30000, // 30 seconds
      reservations: {
        maxReservations: 1000, // Allow many reservations
        reservationTtl: 2 * 60 * 60 * 1000, // 2 hours
        defaultDataLimit: BigInt(1024 * 1024 * 1024), // 1GB
        defaultDurationLimit: 2 * 60 * 1000 // 2 minutes
      },
    }),
    identify: identify(),
    identifyPush: identifyPush(),
    pubsub: gossipsub({allowPublishToZeroTopicPeers:true}),
    ...(!process.env.disableAutoTLS && {
      autoTLS: autoTLS({
        autoConfirmAddress: true,
        ...(process.env.STAGING === 'true' && {
          acmeDirectory: 'https://acme-staging-v02.api.letsencrypt.org/directory'
        })
      })
    }),
    keychain: keychain()
  }
})

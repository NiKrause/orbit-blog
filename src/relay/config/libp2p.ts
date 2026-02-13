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
import { LevelDatastore } from 'datastore-level';
import { join } from 'path';

const RELAY_DATA_DIR = process.env.RELAY_DATA_DIR || './orbitdb';
const KEYSTORE_DIR = process.env.RELAY_KEYSTORE_DIR || join(RELAY_DATA_DIR, 'keystore');
const datastore = new LevelDatastore(KEYSTORE_DIR);

const appendAnnounce = (
  process.env.NODE_ENV === 'development'
    ? process.env.VITE_APPEND_ANNOUNCE_DEV
    : process.env.VITE_APPEND_ANNOUNCE
) || '';

const appendAnnounceArray = appendAnnounce
  .split(',')
  .map(addr => addr.trim())
  .filter(Boolean);

const RELAY_TCP_PORT = Number(process.env.RELAY_TCP_PORT || 9091);
const RELAY_WS_PORT = Number(process.env.RELAY_WS_PORT || 9092);
const RELAY_WEBRTC_PORT = Number(process.env.RELAY_WEBRTC_PORT || 9093);

export const createLibp2pConfig = (privateKey: PrivateKey): Libp2pOptions => ({
  privateKey,
  datastore,
  metrics: prometheusMetrics(),
  addresses: {
    listen: [
      `/ip4/0.0.0.0/tcp/${RELAY_TCP_PORT}`,
      // '/ip4/0.0.0.0/udp/9091/quic-v1',
      `/ip4/0.0.0.0/tcp/${RELAY_WS_PORT}/ws`,
      `/ip4/0.0.0.0/udp/${RELAY_WEBRTC_PORT}/webrtc-direct`,
      `/ip6/::/tcp/${RELAY_TCP_PORT}`,
      `/ip6/::/tcp/${RELAY_WS_PORT}/ws`,
      `/ip6/::/udp/${RELAY_WEBRTC_PORT}/webrtc-direct`,
    ],
    ...(appendAnnounceArray.length > 0 && { appendAnnounce: appendAnnounceArray }),
  },
  transports: [
    circuitRelayTransport(),
    tcp(),
    // quic(),
    webRTC(),
    webRTCDirect(),
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
    autoNAT: autoNAT(),
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

// Note: we intentionally do not iterate/query the datastore at module init time.
// Doing so can flake on CI (iterator lifecycle vs open/close) and can race with libp2p startup.

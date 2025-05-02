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

const datastore = new LevelDatastore('./orbitdb/keystore');

const appendAnnounce = (
  process.env.NODE_ENV === 'development'
    ? process.env.VITE_APPEND_ANNOUNCE_DEV
    : process.env.VITE_APPEND_ANNOUNCE
) || '';

const appendAnnounceArray = appendAnnounce
  .split(',')
  .map(addr => addr.trim())
  .filter(Boolean);

export const createLibp2pConfig = (privateKey: PrivateKey): Libp2pOptions => ({
  privateKey,
  datastore,
  metrics: prometheusMetrics(),
  addresses: {
    listen: [
      '/ip4/0.0.0.0/tcp/9091',
      // '/ip4/0.0.0.0/udp/9091/quic-v1',
      '/ip4/0.0.0.0/tcp/9092/ws',
      '/ip4/0.0.0.0/udp/9093/webrtc-direct',
      '/ip6/::/tcp/9091',
      '/ip6/::/tcp/9092/ws',
      '/ip6/::/udp/9093/webrtc-direct',
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
      interval: 10000,
      topics: ['le-space._peer-discovery._p2p._pubsub'],
      listenOnly: false
    })
  ],
  connectionEncrypters: [noise()],
  connectionManager: {
    inboundStreamProtocolNegotiationTimeout: 10000,
    inboundUpgradeTimeout: 10000,
    outboundStreamProtocolNegotiationTimeout: 10000,
    outboundUpgradeTimeout: 1000,
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
    relay: circuitRelayServer({}),
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
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { circuitRelayServer, circuitRelayTransport } from '@libp2p/circuit-relay-v2'
import { identify, identifyPush} from '@libp2p/identify'
import { webRTC, webRTCDirect } from '@libp2p/webrtc'
import { webSockets } from '@libp2p/websockets'
import { createLibp2p } from 'libp2p'
import { createHelia } from 'helia'
import { createOrbitDB } from '@orbitdb/core'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { privateKeyFromProtobuf } from '@libp2p/crypto/keys'
import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { pubsubPeerDiscovery } from '@libp2p/pubsub-peer-discovery'
import { tcp } from '@libp2p/tcp'
import { ping } from '@libp2p/ping'
import { dcutr } from '@libp2p/dcutr'
import { autoNAT } from '@libp2p/autonat'
import { quic } from '@chainsafe/libp2p-quic'
import { logger,enable } from '@libp2p/logger'
import { LevelBlockstore } from 'blockstore-level'
import { LevelDatastore } from 'datastore-level'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { autoTLS } from '@ipshipyard/libp2p-auto-tls'
import { keychain } from '@libp2p/keychain'
import { Transport } from '@libp2p/interface-transport'

/** @typedef {import('@libp2p/interface-transport').Transport} Transport */
/** @typedef {import('@libp2p/interface').Libp2p} Libp2p */

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const log = logger('le-space:relay')
//enable("le-space:relay,libp2p:*")
enable("le-space:relay:*")
log('Starting relay server')

const hostDirectory = join(__dirname, '..', 'pinning-service')
const pubsubPeerDiscoveryTopics = ['le-space._peer-discovery._p2p._pubsub']
// output of: info(server.peerId.privateKey.toString('hex'))
const relayPrivKey = '08011240821cb6bc3d4547fcccb513e82e4d718089f8a166b23ffcd4a436754b6b0774cf07447d1693cd10ce11ef950d7517bad6e9472b41a927cd17fc3fb23f8c70cd99'
// the peer id of the above key
// const relayId = '12D3KooWAJjbRkp8FPF5MKgMU53aUTxWkqvDrs4zc1VMbwRwfsbE'

const privateKey = privateKeyFromProtobuf(uint8ArrayFromString(relayPrivKey, 'hex'))

/** @type {Libp2p} */
const libp2p = await createLibp2p({
  privateKey,
  addresses: {
    listen: [
      '/ip4/0.0.0.0/tcp/9091',
      '/ip4/0.0.0.0/udp/9091/quic-v1',
      '/ip4/0.0.0.0/tcp/9092/ws',
      '/ip4/0.0.0.0/udp/9092/webrtc-direct',
      '/ip4/0.0.0.0/udp/9093/webrtc',
      '/ip6/::/tcp/9091',
      '/ip6/::/udp/9091/quic-v1',
      '/ip6/::/tcp/9092/ws',
      '/ip6/::/udp/9092/webrtc-direct',
      '/ip6/::/udp/9093/webrtc'
    ],
    // announce: [
    //   '/ip4/0.0.0.0/tcp/9091',
    //   '/ip4/0.0.0.0/udp/9091/quic-v1'
    // ]
  },
  transports: [
    circuitRelayTransport(),
    tcp(),
    quic(),
    webRTC(),
    webRTCDirect(),
    webSockets(),
    /** @type {Transport} */ (autoTLS({
      autoConfirmAddress: true,
      acmeDirectory: 'https://acme-staging-v02.api.letsencrypt.org/directory'
    }))
  ],
  peerDiscovery: [
		pubsubPeerDiscovery({
			interval: 10000,
			topics: pubsubPeerDiscoveryTopics, // defaults to ['_peer-discovery._p2p._pubsub'] //if we enable this too many will connect to us!
			listenOnly: false
		})
  ],
  connectionEncrypters: [noise()],
  streamMuxers: [yamux()],
  services: {
    ping: ping(),
    autonat: autoNAT(),
    dcutr: dcutr(),
    identify: identify(),
    identifyPush: identifyPush(),
    pubsub: gossipsub({
      allowPublishToZeroTopicPeers: true,
      canRelayMessage: true
    }),
    relay: circuitRelayServer({
      reservations: {
        maxReservations: Infinity,
      }
    }),
    keychain: keychain()
  }
})

const blockstore = new LevelBlockstore(join(hostDirectory, '/', 'ipfs', '/', 'blocks'))
const datastore = new LevelDatastore(join(hostDirectory, '/', 'ipfs', '/', 'data'))

const ipfs = await createHelia({ libp2p, datastore, blockstore })
ipfs.libp2p.addEventListener('error', (err) => {
  console.error('Libp2p error:', err)
})

process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error)
})
const orbitdb = await createOrbitDB({ ipfs })
const debug = (message, ...args) => {
  console.log(message, ...args)
}

const info = (message, ...args) => {
  console.log(message, ...args)
}

libp2p.addEventListener('peer:connect', async event => {
  const peer = event.detail
  try {
    const identifyResult = await identify(peer)
  } catch (err) {
    if (err.code !== 'ERR_UNSUPPORTED_PROTOCOL') {
      console.error('Failed to identify peer:', err)
    }
  }
})

libp2p.addEventListener('peer:disconnect', async event => {
  debug('peer:disconnect', event.detail)
  libp2p.peerStore.delete(event.detail)
})

libp2p.addEventListener('connection:open', async (event) => {
  const connection = event.detail
  try {
    // Run identify on the connection
    const identifyResult = await libp2p.services.identify.identify(connection)
    const orbitDBProtocols = identifyResult.protocols.filter(protocol =>{
        return protocol.startsWith('/orbitdb/heads')
    }).map(protocol => {
        return protocol.replace('/orbitdb/heads', '')
    });
    
    log('Found OrbitDB protocols:', orbitDBProtocols);
    
    // Get records from all discovered databases
    const recordCounts = await getAllOrbitDBRecords(orbitDBProtocols);
    
    log('Connection identify result:', {
        peerId: identifyResult.peerId.toString(),
        protocols: orbitDBProtocols,
        protocolVersion: identifyResult.protocolVersion,
        agentVersion: identifyResult.agentVersion,
        databaseRecords: recordCounts
    });
    
  } catch (err) {
    if (err.code === 'ERR_UNSUPPORTED_PROTOCOL') {
      // Remote peer doesn't support identify, ignore the error
      return
    }
    console.error('Error during identify triggered by connection:open', err)
  }
})

info(libp2p.peerId.toString())
info('p2p addr: ', libp2p.getMultiaddrs().map((ma) => ma.toString()))
// generates a deterministic address: /ip4/127.0.0.1/tcp/33519/ws/p2p/12D3KooWAJjbRkp8FPF5MKgMU53aUTxWkqvDrs4zc1VMbwRwfsbE



// To see all subscribed topics
const topics = libp2p.services.pubsub.getTopics()
console.log('Currently subscribed topics:', topics)

// To see peers subscribed to a specific topic
const peersInTopic = libp2p.services.pubsub.getSubscribers('your-topic-name')
console.log('Peers in topic:', peersInTopic.map(peer => peer.toString()))



// Add this near the top level of the file, after orbitdb initialization
const openDatabases = new Set();

async function getAllOrbitDBRecords(protocols) {
    const counts = {};
    console.log("protocols", protocols)
    for (const protocol of protocols) {
        const dbAddress = protocol;
        
        try {
            log("opening db", dbAddress)
            const db = await orbitdb.open(dbAddress);
            db.events.on('join', async () => {
              console.log('join', db.address.toString(), db.name)
              const records = await db.all();
              console.log("records after sync", records.length);
              if (db.name.startsWith('settings')) {
                console.log('Settings database records:', records.map(record => `${record.key}: ${record.value.value}`));
                
                const postsDBRecord = records.find(record => record.key === 'postsDBAddress');
                if (postsDBRecord && postsDBRecord.value.value) {
                  try {
                    const postsDB = await orbitdb.open(postsDBRecord.value.value);
                    const posts = await postsDB.all();
                    console.log('Posts from database:', posts.map(post => post.value.title));
                    // Add postsDB to tracking set
                    openDatabases.add(postsDB);
                  } catch (error) {
                    console.error('Error opening posts database:', error);
                  }
                }
              }
            })
      
            openDatabases.add(db);
            
        } catch (error) {
            console.error(`Error opening database ${dbAddress}:`, error);
        }
    }
    
    console.log('All OrbitDB Record Counts:', counts);
    return counts;
}

// Add this after the getAllOrbitDBRecords function
// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('Received SIGINT. Closing databases...');
    await cleanup();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('Received SIGTERM. Closing databases...');
    await cleanup();
    process.exit(0);
});

async function cleanup() {
    for (const db of openDatabases) {
        try {
            await db.close();
            openDatabases.delete(db);
        } catch (error) {
            console.error('Error closing database:', error);
        }
    }
    await orbitdb.stop();
}
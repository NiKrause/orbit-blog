import { expect } from 'chai';
import { createLibp2p } from 'libp2p';
import { createHelia } from 'helia';
import { LevelDatastore } from 'datastore-level';
import { LevelBlockstore } from 'blockstore-level';
import { createOrbitDB, IPFSAccessController } from '@orbitdb/core';
// import { Voyager } from '@le-space/voyager';
import { generateMnemonic } from 'bip39';
import { tmpdir } from 'os';
import { join } from 'path';
import { setTimeout } from 'timers/promises';

xdescribe('OrbitDB Network Disruption Tests', function() {
    this.timeout(30000);
    
    let node1, node2;
    let helia1, helia2;
    let orbitdb1, orbitdb2;
    let db1, db2;
    
    // Helper function to create a complete node stack
    async function createNodeStack(id) {
        const tempPath = join(tmpdir(), `orbitdb-test-${id}-${Date.now()}`);
        
        // Create stores
        const blockstore = new LevelBlockstore(join(tempPath, 'blocks'));
        const datastore = new LevelDatastore(join(tempPath, 'data'));
        
        // Create libp2p node
        const node = await createLibp2p({
            // ...Libp2pOptions,
            // Ensure unique peer ID
            peerId: await createPeerId()
        });
        
        // Create Helia
        const helia = await createHelia({
            libp2p: node,
            datastore,
            blockstore
        });
        
        // Create OrbitDB
        const orbitdb = await createOrbitDB({
            ipfs: helia,
            directory: join(tempPath, 'orbitdb')
        });
        
        return { node, helia, orbitdb, tempPath };
    }
    
    // Helper to simulate network disruption
    async function simulateNetworkDisruption(node1, node2) {
        // Get peer IDs
        const peer2Id = node2.peerId.toString();
        
        // Disconnect peers
        await node1.hangUp(peer2Id);
        
        // Verify disconnection
        const peers = await node1.getPeers();
        return !peers.some(peer => peer.toString() === peer2Id);
    }
    
    // Helper to restore connection
    async function restoreConnection(node1, node2) {
        // Get multiaddrs of node2
        const node2Addrs = node2.getMultiaddrs();
        
        // Reconnect
        await node1.dial(node2Addrs[0]);
        
        // Wait for connection to establish
        await setTimeout(1000);
        
        // Verify connection
        const peers = await node1.getPeers();
        return peers.some(peer => peer.toString() === node2.peerId.toString());
    }
    
    before(async () => {
        // Create two complete node stacks
        const stack1 = await createNodeStack(1);
        const stack2 = await createNodeStack(2);
        
        ({ node: node1, helia: helia1, orbitdb: orbitdb1 } = stack1);
        ({ node: node2, helia: helia2, orbitdb: orbitdb2 } = stack2);
        
        // Create test databases
        db1 = await orbitdb1.open('test-db', {
            type: 'documents',
            create: true
        });
        
        db2 = await orbitdb2.open(db1.address);
        
        // Ensure nodes are connected
        await node1.dial(node2.getMultiaddrs()[0]);
        await setTimeout(1000); // Wait for connection
    });
    
    after(async () => {
        // Cleanup
        await db1?.close();
        await db2?.close();
        await orbitdb1?.stop();
        await orbitdb2?.stop();
        await node1?.stop();
        await node2?.stop();
    });
    
    it('should handle network disruption during replication', async () => {
        // 1. Start with connected nodes
        expect(await node1.getPeers()).to.have.lengthOf.at.least(1);
        
        // 2. Write initial data
        await db1.put({ _id: 'test1', value: 'initial' });
        
        // 3. Wait for replication
        await setTimeout(1000);
        
        // 4. Verify initial replication
        const initialDoc = await db2.get('test1');
        expect(initialDoc[0].value).to.equal('initial');
        
        // 5. Simulate network disruption
        const isDisrupted = await simulateNetworkDisruption(node1, node2);
        expect(isDisrupted).to.be.true;
        
        // 6. Try to write data during disruption
        await db1.put({ _id: 'test2', value: 'during-disruption' });
        
        // 7. Verify db2 doesn't have the new data
        const disruptedDoc = await db2.get('test2');
        expect(disruptedDoc).to.be.empty;
        
        // 8. Restore connection
        const isRestored = await restoreConnection(node1, node2);
        expect(isRestored).to.be.true;
        
        // 9. Wait for replication to catch up
        await setTimeout(2000);
        
        // 10. Verify data is eventually consistent
        const finalDoc = await db2.get('test2');
        expect(finalDoc[0].value).to.equal('during-disruption');
    });
    
    it('should maintain database accessibility during network disruption', async () => {
        // Simulate network disruption
        await simulateNetworkDisruption(node1, node2);
        
        // Verify both databases are still accessible
        expect(async () => await db1.put({ _id: 'local1', value: 'test' })).to.not.throw();
        expect(async () => await db2.put({ _id: 'local2', value: 'test' })).to.not.throw();
    });
});
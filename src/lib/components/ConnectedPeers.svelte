<script lang="ts">
  import { helia } from '$lib/store';
  import { onMount } from 'svelte';
  import type { Connection } from '@libp2p/interface-connection'
  import WebRTCTester from './WebRTCTester.svelte';
  
  interface PeerInfo {
    id: string;
    connected: boolean;
    transport: string;
    streams: number;
    direction: string;
    multiaddr: string;
  }
  
  let peers: PeerInfo[] = $state([]);
  let peerId = $helia?.libp2p?.peerId.toString() || '';
  let showWebRTCTester = $state(false);
  
  function getTransportFromMultiaddr(conn: Connection): string {
    const remoteAddr = conn.remoteAddr.toString();
    
    // Check for different transport protocols
    if (remoteAddr.includes('/webrtc-direct')) return 'WebRTC Direct';
    if (remoteAddr.includes('/webrtc')) return 'WebRTC';
    if (remoteAddr.includes('/wss') || remoteAddr.includes('/tls/sni/')) return 'WSS';
    if (remoteAddr.includes('/ws')) return 'WS';
    if (remoteAddr.includes('/webtransport')) return 'WebTransport';
    if (remoteAddr.includes('/tcp')) return 'TCP';
    
    return 'Unknown';
  }
  
  function updatePeersList() {
    if ($helia?.libp2p) {
      const connections = $helia.libp2p.getConnections();
      peers = connections.map(conn => ({
        id: conn.remotePeer.toString(),
        connected: conn.status === 'open',
        transport: getTransportFromMultiaddr(conn),
        streams: conn.streams.length,
        direction: conn.direction,
        multiaddr: conn.remoteAddr.toString()
      }));
      // console.log('Updated peers list:', peers);
    }
  }
  
  async function disconnectPeer(peerId: string) {
    if ($helia?.libp2p) {
      const connection = $helia.libp2p.getConnections().find(conn => conn.remotePeer.toString() === peerId);
      if (connection) {
        try {
          await connection.close();
          console.log(`Disconnected from peer: ${peerId}`);
          
          // Remove the peer from the peer store
          await $helia.libp2p.peerStore.delete(connection.remotePeer);
          console.log(`Removed peer from peer store: ${peerId}`);
          
          updatePeersList();
        } catch (err) {
          console.error(`Failed to disconnect from peer: ${peerId}`, err);
        }
      }
    }
  }
  
  function hasWebRTCConnection(_peers: PeerInfo[]): boolean {
    // console.log('peers', _peers)

    return _peers.some(peer => peer.multiaddr.startsWith('/webrtc'));
  }

  async function disconnectNonWebRTC() {
    if ($helia?.libp2p) {
      const nonWebRTCConnections = $helia.libp2p.getConnections().filter(conn => !conn.remoteAddr.toString().startsWith('/webrtc'));
      
      for (const connection of nonWebRTCConnections) {
        try {
          await connection.close();
          console.log(`Disconnected from non-WebRTC peer: ${connection.remotePeer.toString()}`);
          
          // Remove the peer from the peer store
          await $helia.libp2p.peerStore.delete(connection.remotePeer);
          console.log(`Removed non-WebRTC peer from peer store: ${connection.remotePeer.toString()}`);
        } catch (err) {
          console.error(`Failed to disconnect from non-WebRTC peer: ${connection.remotePeer.toString()}`, err);
        }
      }
      
      updatePeersList();
    }
  }
  
  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }
 
  onMount(() => {
    console.log('ConnectedPeers mounted');
    if ($helia?.libp2p) {
      updatePeersList();
      
      $helia.libp2p.addEventListener('peer:connect', (event) => {
        updatePeersList();
      });
      
      $helia.libp2p.addEventListener('peer:disconnect', (event) => {
        console.log('Peer disconnected:', event.detail);
        updatePeersList();
      });

    }
  });
  
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
  <div class="mb-4 text-sm">
    <div class="flex items-center space-x-2">
      <span class="text-gray-600 dark:text-gray-400">Peer ID:</span>
      <input
        type="text"
        size={60}
        readonly
        value={peerId}
        class="flex-1 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-white"
      />
      <button onclick={() => copyToClipboard(peerId)} class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
        📋
      </button>
    </div>
  </div>
  <div class="flex justify-between items-center mb-4">
    <h2 class="text-xl font-bold text-gray-900 dark:text-white">Connected Peers</h2>
    <div class="flex gap-2">
      <button 
        class="bg-blue-500 hover:bg-blue-700 text-white px-4 py-2 rounded"
        onclick={() => {
          showWebRTCTester = true;
          console.log('Button clicked, showWebRTCTester:', showWebRTCTester);
        }}
      >
        Test WebRTC
      </button>
      {#if (peers)}
        <button 
          class="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-700"
          onclick={disconnectNonWebRTC}
        >
          Disconnect Non-WebRTC
        </button>
      {/if}
    </div>
  </div>
  
  {#if peers.length === 0}
    <p class="text-gray-600 dark:text-gray-400 text-center">No peers connected</p>
  {:else}
    <div class="overflow-x-auto">
      <table class="min-w-full">
        <thead>
          <tr class="border-b dark:border-gray-700">
            <th class="px-4 py-2 text-left text-gray-900 dark:text-white">Peer ID</th>
            <th class="px-4 py-2 text-left text-gray-900 dark:text-white">Status</th>
            <th class="px-4 py-2 text-left text-gray-900 dark:text-white">Transport</th>
            <th class="px-4 py-2 text-left text-gray-900 dark:text-white">Streams</th>
            <th class="px-4 py-2 text-left text-gray-900 dark:text-white">Direction</th>
            <th class="px-4 py-2 text-left text-gray-900 dark:text-white">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each peers as peer (peer.id + peer.multiaddr)}
            <tr class="border-b dark:border-gray-700">
              <td 
                class="px-4 py-2 text-gray-900 dark:text-white font-mono text-sm relative group cursor-help"
                title={peer.multiaddr}
              >
                <span>{peer.id}</span>
                <!-- Tooltip -->
                <div class="invisible group-hover:visible absolute left-0 bottom-full mb-2 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-50 whitespace-nowrap">
                  {peer.multiaddr}
                </div>
              </td>
              <td class="px-4 py-2">
                <span class={`inline-block px-2 py-1 rounded-full text-xs ${peer.connected ? 'bg-green-500' : 'bg-red-500'} text-white`}>
                  {peer.connected ? 'Connected' : 'Disconnected'}
                </span>
              </td>
              <td class="px-4 py-2 text-gray-900 dark:text-white">
                <span class="inline-block px-2 py-1 rounded-full text-xs bg-blue-500 text-white">
                  {peer.transport}
                </span>
              </td>
              <td class="px-4 py-2 text-gray-900 dark:text-white">{peer.streams}</td>
              <td class="px-4 py-2 text-gray-900 dark:text-white">{peer.direction}</td>
              <td class="px-4 py-2">
                <button 
                  class="text-red-500 hover:text-red-700"
                  onclick={() => disconnectPeer(peer.id)}
                  title="Disconnect"
                >
                  <!-- You can use an icon library like FontAwesome for a disconnect icon -->
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<!-- Add debug text -->
{#if showWebRTCTester}
  <WebRTCTester on:close={() => {
    console.log('Close event received');
    showWebRTCTester = false;
  }} />
{/if}

<style>
  /* Ensure tooltips don't get cut off */
  .relative {
    overflow: visible;
  }
  
  /* Add toggle switch styles */
  .dot {
    transition: transform 0.3s ease-in-out;
  }
  
  input:checked ~ .dot {
    transform: translateX(100%);
  }
</style>

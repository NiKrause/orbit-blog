<script lang="ts">
  import { helia } from '../lib/store';
  import { onMount, onDestroy } from 'svelte';
  import type { Connection } from '@libp2p/interface-connection';
  
  interface PeerInfo {
    id: string;
    shortId: string;
    connected: boolean;
    transport: string;
  }
  
  let peers: PeerInfo[] = [];
  let updateInterval: number;
  
  function getTransportFromMultiaddr(conn: Connection): string {
    const remoteAddr = conn.remoteAddr.toString();
    
    if (remoteAddr.includes('/webrtc')) return 'WebRTC';
    if (remoteAddr.includes('/wss')) return 'WSS';
    if (remoteAddr.includes('/ws')) return 'WS';
    if (remoteAddr.includes('/webtransport')) return 'WebTrans';
    if (remoteAddr.includes('/tcp')) return 'TCP';
    
    return 'Other';
  }
  
  function getShortPeerId(peerId: string): string {
    return peerId.length > 5 ? peerId.slice(-5) : peerId;
  }
  
  function updatePeersList() {
    if ($helia?.libp2p) {
      const connections = $helia.libp2p.getConnections();
      // console.log('connections', connections)
      peers = connections.map(conn => ({
        id: conn.remotePeer.toString(),
        shortId: getShortPeerId(conn.remotePeer.toString()),
        connected: conn.status === 'open',
        address: conn.remoteAddr.toString(),
        transport: getTransportFromMultiaddr(conn)
      }));
    }
  }
  
  onMount(() => {
    updatePeersList();
    
    if ($helia?.libp2p) {
      // Listen for peer events
      $helia.libp2p.addEventListener('peer:connect', updatePeersList);
      $helia.libp2p.addEventListener('peer:disconnect', updatePeersList);
    }
    
    // Periodically update to catch any changes
    updateInterval = window.setInterval(updatePeersList, 5000);
  });
  
  onDestroy(() => {
    if ($helia?.libp2p) {
      // Clean up listeners
      $helia.libp2p.removeEventListener('peer:connect', updatePeersList);
      $helia.libp2p.removeEventListener('peer:disconnect', updatePeersList);
    }
    
    if (updateInterval) {
      clearInterval(updateInterval);
    }
  });
</script>

<div class="space-y-1">
  {#if peers.length === 0}
    <p class="text-[8px] text-gray-500 dark:text-gray-400">No peers connected</p>
  {:else}
    {#each peers as peer (peer.address)}
      <div 
        class="flex items-center py-0.5 px-1 rounded text-[8px] text-gray-800 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700"
        title={peer.address}
      >
        <span class="mr-1">{peer.shortId}</span>
        <span class={`h-1.5 w-1.5 rounded-full mr-1 ${peer.connected ? 'bg-green-500' : 'bg-red-500'}`}></span>
        <span class="text-gray-600 dark:text-gray-400">{peer.transport}</span>
      </div>
    {/each}
  {/if}
</div> 
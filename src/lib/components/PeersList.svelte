<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { helia } from '$lib/store.js';
  import { onMount, onDestroy } from 'svelte';
  import type { Connection, Helia } from '$lib/types.js';
  import { isRTL } from '$lib/store.js';
  import WebRTCCelebration from './WebRTCCelebration.svelte';
  import { info } from '$lib/utils/logger.js';
  interface PeerInfo {
    id: string;
    shortId: string;
    connected: boolean;
    transport: string;
    address: string;
  }
  
  let peers: PeerInfo[] = $state([]);
  let updateInterval: number;
  let showWebRTCCelebration = $state(false);
  let previousPeers: Record<string, string> = {};
  
  function getTransportFromMultiaddr(conn: Connection): string {
    const remoteAddr = conn.remoteAddr.toString();
    
    if (remoteAddr.includes('/webrtc')) return 'WebRTC';
    if (remoteAddr.includes('/wss') || remoteAddr.includes('/tls/sni/')) return 'WSS';
    if (remoteAddr.includes('/ws')) return 'WS';
    if (remoteAddr.includes('/sni')) return 'SNI';
    if (remoteAddr.includes('/webtransport')) return 'WebTransport';
    // if (remoteAddr.includes('/tcp')) return 'TCP';
    if (remoteAddr.includes('/p2p-circuit')) return 'Circuit';
    
    return 'Other';
  }
  
  function getShortPeerId(peerId: string): string {
    return peerId.length > 5 ? peerId.slice(-5) : peerId;
  }
  
  function updatePeersList() {
    if ($helia?.libp2p) {
      const connections = $helia.libp2p.getConnections();
      const newPeers = connections.map((conn: Connection) => ({
        id: conn.remotePeer.toString(),
        shortId: getShortPeerId(conn.remotePeer.toString()),
        connected: conn.status === 'open',
        address: conn.remoteAddr.toString(),
        transport: getTransportFromMultiaddr(conn)
      }));

      // Check for transport changes to WebRTC
      newPeers.forEach(peer => {
        info('peer', peer);
        const previousTransport = previousPeers[peer.id];
        if (previousTransport && 
            previousTransport !== 'WebRTC' && 
            peer.transport === 'WebRTC') {
          info('showing celebration');
          showWebRTCCelebration = true;
          setTimeout(() => {
            info('hiding celebration');
            showWebRTCCelebration = false;
          }, 2000);
        }
        previousPeers[peer.id] = peer.transport;
      });

      peers = newPeers;
    }
  }
  $effect(() => {
      $helia?.libp2p?.addEventListener('peer:connect', updatePeersList);
  });
  onMount(() => {
    updatePeersList();
    
      if ($helia?.libp2p) {
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

<WebRTCCelebration show={showWebRTCCelebration} />

<div class="space-y-1 {$isRTL ? 'rtl' : 'ltr'}">
  {#if peers.length === 0}
    <p class="text-[8px] text-gray-500 dark:text-gray-400">{$_('no_peers_connected')}</p>
  {:else}
    {#each peers as peer (peer.address)}
      <div 
        class="flex items-center py-0.5 px-1 rounded text-[8px] text-gray-800 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700"
        title={peer.address}
      >
        <span class="{$isRTL ? 'ml-1' : 'mr-1'}">{peer.shortId}</span>
        <span class={`h-1.5 w-1.5 rounded-full {$isRTL ? 'ml-1' : 'mr-1'} ${peer.connected ? 'bg-green-500' : 'bg-red-500'}`}></span>
        <span class="text-gray-600 dark:text-gray-400">{peer.transport}</span>
      </div>
    {/each}
  {/if}
</div>

<style>
  /* RTL specific styles */
  :global([dir="rtl"]) .flex {
    flex-direction: row-reverse;
  }
</style> 
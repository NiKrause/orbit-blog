<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { helia, libp2p } from '$lib/store.js';
  import { onMount } from 'svelte';
  import WebRTCTester from './WebRTCTester.svelte';
  import { isRTL } from '$lib/store.js';
  import { info, error } from '$lib/utils/logger.js'

  interface PeerInfo {
    id: string;
    connected: boolean;
    transport: string;
    streams: number;
    direction: string;
    multiaddr: string;
  }

  interface Connection {
    remotePeer: {
      toString: () => string;
    };
    remoteAddr: {
      toString: () => string;
    };
    status: string;
    streams: any[];
    direction: string;
    close: () => Promise<void>;
  }
  
  let peers: PeerInfo[] = $state([]);
  let peerId = $helia?.libp2p?.peerId.toString() || '';
  let showWebRTCTester = $state(false);
  let multiaddrs: string[] = $state([]);
  let dialPeerId = $state('');
  let dialStatus: string | null = $state(null);
  let showMultiaddrs = $state(false);
  
  function getTransportFromMultiaddr(conn: Connection): string {
    const remoteAddr = conn.remoteAddr.toString();
    info('remoteAddr', remoteAddr);
    // Check for different transport protocols
    if (remoteAddr.includes('/webrtc-direct')) return 'WebRTC Direct';
    if (remoteAddr.includes('/webrtc')) return 'WebRTC';
    if (remoteAddr.includes('/wss')) return 'WSS';
    if (remoteAddr.includes('/sni')) return 'SNI';
    if (remoteAddr.includes('/ws')) return 'WS';
    if (remoteAddr.includes('/webtransport')) return 'WebTransport';
    if (remoteAddr.includes('/p2p-circuit')) return 'Circuit';
    
    return 'Unknown';
  }
  
  function updatePeersList() {
    if ($helia?.libp2p) {
      const connections = $helia.libp2p.getConnections();
      peers = connections.map((conn: Connection) => ({
        id: conn.remotePeer.toString(),
        connected: conn.status === 'open',
        transport: getTransportFromMultiaddr(conn),
        streams: conn.streams.length,
        direction: conn.direction,
        multiaddr: conn.remoteAddr.toString()
      }));
    }
  }
  
  async function disconnectPeer(peerId: string) {
    if ($helia?.libp2p) {
      const connection = $helia.libp2p.getConnections().find((conn: Connection) => conn.remotePeer.toString() === peerId);
      if (connection) {
        try {
          await connection.close();
          info(`Disconnected from peer: ${peerId}`);
          
          // Remove the peer from the peer store
          await $helia.libp2p.peerStore.delete(connection.remotePeer);
          info(`Removed peer from peer store: ${peerId}`);
          
          updatePeersList(  );
        } catch (_err) {
          error(`Failed to disconnect from peer: ${peerId}`, _err);
        }
      }
    }
  }
  
  function hasWebRTCConnection(_peers: PeerInfo[]): boolean {
    return _peers.some(peer => peer.multiaddr.startsWith('/webrtc'));
  }

  async function disconnectNonWebRTC() {
    if ($helia?.libp2p) {
      const nonWebRTCConnections = $helia.libp2p.getConnections().filter((conn: Connection) => !conn.remoteAddr.toString().startsWith('/webrtc'));
      
      for (const connection of nonWebRTCConnections) {
        try {
          await connection.close();
            info(`Disconnected from non-WebRTC peer: ${connection.remotePeer.toString()}`);
          
          // Remove the peer from the peer store
          await $helia.libp2p.peerStore.delete(connection.remotePeer);
            info(`Removed non-WebRTC peer from peer store: ${connection.remotePeer.toString()}`);
        } catch (err) {
            error(`Failed to disconnect from non-WebRTC peer: ${connection.remotePeer.toString()}`, err);
        }
      }
      
      updatePeersList();
    }
  }
  
  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }
  
  async function dialPeer() {
    info("dialing peer...", dialPeerId.trim());
    dialStatus = null;
    if (!dialPeerId.trim()) {
      dialStatus = 'Please enter a peer ID.';
      return;
    }
    try {
      if ($libp2p) {
        await $libp2p.dial(dialPeerId.trim());
        info('dialed peer', dialPeerId.trim());
        dialStatus = 'Dial successful!';
        updatePeersList();
      } else {
        dialStatus = 'Libp2p not initialized.';
      }
    } catch (err) {
      dialStatus = 'Dial failed: ' + (err?.message || err);
    }
  }
  function updateMultiaddrs() {
  if ($helia?.libp2p) {
    multiaddrs = $helia.libp2p.getMultiaddrs().map(addr => addr.toString());
  }
} 
  onMount(() => {
  info('ConnectedPeers mounted');
  if ($helia?.libp2p) {
    updatePeersList();
    updateMultiaddrs();
    
    $helia.libp2p.addEventListener('peer:connect', (event: CustomEvent) => {
      updatePeersList();
      updateMultiaddrs();
    });
    
    $helia.libp2p.addEventListener('peer:disconnect', (event: CustomEvent) => {
      info('Peer disconnected:', event.detail);
      updatePeersList();
      updateMultiaddrs();
    });
  }
}); 
</script>

<div class="card p-5 {$isRTL ? 'rtl' : 'ltr'}">
  <!-- Peer ID -->
  <div class="mb-4">
    <div class="flex items-center gap-2">
      <span class="text-xs flex-shrink-0" style="color: var(--text-muted);">{$_('peer_id')}:</span>
      <input type="text" size={60} readonly value={peerId} class="input flex-1 font-mono text-xs" />
      <button class="btn-icon" onclick={() => copyToClipboard(peerId)}>
        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
      </button>
    </div>
    <div class="mt-2">
      <div class="flex items-center gap-2">
        <span class="text-xs flex-shrink-0" style="color: var(--text-muted);">{$_('multiaddrs')}:</span>
        <button class="btn-ghost btn-sm" onclick={() => showMultiaddrs = !showMultiaddrs}>
          {showMultiaddrs ? $_('hide') : $_('show')}
        </button>
      </div>
      {#if showMultiaddrs}
        <div class="space-y-1 mt-1.5">
          {#each multiaddrs as addr}
            <div class="flex items-center gap-2">
              <input type="text" readonly value={addr} class="input flex-1 font-mono text-xs" />
              <button class="btn-icon" onclick={() => copyToClipboard(addr)}>
                <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              </button>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <div class="divider mb-4"></div>

  <div class="flex justify-between items-center mb-3">
    <h2 class="text-sm font-semibold" style="color: var(--text);">{$_('connected_peers')}</h2>
    <div class="flex gap-2">
      <button class="btn-outline btn-sm" onclick={() => { showWebRTCTester = true; info('Button clicked, showWebRTCTester:', showWebRTCTester); }}>{$_('test_webrtc')}</button>
      {#if (peers)}
        <button class="btn-danger btn-sm" onclick={disconnectNonWebRTC}>{$_('disconnect_non_webrtc')}</button>
      {/if}
    </div>
  </div>
  
  <!-- Dial -->
  <div class="mb-4 flex items-center gap-2">
    <input type="text" class="input flex-1 text-xs" placeholder="Enter peer ID to dial (e.g. 12D3KooW...)" bind:value={dialPeerId} onkeydown={(e) => { if (e.key === 'Enter') dialPeer(); }} />
    <button class="btn-primary btn-sm" onclick={dialPeer}>{$_('dial')}</button>
  </div>
  {#if dialStatus}
    <div class="text-xs mt-1" style="color: {dialStatus === 'Dial successful!' ? 'var(--success)' : 'var(--danger)'};">{dialStatus}</div>
  {/if}
  
  {#if peers.length === 0}
    <p class="text-center text-sm py-4" style="color: var(--text-muted);">{$_('no_peers_connected')}</p>
  {:else}
    <div class="overflow-x-auto">
      <table class="min-w-full">
        <thead>
          <tr style="border-bottom: 1px solid var(--border);">
            <th class="px-3 py-2 text-left text-xs font-medium" style="color: var(--text-muted);">{$_('peer_id')}</th>
            <th class="px-3 py-2 text-left text-xs font-medium" style="color: var(--text-muted);">{$_('status')}</th>
            <th class="px-3 py-2 text-left text-xs font-medium" style="color: var(--text-muted);">{$_('transport')}</th>
            <th class="px-3 py-2 text-left text-xs font-medium" style="color: var(--text-muted);">{$_('streams')}</th>
            <th class="px-3 py-2 text-left text-xs font-medium" style="color: var(--text-muted);">{$_('direction')}</th>
            <th class="px-3 py-2 text-left text-xs font-medium" style="color: var(--text-muted);">{$_('actions')}</th>
          </tr>
        </thead>
        <tbody>
          {#each peers as peer (peer.id + peer.multiaddr)}
            <tr style="border-bottom: 1px solid var(--border-subtle);">
              <td class="px-3 py-2 font-mono text-xs relative group cursor-help" style="color: var(--text);" title={peer.multiaddr}>
                <span>{peer.id.slice(0, 12)}...{peer.id.slice(-6)}</span>
                <div class="invisible group-hover:visible absolute {$isRTL ? 'right-0' : 'left-0'} bottom-full mb-2 p-2 text-xs rounded-md z-50 whitespace-nowrap" style="background-color: var(--bg); color: var(--text); border: 1px solid var(--border); box-shadow: var(--shadow-lg);">
                  {peer.multiaddr}
                </div>
              </td>
              <td class="px-3 py-2">
                <span class="badge" style="background-color: {peer.connected ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)'}; color: {peer.connected ? 'var(--success)' : 'var(--danger)'};">
                  {peer.connected ? $_('connected') : $_('disconnected')}
                </span>
              </td>
              <td class="px-3 py-2"><span class="badge">{peer.transport}</span></td>
              <td class="px-3 py-2 text-xs" style="color: var(--text-secondary);">{peer.streams}</td>
              <td class="px-3 py-2 text-xs" style="color: var(--text-secondary);">{peer.direction}</td>
              <td class="px-3 py-2">
                <button class="btn-icon" style="color: var(--danger);" onclick={() => disconnectPeer(peer.id)} aria-label={$_('disconnect')}>
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

{#if showWebRTCTester}
  <WebRTCTester on:close={() => {
    info('Close event received');
    showWebRTCTester = false;
  }} />
{/if}

<style>
  .relative { overflow: visible; }
  :global([dir="rtl"]) .flex { flex-direction: row-reverse; }
  :global([dir="rtl"]) .text-left { text-align: right; }
</style>

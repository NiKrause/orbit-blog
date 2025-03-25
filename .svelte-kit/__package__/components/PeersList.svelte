<script>import { helia } from "../store";
import { onMount, onDestroy } from "svelte";
let peers = [];
let updateInterval;
function getTransportFromMultiaddr(conn) {
  const remoteAddr = conn.remoteAddr.toString();
  if (remoteAddr.includes("/webrtc")) return "WebRTC";
  if (remoteAddr.includes("/wss") || remoteAddr.includes("/tls/sni/")) return "WSS";
  if (remoteAddr.includes("/ws")) return "WS";
  if (remoteAddr.includes("/webtransport")) return "WebTrans";
  if (remoteAddr.includes("/tcp")) return "TCP";
  return "Other";
}
function getShortPeerId(peerId) {
  return peerId.length > 5 ? peerId.slice(-5) : peerId;
}
function updatePeersList() {
  if ($helia?.libp2p) {
    const connections = $helia.libp2p.getConnections();
    peers = connections.map((conn) => ({
      id: conn.remotePeer.toString(),
      shortId: getShortPeerId(conn.remotePeer.toString()),
      connected: conn.status === "open",
      address: conn.remoteAddr.toString(),
      transport: getTransportFromMultiaddr(conn)
    }));
  }
}
onMount(() => {
  updatePeersList();
  if ($helia?.libp2p) {
    $helia.libp2p.addEventListener("peer:connect", updatePeersList);
    $helia.libp2p.addEventListener("peer:disconnect", updatePeersList);
  }
  updateInterval = window.setInterval(updatePeersList, 5e3);
});
onDestroy(() => {
  if ($helia?.libp2p) {
    $helia.libp2p.removeEventListener("peer:connect", updatePeersList);
    $helia.libp2p.removeEventListener("peer:disconnect", updatePeersList);
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
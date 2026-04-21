export function isRelayedConnectionAddr(remoteAddr: string): boolean {
  return remoteAddr.includes('/p2p-circuit');
}

export function isDirectWebRTCConnectionAddr(remoteAddr: string): boolean {
  return !isRelayedConnectionAddr(remoteAddr) && remoteAddr.includes('/webrtc');
}

export function getTransportFromRemoteAddr(remoteAddr: string): string {
  if (isRelayedConnectionAddr(remoteAddr)) {
    if (remoteAddr.includes('/webrtc')) return 'Circuit WebRTC';
    if (remoteAddr.includes('/wss') || remoteAddr.includes('/tls/sni/')) return 'Circuit WSS';
    return 'Circuit';
  }

  if (remoteAddr.includes('/webrtc-direct')) return 'WebRTC Direct';
  if (remoteAddr.includes('/webrtc')) return 'WebRTC';
  if (remoteAddr.includes('/wss') || remoteAddr.includes('/tls/sni/')) return 'WSS';
  if (remoteAddr.includes('/ws')) return 'WS';
  if (remoteAddr.includes('/webtransport')) return 'WebTransport';
  if (remoteAddr.includes('/sni')) return 'SNI';

  return 'Unknown';
}

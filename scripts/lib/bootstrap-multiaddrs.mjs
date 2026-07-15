import { multiaddr } from '@multiformats/multiaddr';

export function extractPeerIdFromMultiaddr(address) {
  const parts = address.split('/').filter(Boolean);
  const peerIndex = parts.findIndex((part) => part === 'p2p' || part === 'ipfs');
  return peerIndex >= 0 ? parts[peerIndex + 1] || null : null;
}

export function isBrowserDialableBootstrapMultiaddr(address) {
  const normalized = address.toLowerCase();
  return (
    normalized.includes('/tls/ws') ||
    normalized.includes('/ws') ||
    normalized.includes('/wss') ||
    normalized.includes('/webrtc-direct')
  );
}

function rankBrowserBootstrapMultiaddr(address) {
  const normalized = address.toLowerCase();
  if (normalized.includes('/tcp/443/') && normalized.includes('/tls/ws')) return 0;
  if (normalized.includes('/tls/ws')) return 1;
  if (normalized.includes('/wss')) return 2;
  if (normalized.includes('/ip4/127.0.0.1/') && normalized.includes('/ws')) return 3;
  if (normalized.includes('/ws')) return 4;
  if (normalized.includes('/webrtc-direct')) return 5;
  return 10;
}

export function selectValidBrowserBootstrapMultiaddrs(addresses) {
  return [...new Set(addresses.map((address) => address.trim()).filter(Boolean))]
    .filter(isBrowserDialableBootstrapMultiaddr)
    .filter((address) => {
      try {
        multiaddr(address);
        return extractPeerIdFromMultiaddr(address) != null;
      } catch {
        return false;
      }
    })
    .sort(
      (left, right) => rankBrowserBootstrapMultiaddr(left) - rankBrowserBootstrapMultiaddr(right),
    );
}

export function parseBootstrapMultiaddrs(value) {
  return typeof value === 'string'
    ? value
        .split(',')
        .map((address) => address.trim())
        .filter(Boolean)
    : [];
}

export function resolveBootstrapMultiaddrs({ override, discovered = [], fallback } = {}) {
  const candidates = [
    ['override', parseBootstrapMultiaddrs(override)],
    ['aleph', [...discovered]],
    ['fallback', parseBootstrapMultiaddrs(fallback)],
  ];

  for (const [source, addresses] of candidates) {
    const selected = selectValidBrowserBootstrapMultiaddrs(addresses);
    if (selected.length > 0) {
      return { addresses: selected, source };
    }
  }

  return { addresses: [], source: 'none' };
}

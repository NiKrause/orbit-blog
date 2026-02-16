# Le Space Blog

Local-first, peer-to-peer blogging powered by OrbitDB, libp2p, and IPFS.

[![Tests](https://github.com/NiKrause/orbit-blog/actions/workflows/test.yml/badge.svg)](https://github.com/NiKrause/orbit-blog/actions/workflows/test.yml)

Status: alpha/experimental. Not security audited.

## Try It (PWA)
IPNS: `ipns://k51qzi5uqu5dixys1k2prgbng4z9uxgvc4kj8l1xww1v5irt5cn3j5q402a0yb`

Gateway: `https://k51qzi5uqu5dixys1k2prgbng4z9uxgvc4kj8l1xww1v5irt5cn3j5q402a0yb.ipns.dweb.link/`

Latest IPFS CID: QmUHUu3S9YRogrZuNpyvKy6ce5DggStSviYVJEjLk9vgaM

Latest IPFS Gateway: https://QmUHUu3S9YRogrZuNpyvKy6ce5DggStSviYVJEjLk9vgaM.ipfs.dweb.link/

## What It Does
- Create a personal blog in the browser.
- Replicate posts, comments, and media directly between peers.
- Store media locally on IPFS (Helia).
- Share a blog address and subscribe from another peer.

## Docs
- Markdown extensions: `docs/MARKDOWN_GUIDE.md`
- Remote Markdown imports: `docs/REMOTE_MARKDOWN_IMPORT.md`
- AI agent codebase map: `docs/AI_AGENTS.md`

## Development
```bash
npm i
npm run dev
```

Relay (local):
```bash
npm run relay:test
```

## Tests
```bash
npm test
npm run test:e2e
```

## Debugging
Browser console examples:
```js
localStorage.setItem('debug', 'le-space:*')
localStorage.setItem('debug', 'libp2p:circuit-relay:*,libp2p:discovery:*,libp2p:dcutr:*')
localStorage.setItem('debug', 'libp2p:*,helia:*,le-space:blog:*')
```

Local dev via env:
```bash
LOG_LEVEL=debug npm run dev
```

## License
MIT

## Contact
`https://www.le-space.de`

<table border="0" cellspacing="0" cellpadding="0">
  <tr>
      <td>
      <h1>Le Space-Blog</h1>
      <p>A local-first & peer-to-peer blog powered by OrbitDB which replicates between browsers and mobile apps.</p>
      </td>
    <td><img src="./public/orbitbloglogo-700.png" width="300" alt="Le Space Blog Logo"></td>
  </tr>
</table>

> ⚠️ **Alpha Version Notice**: This code is currently in experimental code and was written with the help of early AI supported code editors and coding agents. It is not intended for production! Code may change, break backwards compatibility, or contain major issues. It has not been security audited. Use accordingly.

[![Tests](https://github.com/NiKrause/orbit-blog/actions/workflows/test.yml/badge.svg)](https://github.com/NiKrause/orbit-blog/actions/workflows/test.yml)

## Description

Le Space-Blog is a decentralized blogging application that leverages OrbitDB for peer-to-peer data replication and IPFS for content storage. It enables users to create, manage, and share blog content in a decentralized manner, so blog posts are stored with the blog author and their readers maintain a replica via peer-to-peer connections.
Since this would require the blog author to leave his browser open 24/7 for the readers to read the blog, soon we offer blog pinning nodes for blog authors, which can be run at home (self hosted) on your desktop or as RaspberryPi image in your living room, as docker image if you want to install it on a cloud server or as a paid service.

## Installation

### As Progressive Web App (PWA)

Visit our IPNS link (requires [IPFS Companion](https://docs.ipfs.tech/install/ipfs-companion/)):
- IPNS: [ipns://k51qzi5uqu5dixys1k2prgbng4z9uxgvc4kj8l1xww1v5irt5cn3j5q402a0yb](https://k51qzi5uqu5dixys1k2prgbng4z9uxgvc4kj8l1xww1v5irt5cn3j5q402a0yb.ipns.dweb.link/)

[![QR Code to PWA](/public/ipns.dweb.link.png)](https://k51qzi5uqu5dixys1k2prgbng4z9uxgvc4kj8l1xww1v5irt5cn3j5q402a0yb.ipns.dweb.link/)

## Features

### Core Features
- ✅ Personal peer-to-peer blog creation
- ✅ Media files stored directly to IPFS in your apps Helia node
- ✅ Blog address sharing
- ✅ Blog subscriptions
- ✅ Identity management via 12-word encrypted seed (Metamask, Nostr coming soon) 
- ✅ Markdown support
- ✅ Post search
- ✅ Progressive Web App (PWA) support

### Technical Features
- ✅ OrbitDB replicates blogs to readers
- ✅ Temporary and persistent peer ID generation
- ✅ Blog deployed on IPFS 
- ✅ Internationalization (en, de, fr, es, it, ru, zh, ar, tr)
- ✅ URL hash routing for blog sharing
- ✅ LibP2P-Transport via secure Websocket, WebRTC and Webtransport

## Logging Configuration

The web application uses the flexible libp2p logging system. You can configure the logging level through the browser's console. Checkout the following log levels:
localStorage.setItem('debug', 'le-space:*') observers the le-space blog internals db and replication operations
localStorage.setItem('debug', 'libp2p:circuit-relay:*,libp2p:discovery:*,libp2p:dcutr:*') observes circuit-relay, peer discovery, dcutr important for peer-to-peer communication between browsers
localStorage.setItem('debug', 'libp2p:*,helia:*,le-space:blog:*') observers all logs of libp2p, helia and le-space blog


#### Using Environment Variables
When running the application locally, you can set the log level using an environment variable:
```bash
LOG_LEVEL=debug npm run dev
```

### Default Log Level
By default, the application logs at the `info` level, which provides a good balance between useful information and console clutter.

## Roadmap

### In Development
- Identity & Security
  - Metamask wallet integration
  - zkEmail-Integration for account recovery (under consideration)
  - write permissions for certain roles (One-Time Write Permission, Permanent Write Permission)
  
- Pinning Service Infrastructure 
  - Custom Voyager instance 
  - Voyager supports Pubsub peer discovery
  - Centralized Fiat+Crypto Pinning Gateway
  - Decentralized-Peer-to-Peer Voyager Network for OrbitDB Pinning

### Future Plans
- Advanced Data Management
  - Encrypted backups and restoration
  - Integration with FileCoin, ArWeave, Aleph-IM

- Content Features
  - Interactive blog posts with Svelte code execution

- DevOps
  - End-to-end testing
  - CI/CD pipeline with Docker
  - Automated IPFS publishing

## Contributing

This project is in active development. Contributions are welcome. Please check the issues page for current tasks and development priorities.

## License

This project is licensed under the MIT License.

## Contact

Visit us at [www.le-space.de](https://www.le-space.de)
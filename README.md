<table border="0" cellspacing="0" cellpadding="0">
  <tr>
      <td>
      <h1>Le Space-Blog</h1>
      <p>A local-first & peer-to-peer blog powered by OrbitDB which replicates between browsers and mobile apps.</p>
      </td>
    <td><img src="./public/orbitbloglogo-700.png" width="300" alt="Le Space Blog Logo"></td>
  </tr>
</table>

> ⚠️ **Alpha Version Notice**: This software is currently in alpha status and may change, break backwards compatibility, or contain major issues. It has not been security audited. Use accordingly.

## Description

Le Space-Blog is a decentralized blogging application that leverages OrbitDB for peer-to-peer data replication and IPFS for content storage. It enables users to create, manage, and share blog content in a decentralized manner, so blog posts are stored with the blog author and their readers maintain a replica via peer-to-peer connections.

## Installation

### As Progressive Web App (PWA)

Visit our IPNS link (requires [IPFS Companion](https://docs.ipfs.tech/install/ipfs-companion/)):
- IPNS: [ipns://k51qzi5uqu5djjnnjgtviql86f19isjyz6azhw48ovgn22m6otstezp2ngfs8g](https://k51qzi5uqu5djjnnjgtviql86f19isjyz6azhw48ovgn22m6otstezp2ngfs8g.ipns.dweb.link/)

[![QR Code to PWA](/public/ipns.dweb.link.png)](https://k51qzi5uqu5djjnnjgtviql86f19isjyz6azhw48ovgn22m6otstezp2ngfs8g.ipns.dweb.link/)

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

The application uses a flexible logging system with different log levels to help with debugging and monitoring. You can configure the logging level through the browser's console or by setting the `LOG_LEVEL` environment variable.

### Available Log Levels
- `error`: Critical errors that need immediate attention
- `warn`: Warning messages for potential issues
- `info`: General information about application state
- `debug`: Detailed debugging information
- `trace`: Very detailed tracing information

### How to Configure Log Levels

#### In Browser Console
1. Open your browser's developer tools (F12 or right-click -> Inspect)
2. Go to the Console tab
3. Set the desired log level by typing:
   ```javascript
   localStorage.setItem('LOG_LEVEL', 'debug'); // Replace 'debug' with your desired level
   ```
4. Refresh the page to apply the changes

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
<table border="0" cellspacing="0" cellpadding="0">
  <tr>
      <td>
      <h1>Orbit-Blog</h1>
      <p>A local-first & peer-to-peer blog powered by OrbitDB which replicates between browsers and mobile apps.</p>
      </td>
    <td><img src="./public/orbitbloglogo-700.png" width="300" alt="Orbit Blog Logo"></td>
  </tr>
</table>

> ⚠️ **Alpha Version Notice**: This software is currently in alpha status and may change, break backwards compatibility, or contain major issues. It has not been security audited. Use accordingly.

## Description

Orbit-Blog is a decentralized blogging application that leverages OrbitDB for peer-to-peer data replication and IPFS for content storage. It enables users to create, manage, and share blog content in a truly decentralized manner, with support for categories, comments, and media uploads.

## Installation

### As Progressive Web App (PWA)

Visit our IPNS link (requires [IPFS Companion](https://docs.ipfs.tech/install/ipfs-companion/)):
- IPNS: [ipns://k51qzi5uqu5djjnnjgtviql86f19isjyz6azhw48ovgn22m6otstezp2ngfs8g](https://k51qzi5uqu5djjnnjgtviql86f19isjyz6azhw48ovgn22m6otstezp2ngfs8g.ipns.dweb.link/)

[![QR Code to PWA](/public/ipns.dweb.link.png)](https://k51qzi5uqu5djjnnjgtviql86f19isjyz6azhw48ovgn22m6otstezp2ngfs8g.ipns.dweb.link/)

## Features

### Core Features
- ✅ Personal peer-to-peer blog creation with categories and comments
- ✅ Local IPFS-based media uploads
- ✅ Private blog address sharing
- ✅ Read-only blog subscriptions
- ✅ Identity management via:
  - 12-word encrypted seed phrase
  - Nostr Wallet
- ✅ Markdown support for rich content
- ✅ Post search functionality
- ✅ Progressive Web App (PWA) support

### Technical Features
- ✅ OrbitDB integration with remote blog replication
- ✅ Persistent peer ID generation
- ✅ Secure seed phrase storage
- ✅ IPFS deployment support
- ✅ Internationalization (en, de, fr, es, it, ru)
- ✅ URL hash routing for blog sharing
- ✅ Secure WebSocket connections (WSS)

## Roadmap

### In Development
- Identity & Security
  - Metamask wallet integration
  - zkEmail-Integration for account recovery
  - Peer-specific write permissions
  
- Content Management
  - Comment search functionality
  - Markdown support for comments
  - About section creation
  
- Infrastructure
  - Custom Voyager instance deployment
  - Pubsub peer discovery
  - Monitoring with Prometheus & Grafana

### Future Plans
- Advanced Data Management
  - Encrypted backups and restoration
  - Integration with Filecoin and Arweave
  - IPFS pubsub pinning

- Security Enhancements
  - OneTimeAccessController implementation
  - Owner-specific content controls

- Content Features
  - Interactive blog posts with code execution
  - Svelte component integration in markdown

- DevOps
  - End-to-end testing
  - CI/CD pipeline with Docker
  - Automated IPFS publishing

## Contributing

This project is in active development. Contributions are welcome. Please check the issues page for current tasks and development priorities.

## License

[License information to be added]

## Contact

[Contact information to be added]
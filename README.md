<table border="0" cellspacing="0" cellpadding="0">
  <tr>
      <td>
      <h1>Orbit-Blog</h1>A local-first & peer-to-peer blog powered by OrbitDB which replicates between browsers and mobile apps. It is hosted on IPFS.</td>
    <td><img src="./public/orbitbloglogo-700.png" width="300" alt="Orbit Blog Logo"></td>
  </tr>
</table>
Note! This software is currently in alpha version status and thus may change, break backwards compatibility or contain major issues. It has not been security audited. Use it accordingly.

### Install as Progressive Web App (PWA)

Visit [orbit-blog @ ipns](ipns://k51qzi5uqu5djjnnjgtviql86f19isjyz6azhw48ovgn22m6otstezp2ngfs8g) [IPFS Companion needed](https://docs.ipfs.tech/install/ipfs-companion/)

[![QR Code to PWA](/public/ipns.dweb.link.png)](https://k51qzi5uqu5djjnnjgtviql86f19isjyz6azhw48ovgn22m6otstezp2ngfs8g.ipns.dweb.link/)

# Orbit-Blog: Local-First P2P Blogging Platform

Orbit-Blog is a decentralized blogging platform that leverages the power of OrbitDB and IPFS to create a truly peer-to-peer experience. This web and mobile application allows content to replicate seamlessly between browsers and mobile devices without relying on centralized servers. Built as a Progressive Web App (PWA), Orbit-Blog can be installed directly to your desktop or mobile browser experience.

## Current Features
- Create a personal peer-to-peer blog with categories and comments
- Share the blog privately via a blog address via social media 
- Publish a blog onto the peer-to-peer blogging network 
- Subscribe and replicate other blogs 

### Core Functionality
- Local-first data storage with peer-to-peer replication
- Restore blog data from replicating nodes with your seed phrase only (MetaMask & Nostr planed)
- Persistent or temporary identity management (store seed persistently securely on your mobile - leave the temporary in your desktop browser)
- Encrypted seed phrase storage with password protection
- Editable and flexible post categories
- Markdown support for rich content creation
- Search functionality within posts

### OrbitDB Integration
- Connection and replication with remote blogs
- Persistent peer ID generation from seed phrases
- Identity switching between temporary and persistent modes

### Deployment & Accessibility
- IPFS deployment support
- Progressive Web App (PWA) functionality
- Version management

## Development Roadmap

### Short-Term Goals
1. **Mobile Experience Enhancement**
   - [x] Fix sidebar layout issues
   - [x] Disable zoom for better mobile UX

2. **UI Improvements**
   - [x] Fix / Enable Voyager Blog Pinning
   - [ ] Add remote database together with the peerId (in 'one string')
   - [ ] Implement QR code scanning functionality (necessary together with the OneTimeAccessController)
   - [ ] Add internationalization support (en, de, fr, es, it, ru)
   - [x] Enable blog address sharing via URL hash routing

### Mid-Term Goals
1. **Search & Content Enhancements**
   - [ ] make comments a separate OrbitDB table with separate AccessControler
   - [ ] Add search functionality for comments
   - [ ] Implement markdown support for comments
   - [ ] Create an "About" section

2. **Identity & Security**
   - Implement overwrite functionality for seed phrases
   - Generate new peer IDs and identities
   - Support various identity providers (Nostr, Metamask)

3. **Voyager Integration**
   - Configure custom Voyager instances via 
      - [ ] One-Time-Click-Hosting (e.g. Hetzner)
      - [ ] Self-hosted via Docker
      - [ ] Desktop via Electron 
      - [ ] Raspberry Pi
   - [ ] Implement secure WebSocket connections (WSS)
   - [ ] Add pubsub peer discovery support
   - [ ] Add monitoring with Prometheus & Grafana

### Long-Term Goals
1. **Advanced Data Management**
   - Create encrypted backups with restore functionality
   - Enable storage on Filecoin, Arweave, and cloud services
   - Implement pubsub IPFS pinning for posts and comments

2. **Access Control & Security**
   - Develop peer-specific write permissions
   - Implement OneTimeAccessController for enhanced security
   - Create owner-specific content management controls

3. **Media & Content Expansion**
   - Support image uploads with IPFS integration
   - Implement Svelte components within markdown
   - Enable code execution for interactive blog posts

4. **Testing & Deployment**
   - Develop end-to-end testing
   - Create CI/CD pipeline with Docker integration
   - Implement automated IPFS publishing and pinning
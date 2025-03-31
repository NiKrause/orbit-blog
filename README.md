<table border="0" cellspacing="0" cellpadding="0">
  <tr>
      <td>
      <h1>Orbit-Blog</h1>A local-first & peer-to-peer blog powered by OrbitDB which replicates between browsers and mobile apps. It is deployed on IPFS.</td>
    <td><img src="./public/orbitbloglogo-700.png" width="300" alt="Orbit Blog Logo"></td>
  </tr>
</table>
Note! This software is currently in alpha version status and thus may change, break backwards compatibility or contain major issues. It has not been security audited. Use it accordingly.

### Install as Progressive Web App (PWA)

Visit [orbit-blog @ ipns](ipns://k51qzi5uqu5djjnnjgtviql86f19isjyz6azhw48ovgn22m6otstezp2ngfs8g) [IPFS Companion needed](https://docs.ipfs.tech/install/ipfs-companion/)

[![QR Code to PWA](/public/ipns.dweb.link.png)](https://k51qzi5uqu5djjnnjgtviql86f19isjyz6azhw48ovgn22m6otstezp2ngfs8g.ipns.dweb.link/)

## Current Features
- [x] Create a personal peer-to-peer blog with categories and comments
- [x] Upload media (photos) to local IPFS node running in the browser
- [x] Share the blogs address privately via social media 
- [x] Subscribe to blogs read-only 
- [ ] Give write permission
- [ ] Publish a blog onto the peer-to-peer blogging network to be visible and readable by others
- [ ] Create an asynchronous encrypted blog (with password)
- [ ] Make blog permanently stored (via ArWeave)
- [x] Identity via 12-word encrypted seed phrase
- [ ] Identity via Metamask wallet (Ethereum)
- [x] Identity via Nostr Wallet
- [ ] zkEmail-Integration for Metamask account recovery   

### Core Functionality
- [ ] Local-first data storage with peer-to-peer replication
- [ ] so far free centralized voyager pinning service
- [ ] run your own voyager pinning service  
- [x] Restore blog data from replicating nodes with your seed phrase only
- [x] Persistent or temporary identity management (store seed persistently securely on your mobile - leave the temporary in your desktop browser)
- [x] Encrypted seed phrase storage with password protection
- [x] Editable and flexible post categories
- [x] Markdown support for rich content creation
- [x]Search functionality within posts

### OrbitDB Integration
- [x] Connection and replication with remote blogs
- [x] Persistent peer ID generation from seed phrases
- [x] Identity switching between temporary and persistent modes

### Deployment & Accessibility
- [x] IPFS deployment support
- [x] Progressive Web App (PWA) functionality

## Development Roadmap

### Short-Term Goals
1. **Mobile Experience Enhancement**
   - [x] Fix sidebar layout issues
   - [x] Disable zoom for better mobile UX

2. **UI Improvements**
   - [x] Fix / Enable Voyager Blog Pinning
   - [x] Add internationalization support (en, de, fr, es, it, ru)
   - [x] Enable blog address sharing via URL hash routing

### Mid-Term Goals
1. **Search & Content Enhancements**
   - [x] make comments a separate OrbitDB table with separate AccessControler
   - [ ] Add search functionality for comments
   - [ ] Implement markdown support for comments
   - [ ] Create an "About" section

2. **Identity & Security**
   - [x] Implement overwrite functionality for seed phrases
   - [ ] Generate new peer IDs and identities
   - [ ] Support various identity providers (Nostr, Metamask)

3. **Voyager Integration**
   - Configure custom Voyager instances via 
      - [ ] One-Time-Click-Hosting (e.g. Hetzner, Vercel)
      - [ ] Self-hosted via Docker
      - [ ] Desktop via Electron 
      - [ ] Raspberry Pi
   - [x] Implement secure WebSocket connections (WSS)
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
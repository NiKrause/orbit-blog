# Orbit-Blog Release Plan

## Current Version: 0.2

## Known Bugs
1. Locks & keys in sidebar are updating too late
2. Tailwind components aren't activated when using blog lib
3. Blog author gets lost when updating (only on ipns.dweb.link)
   - Related: Author data loss when testing locally vs production
4. Toggle button temporary persistent seed phrase suddenly missing
5. If URL isn't the main URL - show warning

## Release Plan

### Version 0.2 (Core Functionality & Critical Improvements)
- [x] Drop database improvements
  - [x] Ask user before dropping DB
  - [x] Option to drop locally or on voyager
  - [x] Recursive drop of posts, comments, media
  - [x] Unpin IPFS files
- [x] cloning a database
- [ ] PostList drag-and-drop ordering with position storage
- [ ] Warn user if firewall doesn't support ICE (WebRTC/P2P)
- [ ] External CID parsing via internal Helia (not dweb.link) for IPFS image links in markdown
- [ ] Periodic reconnection attempts for libp2p disconnects
- [ ] Better password decryption workflow
- [ ] Private/Public/Link sharing options
- [ ] QR-Code scanning implementation completion

### Version 0.3 (Enhanced Features)
- [ ] AI Integration
  - [ ] Spell checker
  - [ ] Translator with configurable private API
- [ ] Settings Improvements
  - [ ] Logo configuration
  - [ ] Navigation activation
  - [ ] Favicon configuration
  - [ ] CSS style configuration
  - [ ] Imprint and data protection
  - [ ] Background media for blog/posts
- [ ] Search functionality for comments
- [ ] About page implementation
- [ ] Backup & restore functionality (encrypted)
  - [ ] Support for Aleph IM, Filecoin, Arweave
  - [ ] Cloud storage integration

### Version 0.4 (Platform & Integration)
- [ ] Web2.0 Integration
  - [ ] RSS Feed
  - [ ] Social media photo display
  - [ ] Vercel hosting for le-space.de
- [ ] Blockchain Integration
  - [ ] PoE for blog posts
  - [ ] Username/DID via various blockchains
  - [ ] Nostr & Metamask integration
- [ ] Voyager Improvements
  - [ ] Media CID pinning
  - [ ] Quota management
  - [ ] UI for pinned DBs
  - [ ] DID support
- [ ] Internationalization
  - [ ] Multiple language support
  - [ ] AI translation integration
  - [ ] Translation service integration

### Version 0.5 (Advanced Features)
- [ ] Blog forking & merging capability
- [ ] Svelte components in markdown
- [ ] WebRTC direct connections
- [ ] OneTimeAccessController implementation
- [ ] CI/CD Pipeline
  - [ ] Docker build
  - [ ] IPFS publishing
  - [ ] CID management
  - [ ] Version tagging
- [ ] E2E testing implementation

## Development Guidelines
1. Focus on fixing the bugs in Version 0.2 first
2. Prioritize features that improve core functionality and user experience
3. Implement more complex features in later versions
4. Consider breaking down larger features into smaller, manageable tasks
5. Regular testing cycles between versions to ensure stability

## Notes
- Each version should undergo thorough testing before release
- Bug fixes take priority over new feature development
- Features may be moved between versions based on priority changes
- Regular security audits should be performed
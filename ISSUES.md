<table border="0" cellspacing="0" cellpadding="0">
  <tr>
      <td>
      <h1>Le Space-Blog</h1>A local-first & peer-to-peer blog powered by OrbitDB which replicates between browsers and mobile apps. IPFS (only)</td>
    <td><img src="./public/orbitbloglogo-700.png" width="300" alt="Le Space Blog Logo"></td>
  </tr>
</table>
Note! This software is currently in alpha version status and thus may change, break backwards compatibility or contain major issues. It has not been security audited. Use it accordingly.

### Install as Progressive Web App (PWA)

Visit [orbit-blog @ ipns](ipns://k51qzi5uqu5djjnnjgtviql86f19isjyz6azhw48ovgn22m6otstezp2ngfs8g) [IPFS Companion needed](https://docs.ipfs.tech/install/ipfs-companion/)

[![QR Code to PWA](/public/ipns.dweb.link.png)](https://k51qzi5uqu5djjnnjgtviql86f19isjyz6azhw48ovgn22m6otstezp2ngfs8g.ipns.dweb.link/)

### Todos, Features, Issues
- Todos:
    - [x] Bug: Website in browsers and mobile apps pwa is cached too long: nginx must send no-cache header
    - [x] Feature: Privacy Statement
    - [ ] Feature RSS Feed: Auf Web2.0
    - [ ] Feature: add Github Link
    - [ ] Feature: when adding IPFS-image links into markdown, it should also parse external CIDs not just cids which are inside our media library
    - [ ] Bug: locks & keys in sidebar are updating too late
    - [x] Feature: when dropping db - ask user before - if drop only locally or also on voyager! Drop recursive posts, comments, media and unpin ipfs files 
    - [ ] Feature: PostList should be possible to drag posts up and down and order them and store position at the post document 
    - [ ] Feature: warn user if firewall doesn't support ICE (WebRTC/Peer-To-Peer)
    - [ ] Feature: le-space.de should be hosted on vercel 
        - [ ] Feature: run voyager as relay and pinning service
        - [ ] Feature: deliver posts in classic web2.0 mode to display photos in social media e.g. Telegram, Twitter etc. 
    - [x] Bug: blog author get's lost when updating (only on ipns.dweb.link)
    - [x] Feature: author needs to be shortened, the ID is too long, need to hover to see it fully
        - [ ] obviously it get's lost but when testing locally and in production it is not loosing data 
    - [ ] Feature: integrated AI spell checker
    - [ ] Feature: integrated AI translater via configurable private API url 
    - [ ] Feature: Create Svelte lib from project, so it can be used in other projects as component
        - [x] lib created
        - [ ] Bug tailwind components aren't activated when using lib
        - [ ] Feature: Run voyager
    - [x] editable, deletable, history only when write access
    - [x] comments can't be stored anymore
    - [x] when switching network off, blog should read local db and not connect. At the moment it tries to connect online and fail
        - [x] in dbutils try/catch if voyager.orbitdb.open works otherwise just do orbitdb.open (directly!) this could be done encapsulated internally inside voyager api
    - [ ] BUG: issue with tailwind components - tailwind components are not activated when importing blog lib! 
    - [x] Feature: default orbit blog address configurable by nginx config location .orbitblog 
    - [ ] Feature: default orbit blog address configurable by ethereum, polygon, namecoin, bitcoin, arweave? (possible by hostname) 
    - ]x] Feature: PDF export from a post content
    - [ ] Feature: AI prompt templates + file upload e.g. 
        - [ ] Feature: correct my spelling
        - [ ] Feature: translate to English, Spanish, etc.
    - [ ] Settings 
        - [ ] Feature: Configure a logo
        - [ ] Feature: activate a navigation
        - [ ] Feature: Configure a favicon
        - [ ] Feature: configure a different css style
        - [ ] Feature: Configure imprint and data protection 
        - [ ] Feature: Configure background video or image for blog
        - [ ] Feature: Configure background video or image for post
    - [x] Feature: add lock / unlock icon's for blocks which are writable / locked
    - [x] Feature: add posts count before remote sidebar
    - [x] Feature: upload media (images / videos / audio) to each post and make them show up on the right side next to the post relative to a certain position in the text
    - [ ] Feature: better decrypt password only before write operations (simple in case nobody else has write access for own dbs - not so easy with shared write access)
    - [ ] Feature: private / private + link / public 
    - [x] Feature: green/orange indication doesn't work for new local blogs
    - [ ] Feature: toggle button temporary persistent seed phrase suddenly missing 
    - [ ] Feature: if url isn't the main url - show warning
    - [ ] Feature: Scan QR-Code isn't fully implemented - make invisible
    - [x] improve usability mobile
        - [x] remote blogs not clickable
        - [x] disable zoom
        - [x] sidebar destroys layout
    - [x] restore old blog posts from OrbitDB log history
    - [x] peer-to-peer via WebRTC between two browsers doesn't work
    - [x] disable DID and enable default orbitdb.id, DID not yet supported by voyager  
    - [x] adding & deleting blog databases works only with reloading the page
    - [x] in settings the storing the posts db address should happen somewhat automatically, because if forgotten, others cannot add it to there saved blogs
    - [x] relay not accessible - renew ssl certifcate
    - [x] password should only be asked if a seed phrase is in local storage and we have chose persistent identity 
    - [x] peerId is a new one after each page load even if we have a persistent identity
    - [?] can it be useful to have a new peerId even if identity is persistent? What would be the draw back?   
- UI related
    - [ ] Feature: order posts by an id and make post list draggable
    - [ ] Feature: creating a new blog should be easier then the moment (one button click)
    - [ ] Feature: when loading blog first time and posts are getting replicated they do not appear one by one as they come (loaded but not reactively displayed)
    - [ ] Feature: Markdown improvements
        - [ ] Feature: execute Svelte components inside a post! 
        - [x] Feature: make accordion component for certain markdown e.g. ----
    - [ ] Feature: copy / fork a blog to become my own blog
        - [ ] Feature: fork/merge (PR's) possible?
    - [ ] Feature: create PoE for blog post on several blockchains (e.g. Bitcoin, Namecoin etc.)
    - [ ] Feature: configure your own voyager
        - [ ] Feature: via Electron for desktop
        - [ ] Feature: on RaspberryPi
        - [ ] Feature: via Docker
        - [ ] Feature: via One Time Click 
    - [ ] Feature: internationalize the UI (en,de,fr,es,it,ru,...)
        - [ ] Feature: https://inlang.com/m/gerre34r/library-inlang-paraglideJs/basics
        - [ ] Feature: use AI for translation
        - [ ] Feature: use translation services
    - [x] Feature: orbitdb address (blog address) should be possible to be given over the url in hash router /#/orbitdb/xyz
    - [x] Feature: editable / flexible categories
    - [x] Feature: editable posts
    - [x] Feature: deploy to IPFS
    - [x] Feature: markdown support for posts 
    - [?] Feature: markdown support for comments
    - [x] Feature: search in posts 
    - [ ] Feature: search in comments (put comments into own db - but take care with access rights (*/OneTimeAccessController))
    - [ ] Feature: add about
- OrbitDB related
    - [x] Feature: support multiple blogs per instance
    - [ ] Feature: if libp2p disconnects because of wifi network disconnects, try to reconnect periodically (first faster then less frequent)
    - [ ] Feature: overwrite seedPhrase and generate new peerId and identity (did)
    - [ ] Feature: generateMasterSeed should be generated with another password at some point
    - [x] Feature: Voyager evaluation
        - [ ] Feature: pin media cids in pinned media dbs!
        - [x] Feature: install voyager as pinning service https://github.com/orbitdb/voyager/tree/main
        - [x] Feature: add db addresses to voyager
        - [ ] Feature: remove db address from voyager recursively including unpin of files
        - [ ] Feature: check current quota and used space of identity
        - [x] Feature: allow persistent peerId
        - [x] Feature: make voyager websocket wss e.g. 
            - [ ] Feature: autotls 
                - http://bafybeihxl3cwxwh3lwbjhryxv7anf7lfbk2ynqobu55r54po73ds2csrti.ipfs.localhost:8081/autotls/
                - https://www.npmjs.com/package/@libp2p/auto-tls
            - [x] Feature: docker compose + nginx + certbot
                - https://github.com/silkroadnomad/libp2p-relay/blob/main/docker-compose.yml
                - https://github.com/silkroadnomad/libp2p-relay/blob/main/init-letsencrypt.sh
        - [ ] Feature: support prometheus metrics 
            - https://github.com/libp2p/js-libp2p/blob/main/packages/metrics-prometheus/test/metrics.spec.ts
        - [ ] Feature: make voyager support pubsub peer discovery
        - [ ] Feature: create UI which shows all pinned db's
            - [ ] Feature: drop db
            - [ ] Feature: show contents of db (db.all())
        - [ ] Feature: support DID on voyager
        - [x] Feature: test voyager replication
    - [x] Feature: add first production blog 
        - [ ] le-space.de products
        - [ ] le-space.de how-to's
        - [x] nicokrause.com
    - [ ] Feature: when clicking on a peerId, open a modal to show information about the peer and request information such as (public blog names, impressum, etc.)
    - [ ] Feature: 'publish' blog on request 
        - Feature: make it visible when clicking on peerId
        - Feature: pubsub blog(s) via network
        - Feature: display tag cloud 
        - Feature: display blog cloud
    - [ ] Feature: enter optional imprint in settings (for public blogs) 
    - [ ] Feature: when adding a blog address think about optionally adding and dialing peerId too (at least when scanning?)
        - [ ] Feature: sometimes the db cannot be found nor opened then data like blogName, blogAddress can't be read, in such case it might be interesting to implmenent a retry mechanism, e.g. adding it to a queue and try every 20 seconds and remove it from the queue as soon it could connect       
    - [x] Feature: blog settings via private settings db
        - [x] Feature: blog name
        - [x] Feature: blog description
        - [x] Feature: postsdb address
        - [x] Feature: commentsdb address  
        - [ ] Feature: username/did by blockchain (Bitcoin Ordinals, Runes, Namcoin, Doichain)
        - [ ] Feature: did
        - [ ] Feature: did / id by Nostr-Chrome-Extension
        - [ ] Feature: did / id by Metmask extension
        - [x] Feature: seed phrase
        - [x] Feature: seed phrase encrypted by password
        - [ ] Feature: seed phrase encrypted by passkey
    - [x] Feature: generate seed phrase, masterseed
    - [x] Feature: generate libp2p peerid from seed phrase / masterseed  
    - [x] Feature: switch between temporary identity & peerId (default for browsers) and persistent identity & peerId (for mobiles)
        - if temporary, always create new seed phrase & identity for orbitdb on app start
            - https://github.com/silkroadnomad/deContact/blob/main/src/lib/network/getIdendityAndCreateOrbitDB.js
            - https://github.com/silkroadnomad/deContact/blob/main/src/lib/network/identityProvider.js
            - https://github.com/silkroadnomad/deContact/blob/main/src/utils/utils.js#L34
    - [x] Feature: add posts settings db  
    - [ ] Feature: Feature: create encrypted backup & restore of posts, settings, remoteDBs and store on Aleph IM, Filecoin, Arweave etc.  (Dropbox, Google Drive, Apple Cloud, Yandex Cloud etc.)
    - [ ] Feature: setup your own relay / voyager
    - [ ] Feature: AcccessController: blog can only write the local peer-id
    - [x] Feature: hide delete posts / comments button if not owner  
    - [ ] Feature: implement OneTimeAccessController 
        - https://github.com/silkroadnomad/deContact/blob/main/src/lib/network/AddressBookAccessController.js
        - keep temporary private key / peer-id on laptop 
        - keep secure private key / persistent peer-id on phone
        - implement One-Time-Access-Controller with own stream protocol and qr-code peering (phone accepts simple pubsub peering messages with simple pin code comparison)
    - [x] Feature: DBManager connect & replicated remote blogs
    - [ ] demonstrate webrtc-direct connections without relay-server but SDP-QR-Codes, SDP-voice or browser bluetooth
    - [x] Feature: upload & replicate images / integrate ipfs images cids into markdown
    - [ ] Feature: implement svelte components into markdown so they they can be executed / upload svelte code as attachment for the post
- App related
    - [x] Feature: deployable to IPFS
    - [x] Feature: run as PWA
        - [x] vite-plugin-pwa
        - [x] orbitlogo ai generated
    - [x] Feature: version management
    - [ ] Feature: e2e tests
    - [ ] Feature: ci / cd
        - build project inside docker
        - publish to ipfs inside docker
        - extract CID of build folder
        - pin build cid on pinning service
        - tag version on github with CID
        - display version and CID inside settings / about 

### Additional Features & Goals
- Core Features
    - [ ] Give write permission system implementation
    - [ ] Publish blog onto peer-to-peer blogging network with visibility controls
    - [ ] Create asynchronous encrypted blog with password protection
    - [ ] zkEmail-Integration for Metamask account recovery
    - [ ] Comprehensive local-first data storage with peer-to-peer replication

### Access Control & Security
- [ ] Owner-specific content management controls
    - [ ] Define granular permission levels
    - [ ] Implement role-based access control
    - [ ] Add user management interface

### Data Management
- [ ] ArWeave Integration
    - [ ] Permanent storage implementation
    - [ ] Backup/restore functionality
    - [ ] Cost estimation and management 
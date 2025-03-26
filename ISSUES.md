<table border="0" cellspacing="0" cellpadding="0">
  <tr>
      <td>
      <h1>Orbit-Blog</h1>A local-first & peer-to-peer blog powered by OrbitDB which replicates between browsers and mobile apps. IPFS (only)</td>
    <td><img src="./public/orbitbloglogo-700.png" width="300" alt="Orbit Blog Logo"></td>
  </tr>
</table>
Note! This software is currently in alpha version status and thus may change, break backwards compatibility or contain major issues. It has not been security audited. Use it accordingly.

### Install as Progressive Web App (PWA)

Visit [orbit-blog @ ipns](ipns://k51qzi5uqu5djjnnjgtviql86f19isjyz6azhw48ovgn22m6otstezp2ngfs8g) [IPFS Companion needed](https://docs.ipfs.tech/install/ipfs-companion/)

[![QR Code to PWA](/public/ipns.dweb.link.png)](https://k51qzi5uqu5djjnnjgtviql86f19isjyz6azhw48ovgn22m6otstezp2ngfs8g.ipns.dweb.link/)

### Todos, Features, Issues
- Todos:
    - [ ] Create Svelte lib from project, so it can be used in other projects as component
        [x] lib created
        [ ] issue with tailwind components - tailwind components do not show up! 
    - [x] default orbitblog address configurable by dns txt attribute _orbitblog.example.com (by hostname) <- centralized approach 
    - [ ] default orbitblog address configurable by ethereum, polygon, namecoin, bitcoin 
    - ]x] PDF export from a post content

    - [ ] AI templates + file upload e.g. 
        - [ ] create a CV
        - [ ] correct my spelling
        - [ ] translate to English, Spanish, etc.
    - [ ] Settings: Configure a logo
    - [x] add lock / unlock icon's for blocks which are writable / locked
    - [x] add posts count before remote sidebar
    - [x] upload media (images / videos / audio) to each post and make them show up on the right side next to the post relative to a certain position in the text
    - [ ] better decrypt password only before write operations (simple in case nobody else has write access for own dbs - not so easy with shared write access)
    - [ ] private / private + link / public 
    - [x] green/orange indication doesn't work for new local blogs
    - [ ] toggle button temporary persistent seed phrase suddenly missing 
    - [ ] if url isn't the main url - show warning
    - [ ] Scan QR-Code isn't fully implemented - make invisible
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
    - [ ] copy a blog to becom own blog
        - [ ] fork/merge (PR's) possible?
    - [ ] create PoE for blog post on several blockchains (e.g. Bitcoin, Namecoin etc.)
    - [ ] configure your own voyager
        - [ ] via Electron for desktop
        - [ ] on RaspberryPi 
    - [ ] internationalize the UI (en,de,fr,es,it,ru,...)
        - [ ] https://inlang.com/m/gerre34r/library-inlang-paraglideJs/basics
        - [ ] use AI for translation
        - [ ] use translation services
    - [x] orbitdb address (blog address) should be possible to be given over the url in hash router /#/orbitdb/xyz
    - [x] editable / flexible categories
    - [x] editable posts
    - [x] deploy to IPFS
    - [x] markdown support for posts 
    - [?] markdown support for comments
    - [x] search in posts 
    - [ ] search in comments (put comments into own db - but take care with access rights (*/OneTimeAccessController))
    - [ ] add about
- OrbitDB related
    - [x] support multiple blogs per instance
    - [ ] if libp2p disconnects because of wifi network disconnects, try to reconnect periodically (first faster then less frequent)
    - [ ] overwrite seedPhrase and generate new peerId and identity (did)
    - [ ] generateMasterSeed should be generated with another password at some point
    - [x] Voyager evaluation
        - [ ] pin media cids in pinned media dbs!
        - [x] install voyager as pinning service https://github.com/orbitdb/voyager/tree/main
        - [x] add db addresses to voyager
        - [x] allow persistent peerId
        - [x] make voyager websocket wss e.g. 
            - [ ] autotls 
                - http://bafybeihxl3cwxwh3lwbjhryxv7anf7lfbk2ynqobu55r54po73ds2csrti.ipfs.localhost:8081/autotls/
                - https://www.npmjs.com/package/@libp2p/auto-tls
            - [x] docker compose + nginx + certbot
                - https://github.com/silkroadnomad/libp2p-relay/blob/main/docker-compose.yml
                - https://github.com/silkroadnomad/libp2p-relay/blob/main/init-letsencrypt.sh
        - [ ] support prometheus metrics 
            - https://github.com/libp2p/js-libp2p/blob/main/packages/metrics-prometheus/test/metrics.spec.ts
        - [ ] make voyager support pubsub peer discovery
        - [ ] create UI which shows all pinned db's
            - [ ] drop db
            - [ ] show contents of db (db.all())
        - [ ] support DID on voyager
        - [x] test voyager replication
    - [ ] add first production blog 
        - [ ] le-space.de products
        - [ ] le-space.de how-to's
        - [ ] nicokrause.com
    - [ ] when clicking on a peerId, open a modal to show information about the peer and request information such as (public blog names, impressum, etc.)
    - [ ] 'publish' blog on request 
        - make it visible when clicking on peerId
        - pubsub blog(s) via network
        - display tag cloud 
        - display blog cloud
    - [ ] enter optional imprint in settings (for public blogs) 
    - [ ] when adding a blog address think about optionally adding and dialing peerId too (at least when scanning?)
        - [ ] sometimes the db cannot be found nor opened then data like blogName, blogAddress can't be read, in such case it might be interesting to implmenent a retry mechanism, e.g. adding it to a queue and try every 20 seconds and remove it from the queue as soon it could connect       
    - [x] blog settings via private settings db
        - [x] blog name
        - [x] blog description
        - [x] postsdb address
        - [x] commentsdb address  
        - [ ] username/did by blockchain (Bitcoin Ordinals, Runes, Namcoin, Doichain)
        - [x] did
        - [ ] did / id by Nostr-Chrome-Extension
        - [ ] did / id by Metmask extension
        - [x] seed phrase
        - [x] seed phrase encrypted by password
        - [ ] seed phrase encrypted by passkey
    - [x] generate seed phrase, masterseed
    - [x] generate libp2p peerid from seed phrase / masterseed  
    - [x] switch between temporary identity & peerId (default for browsers) and persistent identity & peerId (for mobiles)
        - if temporary, always create new seed phrase & identity for orbitdb on app start
            - https://github.com/silkroadnomad/deContact/blob/main/src/lib/network/getIdendityAndCreateOrbitDB.js
            - https://github.com/silkroadnomad/deContact/blob/main/src/lib/network/identityProvider.js
            - https://github.com/silkroadnomad/deContact/blob/main/src/utils/utils.js#L34
    - [x] add posts settings db  
    - [ ] create encrypted backup & restore of posts, settings, remoteDBs and store on Aleph IM, Filecoin, Arweave etc.  (Dropbox, Google Drive, Apple Cloud, Yandex Cloud etc.)
    - [ ] setup your own relay / voyager
    - [?] enable pubsub ipfs pinning of posts and comments 
        - every post results into a new CID which needs to be published to pubsub pinning service
        - every CID needs to be packaged into a metadata.json name, description, media (CID) 
        - signature and public key from arriving pubsub message (if available)
        - pinning must be pre-paid (FIAT/Crypto) for a public-key
        - setup own hosted pinning-relay
        - run your own pinning RaspberryPi   
    - [ ] AcccessController: blog can only write the local peer-id
        - [ ] hide delete posts / comments button if not owner  
    - [ ] implement OneTimeAccessController 
        - https://github.com/silkroadnomad/deContact/blob/main/src/lib/network/AddressBookAccessController.js
        - keep temporary private key / peer-id on laptop 
        - keep secure private key / persistent peer-id on phone
        - implement One-Time-Access-Controller with own stream protocol and qr-code peering (phone accepts simple pubsub peering messages with simple pin code comparison)
    - [x] DBManager connect & replicated remote blogs
    - [ ] demonstrate webrtc-direct connections without relay-server but SDP-QR-Codes, SDP-voice or browser bluetooth
    - [ ] upload & replicate images / integrate ipfs images cids into markdown
    - [ ] implement svelte components into markdown so they they can be executed / upload svelte code as attachment for the post
- App related
    - [x] deployable to IPFS
    - [x] run as PWA
        - [x] vite-plugin-pwa
        - [x] orbitlogo ai generated
    - [x] version management
    - [ ] e2e tests
    - [ ] ci / cd
        - build project inside docker
        - publish to ipfs inside docker
        - extract CID of build folder
        - pin build cid on pinning service
        - tag version on github with CID
        - display version and CID inside settings / about 
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

### Todos & Features
- Issues:
    - [ ] improve usability mobile
        - [ ] remote blogs not clickable
        - [ ] disable zoom
        - [ ] sidebar destroys layout
    - [ ] Scan QR-Code isn't fully implemented
    - [x] peer-to-peer via WebRTC between two browsers doesn't work
    - [x] disable DID and enable default orbitdb.id, DID not yet supported by voyager  
    - [x] adding & deleting blog databases works only with reloading the page
    - [x] in settings the storing the posts db address should happen somewhat automatically, because if forgotten, others cannot add it to there saved blogs
    - [x] relay not accessible - renew ssl certifcate
    - [x] password should only be asked if a seed phrase is in local storage and we have chose persistent identity 
    - [x] peerId is a new one after each page load even if we have a persistent identity
    - [?] can it be useful to have a new peerId even if identity is persistent? What would be the draw back?   
- UI related
    - [ ] configure your own voyager 
    - [ ] internationalize the UI (en,de,fr,es,it,ru,...)
        - [ ] use AI for transaltion
        - [ ] use translation services
    - [ ] orbitdb address (blog address) should be possible to be given over the url in hash router /#/orbitdb/xyz
    - [x] editable / flexible categories
    - [x] editable posts
    - [x] deploy to IPFS
    - [x] markdown support for posts 
    - [?] markdown support for comments
    - [x] search in posts 
    - [ ] search in comments
    - [ ] add about
- OrbitDB related
    - [ ] overwrite seedPhrase and generate new peerId and identity (did)
    - [ ] Voyager evaluation
        - [x] install voyager as pinning service https://github.com/orbitdb/voyager/tree/main
        - [x] add db addresses to voyager
        - [x] allow persistent peerId
        - [ ] make voyager websocket wss e.g. 
            - [ ] autotls 
                - http://bafybeihxl3cwxwh3lwbjhryxv7anf7lfbk2ynqobu55r54po73ds2csrti.ipfs.localhost:8081/autotls/
                - https://www.npmjs.com/package/@libp2p/auto-tls
            - [ ] docker compose + nginx + certbot
                - https://github.com/silkroadnomad/libp2p-relay/blob/main/docker-compose.yml
                - https://github.com/silkroadnomad/libp2p-relay/blob/main/init-letsencrypt.sh
        - [ ] make voyager support pubsub peer discovery
        - [ ] support DID on voyager
        - [ ] test voyager replication
    - [ ] add first production blog 
    - [ ] when clicking on a peerId, open a modal to show information about the peer and request information such as (public blog names, impressum, etc.)
    - [ ] publish blog on request
    - [ ] enter optional imprint in settings (optional for public blogs) 
    - [ ] when adding a blog address think about optionally adding and dialing peerId too (at least when scanning?)
        - [ ] sometimes the db cannot be found nor opened then data like blogName, blogAddress can't be read, in such case it might be interesting to implmenent a retry mechanism, e.g. adding it to a queue and try every 20 seconds and remove it from the queue as soon it could connect       
    - [x] blog settings via private settings db
        - [x] blog name
        - [x] blog description
        - [x] postsdb address
        - [ ] commentsdb address  
        - [ ] username/did by blockchain (Bitcoin Ordinals, Runes, Namcoin, Doichain)
        - [x] did
        - [ ] did / id by Nostr-Chrome-Extension
        - [ ] did / id by metmask extension
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
    - [ ] create encrypted backup & restore of posts, settings, remoteDBs and store on Filecoin, Arweave etc.  (Dropbox, Google Drive, Apple Cloud, Yandex Cloud etc.)
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
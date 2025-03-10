<table border="0" cellspacing="0" cellpadding="0">
  <tr>
      <td>
      <h1>Orbit-Blog</h1>A local-first & peer-to-peer blog powered by OrbitDB which replicates between browsers and mobile apps. IPFS (only)</td>
    <td><img src="./public/orbitbloglogo-700.png" width="300" alt="Orbit Blog Logo"></td>
  </tr>
</table>

### Install as Progressive Web App (PWA)

Visit [orbit-blog @ ipns](ipns://k51qzi5uqu5djjnnjgtviql86f19isjyz6azhw48ovgn22m6otstezp2ngfs8g) [IPFS Companion needed](https://docs.ipfs.tech/install/ipfs-companion/)

[![QR Code to PWA](/public/ipns.dweb.link.png)](https://k51qzi5uqu5djjnnjgtviql86f19isjyz6azhw48ovgn22m6otstezp2ngfs8g.ipns.dweb.link/)

### Features
- UI related
    - [ ] internationalize the UI (en,de,fr,es,it,ru,...)
    - [x] editable / flexible categories
    - [x] deploy to IPFS
    - [x] markdown support for posts 
    - [?] markdown support for comments
    - [x] search in posts 
    - [ ] search in comments
- OrbitDB related
    - [ ] when clicking on a peerId, open a modal to show information about the peer and request information such as (public blog names, impressum, etc.)
    - [ ] publish blog on request
    - [ ] enter optional imprint in settings 
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
    - [ ] create encrypted backup & restore of posts, settings, remoteDBs and store on Filecoin, Arweave etc.
    - [ ] setup your own relay
    - [ ] enable pubsub ipfs pinning of posts and comments
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
    - [ ] demonstrate webrtc-direct connections without relay-server but SDP-QR-Codes or SDP - Voice
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
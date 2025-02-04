# Orbit-Blog

<img src="./public/orbitbloglogo-700.png" width="300" alt="Orbit Blog Logo">

A local-first & peer-to-peer blog powered by OrbitDB which replicates between browsers and mobile apps. Hosted on IPFS (only)

## Try it out

Visit [orbit-blog @ ipns  ](ipns://k51qzi5uqu5djjnnjgtviql86f19isjyz6azhw48ovgn22m6otstezp2ngfs8g) or scan the QR code below:

<img src="/public/ipns.dweb.link.png" width="200" alt="QR Code to PWA">

### Install as Progressive Web App (PWA)

#### Desktop
1. Open [orbit-blog.ipfs.page](https://orbit-blog.ipfs.page) in Chrome or Edge
2. Look for the install icon (⊕) in the address bar
3. Click "Install" to add the app to your desktop

Features
- App related
    - [x] deployable to IPFS
    - [x] run as PWA
        - [x] vite-plugin-pwa
        - [x] orbitlogo ai generated
    - [x] version management
    - [ ] e2e tests
    - [ ] ci / cd
- UI related
    - [ ] deploy to IPFS
    - [x] markdown support for posts 
    - [ ] markdown support for comments
    - [ ] search in posts 
    - [ ] search comments
- OrbitDB related
    - [ ] blog settings centrally via settings db
    - [ ] implement OneTimeAccessController 
        - keep temporary private key / peer-id on laptop 
        - keep secure private key / persistant peer-id on phone
        - implement One-Time-Access-Controller with own stream protocol and qr-code peering (phone accepts simple pubsub peering messages with simple pin code comparison)
    - [ ] connect & replicated remote blogs
    - [ ] create RaspberryPi pinning - relay
    - [ ] demonstrate webrtc-direct connections without relay-server but SDP-QR-Codes or SDP - Voice
    - [ ] upload & replicate images / integrate ipfs images cids into markdown



# Orbit-Blog

A local-first & peer-to-peer blog powered by OrbitDB which replicates between browsers and mobile apps. Hosted on IPFS (only)

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



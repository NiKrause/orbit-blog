#!/bin/bash

# Run the ipfs add command and capture the output
output=$(ipfs add -r dist)

# Extract the CID using awk or cut
cid=$(echo "$output" | tail -n 1 | awk '{print $2}')
echo "latest IPFS CID $cid"

# Run the ipfs name publish command with the extracted CID
ipfs name publish --key=orbitblog /ipfs/$cid
echo "IPFS name orbitblog updated with CID $cid"
# Update the vercel.json file with the new CID
# sed -i '' "s|/ipfs/[^\"}]*|/ipfs/$cid|g" vercel.json

# Execute the docker-compose command on the remote server
# ssh -t root@ipfs.le-space.de "cd docker/ipfs/willschenk && docker-compose exec ipfs ipfs add $cid"
# echo "IPFS CID $cid added to ipfs.le-space.de"
# Pin the CID to ipfs.le-space.de
ssh -t root@ipfs.le-space.de "cd docker/ipfs/willschenk && docker-compose exec ipfs ipfs pin add $cid"
echo "IPFS CID $cid pinned to ipfs.le-space.de"


# echo the result of name resolve should be the same as the cid
result=$(ssh -t root@ipfs.le-space.de "cd docker/ipfs/willschenk && docker-compose exec ipfs ipfs name resolve /ipns/k51qzi5uqu5djjnnjgtviql86f19isjyz6azhw48ovgn22m6otstezp2ngfs8g" | tr -d '\r' | tr -d '\n')

# Debug with hexdump to see exactly what characters we're getting
echo "Result raw:"
echo "$result" | hexdump -C
echo "CID raw:"
echo "$cid" | hexdump -C

if [ "$result" == "/ipfs/$cid" ]; then
    echo -e "\e[32mIPFS name resolve result matches CID $cid\e[0m"
else
    echo -e "\e[31mIPFS name resolve result does not match CID $cid\e[0m"
fi


# echo "IPFS PIN added to follow ipns"
# Get the current version from package.json
version=$(node -p "require('./package.json').version")

# Git commands
# git add vercel.json
git commit -m "Update IPFS CID to $cid for version $version"
git tag -a "v$version" -m "Version $version"
git push origin main
git push origin --tags

echo "Changes committed and pushed to GitHub. Tagged as v$version"
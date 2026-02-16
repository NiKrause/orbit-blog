#!/bin/bash
# -----------------------------------------------------------------------------
# How to add a new IPNS_NAME and key locally:
#
# 1. Generate a new IPNS key (replace <your-key-name> with your desired name):
#      ipfs key gen <your-key-name>
# 2. List your keys to find the PeerID (IPNS key) for your new key:
#      ipfs key list -l
# 3. Update the script variables below:
#      IPNS_KEY="<PeerID from step 2>"
#      IPNS_NAME="<your-key-name>"
# 4. (Optional) If you want to publish under a DNSLink, ensure your DNS provider
#    points the desired domain TXT record to your IPNS key.
# -----------------------------------------------------------------------------

# Configurable variables
IPNS_KEY="k51qzi5uqu5dixys1k2prgbng4z9uxgvc4kj8l1xww1v5irt5cn3j5q402a0yb"  # <-- Set your PeerID here
IPNS_NAME="blog.le-space.de"                                                     # <-- Set your key name here
IPFS_SERVER="ipfs.le-space.de"
BUILD_DIR="dist"  # Change to "build" if your build output is in build/

# Bump version automatically (patch level)
npm version patch

# Get the new version from package.json
version=$(node -p "require('./package.json').version")

# Build the project before publishing to IPFS
npm run build

# Run the ipfs add command and capture the output
output=$(ipfs add -r $BUILD_DIR/)

# Extract the CID using awk or cut
cid=$(echo "$output" | tail -n 1 | awk '{print $2}')
echo "latest IPFS CID $cid"

# Update README with the latest CID so humans (and agents) can find the current build.
export NEW_IPFS_CID="$cid"
node - <<'NODE'
const fs = require('fs');

const cid = process.env.NEW_IPFS_CID;
if (!cid) {
  console.error('Missing NEW_IPFS_CID');
  process.exit(1);
}

const readmePath = 'README.md';
let s = fs.readFileSync(readmePath, 'utf8');

const cidLine = `Latest IPFS CID: ${cid}`;
const gwLine = `Latest IPFS Gateway: https://${cid}.ipfs.dweb.link/`;

const hasCidLine = /^Latest IPFS CID: .*$/m.test(s);
const hasGwLine = /^Latest IPFS Gateway: .*$/m.test(s);

if (hasCidLine) {
  s = s.replace(/^Latest IPFS CID: .*$/m, cidLine);
}
if (hasGwLine) {
  s = s.replace(/^Latest IPFS Gateway: .*$/m, gwLine);
}

if (!hasCidLine && !hasGwLine) {
  // Insert directly after the IPNS gateway line if present, otherwise append.
  const marker = /^Gateway: .*$/m;
  if (marker.test(s)) {
    s = s.replace(marker, (m) => `${m}\n\n${cidLine}\n\n${gwLine}`);
  } else {
    s = `${s.trimEnd()}\n\n${cidLine}\n\n${gwLine}\n`;
  }
}

fs.writeFileSync(readmePath, s);
console.log(`Updated README.md with CID ${cid}`);
NODE

# Update GitHub repository "Website" (homepage) to point at the immutable build.
# Best-effort: if `gh` isn't installed or authenticated, we just warn.
# if command -v gh >/dev/null 2>&1; then
#   origin_url="$(git remote get-url origin 2>/dev/null || true)"
#   repo_path=""

#   # Support both SSH and HTTPS remotes.
#   # - git@github.com:OWNER/REPO.git
#   # - https://github.com/OWNER/REPO.git
#   if [[ "$origin_url" =~ github\.com[:/]{1}([^/]+/[^/.]+)(\.git)?$ ]]; then
#     repo_path="${BASH_REMATCH[1]}"
#   fi

#   if [[ -n "$repo_path" ]]; then
#     homepage="https://${cid}.ipfs.dweb.link/"
#     echo "Updating GitHub repo homepage for $repo_path to $homepage"
#     gh api -X PATCH "repos/${repo_path}" -f "homepage=${homepage}" >/dev/null 2>&1 || \
#       echo "WARN: failed to update GitHub repo homepage (is gh authenticated and does it have repo scope?)"
#   else
#     echo "WARN: could not infer GitHub repo from origin remote; skipping homepage update"
#   fi
# else
#   echo "WARN: gh not found; skipping GitHub repo homepage update"
# fi

# Run the ipfs name publish command with the extracted CID
ipfs name publish --key=$IPNS_NAME /ipfs/$cid
echo "IPFS name $IPNS_NAME updated with CID $cid"

# Update the vercel.json file with the new CID
# sed -i '' "s|/ipfs/[^\"}]*|/ipfs/$cid|g" vercel.json

# Pin the CID to the remote IPFS server
ssh -t root@$IPFS_SERVER "su ipfs -c 'ipfs pin add $cid'"
echo "IPFS CID $cid pinned to $IPFS_SERVER"

# echo the result of name resolve should be the same as the cid
result=$(ssh -t root@$IPFS_SERVER "su ipfs -c 'ipfs name resolve --nocache /ipns/$IPNS_KEY'" | tr -d '\r' | tr -d '\n')

# Debug with hexdump to see exactly what characters we're getting
echo "Result raw:"
echo "$result" | hexdump -C
echo "CID raw:"
echo "$cid" | hexdump -C

if [ "$result" == "/ipfs/$cid" ]; then
    echo "$(tput setaf 2)IPFS name resolve result matches CID $cid$(tput sgr0)"
else
    echo "$(tput setaf 1)IPFS name resolve result does not match CID $cid$(tput sgr0)"
fi

# Git commands
# git add vercel.json
git add README.md package.json package-lock.json
git commit -m "Update IPFS CID to $cid for version $version"
git tag -a "v$version" -m "Version $version"
git push origin main
git push origin --tags

echo "Changes committed and pushed to GitHub. Tagged as v$version"

read -p "Do you want to update the production Nginx config with the new CID? (yes/no): " answer
if [[ "$answer" == "yes" ]]; then
    ssh root@le-space.de "sed -i 's|proxy_pass https://$IPFS_SERVER/ipfs/[^/]*/;|proxy_pass https://$IPFS_SERVER/ipfs/$cid/;|' /etc/nginx/sites-available/$IPNS_NAME && systemctl reload nginx"
    echo "Nginx config updated with new CID $cid and reloaded for $IPNS_NAME."
else
    echo "Production Nginx config was NOT updated."
fi

#!/bin/sh
# Run Kubo (go-ipfs) repo GC when disk or repo size indicates cache bloat.
# Safe for nodes that do not rely on long-lived *unpinned* cached blocks.
#
# Typical install on the server:
#   sudo install -m 755 scripts/ipfs-gc-if-needed.sh /usr/local/sbin/ipfs-gc-if-needed.sh
# Crontab (root), e.g. every 6 hours:
#   0 */6 * * * /usr/local/sbin/ipfs-gc-if-needed.sh
#
# Environment (optional):
#   IPFS_PATH    Repo path (default: /var/lib/ipfs/.ipfs)
#   IPFS_USER    Unix user running ipfs (default: ipfs)
#   MIN_FREE_MB  Trigger GC if free space on repo filesystem is below this (default: 5120)
#   MAX_USE_PCT  Trigger GC if filesystem use% is at or above this (default: 85)
#   REPO_PCT     Trigger GC if RepoSize > StorageMax * REPO_PCT/100 (default: 95)

set -eu

IPFS_PATH=${IPFS_PATH:-/var/lib/ipfs/.ipfs}
IPFS_USER=${IPFS_USER:-ipfs}
MIN_FREE_MB=${MIN_FREE_MB:-5120}
MAX_USE_PCT=${MAX_USE_PCT:-85}
REPO_PCT=${REPO_PCT:-95}
LOCK_FILE=${LOCK_FILE:-/run/ipfs-gc-if-needed.lock}

log() {
	# shellcheck disable=SC2039
	if command -v logger >/dev/null 2>&1; then
		logger -t ipfs-gc-if-needed "$*"
	else
		printf '%s %s\n' "$(date -Iseconds 2>/dev/null || date)" "$*"
	fi
}

ipfs_as_user() {
	if [ "$(id -u)" -eq 0 ]; then
		sudo -u "$IPFS_USER" env IPFS_PATH="$IPFS_PATH" "$@"
	else
		env IPFS_PATH="$IPFS_PATH" "$@"
	fi
}

if ! command -v flock >/dev/null 2>&1; then
	log "ERROR: flock not found; install util-linux"
	exit 1
fi

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
	log "Another run in progress; exiting"
	exit 0
fi

if [ ! -d "$IPFS_PATH" ]; then
	log "ERROR: IPFS_PATH is not a directory: $IPFS_PATH"
	exit 1
fi

AVAIL_KB=$(df -P "$IPFS_PATH" | tail -1 | awk '{print $4}')
USE_PCT=$(df -P "$IPFS_PATH" | tail -1 | awk '{gsub(/%/,"",$5); print $5}')
AVAIL_MB=$((AVAIL_KB / 1024))
MP=$(df -P "$IPFS_PATH" | tail -1 | awk '{print $6}')

need_gc=0
if [ "$AVAIL_MB" -lt "$MIN_FREE_MB" ]; then
	log "Low disk: ${AVAIL_MB}MiB free on $MP (threshold ${MIN_FREE_MB}MiB)"
	need_gc=1
fi
if [ -n "$USE_PCT" ] && [ "$USE_PCT" -ge "$MAX_USE_PCT" ] 2>/dev/null; then
	log "High disk use: ${USE_PCT}% on $MP (threshold ${MAX_USE_PCT}%)"
	need_gc=1
fi

stat_out=$(ipfs_as_user ipfs repo stat 2>/dev/null) || {
	log "ERROR: ipfs repo stat failed (daemon down or bad IPFS_PATH?)"
	exit 1
}
REPO=$(printf '%s\n' "$stat_out" | awk '/^RepoSize:/ {print $2}')
MAX=$(printf '%s\n' "$stat_out" | awk '/^StorageMax:/ {print $2}')

if [ -n "$REPO" ] && [ -n "$MAX" ] && [ "$MAX" -gt 0 ] 2>/dev/null; then
	# awk handles large integers as strings in some awks; use bc if available for portability on huge values
	if command -v awk >/dev/null 2>&1; then
		over=$(awk -v r="$REPO" -v m="$MAX" -v p="$REPO_PCT" 'BEGIN { lim=int(m*p/100); print (r>lim) ? 1 : 0 }')
		if [ "$over" -eq 1 ]; then
			log "Repo over ${REPO_PCT}% of StorageMax: RepoSize=$REPO StorageMax=$MAX"
			need_gc=1
		fi
	fi
fi

if [ "$need_gc" -eq 0 ]; then
	log "OK: ${AVAIL_MB}MiB free on $MP, ${USE_PCT}% used; repo within limit"
	exit 0
fi

log "Running: ipfs repo gc -q"
ipfs_as_user ipfs repo gc -q
after=$(printf '%s\n' "$(ipfs_as_user ipfs repo stat)" | awk '/^RepoSize:/ {print $2}')
log "GC finished. RepoSize=$after bytes"

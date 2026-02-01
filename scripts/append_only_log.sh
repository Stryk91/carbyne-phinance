#!/bin/bash
# Append-only logging with hash chain
# Each entry contains hash of previous entry - tampering breaks the chain

# Default to Linux-native path (supports chattr +a append-only)
LOG_FILE="${1:-/home/STRYK/ai_trader_backup/immutable/chain.jsonl}"
mkdir -p "$(dirname "$LOG_FILE")"

# Get hash of last line (previous entry)
if [ -f "$LOG_FILE" ] && [ -s "$LOG_FILE" ]; then
    PREV_HASH=$(tail -1 "$LOG_FILE" | sha256sum | cut -c1-16)
else
    PREV_HASH="GENESIS_0000000"
fi

# Read entry from stdin
ENTRY=$(cat)

# Create chained entry
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
CHAINED=$(jq -c --arg ts "$TIMESTAMP" --arg prev "$PREV_HASH" \
    '. + {_chain_ts: $ts, _prev_hash: $prev}' <<< "$ENTRY")

# Calculate this entry's hash
THIS_HASH=$(echo "$CHAINED" | sha256sum | cut -c1-16)

# Append with hash
echo "$CHAINED" >> "$LOG_FILE"

# Make file append-only (requires root, optional)
# chattr +a "$LOG_FILE" 2>/dev/null

echo "Logged: $THIS_HASH (prev: $PREV_HASH)"

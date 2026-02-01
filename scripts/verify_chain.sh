#!/bin/bash
# Verify hash chain integrity - detects ANY tampering or deletion

LOG_FILE="${1:-/home/STRYK/ai_trader_backup/immutable/chain.jsonl}"

if [ ! -f "$LOG_FILE" ]; then
    echo "ERROR: Log file not found: $LOG_FILE"
    exit 1
fi

echo "=== Verifying Hash Chain: $LOG_FILE ==="

EXPECTED_PREV="GENESIS_0000000"
LINE_NUM=0
ERRORS=0

while IFS= read -r line; do
    ((LINE_NUM++))

    # Extract stored prev_hash
    STORED_PREV=$(echo "$line" | jq -r '._prev_hash // "MISSING"')

    if [ "$STORED_PREV" != "$EXPECTED_PREV" ]; then
        echo "CHAIN BROKEN at line $LINE_NUM"
        echo "  Expected prev: $EXPECTED_PREV"
        echo "  Found prev:    $STORED_PREV"
        ((ERRORS++))
    fi

    # Calculate hash of this line for next iteration
    EXPECTED_PREV=$(echo "$line" | sha256sum | cut -c1-16)

done < "$LOG_FILE"

echo ""
echo "Lines verified: $LINE_NUM"
if [ $ERRORS -eq 0 ]; then
    echo "STATUS: CHAIN INTACT ✓"
    exit 0
else
    echo "STATUS: CHAIN BROKEN ✗ ($ERRORS errors)"
    exit 1
fi

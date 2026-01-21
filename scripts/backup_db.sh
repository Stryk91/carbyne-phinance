#!/bin/bash
# AI Trader Database Backup Script
# Run periodically or before/after trading sessions
# Handles WSL2/Windows filesystem issues with fallback to Linux path

set +e

# Config
DB_PATH="/mnt/x/dev/financial-pipeline-rs/data/finance.db"
BACKUP_DIR_WIN="/mnt/x/dev/financial-pipeline-rs/logs/backups"
BACKUP_DIR_LINUX="/home/STRYK/ai_trader_backup"
TRADES_JSONL="/mnt/x/dev/financial-pipeline-rs/logs/trades/trades_all.jsonl"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
KEEP_DAYS=30

echo "=== AI Trader Backup: $TIMESTAMP ==="

# Create dirs if needed
mkdir -p "$BACKUP_DIR_WIN" "$BACKUP_DIR_LINUX" "$(dirname $TRADES_JSONL)"

# Sync and checkpoint WAL
sync 2>/dev/null
sqlite3 "$DB_PATH" "PRAGMA wal_checkpoint(TRUNCATE);" 2>/dev/null

# Get short hash for filename integrity verification
HASH_SHORT=$(sha256sum "$DB_PATH" 2>/dev/null | cut -c1-8)
if [ -z "$HASH_SHORT" ]; then HASH_SHORT="nohash"; fi

# Primary backup with hash in filename
if [ -f "$DB_PATH" ]; then
    cp "$DB_PATH" "$BACKUP_DIR_WIN/finance_${TIMESTAMP}_${HASH_SHORT}.db" 2>/dev/null && \
        echo "[OK] Windows backup: finance_${TIMESTAMP}_${HASH_SHORT}.db" || \
        echo "[WARN] Windows backup failed"
fi

# Secondary backup to Linux (failsafe)
if [ -f "$DB_PATH" ]; then
    cp "$DB_PATH" "$BACKUP_DIR_LINUX/finance_${TIMESTAMP}_${HASH_SHORT}.db" 2>/dev/null && \
        echo "[OK] Linux backup: finance_${TIMESTAMP}_${HASH_SHORT}.db"
fi

# Log full checksum to checksums.txt
echo "$TIMESTAMP $(sha256sum "$DB_PATH" 2>/dev/null)" >> "$BACKUP_DIR_WIN/checksums.txt"

# Use Linux backup for queries (more reliable)
QUERY_DB="$BACKUP_DIR_LINUX/finance_${TIMESTAMP}_${HASH_SHORT}.db"
[ ! -f "$QUERY_DB" ] && QUERY_DB="$DB_PATH"

# Export positions snapshot
if sqlite3 -json "$QUERY_DB" "
SELECT symbol, quantity, entry_price,
       ROUND(quantity * entry_price, 2) as value,
       entry_date
FROM paper_positions WHERE quantity > 0
ORDER BY value DESC;" > "$BACKUP_DIR_WIN/positions_$TIMESTAMP.json" 2>/dev/null; then
    echo "[OK] Positions snapshot saved"
    cp "$BACKUP_DIR_WIN/positions_$TIMESTAMP.json" "$BACKUP_DIR_LINUX/" 2>/dev/null
fi

# Export cash balance
CASH=$(sqlite3 "$QUERY_DB" "SELECT cash FROM paper_wallet WHERE id = 1;" 2>/dev/null)
if [ -n "$CASH" ]; then
    echo "{\"timestamp\": \"$TIMESTAMP\", \"cash\": $CASH}" > "$BACKUP_DIR_WIN/cash_$TIMESTAMP.json"
    cp "$BACKUP_DIR_WIN/cash_$TIMESTAMP.json" "$BACKUP_DIR_LINUX/" 2>/dev/null
    echo "[OK] Cash balance: \$$CASH"
fi

# Append trades to single JSONL file (append-only master log)
sqlite3 -json "$QUERY_DB" "
SELECT id, symbol, action, quantity, price, realized_pnl, timestamp, notes
FROM paper_trades ORDER BY timestamp DESC LIMIT 100;" 2>/dev/null | \
    jq -c '.[]' 2>/dev/null >> "$TRADES_JSONL" && \
    echo "[OK] Trades appended to trades_all.jsonl"

# Cleanup old backups
find "$BACKUP_DIR_WIN" -name "finance_*.db" -mtime +$KEEP_DAYS -delete 2>/dev/null
find "$BACKUP_DIR_LINUX" -name "finance_*.db" -mtime +$KEEP_DAYS -delete 2>/dev/null
echo "[OK] Cleaned backups older than $KEEP_DAYS days"

echo ""
echo "=== Backup Complete ==="
echo "Hash: $HASH_SHORT | Windows: $BACKUP_DIR_WIN | Linux: $BACKUP_DIR_LINUX"

# Quick snapshot function - call before any destructive action
quick_snapshot() {
    local SNAP_DIR="/home/STRYK/ai_trader_backup/snapshots"
    mkdir -p "$SNAP_DIR"
    local SNAP_FILE="$SNAP_DIR/snap_$(date +%H%M%S).db"
    cp "$DB_PATH" "$SNAP_FILE" 2>/dev/null && echo "$SNAP_FILE"
}

# Restore from most recent snapshot
restore_latest() {
    local SNAP_DIR="/home/STRYK/ai_trader_backup/snapshots"
    local LATEST=$(ls -t "$SNAP_DIR"/snap_*.db 2>/dev/null | head -1)
    if [ -n "$LATEST" ]; then
        cp "$LATEST" "$DB_PATH" && echo "Restored from $LATEST"
    else
        echo "No snapshots found"
    fi
}

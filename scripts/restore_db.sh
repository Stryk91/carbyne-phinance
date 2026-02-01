#!/bin/bash
# Quick restore from backup

BACKUP_DIR="/home/STRYK/ai_trader_backup"
DB_PATH="/mnt/x/dev/carbyne-phinance/fp-tauri-dev/data/finance.db"

echo "=== Available Backups ==="
ls -lht "$BACKUP_DIR"/finance_*.db 2>/dev/null | head -10

echo ""
read -p "Enter backup filename (or 'latest'): " CHOICE

if [ "$CHOICE" = "latest" ]; then
    BACKUP=$(ls -t "$BACKUP_DIR"/finance_*.db 2>/dev/null | head -1)
else
    BACKUP="$BACKUP_DIR/$CHOICE"
fi

if [ -f "$BACKUP" ]; then
    cp "$BACKUP" "$DB_PATH" && echo "✓ Restored from: $BACKUP"
else
    echo "✗ Backup not found: $BACKUP"
fi

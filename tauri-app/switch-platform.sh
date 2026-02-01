#!/bin/bash
# Switch node_modules between Linux and Windows platforms
# Usage: ./switch-platform.sh [linux|win]

PLATFORM=${1:-linux}
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ "$PLATFORM" = "linux" ]; then
    rm -f "$SCRIPT_DIR/node_modules" 2>/dev/null
    ln -sf node_modules_linux "$SCRIPT_DIR/node_modules"
    echo "Switched to Linux node_modules"
elif [ "$PLATFORM" = "win" ]; then
    rm -f "$SCRIPT_DIR/node_modules" 2>/dev/null
    ln -sf node_modules_win "$SCRIPT_DIR/node_modules"
    echo "Switched to Windows node_modules"
else
    echo "Usage: $0 [linux|win]"
    exit 1
fi

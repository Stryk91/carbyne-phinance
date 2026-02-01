# CDP MCP Server for Tauri/WebView2

Debug your Tauri app via Chrome DevTools Protocol.

## Setup

1. Launch your Tauri app with CDP enabled:
```powershell
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--remote-debugging-port=9222"
Start-Process "path\to\your-app.exe"
```

Or use the provided launcher:
```powershell
.\launch-debug.ps1
```

2. Add to your Claude Code settings (`~/.claude.json` or project `.claude/settings.json`):
```json
{
  "mcpServers": {
    "cdp-debugger": {
      "command": "C:\\Users\\Stryker\\AppData\\Local\\nvm\\v22.21.0\\node.exe",
      "args": ["X:/dev/carbyne-phinance/fp-tauri-dev/mcp-cdp/index.js"],
      "env": {
        "CDP_PORT": "9222",
        "CDP_HOST": "localhost"
      }
    }
  }
}
```

## Tools

- `cdp_connect` - Connect to the running app
- `cdp_status` - Check connection status
- `cdp_console` - Get console messages (logs, errors)
- `cdp_network` - Get network requests
- `cdp_eval` - Execute JavaScript in page context
- `cdp_dom` - Query DOM elements
- `cdp_screenshot` - Take screenshot
- `cdp_clear` - Clear message buffers

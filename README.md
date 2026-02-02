carbyne-phinance
================

Financial pipeline and trading workstation. Rust backend, SolidJS
frontend, Tauri shell. SQLite storage. Ollama for local AI analysis.

Not a product. Not a service. A tool.

Building
--------

You need:

- Rust 1.77+ (https://rustup.rs)
- Node.js 18+ and npm
- SQLite3 dev headers
- Ollama (optional, for AI features)

### Linux (including WSL2)

System deps first:

    sudo apt install libwebkit2gtk-4.1-dev libappindicator3-dev \
        librsvg2-dev patchelf libssl-dev libsoup-3.0-dev \
        libjavascriptcoregtk-4.1-dev build-essential pkg-config

Then:

    cd tauri-app
    npm install
    npm run tauri dev

For a release build:

    npm run tauri build

Binary lands in `tauri-app/src-tauri/target/release/`.

### Windows

Install the Rust toolchain and Node.js. WebView2 ships with Windows 10+.

    cd tauri-app
    npm install
    npm run tauri dev

Same `npm run tauri build` for release. Output in
`src-tauri\target\release\`.

### Rust library only (no GUI)

    cargo build --release

This builds the `financial_pipeline` library and CLI binary from
the root crate. No Node.js or WebKit needed.

Configuration
-------------

    cp config/config.example.json config/config.json

Put your API keys in there. Yahoo Finance works without keys.
Finnhub and FRED need free API keys from their respective sites.

The database gets created at `data/finance.db` on first run.

Project layout
--------------

    src/                    Rust library - pipeline, AI trader, signals
      lib.rs                Core exports
      db.rs                 SQLite layer
      yahoo.rs              Yahoo Finance fetcher
      ollama.rs             Ollama AI integration
      ai_trader.rs          Trading logic
      signals.rs            Signal generation engine
      indicators.rs         Technical indicators (SMA, EMA, RSI, MACD)
      backtest.rs           Backtesting framework

    tauri-app/              GUI application
      src/                  SolidJS + TypeScript frontend
        views/              Dashboard, Charts, Portfolio, etc.
        stores/             State management
        api.ts              Backend API client
      src-tauri/src/        Tauri backend
        lib.rs              App setup, Tauri commands
        http_api.rs         REST API (axum)
        scheduler.rs        Background job scheduler

    config/                 Configuration files
    scripts/                Python utilities (legacy, still functional)
    debate-logs/            AI debate session transcripts

npm note
--------

`npm install` inside `tauri-app/` pulls in:

- `solid-js` - UI framework
- `lightweight-charts` - TradingView charting
- `@tauri-apps/cli` + `@tauri-apps/api` - Tauri tooling
- `vite` + `vite-plugin-solid` - build tooling
- `typescript`

That's it. No webpack. No babel. No react.

Python scripts
--------------

Some utility scripts still use Python. If you need them:

    pip install -r requirements.txt

These are optional. The Rust binary handles everything the Python
scripts used to do.

License
-------

MIT

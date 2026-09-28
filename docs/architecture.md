# Architecture Overview

## High-Level Architecture

ClipDrop is a Tauri v2 desktop application with a Rust backend and vanilla TypeScript frontend. Content flows through an intake pipeline that ingests, stores, analyzes (via LLM), and organizes items.

```
User Input (Clipboard / Files / Text)
         |
         v
  Frontend (intake.ts)
  - Drag-drop events
  - Paste events (Ctrl+V)
         |
         v  invoke()
  Tauri IPC Bridge
         |
         v
  Rust Backend
  1. intake.rs   -- Ingest file/text/image
  2. storage.rs  -- Save to inbox directory
  3. processor.rs -- Async processing (tokio::spawn)
  4. llm.rs      -- Call LLM for analysis
  5. db.rs       -- Store results in SQLite
         |
         v
  Frontend queries results
  - Dashboard: stats & recent items
  - Browse: search, filter, detail view
```

## Component Diagram

```
+-----------------------------------------------------+
|              Frontend (Vanilla TypeScript)            |
|  main.ts    -- Router, navigation, toast             |
|  pages/                                              |
|    intake.ts    -- Drop zone, paste handler          |
|    dashboard.ts -- Stats grid, recent/failed items   |
|    browse.ts    -- Search, category filter, detail   |
|    settings.ts  -- Provider and storage settings     |
|  styles.css     -- Design system (CSS variables)     |
+-----------------------------------------------------+
                    | invoke()
+-----------------------------------------------------+
|              Tauri IPC (JSON serialization)           |
+-----------------------------------------------------+
                    |
+-----------------------------------------------------+
|              Rust Backend                             |
|  lib.rs       -- App setup, state init, plugin reg   |
|  config.rs    -- AppConfig load/save                 |
|  intake.rs    -- 3 ingest commands + AppState        |
|  processor.rs -- Async item processing               |
|  llm.rs       -- Multi-provider LLM calls            |
|  db.rs        -- SQLite operations + schema          |
|  storage.rs   -- File I/O (copy, save, move)         |
|  queries.rs   -- Read/write Tauri commands           |
+-----------------------------------------------------+
          |                        |
+-----------------+    +-----------------------+
| SQLite (FTS5)   |    | LLM Provider          |
| clipdrop.db     |    | Ollama / OpenAI /     |
|                 |    | Anthropic / compatible|
+-----------------+    +-----------------------+
```

## Project Structure

```
clipdrop/
├── index.html              # HTML shell (titlebar + nav + app container)
├── package.json            # npm dependencies & scripts
├── tsconfig.json           # TypeScript config (ES2020, strict)
├── vite.config.ts          # Vite dev server (port 1420)
├── clipdrop.ahk            # AutoHotkey v2 hotkey script (Ctrl+Shift+V)
│
├── src/
│   ├── main.ts             # Entry point, SPA router, navigation
│   ├── styles.css          # Full design system
│   └── pages/
│       ├── intake.ts       # Drop zone + paste handler
│       ├── dashboard.ts    # Stats + recent items
│       ├── browse.ts       # Search + detail + full-content reader
│       └── settings.ts     # Provider, model, storage, category settings
│
└── src-tauri/
    ├── Cargo.toml          # Rust dependencies
    ├── tauri.conf.json     # Tauri window/build config
    ├── build.rs            # Tauri build script
    ├── capabilities/
    │   └── default.json    # Tauri permission grants
    └── src/
        ├── main.rs         # Windows entry point
        ├── lib.rs          # App builder, state init, command registration
        ├── config.rs       # AppConfig struct, load/save, LLM provider enum
        ├── db.rs           # Database struct, schema, CRUD operations
        ├── intake.rs       # AppState + ingest_file/text/clipboard_image
        ├── processor.rs    # Async process_item (LLM + file move)
        ├── llm.rs          # analyze() + provider implementations
        ├── storage.rs      # File copy/save/move utilities
        └── queries.rs      # Query & mutation Tauri commands
```

## Shared State

The backend uses a single `AppState` struct managed by Tauri:

```rust
pub struct AppState {
    pub db: Arc<Database>,                    // Thread-safe DB handle
    pub config: Arc<std::sync::Mutex<AppConfig>>, // Mutable config
}
```

All Tauri commands receive `State<'_, AppState>` as a parameter.

## Async Model

- Tauri commands are `async fn` and run on Tokio.
- Intake commands spawn background processing tasks via `tokio::spawn()`.
- Processing runs independently with a three-minute model timeout.
- Failures are persisted; interrupted processing records become retryable failures at startup.
- The Classify dashboard polls every 2.5 seconds while work is pending.

## Window Configuration

From `tauri.conf.json`:
- Expanded size: 1040×680
- Compact widget size: 360×116
- No window decorations (custom titlebar in HTML)
- Always on top
- Starts hidden (toggled via hotkey)
- Dev server URL: `http://localhost:1420`

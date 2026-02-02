# Configuration Reference

## Config File

Location: `{app_data_dir}/config.json`

- **Windows:** `%LOCALAPPDATA%/com.clipdrop.app/config.json`
- **Linux:** `~/.local/share/com.clipdrop.app/config.json`

Created automatically on first launch with defaults.

## Full Schema

```json
{
  "storage_path": "/path/to/storage",
  "llm_provider": {
    "type": "ollama",
    "url": "http://localhost:11434",
    "model": "glm-4.7:cloud"
  },
  "categories": [
    "Documents",
    "Images",
    "Code",
    "Notes",
    "Links",
    "Other"
  ]
}
```

## Fields

### `storage_path`

Root directory for file storage. Contains `inbox/` and category subdirectories.

**Default:** App data directory.

### `llm_provider`

Which LLM service to use for content analysis. One of three variants:

**Ollama (local, default):**
```json
{
  "type": "ollama",
  "url": "http://localhost:11434",
  "model": "glm-4.7:cloud"
}
```

**OpenAI:**
```json
{
  "type": "openai",
  "api_key": "sk-...",
  "model": "gpt-4"
}
```

**Anthropic:**
```json
{
  "type": "anthropic",
  "api_key": "sk-ant-...",
  "model": "claude-3-haiku-20240307"
}
```

### `categories`

List of category names. Used by the LLM prompt and for creating storage directories.

**Default:** `["Documents", "Images", "Code", "Notes", "Links", "Other"]`

You can add or rename categories. The LLM system prompt will include your custom list.

## Tauri Configuration

`src-tauri/tauri.conf.json` controls the app build and window:

| Key | Value | Description |
|-----|-------|-------------|
| `productName` | `"ClipDrop"` | App name |
| `identifier` | `"com.clipdrop.app"` | Unique app ID |
| `version` | `"0.1.0"` | App version |
| `windows[0].width` | `400` | Window width |
| `windows[0].height` | `300` | Window height |
| `windows[0].decorations` | `false` | No native title bar |
| `windows[0].alwaysOnTop` | `true` | Stays above other windows |
| `windows[0].visible` | `false` | Starts hidden |
| `devUrl` | `http://localhost:1420` | Vite dev server |
| `frontendDist` | `../dist` | Production build output |

## Build Scripts

| npm script | Command | Purpose |
|-----------|---------|---------|
| `dev` | `vite` | Start Vite dev server |
| `build` | `tsc && vite build` | Type-check + production bundle |
| `preview` | `vite preview` | Preview production build |
| `tauri` | `tauri` | Tauri CLI passthrough |

## Rust Dependencies

Key crates from `Cargo.toml`:

| Crate | Purpose |
|-------|---------|
| `tauri` (v2) | Desktop framework |
| `tauri-plugin-opener` | Open files/URLs externally |
| `rusqlite` (bundled) | Embedded SQLite |
| `uuid` | Item ID generation |
| `chrono` | Timestamps |
| `tokio` | Async runtime |
| `reqwest` | HTTP client for LLM APIs |
| `mime_guess` | MIME type detection |
| `serde` / `serde_json` | Serialization |

## Hotkey (AutoHotkey v2)

`clipdrop.ahk` binds **Ctrl+Shift+V** to toggle the window. Requires [AutoHotkey v2](https://www.autohotkey.com/). Run it manually or add to Windows startup.

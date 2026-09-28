# Configuration Reference

## Settings screen

Open **Settings** in the desktop navigation to select a provider, edit its connection details, load installed Ollama models, test the connection, and save the configuration. Changes are used by newly queued processing jobs without requiring a restart.

Provider API keys are stored in ClipDrop's local configuration file. Treat that file as sensitive and do not commit or share it.

## Config file

The file is created automatically at `{app_data_dir}/config.json` on first launch.

- **Windows:** `%APPDATA%/com.mattsutton.clipdrop/config.json`
- **Linux:** the Tauri application data directory for `com.mattsutton.clipdrop`

The SQLite database lives beside it. On Windows, the default managed-storage directory is `%LOCALAPPDATA%/ClipDrop`.

## Schema

```json
{
  "storage_path": "C:/path/to/storage",
  "llm_provider": {
    "type": "ollama",
    "url": "http://localhost:11434",
    "model": "glm-4.7:cloud"
  },
  "categories": ["Documents", "Images", "Code", "Notes", "Links", "Other"]
}
```

### `storage_path`

Root directory for managed files. It contains `inbox/` and category subdirectories. The app data directory is used by default.

### `llm_provider`

ClipDrop supports four provider shapes:

```json
{ "type": "ollama", "url": "http://localhost:11434", "model": "glm-4.7:cloud" }
{ "type": "openai", "model": "gpt-4o-mini", "api_key": "sk-..." }
{ "type": "anthropic", "model": "claude-3-5-haiku-latest", "api_key": "..." }
{ "type": "custom", "url": "https://api.example.com/v1", "model": "model-name", "api_key": "..." }
```

The custom provider must expose OpenAI-compatible `GET /models` and `POST /chat/completions` endpoints. If the saved OpenAI or Anthropic key is empty, processing falls back to `CLIPDROP_OPENAI_API_KEY` or `CLIPDROP_ANTHROPIC_API_KEY` respectively.

### `categories`

Category names used in the analysis prompt and managed-storage directories. The default is `Documents`, `Images`, `Code`, `Notes`, `Links`, and `Other`.

## Desktop window

`src-tauri/tauri.conf.json` defines the standalone application shell:

| Setting | Value |
|---|---:|
| Expanded size | 1040 × 680 |
| Expanded minimum | 760 × 520 |
| Compact widget size | 360 × 116 |
| Native decorations | Disabled |
| Always on top | Enabled |
| Initially visible | No; the Rust setup shows it when ready |

The compact/expanded dimensions are switched at runtime. `devUrl` points to Vite only during development; packaged builds load the compiled `frontendDist` assets and do not require localhost.

## Build scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Browser-only Vite development preview |
| `npm run build` | Type-check and build the web assets |
| `npm run tauri dev` | Run the native desktop app in development |
| `npm run tauri build` | Produce installable desktop bundles |

## Hotkey

`clipdrop.ahk` binds **Ctrl+Shift+V** to toggle the window when AutoHotkey v2 is installed. Clipboard paste inside the focused app uses the normal **Ctrl+V** shortcut.

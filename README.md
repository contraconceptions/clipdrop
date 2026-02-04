# ClipDrop

Smart clipboard & file intake manager with LLM-powered categorization. Built with Tauri v2 + TypeScript.

Drop files, paste text, or capture clipboard images -- ClipDrop automatically analyzes, categorizes, and organizes your content using AI.

## Features

- **Drag & drop** files, text, and images into a minimal overlay window
- **Clipboard capture** via Ctrl+V (text and images)
- **LLM-powered analysis** -- automatic summarization, categorization, and tagging
- **Multi-provider AI** -- supports Ollama (local), OpenAI, and Anthropic
- **Full-text search** via SQLite FTS5
- **Category-based organization** with automatic file sorting
- **Global hotkey** (Ctrl+Shift+V) to toggle the window via AutoHotkey

## Quick Start

### Prerequisites

- [Rust](https://rustup.rs/) (latest stable)
- [Node.js](https://nodejs.org/) (v18+)
- [Tauri CLI](https://v2.tauri.app/start/prerequisites/)
- An LLM provider: [Ollama](https://ollama.ai/) (default, local), or an OpenAI/Anthropic API key

### Install & Run

```bash
npm install
npm run tauri dev
```

### Build for Production

```bash
npm run tauri build
```

The installer will be in `src-tauri/target/release/bundle/`.

### Hotkey Setup (Windows)

Run `clipdrop.ahk` with [AutoHotkey v2](https://www.autohotkey.com/) to enable Ctrl+Shift+V window toggle.

## Configuration

On first launch, a `config.json` is created in the app data directory:

- **Windows:** `%LOCALAPPDATA%/com.clipdrop.app/config.json`
- **Linux:** `~/.local/share/com.clipdrop.app/config.json`

```json
{
  "storage_path": "...",
  "llm_provider": {
    "type": "ollama",
    "url": "http://localhost:11434",
    "model": "glm-4.7:cloud"
  },
  "categories": ["Documents", "Images", "Code", "Notes", "Links", "Other"]
}
```

To use OpenAI or Anthropic instead, change `llm_provider`:

```json
{
  "type": "openai",
  "api_key": "sk-...",
  "model": "gpt-4"
}
```

## Documentation

See the [`docs/`](docs/) directory for full developer documentation:

- [Architecture Overview](docs/architecture.md)
- [Backend API Reference](docs/backend-api.md)
- [Frontend Guide](docs/frontend.md)
- [Database Schema](docs/database.md)
- [LLM Integration](docs/llm-integration.md)
- [Storage & File Management](docs/storage.md)
- [Configuration Reference](docs/configuration.md)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop framework | Tauri v2 |
| Frontend | Vanilla TypeScript, Vite |
| Backend | Rust (async, Tokio) |
| Database | SQLite + FTS5 |
| AI | Ollama / OpenAI / Anthropic |
| Styling | Custom CSS (no framework) |

## License

See repository for license details.

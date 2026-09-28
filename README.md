# ClipDrop

**Created by Matt Sutton**

Smart clipboard & file intake manager with LLM-powered categorization. Built with Tauri v2 + TypeScript.

Drop files, paste text, or capture clipboard images -- ClipDrop automatically analyzes, categorizes, and organizes your content using AI.

> **Project status:** Early-stage portfolio project. Native intake, classification, storage, search, full-content browsing, provider settings, and compact/expanded desktop modes are implemented. Secure OS credential-vault storage and broader automated test coverage remain planned.

## Why I Built It

ClipDrop explores a common personal-workflow problem: useful snippets and files are easy to capture but hard to organize later. The project combines a lightweight native shell, local persistence, full-text search, and swappable AI providers while keeping the frontend deliberately framework-free.

## Features

- **Two desktop modes** -- a full workspace and a 360×116 always-on-top capture widget
- **Native capture** -- drag files, click to open the system file picker, or paste text and images
- **Clipboard capture** via Ctrl+V (text and images)
- **LLM-powered analysis** -- automatic summarization, categorization, and tagging
- **Multi-provider AI** -- supports Ollama (local), OpenAI, Anthropic, and custom OpenAI-compatible endpoints
- **Provider settings** -- discover Ollama models, test connections, and configure OpenAI-compatible APIs
- **Full-text search** via SQLite FTS5
- **Full-content reader** -- inspect and copy the complete extracted text for indexed text content
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

`npm run tauri dev` launches the complete standalone desktop application. `npm run dev` is an optional browser-only UI preview; native filesystem ingestion is intentionally unavailable there.

### Build for Production

```bash
npm run tauri build
```

The installer will be in `src-tauri/target/release/bundle/`.

### Quality Checks

```bash
npm run check
cargo test --manifest-path src-tauri/Cargo.toml
```

These checks also run in GitHub Actions on pushes and pull requests.

### Hotkey Setup (Windows)

Run `clipdrop.ahk` with [AutoHotkey v2](https://www.autohotkey.com/) to enable Ctrl+Shift+V window toggle.

## Configuration

On first launch, a `config.json` is created in the app data directory:

- **Windows:** `%APPDATA%/com.mattsutton.clipdrop/config.json`
- **Linux:** the Tauri application data directory for `com.mattsutton.clipdrop`

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

Provider settings are available in **04 Settings** (`Ctrl/Cmd+4`). Select an installed Ollama model, configure OpenAI or Anthropic, or provide an OpenAI-compatible endpoint.

To configure OpenAI manually:

```json
{
  "type": "openai",
  "model": "gpt-4o-mini",
  "api_key": "..."
}
```

Keys entered in Settings are stored in ClipDrop's local configuration file. `CLIPDROP_OPENAI_API_KEY` and `CLIPDROP_ANTHROPIC_API_KEY` remain supported as fallbacks when a saved key is empty.

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
| AI | Ollama / OpenAI / Anthropic / OpenAI-compatible APIs |
| Styling | Custom CSS (no framework) |

## Architecture

The TypeScript frontend invokes a small set of Tauri commands. Rust owns file intake, SQLite access, AI-provider calls, and background classification. New content is first copied into an inbox, recorded in SQLite, analyzed asynchronously, and then moved into a validated category folder. See [the architecture guide](docs/architecture.md) for the detailed flow.

For a concise project narrative suitable for a personal site, see the [portfolio case study](PORTFOLIO.md).

The production tokens and component inventory are mirrored in the editable [ClipDrop Figma design system](https://www.figma.com/design/YhjGeZGiOU8S0xM1q3hV9x). Node-to-source mappings are tracked in [`design-system/figma.json`](design-system/figma.json); publishing them through Figma Code Connect requires an Organization or Enterprise workspace.

## Known Limitations

- Provider keys are stored in the local application configuration rather than the operating system credential vault.
- Google Fonts currently require a network connection. Bundling fonts locally is recommended before release.
- Image classification currently uses file metadata rather than vision-model input.
- PDF and DOCX body extraction is not yet implemented; the full-content reader displays content already extracted as text.
- The Windows hotkey helper is a separate AutoHotkey v2 script rather than an in-app global shortcut.
- This snapshot has only a small Rust unit-test foundation; database and command integration tests remain to be added.

## License

Released under the [MIT License](LICENSE).

# ClipDrop — Portfolio Case Study

## Short portfolio description

ClipDrop is a local-first desktop intake tool that turns pasted text, clipboard images, and dropped files into an organized, searchable knowledge inbox. I built its compact interface, Rust/Tauri processing pipeline, SQLite full-text search, and provider-agnostic AI classification system, then connected the production UI to a reusable Figma design system.

## The problem

Clipboard snippets, downloaded references, and small working files usually land in unrelated folders with no searchable context. ClipDrop turns capture into a single action, then adds the summary, category, tags, and storage location automatically.

## My role

I designed and implemented the desktop interaction model, TypeScript interface, Rust command layer, SQLite persistence, file lifecycle, and multi-provider AI integration.

## Technical approach

- **Native desktop shell:** Tauri v2 keeps the installed application small while exposing native file-drop and window APIs.
- **Local-first persistence:** SQLite and FTS5 provide durable metadata and fast full-text search without a hosted database.
- **Reliable ingestion:** Files enter a staging inbox before background analysis, then move into an allow-listed category directory.
- **Swappable intelligence:** A single analysis interface supports local Ollama models and optional OpenAI or Anthropic providers.
- **Deliberate UI:** A compact, always-on-top instrument panel minimizes interruption during capture.

## Engineering decisions

### Treat model output as untrusted

Summaries, tags, and categories cross a trust boundary. The frontend escapes model-derived strings before inserting markup, while the backend restricts category output to configured values before using it as a filesystem path.

### Keep files and metadata consistent

The database records a file's current path after classification or a manual category change. This allows later deletion and inspection to operate on the actual stored file rather than its former inbox location.

### Prefer literal search behavior

User search terms are converted into escaped FTS5 terms. Punctuation and query operators therefore behave like content instead of accidentally becoming database query syntax.

### Keep credentials out of project storage

Local Ollama is the default. Optional cloud-provider keys come from process environment variables and are never serialized to `config.json`.

## Quality and security work

- TypeScript strict-mode checks and production builds run in CI.
- Rust tests cover Unicode-safe prompt truncation.
- HTTP failures are surfaced before attempting to parse provider responses.
- Page-scoped event listeners are removed during navigation.
- Tauri uses an explicit content security policy and a minimal capability set.

## What I would build next

- OS-keychain-backed settings for cloud credentials.
- Database and Tauri-command integration tests.
- In-app global shortcut registration to replace the AutoHotkey helper.
- Image-aware analysis for clipboard screenshots.
- A file reveal/open action with narrowly scoped permissions.

## Suggested portfolio assets

Capture three images from a packaged build at 2× scale:

1. Intake view while a file is hovering over the target.
2. Dashboard populated with a mix of processed and queued items.
3. Browse view showing search results and an expanded item detail.

A 10–15 second recording should show capture, background processing, and the categorized result appearing in Browse. Avoid including API keys, personal file paths, or private clipboard content.

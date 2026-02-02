# Frontend Guide

## Overview

The frontend is vanilla TypeScript with no framework (no React, Vue, or Svelte). Pages are rendered via direct DOM manipulation (`innerHTML` + event listener attachment). Vite handles bundling and HMR.

## Entry Point: `main.ts`

Manages SPA routing between three pages and provides the global `showToast()` function.

```typescript
type Page = "intake" | "dashboard" | "browse";
```

**Navigation:** Click handlers on titlebar buttons swap the `#app` container content by calling each page's `render()` function. The active button gets a CSS class.

**Toast notifications:** `showToast(message, type)` displays a brief notification at the bottom of the window. Types: `"success"`, `"error"`.

## Pages

### Intake (`pages/intake.ts`)

The primary data entry page. Renders a full-height drop zone.

**Interactions:**
- **Drag & drop files:** `drop` event reads `dataTransfer.files`, calls `ingest_file` for each
- **Drag & drop text:** `drop` event reads `dataTransfer.getData("text/plain")`, calls `ingest_text`
- **Paste text:** Global `paste` event listener, calls `ingest_text`
- **Paste images:** Iterates `clipboardData.items`, converts image blobs to `Uint8Array`, calls `ingest_clipboard_image`

**Visual feedback:**
- `.dragover` class on drag hover (accent border glow)
- `.success` class flash on successful ingest (1 second)

### Dashboard (`pages/dashboard.ts`)

Overview page showing stats and recent activity.

**Sections:**
1. **Stats grid** -- 4 cards: Total items, Queue (pending + processing), Failed, Category groups
2. **Failed items** -- Only shown when there are failures, with retry buttons
3. **Recent items** -- Last 20 items with type icons, names, categories, status badges

**Item type icons:** File (&#9633;), Text (&#10078;), Image (&#9672;), URL (&#8599;)

**Status badges:** Color-coded by status -- done (cyan), processing (amber, pulsing animation), failed (red), pending (gray).

**Actions:** Retry button on failed items calls `retry_failed`.

### Browse (`pages/browse.ts`)

Search and explore all indexed content.

**Layout:**
- Left sidebar: Category filter buttons (fetched from `get_categories`)
- Top: Search bar with 300ms debounced input
- Center: Item list
- Bottom/right: Detail panel (shown on item click)

**Search:** Calls `search_items` with FTS5 query. Debounced at 300ms.

**Category filter:** Calls `get_by_category` or `get_recent_items` (for "All").

**Detail panel:** Shows full item info -- summary, category, source type, status, tags, and a preview of `raw_text` (truncated to 500 chars). Includes retry and delete action buttons.

## Styling

Custom CSS design system in `styles.css` using CSS variables:

```css
--bg: #08090d;           /* Background */
--surface: #0f1117;      /* Cards/panels */
--accent: #00e5c3;       /* Primary cyan */
--accent2: #ffb444;      /* Secondary amber */
--text: #d8dce8;         /* Primary text */
--text-secondary: #6b7394;
--danger: #ff4466;
```

**Fonts:** Outfit (display), DM Mono (monospace), loaded from Google Fonts.

**Key component classes:**
- `.drop-zone` -- Intake drop target
- `.stat-card` -- Dashboard stat card
- `.item-row` -- List item row
- `.item-status` -- Status badge
- `.detail-panel` -- Item detail view
- `.search-bar` -- Search input
- `.btn`, `.btn-sm`, `.btn-ghost`, `.btn-danger` -- Button variants
- `.tag` -- Tag badge
- `.toast` -- Notification popup

**Animations:**
- `statusPulse` -- Pulsing glow on processing status
- `fadeInUp` -- Page entry animation

## IPC Usage Pattern

All Tauri calls follow this pattern:

```typescript
import { invoke } from "@tauri-apps/api/core";

try {
  const result = await invoke<ReturnType>("command_name", { param1: value1 });
  // Update DOM with result
  showToast("Success");
} catch (err) {
  showToast(`Error: ${err}`, "error");
}
```

## Adding a New Page

1. Create `src/pages/newpage.ts` exporting a `render(container: HTMLElement)` function
2. Add the page type to the `Page` union in `main.ts`
3. Add a nav button in `index.html`
4. Add the click handler in `main.ts` to call your render function

# Backend API Reference

All backend functionality is exposed as Tauri commands invoked from the frontend via `invoke()`.

## Intake Commands

### `ingest_file`

Ingest a file from the filesystem.

```typescript
const itemId = await invoke<string>("ingest_file", { path: "/path/to/file.pdf" });
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `path` | `String` | Absolute path to the file |

**Behavior:**
1. Copies file to `inbox/{uuid}{ext}`
2. Detects MIME type via `mime_guess`
3. If MIME starts with `text/`, reads content into `raw_text`
4. Creates `Item` with status `"processing"`
5. Spawns async processor task
6. Returns the item ID immediately

---

### `ingest_text`

Ingest a text snippet or URL.

```typescript
const itemId = await invoke<string>("ingest_text", { text: "some content" });
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `text` | `String` | Text content or URL |

**Behavior:**
1. Detects if text starts with `http://` or `https://` (sets `source_type` to `"url"`)
2. Saves as `.txt` in inbox
3. Creates `Item` with status `"processing"`
4. Spawns async processor task

---

### `ingest_clipboard_image`

Ingest a clipboard image as raw bytes.

```typescript
const itemId = await invoke<string>("ingest_clipboard_image", { data: uint8Array });
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `data` | `Vec<u8>` | Raw PNG image bytes |

**Behavior:**
1. Saves bytes as `.png` in inbox
2. Creates `Item` with `source_type: "image"`
3. Spawns async processor task

---

## Query Commands

### `get_recent_items`

Get recently created items.

```typescript
const items = await invoke<Item[]>("get_recent_items", { limit: 20 });
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | `Option<usize>` | `50` | Max items to return |

Returns items ordered by `created_at DESC`.

---

### `search_items`

Full-text search across item content and summaries.

```typescript
const items = await invoke<Item[]>("search_items", { query: "rust async" });
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `query` | `String` | FTS5 search query |

Uses SQLite FTS5 to search `raw_text` and `summary` fields.

---

### `get_by_category`

Get all items in a category.

```typescript
const items = await invoke<Item[]>("get_by_category", { category: "Code" });
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `category` | `String` | Category name |

Returns items ordered by `created_at DESC`.

---

### `get_item_detail`

Get full item details including tags.

```typescript
const detail = await invoke<{ item: Item; tags: string[] }>("get_item_detail", { id: "uuid" });
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `String` | Item UUID |

---

### `get_stats`

Get aggregate statistics.

```typescript
const stats = await invoke<Stats>("get_stats");
```

Returns:
```json
{
  "total": 42,
  "pending": 3,
  "failed": 1,
  "categories": 5
}
```

---

### `get_categories`

Get all distinct category names.

```typescript
const categories = await invoke<string[]>("get_categories");
```

---

## Mutation Commands

### `approve_category`

Manually set an item's category.

```typescript
await invoke("approve_category", { id: "uuid", category: "Code" });
```

---

### `update_tags`

Replace all tags for an item.

```typescript
await invoke("update_tags", { id: "uuid", tags: ["rust", "async", "tutorial"] });
```

---

### `delete_item`

Delete an item's file from disk and its database record.

```typescript
await invoke("delete_item", { id: "uuid" });
```

Cascades to delete associated tags and extracted details.

---

### `retry_failed`

Requeue a failed item for processing.

```typescript
await invoke("retry_failed", { id: "uuid" });
```

Sets status to `"processing"` and spawns a new processor task.

---

## Window Commands

### `toggle_window`

Show or hide the application window. Called by the AutoHotkey hotkey script.

```typescript
await invoke("toggle_window");
```

---

## Data Types

### Item

```typescript
interface Item {
  id: string;              // UUID v4
  source_type: string;     // "file" | "text" | "image" | "url"
  original_name: string | null;
  mime_type: string | null;
  raw_text: string | null;
  summary: string | null;  // LLM-generated
  category: string | null;
  status: string;          // "pending" | "processing" | "done" | "failed"
  storage_path: string | null;
  created_at: string;      // ISO 8601
  updated_at: string;      // ISO 8601
}
```

### Stats

```typescript
interface Stats {
  total: number;
  pending: number;
  failed: number;
  categories: number;
}
```

## Error Handling

All commands return `Result<T, String>`. Errors are string messages. The frontend catches them in try/catch blocks and displays via toast notifications.

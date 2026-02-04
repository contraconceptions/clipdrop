# Database Schema

ClipDrop uses embedded SQLite with FTS5 full-text search. The database file is `clipdrop.db` in the app data directory.

## Schema Version

Tracked via `schema_version` table. Current version: **1**.

## Tables

### `items`

Primary content table.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | TEXT | PRIMARY KEY | UUID v4 |
| `source_type` | TEXT | NOT NULL | `"file"`, `"text"`, `"image"`, or `"url"` |
| `original_name` | TEXT | nullable | Original filename |
| `mime_type` | TEXT | nullable | Detected MIME type |
| `raw_text` | TEXT | nullable | Full text content |
| `summary` | TEXT | nullable | LLM-generated summary |
| `category` | TEXT | nullable | Assigned category |
| `status` | TEXT | NOT NULL, default `"pending"` | `"pending"`, `"processing"`, `"done"`, `"failed"` |
| `storage_path` | TEXT | nullable | Absolute path to stored file |
| `created_at` | TEXT | NOT NULL | ISO 8601 timestamp |
| `updated_at` | TEXT | NOT NULL | ISO 8601 timestamp |

### `tags`

Many-to-many tags for items.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | |
| `item_id` | TEXT | NOT NULL, FK → items(id) ON DELETE CASCADE | |
| `tag` | TEXT | NOT NULL | Tag string |

### `extracted_details`

Key-value metadata extracted from content.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | |
| `item_id` | TEXT | NOT NULL, FK → items(id) ON DELETE CASCADE | |
| `key` | TEXT | NOT NULL | Detail key |
| `value` | TEXT | NOT NULL | Detail value |

### `categories`

Category registry.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `name` | TEXT | PRIMARY KEY | Category name |
| `parent` | TEXT | nullable | Parent category (unused currently) |
| `created_at` | TEXT | NOT NULL | ISO 8601 timestamp |

### `items_fts` (Virtual Table)

FTS5 full-text search index on items.

```sql
CREATE VIRTUAL TABLE items_fts USING fts5(
    raw_text, summary,
    content='items',
    content_rowid='rowid'
);
```

Kept in sync via three triggers on the `items` table (insert, update, delete).

## Key Operations

### Insert Item

```rust
db.insert_item(&item)
```

Inserts into `items` table. FTS trigger automatically indexes `raw_text` and `summary`.

### Update After Analysis

```rust
db.update_item_analysis(&id, &summary, &category, &tags)
```

Sets `summary`, `category`, `status = "done"`, `updated_at`. Deletes existing tags and inserts new ones.

### Full-Text Search

```rust
db.search_items(&query)
```

Queries `items_fts` and joins back to `items` for full row data.

### Stats

```rust
db.get_stats()
```

Returns JSON with counts: `total`, `pending` (pending + processing), `failed`, `categories` (distinct non-null categories).

## Migrations

Schema version is checked on startup. If the DB is new, the full v1 schema is created. Future versions would add migration steps in `db.rs`.

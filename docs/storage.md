# Storage & File Management

## Directory Layout

All files are stored under the configured `storage_path` (defaults to the app data directory):

```
{storage_path}/
├── inbox/              # Temporary staging for new items
│   ├── {uuid}.pdf
│   ├── {uuid}.txt
│   └── {uuid}.png
├── Documents/          # Category folders (auto-created)
├── Images/
├── Code/
├── Notes/
├── Links/
└── Other/
```

## Lifecycle

### 1. Intake (Inbox)

When content is ingested, it's immediately saved to the `inbox/` directory:

- **Files:** Copied as `inbox/{uuid}{original-extension}`
- **Text/URLs:** Saved as `inbox/{uuid}.txt`
- **Clipboard images:** Saved as `inbox/{uuid}.png`

The item's `storage_path` in the database points to this inbox location.

### 2. Processing (Move to Category)

After LLM analysis determines a category:

1. The category directory is created if it doesn't exist
2. The file is moved from `inbox/` to `{storage_path}/{category}/{filename}`
3. The `storage_path` in the database is updated
4. Uses `std::fs::rename()` first, falls back to copy + delete if rename fails (cross-device moves)

### 3. Deletion

When an item is deleted:

1. The file is removed from disk (`std::fs::remove_file`)
2. The database record is deleted (cascades to tags and extracted details)

## Storage Functions (`storage.rs`)

| Function | Purpose |
|----------|---------|
| `copy_to_inbox(inbox_path, source, id)` | Copy a file into inbox with UUID name |
| `save_bytes_to_inbox(inbox_path, id, ext, data)` | Write raw bytes to inbox |
| `save_text_to_inbox(inbox_path, id, text)` | Save text as `.txt` in inbox |
| `move_to_category(storage_root, category, current_path)` | Move file to category folder |

## Configuration

The `storage_path` is set in `config.json`. Directory structure is created automatically via `AppConfig::ensure_dirs()` on startup, which creates the inbox and all configured category directories.

Platform defaults:
- **Windows:** `%LOCALAPPDATA%/com.clipdrop.app/`
- **Linux:** `~/.local/share/com.clipdrop.app/`

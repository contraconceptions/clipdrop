use rusqlite::{Connection, Result as SqlResult};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;

pub struct Database {
    pub conn: Mutex<Connection>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Item {
    pub id: String,
    pub source_type: String, // file, text, image, url
    pub original_name: Option<String>,
    pub mime_type: Option<String>,
    pub raw_text: Option<String>,
    pub summary: Option<String>,
    pub category: Option<String>,
    pub status: String, // pending, processing, done, failed
    pub storage_path: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Tag {
    pub id: i64,
    pub item_id: String,
    pub tag: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExtractedDetail {
    pub id: i64,
    pub item_id: String,
    pub key: String,
    pub value: String,
}

impl Database {
    pub fn new(db_path: &PathBuf) -> SqlResult<Self> {
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent).ok();
        }
        let conn = Connection::open(db_path)?;
        let db = Database {
            conn: Mutex::new(conn),
        };
        db.run_migrations()?;
        Ok(db)
    }

    fn run_migrations(&self) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();

        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL);",
        )?;

        let count: i64 =
            conn.query_row("SELECT COUNT(*) FROM schema_version", [], |r| r.get(0))?;
        if count == 0 {
            conn.execute("INSERT INTO schema_version (version) VALUES (0)", [])?;
        }

        let version: i64 =
            conn.query_row("SELECT MAX(version) FROM schema_version", [], |r| r.get(0))?;

        if version < 1 {
            conn.execute_batch(
                "
                CREATE TABLE IF NOT EXISTS items (
                    id TEXT PRIMARY KEY,
                    source_type TEXT NOT NULL,
                    original_name TEXT,
                    mime_type TEXT,
                    raw_text TEXT,
                    summary TEXT,
                    category TEXT,
                    status TEXT NOT NULL DEFAULT 'pending',
                    storage_path TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS tags (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
                    tag TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS extracted_details (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
                    key TEXT NOT NULL,
                    value TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS categories (
                    name TEXT PRIMARY KEY,
                    parent TEXT,
                    created_at TEXT NOT NULL
                );

                CREATE VIRTUAL TABLE IF NOT EXISTS items_fts USING fts5(
                    raw_text, summary, content='items', content_rowid='rowid'
                );

                CREATE TRIGGER IF NOT EXISTS items_ai AFTER INSERT ON items BEGIN
                    INSERT INTO items_fts(rowid, raw_text, summary)
                    VALUES (new.rowid, new.raw_text, new.summary);
                END;

                CREATE TRIGGER IF NOT EXISTS items_au AFTER UPDATE ON items BEGIN
                    INSERT INTO items_fts(items_fts, rowid, raw_text, summary)
                    VALUES ('delete', old.rowid, old.raw_text, old.summary);
                    INSERT INTO items_fts(rowid, raw_text, summary)
                    VALUES (new.rowid, new.raw_text, new.summary);
                END;

                CREATE TRIGGER IF NOT EXISTS items_ad AFTER DELETE ON items BEGIN
                    INSERT INTO items_fts(items_fts, rowid, raw_text, summary)
                    VALUES ('delete', old.rowid, old.raw_text, old.summary);
                END;

                UPDATE schema_version SET version = 1;
                ",
            )?;
        }

        Ok(())
    }

    pub fn insert_item(&self, item: &Item) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO items (id, source_type, original_name, mime_type, raw_text, summary, category, status, storage_path, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            rusqlite::params![
                item.id,
                item.source_type,
                item.original_name,
                item.mime_type,
                item.raw_text,
                item.summary,
                item.category,
                item.status,
                item.storage_path,
                item.created_at,
                item.updated_at,
            ],
        )?;
        Ok(())
    }

    pub fn update_item_status(&self, id: &str, status: &str) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE items SET status = ?1, updated_at = ?2 WHERE id = ?3",
            rusqlite::params![status, now, id],
        )?;
        Ok(())
    }

    pub fn update_item_analysis(
        &self,
        id: &str,
        summary: &str,
        category: &str,
        tags: &[String],
    ) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE items SET summary = ?1, category = ?2, status = 'done', updated_at = ?3 WHERE id = ?4",
            rusqlite::params![summary, category, now, id],
        )?;
        for tag in tags {
            conn.execute(
                "INSERT INTO tags (item_id, tag) VALUES (?1, ?2)",
                rusqlite::params![id, tag],
            )?;
        }
        Ok(())
    }

    pub fn get_item(&self, id: &str) -> SqlResult<Option<Item>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, source_type, original_name, mime_type, raw_text, summary, category, status, storage_path, created_at, updated_at FROM items WHERE id = ?1",
        )?;
        let mut rows = stmt.query_map(rusqlite::params![id], |row| {
            Ok(Item {
                id: row.get(0)?,
                source_type: row.get(1)?,
                original_name: row.get(2)?,
                mime_type: row.get(3)?,
                raw_text: row.get(4)?,
                summary: row.get(5)?,
                category: row.get(6)?,
                status: row.get(7)?,
                storage_path: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        })?;
        match rows.next() {
            Some(Ok(item)) => Ok(Some(item)),
            _ => Ok(None),
        }
    }

    pub fn get_recent_items(&self, limit: usize) -> SqlResult<Vec<Item>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, source_type, original_name, mime_type, raw_text, summary, category, status, storage_path, created_at, updated_at FROM items ORDER BY created_at DESC LIMIT ?1",
        )?;
        let rows = stmt.query_map(rusqlite::params![limit], |row| {
            Ok(Item {
                id: row.get(0)?,
                source_type: row.get(1)?,
                original_name: row.get(2)?,
                mime_type: row.get(3)?,
                raw_text: row.get(4)?,
                summary: row.get(5)?,
                category: row.get(6)?,
                status: row.get(7)?,
                storage_path: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        })?;
        rows.collect()
    }

    pub fn search_items(&self, query: &str) -> SqlResult<Vec<Item>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT i.id, i.source_type, i.original_name, i.mime_type, i.raw_text, i.summary, i.category, i.status, i.storage_path, i.created_at, i.updated_at
             FROM items i
             JOIN items_fts f ON i.rowid = f.rowid
             WHERE items_fts MATCH ?1
             ORDER BY rank",
        )?;
        let rows = stmt.query_map(rusqlite::params![query], |row| {
            Ok(Item {
                id: row.get(0)?,
                source_type: row.get(1)?,
                original_name: row.get(2)?,
                mime_type: row.get(3)?,
                raw_text: row.get(4)?,
                summary: row.get(5)?,
                category: row.get(6)?,
                status: row.get(7)?,
                storage_path: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        })?;
        rows.collect()
    }

    pub fn get_items_by_category(&self, category: &str) -> SqlResult<Vec<Item>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, source_type, original_name, mime_type, raw_text, summary, category, status, storage_path, created_at, updated_at FROM items WHERE category = ?1 ORDER BY created_at DESC",
        )?;
        let rows = stmt.query_map(rusqlite::params![category], |row| {
            Ok(Item {
                id: row.get(0)?,
                source_type: row.get(1)?,
                original_name: row.get(2)?,
                mime_type: row.get(3)?,
                raw_text: row.get(4)?,
                summary: row.get(5)?,
                category: row.get(6)?,
                status: row.get(7)?,
                storage_path: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        })?;
        rows.collect()
    }

    pub fn get_tags_for_item(&self, item_id: &str) -> SqlResult<Vec<String>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT tag FROM tags WHERE item_id = ?1")?;
        let rows = stmt.query_map(rusqlite::params![item_id], |row| row.get(0))?;
        rows.collect()
    }

    pub fn get_all_categories(&self) -> SqlResult<Vec<String>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt =
            conn.prepare("SELECT DISTINCT category FROM items WHERE category IS NOT NULL ORDER BY category")?;
        let rows = stmt.query_map([], |row| row.get(0))?;
        rows.collect()
    }

    pub fn delete_item(&self, id: &str) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM tags WHERE item_id = ?1", rusqlite::params![id])?;
        conn.execute(
            "DELETE FROM extracted_details WHERE item_id = ?1",
            rusqlite::params![id],
        )?;
        conn.execute("DELETE FROM items WHERE id = ?1", rusqlite::params![id])?;
        Ok(())
    }

    pub fn update_item_category(&self, id: &str, category: &str) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE items SET category = ?1, updated_at = ?2 WHERE id = ?3",
            rusqlite::params![category, now, id],
        )?;
        Ok(())
    }

    pub fn update_item_tags(&self, id: &str, tags: &[String]) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM tags WHERE item_id = ?1", rusqlite::params![id])?;
        for tag in tags {
            conn.execute(
                "INSERT INTO tags (item_id, tag) VALUES (?1, ?2)",
                rusqlite::params![id, tag],
            )?;
        }
        Ok(())
    }

    pub fn get_stats(&self) -> SqlResult<serde_json::Value> {
        let conn = self.conn.lock().unwrap();
        let total: i64 = conn.query_row("SELECT COUNT(*) FROM items", [], |r| r.get(0))?;
        let pending: i64 = conn.query_row(
            "SELECT COUNT(*) FROM items WHERE status = 'pending' OR status = 'processing'",
            [],
            |r| r.get(0),
        )?;
        let failed: i64 = conn.query_row(
            "SELECT COUNT(*) FROM items WHERE status = 'failed'",
            [],
            |r| r.get(0),
        )?;
        let categories: i64 = conn.query_row(
            "SELECT COUNT(DISTINCT category) FROM items WHERE category IS NOT NULL",
            [],
            |r| r.get(0),
        )?;
        Ok(serde_json::json!({
            "total": total,
            "pending": pending,
            "failed": failed,
            "categories": categories,
        }))
    }
}

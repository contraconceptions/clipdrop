use crate::db::{Database, Item};
use crate::config::AppConfig;
use crate::storage;
use crate::processor;
use chrono::Utc;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::State;
use uuid::Uuid;

pub struct AppState {
    pub db: Arc<Database>,
    pub config: Arc<std::sync::Mutex<AppConfig>>,
    pub app_data_dir: PathBuf,
}

#[tauri::command]
pub async fn ingest_file(state: State<'_, AppState>, path: String) -> Result<String, String> {
    let id = Uuid::new_v4().to_string();
    let source = PathBuf::from(&path);
    let config = state.config.lock().unwrap().clone();

    let original_name = source
        .file_name()
        .map(|n| n.to_string_lossy().to_string());
    let mime = mime_guess::from_path(&source)
        .first()
        .map(|m| m.to_string());

    let inbox = config.inbox_path();
    let stored = storage::copy_to_inbox(&inbox, &source, &id).map_err(|e| e.to_string())?;

    let raw_text = if mime.as_deref().map_or(false, |m| m.starts_with("text/")) {
        std::fs::read_to_string(&source).ok()
    } else {
        None
    };

    let now = Utc::now().to_rfc3339();
    let item = Item {
        id: id.clone(),
        source_type: "file".into(),
        original_name,
        mime_type: mime,
        raw_text,
        summary: None,
        category: None,
        status: "processing".into(),
        storage_path: Some(stored.to_string_lossy().to_string()),
        created_at: now.clone(),
        updated_at: now,
    };

    state.db.insert_item(&item).map_err(|e| e.to_string())?;

    let db = state.db.clone();
    let cfg = config.clone();
    tokio::spawn(async move {
        processor::process_item(db, cfg, id).await;
    });

    Ok(item.id)
}

#[tauri::command]
pub async fn ingest_text(state: State<'_, AppState>, text: String) -> Result<String, String> {
    let id = Uuid::new_v4().to_string();
    let config = state.config.lock().unwrap().clone();

    let inbox = config.inbox_path();
    let stored = storage::save_text_to_inbox(&inbox, &id, &text).map_err(|e| e.to_string())?;

    let source_type = if text.starts_with("http://") || text.starts_with("https://") {
        "url"
    } else {
        "text"
    };

    let now = Utc::now().to_rfc3339();
    let item = Item {
        id: id.clone(),
        source_type: source_type.into(),
        original_name: None,
        mime_type: Some("text/plain".into()),
        raw_text: Some(text),
        summary: None,
        category: None,
        status: "processing".into(),
        storage_path: Some(stored.to_string_lossy().to_string()),
        created_at: now.clone(),
        updated_at: now,
    };

    state.db.insert_item(&item).map_err(|e| e.to_string())?;

    let db = state.db.clone();
    let cfg = config.clone();
    tokio::spawn(async move {
        processor::process_item(db, cfg, id).await;
    });

    Ok(item.id)
}

#[tauri::command]
pub async fn ingest_clipboard_image(
    state: State<'_, AppState>,
    data: Vec<u8>,
) -> Result<String, String> {
    let id = Uuid::new_v4().to_string();
    let config = state.config.lock().unwrap().clone();

    let inbox = config.inbox_path();
    let stored =
        storage::save_bytes_to_inbox(&inbox, &id, "png", &data).map_err(|e| e.to_string())?;

    let now = Utc::now().to_rfc3339();
    let item = Item {
        id: id.clone(),
        source_type: "image".into(),
        original_name: None,
        mime_type: Some("image/png".into()),
        raw_text: None,
        summary: None,
        category: None,
        status: "processing".into(),
        storage_path: Some(stored.to_string_lossy().to_string()),
        created_at: now.clone(),
        updated_at: now,
    };

    state.db.insert_item(&item).map_err(|e| e.to_string())?;

    let db = state.db.clone();
    let cfg = config.clone();
    tokio::spawn(async move {
        processor::process_item(db, cfg, id).await;
    });

    Ok(item.id)
}

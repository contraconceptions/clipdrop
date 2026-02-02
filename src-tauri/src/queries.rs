use crate::db::Item;
use crate::intake::AppState;
use tauri::State;

#[tauri::command]
pub async fn get_recent_items(
    state: State<'_, AppState>,
    limit: Option<usize>,
) -> Result<Vec<Item>, String> {
    state
        .db
        .get_recent_items(limit.unwrap_or(50))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn search_items(state: State<'_, AppState>, query: String) -> Result<Vec<Item>, String> {
    state.db.search_items(&query).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_by_category(
    state: State<'_, AppState>,
    category: String,
) -> Result<Vec<Item>, String> {
    state
        .db
        .get_items_by_category(&category)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_item_detail(
    state: State<'_, AppState>,
    id: String,
) -> Result<serde_json::Value, String> {
    let item = state
        .db
        .get_item(&id)
        .map_err(|e| e.to_string())?
        .ok_or("Not found")?;
    let tags = state.db.get_tags_for_item(&id).map_err(|e| e.to_string())?;
    Ok(serde_json::json!({
        "item": item,
        "tags": tags,
    }))
}

#[tauri::command]
pub async fn approve_category(
    state: State<'_, AppState>,
    id: String,
    category: String,
) -> Result<(), String> {
    state
        .db
        .update_item_category(&id, &category)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_tags(
    state: State<'_, AppState>,
    id: String,
    tags: Vec<String>,
) -> Result<(), String> {
    state
        .db
        .update_item_tags(&id, &tags)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_item(state: State<'_, AppState>, id: String) -> Result<(), String> {
    // Delete file from disk
    if let Ok(Some(item)) = state.db.get_item(&id) {
        if let Some(path) = &item.storage_path {
            std::fs::remove_file(path).ok();
        }
    }
    state.db.delete_item(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_stats(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    state.db.get_stats().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_categories(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    state.db.get_all_categories().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn retry_failed(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let config = state.config.lock().unwrap().clone();
    state
        .db
        .update_item_status(&id, "processing")
        .map_err(|e| e.to_string())?;
    let db = state.db.clone();
    tokio::spawn(async move {
        crate::processor::process_item(db, config, id).await;
    });
    Ok(())
}

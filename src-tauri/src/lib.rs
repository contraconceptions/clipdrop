mod config;
mod db;
mod intake;
mod llm;
mod processor;
mod queries;
mod storage;

use db::Database;
use intake::AppState;
use std::sync::Arc;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data dir");

            let cfg = config::AppConfig::load(&app_data_dir);
            cfg.ensure_dirs();

            let db_path = app_data_dir.join("clipdrop.db");
            let database = Database::new(&db_path).expect("Failed to init database");

            app.manage(AppState {
                db: Arc::new(database),
                config: Arc::new(std::sync::Mutex::new(cfg)),
                app_data_dir,
            });

            // Show window on startup (for dev; production uses hotkey toggle)
            if let Some(window) = app.get_webview_window("main") {
                window.show().ok();
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            intake::ingest_file,
            intake::ingest_text,
            intake::ingest_clipboard_image,
            queries::get_recent_items,
            queries::search_items,
            queries::get_by_category,
            queries::get_item_detail,
            queries::approve_category,
            queries::update_tags,
            queries::delete_item,
            queries::get_stats,
            queries::get_categories,
            queries::retry_failed,
            toggle_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
async fn toggle_window(window: tauri::Window) -> Result<(), String> {
    if window.is_visible().map_err(|e| e.to_string())? {
        window.hide().map_err(|e| e.to_string())?;
    } else {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

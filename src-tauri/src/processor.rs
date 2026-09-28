use crate::config::AppConfig;
use crate::db::Database;
use crate::llm;
use crate::storage;
use std::path::PathBuf;
use std::sync::Arc;

pub async fn process_item(db: Arc<Database>, config: AppConfig, item_id: String) {
    let result = process_inner(&db, &config, &item_id).await;
    if let Err(e) = result {
        eprintln!("Processing failed for {}: {}", item_id, e);
        db.update_item_failure(&item_id, &e).ok();
    }
}

async fn process_inner(db: &Database, config: &AppConfig, item_id: &str) -> Result<(), String> {
    let item = db
        .get_item(item_id)
        .map_err(|e| e.to_string())?
        .ok_or("Item not found")?;

    let text = match &item.raw_text {
        Some(t) if !t.is_empty() => t.clone(),
        _ => {
            // Try reading as text from stored file
            if let Some(path) = &item.storage_path {
                std::fs::read_to_string(path).unwrap_or_else(|_| {
                    format!(
                        "File: {}. Type: {}",
                        item.original_name.as_deref().unwrap_or("unknown"),
                        item.mime_type.as_deref().unwrap_or("unknown")
                    )
                })
            } else {
                return Err("No content to analyze".into());
            }
        }
    };

    let mut analysis = tokio::time::timeout(
        std::time::Duration::from_secs(180),
        llm::analyze(&config.llm_provider, &text),
    )
    .await
    .map_err(|_| "The model did not respond within 3 minutes. Select a smaller/faster model and retry.".to_string())??;
    if !config
        .categories
        .iter()
        .any(|category| category == &analysis.category)
    {
        analysis.category = "Other".into();
    }

    // Move file from inbox to category folder
    if let Some(path_str) = &item.storage_path {
        let current = PathBuf::from(path_str);
        if current.exists() {
            let stored =
                storage::move_to_category(&config.storage_path, &analysis.category, &current)
                    .map_err(|e| format!("Failed to organize stored content: {}", e))?;
            db.update_item_storage_path(item_id, &stored.to_string_lossy())
                .map_err(|e| e.to_string())?;
        }
    }

    db.update_item_analysis(
        item_id,
        &analysis.summary,
        &analysis.category,
        &analysis.tags,
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

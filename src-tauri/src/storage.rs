use std::path::{Path, PathBuf};

pub fn copy_to_inbox(inbox_path: &Path, source: &Path, id: &str) -> std::io::Result<PathBuf> {
    std::fs::create_dir_all(inbox_path)?;
    let ext = source
        .extension()
        .map(|e| format!(".{}", e.to_string_lossy()))
        .unwrap_or_default();
    let dest = inbox_path.join(format!("{}{}", id, ext));
    std::fs::copy(source, &dest)?;
    Ok(dest)
}

pub fn save_bytes_to_inbox(
    inbox_path: &Path,
    id: &str,
    ext: &str,
    data: &[u8],
) -> std::io::Result<PathBuf> {
    std::fs::create_dir_all(inbox_path)?;
    let dest = inbox_path.join(format!("{}.{}", id, ext));
    std::fs::write(&dest, data)?;
    Ok(dest)
}

pub fn save_text_to_inbox(inbox_path: &Path, id: &str, text: &str) -> std::io::Result<PathBuf> {
    save_bytes_to_inbox(inbox_path, id, "txt", text.as_bytes())
}

pub fn move_to_category(
    storage_root: &Path,
    category: &str,
    current_path: &Path,
) -> std::io::Result<PathBuf> {
    let cat_dir = storage_root.join(category);
    std::fs::create_dir_all(&cat_dir)?;
    let filename = current_path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    let dest = cat_dir.join(&filename);
    std::fs::rename(current_path, &dest).or_else(|_| {
        std::fs::copy(current_path, &dest)?;
        std::fs::remove_file(current_path)
    })?;
    Ok(dest)
}

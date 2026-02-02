use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppConfig {
    pub storage_path: PathBuf,
    pub llm_provider: LlmProviderConfig,
    pub categories: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type")]
pub enum LlmProviderConfig {
    #[serde(rename = "ollama")]
    Ollama { url: String, model: String },
    #[serde(rename = "openai")]
    OpenAI { api_key: String, model: String },
    #[serde(rename = "anthropic")]
    Anthropic { api_key: String, model: String },
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            storage_path: dirs_next().join("ClipDrop"),
            llm_provider: LlmProviderConfig::Ollama {
                url: "http://localhost:11434".into(),
                model: "glm-4.7:cloud".into(),
            },
            categories: vec![
                "Documents".into(),
                "Images".into(),
                "Code".into(),
                "Notes".into(),
                "Links".into(),
                "Other".into(),
            ],
        }
    }
}

fn dirs_next() -> PathBuf {
    dirs_next_data().unwrap_or_else(|| PathBuf::from("."))
}

fn dirs_next_data() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        std::env::var("LOCALAPPDATA").ok().map(PathBuf::from)
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::env::var("HOME")
            .ok()
            .map(|h| PathBuf::from(h).join(".local/share"))
    }
}

impl AppConfig {
    pub fn config_path(app_data_dir: &PathBuf) -> PathBuf {
        app_data_dir.join("config.json")
    }

    pub fn load(app_data_dir: &PathBuf) -> Self {
        let path = Self::config_path(app_data_dir);
        if path.exists() {
            if let Ok(data) = std::fs::read_to_string(&path) {
                if let Ok(config) = serde_json::from_str(&data) {
                    return config;
                }
            }
        }
        let config = Self::default();
        config.save(app_data_dir);
        config
    }

    pub fn save(&self, app_data_dir: &PathBuf) {
        let path = Self::config_path(app_data_dir);
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).ok();
        }
        if let Ok(data) = serde_json::to_string_pretty(self) {
            std::fs::write(&path, data).ok();
        }
    }

    pub fn inbox_path(&self) -> PathBuf {
        self.storage_path.join("inbox")
    }

    pub fn category_path(&self, category: &str) -> PathBuf {
        self.storage_path.join(category)
    }

    pub fn ensure_dirs(&self) {
        std::fs::create_dir_all(self.inbox_path()).ok();
        for cat in &self.categories {
            std::fs::create_dir_all(self.category_path(cat)).ok();
        }
    }
}

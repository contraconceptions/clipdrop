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
    OpenAI { model: String, #[serde(default)] api_key: String },
    #[serde(rename = "anthropic")]
    Anthropic { model: String, #[serde(default)] api_key: String },
    #[serde(rename = "custom")]
    Custom { url: String, model: String, #[serde(default)] api_key: String },
}

#[tauri::command]
pub fn get_settings(state: tauri::State<'_, crate::intake::AppState>) -> AppConfig {
    state.config.lock().unwrap().clone()
}

#[tauri::command]
pub fn save_settings(
    app: tauri::AppHandle,
    state: tauri::State<'_, crate::intake::AppState>,
    config: AppConfig,
) -> Result<(), String> {
    config.ensure_dirs();
    let app_data_dir = tauri::Manager::path(&app).app_data_dir().map_err(|e| e.to_string())?;
    config.save(&app_data_dir);
    *state.config.lock().map_err(|_| "Configuration lock failed")? = config;
    Ok(())
}

#[tauri::command]
pub async fn list_ollama_models(url: String) -> Result<Vec<String>, String> {
    let endpoint = format!("{}/api/tags", url.trim().trim_end_matches('/'));
    let response = reqwest::Client::new().get(&endpoint)
        .send().await.map_err(|e| format!("Could not reach Ollama at {endpoint}: {e}"))?;
    let status = response.status();
    if !status.is_success() {
        let detail = response.text().await.unwrap_or_default();
        return Err(format!("Ollama {endpoint} returned {status}: {detail}"));
    }
    let body: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    Ok(body["models"].as_array().map(|models| models.iter().filter_map(|m| m["name"].as_str().map(str::to_owned)).collect()).unwrap_or_default())
}

#[tauri::command]
pub async fn test_llm_provider(provider: LlmProviderConfig) -> Result<String, String> {
    match provider {
        LlmProviderConfig::Ollama { url, model } => {
            let models = list_ollama_models(url).await?;
            if models.iter().any(|item| item == &model) { Ok(format!("Ollama connected · {model}")) } else { Err(format!("Ollama connected, but '{model}' is not installed. Choose one of the discovered models.")) }
        }
        LlmProviderConfig::OpenAI { api_key, model } => test_models_endpoint("https://api.openai.com/v1/models", &api_key, &model, None).await,
        LlmProviderConfig::Anthropic { api_key, model } => test_models_endpoint("https://api.anthropic.com/v1/models", &api_key, &model, Some(("anthropic-version", "2023-06-01"))).await,
        LlmProviderConfig::Custom { url, api_key, model } => test_models_endpoint(&format!("{}/models", url.trim_end_matches('/')), &api_key, &model, None).await,
    }
}

async fn test_models_endpoint(url: &str, api_key: &str, model: &str, header: Option<(&str, &str)>) -> Result<String, String> {
    if api_key.trim().is_empty() { return Err("Enter an API key first".into()); }
    let client = reqwest::Client::new();
    let mut request = client.get(url).bearer_auth(api_key);
    if let Some((name, value)) = header { request = request.header(name, value).header("x-api-key", api_key); }
    request.send().await.map_err(|e| format!("Connection failed: {e}"))?.error_for_status().map_err(|e| format!("Provider rejected the connection: {e}"))?;
    Ok(format!("Connected · {model}"))
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

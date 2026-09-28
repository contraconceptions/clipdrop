use crate::config::LlmProviderConfig;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AnalysisResult {
    pub summary: String,
    pub category: String,
    pub tags: Vec<String>,
}

const SYSTEM_PROMPT: &str = r#"You are a content classifier. Given text content, respond with ONLY valid JSON:
{"summary": "1-2 sentence summary", "category": "one of: Documents, Images, Code, Notes, Links, Other", "tags": ["tag1", "tag2"]}
No markdown, no explanation, just JSON."#;

pub async fn analyze(config: &LlmProviderConfig, text: &str) -> Result<AnalysisResult, String> {
    let truncated = truncate_utf8(text, 4000);

    match config {
        LlmProviderConfig::Ollama { url, model } => analyze_ollama(url, model, truncated).await,
        LlmProviderConfig::OpenAI { model, api_key } => {
            let api_key = if api_key.is_empty() { std::env::var("CLIPDROP_OPENAI_API_KEY").map_err(|_| "OpenAI API key is not configured".to_string())? } else { api_key.clone() };
            analyze_openai(&api_key, model, truncated).await
        }
        LlmProviderConfig::Anthropic { model, api_key } => {
            let api_key = if api_key.is_empty() { std::env::var("CLIPDROP_ANTHROPIC_API_KEY").map_err(|_| "Anthropic API key is not configured".to_string())? } else { api_key.clone() };
            analyze_anthropic(&api_key, model, truncated).await
        }
        LlmProviderConfig::Custom { url, model, api_key } => analyze_custom(url, api_key, model, truncated).await,
    }
}

async fn analyze_custom(url: &str, api_key: &str, model: &str, text: &str) -> Result<AnalysisResult, String> {
    let client = reqwest::Client::new();
    let resp = client.post(format!("{}/chat/completions", url.trim_end_matches('/'))).bearer_auth(api_key)
        .json(&serde_json::json!({"model":model,"messages":[{"role":"system","content":SYSTEM_PROMPT},{"role":"user","content":text}],"temperature":0.3}))
        .send().await.map_err(|e| format!("Custom provider request failed: {e}"))?.error_for_status().map_err(|e| format!("Custom provider returned an error: {e}"))?;
    let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    parse_analysis(body["choices"][0]["message"]["content"].as_str().ok_or("No response content")?)
}

fn truncate_utf8(text: &str, max_bytes: usize) -> &str {
    if text.len() <= max_bytes {
        return text;
    }

    let mut end = max_bytes;
    while !text.is_char_boundary(end) {
        end -= 1;
    }
    &text[..end]
}

async fn analyze_ollama(url: &str, model: &str, text: &str) -> Result<AnalysisResult, String> {
    let client = reqwest::Client::new();
    let resp = client
        .post(&format!("{}/api/generate", url))
        .json(&serde_json::json!({
            "model": model,
            "prompt": format!("{}\n\nContent:\n{}", SYSTEM_PROMPT, text),
            "stream": false,
            "format": "json",
            "options": { "temperature": 0.1, "num_predict": 300 },
        }))
        .send()
        .await
        .map_err(|e| format!("Ollama request failed: {}", e))?
        .error_for_status()
        .map_err(|e| format!("Ollama returned an error: {}", e))?;

    let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let response_text = body["response"].as_str().ok_or("No response field")?;
    parse_analysis(response_text)
}

async fn analyze_openai(api_key: &str, model: &str, text: &str) -> Result<AnalysisResult, String> {
    let client = reqwest::Client::new();
    let resp = client
        .post("https://api.openai.com/v1/chat/completions")
        .bearer_auth(api_key)
        .json(&serde_json::json!({
            "model": model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": text}
            ],
            "temperature": 0.3,
        }))
        .send()
        .await
        .map_err(|e| format!("OpenAI request failed: {}", e))?
        .error_for_status()
        .map_err(|e| format!("OpenAI returned an error: {}", e))?;

    let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let response_text = body["choices"][0]["message"]["content"]
        .as_str()
        .ok_or("No response content")?;
    parse_analysis(response_text)
}

async fn analyze_anthropic(
    api_key: &str,
    model: &str,
    text: &str,
) -> Result<AnalysisResult, String> {
    let client = reqwest::Client::new();
    let resp = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&serde_json::json!({
            "model": model,
            "max_tokens": 300,
            "system": SYSTEM_PROMPT,
            "messages": [{"role": "user", "content": text}],
        }))
        .send()
        .await
        .map_err(|e| format!("Anthropic request failed: {}", e))?
        .error_for_status()
        .map_err(|e| format!("Anthropic returned an error: {}", e))?;

    let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let response_text = body["content"][0]["text"]
        .as_str()
        .ok_or("No response content")?;
    parse_analysis(response_text)
}

fn parse_analysis(text: &str) -> Result<AnalysisResult, String> {
    // Try to find JSON in the response
    let trimmed = text.trim();
    let json_str = if let Some(start) = trimmed.find('{') {
        if let Some(end) = trimmed.rfind('}') {
            &trimmed[start..=end]
        } else {
            trimmed
        }
    } else {
        trimmed
    };

    serde_json::from_str::<AnalysisResult>(json_str).map_err(|e| {
        format!(
            "Failed to parse LLM response as JSON: {}. Raw: {}",
            e,
            truncate_utf8(text, 200)
        )
    })
}

#[cfg(test)]
mod tests {
    use super::truncate_utf8;

    #[test]
    fn truncates_without_splitting_unicode() {
        let text = format!("{}é", "a".repeat(3999));
        let truncated = truncate_utf8(&text, 4000);
        assert_eq!(truncated.len(), 3999);
        assert!(truncated.ends_with('a'));
    }
}

# LLM Integration

ClipDrop supports three LLM providers for content analysis: Ollama (local), OpenAI, and Anthropic.

## How It Works

1. When an item is ingested, a background task calls `llm::analyze()`
2. Content is truncated to **4000 characters**
3. A system prompt asks the LLM to return JSON with `summary`, `category`, and `tags`
4. The response is parsed and stored in the database

## System Prompt

```
You are a content classifier. Given text content, respond with ONLY valid JSON:
{"summary": "1-2 sentence summary", "category": "one of: Documents, Images, Code, Notes, Links, Other", "tags": ["tag1", "tag2"]}
No markdown, no explanation, just JSON.
```

The category list comes from `AppConfig.categories`.

## Response Parsing

`parse_analysis()` handles:
- Clean JSON responses
- JSON wrapped in markdown code fences (` ```json ... ``` `)
- Returns `AnalysisResult { summary, category, tags }`

## Providers

### Ollama (Default)

Local inference. No API key needed.

| Setting | Default |
|---------|---------|
| URL | `http://localhost:11434` |
| Model | `glm-4.7:cloud` |
| Endpoint | `POST {url}/api/generate` |

**Request:**
```json
{
  "model": "glm-4.7:cloud",
  "prompt": "<system prompt>\n\nContent:\n<text>",
  "stream": false
}
```

**Response field:** `.response`

**Setup:** Install [Ollama](https://ollama.ai/), then `ollama pull glm-4.7:cloud` (or any model you prefer).

### OpenAI

| Setting | Required |
|---------|----------|
| API key | Yes (`sk-...`) |
| Model | e.g. `gpt-4`, `gpt-4o-mini` |
| Endpoint | `https://api.openai.com/v1/chat/completions` |

**Config:**
```json
{
  "type": "openai",
  "api_key": "sk-...",
  "model": "gpt-4"
}
```

**Parameters:** `temperature: 0.3`

### Anthropic

| Setting | Required |
|---------|----------|
| API key | Yes |
| Model | e.g. `claude-3-haiku-20240307` |
| Endpoint | `https://api.anthropic.com/v1/messages` |

**Config:**
```json
{
  "type": "anthropic",
  "api_key": "sk-ant-...",
  "model": "claude-3-haiku-20240307"
}
```

**Parameters:** `max_tokens: 300`, `anthropic-version: 2023-06-01`

## Error Handling

- Network errors: Item status set to `"failed"`, error logged to stderr
- Parse errors: Error message includes a snippet of the raw response
- Users can retry failed items from the dashboard or browse page

## Switching Providers

Edit `config.json` in the app data directory and restart the app. The `llm_provider` field accepts:

```json
{ "type": "ollama", "url": "...", "model": "..." }
{ "type": "openai", "api_key": "...", "model": "..." }
{ "type": "anthropic", "api_key": "...", "model": "..." }
```

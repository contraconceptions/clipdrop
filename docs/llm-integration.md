# LLM Integration

ClipDrop classifies ingested content with Ollama, OpenAI, Anthropic, or a custom OpenAI-compatible service. Configure and test the active provider from **Settings**.

## Processing flow

1. Ingestion creates a database record with `processing` status and starts a background task.
2. Text sent for analysis is limited to 4,000 bytes.
3. The provider is asked for JSON containing `summary`, `category`, and `tags`.
4. A successful result is stored and the item becomes `done`.
5. A provider, timeout, or parse error is stored on the item and its status becomes `failed`.

Provider analysis has a 180-second timeout. Interrupted `processing` records are recovered as failed when the app next starts, so jobs do not remain permanently stuck. Retry starts a fresh processing task.

## Expected response

```json
{
  "summary": "A short description of the content.",
  "category": "Documents",
  "tags": ["reference", "example"]
}
```

The parser accepts plain JSON and JSON wrapped in a Markdown code fence. Categories in the prompt come from `AppConfig.categories`.

## Providers

### Ollama

- Default URL: `http://localhost:11434`
- Discovery/test endpoint: `GET /api/tags`
- Analysis endpoint: `POST /api/generate`
- The request sets `format: "json"`, disables streaming, and uses a low temperature.

Install Ollama, pull at least one model, then use **Load models** in Settings and select it. The connection test verifies that Ollama responds and that the selected model is installed.

### OpenAI

- Test endpoint: `GET https://api.openai.com/v1/models`
- Analysis endpoint: `POST https://api.openai.com/v1/chat/completions`
- Default model in the UI: `gpt-4o-mini`

The saved key is used first. If it is blank, background analysis checks `CLIPDROP_OPENAI_API_KEY`.

### Anthropic

- Test endpoint: `GET https://api.anthropic.com/v1/models`
- Analysis endpoint: `POST https://api.anthropic.com/v1/messages`
- Default model in the UI: `claude-3-5-haiku-latest`
- API version header: `2023-06-01`

The saved key is used first. If it is blank, background analysis checks `CLIPDROP_ANTHROPIC_API_KEY`.

### Custom OpenAI-compatible provider

Supply the API base URL, model, and key. ClipDrop calls `{baseUrl}/models` for connection testing and `{baseUrl}/chat/completions` for analysis with bearer authentication.

## Troubleshooting

- **Ollama provider rejected / connection failed:** confirm Ollama is running, the URL is reachable from the desktop process, and the chosen model appears in `ollama list`.
- **Model not installed:** select **Load models**, choose an installed entry, and save.
- **Cloud provider rejected:** recheck the key, model access, and provider billing/account state.
- **Item failed:** open the failed item to read the stored error, correct the provider configuration, then select **Retry**.
- **Item was processing when the app closed:** it will appear as failed after restart and can be retried safely.

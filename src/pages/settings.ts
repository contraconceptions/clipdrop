import { invoke } from "@tauri-apps/api/core";
import { showToast } from "../main";

type Provider =
  | { type: "ollama"; url: string; model: string }
  | { type: "openai"; model: string; api_key: string }
  | { type: "anthropic"; model: string; api_key: string }
  | { type: "custom"; url: string; model: string; api_key: string };

interface Settings { storage_path: string; llm_provider: Provider; categories: string[] }

const defaults: Record<Provider["type"], Provider> = {
  ollama: { type: "ollama", url: "http://localhost:11434", model: "llama3.2" },
  openai: { type: "openai", model: "gpt-4o-mini", api_key: "" },
  anthropic: { type: "anthropic", model: "claude-3-5-haiku-latest", api_key: "" },
  custom: { type: "custom", url: "https://api.example.com/v1", model: "", api_key: "" },
};

export async function renderSettings(container: HTMLElement) {
  container.innerHTML = '<div class="empty-state">Loading settings…</div>';
  try {
    const settings = await invoke<Settings>("get_settings");
    drawSettings(container, settings);
  } catch (error) {
    container.innerHTML = `<div class="empty-state">Settings are available in the desktop app.<br>${String(error)}</div>`;
  }
}

function drawSettings(container: HTMLElement, settings: Settings) {
  let provider = { ...settings.llm_provider } as Provider;
  container.innerHTML = `
    <section class="page-view settings-view">
      <header class="page-heading"><div><p class="eyebrow">SYSTEM / CONNECTIONS</p><h1>Choose the intelligence behind your index</h1><p>Connect a cloud provider or keep classification entirely on this device.</p></div><span class="settings-security">KEYS STORED IN LOCAL APP DATA</span></header>
      <div class="settings-console">
        <aside class="provider-list" aria-label="LLM providers">
          ${providerButton("ollama", "Ollama", "Local runtime", provider.type)}
          ${providerButton("openai", "OpenAI", "Cloud API", provider.type)}
          ${providerButton("anthropic", "Anthropic", "Claude API", provider.type)}
          ${providerButton("custom", "Compatible API", "OpenAI protocol", provider.type)}
        </aside>
        <form class="settings-form" id="settings-form">
          <div class="settings-form-head"><div><strong id="provider-title"></strong><span id="provider-caption"></span></div><span class="connection-state" id="connection-state">Not tested</span></div>
          <div id="provider-fields"></div>
          <div class="settings-divider"></div>
          <label class="settings-field"><span>Storage location</span><input id="storage-path" value="${escapeAttr(settings.storage_path)}" /></label>
          <label class="settings-field"><span>Categories <small>comma separated</small></span><textarea id="categories" rows="2">${settings.categories.join(", ")}</textarea></label>
          <div class="settings-actions"><button class="btn btn-ghost" id="test-provider" type="button">Test connection</button><button class="btn" type="submit">Save settings</button></div>
        </form>
      </div>
    </section>`;

  const fields = container.querySelector<HTMLElement>("#provider-fields")!;
  const renderFields = () => {
    const isOllama = provider.type === "ollama";
    const hasUrl = provider.type === "ollama" || provider.type === "custom";
    const title = provider.type === "custom" ? "OpenAI-compatible API" : provider.type[0].toUpperCase() + provider.type.slice(1);
    container.querySelector<HTMLElement>("#provider-title")!.textContent = title;
    container.querySelector<HTMLElement>("#provider-caption")!.textContent = isOllama ? "Runs locally. No API key leaves this machine." : "Requests are sent directly to the selected provider.";
    fields.innerHTML = `
      ${hasUrl ? `<label class="settings-field"><span>Base URL</span><input id="provider-url" value="${escapeAttr("url" in provider ? provider.url : "")}" /></label>` : ""}
      <label class="settings-field"><span>Model</span><div class="field-row"><input id="provider-model" list="model-options" value="${escapeAttr(provider.model)}" />${isOllama ? '<button class="btn btn-ghost btn-sm" id="refresh-models" type="button">Find models</button>' : ""}</div><datalist id="model-options"></datalist></label>
      ${!isOllama ? `<label class="settings-field"><span>API key</span><input id="provider-key" type="password" autocomplete="off" value="${escapeAttr("api_key" in provider ? provider.api_key : "")}" placeholder="Paste provider key" /><small class="field-help">Saved only in ClipDrop’s local configuration file.</small></label>` : ""}`;
    container.querySelector("#refresh-models")?.addEventListener("click", async () => {
      syncProvider();
      const state = container.querySelector<HTMLElement>("#connection-state")!;
      state.textContent = "Scanning…";
      try {
        const models = await invoke<string[]>("list_ollama_models", { url: (provider as Extract<Provider, { type: "ollama" }>).url });
        container.querySelector("#model-options")!.innerHTML = models.map(model => `<option value="${escapeAttr(model)}"></option>`).join("");
        const modelInput = container.querySelector<HTMLInputElement>("#provider-model")!;
        if (models.length && !models.includes(modelInput.value)) {
          modelInput.value = models[0];
          provider.model = models[0];
        }
        state.textContent = `${models.length} models found`;
        state.className = "connection-state success";
      } catch (error) { setFailure(error); }
    });
  };

  const syncProvider = () => {
    const activeType = container.querySelector<HTMLButtonElement>(".provider-option.active")?.dataset.provider as Provider["type"] | undefined;
    if (activeType && activeType !== provider.type) provider = { ...defaults[activeType] } as Provider;
    const model = (container.querySelector<HTMLInputElement>("#provider-model")?.value || "").trim();
    if (provider.type === "ollama" || provider.type === "custom") provider.url = (container.querySelector<HTMLInputElement>("#provider-url")?.value || "").trim();
    provider.model = model;
    if (provider.type !== "ollama") provider.api_key = container.querySelector<HTMLInputElement>("#provider-key")?.value || "";
  };
  const setFailure = (error: unknown) => { const state = container.querySelector<HTMLElement>("#connection-state")!; state.textContent = String(error); state.className = "connection-state error"; };

  container.querySelectorAll<HTMLButtonElement>(".provider-option").forEach(button => button.addEventListener("click", () => {
    syncProvider();
    provider = { ...defaults[button.dataset.provider as Provider["type"]] } as Provider;
    container.querySelectorAll(".provider-option").forEach(item => item.classList.toggle("active", item === button));
    container.querySelector<HTMLElement>("#connection-state")!.className = "connection-state";
    container.querySelector<HTMLElement>("#connection-state")!.textContent = "Not tested";
    renderFields();
  }));
  container.querySelector("#test-provider")?.addEventListener("click", async () => {
    syncProvider(); const state = container.querySelector<HTMLElement>("#connection-state")!; state.textContent = "Connecting…";
    try { state.textContent = await invoke<string>("test_llm_provider", { provider }); state.className = "connection-state success"; } catch (error) { setFailure(error); }
  });
  container.querySelector("#settings-form")?.addEventListener("submit", async event => {
    event.preventDefault(); syncProvider();
    const config: Settings = { storage_path: container.querySelector<HTMLInputElement>("#storage-path")!.value.trim(), categories: container.querySelector<HTMLTextAreaElement>("#categories")!.value.split(",").map(v => v.trim()).filter(Boolean), llm_provider: provider };
    try { await invoke("save_settings", { config }); showToast("Settings saved"); } catch (error) { showToast(`Could not save: ${error}`); }
  });
  renderFields();
  if (provider.type === "ollama") (container.querySelector<HTMLButtonElement>("#refresh-models"))?.click();
}

function providerButton(type: Provider["type"], name: string, caption: string, active: string) { return `<button class="provider-option ${type === active ? "active" : ""}" type="button" data-provider="${type}"><i></i><span><strong>${name}</strong><small>${caption}</small></span></button>`; }
function escapeAttr(value: string) { return value.replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]!); }

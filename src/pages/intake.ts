import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open } from "@tauri-apps/plugin-dialog";
import { showToast } from "../main";

const isTauri = () => "__TAURI_INTERNALS__" in window;

export function renderIntake(container: HTMLElement, signal: AbortSignal) {
  container.innerHTML = `
    <section class="page-view">
      <header class="page-heading">
        <div><p class="eyebrow">CAPTURE / INBOX</p><h1>Put anything into your local memory</h1><p>Drop files, paste text, or capture an image. ClipDrop indexes the original without moving it.</p></div>
        <span class="shortcut">⌘⇧V&nbsp;&nbsp; QUICK CAPTURE</span>
      </header>
      <div class="intake-grid">
        <div class="panel drop-panel">
          <div class="drop-zone" id="drop-zone" aria-label="Drop files or paste clipboard content">
            <div class="drop-zone-icon">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M9 3v12M3 9h12" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
        </svg>
            </div>
            <div class="drop-zone-text">Drop files, paste text, or images</div>
            <div class="drop-zone-hint">Ctrl+V &middot; clipboard</div>
          </div>
          <div class="capture-actions"><span>▧&nbsp; PASTE FROM CLIPBOARD</span><button class="btn btn-ghost" id="choose-files" type="button">Choose files</button></div>
        </div>
        <div class="panel intake-overview">
          <div class="panel-heading"><strong>✦ Today’s intake</strong><span>LOCAL WORKFLOW</span></div>
          <div class="trust-grid"><div class="trust-card"><strong>▣ LOCAL ONLY</strong><p>Files and embeddings stay encrypted on this device.</p></div><div class="trust-card"><strong>AFTER CAPTURE <em>AUTO-CLASSIFY</em></strong><p>Extract text, summarize, and suggest tags using your configured model.</p></div></div>
        </div>
      </div>
      <div class="panel capture-note"><span>ORIGINALS UNTOUCHED</span><strong>Ready for your next capture</strong></div>
    </section>
  `;

  const zone = document.getElementById("drop-zone")!;
  const chooseFiles = async () => {
    if (!isTauri()) {
      showToast("Native file selection is available in the desktop app");
      return;
    }
    try {
      const selection = await open({ multiple: true, directory: false });
      if (!selection) return;
      await ingestFiles(Array.isArray(selection) ? selection : [selection], zone);
    } catch (err) {
      setDropZoneState(zone, "error", "Could not open file picker", "Try again", "!");
      showToast(`Error: ${err}`);
    }
  };
  document.getElementById("choose-files")?.addEventListener("click", (event) => {
    event.stopPropagation();
    void chooseFiles();
  });
  zone.addEventListener("click", () => void chooseFiles());
  zone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      void chooseFiles();
    }
  });
  zone.tabIndex = 0;

  if (isTauri()) void getCurrentWebview().onDragDropEvent(async (event) => {
    if (event.payload.type === "over") {
      zone.classList.add("dragover");
      document.getElementById("capture-widget")?.classList.add("dragover");
      return;
    }

    zone.classList.remove("dragover");
    document.getElementById("capture-widget")?.classList.remove("dragover");
    if (event.payload.type === "drop") {
      await ingestFiles(event.payload.paths, zone);
    }
  }).then((unlisten) => {
    if (signal.aborted) {
      unlisten();
    } else {
      signal.addEventListener("abort", unlisten, { once: true });
    }
  }).catch((err) => showToast(`File drop unavailable: ${err}`));

  // Never let the embedded webview/browser navigate to a dropped file.
  const preventFileNavigation = (event: DragEvent) => {
    event.preventDefault();
    if (event.type === "dragover") event.dataTransfer!.dropEffect = "copy";
  };
  window.addEventListener("dragover", preventFileNavigation, { signal });
  window.addEventListener("drop", preventFileNavigation, { signal });

  // Keep browser text drops available alongside Tauri's native file-drop API.
  zone.addEventListener("dragover", (e) => {
    e.preventDefault();
    zone.classList.add("dragover");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));
  zone.addEventListener("drop", async (e) => {
    e.preventDefault();
    zone.classList.remove("dragover");
    if (!isTauri() && e.dataTransfer?.files.length) {
      showToast("File ingestion requires the standalone desktop app");
      return;
    }
    if (!e.dataTransfer?.files.length && e.dataTransfer?.getData("text/plain")) {
      const text = e.dataTransfer.getData("text/plain");
      try {
        await invoke("ingest_text", { text });
        flashSuccess(zone);
        showToast("Text ingested");
      } catch (err) {
        showToast(`Error: ${err}`);
      }
    }
  });

  document.addEventListener("paste", handlePaste, { signal });

  function handlePaste(e: ClipboardEvent) {
    if (currentPageIsIntake()) {
      handlePasteEvent(e, zone);
    }
  }
}

async function ingestFiles(paths: string[], zone: HTMLElement) {
  setDropZoneState(zone, "processing", "Processing locally", "Original remains untouched", "…");
  for (const path of paths) {
    try {
      await invoke("ingest_file", { path });
      flashSuccess(zone);
      showToast(`Ingested: ${path.split(/[\\/]/).pop() || path}`);
    } catch (err) {
      setDropZoneState(zone, "error", "Could not process item", "Retry or remove", "!");
      showToast(`Error: ${err}`);
    }
  }
}

function currentPageIsIntake(): boolean {
  return document.querySelector('.nav-btn.active')?.getAttribute('data-page') === 'intake';
}

async function handlePasteEvent(e: ClipboardEvent, zone: HTMLElement) {
  const items = e.clipboardData?.items;
  if (!items?.length) {
    showToast("Clipboard is empty or unavailable");
    return;
  }

  let handled = false;

  for (const item of Array.from(items)) {
    if (item.type.startsWith("image/")) {
      handled = true;
      const blob = item.getAsFile();
      if (blob) {
        const buffer = await blob.arrayBuffer();
        const data = Array.from(new Uint8Array(buffer));
        try {
          await invoke("ingest_clipboard_image", { data });
          flashSuccess(zone);
          showToast("Image ingested");
        } catch (err) {
          showToast(`Error: ${err}`);
        }
      }
    } else if (item.type === "text/plain") {
      handled = true;
      item.getAsString(async (text) => {
        if (text.trim()) {
          try {
            await invoke("ingest_text", { text });
            flashSuccess(zone);
            showToast("Text ingested");
          } catch (err) {
            showToast(`Error: ${err}`);
          }
        }
      });
    }
  }
  if (!handled) showToast("Paste text or an image to capture it");
}

function flashSuccess(zone: HTMLElement) {
  setDropZoneState(zone, "success", "Captured", "Ctrl+V · clipboard", "✓");
  setTimeout(() => setDropZoneState(zone, "", "Drop files, paste text, or images", "Ctrl+V · clipboard", "+"), 1200);
}

function setDropZoneState(zone: HTMLElement, state: string, message: string, hint: string, icon: string) {
  zone.classList.remove("processing", "success", "error");
  if (state) zone.classList.add(state);
  const messageNode = zone.querySelector<HTMLElement>(".drop-zone-text");
  const hintNode = zone.querySelector<HTMLElement>(".drop-zone-hint");
  const iconNode = zone.querySelector<HTMLElement>(".drop-zone-icon");
  if (messageNode) messageNode.textContent = message;
  if (hintNode) hintNode.textContent = hint;
  if (iconNode) iconNode.textContent = icon;
}

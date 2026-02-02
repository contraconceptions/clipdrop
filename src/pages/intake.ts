import { invoke } from "@tauri-apps/api/core";
import { showToast } from "../main";

export function renderIntake(container: HTMLElement) {
  container.innerHTML = `
    <div class="drop-zone" id="drop-zone">
      <div class="drop-zone-icon">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M9 3v12M3 9h12" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
        </svg>
      </div>
      <div class="drop-zone-text">Drop files, paste text, or images</div>
      <div class="drop-zone-hint">Ctrl+V &middot; clipboard</div>
    </div>
  `;

  const zone = document.getElementById("drop-zone")!;

  zone.addEventListener("dragover", (e) => {
    e.preventDefault();
    zone.classList.add("dragover");
  });

  zone.addEventListener("dragleave", () => {
    zone.classList.remove("dragover");
  });

  zone.addEventListener("drop", async (e) => {
    e.preventDefault();
    zone.classList.remove("dragover");

    if (e.dataTransfer?.files.length) {
      for (const file of Array.from(e.dataTransfer.files)) {
        const path = (file as any).path || file.name;
        try {
          await invoke("ingest_file", { path });
          flashSuccess(zone);
          showToast(`Ingested: ${file.name}`);
        } catch (err) {
          showToast(`Error: ${err}`);
        }
      }
    } else if (e.dataTransfer?.getData("text/plain")) {
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

  document.addEventListener("paste", handlePaste);

  function handlePaste(e: ClipboardEvent) {
    if (currentPageIsIntake()) {
      handlePasteEvent(e, zone);
    }
  }
}

function currentPageIsIntake(): boolean {
  return document.querySelector('.nav-btn.active')?.getAttribute('data-page') === 'intake';
}

async function handlePasteEvent(e: ClipboardEvent, zone: HTMLElement) {
  const items = e.clipboardData?.items;
  if (!items) return;

  for (const item of Array.from(items)) {
    if (item.type.startsWith("image/")) {
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
}

function flashSuccess(zone: HTMLElement) {
  zone.classList.add("success");
  setTimeout(() => zone.classList.remove("success"), 1000);
}

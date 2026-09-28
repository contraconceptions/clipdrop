import { renderIntake } from "./pages/intake";
import { renderDashboard } from "./pages/dashboard";
import { renderBrowse } from "./pages/browse";
import { renderSettings } from "./pages/settings";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { getCurrentWindow } from "@tauri-apps/api/window";

type Page = "intake" | "dashboard" | "browse" | "settings";

let currentPage: Page = "intake";
let pageController = new AbortController();
const isTauri = () => "__TAURI_INTERNALS__" in window;

function navigate(page: Page) {
  currentPage = page;
  document.querySelectorAll("[data-page]").forEach((btn) => {
    btn.classList.toggle("active", (btn as HTMLElement).dataset.page === page);
  });
  renderPage();
}

function renderPage() {
  pageController.abort();
  pageController = new AbortController();
  const container = document.getElementById("page-container")!;
  container.innerHTML = "";
  switch (currentPage) {
    case "intake":
      renderIntake(container, pageController.signal);
      break;
    case "dashboard":
      renderDashboard(container, pageController.signal);
      break;
    case "browse":
      renderBrowse(container);
      break;
    case "settings":
      renderSettings(container);
      break;
  }
}

async function setCompactMode(compact: boolean) {
  document.body.classList.toggle("compact-mode", compact);
  localStorage.setItem("clipdrop-view", compact ? "compact" : "expanded");
  if (!isTauri()) return;
  try {
    const appWindow = getCurrentWindow();
    await appWindow.setSize(compact ? new LogicalSize(360, 116) : new LogicalSize(1040, 680));
    await appWindow.setAlwaysOnTop(true);
  } catch (err) {
    showToast(`Could not resize window: ${err}`);
  }
}

export function showToast(msg: string, duration = 2000) {
  const toast = document.getElementById("toast")!;
  toast.textContent = msg;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), duration);
}

window.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll<HTMLElement>("[data-page]").forEach((btn) => {
    btn.addEventListener("click", () => {
      navigate((btn as HTMLElement).dataset.page as Page);
    });
  });
  document.addEventListener("keydown", (event) => {
    if (!(event.ctrlKey || event.metaKey)) return;
    const page = ({ "1": "intake", "2": "dashboard", "3": "browse", "4": "settings" } as const)[event.key];
    if (page) {
      event.preventDefault();
      navigate(page);
    }
  });
  renderPage();
  document.getElementById("compact-toggle")?.addEventListener("click", () => void setCompactMode(true));
  document.getElementById("widget-expand")?.addEventListener("click", () => void setCompactMode(false));
  document.getElementById("widget-library")?.addEventListener("click", () => {
    void setCompactMode(false);
    navigate("browse");
  });
  document.getElementById("widget-capture")?.addEventListener("click", () => document.getElementById("choose-files")?.click());
  document.getElementById("widget-paste")?.addEventListener("click", () => {
    showToast("Press Ctrl+V to paste text or an image");
    document.getElementById("widget-capture")?.focus();
  });
  if (localStorage.getItem("clipdrop-view") === "compact") void setCompactMode(true);
});

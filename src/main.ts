import { renderIntake } from "./pages/intake";
import { renderDashboard } from "./pages/dashboard";
import { renderBrowse } from "./pages/browse";

type Page = "intake" | "dashboard" | "browse";

let currentPage: Page = "intake";

function navigate(page: Page) {
  currentPage = page;
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.toggle("active", (btn as HTMLElement).dataset.page === page);
  });
  renderPage();
}

function renderPage() {
  const container = document.getElementById("page-container")!;
  container.innerHTML = "";
  switch (currentPage) {
    case "intake":
      renderIntake(container);
      break;
    case "dashboard":
      renderDashboard(container);
      break;
    case "browse":
      renderBrowse(container);
      break;
  }
}

export function showToast(msg: string, duration = 2000) {
  const toast = document.getElementById("toast")!;
  toast.textContent = msg;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), duration);
}

window.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      navigate((btn as HTMLElement).dataset.page as Page);
    });
  });
  renderPage();
});

import { invoke } from "@tauri-apps/api/core";
import { showToast } from "../main";

interface Item {
  id: string;
  source_type: string;
  original_name: string | null;
  summary: string | null;
  category: string | null;
  status: string;
  created_at: string;
}

interface Stats {
  total: number;
  pending: number;
  failed: number;
  categories: number;
}

const typeIcons: Record<string, string> = {
  file: "&#9634;",
  text: "&#9998;",
  image: "&#9638;",
  url: "&#8599;",
};

export async function renderDashboard(container: HTMLElement) {
  container.innerHTML = `<div class="empty-state">Loading...</div>`;

  try {
    const [stats, items] = await Promise.all([
      invoke<Stats>("get_stats"),
      invoke<Item[]>("get_recent_items", { limit: 20 }),
    ]);

    const failedItems = items.filter((i) => i.status === "failed");

    container.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-value">${stats.total}</div><div class="stat-label">Total</div></div>
        <div class="stat-card"><div class="stat-value">${stats.pending}</div><div class="stat-label">Queue</div></div>
        <div class="stat-card"><div class="stat-value">${stats.failed}</div><div class="stat-label">Failed</div></div>
        <div class="stat-card"><div class="stat-value">${stats.categories}</div><div class="stat-label">Groups</div></div>
      </div>

      ${
        failedItems.length
          ? `
        <div class="section-title">Failed</div>
        <div class="item-list" id="failed-list">
          ${failedItems.map((i) => itemRow(i, true)).join("")}
        </div>
      `
          : ""
      }

      <div class="section-title" style="margin-top:10px">Recent</div>
      <div class="item-list" id="recent-list">
        ${items.length ? items.map((i) => itemRow(i)).join("") : '<div class="empty-state">No items yet — drop something on the intake.</div>'}
      </div>
    `;

    container.querySelectorAll(".retry-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = (btn as HTMLElement).dataset.id!;
        try {
          await invoke("retry_failed", { id });
          showToast("Retrying...");
          renderDashboard(container);
        } catch (err) {
          showToast(`Error: ${err}`);
        }
      });
    });
  } catch (err) {
    container.innerHTML = `<div class="empty-state">Error: ${err}</div>`;
  }
}

function itemRow(item: Item, showRetry = false): string {
  const icon = typeIcons[item.source_type] || "&#9634;";
  const name = item.original_name || item.summary?.slice(0, 40) || item.id.slice(0, 8);
  const date = new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `
    <div class="item-row">
      <span class="item-type">${icon}</span>
      <div class="item-info">
        <div class="item-name">${name}</div>
        <div class="item-meta">${item.category || "—"} · ${date}</div>
      </div>
      <span class="item-status ${item.status}">${item.status}</span>
      ${showRetry ? `<button class="btn btn-sm retry-btn" data-id="${item.id}">retry</button>` : ""}
    </div>
  `;
}

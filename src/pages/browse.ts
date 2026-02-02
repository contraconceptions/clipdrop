import { invoke } from "@tauri-apps/api/core";
import { showToast } from "../main";

interface Item {
  id: string;
  source_type: string;
  original_name: string | null;
  raw_text: string | null;
  summary: string | null;
  category: string | null;
  status: string;
  storage_path: string | null;
  created_at: string;
}

const typeIcons: Record<string, string> = {
  file: "&#9634;",
  text: "&#9998;",
  image: "&#9638;",
  url: "&#8599;",
};

let selectedCategory: string | null = null;

export async function renderBrowse(container: HTMLElement) {
  container.innerHTML = `
    <div class="browse-layout">
      <div class="category-sidebar" id="cat-sidebar">
        <div class="section-title">Filter</div>
      </div>
      <div class="browse-main">
        <input class="search-bar" id="search-input" placeholder="search..." />
        <div class="item-list" id="browse-list"></div>
        <div id="detail-container"></div>
      </div>
    </div>
  `;

  const sidebar = document.getElementById("cat-sidebar")!;
  const list = document.getElementById("browse-list")!;
  const detailContainer = document.getElementById("detail-container")!;
  const searchInput = document.getElementById("search-input") as HTMLInputElement;

  try {
    const categories = await invoke<string[]>("get_categories");
    const allBtn = document.createElement("button");
    allBtn.className = "cat-btn active";
    allBtn.textContent = "All";
    allBtn.addEventListener("click", () => {
      selectedCategory = null;
      sidebar.querySelectorAll(".cat-btn").forEach((b) => b.classList.remove("active"));
      allBtn.classList.add("active");
      loadItems(list, detailContainer);
    });
    sidebar.appendChild(allBtn);

    for (const cat of categories) {
      const btn = document.createElement("button");
      btn.className = "cat-btn";
      btn.textContent = cat;
      btn.addEventListener("click", () => {
        selectedCategory = cat;
        sidebar.querySelectorAll(".cat-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        loadItems(list, detailContainer);
      });
      sidebar.appendChild(btn);
    }
  } catch (err) {
    console.error("Failed to load categories:", err);
  }

  let searchTimeout: number;
  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimeout);
    searchTimeout = window.setTimeout(() => {
      const query = searchInput.value.trim();
      if (query) {
        searchItems(query, list, detailContainer);
      } else {
        loadItems(list, detailContainer);
      }
    }, 300);
  });

  loadItems(list, detailContainer);
}

async function loadItems(list: HTMLElement, detailContainer: HTMLElement) {
  try {
    let items: Item[];
    if (selectedCategory) {
      items = await invoke<Item[]>("get_by_category", { category: selectedCategory });
    } else {
      items = await invoke<Item[]>("get_recent_items", { limit: 100 });
    }
    renderItemList(items, list, detailContainer);
  } catch (err) {
    list.innerHTML = `<div class="empty-state">Error: ${err}</div>`;
  }
}

async function searchItems(query: string, list: HTMLElement, detailContainer: HTMLElement) {
  try {
    const items = await invoke<Item[]>("search_items", { query });
    renderItemList(items, list, detailContainer);
  } catch (err) {
    list.innerHTML = `<div class="empty-state">Search error: ${err}</div>`;
  }
}

function renderItemList(items: Item[], list: HTMLElement, detailContainer: HTMLElement) {
  if (!items.length) {
    list.innerHTML = '<div class="empty-state">No items found</div>';
    detailContainer.innerHTML = "";
    return;
  }

  list.innerHTML = items
    .map((item) => {
      const icon = typeIcons[item.source_type] || "&#9634;";
      const name = item.original_name || item.summary?.slice(0, 40) || item.id.slice(0, 8);
      const date = new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      return `
      <div class="item-row" data-id="${item.id}">
        <span class="item-type">${icon}</span>
        <div class="item-info">
          <div class="item-name">${name}</div>
          <div class="item-meta">${item.category || "—"} · ${date}</div>
        </div>
        <span class="item-status ${item.status}">${item.status}</span>
      </div>
    `;
    })
    .join("");

  list.querySelectorAll(".item-row").forEach((row) => {
    row.addEventListener("click", async () => {
      const id = (row as HTMLElement).dataset.id!;
      await showDetail(id, detailContainer);
    });
  });
}

async function showDetail(id: string, detailContainer: HTMLElement) {
  try {
    const detail = await invoke<{ item: Item; tags: string[] }>("get_item_detail", { id });
    const item = detail.item;
    const tags = detail.tags;

    detailContainer.innerHTML = `
      <div class="detail-panel">
        <div class="detail-title">${item.original_name || item.id.slice(0, 12)}</div>
        ${
          item.summary
            ? `<div class="detail-field"><div class="detail-label">Summary</div><div class="detail-value">${item.summary}</div></div>`
            : ""
        }
        <div class="detail-field">
          <div class="detail-label">Category</div>
          <div class="detail-value">${item.category || "Uncategorized"}</div>
        </div>
        <div class="detail-field">
          <div class="detail-label">Type</div>
          <div class="detail-value">${item.source_type} · ${item.status}</div>
        </div>
        ${
          tags.length
            ? `<div class="detail-field"><div class="detail-label">Tags</div><div class="detail-value">${tags.map((t) => `<span class="tag">${t}</span>`).join("")}</div></div>`
            : ""
        }
        ${
          item.raw_text
            ? `<div class="detail-field"><div class="detail-label">Content</div><div class="detail-value" style="max-height:80px;overflow-y:auto;font-family:var(--font-mono);font-size:10px;color:var(--text-tertiary);white-space:pre-wrap;line-height:1.5">${escapeHtml(item.raw_text.slice(0, 500))}</div></div>`
            : ""
        }
        <div style="margin-top:8px;display:flex;gap:4px">
          ${item.status === "failed" ? `<button class="btn btn-sm" id="detail-retry">retry</button>` : ""}
          <button class="btn btn-sm btn-danger" id="detail-delete">delete</button>
        </div>
      </div>
    `;

    detailContainer.querySelector("#detail-retry")?.addEventListener("click", async () => {
      try {
        await invoke("retry_failed", { id });
        showToast("Retrying...");
      } catch (err) {
        showToast(`Error: ${err}`);
      }
    });

    detailContainer.querySelector("#detail-delete")?.addEventListener("click", async () => {
      try {
        await invoke("delete_item", { id });
        showToast("Deleted");
        detailContainer.innerHTML = "";
        const list = document.getElementById("browse-list")!;
        loadItems(list, detailContainer);
      } catch (err) {
        showToast(`Error: ${err}`);
      }
    });
  } catch (err) {
    detailContainer.innerHTML = `<div class="empty-state">Error: ${err}</div>`;
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

import { invoke } from "@tauri-apps/api/core";
import { showToast } from "../main";
import { escapeHtml, formatError } from "../utils";

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
    <section class="page-view">
    <header class="page-heading">
      <div><p class="eyebrow">RETRIEVE / LOCAL INDEX</p><h1>Find the capture by what you remember</h1><p>Search filename, extracted text, tags, and meaning across your private local index.</p></div>
      <span class="shortcut">LOCAL SEARCH</span>
    </header>
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
    </section>
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
    list.innerHTML = `<div class="empty-state">Error: ${escapeHtml(formatError(err))}</div>`;
  }
}

async function searchItems(query: string, list: HTMLElement, detailContainer: HTMLElement) {
  try {
    const items = await invoke<Item[]>("search_items", { query });
    renderItemList(items, list, detailContainer);
  } catch (err) {
    list.innerHTML = `<div class="empty-state">Search error: ${escapeHtml(formatError(err))}</div>`;
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
      const name = escapeHtml(item.original_name || item.summary?.slice(0, 40) || item.id.slice(0, 8));
      const category = escapeHtml(item.category || "—");
      const status = escapeHtml(item.status);
      const date = new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      return `
      <div class="item-row" data-id="${escapeHtml(item.id)}">
        <span class="item-type">${icon}</span>
        <div class="item-info">
          <div class="item-name">${name}</div>
          <div class="item-meta">${category} · ${date}</div>
        </div>
        <span class="item-status ${status}">${status}</span>
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
        <div class="detail-title">${escapeHtml(item.original_name || item.id.slice(0, 12))}</div>
        ${
          item.summary
            ? `<div class="detail-field"><div class="detail-label">Summary</div><div class="detail-value">${escapeHtml(item.summary)}</div></div>`
            : ""
        }
        <div class="detail-field">
          <div class="detail-label">Category</div>
          <div class="detail-value">${escapeHtml(item.category || "Uncategorized")}</div>
        </div>
        <div class="detail-field">
          <div class="detail-label">Type</div>
          <div class="detail-value">${escapeHtml(item.source_type)} · ${escapeHtml(item.status)}</div>
        </div>
        ${
          tags.length
            ? `<div class="detail-field"><div class="detail-label">Tags</div><div class="detail-value">${tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</div></div>`
            : ""
        }
        ${
          item.raw_text
            ? `<div class="detail-field content-field">
                <div class="detail-label">Content</div>
                <div class="content-preview">${escapeHtml(item.raw_text.slice(0, 1200))}${item.raw_text.length > 1200 ? "…" : ""}</div>
                <button class="btn btn-sm btn-ghost" id="view-full-content" type="button">View full content</button>
              </div>`
            : ""
        }
        <div style="margin-top:8px;display:flex;gap:4px">
          ${item.status === "failed" ? `<button class="btn btn-sm" id="detail-retry">retry</button>` : ""}
          <button class="btn btn-sm btn-danger" id="detail-delete">delete</button>
        </div>
      </div>
      ${item.raw_text ? `<dialog class="content-dialog" id="content-dialog" aria-labelledby="content-dialog-title">
        <div class="content-dialog-head"><div><span>FULL CONTENT</span><strong id="content-dialog-title">${escapeHtml(item.original_name || "Captured content")}</strong></div><button class="icon-btn" id="close-content" type="button" aria-label="Close full content">×</button></div>
        <pre id="full-content"></pre>
        <div class="content-dialog-actions"><span>${item.raw_text.length.toLocaleString()} characters</span><button class="btn btn-ghost" id="copy-content" type="button">Copy all</button></div>
      </dialog>` : ""}
    `;

    const dialog = detailContainer.querySelector<HTMLDialogElement>("#content-dialog");
    const fullContent = detailContainer.querySelector<HTMLElement>("#full-content");
    if (fullContent && item.raw_text) fullContent.textContent = item.raw_text;
    detailContainer.querySelector("#view-full-content")?.addEventListener("click", () => dialog?.showModal());
    detailContainer.querySelector("#close-content")?.addEventListener("click", () => dialog?.close());
    dialog?.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
    detailContainer.querySelector("#copy-content")?.addEventListener("click", async () => {
      if (!item.raw_text) return;
      try {
        await navigator.clipboard.writeText(item.raw_text);
        showToast("Full content copied");
      } catch (err) {
        showToast(`Could not copy: ${err}`);
      }
    });

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
    detailContainer.innerHTML = `<div class="empty-state">Error: ${escapeHtml(formatError(err))}</div>`;
  }
}

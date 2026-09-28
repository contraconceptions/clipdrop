export function escapeHtml(value: unknown): string {
  const div = document.createElement("div");
  div.textContent = String(value);
  return div.innerHTML;
}

export function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

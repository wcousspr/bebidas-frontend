const ADMIN_DESTINATIONS = new Set(["/admin", "/admin/bebidas", "/admin/categorias"]);

export function adminReturnTo(state: unknown): string {
  if (typeof state !== "object" || state === null || !("from" in state) || typeof state.from !== "string") {
    return "/admin";
  }

  const pathname = state.from.split(/[?#]/, 1)[0].toLowerCase().replace(/\/+$/, "");
  return ADMIN_DESTINATIONS.has(pathname) && !/[\\\s]/.test(state.from)
    ? state.from
    : "/admin";
}

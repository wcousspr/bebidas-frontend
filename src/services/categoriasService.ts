import { AdminError, getAdminData, type AdminRequest } from "./adminRequest";
import { invalidateCatalog } from "./product";

export interface Categoria {
  id: number;
  name: string;
}

export async function getCategorias(signal: AbortSignal): Promise<Categoria[]> {
  const data = await getAdminData("/api/categorias", signal);
  if (!Array.isArray(data)) throw new AdminError("O serviço retornou uma lista de categorias inválida.");
  return data;
}

export async function criarCategoria(nome: string, request: AdminRequest) {
  await request("/api/categorias", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: nome }),
  });
  invalidateCatalog();
}

export async function atualizarCategoria(id: number, nome: string, request: AdminRequest) {
  await request(`/api/categorias/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: nome }),
  });
  invalidateCatalog();
}

export async function excluirCategoria(id: number, request: AdminRequest) {
  await request(`/api/categorias/${id}`, { method: "DELETE" }, {
    conflict: "Não é possível excluir uma categoria que possui bebidas vinculadas.",
  });
  invalidateCatalog();
}

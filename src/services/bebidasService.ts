import { AdminError, getAdminData, type AdminRequest } from "./adminRequest";
import { invalidateCatalog } from "./product";

export interface Bebida {
  id: number;
  name: string;
  price: number;
  quantity: number;
  category: string;
  imageUrl: string | null;
  description?: string | null;
}

export async function getBebidas(signal: AbortSignal): Promise<Bebida[]> {
  const data = await getAdminData("/api/bebidas", signal);
  if (!Array.isArray(data)) throw new AdminError("O serviço retornou uma lista de bebidas inválida.");
  return data;
}

export interface CreateBebida {
  name: string;
  price: number;
  quantity: number;
  categoryId: number;
  description?: string | null;
}

export async function criarBebida(bebida: CreateBebida, request: AdminRequest): Promise<number | null> {
  const result = await request("/api/bebidas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bebida),
  }, { json: true });
  invalidateCatalog();
  if (typeof result === "object" && result !== null && "id" in result &&
    typeof result.id === "number" && Number.isSafeInteger(result.id) && result.id > 0) {
    return result.id;
  }
  return null;
}

export async function uploadImagemBebida(id: number, arquivo: File, request: AdminRequest) {
  const formData = new FormData();
  formData.append("file", arquivo);
  await request(`/api/bebidas/${id}/imagem`, { method: "POST", body: formData });
  invalidateCatalog();
}

export async function atualizarBebida(id: number, bebida: CreateBebida, request: AdminRequest) {
  await request(`/api/bebidas/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bebida),
  });
  invalidateCatalog();
}

export async function excluirBebida(id: number, request: AdminRequest) {
  await request(`/api/bebidas/${id}`, { method: "DELETE" });
  invalidateCatalog();
}

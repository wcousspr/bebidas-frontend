import type { AdminRequest } from "./adminRequest";

import { invalidateCatalog } from "./product";

const API_URL = import.meta.env.VITE_API_URL;

export interface Bebida {
  id: number;
  name: string;
  price: number;
  quantity: number;
  category: string;
  imageUrl: string | null;
  description?: string | null;
}

export async function getBebidas(): Promise<Bebida[]> {
  const response = await fetch(`${API_URL}/api/bebidas`);

  if (!response.ok) {
    throw new Error("Não foi possível carregar as bebidas.");
  }

  return response.json();
}

export interface CreateBebida {
  name: string;
  price: number;
  quantity: number;
  categoryId: number;
  description?: string | null;
}

export async function criarBebida(
  bebida: CreateBebida,
  request: AdminRequest
): Promise<number> {
  const response = await request(`/api/bebidas`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(bebida),
  });

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error("Você não possui permissão para cadastrar bebidas.");
    }

    if (response.status === 400) {
      const errorBody = await response.json().catch(() => null);

      const validationErrors = errorBody?.errors
        ? Object.values(errorBody.errors).flat().join(" ")
        : null;

      throw new Error(
        validationErrors ||
          errorBody?.message ||
          "Verifique os dados da bebida e a categoria selecionada."
      );
    }

    throw new Error(`Erro ao cadastrar bebida (${response.status}).`);
  }

  invalidateCatalog();
  const resultado: unknown = await response.json();

  if (
    typeof resultado !== "object" ||
    resultado === null ||
    !("id" in resultado) ||
    typeof resultado.id !== "number" ||
    !Number.isInteger(resultado.id) ||
    resultado.id <= 0
  ) {
    throw new Error(
      "A bebida foi criada, mas a API não retornou um ID válido. " +
      "Atualize a listagem antes de tentar novamente."
    );
  }

  return resultado.id;
}


export async function uploadImagemBebida(
  id: number,
  arquivo: File,
  request: AdminRequest
): Promise<string> {
  const formData = new FormData();
  formData.append("file", arquivo);

  const response = await request(`/api/bebidas/${id}/imagem`,
    {
      method: "POST",
      body: formData,
    }
  );

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error("Você não possui permissão para enviar imagens.");
    }

    if (response.status === 404) {
      throw new Error("Bebida não encontrada.");
    }

    if (response.status === 400 || response.status === 413) {
      throw new Error("Imagem inválida ou maior que o limite permitido.");
    }

    throw new Error(`Erro ao enviar imagem (${response.status}).`);
  }

  invalidateCatalog();
  const resultado: { imageUrl: string } = await response.json();

  return resultado.imageUrl;
}


export async function atualizarBebida(
  id: number,
  bebida: CreateBebida,
  request: AdminRequest
): Promise<void> {
  const response = await request(`/api/bebidas/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(bebida),
  });

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error("Você não possui permissão para editar bebidas.");
    }

    if (response.status === 404) {
      throw new Error("Bebida não encontrada.");
    }

    if (response.status === 400) {
      const errorBody = await response.json().catch(() => null);

      const validationErrors = errorBody?.errors
        ? Object.values(errorBody.errors).flat().join(" ")
        : null;

      throw new Error(
        validationErrors ||
          errorBody?.message ||
          "Verifique os dados informados."
      );
    }

    throw new Error(`Erro ao atualizar bebida (${response.status}).`);
  }
  invalidateCatalog();
}



export async function excluirBebida(
  id: number,
  request: AdminRequest
): Promise<void> {
  const response = await request(`/api/bebidas/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error("Você não possui permissão para excluir bebidas.");
    }

    if (response.status === 404) {
      throw new Error("Bebida não encontrada.");
    }

    throw new Error(`Erro ao excluir bebida (${response.status}).`);
  }
  invalidateCatalog();
}





const API_URL = import.meta.env.VITE_API_URL;

export interface Categoria {
  id: number;
  name: string;
}

export async function getCategorias(): Promise<Categoria[]> {
  const response = await fetch(`${API_URL}/api/categorias`);

  if (!response.ok) {
    throw new Error("Erro ao carregar categorias.");
  }

  return response.json();
}


export async function criarCategoria(
  nome: string,
  token: string
): Promise<void> {
  const response = await fetch(`${API_URL}/api/categorias`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name:nome }),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Sua sessão expirou. Faça login novamente.");
    }

    if (response.status === 403) {
      throw new Error("Você não possui permissão para cadastrar categorias.");
    }

    const errorBody = await response.text();

console.error("Status:", response.status);
console.error("Resposta completa:", errorBody);

throw new Error(`Erro ao cadastrar categoria (${response.status}).`);
  }
}


export async function atualizarCategoria(
  id: number,
  nome: string,
  token: string
): Promise<void> {
  const response = await fetch(`${API_URL}/api/categorias/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name: nome }),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Sua sessão expirou. Faça login novamente.");
    }

    if (response.status === 403) {
      throw new Error("Você não possui permissão para editar categorias.");
    }

    if (response.status === 404) {
      throw new Error("Categoria não encontrada.");
    }

    throw new Error(`Erro ao atualizar categoria (${response.status}).`);
  }
}



export async function excluirCategoria(
  id: number,
  token: string
): Promise<void> {
  const response = await fetch(`${API_URL}/api/categorias/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Sua sessão expirou. Faça login novamente.");
    }

    if (response.status === 403) {
      throw new Error("Você não possui permissão para excluir categorias.");
    }

    if (response.status === 404) {
      throw new Error("Categoria não encontrada.");
    }

    if (response.status === 409) {
      throw new Error(
        "Não é possível excluir uma categoria que possui bebidas vinculadas."
      );
    }

    throw new Error(`Erro ao excluir categoria (${response.status}).`);
  }
}




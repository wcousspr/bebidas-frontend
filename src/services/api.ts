
const API_URL = import.meta.env.VITE_API_URL;

if (!API_URL) {
  throw new Error("VITE_API_URL não configurada.");
}

export class ApiHttpError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Erro ao consultar a API: ${status}`);
    this.status = status;
  }
}

export class ApiNetworkError extends Error {
  constructor(cause: unknown) {
    super("Falha de rede ao consultar a API.", { cause });
  }
}

type ReadOptions = Pick<RequestInit, "signal" | "cache">;

export async function apiGet<T>(endpoint: string, options?: ReadOptions): Promise<T> {
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: { Accept: "application/json" },
    });

    if (!response.ok) throw new ApiHttpError(response.status);

    return (await response.json()) as T;
  } catch (error) {
    if (!options?.signal?.aborted && error instanceof TypeError) {
      throw new ApiNetworkError(error);
    }
    throw error;
  }
}

const API_URL = import.meta.env.VITE_API_URL;

export interface LoginCredentials {
  email: string;
  password: string;
}

export class InvalidAdminSession extends Error {}

export async function verifyAdminSession(token: string, signal: AbortSignal) {
  const response = await fetch(`${API_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
    cache: "no-store",
  });

  if (response.status === 401) throw new InvalidAdminSession("Sua sessão expirou ou deixou de ser válida.");
  if (response.status === 403) throw new InvalidAdminSession("Você não possui permissão de administrador.");
  if (!response.ok) throw new Error("Não foi possível verificar sua sessão.");

  const profile: { roles?: unknown } | null = await response.json().catch(() => {
    throw new Error("Não foi possível verificar sua sessão.");
  });
  if (!Array.isArray(profile?.roles) || !profile.roles.includes("Admin")) {
    throw new InvalidAdminSession("Você não possui permissão de administrador.");
  }
}

export async function loginAdmin(credentials: LoginCredentials, signal: AbortSignal): Promise<string> {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
    signal,
    cache: "no-store",
  });

  if (response.status === 401) throw new Error("E-mail ou senha inválidos.");
  if (response.status === 429) throw new Error("Muitas tentativas de login. Aguarde antes de tentar novamente.");
  if (!response.ok) throw new Error("Não foi possível realizar o login.");

  const result: { token?: unknown } | null = await response.json().catch(() => null);
  if (typeof result?.token !== "string" || !result.token) {
    throw new Error("Não foi possível validar sua sessão.");
  }

  await verifyAdminSession(result.token, signal);
  return result.token;
}

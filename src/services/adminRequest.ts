export type AdminRequest = (endpoint: string, options?: RequestInit) => Promise<Response>;

export const SESSION_EXPIRED = "Sua sessão expirou ou deixou de ser válida. Entre novamente.";

export function createAdminRequest(
  token: string,
  isCurrent: () => boolean,
  expire: () => void,
): AdminRequest {
  return async (endpoint, options) => {
    if (!isCurrent()) throw new Error(SESSION_EXPIRED);

    const headers = new Headers(options?.headers);
    headers.set("Authorization", `Bearer ${token}`);
    const response = await fetch(`${import.meta.env.VITE_API_URL}${endpoint}`, { ...options, headers });

    if (response.status === 401) {
      if (isCurrent()) expire();
      throw new Error(SESSION_EXPIRED);
    }

    return response;
  };
}

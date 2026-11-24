import { invalidateCatalog } from "./product";

type ResponseOptions = { json?: boolean; conflict?: string };
export type AdminRequest = (
  endpoint: string, options: RequestInit, responseOptions?: ResponseOptions,
) => Promise<unknown>;

export const SESSION_EXPIRED = "Sua sessão expirou ou deixou de ser válida. Entre novamente.";

const messages: Record<number, string> = {
  400: "Verifique os dados informados.",
  403: "Você não possui permissão para realizar esta operação.",
  404: "O item solicitado não foi encontrado.",
  408: "A solicitação demorou mais que o esperado.",
  409: "A operação conflita com os dados atuais.",
  413: "O arquivo excede o limite de envio.",
  429: "Muitas solicitações. Aguarde antes de tentar novamente.",
  500: "Ocorreu um erro no servidor.",
  503: "O serviço está temporariamente indisponível.",
};

export class AdminError extends Error {
  readonly unknownOutcome: boolean;

  constructor(message: string, unknownOutcome = false) {
    super(unknownOutcome
      ? message + " O resultado da operação é desconhecido. Consulte os dados atualizados antes de repetir."
      : message);
    this.unknownOutcome = unknownOutcome;
  }
}

export function adminErrorMessage(error: unknown) {
  return error instanceof AdminError ? error.message : "Não foi possível concluir a solicitação.";
}

// Only display validation messages defined by the API DTOs. Binding errors can
// contain raw input, implementation details or exception messages.
const knownValidation = new Set([
  "O nome é obrigatório.",
  "O nome deve ter entre 2 e 100 caracteres.",
  "A descrição deve ter no máximo 1000 caracteres.",
  "O preço deve ser maior que zero.",
  "A quantidade não pode ser negativa.",
  "A categoria é obrigatória.",
]);

async function validationMessage(response: Response) {
  const problem = await response.json().catch(() => null);
  if (!problem?.errors || typeof problem.errors !== "object") return messages[400];
  const errors = Object.values(problem.errors).flat().filter(
    (value): value is string => typeof value === "string" && knownValidation.has(value),
  );
  return [...new Set(errors)].join(" ") || "Há campos inválidos. Revise os dados informados.";
}

async function send(
  endpoint: string,
  options: RequestInit,
  { json, conflict }: ResponseOptions,
  session?: { isCurrent: () => boolean; expire: () => void },
) {
  const write = !!options.method && options.method !== "GET";
  const timeout = AbortSignal.timeout(15_000);
  const signal = options.signal ? AbortSignal.any([timeout, options.signal]) : timeout;
  const checkSession = () => {
    if (session && !session.isCurrent()) throw new AdminError(SESSION_EXPIRED);
  };
  checkSession();
  let response: Response;
  try {
    response = await fetch(`${import.meta.env.VITE_API_URL}${endpoint}`, {
      ...options, signal, cache: "no-store",
    });
  } catch {
    checkSession();
    throw new AdminError(
      timeout.aborted ? "A solicitação demorou mais que o esperado." : "Falha de conexão com o serviço.",
      write,
    );
  }
  checkSession();
  if (response.status === 401) {
    session?.expire();
    throw new AdminError(SESSION_EXPIRED);
  }
  if (!response.ok) {
    const status = response.status;
    const message = status === 400 ? await validationMessage(response)
      : (status === 409 && conflict) || messages[status] || "Não foi possível concluir a solicitação.";
    checkSession();
    throw new AdminError(message, write && (status >= 500 || status === 408));
  }
  if (!json) return;
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    checkSession();
    if (write) return null; // The 2xx already confirmed the write.
    throw new AdminError(timeout.aborted
      ? "A consulta demorou mais que o esperado."
      : "Não foi possível ler os dados retornados pelo serviço.");
  }
  checkSession();
  return body;
}

export function getAdminData(endpoint: string, signal: AbortSignal) {
  return send(endpoint, { signal }, { json: true });
}

export function createAdminRequest(
  token: string,
  isCurrent: () => boolean,
  expire: () => void,
): AdminRequest {
  let writing = false;
  return async (endpoint, options, responseOptions = {}) => {
    // Keep the lock with the session if the user navigates away mid-request.
    if (writing) throw new AdminError("Ainda há uma operação em processamento nesta sessão.");
    const headers = new Headers(options.headers);
    headers.set("Authorization", `Bearer ${token}`);
    writing = true;
    try {
      return await send(endpoint, { ...options, headers }, responseOptions, { isCurrent, expire });
    } catch (error) {
      if (error instanceof AdminError && error.unknownOutcome) invalidateCatalog();
      throw error;
    } finally {
      writing = false;
    }
  };
}

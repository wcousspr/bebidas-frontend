import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { AuthContext } from "./auth-context";
import { createAdminRequest, SESSION_EXPIRED, type AdminRequest } from "../services/adminRequest";
import { clearAdminToken, readAdminToken, saveAdminToken } from "../services/adminSessionStorage";
import { InvalidAdminSession, loginAdmin, verifyAdminSession, type LoginCredentials } from "../services/authService";

const RESTORE_TIMEOUT_MS = 15_000;
const STORAGE_UNAVAILABLE = "O navegador não permite acessar a sessão salva nesta aba.";
const STORAGE_WRITE_FAILED = "Não foi possível salvar a sessão. Atualizar a página pode exigir novo login.";
const STORAGE_CLEAR_FAILED = "Não foi possível apagar a sessão salva. Feche esta aba para encerrar a sessão local.";

type SessionState =
  | { status: "checking" | "temporary-error"; token: string; message?: string }
  | { status: "authenticated"; request: AdminRequest }
  | { status: "anonymous"; message?: string };

function restoreState(): { session: SessionState; warning: string | null } {
  const { token, available } = readAdminToken();
  return {
    session: token ? { status: "checking", token } : { status: "anonymous" },
    warning: available ? null : STORAGE_UNAVAILABLE,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [{ session, warning }, setAuth] = useState(restoreState);
  const activeSession = useRef<object | null>(null);
  const operation = useRef<AbortController | null>(null);
  const checkingToken = session.status === "checking" ? session.token : null;

  useLayoutEffect(() => () => {
    const pending = operation.current;
    activeSession.current = null;
    operation.current = null;
    pending?.abort();
  }, []);

  const endSession = useCallback((message?: string) => {
    const pending = operation.current;
    operation.current = null;
    activeSession.current = null;
    pending?.abort();
    setAuth({
      session: { status: "anonymous", message },
      warning: clearAdminToken() ? null : STORAGE_CLEAR_FAILED,
    });
  }, []);

  const activateSession = useCallback((token: string, warning: string | null) => {
    const identity = {};
    activeSession.current = identity;
    const request = createAdminRequest(
      token,
      () => activeSession.current === identity,
      () => endSession(SESSION_EXPIRED),
    );
    setAuth({ session: { status: "authenticated", request }, warning });
  }, [endSession]);

  useEffect(() => {
    if (!checkingToken) return;
    const token = checkingToken;

    const controller = new AbortController();
    operation.current = controller;

    function temporaryFailure(message: string) {
      setAuth((current) => ({
        ...current, session: { status: "temporary-error", token, message },
      }));
    }

    const timeout = window.setTimeout(() => {
      if (operation.current !== controller) return;
      operation.current = null;
      controller.abort();
      temporaryFailure("A verificação da sessão demorou mais que o esperado.");
    }, RESTORE_TIMEOUT_MS);

    async function restore() {
      try {
        await verifyAdminSession(token, controller.signal);
        if (operation.current === controller) activateSession(token, null);
      } catch (error) {
        if (operation.current !== controller) return;
        if (error instanceof InvalidAdminSession) {
          endSession(error.message);
        } else {
          temporaryFailure("Não foi possível verificar a sessão. Confira sua conexão e tente novamente.");
        }
      } finally {
        window.clearTimeout(timeout);
        if (operation.current === controller) operation.current = null;
      }
    }

    void restore();
    return () => {
      window.clearTimeout(timeout);
      if (operation.current === controller) operation.current = null;
      controller.abort();
    };
  }, [checkingToken, activateSession, endSession]);

  async function signIn(credentials: LoginCredentials) {
    operation.current?.abort();
    const controller = new AbortController();
    operation.current = controller;
    try {
      const token = await loginAdmin(credentials, controller.signal);
      if (operation.current === controller) {
        activateSession(token, saveAdminToken(token) ? null : STORAGE_WRITE_FAILED);
      }
    } catch (error) {
      if (operation.current === controller) throw error;
    } finally {
      if (operation.current === controller) operation.current = null;
    }
  }

  function retryRestoration() {
    setAuth((current) => current.session.status === "temporary-error"
      ? { ...current, session: { status: "checking", token: current.session.token } }
      : current);
  }

  return (
    <AuthContext.Provider value={{
      status: session.status,
      request: session.status === "authenticated" ? session.request : null,
      message: "message" in session ? session.message ?? null : null,
      storageWarning: warning,
      retryRestoration,
      signIn,
      signOut: () => endSession(),
    }}>
      {children}
    </AuthContext.Provider>
  );
}

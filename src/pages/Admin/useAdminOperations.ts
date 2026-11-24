import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAuth } from "../../contexts/useAuth";
import { AdminError, adminErrorMessage, type AdminRequest } from "../../services/adminRequest";

export function useAdminQuery<T>(load: (signal: AbortSignal) => Promise<T>) {
  const { request } = useAuth();
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const pending = useRef<{ controller: AbortController; result: Promise<boolean> } | null>(null);

  const refresh = useCallback(() => {
    if (pending.current) return pending.current.result;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const result = load(controller.signal).then((value) => {
      if (pending.current?.controller !== controller) return false;
      setData(value);
      return true;
    }).catch((err: unknown) => {
      if (pending.current?.controller === controller) setError(adminErrorMessage(err));
      return false;
    }).finally(() => {
      if (pending.current?.controller !== controller) return;
      pending.current = null;
      setLoading(false);
    });
    pending.current = { controller, result };
    return result;
  }, [load]);

  useLayoutEffect(() => () => {
    pending.current?.controller.abort();
    pending.current = null;
  }, [request, refresh]);

  useEffect(() => {
    let active = true;
    // Allow the development StrictMode cleanup to run before starting a GET.
    queueMicrotask(() => { if (active) void refresh(); });
    return () => { active = false; };
  }, [request, refresh]);

  return { data, setData, loading, error, refresh };
}

export function useAdminMutation(consultar: (revisao: boolean) => Promise<boolean>, consultaPendente: boolean) {
  const { request } = useAuth();
  const scope = useRef<object | null>(null);
  const lock = useRef<object | null>(null);
  const needsReview = useRef(false);
  const [operacao, setOperacao] = useState<{ tipo: string; id?: number } | null>(null);
  const [pendenteRevisao, setPendenteRevisao] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useLayoutEffect(() => {
    scope.current = {};
    return () => {
      scope.current = null;
      lock.current = null;
      needsReview.current = false;
    };
  }, [request]);

  function limparMensagens() {
    setError("");
    setSuccess("");
  }

  function registrarErro(err: unknown, fallback?: string) {
    if (err instanceof AdminError && err.unknownOutcome) {
      needsReview.current = true;
      setPendenteRevisao(true);
    }
    setError(fallback ? fallback + " " + adminErrorMessage(err) : adminErrorMessage(err));
  }

  async function executar(
    tipo: string,
    id: number | undefined,
    action: (request: AdminRequest, current: () => boolean) => Promise<void>,
    confirmar?: () => boolean,
  ) {
    const identity = scope.current;
    if (!identity || !request || lock.current || needsReview.current || consultaPendente) return;
    lock.current = identity;
    const current = () => scope.current === identity;
    try {
      if (confirmar && !confirmar()) return;
      setOperacao({ tipo, id });
      limparMensagens();
      await action(request, current);
    } catch (err) {
      if (current()) registrarErro(err);
    } finally {
      if (current()) {
        lock.current = null;
        setOperacao(null);
      }
    }
  }

  async function reconciliar() {
    const identity = scope.current;
    if (!identity || lock.current || consultaPendente) return;
    lock.current = identity;
    try {
      if (await consultar(needsReview.current) && scope.current === identity && needsReview.current) {
        needsReview.current = false;
        setPendenteRevisao(false);
        setError("");
        setSuccess("Dados atualizados. Confira o item antes de repetir a operação.");
      }
    } finally {
      if (scope.current === identity) lock.current = null;
    }
  }

  return {
    executar, reconciliar, operacao, pendenteRevisao, limparMensagens,
    error, success, setError, setSuccess, registrarErro,
    ocupado: operacao !== null || consultaPendente || pendenteRevisao,
  };
}

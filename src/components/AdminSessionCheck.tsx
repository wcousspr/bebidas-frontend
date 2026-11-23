import { useAuth } from "../contexts/useAuth";

export default function AdminSessionCheck() {
  const { status, message, retryRestoration, signOut } = useAuth();

  return (
    <main>
      {status === "checking" ? (
        <p role="status">Verificando sessão...</p>
      ) : (
        <>
          <p role="alert">{message}</p>
          <p><button type="button" onClick={retryRestoration}>Tentar novamente</button></p>
        </>
      )}
      <button type="button" onClick={signOut}>Encerrar sessão</button>
    </main>
  );
}

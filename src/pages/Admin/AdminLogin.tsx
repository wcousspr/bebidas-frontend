
import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import AdminSessionCheck from "../../components/AdminSessionCheck";
import { siteConfig } from "../../config/site";
import { useAuth } from "../../contexts/useAuth";
import { adminReturnTo } from "./adminReturnTo";
import "./AdminLogin.css";

export default function AdminLogin() {
  const { state } = useLocation();
  const { signIn, status, message, storageWarning } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signIn({ email, password });
      setPassword("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível realizar o login."
      );
    } finally {
      setLoading(false);
    }
  }

  if (status === "checking" || status === "temporary-error") return <AdminSessionCheck />;
  if (status === "authenticated") return <Navigate to={adminReturnTo(state)} replace />;

  return (
    <main className="admin-login">
      <section className="admin-login-card" aria-labelledby="admin-login-title">
        <header className="admin-login-heading">
          <div className="admin-login-brand">
            <span className="logo-symbol" aria-hidden="true">CB</span>
            <span>{siteConfig.name}</span>
          </div>
          <h1 id="admin-login-title">Painel administrativo</h1>
        </header>

        <form
          className="admin-login-form"
          onSubmit={handleSubmit}
          aria-busy={loading}
        >
          <div className="admin-login-field">
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
            />
          </div>

          <div className="admin-login-field">
            <label htmlFor="password">Senha</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {(error || message) && <p className="admin-login-error" role="alert">{error || message}</p>}
          {storageWarning && <p role="status">{storageWarning}</p>}

          <button className="admin-login-submit" type="submit" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </section>
      <Link to="/" className="admin-login-back">
        <span aria-hidden="true">←</span> Voltar ao catálogo
      </Link>
    </main>
  );
}

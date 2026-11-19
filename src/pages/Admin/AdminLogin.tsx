
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { siteConfig } from "../../config/site";
import { useAuth } from "../../contexts/useAuth";
import "./AdminLogin.css";

export default function AdminLogin() {
  const navigate = useNavigate();
  const { signIn } = useAuth();

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
      navigate("/admin", { replace: true });
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

          {error && <p className="admin-login-error" role="alert">{error}</p>}

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

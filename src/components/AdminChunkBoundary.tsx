import { Component, type ReactNode } from "react";
import { Link } from "react-router-dom";

export default class AdminChunkBoundary extends Component<{ children: ReactNode }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <main>
        <p role="alert">Não foi possível carregar o painel administrativo.</p>
        <p><button type="button" onClick={() => window.location.reload()}>Recarregar página</button></p>
        <Link to="/">Voltar ao catálogo</Link>
      </main>
    );
  }
}

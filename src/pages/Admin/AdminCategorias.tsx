import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "../../contexts/useAuth";
import {
  getCategorias,
  criarCategoria,
  atualizarCategoria,
  excluirCategoria,
  type Categoria,
} from "../../services/categoriasService";
import "./AdminCategorias.css";

export default function AdminCategorias() {
  const { token } = useAuth();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [nome, setNome] = useState("");
  const [busca, setBusca] = useState("");
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [nomeEditado, setNomeEditado] = useState("");
  const [updating, setUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const ocupado = saving || updating || deletingId !== null;

  const categoriasFiltradas = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return categorias.filter((categoria) =>
      categoria.name.toLocaleLowerCase("pt-BR").includes(termo)
    );
  }, [categorias, busca]);

  async function carregarCategorias() {
    const dados = await getCategorias();
    setCategorias(dados);
  }

  useEffect(() => {
    let ativo = true;

    getCategorias()
      .then((dados) => {
        if (ativo) setCategorias(dados);
      })
      .catch(() => {
        if (ativo) setError("Erro ao carregar categorias.");
      })
      .finally(() => {
        if (ativo) setLoading(false);
      });

    return () => {
      ativo = false;
    };
  }, []);

  function iniciarEdicao(categoria: Categoria) {
    if (ocupado) return;
    setEditandoId(categoria.id);
    setNomeEditado(categoria.name);
    setError("");
    setSuccess("");
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setNomeEditado("");
  }

  async function salvarEdicao(id: number) {
    if (!token || ocupado) return;
    const nomeLimpo = nomeEditado.trim();

    if (nomeLimpo.length < 2 || nomeLimpo.length > 100) {
      setError("O nome deve ter entre 2 e 100 caracteres.");
      return;
    }

    setUpdating(true);
    setError("");
    setSuccess("");

    try {
      await atualizarCategoria(id, nomeLimpo, token);
      // A edição já foi confirmada pela API; atualizamos a lista local.
      setCategorias((anteriores) =>
        anteriores.map((categoria) =>
          categoria.id === id ? { ...categoria, name: nomeLimpo } : categoria
        )
      );
      cancelarEdicao();
      setSuccess("Categoria atualizada com sucesso!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado ao atualizar categoria.");
    } finally {
      setUpdating(false);
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token || ocupado) return;
    const nomeLimpo = nome.trim();

    if (nomeLimpo.length < 2 || nomeLimpo.length > 100) {
      setError("O nome deve ter entre 2 e 100 caracteres.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await criarCategoria(nomeLimpo, token);
      setNome("");
      setMostrarFormulario(false);
      setSuccess("Categoria cadastrada com sucesso!");
      try {
        await carregarCategorias();
      } catch {
        setError("Categoria cadastrada, mas não foi possível atualizar a lista. Recarregue a página.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado ao cadastrar categoria.");
    } finally {
      setSaving(false);
    }
  }

  async function handleExcluir(categoria: Categoria) {
    if (!token || ocupado) return;
    const confirmou = window.confirm(
      `Tem certeza que deseja excluir a categoria "${categoria.name}"?\n\nCategorias com bebidas vinculadas não podem ser excluídas.`
    );
    if (!confirmou) return;

    setDeletingId(categoria.id);
    setError("");
    setSuccess("");

    try {
      await excluirCategoria(categoria.id, token);
      setCategorias((anteriores) =>
        anteriores.filter((item) => item.id !== categoria.id)
      );
      if (editandoId === categoria.id) cancelarEdicao();
      setSuccess("Categoria excluída com sucesso!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado ao excluir categoria.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="admin-categorias">
      <header className="ac-header">
        <div>
          <h1>Gerenciar categorias</h1>
          <p>Organize os produtos da distribuidora.</p>
        </div>
        <button
          type="button"
          className="ac-button ac-button-primary"
          onClick={() => {
            setMostrarFormulario((anterior) => !anterior);
            setError("");
            setSuccess("");
          }}
          disabled={ocupado}
          aria-expanded={mostrarFormulario}
          aria-controls="ac-formulario"
        >
          {mostrarFormulario ? "Fechar formulário" : "+ Nova categoria"}
        </button>
      </header>

      {error && <p className="ac-message ac-message-error" role="alert">{error}</p>}
      {success && <p className="ac-message ac-message-success" role="status">{success}</p>}

      {mostrarFormulario && (
        <section className="ac-panel" id="ac-formulario">
          <h2>Cadastrar nova categoria</h2>
          <form onSubmit={handleSubmit} className="ac-form">
            <div className="ac-field">
              <label htmlFor="ac-nome">Nome da categoria</label>
              <input
                id="ac-nome"
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: Refrigerantes"
                minLength={2}
                maxLength={100}
                required
                disabled={ocupado}
              />
            </div>
            <div className="ac-actions">
              <button type="submit" className="ac-button ac-button-primary" disabled={ocupado || !token}>
                {saving ? "Salvando..." : "Cadastrar categoria"}
              </button>
              <button type="button" className="ac-button ac-button-secondary" disabled={ocupado} onClick={() => setMostrarFormulario(false)}>
                Cancelar
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="ac-panel" aria-labelledby="ac-list-title">
        <div className="ac-list-heading">
          <h2 id="ac-list-title">Categorias cadastradas</h2>
          <span className="ac-count">{categorias.length} {categorias.length === 1 ? "categoria" : "categorias"}</span>
        </div>

        <div className="ac-field ac-search">
          <label htmlFor="ac-busca">Buscar categoria</label>
          <input
            id="ac-busca"
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Digite o nome da categoria..."
          />
        </div>

        {loading ? (
          <p className="ac-empty">Carregando categorias...</p>
        ) : categorias.length === 0 ? (
          <p className="ac-empty">Nenhuma categoria cadastrada.</p>
        ) : categoriasFiltradas.length === 0 ? (
          <p className="ac-empty">Nenhuma categoria encontrada para essa busca.</p>
        ) : (
          <ul className="ac-list">
            {categoriasFiltradas.map((categoria) => (
              <li className="ac-item" key={categoria.id}>
                {editandoId === categoria.id ? (
                  <div className="ac-edit">
                    <div className="ac-field">
                      <label htmlFor={`ac-editar-${categoria.id}`}>Nome da categoria</label>
                      <input
                        id={`ac-editar-${categoria.id}`}
                        type="text"
                        value={nomeEditado}
                        onChange={(e) => setNomeEditado(e.target.value)}
                        minLength={2}
                        maxLength={100}
                        disabled={ocupado}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void salvarEdicao(categoria.id);
                          }
                          if (e.key === "Escape" && !ocupado) cancelarEdicao();
                        }}
                      />
                    </div>
                    <div className="ac-actions">
                      <button type="button" className="ac-button ac-button-primary" onClick={() => salvarEdicao(categoria.id)} disabled={ocupado || !token}>
                        {updating ? "Salvando..." : "Salvar alterações"}
                      </button>
                      <button type="button" className="ac-button ac-button-secondary" onClick={cancelarEdicao} disabled={ocupado}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="ac-item-content">
                    <div className="ac-item-details">
                      <div className="ac-item-icon" aria-hidden="true">▦</div>
                      <div>
                        <strong>{categoria.name}</strong>
                        <span>Categoria #{categoria.id}</span>
                      </div>
                    </div>
                    <div className="ac-actions">
                      <button type="button" className="ac-button ac-button-secondary" onClick={() => iniciarEdicao(categoria)} disabled={ocupado}>
                        Editar
                      </button>
                      <button type="button" className="ac-button ac-button-danger" onClick={() => handleExcluir(categoria)} disabled={ocupado}>
                        {deletingId === categoria.id ? "Excluindo..." : "Excluir"}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

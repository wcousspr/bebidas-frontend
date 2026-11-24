import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAdminMutation, useAdminQuery } from "./useAdminOperations";
import {
  getCategorias,
  criarCategoria,
  atualizarCategoria,
  excluirCategoria,
  type Categoria,
} from "../../services/categoriasService";
import "./AdminCategorias.css";

const listaVazia: Categoria[] = [];

export default function AdminCategorias() {
  const { data, setData, loading, error: erroConsulta, refresh } = useAdminQuery(getCategorias);
  const categorias = data ?? listaVazia;
  const {
    executar, reconciliar, operacao, pendenteRevisao, limparMensagens,
    error, success, setError, setSuccess, ocupado,
  } = useAdminMutation(refresh, loading);
  const [nome, setNome] = useState("");
  const [busca, setBusca] = useState("");
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [nomeEditado, setNomeEditado] = useState("");
  const categoriasFiltradas = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return categorias.filter((categoria) =>
      categoria.name.toLocaleLowerCase("pt-BR").includes(termo)
    );
  }, [categorias, busca]);

  useEffect(() => {
    if (mostrarFormulario) document.getElementById("ac-nome")?.focus();
    if (editandoId !== null) document.getElementById(`ac-editar-${editandoId}`)?.focus();
  }, [mostrarFormulario, editandoId]);

  function iniciarEdicao(categoria: Categoria) {
    if (ocupado) return;
    setEditandoId(categoria.id);
    setNomeEditado(categoria.name);
    limparMensagens();
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setNomeEditado("");
  }

  function fecharEdicao() {
    cancelarEdicao();
    document.getElementById("ac-busca")?.focus();
  }

  function fecharCadastro() {
    setMostrarFormulario(false);
    document.getElementById("ac-nova")?.focus();
  }

  function nomeValido(valor: string) {
    if (valor.length >= 2 && valor.length <= 100) return true;
    setError("O nome deve ter entre 2 e 100 caracteres.");
    return false;
  }

  function salvarEdicao(id: number) {
    return executar("edicao", id, async (request, current) => {
      const nomeLimpo = nomeEditado.trim();
      if (!nomeValido(nomeLimpo)) return;
      await atualizarCategoria(id, nomeLimpo, request);
      if (!current()) return;
      setData((lista) => lista?.map((item) => item.id === id ? { ...item, name: nomeLimpo } : item));
      cancelarEdicao();
      setSuccess("Categoria atualizada com sucesso!");
    });
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    return executar("cadastro", undefined, async (request, current) => {
      const nomeLimpo = nome.trim();
      if (!nomeValido(nomeLimpo)) return;
      await criarCategoria(nomeLimpo, request);
      if (!current()) return;
      setNome("");
      setMostrarFormulario(false);
      setSuccess("Categoria cadastrada com sucesso!");
      await refresh();
    });
  }

  function handleExcluir(categoria: Categoria) {
    return executar("exclusao", categoria.id, async (request, current) => {
      await excluirCategoria(categoria.id, request);
      if (!current()) return;
      setData((lista) => lista?.filter((item) => item.id !== categoria.id));
      setSuccess("Categoria excluída com sucesso!");
    }, () => window.confirm(
      `Tem certeza que deseja excluir a categoria "${categoria.name}"?\n\nCategorias com bebidas vinculadas não podem ser excluídas.`
    ));
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
          id="ac-nova"
          onClick={() => {
            setMostrarFormulario((anterior) => !anterior);
            limparMensagens();
          }}
          disabled={ocupado || !data}
          aria-expanded={mostrarFormulario}
          aria-controls="ac-formulario"
        >
          {mostrarFormulario ? "Fechar formulário" : "+ Nova categoria"}
        </button>
      </header>

      {error && <p className="ac-message ac-message-error" role="alert">{error}</p>}
      {success && <p className="ac-message ac-message-success" role="status">{success}</p>}
      {operacao && <p role="status">Processando operação…</p>}
      {erroConsulta && <p className="ac-message ac-message-error" role="alert">Falha ao atualizar as categorias. {erroConsulta}</p>}
      {(erroConsulta || pendenteRevisao) && (
        <button type="button" className="ac-button ac-button-secondary" disabled={loading || !!operacao}
          onClick={reconciliar}>Consultar dados atualizados</button>
      )}
      {loading && <p role="status">Carregando categorias...</p>}

      {mostrarFormulario && (
        <section className="ac-panel" id="ac-formulario">
          <h2>Cadastrar nova categoria</h2>
          <form onSubmit={handleSubmit} className="ac-form"
            onKeyDown={(e) => { if (e.key === "Escape" && !ocupado) fecharCadastro(); }}>
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
              <button type="submit" className="ac-button ac-button-primary" disabled={ocupado}>
                {operacao?.tipo === "cadastro" ? "Salvando..." : "Cadastrar categoria"}
              </button>
              <button type="button" className="ac-button ac-button-secondary" disabled={ocupado} onClick={fecharCadastro}>
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

        {!data ? null : categorias.length === 0 ? (
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
                          if (e.key === "Escape" && !ocupado) fecharEdicao();
                        }}
                      />
                    </div>
                    <div className="ac-actions">
                      <button type="button" className="ac-button ac-button-primary" onClick={() => salvarEdicao(categoria.id)} disabled={ocupado}>
                        {operacao?.tipo === "edicao" ? "Salvando..." : "Salvar alterações"}
                      </button>
                      <button type="button" className="ac-button ac-button-secondary" onClick={fecharEdicao} disabled={ocupado}>
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
                      <button type="button" className="ac-button ac-button-danger" onClick={() => handleExcluir(categoria)} disabled={ocupado} aria-label={`Excluir ${categoria.name}`}>
                        {operacao?.tipo === "exclusao" && operacao.id === categoria.id ? "Excluindo..." : "Excluir"}
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

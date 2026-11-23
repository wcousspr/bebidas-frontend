import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useAuth } from "../../contexts/useAuth";
import { getCategorias, type Categoria } from "../../services/categoriasService";
import {
  criarBebida,
  getBebidas,
  uploadImagemBebida,
  atualizarBebida,
  excluirBebida,
  type Bebida,
  type CreateBebida,
} from "../../services/bebidasService";
import "./AdminBebidas.css";

type Formulario = {
  name: string;
  price: string;
  quantity: string;
  categoryId: string;
  description: string;
};

const formularioVazio: Formulario = {
  name: "",
  price: "",
  quantity: "",
  categoryId: "",
  description: "",
};

const limiteDescricao = 1000;

const formatarMoeda = (valor: number) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function validarFormulario(form: Formulario, categorias: Categoria[]): CreateBebida {
  const name = form.name.trim();
  const price = Number(form.price);
  const quantity = Number(form.quantity);
  const categoryId = Number(form.categoryId);

  if (name.length < 2 || name.length > 100) {
    throw new Error("O nome deve ter entre 2 e 100 caracteres.");
  }
  if (form.price.trim() === "" || !Number.isFinite(price) || price < 0.01 || price > 10000) {
    throw new Error("O preço deve estar entre R$ 0,01 e R$ 10.000.");
  }
  if (Math.round(price * 100) !== price * 100 && Math.abs(Math.round(price * 100) - price * 100) > 1e-7) {
    throw new Error("Informe o preço com no máximo duas casas decimais.");
  }
  if (form.quantity.trim() === "" || !Number.isInteger(quantity) || quantity < 0 || quantity > 100000) {
    throw new Error("A quantidade deve ser um inteiro entre 0 e 100.000.");
  }
  if (!Number.isInteger(categoryId) || !categorias.some((c) => c.id === categoryId)) {
    throw new Error("Selecione uma categoria válida.");
  }
  const description = form.description.trim();
  if (description.length > limiteDescricao) {
    throw new Error("A descrição deve ter no máximo 1000 caracteres.");
  }
  return { name, price, quantity, categoryId, description: description || null };
}

export default function AdminBebidas() {
  const { request } = useAuth();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [bebidas, setBebidas] = useState<Bebida[]>([]);
  const [loading, setLoading] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [mostrarCadastro, setMostrarCadastro] = useState(false);
  const [cadastro, setCadastro] = useState<Formulario>(formularioVazio);
  const [imagemCadastro, setImagemCadastro] = useState<File | null>(null);
  const [previewImagem, setPreviewImagem] = useState<string | null>(null);
  const [edicao, setEdicao] = useState<Formulario>(formularioVazio);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [arquivos, setArquivos] = useState<Record<number, File | null>>({});
  const [operacao, setOperacao] = useState<"cadastro" | "edicao" | "exclusao" | "upload" | null>(null);
  const [operacaoId, setOperacaoId] = useState<number | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const arquivoInputs = useRef<Record<number, HTMLInputElement | null>>({});
  const ocupado = operacao !== null;

  useEffect(() => {
    let ativo = true;
    Promise.all([getCategorias(), getBebidas()])
      .then(([listaCategorias, listaBebidas]) => {
        if (!ativo) return;
        setCategorias(listaCategorias);
        setBebidas(listaBebidas);
      })
      .catch(() => {
        if (ativo) setErroCarregamento("Não foi possível carregar bebidas e categorias. Atualize a página para tentar novamente.");
      })
      .finally(() => {
        if (ativo) setLoading(false);
      });
    return () => { ativo = false; };
  }, []);

  const bebidasFiltradas = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return bebidas.filter((bebida) =>
      bebida.name.toLocaleLowerCase("pt-BR").includes(termo) &&
      (!filtroCategoria || bebida.category === filtroCategoria)
    );
  }, [bebidas, busca, filtroCategoria]);

  function limparMensagens() {
    setError("");
    setSuccess("");
  }

  function iniciarEdicao(bebida: Bebida) {
    if (ocupado) return;
    const correspondentes = categorias.filter((categoria) => categoria.name === bebida.category);
    if (correspondentes.length !== 1) {
      setError("Não foi possível identificar uma categoria única para esta bebida. Verifique as categorias cadastradas.");
      return;
    }
    setMostrarCadastro(false);
    setEditandoId(bebida.id);
    setEdicao({
      name: bebida.name,
      price: String(bebida.price),
      quantity: String(bebida.quantity),
      categoryId: String(correspondentes[0].id),
      description: bebida.description ?? "",
    });
    limparMensagens();
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setEdicao(formularioVazio);
  }


function selecionarImagemCadastro(arquivo: File | null) {
  if (previewImagem) {
    URL.revokeObjectURL(previewImagem);
  }

  setImagemCadastro(null);
  setPreviewImagem(null);

  if (!arquivo) return;

  if (!["image/jpeg", "image/png", "image/webp"].includes(arquivo.type)) {
    setError("Selecione uma imagem JPG, PNG ou WebP.");
    return;
  }

  if (arquivo.size === 0 || arquivo.size > 5 * 1024 * 1024) {
    setError("A imagem deve ter mais de 0 bytes e no máximo 5 MB.");
    return;
  }

  setImagemCadastro(arquivo);
  setPreviewImagem(URL.createObjectURL(arquivo));
  setError("");
}






  
async function handleCadastrar(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();

  if (!request || ocupado) return;

  let dados: CreateBebida;

  try {
    dados = validarFormulario(cadastro, categorias);
  } catch (err) {
    setError(err instanceof Error ? err.message : "Dados inválidos.");
    return;
  }

  setOperacao("cadastro");
  limparMensagens();

  let bebidaCriadaId: number;

  try {
    bebidaCriadaId = await criarBebida(dados, request);
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Erro inesperado ao cadastrar bebida."
    );
    setOperacao(null);
    return;
  }

  let mensagem = "Bebida cadastrada com sucesso!";
  let erroUpload = "";

  if (imagemCadastro) {
    try {
      await uploadImagemBebida(
        bebidaCriadaId,
        imagemCadastro,
        request
      );

      mensagem = "Bebida e imagem cadastradas com sucesso!";
    } catch (err) {
      erroUpload =
        `A bebida foi cadastrada (ID ${bebidaCriadaId}), ` +
        "mas não foi possível enviar a imagem. " +
        "Você pode adicioná-la pela listagem. " +
        (err instanceof Error ? err.message : "");
    }
  }

  setCadastro(formularioVazio);
  setImagemCadastro(null);

  if (previewImagem) {
    URL.revokeObjectURL(previewImagem);
  }

  setPreviewImagem(null);
  setMostrarCadastro(false);
  setSuccess(mensagem);

  if (erroUpload) {
    setError(erroUpload);
  }

  try {
    setBebidas(await getBebidas());
  } catch {
    setError(
      (erroUpload ? erroUpload + " " : "") +
      "Não foi possível atualizar a listagem. Atualize a página."
    );
  } finally {
    setOperacao(null);
  }
}

  async function handleSalvarEdicao(id: number) {
    if (!request || ocupado) return;
    let dados: CreateBebida;
    try {
      dados = validarFormulario(edicao, categorias);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dados inválidos.");
      return;
    }
    setOperacao("edicao");
    setOperacaoId(id);
    limparMensagens();
    try {
      await atualizarBebida(id, dados, request);
      cancelarEdicao();
      setSuccess("Bebida atualizada com sucesso!");
      try {
        setBebidas(await getBebidas());
      } catch {
        setError("A bebida foi atualizada, mas não foi possível atualizar a listagem. Atualize a página.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado ao atualizar bebida.");
    } finally {
      setOperacao(null);
      setOperacaoId(null);
    }
  }

  async function handleExcluir(bebida: Bebida) {
    if (!request || ocupado) return;
    if (!window.confirm(`Tem certeza que deseja excluir "${bebida.name}"?\n\nO produto será removido do catálogo.`)) return;
    setOperacao("exclusao");
    setOperacaoId(bebida.id);
    limparMensagens();
    try {
      await excluirBebida(bebida.id, request);
      setBebidas((anteriores) => anteriores.filter((item) => item.id !== bebida.id));
      if (editandoId === bebida.id) cancelarEdicao();
      setSuccess(`Bebida "${bebida.name}" excluída com sucesso!`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado ao excluir bebida.");
    } finally {
      setOperacao(null);
      setOperacaoId(null);
    }
  }

  async function handleUploadImagem(id: number) {
    if (!request || ocupado) return;
    const arquivo = arquivos[id];
    if (!arquivo) { setError("Selecione uma imagem antes de enviar."); return; }
    if (!["image/jpeg", "image/png", "image/webp"].includes(arquivo.type)) {
      setError("Selecione uma imagem JPG, PNG ou WebP."); return;
    }
    if (arquivo.size === 0 || arquivo.size > 5 * 1024 * 1024) {
      setError("A imagem deve ter mais de 0 bytes e no máximo 5 MB."); return;
    }
    setOperacao("upload");
    setOperacaoId(id);
    limparMensagens();
    try {
      const imageUrl = await uploadImagemBebida(id, arquivo, request);
      setBebidas((anteriores) => anteriores.map((bebida) =>
        bebida.id === id ? { ...bebida, imageUrl } : bebida
      ));
      setArquivos((anteriores) => ({ ...anteriores, [id]: null }));
      if (arquivoInputs.current[id]) arquivoInputs.current[id]!.value = "";
      setSuccess("Imagem enviada com sucesso!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado ao enviar imagem.");
    } finally {
      setOperacao(null);
      setOperacaoId(null);
    }
  }

  function camposFormulario(form: Formulario, setForm: (form: Formulario) => void, prefixo: string) {
    return (
      <div className="bebidas-form-grid">
        <label className="bebidas-field bebidas-field-wide" htmlFor={`${prefixo}-nome`}>
          <span>Nome da bebida</span>
          <input id={`${prefixo}-nome`} type="text" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            minLength={2} maxLength={100} required disabled={ocupado} placeholder="Ex.: Coca-Cola 2L" />
        </label>
        <label className="bebidas-field" htmlFor={`${prefixo}-preco`}>
          <span>Preço (R$)</span>
          <input id={`${prefixo}-preco`} type="number" min="0.01" max="10000" step="0.01"
            value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })}
            required disabled={ocupado} placeholder="12.90" />
        </label>
        <label className="bebidas-field" htmlFor={`${prefixo}-quantidade`}>
          <span>Quantidade em estoque</span>
          <input id={`${prefixo}-quantidade`} type="number" min="0" max="100000" step="1"
            value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            required disabled={ocupado} placeholder="100" />
        </label>
        <label className="bebidas-field bebidas-field-wide" htmlFor={`${prefixo}-categoria`}>
          <span>Categoria</span>
          <select id={`${prefixo}-categoria`} value={form.categoryId}
            onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            required disabled={ocupado}>
            <option value="">Selecione uma categoria</option>
            {categorias.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>{categoria.name}</option>
            ))}
          </select>
        </label>
        <label className="bebidas-field bebidas-field-wide" htmlFor={`${prefixo}-descricao`}>
          <span>Descrição (opcional, até 1000 caracteres)</span>
          <textarea
            id={`${prefixo}-descricao`}
            rows={4}
            maxLength={limiteDescricao}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            disabled={ocupado}
          />
        </label>
      </div>
    );
  }

  return (
    <div className="bebidas-page">
      <header className="bebidas-page-header">
        <div>
          <h1>Gerenciar bebidas</h1>
          <p>Cadastre e organize os produtos da distribuidora.</p>
        </div>
        <button className="bebidas-btn bebidas-btn-primary" type="button"
          disabled={ocupado || loading || categorias.length === 0 || !!erroCarregamento}
          onClick={() => {
            if (mostrarCadastro) {
              setMostrarCadastro(false);
            } else {
              cancelarEdicao();
              setMostrarCadastro(true);
            }
            limparMensagens();
          }}>
          {mostrarCadastro ? "Fechar cadastro" : "+ Nova bebida"}
        </button>
      </header>

      {error && <p className="bebidas-alert bebidas-alert-error" role="alert">{error}</p>}
      {success && <p className="bebidas-alert bebidas-alert-success" role="status">{success}</p>}
      {erroCarregamento && <p className="bebidas-alert bebidas-alert-error" role="alert">{erroCarregamento}</p>}
      {loading && <p>Carregando produtos e categorias...</p>}

      {!loading && !erroCarregamento && categorias.length === 0 && (
        <p className="bebidas-alert bebidas-alert-error">Cadastre uma categoria antes de adicionar bebidas.</p>
      )}

      {mostrarCadastro && !loading && categorias.length > 0 && (
        <section className="bebidas-panel" aria-label="Cadastrar nova bebida">
          <h2>Nova bebida</h2>
          <form onSubmit={handleCadastrar}>
            {camposFormulario(cadastro, setCadastro, "cadastro")}

              <div className="bebidas-cadastro-imagem">
                <label
                  className="bebidas-field"
                  htmlFor="imagem-cadastro"
                >
                  <span>Imagem do produto (opcional)</span>

                  <input
                    id="imagem-cadastro"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={ocupado}
                    onChange={(e) => {
                      const arquivo = e.target.files?.[0] ?? null;
                      selecionarImagemCadastro(arquivo);
                      e.target.value = "";
                    }}
                  />
                </label>

                {previewImagem && (
                  <div className="bebidas-cadastro-preview">
                    <img
                      src={previewImagem}
                      alt="Prévia da imagem selecionada"
                    />

                    <button
                      type="button"
                      className="bebidas-btn bebidas-btn-secondary"
                      disabled={ocupado}
                      onClick={() => selecionarImagemCadastro(null)}
                    >
                      Remover imagem
                    </button>
                  </div>
                )}

                {imagemCadastro && (
                  <p className="bebidas-imagem-nome">
                    Arquivo: {imagemCadastro.name}
                  </p>
                )}
              </div>

            <div className="bebidas-actions">
              <button className="bebidas-btn bebidas-btn-primary" type="submit" disabled={ocupado || !request}>
                {operacao === "cadastro"
                  ? "Cadastrando produto e imagem..."
                  : "Cadastrar bebida"}
              </button>
              <button className="bebidas-btn bebidas-btn-secondary" type="button" disabled={ocupado}
                onClick={() => setMostrarCadastro(false)}>Cancelar</button>
            </div>
          </form>
        </section>
      )}

      {!loading && !erroCarregamento && (
        <section className="bebidas-panel" aria-label="Bebidas cadastradas">
          <div className="bebidas-list-heading">
            <div>
              <h2>Produtos cadastrados</h2>
              <p>{bebidas.length} {bebidas.length === 1 ? "produto" : "produtos"} no catálogo</p>
            </div>
            <span className="bebidas-count">{bebidasFiltradas.length} exibidos</span>
          </div>

          <div className="bebidas-filters">
            <label className="bebidas-field" htmlFor="buscar-bebidas">
              <span>Buscar por nome</span>
              <input id="buscar-bebidas" type="search" placeholder="Ex.: Coca-Cola"
                value={busca} onChange={(e) => setBusca(e.target.value)} />
            </label>
            <label className="bebidas-field" htmlFor="filtrar-categoria">
              <span>Categoria</span>
              <select id="filtrar-categoria" value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}>
                <option value="">Todas as categorias</option>
                {categorias.map((categoria) => (
                  <option key={categoria.id} value={categoria.name}>{categoria.name}</option>
                ))}
              </select>
            </label>
          </div>

          {bebidas.length === 0 ? (
            <p className="bebidas-empty">Nenhuma bebida cadastrada ainda.</p>
          ) : bebidasFiltradas.length === 0 ? (
            <p className="bebidas-empty">Nenhum produto encontrado para os filtros selecionados.</p>
          ) : (
            <div className="bebidas-list">
              {bebidasFiltradas.map((bebida) => (
                <article className="bebidas-product" key={bebida.id}>
                  <div className="bebidas-product-top">
                    <div className="bebidas-product-image">
                      {bebida.imageUrl ? (
                        <img src={bebida.imageUrl} alt={bebida.name} loading="lazy" />
                      ) : (
                        <span>Sem imagem</span>
                      )}
                    </div>
                    <div className="bebidas-product-info">
                      <h3>{bebida.name}</h3>
                      <span className="bebidas-category">{bebida.category}</span>
                      <strong className="bebidas-price">{formatarMoeda(bebida.price)}</strong>
                      <span className={bebida.quantity === 0 ? "bebidas-stock bebidas-stock-empty" : "bebidas-stock"}>
                        {bebida.quantity === 0 ? "Sem estoque" : `${bebida.quantity} unidades em estoque`}
                      </span>
                    </div>
                    <div className="bebidas-product-actions">
                      <button type="button" className="bebidas-btn bebidas-btn-secondary"
                        onClick={() => iniciarEdicao(bebida)} disabled={ocupado}>
                        Editar
                      </button>
                      <button type="button" className="bebidas-btn bebidas-btn-danger"
                        onClick={() => handleExcluir(bebida)} disabled={ocupado}>
                        {operacao === "exclusao" && operacaoId === bebida.id ? "Excluindo..." : "Excluir"}
                      </button>
                    </div>
                  </div>

                  {editandoId === bebida.id && (
                    <div className="bebidas-edit-panel">
                      <h4>Editar bebida</h4>
                      {camposFormulario(edicao, setEdicao, `editar-${bebida.id}`)}
                      <div className="bebidas-actions">
                        <button className="bebidas-btn bebidas-btn-primary" type="button"
                          onClick={() => handleSalvarEdicao(bebida.id)} disabled={ocupado || !request}>
                          {operacao === "edicao" && operacaoId === bebida.id ? "Salvando..." : "Salvar alterações"}
                        </button>
                        <button className="bebidas-btn bebidas-btn-secondary" type="button"
                          onClick={cancelarEdicao} disabled={ocupado}>Cancelar</button>
                      </div>
                    </div>
                  )}

                  <div className="bebidas-upload">
                    <label className="bebidas-field" htmlFor={`imagem-${bebida.id}`}>
                      <span>{bebida.imageUrl ? "Substituir imagem" : "Adicionar imagem"}</span>
                      <input id={`imagem-${bebida.id}`} type="file" accept="image/jpeg,image/png,image/webp"
                        ref={(element) => { arquivoInputs.current[bebida.id] = element; }}
                        disabled={ocupado}
                        onChange={(e) => {
                          const arquivo = e.target.files?.[0] ?? null;
                          setArquivos((anteriores) => ({ ...anteriores, [bebida.id]: arquivo }));
                        }} />
                    </label>
                    <button className="bebidas-btn bebidas-btn-secondary" type="button"
                      disabled={ocupado || !arquivos[bebida.id] || !request}
                      onClick={() => handleUploadImagem(bebida.id)}>
                      {operacao === "upload" && operacaoId === bebida.id ? "Enviando..." : "Enviar imagem"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useAdminMutation, useAdminQuery } from "./useAdminOperations";
import ProductImage from "../../components/ProductImage";
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
const listaVazia: Bebida[] = [];

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

const tiposImagem = ["image/jpeg", "image/png", "image/webp"];

function validarImagem(arquivo: File) {
  if (!tiposImagem.includes(arquivo.type)) return "Selecione uma imagem JPG, PNG ou WebP.";
  if (arquivo.size === 0 || arquivo.size > 5 * 1024 * 1024) {
    return "A imagem deve ter mais de 0 bytes e no máximo 5 MB.";
  }
  return "";
}

function PreviewImagem({ arquivo }: { arquivo: File }) {
  const preview = useCallback((image: HTMLImageElement | null) => {
    if (!image) return;
    const url = URL.createObjectURL(arquivo);
    image.src = url;
    return () => URL.revokeObjectURL(url);
  }, [arquivo]);

  return <img ref={preview} alt="Prévia da imagem selecionada" />;
}

export default function AdminBebidas() {
  const consultaCategorias = useAdminQuery(getCategorias);
  const consultaBebidas = useAdminQuery(getBebidas);
  const categorias = consultaCategorias.data ?? [];
  const bebidas = consultaBebidas.data ?? listaVazia;
  const loading = consultaCategorias.loading || consultaBebidas.loading;
  const erroCarregamento = consultaBebidas.error || consultaCategorias.error;

  async function consultar(revisao: boolean) {
    const [listaOk, categoriasOk] = await Promise.all([
      revisao || consultaBebidas.error ? consultaBebidas.refresh() : true,
      consultaCategorias.error ? consultaCategorias.refresh() : true,
    ]);
    return listaOk && categoriasOk;
  }

  const {
    executar, reconciliar, operacao, pendenteRevisao, limparMensagens,
    error, success, setError, setSuccess, registrarErro, ocupado,
  } = useAdminMutation(consultar, loading);
  const [mostrarCadastro, setMostrarCadastro] = useState(false);
  const [cadastro, setCadastro] = useState<Formulario>(formularioVazio);
  const [imagemCadastro, setImagemCadastro] = useState<File | null>(null);
  const [edicao, setEdicao] = useState<Formulario>(formularioVazio);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [arquivos, setArquivos] = useState<Record<number, File>>({});
  const [imagemPendenteId, setImagemPendenteId] = useState<number | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const categoriaFiltrada = categorias.find((item) => String(item.id) === filtroCategoria)?.name;
  const bebidaPendente = bebidas.find((item) => item.id === imagemPendenteId);

  useEffect(() => {
    if (mostrarCadastro) document.getElementById("cadastro-nome")?.focus();
    if (editandoId !== null) document.getElementById(`editar-${editandoId}-nome`)?.focus();
  }, [mostrarCadastro, editandoId]);

  const bebidasFiltradas = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return bebidas.filter((bebida) =>
      bebida.name.toLocaleLowerCase("pt-BR").includes(termo) &&
      (!categoriaFiltrada || bebida.category === categoriaFiltrada)
    );
  }, [bebidas, busca, categoriaFiltrada]);

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
    if (editandoId !== null) document.getElementById(`editar-bebida-${editandoId}`)?.focus();
    setEditandoId(null);
    setEdicao(formularioVazio);
  }


  function selecionarImagemCadastro(arquivo: File | null) {
    if (ocupado) return;
    const erro = arquivo ? validarImagem(arquivo) : "";
    if (!erro) setImagemCadastro(arquivo);
    setError(erro);
  }

  function selecionarArquivo(id: number, arquivo: File | null) {
    if (ocupado || !arquivo) return;
    const erro = validarImagem(arquivo);
    if (!erro) setArquivos((anteriores) => ({ ...anteriores, [id]: arquivo }));
    setError(erro);
  }

  function removerArquivo(id: number) {
    setArquivos((anteriores) => {
      const restantes = { ...anteriores };
      delete restantes[id];
      return restantes;
    });
    setImagemPendenteId((pendente) => pendente === id ? null : pendente);
  }

  function handleCadastrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    return executar("cadastro", undefined, async (request, current) => {
      let dados: CreateBebida;
      try {
        dados = validarFormulario(cadastro, categorias);
      } catch (err) {
        if (err instanceof Error) setError(err.message);
        return;
      }

      const id = await criarBebida(dados, request);
      if (!current()) return;
      setCadastro(formularioVazio);
      setImagemCadastro(null);
      setMostrarCadastro(false);
      setSuccess("Bebida cadastrada com sucesso!");

      if (imagemCadastro && id !== null) {
        try {
          await uploadImagemBebida(id, imagemCadastro, request);
          if (!current()) return;
          setSuccess("Bebida e imagem cadastradas com sucesso!");
        } catch (err) {
          if (!current()) return;
          setArquivos((anteriores) => ({ ...anteriores, [id]: imagemCadastro }));
          setImagemPendenteId(id);
          registrarErro(err, `A bebida foi cadastrada (ID ${id}), mas o envio da imagem não foi confirmado.`);
        }
      } else if (imagemCadastro) {
        setError("A bebida foi cadastrada, mas faltou o identificador para enviar a imagem. Localize a bebida na lista e selecione a imagem novamente.");
      }

      await consultaBebidas.refresh();
    });
  }

  function handleSalvarEdicao(id: number) {
    return executar("edicao", id, async (request, current) => {
      let dados: CreateBebida;
      try {
        dados = validarFormulario(edicao, categorias);
      } catch (err) {
        if (err instanceof Error) setError(err.message);
        return;
      }
      await atualizarBebida(id, dados, request);
      if (!current()) return;
      cancelarEdicao();
      setSuccess("Bebida atualizada com sucesso!");
      await consultaBebidas.refresh();
    });
  }

  function handleExcluir(bebida: Bebida) {
    return executar("exclusao", bebida.id, async (request, current) => {
      await excluirBebida(bebida.id, request);
      if (!current()) return;
      consultaBebidas.setData((lista) => lista?.filter((item) => item.id !== bebida.id));
      removerArquivo(bebida.id);
      if (editandoId === bebida.id) cancelarEdicao();
      setSuccess(`Bebida "${bebida.name}" excluída com sucesso!`);
    }, () => window.confirm(`Tem certeza que deseja excluir "${bebida.name}"?\n\nO produto será removido do catálogo.`));
  }

  function handleUploadImagem(id: number) {
    return executar("upload", id, async (request, current) => {
      const arquivo = arquivos[id];
      if (!arquivo) return;
      await uploadImagemBebida(id, arquivo, request);
      if (!current()) return;
      removerArquivo(id);
      setSuccess("Imagem enviada com sucesso!");
      await consultaBebidas.refresh();
    });
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
        <button className="bebidas-btn bebidas-btn-primary" type="button" id="nova-bebida" aria-expanded={mostrarCadastro}
          disabled={ocupado || categorias.length === 0}
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
      {erroCarregamento && <p className="bebidas-alert bebidas-alert-error" role="alert">Falha ao atualizar a listagem. {erroCarregamento}</p>}
      {(erroCarregamento || pendenteRevisao) && (
        <button type="button" className="bebidas-btn bebidas-btn-secondary" disabled={loading || !!operacao}
          onClick={reconciliar}>Consultar dados atualizados</button>
      )}
      {imagemPendenteId !== null && arquivos[imagemPendenteId] && (
        <div className="bebidas-cadastro-preview">
          <PreviewImagem arquivo={arquivos[imagemPendenteId]} />
          <p>Imagem pendente para {bebidaPendente?.name ?? `bebida #${imagemPendenteId}`}.</p>
          <button type="button" className="bebidas-btn bebidas-btn-secondary"
            disabled={ocupado || !bebidaPendente} onClick={() => handleUploadImagem(imagemPendenteId)}>
            {operacao?.tipo === "upload" && operacao.id === imagemPendenteId ? "Enviando..." : "Reenviar imagem"}
          </button>
          <button type="button" className="bebidas-btn bebidas-btn-secondary"
            disabled={ocupado} onClick={() => removerArquivo(imagemPendenteId)}>Descartar imagem</button>
        </div>
      )}
      {operacao && <p role="status">Processando operação…</p>}
      {loading && <p role="status">Carregando produtos e categorias...</p>}

      {!loading && !erroCarregamento && categorias.length === 0 && (
        <p className="bebidas-alert bebidas-alert-error">Cadastre uma categoria antes de adicionar bebidas.</p>
      )}

      {mostrarCadastro && (
        <section className="bebidas-panel" aria-label="Cadastrar nova bebida">
          <h2>Nova bebida</h2>
          <form onSubmit={handleCadastrar} onKeyDown={(e) => {
            if (e.key === "Escape" && !ocupado) {
              setMostrarCadastro(false);
              document.getElementById("nova-bebida")?.focus();
            }
          }}>
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

                {imagemCadastro && (
                  <div className="bebidas-cadastro-preview">
                    <PreviewImagem arquivo={imagemCadastro} />

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
              <button className="bebidas-btn bebidas-btn-primary" type="submit" disabled={ocupado}>
                {operacao?.tipo === "cadastro"
                  ? "Processando cadastro..."
                  : "Cadastrar bebida"}
              </button>
              <button className="bebidas-btn bebidas-btn-secondary" type="button" disabled={ocupado}
                onClick={() => { setMostrarCadastro(false); document.getElementById("nova-bebida")?.focus(); }}>Cancelar</button>
            </div>
          </form>
        </section>
      )}

      {consultaBebidas.data && (
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
              <select id="filtrar-categoria" value={categorias.some((item) => String(item.id) === filtroCategoria) ? filtroCategoria : ""}
                onChange={(e) => setFiltroCategoria(e.target.value)}>
                <option value="">Todas as categorias</option>
                {categorias.map((categoria) => (
                  <option key={categoria.id} value={categoria.id}>{categoria.name}</option>
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
                      <ProductImage src={bebida.imageUrl} alt={bebida.name} profile="admin" placeholder="Sem imagem" />
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
                        id={`editar-bebida-${bebida.id}`} onClick={() => iniciarEdicao(bebida)} disabled={ocupado}>
                        Editar
                      </button>
                      <button type="button" className="bebidas-btn bebidas-btn-danger"
                        onClick={() => handleExcluir(bebida)} disabled={ocupado} aria-label={`Excluir ${bebida.name}`}>
                        {operacao?.tipo === "exclusao" && operacao.id === bebida.id ? "Excluindo..." : "Excluir"}
                      </button>
                    </div>
                  </div>

                  {editandoId === bebida.id && (
                    <form className="bebidas-edit-panel" onSubmit={(e) => { e.preventDefault(); void handleSalvarEdicao(bebida.id); }}
                      onKeyDown={(e) => { if (e.key === "Escape" && !ocupado) cancelarEdicao(); }}>
                      <h4>Editar bebida</h4>
                      {camposFormulario(edicao, setEdicao, `editar-${bebida.id}`)}
                      <div className="bebidas-actions">
                        <button className="bebidas-btn bebidas-btn-primary" type="submit" disabled={ocupado}>
                          {operacao?.tipo === "edicao" && operacao.id === bebida.id ? "Salvando..." : "Salvar alterações"}
                        </button>
                        <button className="bebidas-btn bebidas-btn-secondary" type="button"
                          onClick={cancelarEdicao} disabled={ocupado}>Cancelar</button>
                      </div>
                    </form>
                  )}

                  <div className="bebidas-upload">
                    <label className="bebidas-field" htmlFor={`imagem-${bebida.id}`}>
                      <span>{bebida.imageUrl ? "Substituir imagem" : "Adicionar imagem"}</span>
                      <input id={`imagem-${bebida.id}`} type="file" accept="image/jpeg,image/png,image/webp"
                        disabled={ocupado}
                        onChange={(e) => {
                          const arquivo = e.target.files?.[0] ?? null;
                          selecionarArquivo(bebida.id, arquivo);
                          e.target.value = "";
                        }} />
                    </label>
                    {arquivos[bebida.id] && (
                      <div className="bebidas-cadastro-preview">
                        <PreviewImagem arquivo={arquivos[bebida.id]} />
                        <span>{arquivos[bebida.id].name}</span>
                        <button className="bebidas-btn bebidas-btn-secondary" type="button"
                          disabled={ocupado} onClick={() => removerArquivo(bebida.id)}>Remover seleção</button>
                      </div>
                    )}
                    <button className="bebidas-btn bebidas-btn-secondary" type="button"
                      disabled={ocupado || !arquivos[bebida.id]}
                      onClick={() => handleUploadImagem(bebida.id)}>
                      {operacao?.tipo === "upload" && operacao.id === bebida.id ? "Enviando..." : "Enviar imagem"}
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

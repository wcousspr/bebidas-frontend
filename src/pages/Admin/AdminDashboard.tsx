
import { useAdminQuery } from "./useAdminOperations";
import { Link } from "react-router-dom";

import { getBebidas } from "../../services/bebidasService";
import { getCategorias } from "../../services/categoriasService";

import "./AdminDashboard.css";

export default function AdminDashboard() {
  const produtos = useAdminQuery(getBebidas);
  const categorias = useAdminQuery(getCategorias);
  const bebidas = produtos.data ?? [];
  const totalProdutos = bebidas.length;
  const totalCategorias = categorias.data?.length;

  const unidadesEstoque = bebidas.reduce(
    (total, bebida) => total + bebida.quantity,
    0
  );

  const valorEstoque = bebidas.reduce(
    (total, bebida) => total + bebida.price * bebida.quantity,
    0
  );

  const formatarMoeda = (valor: number) =>
    valor.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

  return (
    <div className="admin-dashboard">
      <div className="admin-content">
        <div className="admin-heading">
          <h2>Visão geral</h2>
          <p>Acompanhe os dados da distribuidora.</p>
        </div>

        {(produtos.loading || categorias.loading) && <p role="status">Carregando indicadores...</p>}
        {produtos.error && (
          <div>
            <p role="alert" className="admin-error">Indicadores de bebidas indisponíveis. {produtos.error}</p>
            <button type="button" onClick={produtos.refresh}>Consultar bebidas novamente</button>
          </div>
        )}
        {categorias.error && (
          <div>
            <p role="alert" className="admin-error">Total de categorias indisponível. {categorias.error}</p>
            <button type="button" onClick={categorias.refresh}>Consultar categorias novamente</button>
          </div>
        )}

        <section className="admin-stats" aria-label="Indicadores">
          <div className="admin-stat-card">
            <span>Produtos cadastrados</span>
            <strong>{produtos.data ? totalProdutos : "—"}</strong>
          </div>

          <div className="admin-stat-card">
            <span>Categorias</span>
            <strong>{totalCategorias ?? "—"}</strong>
          </div>

          <div className="admin-stat-card">
            <span>Unidades em estoque</span>
            <strong>{produtos.data ? unidadesEstoque : "—"}</strong>
          </div>

          <div className="admin-stat-card">
            <span>Valor do estoque</span>
            <strong>{produtos.data ? formatarMoeda(valorEstoque) : "—"}</strong>
          </div>
        </section>

        <section className="admin-management">
          <h2>Gerenciamento</h2>

          <div className="admin-management-grid">
            <Link
              to="/admin/bebidas"
              className="admin-management-card"
            >
              <h3>Gerenciar bebidas</h3>
              <p>
                Cadastre, edite e exclua produtos.
                Gerencie preços, estoque e imagens.
              </p>
              <span>Acessar bebidas →</span>
            </Link>

            <Link
              to="/admin/categorias"
              className="admin-management-card"
            >
              <h3>Gerenciar categorias</h3>
              <p>
                Organize os produtos cadastrados
                em categorias.
              </p>
              <span>Acessar categorias →</span>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

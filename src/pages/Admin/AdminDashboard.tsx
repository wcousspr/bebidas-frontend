
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getBebidas, type Bebida } from "../../services/bebidasService";
import {
  getCategorias,
  type Categoria,
} from "../../services/categoriasService";

import "./AdminDashboard.css";

export default function AdminDashboard() {
  const [bebidas, setBebidas] = useState<Bebida[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let ativo = true;

    async function carregarDados() {
      try {
        const [dadosBebidas, dadosCategorias] = await Promise.all([
          getBebidas(),
          getCategorias(),
        ]);

        if (!ativo) return;

        setBebidas(dadosBebidas);
        setCategorias(dadosCategorias);
      } catch {
        if (ativo) {
          setError("Não foi possível carregar os indicadores.");
        }
      } finally {
        if (ativo) {
          setLoading(false);
        }
      }
    }

    carregarDados();

    return () => {
      ativo = false;
    };
  }, []);

  const totalProdutos = bebidas.length;
  const totalCategorias = categorias.length;

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
      <main className="admin-content">
        <div className="admin-heading">
          <h2>Visão geral</h2>
          <p>Acompanhe os dados da distribuidora.</p>
        </div>

        {loading ? (
          <p>Carregando indicadores...</p>
        ) : error ? (
          <p role="alert" className="admin-error">
            {error}
          </p>
        ) : (
          <section className="admin-stats">
            <div className="admin-stat-card">
              <span>Produtos cadastrados</span>
              <strong>{totalProdutos}</strong>
            </div>

            <div className="admin-stat-card">
              <span>Categorias</span>
              <strong>{totalCategorias}</strong>
            </div>

            <div className="admin-stat-card">
              <span>Unidades em estoque</span>
              <strong>{unidadesEstoque}</strong>
            </div>

            <div className="admin-stat-card">
              <span>Valor do estoque</span>
              <strong>{formatarMoeda(valorEstoque)}</strong>
            </div>
          </section>
        )}

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
      </main>
    </div>
  );
}


import { useEffect, useState } from "react";
import ProductCard from "../../components/ProductCard/ProductCard";
import { getPublicCatalog } from "../../services/product";
import type { Product } from "../../types/Product";
import "./Home.css";

interface HomeProps {
  search: string;
}

export default function Home({ search }: HomeProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadProducts() {
      try {
        const data = await getPublicCatalog(controller.signal);

        if (!controller.signal.aborted) {
          setProducts(data);
        }
      } catch (err) {
        if (!controller.signal.aborted) console.error("Erro ao carregar bebidas:", err);

        if (!controller.signal.aborted) {
          setError("Não foi possível carregar as bebidas.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadProducts();

    return () => {
      controller.abort();
    };
  }, []);

  const categories = [
    "Todas",
    ...new Set(products.map((product) => product.category)),
  ];

  const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");

  const filteredProducts = products.filter((product) => {
    const matchesCategory =
      selectedCategory === "Todas" ||
      product.category === selectedCategory;

    const matchesSearch = product.name
      .toLocaleLowerCase("pt-BR")
      .includes(normalizedSearch);

    return matchesCategory && matchesSearch;
  });

  return (
    <section className="home">
      <div className="home-heading">
        <div>
          <h1>Explore nossas bebidas</h1>
          <p>Encontre sua bebida favorita.</p>
        </div>

        {!loading && !error && (
          <span className="product-count">
            {filteredProducts.length} produtos
          </span>
        )}
      </div>

      {loading && <p>Carregando bebidas...</p>}

      {error && <p role="alert">{error}</p>}

      {!loading && !error && (
        <>
          <div
            className="category-filters"
            aria-label="Filtrar categorias"
          >
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                className={`category-filter ${
                  selectedCategory === category ? "active" : ""
                }`}
                aria-pressed={selectedCategory === category}
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>

          {filteredProducts.length === 0 ? (
            <p>Nenhuma bebida encontrada.</p>
          ) : (
            <div className="products-grid">
              {filteredProducts.map((product, index) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  eagerlyLoadImage={index === 0}
                />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

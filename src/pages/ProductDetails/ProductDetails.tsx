
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ProductCard from "../../components/ProductCard/ProductCard";
import { getProducts } from "../../services/product";
import { useCart } from "../../contexts/useCart";
import type { Product } from "../../types/Product";
import "./ProductDetails.css";

export default function ProductDetails() {
  const { id } = useParams<{ id: string }>();
  const { addToCart, items } = useCart();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadProducts() {
      try {
        const products = await getProducts();

        if (active) {
          setProducts(products);
        }
      } catch {
        if (active) {
          setError("Não foi possível carregar o produto.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadProducts();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [id]);

  const product = products.find((item) => item.id === Number(id));

  if (loading) {
    return <main className="product-details-status">Carregando produto...</main>;
  }

  if (error || !product) {
    return (
      <main className="product-details-status">
        <p>{error || "Produto não encontrado."}</p>
        <Link to="/">Voltar ao catálogo</Link>
      </main>
    );
  }

  const description = product.description?.trim();
  const relatedProducts = products
    .filter((item) => item.id !== product.id && item.category === product.category)
    .sort((first, second) => Number(second.quantity > 0) - Number(first.quantity > 0))
    .slice(0, 4);
  const quantityInCart =
    items.find((item) => item.product.id === product.id)
      ?.quantity ?? 0;

  const canAdd =
    product.quantity > 0 &&
    quantityInCart < product.quantity;

  function handleAddToCart() {
    if (!product || !canAdd) return;

    addToCart(product);
    window.dispatchEvent(new Event("open-cart"));
  }

  return (
    <main className="product-details-page">
      <Link to="/" className="product-details-back">
        ← Voltar ao catálogo
      </Link>

      <div className="product-details-layout">
        <div className="product-details-image">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} />
          ) : (
            <span>🥤</span>
          )}
        </div>

        <div className="product-details-info">
          <span className="product-details-category">
            {product.category}
          </span>

          <h1>{product.name}</h1>

          <strong className="product-details-price">
            {product.price.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          </strong>

          <p className="product-details-stock">
            {product.quantity > 0
              ? `${product.quantity} unidades disponíveis`
              : "Produto indisponível"}
          </p>

          <button
            type="button"
            className="product-details-add"
            onClick={handleAddToCart}
            disabled={!canAdd}
          >
            {product.quantity === 0
              ? "Indisponível"
              : !canAdd
                ? "Limite de estoque no carrinho"
                : "Adicionar ao carrinho"}
          </button>

          {description && (
            <section className="product-details-description">
              <h2>Sobre o produto</h2>
              <p>{description}</p>
            </section>
          )}
        </div>
      </div>

      {relatedProducts.length > 0 && (
        <section className="product-details-related" aria-labelledby="related-products-title">
          <h2 id="related-products-title">Você também pode gostar</h2>
          <div className="product-details-related-grid">
            {relatedProducts.map((relatedProduct) => (
              <ProductCard key={relatedProduct.id} product={relatedProduct} showCartAction={false} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

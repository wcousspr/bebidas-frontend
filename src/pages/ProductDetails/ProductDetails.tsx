
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ProductCard from "../../components/ProductCard/ProductCard";
import ProductImage from "../../components/ProductImage";
import { siteConfig } from "../../config/site";
import { getPublicCatalog } from "../../services/product";
import { useCart } from "../../contexts/useCart";
import type { Product } from "../../types/Product";
import ShareProduct from "./ShareProduct";
import "./ProductDetails.css";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default function ProductDetails() {
  const { id } = useParams<{ id: string }>();
  const { addToCart, items } = useCart();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadProducts() {
      try {
        const products = await getPublicCatalog(controller.signal);

        if (!controller.signal.aborted) {
          setProducts(products);
        }
      } catch {
        if (!controller.signal.aborted) {
          setError("Não foi possível carregar o produto.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadProducts();

    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [id]);

  const product = products.find((item) => item.id === Number(id));
  const description = product?.description?.trim();
  const price = product ? currency.format(product.price) : "";

  useEffect(() => {
    if (!product) return;

    const metaDescription = document.head.querySelector<HTMLMetaElement>('meta[name="description"]');
    const previousTitle = document.title;
    const previousDescription = metaDescription?.content ?? "";
    const summary = description?.replace(/\s+/g, " ");
    const excerpt = summary && summary.length > 140
      ? `${summary.slice(0, 140).replace(/\s+\S*$/, "")}…`
      : summary;

    document.title = `${product.name} | ${siteConfig.name}`;
    if (metaDescription) {
      metaDescription.content = `${product.name} — ${price}. ${excerpt || "Confira a disponibilidade no catálogo do Código dos Bares."}`;
    }

    return () => {
      document.title = previousTitle;
      if (metaDescription) metaDescription.content = previousDescription;
    };
  }, [product, description, price]);

  if (loading) {
    return <main className="product-details-status">Carregando produto...</main>;
  }

  if (error || !product) {
    return (
      <main className="product-details-status">
        {!error && <meta name="robots" content="noindex" />}
        <p>{error || "Produto não encontrado."}</p>
        <Link to="/">Voltar ao catálogo</Link>
      </main>
    );
  }

  const productUrl = new URL(`/produto/${product.id}`, siteConfig.publicOrigin).href;
  const shareUrl = `${siteConfig.apiUrl.replace(/\/+$/, "")}/compartilhar/produto/${product.id}`;
  const relatedProducts = products
    .filter((item) => item.id !== product.id && item.category === product.category)
    .sort((first, second) => Number(second.quantity > 0) - Number(first.quantity > 0))
    .slice(0, 4);
  const quantityInCart =
    items.find((item) => item.productId === product.id)
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
      <link rel="canonical" href={productUrl} />
      <Link to="/" className="product-details-back">
        ← Voltar ao catálogo
      </Link>

      <div className="product-details-layout">
        <div className="product-details-image">
          <ProductImage key={product.id} src={product.imageUrl} alt={product.name} profile="detail" />
        </div>

        <div className="product-details-info">
          <span className="product-details-category">
            {product.category}
          </span>

          <h1>{product.name}</h1>

          <strong className="product-details-price">{price}</strong>

          <p className="product-details-stock" data-in-stock={product.quantity > 0}>
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
            {product.quantity <= 0
              ? "Indisponível"
              : !canAdd
                ? "Limite de estoque no carrinho"
                : "Adicionar ao carrinho"}
          </button>

          <ShareProduct key={product.id} name={product.name} price={price} url={shareUrl} />

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
          <div className="products-grid">
            {relatedProducts.map((relatedProduct) => (
              <ProductCard key={relatedProduct.id} product={relatedProduct} showCartAction={false} imageProfile="related" />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

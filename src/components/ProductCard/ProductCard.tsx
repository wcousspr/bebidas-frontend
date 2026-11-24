
import type { Product } from "../../types/Product";
import { useCart } from "../../contexts/useCart";
import ProductImage from "../ProductImage";
import "./ProductCard.css";
import { Link } from "react-router-dom";

interface ProductCardProps {
  product: Product;
  showCartAction?: boolean;
  imageProfile?: "catalog" | "related";
  eagerlyLoadImage?: boolean;
}

export default function ProductCard({
  product,
  showCartAction = true,
  imageProfile = "catalog",
  eagerlyLoadImage = false,
}: ProductCardProps) {
  const { items, addToCart } = useCart();

  const formattedPrice = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(product.price);

  const cartItem = items.find(
    (item) => item.productId === product.id
  );

  const quantityInCart = cartItem?.quantity ?? 0;

  const outOfStock = product.quantity <= 0;
  const reachedLimit = quantityInCart >= product.quantity;
  const disabled = outOfStock || reachedLimit;
  return (
    <article className="product-card">
      <Link
        to={`/produto/${product.id}`}
        className="product-image-link"
        aria-label={`Ver detalhes de ${product.name}`}
      >
        <div className="product-image">
          <ProductImage
            src={product.imageUrl}
            alt={product.name}
            profile={imageProfile}
            eager={eagerlyLoadImage}
            placeholderClassName="product-placeholder"
          />
        </div>
      </Link>

      <div className="product-info">
        <span className="product-category">
          {product.category}
        </span>

        <Link to={`/produto/${product.id}`} className="product-name-link">
          <h3>{product.name}</h3>
        </Link>

        <div className="product-footer">
          <strong>{formattedPrice}</strong>

          {showCartAction && (
            <button
              type="button"
              className="add-product-button"
              onClick={() => {
                addToCart(product);
                window.dispatchEvent(new Event("open-cart"));
              }}
              disabled={disabled}
              title={
                outOfStock
                  ? "Produto sem estoque"
                  : reachedLimit
                    ? "Limite de estoque atingido"
                    : "Adicionar ao carrinho"
              }
              aria-label={`Adicionar ${product.name} ao carrinho`}
            >
              +
            </button>
          )}
        </div>

        <p className="product-stock-message" data-in-stock={!outOfStock}>
          {outOfStock
            ? "Indisponível"
            : showCartAction && quantityInCart > 0
              ? `${quantityInCart} no carrinho`
              : "Em estoque"}
        </p>
      </div>
    </article>
  );
}

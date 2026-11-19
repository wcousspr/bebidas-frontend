
import { useEffect, useState } from "react";
import { Link, useMatch } from "react-router-dom";
import { siteConfig } from "../../config/site";
import { useCart } from "../../contexts/useCart";
import Cart from "../Cart/Cart";
import "./Header.css";
interface HeaderProps {
  search: string;
  onSearchChange: (value: string) => void;
}

export default function Header({
  search,
  onSearchChange,
}: HeaderProps) {
  const [cartOpen, setCartOpen] = useState(false);
  const isCatalog = useMatch("/");

  const { totalItems } = useCart();

  useEffect(() => {
    function abrirCarrinho() {
      setCartOpen(true);
    }

    window.addEventListener("open-cart", abrirCarrinho);
    return () => window.removeEventListener("open-cart", abrirCarrinho);
  }, []);

  return (
    <>
      <header className="header">
        <div className="header-container">
          <Link to="/" className="header-logo">
            <span className="logo-symbol">CB</span>

            <div className="logo-text">
              <strong>{siteConfig.name}</strong>
              <small>{siteConfig.description}</small>
            </div>
          </Link>

          {isCatalog && (
            <div className="header-search">
              <input
                type="search"
                placeholder="O que você procura?"
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                aria-label="Pesquisar bebidas"
              />
              <span aria-hidden="true">⌕</span>
            </div>
          )}

          <button
            className="cart-button"
            type="button"
            aria-label={`Abrir carrinho com ${totalItems} itens`}
            onClick={() => setCartOpen(true)}
          >
            🛒
            {totalItems > 0 && <span className="cart-badge">{totalItems}</span>}
          </button>
        </div>
      </header>

      {cartOpen && (
        <Cart onClose={() => setCartOpen(false)} />
      )}
    </>
  );
}

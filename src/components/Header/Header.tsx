
import { useEffect, useState } from "react";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  const { totalItems } = useCart();

  useEffect(() => {
  function abrirCarrinho() {
    setCartOpen(true);
  }

  window.addEventListener("open-cart", abrirCarrinho);

  return () => {
    window.removeEventListener("open-cart", abrirCarrinho);
  };
}, []);

  return (
    <>
      <header className="header">
        <div className="header-container">
          <a href="/" className="header-logo">
            <span className="logo-symbol">CB</span>

            <div className="logo-text">
              <strong>{siteConfig.name}</strong>
              <small>{siteConfig.description}</small>
            </div>
          </a>

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

          <div className="header-actions">
            <button
              className="cart-button"
              type="button"
              aria-label={`Abrir carrinho com ${totalItems} itens`}
              onClick={() => setCartOpen(true)}
            >
              🛒

              {totalItems > 0 && (
                <span className="cart-badge">
                  {totalItems}
                </span>
              )}
            </button>

            <button
              className="menu-button"
              type="button"
              aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              ☰
            </button>
          </div>
        </div>
      </header>

      {cartOpen && (
        <Cart onClose={() => setCartOpen(false)} />
      )}
    </>
  );
}

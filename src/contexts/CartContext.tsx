
import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import type { Product } from "../types/Product";
import { getProducts } from "../services/product";
import { CartContext, type CartItem } from "./CartContextDefinition";

const STORAGE_KEY = "codigo-dos-bares-cart";

function loadSavedCart(): CartItem[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) return [];

    const parsed: unknown = JSON.parse(saved);

    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (item): item is CartItem =>
        typeof item === "object" &&
        item !== null &&
        typeof item.quantity === "number" &&
        Number.isInteger(item.quantity) &&
        item.quantity > 0 &&
        typeof item.product === "object" &&
        item.product !== null &&
        typeof item.product.id === "number" &&
        typeof item.product.name === "string" &&
        typeof item.product.price === "number" &&
        Number.isFinite(item.product.price) &&
        item.product.price >= 0 &&
        typeof item.product.quantity === "number" &&
        Number.isInteger(item.product.quantity) &&
        item.product.quantity >= 0
    );
  } catch {
    return [];
  }
}

export function CartProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [items, setItems] = useState<CartItem[]>(loadSavedCart);
  const [syncing, setSyncing] = useState(false);

  // Salvar carrinho no localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      console.warn("Não foi possível salvar o carrinho.");
    }
  }, [items]);

  // Sincronizar carrinho com a API
  const syncCart = useCallback(async () => {
    setSyncing(true);

    try {
      const produtosAtuais = await getProducts();

      setItems((current) =>
        current.flatMap((item) => {
          const produtoAtual = produtosAtuais.find(
            (produto) => produto.id === item.product.id
          );

          // Produto excluído ou sem estoque
          if (!produtoAtual || produtoAtual.quantity <= 0) {
            return [];
          }

          // Atualizar preço, nome, imagem e estoque
          return [
            {
              product: produtoAtual,
              quantity: Math.min(
                item.quantity,
                produtoAtual.quantity
              ),
            },
          ];
        })
      );
    } catch (err) {
      console.error("Erro ao sincronizar carrinho:", err);
    } finally {
      setSyncing(false);
    }
  }, []);

  // Sincronizar automaticamente ao carregar o site
  // Sincronizar automaticamente ao carregar o site
useEffect(() => {
  const controller = new AbortController();

  async function sincronizarAoIniciar() {
    try {
      const produtosAtuais = await getProducts();

      if (controller.signal.aborted) return;

      setItems((current) =>
        current.flatMap((item) => {
          const produtoAtual = produtosAtuais.find(
            (produto) => produto.id === item.product.id
          );

          if (!produtoAtual || produtoAtual.quantity <= 0) {
            return [];
          }

          return [
            {
              product: produtoAtual,
              quantity: Math.min(
                item.quantity,
                produtoAtual.quantity
              ),
            },
          ];
        })
      );
    } catch (err) {
      if (!controller.signal.aborted) {
        console.error("Erro ao sincronizar carrinho:", err);
      }
    }
  }

  void sincronizarAoIniciar();

  return () => {
    controller.abort();
  };
}, []);

  // Adicionar produto ao carrinho
  function addToCart(product: Product) {
    if (product.quantity <= 0) return;

    setItems((current) => {
      const existing = current.find(
        (item) => item.product.id === product.id
      );

      if (existing) {
        const nextQuantity = Math.min(
          existing.quantity + 1,
          product.quantity
        );

        return current.map((item) =>
          item.product.id === product.id
            ? { product, quantity: nextQuantity }
            : item
        );
      }

      return [
        ...current,
        {
          product,
          quantity: 1,
        },
      ];
    });
  }

  // Remover produto completamente
  function removeFromCart(productId: number) {
    setItems((current) =>
      current.filter(
        (item) => item.product.id !== productId
      )
    );
  }

  // Diminuir quantidade
  function decreaseQuantity(productId: number) {
    setItems((current) =>
      current
        .map((item) =>
          item.product.id === productId
            ? {
                ...item,
                quantity: item.quantity - 1,
              }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  // Esvaziar carrinho
  function clearCart() {
    setItems([]);
  }

  // Quantidade total de unidades
  const totalItems = items.reduce(
    (total, item) => total + item.quantity,
    0
  );

  // Valor total do carrinho
  const totalPrice = items.reduce(
    (total, item) =>
      total + item.product.price * item.quantity,
    0
  );

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        decreaseQuantity,
        clearCart,
        syncCart,
        syncing,
        totalItems,
        totalPrice,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { Product } from "../types/Product";
import { siteConfig } from "../config/site";
import { getPublicCatalog, invalidateCatalog } from "../services/product";
import { CartContext, type CartSyncStatus } from "./CartContextDefinition";
import {
  addCartItem, indexProducts, needsStockReview, readCart, reconcileCart, rememberCatalog,
  serializeCart, type CartItem, type KnownProducts,
} from "./cartState";

const STORAGE_KEY = "codigo-dos-bares-cart";

function loadSavedCart() {
  try {
    return { ...readCart(localStorage.getItem(STORAGE_KEY)), storageError: false };
  } catch {
    return { ...readCart(null), storageError: true };
  }
}

interface CartState {
  items: CartItem[];
  catalog: KnownProducts | null;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [saved] = useState(loadSavedCart);
  const [{ items }, setCart] = useState<CartState>({ items: saved.items, catalog: null });
  const [syncStatus, setSyncStatus] = useState<CartSyncStatus>(saved.items.length ? "syncing" : "idle");
  const [storageError, setStorageError] = useState(saved.storageError);
  const lastSaved = useRef(saved.lastSaved);
  const activeSync = useRef<AbortController | null>(null);
  const syncVersion = useRef(0);
  const serialized = serializeCart(items);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active || serialized === lastSaved.current) return;
      try {
        localStorage.setItem(STORAGE_KEY, serialized);
        lastSaved.current = serialized;
        setStorageError(false);
      } catch {
        setStorageError(true);
      }
    });
    return () => { active = false; };
  }, [serialized]);

  const requestSync = useCallback(async () => {
    activeSync.current?.abort();
    const controller = new AbortController();
    activeSync.current = controller;
    const version = ++syncVersion.current;

    const timeout = window.setTimeout(() => {
      if (activeSync.current !== controller) return;
      activeSync.current = null;
      controller.abort();
      setSyncStatus("error");
    }, siteConfig.checkoutTimeoutMs);

    try {
      const products = await getPublicCatalog(controller.signal);
      if (activeSync.current !== controller) return;

      const catalog = indexProducts(products);
      setCart((current) => syncVersion.current === version ? {
        catalog: rememberCatalog(catalog, current.catalog, current.items),
        items: reconcileCart(current.items, catalog),
      } : current);
      setSyncStatus("ready");
    } catch {
      if (activeSync.current === controller) setSyncStatus("error");
    } finally {
      window.clearTimeout(timeout);
      if (activeSync.current === controller) activeSync.current = null;
    }
  }, []);

  useEffect(() => {
    if (saved.items.length) void requestSync();

    return () => {
      activeSync.current?.abort();
      activeSync.current = null;
    };
  }, [saved, requestSync]);

  function syncCart() {
    invalidateCatalog();
    setSyncStatus("syncing");
    return requestSync();
  }

  function beginCheckoutValidation(expected: CartItem[]) {
    if (activeSync.current) return null;
    const version = ++syncVersion.current;
    return {
      apply(validated: CartItem[], catalog: ReadonlyMap<number, Product>) {
        if (syncVersion.current !== version) return false;
        setCart((current) => current.items === expected && syncVersion.current === version ? {
          items: validated,
          catalog: rememberCatalog(catalog, current.catalog, expected),
        } : current);
        setSyncStatus("ready");
        return true;
      },
      fail() {
        if (syncVersion.current === version) setSyncStatus("stale");
      },
    };
  }

  function updateItems(update: (items: CartItem[]) => CartItem[]) {
    setCart((current) => ({ ...current, items: update(current.items) }));
  }

  function addToCart(product: Product) {
    setCart((current) => {
      const items = addCartItem(current.items, current.catalog, product);
      return items === current.items ? current : { ...current, items };
    });
  }

  function removeFromCart(productId: number) {
    updateItems((current) => current.filter((item) => item.productId !== productId));
  }

  function decreaseQuantity(productId: number) {
    updateItems((current) => current.flatMap((item) => {
      if (item.productId !== productId) return [item];
      return item.quantity > 1 ? [{ ...item, quantity: item.quantity - 1 }] : [];
    }));
  }

  function adjustToStock(productId: number) {
    updateItems((current) => current.map((item) =>
      item.productId === productId && item.product && needsStockReview(item)
        ? { ...item, quantity: item.product.quantity }
        : item
    ));
  }

  function acceptPriceChanges() {
    updateItems((current) => current.map((item) =>
      item.previousPrice === undefined ? item : { ...item, previousPrice: undefined }
    ));
  }

  const canShowTotal = syncStatus === "ready" && items.every((item) =>
    item.availability === "available" && !needsStockReview(item)
  );

  return (
    <CartContext.Provider value={{
      items,
      addToCart,
      removeFromCart,
      decreaseQuantity,
      adjustToStock,
      clearCart: () => updateItems(() => []),
      syncCart,
      syncStatus,
      storageError,
      acceptPriceChanges,
      beginCheckoutValidation,
      totalItems: items.reduce((total, item) => total + item.quantity, 0),
      totalPrice: canShowTotal
        ? items.reduce((total, item) => total + (item.product?.price ?? 0) * item.quantity, 0)
        : null,
    }}>
      {children}
    </CartContext.Provider>
  );
}

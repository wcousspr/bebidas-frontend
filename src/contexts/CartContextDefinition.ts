import { createContext } from "react";
import type { Product } from "../types/Product";
import type { CartItem } from "./cartState";

export type CartSyncStatus = "idle" | "syncing" | "error" | "stale" | "ready";

interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product) => void;
  removeFromCart: (productId: number) => void;
  decreaseQuantity: (productId: number) => void;
  adjustToStock: (productId: number) => void;
  clearCart: () => void;
  syncCart: () => Promise<void>;
  syncStatus: CartSyncStatus;
  storageError: boolean;
  acceptPriceChanges: () => void;
  beginCheckoutValidation: (expected: CartItem[]) => {
    apply: (items: CartItem[], catalog: ReadonlyMap<number, Product>) => boolean;
    fail: () => void;
  } | null;
  totalItems: number;
  totalPrice: number | null;
}

export const CartContext = createContext<CartContextType | undefined>(undefined);

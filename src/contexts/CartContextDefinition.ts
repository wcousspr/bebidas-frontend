import { createContext } from "react";
import type { Product } from "../types/Product";

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product) => void;
  removeFromCart: (productId: number) => void;
  decreaseQuantity: (productId: number) => void;
  clearCart: () => void;
  syncCart: () => Promise<void>;
  syncing: boolean;
  totalItems: number;
  totalPrice: number;
}

export const CartContext = createContext<
  CartContextType | undefined
>(undefined);
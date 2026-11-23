
import { apiGet } from "./api";
import type { Product } from "../types/Product";

interface BebidaApi {
  id: number;
  name: string;
  price: number;
  quantity: number;
  category: string;
  imageUrl?: string | null;
  description?: string | null;
}

export async function getProducts(options?: Parameters<typeof apiGet>[1]): Promise<Product[]> {
  const bebidas = await apiGet<BebidaApi[]>("/api/bebidas", options);

  return bebidas.map((bebida) => ({
    id: bebida.id,
    name: bebida.name,
    price: bebida.price,
    quantity: bebida.quantity,
    category: bebida.category,
    imageUrl: bebida.imageUrl,
    description: bebida.description,
  }));
}

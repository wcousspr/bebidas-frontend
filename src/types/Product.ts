
export interface Product {
  id: number;
  name: string;
  price: number;
  quantity: number;
  category: string;
  imageUrl?: string | null;
  description?: string | null;
}

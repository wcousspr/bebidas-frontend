import type { Product } from "../types/Product";

export interface SavedCartItem {
  productId: number;
  quantity: number;
}

export interface CartItem extends SavedCartItem {
  product?: Product;
  availability: "unconfirmed" | "available" | "unavailable";
  previousPrice?: number;
  previousStock?: number;
}

export function serializeCart(items: SavedCartItem[]) {
  return JSON.stringify(items.map(({ productId, quantity }) => ({ productId, quantity })));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function legacyProduct(data: unknown, productId: number): Product | undefined {
  if (!isRecord(data) || data.id !== productId || typeof data.name !== "string" ||
      typeof data.price !== "number" || !Number.isFinite(data.price) || data.price < 0 ||
      typeof data.quantity !== "number" || !Number.isSafeInteger(data.quantity) || data.quantity < 0) {
    return;
  }

  return {
    id: productId,
    name: data.name,
    price: data.price,
    quantity: data.quantity,
    category: typeof data.category === "string" ? data.category : "",
    imageUrl: typeof data.imageUrl === "string" ? data.imageUrl : undefined,
  };
}

export function readCart(saved: string | null) {
  let parsed: unknown;
  try {
    parsed = saved === null ? null : JSON.parse(saved);
  } catch {
    return { items: [], lastSaved: "[]" };
  }
  if (!Array.isArray(parsed)) return { items: [], lastSaved: "[]" };

  const byId = new Map<number, CartItem>();
  for (const entry of parsed) {
    if (!isRecord(entry) || !isPositiveInteger(entry.quantity)) continue;
    const productId = entry.productId ?? (isRecord(entry.product) ? entry.product.id : undefined);
    if (!isPositiveInteger(productId)) continue;

    const existing = byId.get(productId);
    byId.set(productId, {
      productId,
      // A duplicate may be a second copy of the same line. Keep the largest request.
      quantity: Math.max(entry.quantity, existing?.quantity ?? 0),
      product: existing?.product ?? legacyProduct(entry.product, productId),
      availability: "unconfirmed",
    });
  }
  const items = [...byId.values()];
  return { items, lastSaved: items.length || parsed.length === 0 ? saved : "[]" };
}

export function indexProducts(products: Product[]) {
  const catalog = new Map<number, Product>();
  for (const product of products) {
    if (!isPositiveInteger(product.id) || typeof product.name !== "string" ||
        !Number.isFinite(product.price) || product.price < 0 ||
        !Number.isSafeInteger(product.quantity) || product.quantity < 0 || catalog.has(product.id)) {
      throw new Error("O catálogo retornou dados inválidos. Tente novamente.");
    }
    catalog.set(product.id, product);
  }
  return catalog;
}

export type KnownProducts = ReadonlyMap<number, Product | null>;

export function rememberCatalog(
  latest: ReadonlyMap<number, Product>,
  previous: KnownProducts | null,
  items: CartItem[],
): KnownProducts {
  const known = new Map<number, Product | null>(latest);
  for (const id of previous?.keys() ?? []) {
    if (!known.has(id)) known.set(id, null);
  }
  for (const { productId } of items) {
    if (!known.has(productId)) known.set(productId, null);
  }
  return known;
}

export function reconcileCart(items: CartItem[], catalog: ReadonlyMap<number, Product>): CartItem[] {
  return items.map((item) => {
    const current = catalog.get(item.productId);
    if (!current) return { ...item, availability: "unavailable" };

    const previousPrice = item.previousPrice ?? item.product?.price;
    const previousStock = item.previousStock ?? item.product?.quantity;
    return {
      ...item,
      product: current,
      availability: current.quantity > 0 ? "available" : "unavailable",
      previousPrice: previousPrice === current.price ? undefined : previousPrice,
      previousStock: previousStock !== undefined && previousStock > current.quantity ? previousStock : undefined,
    };
  });
}

export function needsStockReview(item: CartItem) {
  return item.availability === "available" && !!item.product && item.quantity > item.product.quantity;
}

export function addCartItem(
  items: CartItem[],
  catalog: KnownProducts | null,
  fromCard: Product,
): CartItem[] {
  const existing = items.find((item) => item.productId === fromCard.id);
  const confirmed = catalog?.get(fromCard.id);
  if (confirmed === null) return items;
  const product = confirmed ?? existing?.product ?? fromCard;
  if (!product || product.quantity <= (existing?.quantity ?? 0)) return items;

  if (existing) {
    return items.map((item) => item === existing
      ? { ...item, product, quantity: item.quantity + 1 }
      : item);
  }

  return [...items, {
    productId: product.id,
    product,
    quantity: 1,
    availability: confirmed ? "available" : "unconfirmed",
  }];
}

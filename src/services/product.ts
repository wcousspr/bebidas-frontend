
import { apiGet } from "./api";
import { siteConfig } from "../config/site";
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

const CATALOG_TTL_MS = 20_000;
const INVALIDATED_CATALOG = Symbol("invalidated catalog");
let cachedCatalog: { products: Product[]; expiresAt: number } | undefined;
let pendingCatalog: { controller: AbortController; promise: Promise<Product[]> } | undefined;

export function invalidateCatalog() {
  cachedCatalog = undefined;
  const previous = pendingCatalog;
  pendingCatalog = undefined;
  previous?.controller.abort();
}

function readSharedCatalog(): Promise<Product[]> {
  if (cachedCatalog && performance.now() < cachedCatalog.expiresAt) {
    return Promise.resolve(cachedCatalog.products);
  }
  if (pendingCatalog) return pendingCatalog.promise;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), siteConfig.checkoutTimeoutMs);
  const promise = getProducts({ cache: "no-store", signal: controller.signal }).then(
    (products) => {
      if (pendingCatalog?.controller !== controller) throw INVALIDATED_CATALOG;
      controller.signal.throwIfAborted();
      cachedCatalog = { products, expiresAt: performance.now() + CATALOG_TTL_MS };
      return products;
    },
    (error: unknown) => {
      if (pendingCatalog?.controller !== controller) throw INVALIDATED_CATALOG;
      throw error;
    },
  ).finally(() => {
    window.clearTimeout(timeout);
    if (pendingCatalog?.controller === controller) pendingCatalog = undefined;
  });
  pendingCatalog = { controller, promise };
  return promise;
}

function waitForCatalog(request: Promise<Product[]>, signal: AbortSignal) {
  // Cancel only this consumer. Other views may still be waiting for the shared GET.
  return new Promise<Product[]>((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    void request.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}

export async function getPublicCatalog(signal: AbortSignal): Promise<Product[]> {
  signal.throwIfAborted();
  try {
    return await waitForCatalog(readSharedCatalog(), signal);
  } catch (error) {
    // Subscribers still interested in the catalog move to the replacement GET.
    if (error === INVALIDATED_CATALOG) return getPublicCatalog(signal);
    throw error;
  }
}

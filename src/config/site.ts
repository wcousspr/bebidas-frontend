
const checkoutTimeoutMs = Number(import.meta.env.VITE_CHECKOUT_TIMEOUT_MS);

export const siteConfig = {
  name: "Código dos Bares",
  description: "Distribuidora de bebidas",
  publicOrigin: "https://codigo-dos-bares.onrender.com",
  whatsapp: "5545999084086",
  apiUrl: import.meta.env.VITE_API_URL,
  // Allows for a slow connection or a cold API start while keeping the wait bounded.
  checkoutTimeoutMs: Number.isInteger(checkoutTimeoutMs) && checkoutTimeoutMs > 0 &&
    checkoutTimeoutMs <= 2_147_483_647 ? checkoutTimeoutMs : 30_000,
};

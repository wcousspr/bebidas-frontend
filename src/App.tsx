
import { lazy, Suspense, useState } from "react";
import { Routes, Route, Outlet } from "react-router-dom";

import Header from "./components/Header/Header";
import Home from "./pages/Home/Home";

import ProductDetails from "./pages/ProductDetails/ProductDetails";
import AdminChunkBoundary from "./components/AdminChunkBoundary";
import { CartProvider } from "./contexts/CartContext";
import { siteConfig } from "./config/site";

import "./App.css";

const AdminRoutes = lazy(() => import("./pages/Admin/AdminRoutes"));

function App() {
  const [search, setSearch] = useState("");

  return (
    <Routes>
      {/* Catálogo público */}
      <Route
        element={
          <CartProvider>
            <Header search={search} onSearchChange={setSearch} />
            <Outlet />
          </CartProvider>
        }
      >
        <Route
          index
          element={
            <main className="catalog-page">
              <link rel="canonical" href={new URL("/", siteConfig.publicOrigin).href} />
              <Home search={search} />
            </main>
          }
        />
        <Route path="/produto/:id" element={<ProductDetails />} />
      </Route>

      <Route
        path="/admin/*"
        element={
          <AdminChunkBoundary>
            <Suspense fallback={<main role="status">Carregando painel administrativo…</main>}>
              <AdminRoutes />
            </Suspense>
          </AdminChunkBoundary>
        }
      />
    </Routes>
  );
}

export default App;

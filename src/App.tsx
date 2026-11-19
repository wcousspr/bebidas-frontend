
import { useState } from "react";
import { Routes, Route, Outlet } from "react-router-dom";

import Header from "./components/Header/Header";
import Home from "./pages/Home/Home";

import AdminLogin from "./pages/Admin/AdminLogin";
import AdminDashboard from "./pages/Admin/AdminDashboard";
import AdminCategorias from "./pages/Admin/AdminCategorias";
import AdminBebidas from "./pages/Admin/AdminBebidas";
import ProductDetails from "./pages/ProductDetails/ProductDetails";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminLayout from "./layouts/AdminLayout";

import "./App.css";

function App() {
  const [search, setSearch] = useState("");

  return (
    <Routes>
      {/* Catálogo público */}
      <Route
        element={
          <>
            <Header search={search} onSearchChange={setSearch} />
            <Outlet />
          </>
        }
      >
        <Route
          index
          element={
            <main className="catalog-page">
              <Home search={search} />
            </main>
          }
        />
        <Route path="/produto/:id" element={<ProductDetails />} />
      </Route>

      {/* Login administrativo */}
      <Route
        path="/admin/login"
        element={<AdminLogin />}
      />

      {/* Rotas administrativas protegidas */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AdminLayout />}>
          <Route
            path="/admin"
            element={<AdminDashboard />}
          />

          <Route
            path="/admin/bebidas"
            element={<AdminBebidas />}
          />

          <Route
            path="/admin/categorias"
            element={<AdminCategorias />}
          />
          
        </Route>
      </Route>
    </Routes>
  );
}

export default App;

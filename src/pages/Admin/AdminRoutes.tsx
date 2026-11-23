import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import ProtectedRoute from "../../components/ProtectedRoute";
import { AuthProvider } from "../../contexts/AuthContext";
import AdminLayout from "../../layouts/AdminLayout";

const AdminLogin = lazy(() => import("./AdminLogin"));
const AdminDashboard = lazy(() => import("./AdminDashboard"));
const AdminBebidas = lazy(() => import("./AdminBebidas"));
const AdminCategorias = lazy(() => import("./AdminCategorias"));

export default function AdminRoutes() {
  return (
    <AuthProvider>
      <Suspense fallback={<main role="status">Carregando painel administrativo…</main>}>
        <Routes>
          <Route path="login" element={<AdminLogin />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="bebidas" element={<AdminBebidas />} />
              <Route path="categorias" element={<AdminCategorias />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}

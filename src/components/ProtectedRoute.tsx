
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/useAuth";
import AdminSessionCheck from "./AdminSessionCheck";

export default function ProtectedRoute() {
  const { status } = useAuth();
  const { pathname, search, hash } = useLocation();

  if (status === "checking" || status === "temporary-error") {
    return <AdminSessionCheck />;
  }

  return status === "authenticated" ? <Outlet /> : (
    <Navigate to="/admin/login" replace state={{ from: pathname + search + hash }} />
  );
}

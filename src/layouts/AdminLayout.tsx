
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/useAuth";
import Icon from "../components/Icon";

import "./AdminLayout.css";

export default function AdminLayout() {
  const navigate = useNavigate();
  const { signOut, storageWarning } = useAuth();

  function handleLogout() {
    signOut();
    navigate("/admin/login", { replace: true });
  }

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <h2>Código dos Bares</h2>
          <p>Painel administrativo</p>
        </div>

        <nav className="admin-sidebar-nav" aria-label="Navegação administrativa">
          <NavLink
            to="/admin"
            end
            className={({ isActive }) =>
              isActive ? "admin-nav-link active" : "admin-nav-link"
            }
          >
            <Icon name="dashboard" size={18} />
            Dashboard
          </NavLink>

          <NavLink
            to="/admin/bebidas"
            className={({ isActive }) =>
              isActive ? "admin-nav-link active" : "admin-nav-link"
            }
          >
            <Icon name="drinks" size={18} />
            Bebidas
          </NavLink>

          <NavLink
            to="/admin/categorias"
            className={({ isActive }) =>
              isActive ? "admin-nav-link active" : "admin-nav-link"
            }
          >
            <Icon name="categories" size={18} />
            Categorias
          </NavLink>
        </nav>

        <button
          type="button"
          className="admin-sidebar-logout"
          onClick={handleLogout}
        >
          <Icon name="logout" size={18} />
          Sair da conta
        </button>
      </aside>

      <main className="admin-layout-content">
        {storageWarning && <p role="status">{storageWarning}</p>}
        <Outlet />
      </main>
    </div>
  );
}

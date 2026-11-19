
import { useState, type ReactNode } from "react";
import { AuthContext } from "./auth-context";

import {
  login as apiLogin,
  type LoginCredentials,
} from "../services/authService";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  async function signIn(credentials: LoginCredentials) {
    const result = await apiLogin(credentials);

    const response = await fetch(
      "https://bebidas-api-dotnet.onrender.com/api/auth/me",
      {
        headers: {
          Authorization: `Bearer ${result.token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error("Não foi possível validar sua sessão.");
    }

    const profile: { roles: string[] } = await response.json();

    if (!profile.roles.includes("Admin")) {
      throw new Error("Você não possui permissão de administrador.");
    }

    setToken(result.token);
    setIsAdmin(true);
  }

  function signOut() {
    setToken(null);
    setIsAdmin(false);
  }

  return (
    <AuthContext.Provider
      value={{ token, isAdmin, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

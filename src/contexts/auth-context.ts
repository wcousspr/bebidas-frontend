
import { createContext } from "react";
import type { LoginCredentials } from "../services/authService";

export interface AuthContextType {
  token: string | null;
  isAdmin: boolean;
  signIn: (credentials: LoginCredentials) => Promise<void>;
  signOut: () => void;
}

export const AuthContext = createContext<AuthContextType | null>(null);

import { createContext } from "react";
import type { LoginCredentials } from "../services/authService";
import type { AdminRequest } from "../services/adminRequest";

type SessionStatus = "checking" | "authenticated" | "anonymous" | "temporary-error";

interface AuthContextType {
  status: SessionStatus;
  request: AdminRequest | null;
  message: string | null;
  storageWarning: string | null;
  retryRestoration: () => void;
  signIn: (credentials: LoginCredentials) => Promise<void>;
  signOut: () => void;
}

export const AuthContext = createContext<AuthContextType | null>(null);

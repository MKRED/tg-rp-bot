import { createContext } from "react";
import type { AuthMode, AuthSession } from "../types/auth";

export interface AuthContextValue {
  mode: AuthMode;
  /** Сессия браузерного входа; в Telegram — null (профиль берётся из initData). */
  session: AuthSession | null;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

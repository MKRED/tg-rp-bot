import { useContext } from "react";
import { type AuthContextValue, AuthContext } from "../lib/authContext";

/** Способ входа и сессия текущего пользователя (внутри AuthGate). */
export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth вызван вне AuthGate");
  return value;
}

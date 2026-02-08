import { bindTokenAccessors } from "@/lib/api";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export { authHeader } from "@/lib/api";

export type User = {
  user_id: number;
  email: string;
  name: string;
};

type AuthState = {
  accessToken: string | null;
  user: User | null;
  isLoading: boolean;
  setAccessToken: (t: string | null) => void;
  setUser: (u: User | null) => void;
  clearAuth: () => void;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Привязываем apiFetch к токену из context
  useEffect(() => {
    bindTokenAccessors(() => accessToken, setAccessToken);
  }, [accessToken]);

  useEffect(() => {
    let isActive = true;
    (async () => {
      try {
        const res = await fetch("/api/v1/auth/refresh", {
          method: "POST",
          credentials: "include",
        });
        if (!res.ok || !isActive) {
          return;
        }
        const data = (await res.json()) as { access_token: string; user?: User };
        setAccessToken(data.access_token);
        if (data.user) setUser(data.user);
      } finally {
        if (isActive) setIsLoading(false);
      }
    })();
    return () => {
      isActive = false;
    };
  }, []);
  const clearAuth = () => {
    setAccessToken(null);
    setUser(null);
    setIsLoading(false);
  };

  const value = useMemo(() => ({
    accessToken,
    user,
    isLoading,
    setAccessToken,
    setUser,
    clearAuth,
  }), [accessToken, user, isLoading]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// export function getAccessToken(): string | null {
//   return localStorage.getItem("access_token");
// }

// export type StoredUser = {
//   user_id: number;
//   email: string;
//   name: string;
// };

// export function getStoredUser(): StoredUser | null {
//   const raw = localStorage.getItem("user");
//   if (!raw) return null;
//   try {
//     return JSON.parse(raw) as StoredUser;
//   } catch {
//     return null;
//   }
// }

// export function authHeader(): Record<string, string> {
//   const t = getAccessToken();
//   return t ? { Authorization: `Bearer ${t}` } : {};
// }

// export function logout() {
//   localStorage.removeItem("access_token");
//   localStorage.removeItem("user");
// }




export function useAuth(){
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within an AuthProvider");
  return v;
}

import { bindTokenAccessors } from "@/lib/api";
import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

export { authHeader } from "@/lib/api";

export type User = {
  user_id: number;
  email: string;
  name: string;
  role?: "form_creator" | "admin" | null;
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
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const accessTokenRef = useRef<string | null>(null);

  const setAccessToken = useCallback((token: string | null) => {
    accessTokenRef.current = token;
    setAccessTokenState(token);
  }, []);

  // Bind once before child effects so apiFetch always reads a current token.
  useLayoutEffect(() => {
    bindTokenAccessors(() => accessTokenRef.current, setAccessToken);
  }, [setAccessToken]);

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
  }, [setAccessToken]);

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
  }), [accessToken, user, isLoading, setAccessToken]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(){
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within an AuthProvider");
  return v;
}

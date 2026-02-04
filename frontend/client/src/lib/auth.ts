export function getAccessToken(): string | null {
  return localStorage.getItem("access_token");
}

export type StoredUser = {
  user_id: number;
  email: string;
  name: string;
};

export function getStoredUser(): StoredUser | null {
  const raw = localStorage.getItem("user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export function authHeader(): Record<string, string> {
  const t = getAccessToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export function logout() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("user");
}

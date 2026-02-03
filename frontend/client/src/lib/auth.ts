export function getAccessToken(): string | null {
  return localStorage.getItem("access_token");
}

export function authHeader(): Record<string, string> {
  const t = getAccessToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export function logout() {
  localStorage.removeItem("access_token");
}

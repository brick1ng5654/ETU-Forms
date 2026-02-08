type GetToken = () => string | null;
type SetToken = (t: string | null) => void;

let getToken: GetToken = () => null;
let setToken: SetToken = () => {};

export function bindTokenAccessors(getter: GetToken, setter: SetToken) {
  getToken = getter;
  setToken = setter;
}

export function authHeader(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function isRefreshRequest(input: RequestInfo | URL): boolean {
    const url = typeof input === "string"
     ? input
     : input instanceof URL
        ? input.toString()
        : input;
    return url.includes("/api/v1/auth/refresh");
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
    if (!refreshPromise) {
        refreshPromise = (async () => {
            const res = await fetch(`/api/v1/auth/refresh`, {
                method: "POST",
                credentials: "include",
            });

            if (!res.ok) return null;

            const data = await res.json() as { access_token: string };
            setToken(data.access_token);
            return data.access_token;
        })().finally(() => {
            refreshPromise = null;
        });
    }
    return refreshPromise;
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers ?? {});
    let token = getToken();

    // Avoid a guaranteed first 401 when page state was reset after reload.
    if (!token && !isRefreshRequest(input)) {
        token = await refreshAccessToken();
    }

    if (token) {
        headers.set("Authorization", `Bearer ${token}`);
    }

    const first = await fetch(input, {
        ...init,
        headers: headers,
        credentials: "include",
    });

    if (first.status !== 401 || isRefreshRequest(input)) {
        return first;
    }

    const newToken = await refreshAccessToken();
    if (!newToken) {
        return first; // не удалось обновить токен, возвращаем оригинальный ответ
    }

    const header2 = new Headers(init.headers ?? {});
    header2.set("Authorization", `Bearer ${newToken}`);

    return fetch(input, {
        ...init,
        headers: header2,
        credentials: "include",
    });
}

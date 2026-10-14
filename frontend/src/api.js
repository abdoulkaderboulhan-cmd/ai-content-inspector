const BASE = "http://127.0.0.1:8000";

export function getToken() {
  try { return localStorage.getItem("token"); } catch { return null; }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem("token", token);
    else localStorage.removeItem("token");
  } catch { /* ignore */ }
}

// Talks to the Python backend. Adds the login token automatically.
export async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = getToken();
  if (token) headers["Authorization"] = "Bearer " + token;

  let body = options.body;
  const isPlain = body && typeof body === "object" &&
    !(body instanceof FormData) && !(body instanceof URLSearchParams);
  if (isPlain) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(BASE + path, { ...options, headers, body });
  } catch {
    throw new Error("Cannot reach the server. Is the backend running on port 8000?");
  }

  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    if (res.status === 401 && token && path !== "/api/auth/login") {
      setToken(null);
      window.location.href = "/login";
    }
    let message = "Request failed (" + res.status + ")";
    if (data && typeof data.detail === "string") message = data.detail;
    else if (data && Array.isArray(data.detail)) message = data.detail.map((d) => d.msg).join(", ");
    throw new Error(message);
  }
  return data;
}

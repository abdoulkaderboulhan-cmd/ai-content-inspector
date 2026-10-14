import { createContext, useContext, useEffect, useState } from "react";
import { api, getToken, setToken } from "./api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(getToken()));

  useEffect(() => {
    if (!getToken()) return;
    api("/api/auth/me")
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const form = new URLSearchParams();
    form.set("username", email);
    form.set("password", password);
    const data = await api("/api/auth/login", { method: "POST", body: form });
    setToken(data.access_token);
    setUser(await api("/api/auth/me"));
  }

  async function register(fullName, email, password) {
    await api("/api/auth/register", {
      method: "POST",
      body: { full_name: fullName, email: email, password: password },
    });
    await login(email, password);
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

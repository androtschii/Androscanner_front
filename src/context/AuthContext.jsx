import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "../lib/api";

const AuthContext = createContext(null);

const STORAGE_KEY = "androscanner_token";

// sessionStorage, а не localStorage: переживает F5 (без этого за сессию
// тестирования приходилось логиниться заново после каждого обновления
// страницы), но пропадает при закрытии вкладки — токен не остаётся
// на диске неограниченно долго, как было бы с localStorage.
function readStoredToken() {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null; // приватный режим браузера может бросать здесь
  }
}

function writeStoredToken(token) {
  try {
    if (token) sessionStorage.setItem(STORAGE_KEY, token);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // тихо игнорируем — токен просто не переживёт обновление страницы
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  // Пока не проверили сохранённый токен — не решаем, что показывать:
  // иначе ProtectedRoute на миг увидит token=null и уведёт на /login
  // ещё до того, как успеем его восстановить.
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const saved = readStoredToken();
    if (!saved) {
      setRestoring(false);
      return;
    }
    api
      .me(saved)
      .then((me) => {
        if (cancelled) return;
        setToken(saved);
        setUser(me);
      })
      .catch(() => {
        // Токен истёк или недействителен — тихо чистим и уводим на вход
        writeStoredToken(null);
      })
      .finally(() => {
        if (!cancelled) setRestoring(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (username, password) => {
    const { access_token } = await api.login(username, password);
    const me = await api.me(access_token);
    setToken(access_token);
    setUser(me);
    writeStoredToken(access_token);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    writeStoredToken(null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, login, logout, restoring }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

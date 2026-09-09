const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export class ApiError extends Error {
  constructor(status, detail) {
    super(detail || `HTTP ${status}`);
    this.status = status;
  }
}

async function request(path, { method = "GET", token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload;
  if (form) {
    payload = new URLSearchParams(form);
  } else if (body) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const res = await fetch(`${API_URL}${path}`, { method, headers, body: payload });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, data?.detail);
  }
  return data;
}

export const api = {
  // ── auth ──
  login: (username, password) =>
    request("/auth/login", { method: "POST", form: { username, password } }),
  me: (token) => request("/users/me", { token }),
  changePassword: (token, currentPassword, newPassword) =>
    request("/users/me/password", {
      method: "POST",
      token,
      body: { current_password: currentPassword, new_password: newPassword },
    }),

  // ── сканы ──
  // Возвращает { items, total, limit, offset } — не голый список
  listScans: (token, { limit = 50, offset = 0, status, target } = {}) => {
    const q = new URLSearchParams({ limit, offset });
    if (status) q.set("status", status);
    if (target) q.set("target", target);
    return request(`/scans?${q}`, { token });
  },
  getScan: (token, id) => request(`/scans/${id}`, { token }),
  createScan: (token, target, profile) =>
    request("/scans", { method: "POST", token, body: { target, profile } }),
  cancelScan: (token, id) => request(`/scans/${id}/cancel`, { method: "POST", token }),

  // ── allowed scope (запись — только admin) ──
  listScopes: (token) => request("/scopes", { token }),
  createScope: (token, cidr, description) =>
    request("/scopes", { method: "POST", token, body: { cidr, description } }),
  deleteScope: (token, id) => request(`/scopes/${id}`, { method: "DELETE", token }),

  // ── пользователи (только admin) ──
  listUsers: (token) => request("/users", { token }),
  createUser: (token, username, password, role) =>
    request("/users", { method: "POST", token, body: { username, password, role } }),
  deleteUser: (token, id) => request(`/users/${id}`, { method: "DELETE", token }),

  // ── журнал действий (только admin) ──
  listAudit: (token, { limit = 50, offset = 0, action } = {}) => {
    const q = new URLSearchParams({ limit, offset });
    if (action) q.set("action", action);
    return request(`/audit?${q}`, { token });
  },

  // ── аналитика ──
  analyticsSummary: (token) => request("/analytics/summary", { token }),
  diffScans: (token, base, compare) =>
    request(`/analytics/diff?base=${base}&compare=${compare}`, { token }),
  networkMap: (token) => request("/analytics/network", { token }),

  // ── PDF-отчёт ──
  // Возвращает Blob, а не JSON: скачивание идёт через ссылку на объект,
  // иначе браузер не сможет отдать файл с заголовком Authorization.
  async scanReport(token, id) {
    const res = await fetch(`${API_URL}/scans/${id}/report.pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new ApiError(res.status, data?.detail);
    }
    return res.blob();
  },
};

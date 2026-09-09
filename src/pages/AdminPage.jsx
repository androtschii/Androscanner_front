import { useCallback, useEffect, useState } from "react";
import { Header } from "../components/Header";
import { useAuth } from "../context/AuthContext";
import { ApiError, api } from "../lib/api";

const ROLE_LABEL = { admin: "Администратор", analyst: "Аналитик", viewer: "Наблюдатель" };

function Section({ title, hint, children }) {
  return (
    <section className="mb-10">
      <h2 className="mb-1 text-lg font-semibold">{title}</h2>
      {hint && <p className="mb-3 text-sm text-slate-400">{hint}</p>}
      {children}
    </section>
  );
}

function ErrorLine({ error }) {
  if (!error) return null;
  return <p className="mt-2 text-sm text-red-400">{error}</p>;
}

// ── Разрешённые диапазоны ──

function ScopesSection({ token }) {
  const [scopes, setScopes] = useState([]);
  const [cidr, setCidr] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      setScopes(await api.listScopes(token));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось загрузить диапазоны");
    }
  }, [token]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function add(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.createScope(token, cidr, description);
      setCidr("");
      setDescription("");
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось добавить диапазон");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    setError(null);
    try {
      await api.deleteScope(token, id);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось удалить диапазон");
    }
  }

  return (
    <Section
      title="Разрешённые диапазоны"
      hint="Сканировать можно только эти сети. Цель вне списка блокируется с ошибкой 403 — и в интерфейсе, и при прямом вызове движка."
    >
      <form onSubmit={add} className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[160px]">
          <label className="mb-1 block text-sm text-slate-300" htmlFor="cidr">
            CIDR
          </label>
          <input
            id="cidr"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 outline-none focus:border-sky-500"
            value={cidr}
            onChange={(e) => setCidr(e.target.value)}
            placeholder="192.168.1.0/24"
            required
          />
        </div>
        <div className="min-w-[180px] flex-1">
          <label className="mb-1 block text-sm text-slate-300" htmlFor="scope-desc">
            Описание
          </label>
          <input
            id="scope-desc"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 outline-none focus:border-sky-500"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="домашняя сеть"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-500 disabled:opacity-50"
        >
          Добавить
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-900 text-slate-400">
            <tr>
              <th className="px-4 py-2 font-medium">CIDR</th>
              <th className="px-4 py-2 font-medium">Описание</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {scopes.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-slate-500" colSpan={3}>
                  Диапазонов нет — сканировать нельзя ничего
                </td>
              </tr>
            )}
            {scopes.map((s) => (
              <tr key={s.id} className="border-t border-slate-800">
                <td className="px-4 py-2 font-mono">{s.cidr}</td>
                <td className="px-4 py-2 text-slate-400">{s.description || "—"}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => remove(s.id)}
                    className="text-sm text-red-400 hover:underline"
                  >
                    Удалить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ErrorLine error={error} />
    </Section>
  );
}

// ── Пользователи ──

function UsersSection({ token, currentUserId }) {
  const [users, setUsers] = useState([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("viewer");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      setUsers(await api.listUsers(token));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось загрузить пользователей");
    }
  }, [token]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function add(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.createUser(token, username, password, role);
      setUsername("");
      setPassword("");
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось создать пользователя");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(user) {
    setError(null);
    try {
      if (user.is_active) {
        await api.deactivateUser(token, user.id);
      } else {
        await api.activateUser(token, user.id);
      }
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось изменить статус пользователя");
    }
  }

  return (
    <Section
      title="Пользователи"
      hint="Пользователи отключаются, а не удаляются: удаление стёрло бы авторство сканов в журнале. Отключённый теряет доступ сразу — его токен перестаёт действовать."
    >
      <form onSubmit={add} className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[140px]">
          <label className="mb-1 block text-sm text-slate-300" htmlFor="new-username">
            Логин
          </label>
          <input
            id="new-username"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 outline-none focus:border-sky-500"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div className="min-w-[140px]">
          <label className="mb-1 block text-sm text-slate-300" htmlFor="new-password">
            Пароль
          </label>
          <input
            id="new-password"
            type="password"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 outline-none focus:border-sky-500"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-300" htmlFor="new-role">
            Роль
          </label>
          <select
            id="new-role"
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 outline-none focus:border-sky-500"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="viewer">viewer — только просмотр</option>
            <option value="analyst">analyst — может запускать сканы</option>
            <option value="admin">admin — полный доступ</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-500 disabled:opacity-50"
        >
          Создать
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-900 text-slate-400">
            <tr>
              <th className="px-4 py-2 font-medium">Логин</th>
              <th className="px-4 py-2 font-medium">Роль</th>
              <th className="px-4 py-2 font-medium">Статус</th>
              <th className="px-4 py-2 font-medium">Создан</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-slate-800">
                <td className="px-4 py-2">
                  {u.username}
                  {u.id === currentUserId && <span className="ml-2 text-xs text-slate-500">это вы</span>}
                </td>
                <td className="px-4 py-2">{ROLE_LABEL[u.role] ?? u.role}</td>
                <td className="px-4 py-2">
                  {u.is_active ? (
                    <span className="text-emerald-400">активен</span>
                  ) : (
                    <span className="text-slate-500">отключён</span>
                  )}
                </td>
                <td className="px-4 py-2 text-slate-400">
                  {new Date(u.created_at).toLocaleString("ru-RU")}
                </td>
                <td className="px-4 py-2 text-right">
                  {u.id !== currentUserId && (
                    <button
                      onClick={() => toggleActive(u)}
                      className={
                        u.is_active
                          ? "text-sm text-amber-400 hover:underline"
                          : "text-sm text-emerald-400 hover:underline"
                      }
                    >
                      {u.is_active ? "Отключить" : "Включить"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ErrorLine error={error} />
    </Section>
  );
}

// ── Журнал действий ──

function AuditSection({ token }) {
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .listAudit(token, { limit: 50 })
      .then((page) => {
        setEntries(page.items);
        setTotal(page.total);
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Не удалось загрузить журнал"),
      );
  }, [token]);

  return (
    <Section
      title="Журнал действий"
      hint={
        total > entries.length
          ? `Показаны последние ${entries.length} из ${total}. Записи не редактируются и не удаляются.`
          : "Кто, что и когда сделал. Записи не редактируются и не удаляются."
      }
    >
      <div className="max-h-96 overflow-y-auto rounded-xl border border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-slate-900 text-slate-400">
            <tr>
              <th className="px-4 py-2 font-medium">Время</th>
              <th className="px-4 py-2 font-medium">Пользователь</th>
              <th className="px-4 py-2 font-medium">Действие</th>
              <th className="px-4 py-2 font-medium">Детали</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-slate-500" colSpan={4}>
                  Записей нет
                </td>
              </tr>
            )}
            {entries.map((e) => (
              <tr key={e.id} className="border-t border-slate-800">
                <td className="whitespace-nowrap px-4 py-2 text-slate-400">
                  {new Date(e.created_at).toLocaleString("ru-RU")}
                </td>
                <td className="px-4 py-2 text-slate-400">{e.user_id ?? "—"}</td>
                <td className="px-4 py-2 font-mono text-xs">{e.action}</td>
                <td className="px-4 py-2 font-mono text-xs text-slate-400">{e.detail || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ErrorLine error={error} />
    </Section>
  );
}

export function AdminPage() {
  const { token, user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Header />
      <main className="mx-auto max-w-4xl px-6 py-8">
        <h1 className="mb-8 text-2xl font-semibold">Администрирование</h1>
        <ScopesSection token={token} />
        <UsersSection token={token} currentUserId={user?.id} />
        <AuditSection token={token} />
      </main>
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import {
  ClipboardList,
  Network,
  Plus,
  Power,
  PowerOff,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Header } from "../components/Header";
import { useAuth } from "../context/AuthContext";
import { ApiError, api } from "../lib/api";
import { useConfirm } from "../lib/useConfirm";

const ROLE_LABEL = { admin: "Администратор", analyst: "Аналитик", viewer: "Наблюдатель" };

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 outline-none focus:border-sky-500";

function Section({ icon: Icon, title, hint, children }) {
  return (
    <section className="mb-10">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold">
        <Icon size={18} className="text-slate-400" aria-hidden="true" />
        {title}
      </h2>
      {hint && <p className="mb-3 text-sm text-slate-400">{hint}</p>}
      {children}
    </section>
  );
}

/** Показывает ошибку и возвращает её текст — чтобы не дублировать разбор. */
function reportError(err, fallback) {
  const message = err instanceof ApiError ? err.message : fallback;
  toast.error(message);
  return message;
}

// ── Разрешённые диапазоны ──

function ScopesSection({ token, confirm }) {
  const [scopes, setScopes] = useState([]);
  const [cidr, setCidr] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      setScopes(await api.listScopes(token));
    } catch (err) {
      reportError(err, "Не удалось загрузить диапазоны");
    }
  }, [token]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function add(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const created = await api.createScope(token, cidr, description);
      // Показываем то, что записалось: введённый 192.168.1.77/24
      // сохранится как 192.168.1.0/24, и об этом лучше сказать сразу
      toast.success(`Диапазон ${created.cidr} разрешён`);
      setCidr("");
      setDescription("");
      reload();
    } catch (err) {
      reportError(err, "Не удалось добавить диапазон");
    } finally {
      setBusy(false);
    }
  }

  async function remove(scope) {
    const ok = await confirm({
      title: "Убрать диапазон из белого списка?",
      message:
        `После удаления ${scope.cidr} сканировать эту сеть станет нельзя — ` +
        `запросы начнут отклоняться с ошибкой 403.`,
      confirmLabel: "Убрать",
      danger: true,
    });
    if (!ok) return;

    try {
      await api.deleteScope(token, scope.id);
      toast.success(`${scope.cidr} больше не разрешён`);
      reload();
    } catch (err) {
      reportError(err, "Не удалось удалить диапазон");
    }
  }

  return (
    <Section
      icon={Network}
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
            className={inputClass}
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
            className={inputClass}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="домашняя сеть"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-500 disabled:opacity-50"
        >
          <Plus size={16} aria-hidden="true" />
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
              <tr key={s.id} className="border-t border-slate-800 hover:bg-slate-900/50">
                <td className="px-4 py-2 font-mono">{s.cidr}</td>
                <td className="px-4 py-2 text-slate-400">{s.description || "—"}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => remove(s)}
                    title={`Убрать ${s.cidr} из белого списка`}
                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-red-400 hover:bg-red-950/40"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                    Убрать
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

// ── Пользователи ──

function UsersSection({ token, currentUserId, confirm }) {
  const [users, setUsers] = useState([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("viewer");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      setUsers(await api.listUsers(token));
    } catch (err) {
      reportError(err, "Не удалось загрузить пользователей");
    }
  }, [token]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function add(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.createUser(token, username, password, role);
      toast.success(`Пользователь ${username} создан`);
      setUsername("");
      setPassword("");
      reload();
    } catch (err) {
      reportError(err, "Не удалось создать пользователя");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(user) {
    if (user.is_active) {
      const ok = await confirm({
        title: `Отключить ${user.username}?`,
        message:
          "Пользователь потеряет доступ немедленно — его текущий токен перестанет " +
          "действовать, не дожидаясь истечения срока. Запущенные им сканы и записи " +
          "журнала сохранятся. Включить обратно можно в любой момент.",
        confirmLabel: "Отключить",
      });
      if (!ok) return;
    }

    try {
      if (user.is_active) {
        await api.deactivateUser(token, user.id);
        toast.success(`${user.username} отключён`);
      } else {
        await api.activateUser(token, user.id);
        toast.success(`${user.username} снова активен`);
      }
      reload();
    } catch (err) {
      reportError(err, "Не удалось изменить статус пользователя");
    }
  }

  return (
    <Section
      icon={Users}
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
            className={inputClass}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            minLength={3}
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
            className={inputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={10}
            required
            title="Минимум 10 символов"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-300" htmlFor="new-role">
            Роль
          </label>
          <select
            id="new-role"
            className={inputClass}
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
          className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-500 disabled:opacity-50"
        >
          <Plus size={16} aria-hidden="true" />
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
              <tr
                key={u.id}
                className={
                  u.is_active
                    ? "border-t border-slate-800 hover:bg-slate-900/50"
                    : "border-t border-slate-800 text-slate-500 hover:bg-slate-900/50"
                }
              >
                <td className="px-4 py-2">
                  {u.username}
                  {u.id === currentUserId && (
                    <span className="ml-2 text-xs text-slate-500">это вы</span>
                  )}
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
                      title={u.is_active ? "Отключить доступ" : "Вернуть доступ"}
                      className={
                        u.is_active
                          ? "inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-amber-400 hover:bg-amber-950/40"
                          : "inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-emerald-400 hover:bg-emerald-950/40"
                      }
                    >
                      {u.is_active ? <PowerOff size={14} /> : <Power size={14} />}
                      {u.is_active ? "Отключить" : "Включить"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

// ── Журнал действий ──

const ACTION_LABEL = {
  login: "вход",
  login_failed: "неудачный вход",
  create_scan: "запуск скана",
  cancel_scan: "отмена скана",
  delete_scan: "удаление скана",
  add_scope: "добавлен диапазон",
  delete_scope: "убран диапазон",
  create_user: "создан пользователь",
  deactivate_user: "отключён пользователь",
  activate_user: "включён пользователь",
  change_password: "смена пароля",
  export_report: "выгрузка отчёта",
};

function AuditSection({ token }) {
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState("");
  const PAGE = 25;

  const reload = useCallback(async () => {
    try {
      const page = await api.listAudit(token, {
        limit: PAGE,
        offset,
        action: filter || undefined,
      });
      setEntries(page.items);
      setTotal(page.total);
    } catch (err) {
      reportError(err, "Не удалось загрузить журнал");
    }
  }, [token, offset, filter]);

  useEffect(() => {
    reload();
  }, [reload]);

  const hasPrev = offset > 0;
  const hasNext = offset + PAGE < total;

  return (
    <Section
      icon={ClipboardList}
      title="Журнал действий"
      hint="Кто, что и когда сделал. Журнал только пополняется — записи не редактируются и не удаляются."
    >
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <select
          className={`${inputClass} w-auto text-sm`}
          value={filter}
          onChange={(e) => {
            setOffset(0);
            setFilter(e.target.value);
          }}
          aria-label="Фильтр по действию"
        >
          <option value="">все действия</option>
          {Object.entries(ACTION_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <span className="text-sm text-slate-500">
          {total > 0 ? `${offset + 1}–${Math.min(offset + PAGE, total)} из ${total}` : "пусто"}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-900 text-slate-400">
            <tr>
              <th className="px-4 py-2 font-medium">Время</th>
              <th className="px-4 py-2 font-medium">Кто</th>
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
              <tr
                key={e.id}
                className={
                  e.action === "login_failed"
                    ? "border-t border-slate-800 bg-red-950/20"
                    : "border-t border-slate-800 hover:bg-slate-900/50"
                }
              >
                <td className="whitespace-nowrap px-4 py-2 text-slate-400">
                  {new Date(e.created_at).toLocaleString("ru-RU")}
                </td>
                <td className="px-4 py-2 text-slate-400">{e.user_id ?? "—"}</td>
                <td className="px-4 py-2">{ACTION_LABEL[e.action] ?? e.action}</td>
                <td className="max-w-xs truncate px-4 py-2 font-mono text-xs text-slate-400" title={e.detail}>
                  {e.detail || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(hasPrev || hasNext) && (
        <div className="mt-3 flex items-center justify-between">
          <button
            onClick={() => setOffset(Math.max(0, offset - PAGE))}
            disabled={!hasPrev}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-40"
          >
            ← Назад
          </button>
          <button
            onClick={() => setOffset(offset + PAGE)}
            disabled={!hasNext}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-40"
          >
            Вперёд →
          </button>
        </div>
      )}
    </Section>
  );
}

export function AdminPage() {
  const { token, user } = useAuth();
  const { confirm, dialogProps } = useConfirm();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Header />
      <main className="mx-auto max-w-4xl px-6 py-8">
        <h1 className="mb-8 text-2xl font-semibold">Администрирование</h1>
        <ScopesSection token={token} confirm={confirm} />
        <UsersSection token={token} currentUserId={user?.id} confirm={confirm} />
        <AuditSection token={token} />
      </main>
      <ConfirmDialog {...dialogProps} />
    </div>
  );
}

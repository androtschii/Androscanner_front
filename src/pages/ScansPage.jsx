import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Radar, Search } from "lucide-react";
import { toast } from "sonner";
import { Header } from "../components/Header";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";
import { ApiError, api } from "../lib/api";
import { isPending } from "../lib/scanStatus";

const PAGE_SIZE = 20;

const STATUSES = [
  { value: "", label: "любой статус" },
  { value: "queued", label: "в очереди" },
  { value: "running", label: "выполняется" },
  { value: "done", label: "готово" },
  { value: "failed", label: "ошибка" },
  { value: "cancelled", label: "отменён" },
];

export function ScansPage() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [page, setPage] = useState({ items: [], total: 0 });
  const [offset, setOffset] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState(null);

  const [target, setTarget] = useState("");
  const [profile, setProfile] = useState("quick");
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const canScan = user?.role === "admin" || user?.role === "analyst";

  const reload = useCallback(async () => {
    try {
      setPage(
        await api.listScans(token, {
          limit: PAGE_SIZE,
          offset,
          status: statusFilter || undefined,
          target: search || undefined,
        }),
      );
      setListError(null);
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : "Не удалось загрузить сканы");
    } finally {
      setLoading(false);
    }
  }, [token, offset, statusFilter, search]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Пока хоть один скан в работе — подтягиваем статусы сами
  const anyPending = page.items.some((s) => isPending(s.status));
  useEffect(() => {
    if (!anyPending) return;
    const timer = setInterval(reload, 2000);
    return () => clearInterval(timer);
  }, [anyPending, reload]);

  // Смена фильтра возвращает на первую страницу: иначе можно оказаться
  // на пятой странице выборки, где всего две
  function changeFilter(setter) {
    return (value) => {
      setOffset(0);
      setter(value);
    };
  }

  async function handleCreate(e) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const created = await api.createScan(token, target, profile);
      toast.success(`Скан ${created.target} поставлен в очередь`, {
        description: `Профиль ${created.profile}. Статус обновится сам.`,
      });
      setTarget("");
      setOffset(0);
      reload();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Не удалось запустить скан";
      setFormError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  const from = page.total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + PAGE_SIZE, page.total);
  const hasPrev = offset > 0;
  const hasNext = offset + PAGE_SIZE < page.total;

  const controlClass =
    "rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 outline-none focus:border-sky-500";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Header />

      <main className="mx-auto max-w-4xl px-6 py-8">
        {canScan && (
          <form
            onSubmit={handleCreate}
            className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4"
          >
            <div className="min-w-[180px] flex-1">
              <label className="mb-1 block text-sm text-slate-300" htmlFor="target">
                Цель (IP или CIDR)
              </label>
              <input
                id="target"
                className={`w-full ${controlClass}`}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="192.168.1.10"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-300" htmlFor="profile">
                Профиль
              </label>
              <select
                id="profile"
                className={controlClass}
                value={profile}
                onChange={(e) => setProfile(e.target.value)}
              >
                <option value="discovery">discovery — ARP, нужны права админа</option>
                <option value="quick">quick — 100 портов, без прав</option>
                <option value="full">full — все порты + ОС, нужны права админа</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-500 disabled:opacity-50"
            >
              <Radar size={16} aria-hidden="true" />
              {submitting ? "Запускаю…" : "Запустить скан"}
            </button>
            {formError && <p className="w-full text-sm text-red-400">{formError}</p>}
          </form>
        )}

        {/* Фильтры отдельной строкой над таблицей, а не внутри неё */}
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[180px] flex-1">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              aria-hidden="true"
            />
            <input
              className={`${controlClass} w-full pl-9 text-sm`}
              value={search}
              onChange={(e) => changeFilter(setSearch)(e.target.value)}
              placeholder="Поиск по цели"
              aria-label="Поиск по цели"
            />
          </div>
          <select
            className={`${controlClass} text-sm`}
            value={statusFilter}
            onChange={(e) => changeFilter(setStatusFilter)(e.target.value)}
            aria-label="Фильтр по статусу"
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <span className="text-sm text-slate-500">
            {page.total > 0 ? `${from}–${to} из ${page.total}` : "ничего не найдено"}
          </span>
        </div>

        {listError && <p className="mb-3 text-sm text-red-400">{listError}</p>}

        <div className="overflow-hidden rounded-xl border border-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900 text-slate-400">
              <tr>
                <th className="px-4 py-2 font-medium">Цель</th>
                <th className="px-4 py-2 font-medium">Профиль</th>
                <th className="px-4 py-2 font-medium">Статус</th>
                <th className="px-4 py-2 font-medium">Создан</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-500" colSpan={4}>
                    Загрузка…
                  </td>
                </tr>
              )}
              {!loading && page.items.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-500" colSpan={4}>
                    {search || statusFilter
                      ? "Под фильтр ничего не подошло"
                      : "Сканов пока нет"}
                  </td>
                </tr>
              )}
              {page.items.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => navigate(`/scans/${s.id}`)}
                  className="cursor-pointer border-t border-slate-800 hover:bg-slate-900"
                >
                  <td className="px-4 py-2 font-mono">{s.target}</td>
                  <td className="px-4 py-2">{s.profile}</td>
                  <td className="px-4 py-2">
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="px-4 py-2 text-slate-400">
                    {new Date(s.created_at).toLocaleString("ru-RU")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {(hasPrev || hasNext) && (
          <div className="mt-3 flex items-center justify-between">
            <button
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              disabled={!hasPrev}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-40"
            >
              <ChevronLeft size={15} aria-hidden="true" />
              Назад
            </button>
            <span className="text-sm text-slate-500">
              страница {Math.floor(offset / PAGE_SIZE) + 1} из{" "}
              {Math.max(1, Math.ceil(page.total / PAGE_SIZE))}
            </span>
            <button
              onClick={() => setOffset(offset + PAGE_SIZE)}
              disabled={!hasNext}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-40"
            >
              Вперёд
              <ChevronRight size={15} aria-hidden="true" />
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

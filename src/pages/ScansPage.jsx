import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRef } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Download,
  Radar,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { Header } from "../components/Header";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";
import { ApiError, api } from "../lib/api";
import { downloadCsv } from "../lib/csv";
import { isPending } from "../lib/scanStatus";
import { formatElapsed, scanDurationSeconds, useElapsed } from "../lib/useElapsed";
import { MOD_LABEL, useHotkey } from "../lib/useHotkey";

/**
 * Строка таблицы вынесена в отдельный компонент, а не инлайн в .map():
 * useElapsed вызывается для каждой строки, и делать это напрямую внутри
 * callback у .map() нарушало бы правило хуков — число вызовов зависело
 * бы от длины списка.
 */
function ScanRow({ scan, onClick }) {
  const pending = isPending(scan.status);
  const elapsed = useElapsed(scan.created_at, pending);
  const finishedDuration = !pending ? scanDurationSeconds(scan) : null;

  return (
    <tr
      onClick={onClick}
      className="cursor-pointer border-t border-slate-800 hover:bg-slate-900"
    >
      <td className="px-4 py-2 font-mono">{scan.target}</td>
      <td className="px-4 py-2">{scan.profile}</td>
      <td className="px-4 py-2">
        <div className="flex items-center gap-2">
          <StatusBadge status={scan.status} />
          {pending && (
            <span className="font-mono text-xs text-slate-500">{formatElapsed(elapsed)}</span>
          )}
        </div>
      </td>
      <td className="px-4 py-2 text-slate-400">
        {new Date(scan.created_at).toLocaleString("ru-RU")}
      </td>
      <td className="px-4 py-2 font-mono text-slate-400">
        {finishedDuration === null ? "—" : formatElapsed(finishedDuration)}
      </td>
    </tr>
  );
}

const SORT_COLUMNS = [
  { key: "target", label: "Цель" },
  { key: "profile", label: "Профиль" },
  { key: "status", label: "Статус" },
  { key: "created_at", label: "Создан" },
  { key: "duration", label: "Длительность" },
];

function sortValue(scan, key) {
  if (key === "duration") return scanDurationSeconds(scan) ?? -1;
  if (key === "created_at") return new Date(scan.created_at).getTime();
  return String(scan[key] ?? "").toLowerCase();
}

/**
 * Сортировка — только внутри уже загруженной страницы (20 строк): сервер
 * всегда отдаёт их по created_at desc, а тянуть с бэкенда сортировку
 * по произвольной колонке ради 20 строк на экране избыточно.
 */
function sortItems(items, sortKey, sortDir) {
  if (!sortKey) return items;
  const sorted = [...items].sort((a, b) => {
    const av = sortValue(a, sortKey);
    const bv = sortValue(b, sortKey);
    if (av < bv) return -1;
    if (av > bv) return 1;
    return 0;
  });
  return sortDir === "desc" ? sorted.reverse() : sorted;
}

function SortableHeader({ column, sortKey, sortDir, onSort }) {
  const active = sortKey === column.key;
  return (
    <th className="px-4 py-2 font-medium">
      <button
        type="button"
        onClick={() => onSort(column.key)}
        className="inline-flex items-center gap-1 hover:text-slate-200"
        aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
      >
        {column.label}
        {active &&
          (sortDir === "asc" ? (
            <ArrowUp size={12} aria-hidden="true" />
          ) : (
            <ArrowDown size={12} aria-hidden="true" />
          ))}
      </button>
    </th>
  );
}

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

  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("asc");

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sortedItems = useMemo(
    () => sortItems(page.items, sortKey, sortDir),
    [page.items, sortKey, sortDir],
  );

  const canScan = user?.role === "admin" || user?.role === "analyst";
  const searchRef = useRef(null);

  // «/» ставит курсор в поиск — привычка из почты и GitHub
  useHotkey("/", () => searchRef.current?.focus());
  // Escape очищает поиск, не убирая фокус
  useHotkey("escape", () => { setSearch(""); setOffset(0); }, { allowInInput: true });

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

  function exportCsv() {
    downloadCsv(
      `androscanner-scans-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { key: "id", label: "ID" },
        { key: "target", label: "Цель" },
        { key: "profile", label: "Профиль" },
        { key: "status", label: "Статус" },
        {
          key: "created_at",
          label: "Создан",
          get: (s) => new Date(s.created_at).toLocaleString("ru-RU"),
        },
        {
          key: "duration",
          label: "Длительность",
          get: (s) => {
            const sec = scanDurationSeconds(s);
            return sec === null ? "—" : formatElapsed(sec);
          },
        },
      ],
      sortedItems,
    );
    toast.success(`Выгружено строк: ${page.items.length}`);
  }

  const from = page.total === 0 ? 0 : offset + 1;
  // По числу реально пришедших строк, а не по размеру страницы:
  // на последней странице их меньше, и «1–20 из 137» было бы неправдой
  const to = offset + page.items.length;
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
                <optgroup label="Без прав администратора">
                  <option value="ping">ping — только живые хосты, без портов</option>
                  <option value="quick">quick — 100 портов</option>
                  <option value="top1000">top1000 — 1000 портов</option>
                  <option value="version">version — версии сервисов</option>
                  <option value="vuln">vuln — известные уязвимости (медленно)</option>
                </optgroup>
                <optgroup label="Нужны права администратора">
                  <option value="discovery">discovery — ARP по своему сегменту</option>
                  <option value="udp">udp — DNS/SNMP/DHCP и другие UDP-порты</option>
                  <option value="full">full — все 65535 портов + ОС</option>
                  <option value="aggressive">aggressive — версии + ОС + скрипты разом</option>
                </optgroup>
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
              ref={searchRef}
              className={`${controlClass} w-full pl-9 pr-9 text-sm`}
              value={search}
              onChange={(e) => changeFilter(setSearch)(e.target.value)}
              placeholder="Поиск по цели"
              aria-label="Поиск по цели"
            />
            <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-slate-700 px-1 text-[10px] text-slate-500">
              /
            </kbd>
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
          <button
            onClick={exportCsv}
            disabled={page.items.length === 0}
            title="Выгрузить текущую страницу в CSV"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-40"
          >
            <Download size={14} aria-hidden="true" />
            CSV
          </button>
        </div>

        {listError && <p className="mb-3 text-sm text-red-400">{listError}</p>}

        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900 text-slate-400">
              <tr>
                {SORT_COLUMNS.map((c) => (
                  <SortableHeader
                    key={c.key}
                    column={c}
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-500" colSpan={5}>
                    Загрузка…
                  </td>
                </tr>
              )}
              {!loading && page.items.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-500" colSpan={5}>
                    {search || statusFilter
                      ? "Под фильтр ничего не подошло"
                      : "Сканов пока нет"}
                  </td>
                </tr>
              )}
              {sortedItems.map((s) => (
                <ScanRow key={s.id} scan={s} onClick={() => navigate(`/scans/${s.id}`)} />
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
        <p className="mt-6 text-center text-xs text-slate-600">
          <kbd className="rounded border border-slate-700 px-1">/</kbd> поиск ·{" "}
          <kbd className="rounded border border-slate-700 px-1">{MOD_LABEL}+K</kbd> команды
        </p>
      </main>
    </div>
  );
}

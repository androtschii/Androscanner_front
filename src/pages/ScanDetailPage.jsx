import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  Loader2,
  Monitor,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Header } from "../components/Header";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { assessPortRisk } from "../lib/portRisk";
import { isPending } from "../lib/scanStatus";
import { formatElapsed, scanDurationSeconds, useElapsed } from "../lib/useElapsed";
import { useConfirm } from "../lib/useConfirm";

/** Бэкенд хранит результат JSON-строкой в поле result. */
function parseResult(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return { error: "Результат повреждён: не удалось разобрать JSON" };
  }
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
      <div className="text-2xl font-semibold text-slate-100">{value}</div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  );
}

const SORTS = {
  port: (a, b) => a.port - b.port,
  state: (a, b) => a.state.localeCompare(b.state) || a.port - b.port,
  service: (a, b) => (a.service || "").localeCompare(b.service || "") || a.port - b.port,
};

/**
 * Заголовок-кнопка для сортировки.
 *
 * Объявлен СНАРУЖИ PortsTable намеренно: компонент, созданный внутри
 * рендера другого компонента, на каждом рендере оказывается новым типом,
 * и React размонтирует с ним всё поддерево вместо обновления.
 */
function SortHeader({ column, sortBy, onSort, children }) {
  const active = sortBy === column;
  return (
    <th className="px-4 py-2 font-medium">
      <button
        onClick={() => onSort(column)}
        className={
          active
            ? "inline-flex items-center gap-1 text-slate-200"
            : "inline-flex items-center gap-1 hover:text-slate-200"
        }
        title={`Сортировать по «${children}»`}
        aria-pressed={active}
      >
        {children}
        <ArrowUpDown size={12} aria-hidden="true" />
      </button>
    </th>
  );
}

/**
 * Только для открытых портов — закрытый порт неэксплуатируем, бейдж
 * риска на нём был бы ложной тревогой.
 */
function RiskBadge({ port, service, state }) {
  if (state !== "open") return null;
  const risk = assessPortRisk(port, service);
  if (!risk) return null;

  const cls =
    risk.level === "high"
      ? "border-red-800 bg-red-950/40 text-red-300"
      : "border-amber-800 bg-amber-950/40 text-amber-300";

  return (
    <span
      title={risk.reason}
      className={`ml-2 inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium ${cls}`}
    >
      <AlertTriangle size={10} aria-hidden="true" />
      {risk.level === "high" ? "высокий риск" : "стоит проверить"}
    </span>
  );
}

function PortsTable({ ports }) {
  const [sortBy, setSortBy] = useState("port");
  const [onlyOpen, setOnlyOpen] = useState(false);

  if (ports.length === 0) {
    return <p className="px-4 py-3 text-sm text-slate-500">Портов не обнаружено</p>;
  }

  const closedCount = ports.filter((p) => p.state !== "open").length;
  const shown = (onlyOpen ? ports.filter((p) => p.state === "open") : ports)
    .slice()
    .sort(SORTS[sortBy]);

  return (
    <>
      {closedCount > 0 && (
        <div className="border-b border-slate-800 px-4 py-2">
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={onlyOpen}
              onChange={(e) => setOnlyOpen(e.target.checked)}
              className="accent-sky-600"
            />
            Только открытые (скрыть {closedCount})
          </label>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-slate-400">
            <tr className="border-b border-slate-800">
              <SortHeader column="port" sortBy={sortBy} onSort={setSortBy}>
                Порт
              </SortHeader>
              <SortHeader column="state" sortBy={sortBy} onSort={setSortBy}>
                Состояние
              </SortHeader>
              <SortHeader column="service" sortBy={sortBy} onSort={setSortBy}>
                Сервис
              </SortHeader>
              <th className="px-4 py-2 font-medium">Версия</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((p) => (
              <tr
                key={`${p.protocol}-${p.port}`}
                className="border-b border-slate-800/50 last:border-0 hover:bg-slate-800/40"
              >
                <td className="px-4 py-2 font-mono">
                  {p.port}
                  <span className="ml-1 text-xs text-slate-500">{p.protocol}</span>
                </td>
                <td className="px-4 py-2">
                  <span className={p.state === "open" ? "text-emerald-400" : "text-slate-500"}>
                    {p.state}
                  </span>
                </td>
                <td className="px-4 py-2">
                  {p.service || "—"}
                  <RiskBadge port={p.port} service={p.service} state={p.state} />
                </td>
                <td className="px-4 py-2 text-slate-400">
                  {[p.product, p.version].filter(Boolean).join(" ") || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function HostCard({ host, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const openCount = host.ports.filter((p) => p.state === "open").length;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-800">
      {/* Шапка — кнопка: хосты сворачиваются, чтобы длинный список
          не приходилось прокручивать целиком */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full flex-wrap items-center justify-between gap-2 bg-slate-900 px-4 py-3 text-left hover:bg-slate-800/60"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          {open ? (
            <ChevronDown size={16} className="text-slate-500" aria-hidden="true" />
          ) : (
            <ChevronRight size={16} className="text-slate-500" aria-hidden="true" />
          )}
          <Monitor size={15} className="text-slate-500" aria-hidden="true" />
          <span className="font-mono text-base text-slate-100">{host.ip}</span>
          {host.hostnames.length > 0 && (
            <span className="text-sm text-slate-400">{host.hostnames.join(", ")}</span>
          )}
        </div>
        <span className="text-xs text-slate-400">
          {openCount} откр. из {host.ports.length}
        </span>
      </button>

      {open && (
        <>
          {(host.mac || host.os.length > 0) && (
            <dl className="flex flex-wrap gap-x-8 gap-y-1 border-b border-slate-800 px-4 py-2 text-sm">
              {host.mac && (
                <div>
                  <dt className="inline text-slate-400">MAC: </dt>
                  <dd className="inline font-mono">{host.mac}</dd>
                  {host.vendor && <span className="ml-1 text-slate-400">({host.vendor})</span>}
                </div>
              )}
              {host.os.length > 0 && (
                <div>
                  <dt className="inline text-slate-400">ОС: </dt>
                  <dd className="inline">
                    {host.os[0].name}
                    <span className="ml-1 text-slate-500">{host.os[0].accuracy}%</span>
                  </dd>
                </div>
              )}
            </dl>
          )}
          <PortsTable ports={host.ports} />
        </>
      )}
    </div>
  );
}

export function ScanDetailPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const { confirm, dialogProps } = useConfirm();

  const [scan, setScan] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setScan(await api.getScan(token, id));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    load();
  }, [load]);

  // Пока скан в работе — опрашиваем сервер. Зависим от флага, а не от
  // объекта scan: иначе интервал пересоздавался бы на каждом обновлении.
  const pending = scan ? isPending(scan.status) : false;
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(load, 2000);
    return () => clearInterval(timer);
  }, [pending, load]);

  const elapsedSeconds = useElapsed(scan?.created_at, pending);
  const finishedDuration = scan ? scanDurationSeconds(scan) : null;

  async function downloadReport() {
    setPdfBusy(true);
    const toastId = toast.loading("Готовлю PDF…");
    try {
      const blob = await api.scanReport(token, id);
      // Ссылку на объект обязательно освобождаем, иначе Blob висит в памяти
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `androscanner-scan-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Отчёт скачан", { id: toastId });
    } catch (err) {
      toast.error("Не удалось собрать PDF", { id: toastId, description: err.message });
    } finally {
      setPdfBusy(false);
    }
  }

  async function cancel() {
    const ok = await confirm({
      title: "Отменить скан?",
      message:
        "Выполнение прервётся. То, что уже успело найтись, сохранится, " +
        "но скан останется помеченным как отменённый.",
      confirmLabel: "Отменить скан",
      cancelLabel: "Пусть работает",
    });
    if (!ok) return;

    setCancelBusy(true);
    try {
      setScan(await api.cancelScan(token, id));
      toast.success("Скан отменён");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCancelBusy(false);
    }
  }

  const result = parseResult(scan?.result);

  // Отменить может админ или тот, кто запустил. Кнопку прячем от
  // остальных, но настоящая проверка — на бэкенде.
  const canCancel =
    scan && isPending(scan.status) && (user?.role === "admin" || scan.created_by === user?.id);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Header />
      <main className="mx-auto max-w-4xl px-6 py-8">
        <Link
          to="/scans"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-sky-400 hover:underline"
        >
          <ArrowLeft size={15} aria-hidden="true" />
          К списку сканов
        </Link>

        {loading && (
          <p className="flex items-center gap-2 text-slate-500">
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            Загрузка…
          </p>
        )}
        {error && <p className="text-red-400">{error}</p>}

        {scan && (
          <>
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <h1 className="font-mono text-2xl font-semibold">{scan.target}</h1>
              <StatusBadge status={scan.status} />
              <span className="text-sm text-slate-400">профиль {scan.profile}</span>
              {finishedDuration !== null && (
                <span className="font-mono text-sm text-slate-400" title="сколько скан реально шёл">
                  {formatElapsed(finishedDuration)}
                </span>
              )}
              <span className="text-sm text-slate-500">
                {new Date(scan.created_at).toLocaleString("ru-RU")}
              </span>

              <div className="ml-auto flex gap-2">
                {canCancel && (
                  <button
                    onClick={cancel}
                    disabled={cancelBusy}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-800 px-3 py-1.5 text-sm text-amber-300 hover:bg-amber-950/40 disabled:opacity-50"
                  >
                    <XCircle size={15} aria-hidden="true" />
                    {cancelBusy ? "Отменяю…" : "Отменить"}
                  </button>
                )}
                <button
                  onClick={downloadReport}
                  disabled={pdfBusy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                >
                  {pdfBusy ? (
                    <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Download size={15} aria-hidden="true" />
                  )}
                  PDF
                </button>
              </div>
            </div>

            {scan.status === "cancelled" && !result && (
              <p className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-6 text-center text-slate-400">
                Скан отменён до того, как успел что-то найти
              </p>
            )}

            {isPending(scan.status) && (
              <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-6 text-slate-400">
                <div className="flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  {scan.status === "queued" ? "В очереди…" : "Скан выполняется…"}
                </div>
                {/* Живой секундомер — без него не видно, движется ли
                    процесс вообще: тяжёлые профили (vuln, full) идут
                    минутами, и статичная надпись читалась бы как зависание */}
                <span className="font-mono text-2xl text-slate-200">
                  {formatElapsed(elapsedSeconds)}
                </span>
                <span className="text-xs text-slate-500">
                  профиль «{scan.profile}» — страница обновится сама
                </span>
              </div>
            )}

            {result?.error && (
              <div className="rounded-xl border border-red-900 bg-red-950/40 px-4 py-3">
                <h2 className="mb-1 font-medium text-red-300">Скан не выполнен</h2>
                <p className="text-sm text-red-200">{result.error}</p>
              </div>
            )}

            {result && !result.error && (
              <>
                <div className="mb-6 grid grid-cols-3 gap-3">
                  <Stat label="хостов найдено" value={result.stats.hosts_total} />
                  <Stat label="из них живых" value={result.stats.hosts_up} />
                  <Stat label="открытых портов" value={result.stats.open_ports} />
                </div>

                <p className="mb-4 flex items-center gap-1.5 text-xs text-slate-500">
                  <FileText size={13} aria-hidden="true" />
                  nmap {result.arguments} · {new Date(result.scanned_at).toLocaleString("ru-RU")}
                </p>

                <div className="space-y-3">
                  {result.hosts.map((h, i) => (
                    // Первый хост раскрыт, остальные свёрнуты: обычно
                    // смотрят один-два, а не весь список
                    <HostCard key={h.ip} host={h} defaultOpen={i === 0} />
                  ))}
                  {result.hosts.length === 0 && (
                    <p className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-6 text-center text-slate-500">
                      Живых хостов не найдено
                    </p>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </main>
      <ConfirmDialog {...dialogProps} />
    </div>
  );
}

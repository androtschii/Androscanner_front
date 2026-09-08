import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Header } from "../components/Header";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { isPending } from "../lib/scanStatus";

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

function PortsTable({ ports }) {
  if (ports.length === 0) {
    return <p className="px-4 py-3 text-sm text-slate-500">Портов не обнаружено</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-slate-400">
          <tr className="border-b border-slate-800">
            <th className="px-4 py-2 font-medium">Порт</th>
            <th className="px-4 py-2 font-medium">Состояние</th>
            <th className="px-4 py-2 font-medium">Сервис</th>
            <th className="px-4 py-2 font-medium">Версия</th>
          </tr>
        </thead>
        <tbody>
          {ports.map((p) => (
            <tr key={`${p.protocol}-${p.port}`} className="border-b border-slate-800/50 last:border-0">
              <td className="px-4 py-2 font-mono">
                {p.port}
                <span className="ml-1 text-xs text-slate-500">{p.protocol}</span>
              </td>
              <td className="px-4 py-2">
                <span className={p.state === "open" ? "text-emerald-400" : "text-slate-500"}>
                  {p.state}
                </span>
              </td>
              <td className="px-4 py-2">{p.service || "—"}</td>
              <td className="px-4 py-2 text-slate-400">
                {[p.product, p.version].filter(Boolean).join(" ") || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HostCard({ host }) {
  const openCount = host.ports.filter((p) => p.state === "open").length;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900 px-4 py-3">
        <div>
          <span className="font-mono text-base text-slate-100">{host.ip}</span>
          {host.hostnames.length > 0 && (
            <span className="ml-2 text-sm text-slate-400">{host.hostnames.join(", ")}</span>
          )}
        </div>
        <span className="text-xs text-slate-400">
          {openCount} откр. из {host.ports.length}
        </span>
      </div>

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
    </div>
  );
}

export function ScanDetailPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const [scan, setScan] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState(null);

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

  // Пока скан в работе — опрашиваем сервер, чтобы не жать F5 вручную.
  // Зависим от флага, а не от объекта scan: иначе интервал пересоздавался бы
  // на каждом обновлении данных.
  const pending = scan ? isPending(scan.status) : false;
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(load, 2000);
    return () => clearInterval(timer);
  }, [pending, load]);

  async function downloadReport() {
    setPdfError(null);
    setPdfBusy(true);
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
    } catch (err) {
      setPdfError(err.message);
    } finally {
      setPdfBusy(false);
    }
  }

  const result = parseResult(scan?.result);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Header />
      <main className="mx-auto max-w-4xl px-6 py-8">
        <Link to="/scans" className="mb-6 inline-block text-sm text-sky-400 hover:underline">
          ← К списку сканов
        </Link>

        {loading && <p className="text-slate-500">Загрузка…</p>}
        {error && <p className="text-red-400">{error}</p>}

        {scan && (
          <>
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <h1 className="font-mono text-2xl font-semibold">{scan.target}</h1>
              <StatusBadge status={scan.status} />
              <span className="text-sm text-slate-400">профиль {scan.profile}</span>
              <span className="text-sm text-slate-500">
                {new Date(scan.created_at).toLocaleString("ru-RU")}
              </span>
              <button
                onClick={downloadReport}
                disabled={pdfBusy}
                className="ml-auto rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
              >
                {pdfBusy ? "Готовлю PDF…" : "Скачать PDF"}
              </button>
            </div>

            {pdfError && (
              <p className="mb-4 rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
                {pdfError}
              </p>
            )}

            {isPending(scan.status) && (
              <p className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-6 text-center text-slate-400">
                Скан выполняется, страница обновится сама…
              </p>
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

                <p className="mb-4 text-xs text-slate-500">
                  nmap {result.arguments} · {new Date(result.scanned_at).toLocaleString("ru-RU")}
                </p>

                <div className="space-y-4">
                  {result.hosts.map((h) => (
                    <HostCard key={h.ip} host={h} />
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
    </div>
  );
}

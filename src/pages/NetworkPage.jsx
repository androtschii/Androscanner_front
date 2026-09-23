import { useEffect, useState } from "react";
import { Download, Table2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { CopyableIp } from "../components/CopyableIp";
import { Header } from "../components/Header";
import { NetworkGraph } from "../components/NetworkGraph";
import { useAuth } from "../context/AuthContext";
import { ApiError, api } from "../lib/api";
import { downloadCsv } from "../lib/csv";
import { classifyDevice } from "../lib/deviceKind";

const KIND_LABELS = {
  all: "Все типы",
  phone: "Телефоны",
  computer: "Компьютеры",
  server: "Серверы",
  router: "Роутеры / точки доступа",
  printer: "Принтеры",
  unknown: "Прочее",
};

function hostKind(h) {
  return classifyDevice({
    services: h.services,
    vendor: h.vendor,
    os: h.os,
    openPortsCount: h.open_ports,
  }).kind;
}

function HostDetails({ host }) {
  if (!host) {
    return (
      <p className="text-sm text-slate-500">
        Выберите узел на карте, чтобы посмотреть подробности
      </p>
    );
  }

  const rows = [
    ["Имена", host.hostnames.length ? host.hostnames.join(", ") : null],
    ["MAC", host.mac],
    ["Производитель", host.vendor],
    ["ОС", host.os],
    ["Открытых портов", host.open_ports],
    ["Сервисы", host.services.length ? host.services.join(", ") : null],
    ["Последний раз виден", host.last_seen ? new Date(host.last_seen).toLocaleString("ru-RU") : null],
  ].filter(([, v]) => v !== null && v !== undefined && v !== "");

  return (
    <>
      <h3 className="mb-3 text-lg text-slate-100">
        <CopyableIp value={host.ip} />
      </h3>
      <dl className="space-y-1.5 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex gap-2">
            <dt className="w-40 shrink-0 text-slate-400">{label}</dt>
            <dd className="text-slate-200">{value}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}

/** Табличный двойник карты: те же данные, доступные без графики. */
function HostTable({ hosts }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-900 text-slate-400">
          <tr>
            <th className="px-4 py-2 font-medium">IP</th>
            <th className="px-4 py-2 font-medium">Имена</th>
            <th className="px-4 py-2 font-medium">Портов</th>
            <th className="px-4 py-2 font-medium">Сервисы</th>
          </tr>
        </thead>
        <tbody>
          {hosts.map((h) => (
            <tr key={h.ip} className="border-t border-slate-800">
              <td className="px-4 py-2">
                <CopyableIp value={h.ip} />
              </td>
              <td className="px-4 py-2 text-slate-400">{h.hostnames.join(", ") || "—"}</td>
              <td className="px-4 py-2 tabular-nums">{h.open_ports}</td>
              <td className="px-4 py-2 text-slate-400">{h.services.join(", ") || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function NetworkPage() {
  const { token } = useAuth();
  const [map, setMap] = useState(null);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [asTable, setAsTable] = useState(false);
  const [kindFilter, setKindFilter] = useState("all");

  useEffect(() => {
    api
      .networkMap(token)
      .then(setMap)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Не удалось загрузить карту сети"),
      );
  }, [token]);

  const allHosts = map
    ? [...map.networks.flatMap((n) => n.hosts), ...map.ungrouped]
    : [];

  function byKind(hosts) {
    return kindFilter === "all" ? hosts : hosts.filter((h) => hostKind(h) === kindFilter);
  }

  const filteredHosts = byKind(allHosts);
  const filteredNetworks = map
    ? map.networks.map((n) => ({ ...n, hosts: byKind(n.hosts) }))
    : [];
  const filteredUngrouped = map ? byKind(map.ungrouped) : [];

  function exportCsv() {
    downloadCsv(
      `androscanner-hosts-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { key: "ip", label: "IP" },
        { key: "hostnames", label: "Имена", get: (h) => h.hostnames.join("; ") },
        { key: "mac", label: "MAC", get: (h) => h.mac ?? "" },
        { key: "vendor", label: "Производитель", get: (h) => h.vendor ?? "" },
        { key: "os", label: "ОС", get: (h) => h.os ?? "" },
        { key: "open_ports", label: "Открытых портов" },
        { key: "services", label: "Сервисы", get: (h) => h.services.join("; ") },
        {
          key: "last_seen",
          label: "Последний раз виден",
          get: (h) => (h.last_seen ? new Date(h.last_seen).toLocaleString("ru-RU") : ""),
        },
      ],
      filteredHosts,
    );
    toast.success(`Выгружено хостов: ${filteredHosts.length}`);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Header />
      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Карта сети</h1>
            <p className="mt-1 text-sm text-slate-400">
              Все хосты из завершённых сканов, разложенные по разрешённым диапазонам.
            </p>
          </div>
          {allHosts.length > 0 && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <select
                value={kindFilter}
                onChange={(e) => setKindFilter(e.target.value)}
                aria-label="Фильтр по типу устройства"
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-300 outline-none focus:border-sky-500"
              >
                {Object.entries(KIND_LABELS).map(([kind, label]) => (
                  <option key={kind} value={kind}>
                    {label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setAsTable((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-400 hover:bg-slate-800"
              >
                {asTable ? <Share2 size={14} /> : <Table2 size={14} />}
                {asTable ? "Карта" : "Таблица"}
              </button>
              <button
                onClick={exportCsv}
                title="Выгрузить все найденные хосты в CSV"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-400 hover:bg-slate-800"
              >
                <Download size={14} aria-hidden="true" />
                CSV
              </button>
            </div>
          )}
        </div>

        {error && <p className="text-red-400">{error}</p>}
        {!map && !error && <p className="text-slate-500">Загрузка…</p>}

        {map && allHosts.length === 0 && (
          <p className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-8 text-center text-slate-400">
            Хостов пока не найдено. Запустите скан — и они появятся здесь.
          </p>
        )}

        {map && allHosts.length > 0 && (
          <>
            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Stat label="хостов найдено" value={map.totals.hosts} />
              <Stat label="диапазонов" value={map.totals.networks} />
              <Stat label="открытых портов" value={map.totals.open_ports} />
            </div>

            {kindFilter !== "all" && (
              <p className="mb-4 text-sm text-slate-400">
                Показано {filteredHosts.length} из {allHosts.length} хостов — фильтр «
                {KIND_LABELS[kindFilter]}»
              </p>
            )}

            {asTable ? (
              <HostTable hosts={filteredHosts} />
            ) : (
              <>
                <div className="space-y-6">
                  {filteredNetworks.map((n) => (
                    <section key={n.cidr} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                      <h2 className="mb-1 font-medium text-slate-100">
                        {n.cidr}
                        {n.description && (
                          <span className="ml-2 text-sm font-normal text-slate-400">
                            {n.description}
                          </span>
                        )}
                      </h2>
                      <NetworkGraph
                        cidr={n.cidr}
                        hosts={n.hosts}
                        onSelect={setSelected}
                        selectedIp={selected?.ip}
                      />
                    </section>
                  ))}
                </div>

                {filteredUngrouped.length > 0 && (
                  <section className="mt-6 rounded-xl border border-amber-900/60 bg-slate-900 p-4">
                    <h2 className="mb-1 font-medium text-amber-300">
                      Вне разрешённых диапазонов ({filteredUngrouped.length})
                    </h2>
                    <p className="mb-3 text-sm text-slate-400">
                      Эти хосты найдены сканами, но сейчас не попадают ни в один диапазон —
                      скорее всего, диапазон убрали из allowed-scope после скана.
                    </p>
                    <HostTable hosts={filteredUngrouped} />
                  </section>
                )}

                <section className="mt-6 rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <HostDetails host={selected} />
                </section>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
      <div className="text-2xl font-semibold text-slate-100">{value}</div>
      <div className="mt-0.5 text-xs text-slate-400">{label}</div>
    </div>
  );
}

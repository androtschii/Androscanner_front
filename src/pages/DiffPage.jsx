import { useEffect, useState } from "react";
import { Header } from "../components/Header";
import { useAuth } from "../context/AuthContext";
import { ApiError, api } from "../lib/api";

/** Порт с сервисом одной строкой: «22/tcp ssh». */
function PortLine({ port }) {
  return (
    <span className="font-mono text-sm">
      {port.port}/{port.protocol}
      {port.service && <span className="ml-1.5 text-slate-400">{port.service}</span>}
    </span>
  );
}

/**
 * Знак изменения. Символ + подпись, не только цвет: «появилось» и «исчезло»
 * различаются текстом, поэтому строки читаются и в чёрно-белой печати,
 * и при дальтонизме.
 */
function ChangeList({ sign, label, items, tone }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h4 className={`mb-1 text-xs font-medium uppercase tracking-wide ${tone}`}>
        {sign} {label} ({items.length})
      </h4>
      <ul className="space-y-0.5">
        {items.map((p) => (
          <li key={`${p.protocol}-${p.port}`}>
            <PortLine port={p} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function HostBlock({ title, tone, sign, hosts }) {
  if (hosts.length === 0) return null;
  return (
    <section className="mb-6">
      <h3 className={`mb-2 font-medium ${tone}`}>
        {sign} {title} ({hosts.length})
      </h3>
      <div className="space-y-3">
        {hosts.map((h) => (
          <div key={h.ip} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="mb-2 font-mono text-slate-100">{h.ip}</div>
            {h.ports.length > 0 ? (
              <ul className="space-y-0.5">
                {h.ports.map((p) => (
                  <li key={`${p.protocol}-${p.port}`}>
                    <PortLine port={p} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">Открытых портов нет</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export function DiffPage() {
  const { token } = useAuth();
  const [scans, setScans] = useState([]);
  const [base, setBase] = useState("");
  const [compare, setCompare] = useState("");
  const [diff, setDiff] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .listScans(token)
      .then((all) => {
        // Сравнивать имеет смысл только успешно завершённые
        const done = all.filter((s) => s.status === "done");
        setScans(done);
        // По умолчанию — два последних: список приходит от новых к старым
        if (done.length >= 2) {
          setCompare(String(done[0].id));
          setBase(String(done[1].id));
        }
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Не удалось загрузить список сканов"),
      );
  }, [token]);

  async function run(e) {
    e.preventDefault();
    setError(null);
    setDiff(null);
    setBusy(true);
    try {
      setDiff(await api.diffScans(token, base, compare));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось сравнить");
    } finally {
      setBusy(false);
    }
  }

  const label = (s) =>
    `#${s.id} · ${s.target} · ${new Date(s.created_at).toLocaleString("ru-RU")}`;

  const nothingChanged =
    diff &&
    diff.summary.hosts_added === 0 &&
    diff.summary.hosts_removed === 0 &&
    diff.summary.hosts_changed === 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Header />
      <main className="mx-auto max-w-4xl px-6 py-8">
        <h1 className="mb-1 text-2xl font-semibold">Сравнение сканов</h1>
        <p className="mb-6 text-sm text-slate-400">
          Что изменилось в сети между двумя сканами: новые хосты, открывшиеся и закрывшиеся
          порты, смена версий сервисов.
        </p>

        {scans.length < 2 && !error && (
          <p className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-6 text-center text-slate-400">
            Нужно хотя бы два успешно завершённых скана. Сейчас их {scans.length}.
          </p>
        )}

        {scans.length >= 2 && (
          <form onSubmit={run} className="mb-8 flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1">
              <label className="mb-1 block text-sm text-slate-300" htmlFor="base">
                Раньше
              </label>
              <select
                id="base"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 outline-none focus:border-sky-500"
                value={base}
                onChange={(e) => setBase(e.target.value)}
              >
                {scans.map((s) => (
                  <option key={s.id} value={s.id}>
                    {label(s)}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[220px] flex-1">
              <label className="mb-1 block text-sm text-slate-300" htmlFor="compare">
                Позже
              </label>
              <select
                id="compare"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 outline-none focus:border-sky-500"
                value={compare}
                onChange={(e) => setCompare(e.target.value)}
              >
                {scans.map((s) => (
                  <option key={s.id} value={s.id}>
                    {label(s)}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-500 disabled:opacity-50"
            >
              {busy ? "Сравниваю…" : "Сравнить"}
            </button>
          </form>
        )}

        {error && <p className="mb-6 text-red-400">{error}</p>}

        {diff && (
          <>
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="новых хостов" value={diff.summary.hosts_added} />
              <Stat label="исчезло хостов" value={diff.summary.hosts_removed} />
              <Stat label="портов открылось" value={diff.summary.ports_opened} />
              <Stat label="портов закрылось" value={diff.summary.ports_closed} />
            </div>

            {nothingChanged && (
              <p className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-6 text-center text-slate-400">
                Между этими сканами сеть не изменилась
              </p>
            )}

            <HostBlock
              title="Появились"
              sign="+"
              tone="text-emerald-400"
              hosts={diff.hosts_added}
            />
            <HostBlock
              title="Исчезли"
              sign="−"
              tone="text-amber-400"
              hosts={diff.hosts_removed}
            />

            {diff.host_changes.length > 0 && (
              <section>
                <h3 className="mb-2 font-medium">Изменились ({diff.host_changes.length})</h3>
                <div className="space-y-3">
                  {diff.host_changes.map((h) => (
                    <div key={h.ip} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                      <div className="mb-3 font-mono text-slate-100">{h.ip}</div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <ChangeList
                          sign="+"
                          label="открылось"
                          items={h.ports_opened}
                          tone="text-emerald-400"
                        />
                        <ChangeList
                          sign="−"
                          label="закрылось"
                          items={h.ports_closed}
                          tone="text-amber-400"
                        />
                      </div>
                      {h.services_changed.length > 0 && (
                        <div className="mt-3 border-t border-slate-800 pt-3">
                          <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                            сменилась версия ({h.services_changed.length})
                          </h4>
                          <ul className="space-y-0.5 text-sm">
                            {h.services_changed.map((c) => (
                              <li key={`${c.protocol}-${c.port}`} className="font-mono">
                                {c.port}/{c.protocol}{" "}
                                <span className="text-slate-500">{c.before}</span>
                                <span className="mx-1.5 text-slate-600">→</span>
                                <span className="text-slate-200">{c.after}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
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

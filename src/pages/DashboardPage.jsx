import { useEffect, useState } from "react";
import { BarCard } from "../components/BarCard";
import { Header } from "../components/Header";
import { useAuth } from "../context/AuthContext";
import { ApiError, api } from "../lib/api";

// Проверены валидатором на фоне slate-900: пройдены все шесть проверок,
// включая различимость при дальтонизме.
const BLUE = "#3987e5";
const ORANGE = "#d95926";
const AQUA = "#199e70";

// Статусы — подписанные плитки, а не график: четыре числа это «горстка
// значений», им место в плитках. Заодно снимается проблема пары
// зелёный/красный, неразличимой при дейтеранопии, — цвет здесь лишь
// дублирует подпись, а не несёт смысл в одиночку.
const STATUS = {
  done: { label: "готово", dot: "#0ca30c" },
  failed: { label: "ошибка", dot: "#d03b3b" },
  running: { label: "выполняется", dot: "#64748b" },
  queued: { label: "в очереди", dot: "#475569" },
};

function StatTile({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-4">
      {/* Пропорциональные цифры: tabular-nums на крупных числах смотрится рыхло */}
      <div className="text-3xl font-semibold text-slate-100">{value}</div>
      <div className="mt-1 text-sm text-slate-400">{label}</div>
    </div>
  );
}

function StatusRow({ items }) {
  if (items.length === 0) return null;
  return (
    <section className="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-4">
      <h2 className="mb-3 font-medium text-slate-100">Сканы по статусам</h2>
      <div className="flex flex-wrap gap-x-8 gap-y-3">
        {items.map((s) => {
          const meta = STATUS[s.name] ?? { label: s.name, dot: "#64748b" };
          return (
            <div key={s.name} className="flex items-baseline gap-2">
              <span
                aria-hidden="true"
                className="inline-block h-2.5 w-2.5 shrink-0 translate-y-px rounded-full"
                style={{ backgroundColor: meta.dot }}
              />
              <span className="text-xl font-semibold text-slate-100">{s.count}</span>
              <span className="text-sm text-slate-400">{meta.label}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function DashboardPage() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .analyticsSummary(token)
      .then(setData)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Не удалось загрузить аналитику"),
      );
  }, [token]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Header />
      <main className="mx-auto max-w-4xl px-6 py-8">
        <h1 className="mb-6 text-2xl font-semibold">Дашборд</h1>

        {error && <p className="text-red-400">{error}</p>}
        {!data && !error && <p className="text-slate-500">Загрузка…</p>}

        {data && (
          <>
            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatTile label="сканов запущено" value={data.scans_total} />
              <StatTile label="уникальных хостов найдено" value={data.hosts_unique} />
              <StatTile label="открытых портов суммарно" value={data.open_ports_total} />
            </div>

            <StatusRow items={data.scans_by_status} />

            <div className="space-y-6">
              <BarCard
                title="Самые частые сервисы"
                hint="Сколько раз сервис встретился на открытых портах"
                data={data.top_services}
                color={BLUE}
              />
              <BarCard
                title="Самые частые открытые порты"
                hint="Сколько раз порт оказался открыт"
                data={data.top_ports}
                color={ORANGE}
              />
              <BarCard
                title="Сканы по профилям"
                hint="Какими профилями пользуются чаще"
                data={data.scans_by_profile}
                color={AQUA}
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}

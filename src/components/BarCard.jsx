import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * Горизонтальный столбчатый график для номинальных категорий.
 *
 * Один цвет на все столбцы — намеренно. Красить их градиентом по величине
 * значило бы кодировать длину столбца ещё и оттенком: то же самое дважды,
 * а свободный канал потрачен.
 *
 * У каждого графика есть таблица-двойник: значение никогда не доступно
 * только через наведение мыши.
 */

const AXIS = "#64748b"; // slate-500 — приглушённый текст осей
const GRID = "#1e293b"; // slate-800 — тонкая сплошная сетка
const LABEL = "#94a3b8"; // slate-400 — подписи значений

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm shadow-lg">
      <div className="text-slate-100">{label}</div>
      <div className="text-slate-400">{payload[0].value}</div>
    </div>
  );
}

export function BarCard({ title, hint, data, color, unit = "" }) {
  const [asTable, setAsTable] = useState(false);

  const empty = !data || data.length === 0;
  // Высота под число столбцов + полоса оси X, чтобы подписи не обрезались
  const height = Math.max(140, data.length * 34 + 40);

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-medium text-slate-100">{title}</h2>
          {hint && <p className="text-xs text-slate-400">{hint}</p>}
        </div>
        {!empty && (
          <button
            onClick={() => setAsTable((v) => !v)}
            className="shrink-0 rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-400 hover:bg-slate-800"
          >
            {asTable ? "График" : "Таблица"}
          </button>
        )}
      </div>

      {empty && <p className="py-8 text-center text-sm text-slate-500">Данных пока нет</p>}

      {!empty && asTable && (
        <table className="w-full text-left text-sm">
          <thead className="text-slate-400">
            <tr className="border-b border-slate-800">
              <th className="py-1.5 font-medium">Название</th>
              <th className="py-1.5 text-right font-medium">Количество</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.name} className="border-b border-slate-800/50 last:border-0">
                <td className="py-1.5 font-mono">{d.name}</td>
                <td className="py-1.5 text-right tabular-nums">{d.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!empty && !asTable && (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart
            layout="vertical"
            data={data}
            margin={{ top: 4, right: 36, bottom: 4, left: 4 }}
            barCategoryGap={6}
          >
            {/* Сетка только вертикальная и сплошная: пунктир читался бы как «прогноз» */}
            <CartesianGrid horizontal={false} stroke={GRID} />
            <XAxis
              type="number"
              allowDecimals={false}
              stroke={GRID}
              tick={{ fill: AXIS, fontSize: 12 }}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={100}
              stroke={GRID}
              tick={{ fill: AXIS, fontSize: 12 }}
              tickLine={false}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "#1e293b" }} />
            <Bar dataKey="count" fill={color} barSize={18} radius={[0, 4, 4, 0]}>
              {/* Значение у кончика столбца — не только в подсказке */}
              <LabelList
                dataKey="count"
                position="right"
                fill={LABEL}
                fontSize={12}
                formatter={(v) => `${v}${unit}`}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}

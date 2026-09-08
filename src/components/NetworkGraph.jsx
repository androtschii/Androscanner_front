/**
 * Радиальная карта подсети, нарисованная инлайновым SVG.
 *
 * Без библиотеки намеренно: Recharts уже добавил 362 кБ, тащить ещё одну
 * ради одной страницы неразумно, а радиальная раскладка — это тригонометрия
 * в десять строк.
 *
 * Это карта ПРИНАДЛЕЖНОСТИ, а не топология. Луч «подсеть — хост» означает
 * «адрес входит в этот CIDR», и ничего больше: профили сканирования не
 * выясняют, как устройства соединены между собой.
 */

const HOST = "#3987e5"; // проверенный синий
const CENTER = "#199e70"; // проверенный aqua — узел подсети
const EDGE = "#1e293b"; // slate-800, тонкие лучи
const SURFACE = "#0f172a"; // slate-900 — фон для колец вокруг узлов

/** Радиус узла по числу открытых портов. Площадь ∝ величине, поэтому корень. */
function hostRadius(openPorts) {
  return 7 + Math.sqrt(openPorts) * 3.2;
}

export function NetworkGraph({ cidr, hosts, onSelect, selectedIp }) {
  if (hosts.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-slate-500">
        В этом диапазоне хостов пока не найдено
      </p>
    );
  }

  // Размер холста растёт с числом хостов, чтобы подписи не наезжали друг на друга
  const ring = Math.max(120, Math.min(210, hosts.length * 22));
  const pad = 78;
  const size = (ring + pad) * 2;
  const cx = size / 2;
  const cy = size / 2;

  const placed = hosts.map((h, i) => {
    // Старт с −90°, чтобы первый хост оказался сверху
    const angle = (i / hosts.length) * 2 * Math.PI - Math.PI / 2;
    return {
      ...h,
      x: cx + Math.cos(angle) * ring,
      y: cy + Math.sin(angle) * ring,
      // Подпись уходит наружу от центра
      anchor: Math.cos(angle) > 0.25 ? "start" : Math.cos(angle) < -0.25 ? "end" : "middle",
      labelX: cx + Math.cos(angle) * (ring + 16),
      labelY: cy + Math.sin(angle) * (ring + 16),
    };
  });

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="mx-auto block h-auto w-full max-w-2xl"
        role="img"
        aria-label={`Карта подсети ${cidr}: ${hosts.length} хостов`}
      >
        {/* Лучи рисуем первыми, чтобы узлы легли поверх */}
        {placed.map((h) => (
          <line key={`e-${h.ip}`} x1={cx} y1={cy} x2={h.x} y2={h.y} stroke={EDGE} strokeWidth="1" />
        ))}

        {/* Узел подсети */}
        <circle cx={cx} cy={cy} r="26" fill={CENTER} stroke={SURFACE} strokeWidth="2" />
        <text
          x={cx}
          y={cy + 44}
          textAnchor="middle"
          className="fill-slate-300"
          fontSize="12"
          fontFamily="ui-monospace, monospace"
        >
          {cidr}
        </text>

        {/* Хосты */}
        {placed.map((h) => {
          const selected = h.ip === selectedIp;
          return (
            <g
              key={h.ip}
              onClick={() => onSelect?.(h)}
              className="cursor-pointer"
              tabIndex={0}
              role="button"
              aria-label={`${h.ip}, открытых портов: ${h.open_ports}`}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect?.(h);
                }
              }}
            >
              {/* Прозрачный круг пошире — чтобы попасть мышью по мелкому узлу */}
              <circle cx={h.x} cy={h.y} r="24" fill="transparent" />
              <circle
                cx={h.x}
                cy={h.y}
                r={hostRadius(h.open_ports)}
                fill={HOST}
                stroke={selected ? "#e2e8f0" : SURFACE}
                strokeWidth="2"
              />
              <text
                x={h.labelX}
                y={h.labelY}
                textAnchor={h.anchor}
                dominantBaseline="middle"
                className={selected ? "fill-slate-100" : "fill-slate-400"}
                fontSize="11"
                fontFamily="ui-monospace, monospace"
              >
                {h.ip}
              </text>
            </g>
          );
        })}
      </svg>

      <p className="mt-2 text-center text-xs text-slate-500">
        Размер узла — число открытых портов. Луч означает вхождение адреса в диапазон,
        а не связь между устройствами.
      </p>
    </div>
  );
}

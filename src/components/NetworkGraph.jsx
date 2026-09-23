/**
 * Карта подсети в духе Cisco Packet Tracer: коммутатор сверху, устройства
 * рядом внизу, прямые «кабели» между ними — нарисовано инлайновым SVG.
 *
 * Без библиотеки намеренно: Recharts уже добавил 362 кБ, тащить ещё одну
 * ради одной страницы неразумно, а раскладка в ряд — это просто деление
 * ширины на число хостов.
 *
 * Это карта ПРИНАДЛЕЖНОСТИ, а не топология: верхний узел — не настоящий
 * коммутатор, которого мы не видим, а сама подсеть. Линия «подсеть — хост»
 * означает «адрес входит в этот CIDR», и ничего больше: профили
 * сканирования не выясняют, как устройства физически соединены между
 * собой. Иконки устройств — тоже эвристика по открытым портам и
 * производителю MAC, не гарантия.
 */
import { HardDrive, Monitor, Printer, Router, Server, Smartphone } from "lucide-react";
import { classifyDevice } from "../lib/deviceKind";

const KIND_ICON = {
  printer: Printer,
  phone: Smartphone,
  computer: Monitor,
  server: Server,
  router: Router,
  unknown: HardDrive,
};

const HOST = "#3987e5"; // проверенный синий
const CENTER = "#199e70"; // проверенный aqua — узел подсети
const EDGE = "#475569"; // slate-600 — «кабель»
const SURFACE = "#0f172a"; // slate-900 — фон/иконки поверх узлов

const NODE = 34; // сторона квадрата устройства
const SWITCH = 44; // сторона квадрата коммутатора
const COL_WIDTH = 96; // расстояние между хостами по горизонтали
const TOP_Y = 46;
const HOST_Y = 168;
const LABEL_GAP = 16;

function deviceKind(host) {
  const { kind, label } = classifyDevice({
    services: host.services,
    vendor: host.vendor,
    os: host.os,
    openPortsCount: host.open_ports,
  });
  return { Icon: KIND_ICON[kind], label };
}

export function NetworkGraph({ cidr, hosts, onSelect, selectedIp }) {
  if (hosts.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-slate-500">
        В этом диапазоне хостов пока не найдено
      </p>
    );
  }

  const width = Math.max(360, hosts.length * COL_WIDTH + COL_WIDTH);
  const height = HOST_Y + 56;
  const switchX = width / 2;

  const placed = hosts.map((h, i) => ({
    ...h,
    x: COL_WIDTH / 2 + i * COL_WIDTH + (width - hosts.length * COL_WIDTH) / 2,
    kind: deviceKind(h),
  }));

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mx-auto block h-auto w-full"
        style={{ maxWidth: `${Math.min(width, 720)}px` }}
        role="img"
        aria-label={`Карта подсети ${cidr}: ${hosts.length} хостов`}
      >
        {/* Кабели — прямые линии от коммутатора вниз к каждому устройству,
            с маленьким квадратом-«портом» на обоих концах */}
        {placed.map((h) => (
          <g key={`e-${h.ip}`}>
            <line x1={switchX} y1={TOP_Y + SWITCH / 2} x2={h.x} y2={HOST_Y - NODE / 2} stroke={EDGE} strokeWidth="1.5" />
            <rect x={switchX - 2} y={TOP_Y + SWITCH / 2 - 2} width="4" height="4" fill={EDGE} />
            <rect x={h.x - 2} y={HOST_Y - NODE / 2 - 2} width="4" height="4" fill={EDGE} />
          </g>
        ))}

        {/* Коммутатор подсети — сверху по центру, как в Packet Tracer */}
        <g>
          <rect
            x={switchX - SWITCH / 2}
            y={TOP_Y}
            width={SWITCH}
            height={SWITCH}
            rx="6"
            fill={CENTER}
            stroke={SURFACE}
            strokeWidth="2"
          />
          <Router
            x={switchX - SWITCH / 2 + 8}
            y={TOP_Y + 8}
            width={SWITCH - 16}
            height={SWITCH - 16}
            color={SURFACE}
            aria-hidden="true"
          />
          <text
            x={switchX}
            y={TOP_Y - 8}
            textAnchor="middle"
            className="fill-slate-300"
            fontSize="12"
            fontFamily="ui-monospace, monospace"
          >
            {cidr}
          </text>
        </g>

        {/* Устройства — в ряд, иконка по эвристике вместо голого кружка */}
        {placed.map((h) => {
          const selected = h.ip === selectedIp;
          return (
            <g
              key={h.ip}
              onClick={() => onSelect?.(h)}
              className="cursor-pointer outline-none"
              tabIndex={0}
              role="button"
              aria-label={`${h.ip}, ${h.kind.label}, открытых портов: ${h.open_ports}`}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect?.(h);
                }
              }}
            >
              {/* Прозрачный прямоугольник пошире — чтобы попасть мышью по узлу */}
              <rect
                x={h.x - NODE / 2 - 8}
                y={HOST_Y - NODE / 2 - 8}
                width={NODE + 16}
                height={NODE + 16}
                fill="transparent"
              />
              <rect
                x={h.x - NODE / 2}
                y={HOST_Y - NODE / 2}
                width={NODE}
                height={NODE}
                rx="6"
                fill={HOST}
                stroke={selected ? "#e2e8f0" : SURFACE}
                strokeWidth="2"
              />
              <h.kind.Icon
                x={h.x - NODE / 2 + 6}
                y={HOST_Y - NODE / 2 + 6}
                width={NODE - 12}
                height={NODE - 12}
                color={SURFACE}
                aria-hidden="true"
              />
              {h.open_ports > 0 && (
                <text
                  x={h.x + NODE / 2 - 2}
                  y={HOST_Y - NODE / 2 + 2}
                  textAnchor="end"
                  className="fill-amber-300"
                  fontSize="9"
                  fontWeight="600"
                >
                  {h.open_ports}
                </text>
              )}
              <text
                x={h.x}
                y={HOST_Y + NODE / 2 + LABEL_GAP}
                textAnchor="middle"
                className={selected ? "fill-slate-100" : "fill-slate-400"}
                fontSize="10"
                fontFamily="ui-monospace, monospace"
              >
                {h.ip}
              </text>
            </g>
          );
        })}
      </svg>

      <p className="mt-2 text-center text-xs text-slate-500">
        Число у иконки — открытых портов. Иконка устройства и линия — эвристика по
        открытым портам и MAC-производителю, не подтверждённая физическая связь.
      </p>
    </div>
  );
}

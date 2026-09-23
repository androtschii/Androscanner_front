/**
 * Грубая эвристика «что это за устройство» по тому, что видно снаружи —
 * открытым портам, производителю MAC и определённой ОС. Не диагностика,
 * а подсказка: принтер почти наверняка держит порт 9100, а «сервер» —
 * это просто «много открытых портов», под него попадёт и обычный ПК
 * с файлшарингом. Общий модуль для карты сети и страницы скана —
 * данные туда приходят в разной форме, поэтому вход нормализован.
 *
 * @param {object} params
 * @param {string[]} params.services - имена сервисов на открытых портах
 * @param {string} [params.vendor] - производитель по MAC
 * @param {string} [params.os] - определённая ОС (одна строка, не массив)
 * @param {number} params.openPortsCount
 * @returns {{ kind: string, label: string }}
 */
export function classifyDevice({ services, vendor, os, openPortsCount }) {
  const svc = (services || []).map((s) => s.toLowerCase());
  const v = (vendor || "").toLowerCase();
  const osLower = (os || "").toLowerCase();
  const has = (needle) => svc.some((s) => s.includes(needle));

  if (has("jetdirect") || has("ipp") || has("printer")) {
    return { kind: "printer", label: "принтер" };
  }
  if (osLower.includes("android") || osLower.includes("ios") || /iphone|android/.test(v)) {
    return { kind: "phone", label: "телефон" };
  }
  if (osLower.includes("windows") || osLower.includes("mac os") || osLower.includes("linux")) {
    return { kind: "computer", label: osLower.includes("linux") ? "компьютер (Linux)" : "компьютер" };
  }
  if (
    ["mysql", "postgresql", "redis", "mongodb", "elastic"].some(has) ||
    (openPortsCount ?? 0) >= 5
  ) {
    return { kind: "server", label: "сервер" };
  }
  if (has("microsoft-ds") || has("ms-wbt-server") || has("netbios-ssn")) {
    return { kind: "computer", label: "компьютер" };
  }
  if (/tp-link|netgear|d-link|mikrotik|ubiquiti|asus|keenetic|zyxel|cisco/.test(v)) {
    return { kind: "router", label: "роутер / точка доступа" };
  }
  return { kind: "unknown", label: "устройство" };
}

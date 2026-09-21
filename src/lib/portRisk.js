/**
 * Эвристическая оценка риска открытого порта/сервиса.
 *
 * Зеркалит backend/app/scanner/risk.py — держим оба списка синхронно
 * при изменении правил. Не настоящее сканирование уязвимостей (нет
 * базы CVE), просто известные «обычно опасно оставлять открытым».
 */

const RULES = [
  { ports: [23], keywords: ["telnet"], level: "high", reason: "Telnet передаёт логин и пароль открытым текстом" },
  { ports: [21], keywords: ["ftp"], level: "high", reason: "FTP передаёт логин и пароль открытым текстом" },
  { ports: [512, 513, 514], keywords: ["rlogin", "rsh", "exec", "shell"], level: "high", reason: "Устаревший протокол удалённого доступа без шифрования" },
  { ports: [5900, 5901], keywords: ["vnc"], level: "high", reason: "VNC часто доступен без пароля или со слабым паролем" },
  { ports: [6379], keywords: ["redis"], level: "high", reason: "Redis по умолчанию работает без аутентификации" },
  { ports: [27017, 27018], keywords: ["mongodb", "mongod"], level: "high", reason: "MongoDB по умолчанию работает без аутентификации" },
  { ports: [9200, 9300], keywords: ["elasticsearch", "elastic"], level: "high", reason: "Elasticsearch по умолчанию работает без аутентификации" },
  { ports: [11211], keywords: ["memcached"], level: "high", reason: "Memcached без аутентификации отдаёт данные любому запросу" },
  { ports: [3306], keywords: ["mysql"], level: "medium", reason: "СУБД MySQL доступна из сети — стоит ограничить брандмауэром" },
  { ports: [5432], keywords: ["postgresql"], level: "medium", reason: "СУБД PostgreSQL доступна из сети — стоит ограничить брандмауэром" },
  { ports: [161, 162], keywords: ["snmp"], level: "medium", reason: "SNMP часто использует community-строку по умолчанию «public»" },
  { ports: [3389], keywords: ["ms-wbt-server", "rdp"], level: "medium", reason: "RDP наружу — частая цель перебора паролей и эксплойтов" },
  { ports: [445, 139], keywords: ["microsoft-ds", "netbios-ssn"], level: "medium", reason: "SMB — частая цель эксплойтов (например, WannaCry)" },
];

/**
 * @param {number} port
 * @param {string|null|undefined} service
 * @returns {{level: "high"|"medium", reason: string} | null}
 */
export function assessPortRisk(port, service) {
  const serviceLower = (service || "").toLowerCase();
  for (const rule of RULES) {
    if (rule.ports.includes(port) || rule.keywords.some((k) => serviceLower.includes(k))) {
      return { level: rule.level, reason: rule.reason };
    }
  }
  return null;
}

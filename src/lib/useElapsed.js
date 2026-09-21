import { useEffect, useState } from "react";

/**
 * Секунды с момента `startIso`, обновляется раз в секунду, пока `active`.
 *
 * Используется для живого «выполняется Xс» на месте статичной надписи —
 * в долгих профилях (vuln, full) пользователю иначе не видно, движется
 * ли вообще процесс, как в Nessus с его счётчиком времени скана.
 */
export function useElapsed(startIso, active) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);

  if (!startIso) return 0;
  const start = new Date(startIso).getTime();
  return Math.max(0, Math.floor((now - start) / 1000));
}

/** «1м 05с» вместо голого числа секунд. */
export function formatElapsed(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  if (m === 0) return `${s}с`;
  return `${m}м ${String(s).padStart(2, "0")}с`;
}

/**
 * Сколько скан реально шёл, в секундах. null, если ещё не завершился —
 * updated_at пуст, пока скан висит в queued, и это не то же самое, что 0с.
 */
export function scanDurationSeconds(scan) {
  if (!scan.updated_at) return null;
  const ms = new Date(scan.updated_at).getTime() - new Date(scan.created_at).getTime();
  return Math.max(0, Math.round(ms / 1000));
}

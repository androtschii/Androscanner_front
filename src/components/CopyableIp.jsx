import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { copyToClipboard } from "../lib/clipboard";

/**
 * IP/адрес с кнопкой копирования — набирать вручную на телефоне или
 * при подключении к устройству по SSH/веб-панели неудобно, а адрес
 * на экране почти всегда нужен именно для того, чтобы его куда-то
 * вставить.
 */
export function CopyableIp({ value, className = "" }) {
  const [copied, setCopied] = useState(false);

  async function copy(e) {
    e.stopPropagation(); // строки хостов часто кликабельны сами по себе
    try {
      await copyToClipboard(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Буфер обмена недоступен (нет HTTPS/разрешения) — молча ничего
      // не делаем, адрес всё равно виден и его можно выделить руками
    }
  }

  return (
    <span className={`inline-flex items-center gap-1 font-mono ${className}`}>
      {value}
      <button
        type="button"
        onClick={copy}
        title={copied ? "Скопировано" : "Скопировать адрес"}
        className="text-slate-500 hover:text-sky-400"
      >
        {copied ? (
          <Check size={12} className="text-emerald-400" aria-hidden="true" />
        ) : (
          <Copy size={12} aria-hidden="true" />
        )}
      </button>
    </span>
  );
}

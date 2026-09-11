import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ClipboardList,
  GitCompare,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Network,
  Radar,
  Search,
  Settings,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { MOD_LABEL, useHotkey } from "../lib/useHotkey";

/**
 * Палитра команд по Ctrl+K.
 *
 * Написана вручную, а не на cmdk: та тянет за собой Radix, а нужны здесь
 * фильтрация списка, стрелки и Enter — примерно сто строк. Тот же довод,
 * что и для ConfirmDialog на нативном <dialog> и для SVG-карты сети:
 * зависимость должна окупаться, а не просто существовать.
 */

/** Нечёткий поиск: буквы запроса должны встретиться по порядку. */
function matches(query, text) {
  if (!query) return true;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let i = 0;
  for (const ch of t) {
    if (ch === q[i]) i += 1;
    if (i === q.length) return true;
  }
  return false;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const dialogRef = useRef(null);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const commands = useMemo(() => {
    const list = [
      { id: "dashboard", label: "Дашборд", hint: "итоги и графики", icon: LayoutDashboard, run: () => navigate("/dashboard") },
      { id: "scans", label: "Сканы", hint: "список и запуск", icon: Radar, run: () => navigate("/scans") },
      { id: "network", label: "Карта сети", hint: "хосты по диапазонам", icon: Network, run: () => navigate("/network") },
      { id: "diff", label: "Сравнение сканов", hint: "что изменилось", icon: GitCompare, run: () => navigate("/diff") },
      { id: "profile", label: "Сменить пароль", hint: "свой профиль", icon: KeyRound, run: () => navigate("/profile") },
    ];
    // Админские команды не показываем тем, кому они всё равно недоступны
    if (user?.role === "admin") {
      list.push(
        { id: "admin", label: "Администрирование", hint: "диапазоны и пользователи", icon: Settings, run: () => navigate("/admin") },
        { id: "audit", label: "Журнал действий", hint: "кто что сделал", icon: ClipboardList, run: () => navigate("/admin") },
      );
    }
    list.push({ id: "logout", label: "Выйти", hint: "завершить сеанс", icon: LogOut, run: logout });
    return list;
  }, [navigate, user, logout]);

  const visible = useMemo(
    () => commands.filter((c) => matches(query, `${c.label} ${c.hint}`)),
    [commands, query],
  );

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setCursor(0);
  }, []);

  useHotkey("mod+k", () => setOpen((v) => !v), { allowInInput: true });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      inputRef.current?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Escape и клик по фону закрывают нативный <dialog> сами —
  // синхронизируем наше состояние с этим
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onClose = () => close();
    dialog.addEventListener("close", onClose);
    return () => dialog.removeEventListener("close", onClose);
  }, [close]);

  // Список сузился — курсор мог оказаться за его пределами
  useEffect(() => {
    setCursor((c) => Math.min(c, Math.max(0, visible.length - 1)));
  }, [visible.length]);

  function runCommand(command) {
    close();
    command.run();
  }

  function onKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => (c + 1) % Math.max(1, visible.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => (c - 1 + visible.length) % Math.max(1, visible.length));
    } else if (e.key === "Enter" && visible[cursor]) {
      e.preventDefault();
      runCommand(visible[cursor]);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClick={(e) => e.target === dialogRef.current && close()}
      className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 p-0 text-slate-100 backdrop:bg-slate-950/70"
    >
      <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3">
        <Search size={16} className="shrink-0 text-slate-500" aria-hidden="true" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setCursor(0);
          }}
          onKeyDown={onKeyDown}
          placeholder="Куда перейти или что сделать…"
          aria-label="Поиск команды"
          className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500"
        />
        <kbd className="shrink-0 rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-500">
          esc
        </kbd>
      </div>

      <ul className="max-h-72 overflow-y-auto p-2">
        {visible.length === 0 && (
          <li className="px-3 py-6 text-center text-sm text-slate-500">Ничего не найдено</li>
        )}
        {visible.map((c, i) => {
          const Icon = c.icon;
          return (
            <li key={c.id}>
              <button
                onClick={() => runCommand(c)}
                onMouseEnter={() => setCursor(i)}
                className={
                  i === cursor
                    ? "flex w-full items-center gap-3 rounded-lg bg-slate-800 px-3 py-2 text-left"
                    : "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-slate-800/60"
                }
              >
                <Icon size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
                <span className="text-sm">{c.label}</span>
                <span className="ml-auto text-xs text-slate-500">{c.hint}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="border-t border-slate-800 px-4 py-2 text-[11px] text-slate-500">
        <kbd className="rounded border border-slate-700 px-1">↑</kbd>{" "}
        <kbd className="rounded border border-slate-700 px-1">↓</kbd> выбрать ·{" "}
        <kbd className="rounded border border-slate-700 px-1">enter</kbd> перейти ·{" "}
        <kbd className="rounded border border-slate-700 px-1">{MOD_LABEL}+K</kbd> закрыть
      </div>
    </dialog>
  );
}

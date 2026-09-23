import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import {
  GitCompare,
  LayoutDashboard,
  LogOut,
  Menu,
  Network,
  Radar,
  Settings,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const ROLE_LABEL = { admin: "Администратор", analyst: "Аналитик", viewer: "Наблюдатель" };

function navClass({ isActive }) {
  const base = "inline-flex items-center gap-1.5";
  return isActive ? `${base} text-sky-400` : `${base} text-slate-400 hover:text-slate-100`;
}

// На ширине телефона логотип + 5 пунктов меню в один ряд не помещаются:
// flex без переноса просто раздвигал всю страницу вбок вместо того, чтобы
// перейти на вторую строку. Поэтому на узких экранах ссылки уезжают под
// гамбургер, а на sm и шире — прежний ряд, без гамбургера вообще.
export function Header() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const links = (
    <>
      <NavLink to="/dashboard" className={navClass} onClick={() => setMenuOpen(false)}>
        <LayoutDashboard size={15} aria-hidden="true" />
        Дашборд
      </NavLink>
      <NavLink to="/scans" className={navClass} end onClick={() => setMenuOpen(false)}>
        <Radar size={15} aria-hidden="true" />
        Сканы
      </NavLink>
      <NavLink to="/network" className={navClass} onClick={() => setMenuOpen(false)}>
        <Network size={15} aria-hidden="true" />
        Карта
      </NavLink>
      <NavLink to="/diff" className={navClass} onClick={() => setMenuOpen(false)}>
        <GitCompare size={15} aria-hidden="true" />
        Сравнение
      </NavLink>
      {/* Ссылка только админу — маршрут всё равно закрыт и на бэкенде */}
      {user?.role === "admin" && (
        <NavLink to="/admin" className={navClass} onClick={() => setMenuOpen(false)}>
          <Settings size={15} aria-hidden="true" />
          Администрирование
        </NavLink>
      )}
    </>
  );

  return (
    <header className="border-b border-slate-800">
      <div className="flex items-center justify-between gap-3 px-6 py-4">
        <div className="flex items-center gap-6">
          <Link to="/dashboard" className="text-lg font-semibold hover:text-sky-400">
            Androscanner
          </Link>
          <nav className="hidden items-center gap-4 text-sm sm:flex">{links}</nav>
        </div>

        <div className="hidden items-center gap-4 text-sm sm:flex">
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              isActive ? "text-sky-400" : "text-slate-400 hover:text-slate-100"
            }
            title="Профиль и смена пароля"
          >
            {user?.username} · {ROLE_LABEL[user?.role] ?? user?.role}
          </NavLink>
          <button
            onClick={logout}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 hover:bg-slate-800"
          >
            <LogOut size={14} aria-hidden="true" />
            Выйти
          </button>
        </div>

        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="inline-flex items-center justify-center rounded-lg border border-slate-700 p-2 text-slate-300 hover:bg-slate-800 sm:hidden"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
        >
          {menuOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
        </button>
      </div>

      {menuOpen && (
        <div className="flex flex-col gap-1 border-t border-slate-800 px-6 py-3 text-sm sm:hidden">
          <div className="flex flex-col gap-3 pb-2">{links}</div>
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              isActive ? "text-sky-400" : "text-slate-400 hover:text-slate-100"
            }
            onClick={() => setMenuOpen(false)}
          >
            {user?.username} · {ROLE_LABEL[user?.role] ?? user?.role}
          </NavLink>
          <button
            onClick={() => {
              setMenuOpen(false);
              logout();
            }}
            className="mt-2 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 hover:bg-slate-800"
          >
            <LogOut size={14} aria-hidden="true" />
            Выйти
          </button>
        </div>
      )}
    </header>
  );
}

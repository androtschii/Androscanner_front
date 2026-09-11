import { Link, NavLink } from "react-router-dom";
import {
  GitCompare,
  LayoutDashboard,
  LogOut,
  Network,
  Radar,
  Settings,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const ROLE_LABEL = { admin: "Администратор", analyst: "Аналитик", viewer: "Наблюдатель" };

function navClass({ isActive }) {
  const base = "inline-flex items-center gap-1.5";
  return isActive ? `${base} text-sky-400` : `${base} text-slate-400 hover:text-slate-100`;
}

export function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-6 py-4">
      <div className="flex items-center gap-6">
        <Link to="/dashboard" className="text-lg font-semibold hover:text-sky-400">
          Androscanner
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <NavLink to="/dashboard" className={navClass}>
            <LayoutDashboard size={15} aria-hidden="true" />
            Дашборд
          </NavLink>
          <NavLink to="/scans" className={navClass} end>
            <Radar size={15} aria-hidden="true" />
            Сканы
          </NavLink>
          <NavLink to="/network" className={navClass}>
            <Network size={15} aria-hidden="true" />
            Карта
          </NavLink>
          <NavLink to="/diff" className={navClass}>
            <GitCompare size={15} aria-hidden="true" />
            Сравнение
          </NavLink>
          {/* Ссылка только админу — маршрут всё равно закрыт и на бэкенде */}
          {user?.role === "admin" && (
            <NavLink to="/admin" className={navClass}>
              <Settings size={15} aria-hidden="true" />
              Администрирование
            </NavLink>
          )}
        </nav>
      </div>

      <div className="flex items-center gap-4 text-sm">
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
    </header>
  );
}

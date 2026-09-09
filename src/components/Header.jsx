import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ROLE_LABEL = { admin: "Администратор", analyst: "Аналитик", viewer: "Наблюдатель" };

function navClass({ isActive }) {
  return isActive ? "text-sky-400" : "text-slate-400 hover:text-slate-100";
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
            Дашборд
          </NavLink>
          <NavLink to="/scans" className={navClass} end>
            Сканы
          </NavLink>
          <NavLink to="/network" className={navClass}>
            Карта
          </NavLink>
          <NavLink to="/diff" className={navClass}>
            Сравнение
          </NavLink>
          {/* Ссылка только админу — маршрут всё равно закрыт и на бэкенде */}
          {user?.role === "admin" && (
            <NavLink to="/admin" className={navClass}>
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
          className="rounded-lg border border-slate-700 px-3 py-1.5 hover:bg-slate-800"
        >
          Выйти
        </button>
      </div>
    </header>
  );
}

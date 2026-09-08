import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ROLE_LABEL = { admin: "Администратор", analyst: "Аналитик", viewer: "Наблюдатель" };

export function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
      <Link to="/scans" className="text-lg font-semibold hover:text-sky-400">
        Androscanner
      </Link>
      <div className="flex items-center gap-4 text-sm">
        <span className="text-slate-400">
          {user?.username} · {ROLE_LABEL[user?.role] ?? user?.role}
        </span>
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

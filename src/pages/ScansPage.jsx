import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "../components/Header";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";
import { ApiError, api } from "../lib/api";
import { isPending } from "../lib/scanStatus";

export function ScansPage() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState("");
  const [profile, setProfile] = useState("quick");
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const canScan = user?.role === "admin" || user?.role === "analyst";

  const reload = useCallback(async () => {
    try {
      setScans(await api.listScans(token));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Пока хоть один скан в работе — подтягиваем статусы сами.
  // Зависим от флага, а не от массива scans: иначе интервал пересоздавался бы
  // на каждом обновлении списка.
  const anyPending = scans.some((s) => isPending(s.status));
  useEffect(() => {
    if (!anyPending) return;
    const timer = setInterval(reload, 2000);
    return () => clearInterval(timer);
  }, [anyPending, reload]);

  async function handleCreate(e) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await api.createScan(token, target, profile);
      setTarget("");
      reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Не удалось запустить скан");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Header />

      <main className="mx-auto max-w-4xl px-6 py-8">
        {canScan && (
          <form
            onSubmit={handleCreate}
            className="mb-8 flex flex-wrap items-end gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4"
          >
            <div className="min-w-[180px] flex-1">
              <label className="mb-1 block text-sm text-slate-300" htmlFor="target">
                Цель (IP или CIDR)
              </label>
              <input
                id="target"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 outline-none focus:border-sky-500"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="192.168.1.10"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-300" htmlFor="profile">
                Профиль
              </label>
              <select
                id="profile"
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 outline-none focus:border-sky-500"
                value={profile}
                onChange={(e) => setProfile(e.target.value)}
              >
                <option value="discovery">discovery — ARP, нужны права админа</option>
                <option value="quick">quick — 100 портов, без прав</option>
                <option value="full">full — все порты + ОС, нужны права админа</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-500 disabled:opacity-50"
            >
              {submitting ? "Запускаю…" : "Запустить скан"}
            </button>
            {formError && <p className="w-full text-sm text-red-400">{formError}</p>}
          </form>
        )}

        <div className="overflow-hidden rounded-xl border border-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900 text-slate-400">
              <tr>
                <th className="px-4 py-2 font-medium">Цель</th>
                <th className="px-4 py-2 font-medium">Профиль</th>
                <th className="px-4 py-2 font-medium">Статус</th>
                <th className="px-4 py-2 font-medium">Создан</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-500" colSpan={4}>
                    Загрузка…
                  </td>
                </tr>
              )}
              {!loading && scans.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-500" colSpan={4}>
                    Сканов пока нет
                  </td>
                </tr>
              )}
              {scans.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => navigate(`/scans/${s.id}`)}
                  className="cursor-pointer border-t border-slate-800 hover:bg-slate-900"
                >
                  <td className="px-4 py-2 font-mono">{s.target}</td>
                  <td className="px-4 py-2">{s.profile}</td>
                  <td className="px-4 py-2">
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="px-4 py-2 text-slate-400">
                    {new Date(s.created_at).toLocaleString("ru-RU")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

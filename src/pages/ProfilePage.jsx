import { useState } from "react";
import { Header } from "../components/Header";
import { useAuth } from "../context/AuthContext";
import { ApiError, api } from "../lib/api";

const ROLE_LABEL = { admin: "Администратор", analyst: "Аналитик", viewer: "Наблюдатель" };
const MIN_LENGTH = 10;

export function ProfilePage() {
  const { user, token } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  // Совпадение проверяем на месте: гонять на сервер заведомо неверную
  // пару незачем, а подсказка нужна сразу
  const mismatch = repeat.length > 0 && next !== repeat;
  const tooShort = next.length > 0 && next.length < MIN_LENGTH;

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setDone(false);
    setBusy(true);
    try {
      await api.changePassword(token, current, next);
      setDone(true);
      setCurrent("");
      setNext("");
      setRepeat("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось сменить пароль");
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 outline-none focus:border-sky-500";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Header />
      <main className="mx-auto max-w-md px-6 py-8">
        <h1 className="mb-1 text-2xl font-semibold">Профиль</h1>
        <p className="mb-6 text-sm text-slate-400">
          {user?.username} · {ROLE_LABEL[user?.role] ?? user?.role}
        </p>

        <form onSubmit={submit} className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="mb-4 font-medium">Смена пароля</h2>

          <label className="mb-1 block text-sm text-slate-300" htmlFor="current">
            Текущий пароль
          </label>
          <input
            id="current"
            type="password"
            autoComplete="current-password"
            className={`${inputClass} mb-4`}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />

          <label className="mb-1 block text-sm text-slate-300" htmlFor="next">
            Новый пароль
          </label>
          <input
            id="next"
            type="password"
            autoComplete="new-password"
            className={`${inputClass} ${tooShort ? "mb-1 border-amber-700" : "mb-4"}`}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
          />
          {tooShort && (
            <p className="mb-4 text-xs text-amber-400">
              Не короче {MIN_LENGTH} символов — длина защищает лучше, чем спецсимволы
            </p>
          )}

          <label className="mb-1 block text-sm text-slate-300" htmlFor="repeat">
            Повторите новый пароль
          </label>
          <input
            id="repeat"
            type="password"
            autoComplete="new-password"
            className={`${inputClass} ${mismatch ? "mb-1 border-amber-700" : "mb-4"}`}
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
            required
          />
          {mismatch && <p className="mb-4 text-xs text-amber-400">Пароли не совпадают</p>}

          {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
          {done && (
            <p className="mb-4 rounded-lg border border-emerald-900 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300">
              Пароль изменён. Ранее выданные токены продолжат работать до истечения
              срока — в системе нет их отзыва.
            </p>
          )}

          <button
            type="submit"
            disabled={busy || mismatch || tooShort}
            className="w-full rounded-lg bg-sky-600 px-3 py-2 font-medium text-white transition hover:bg-sky-500 disabled:opacity-50"
          >
            {busy ? "Меняю…" : "Сменить пароль"}
          </button>
        </form>
      </main>
    </div>
  );
}

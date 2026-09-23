import { useEffect, useState } from "react";
import { Gamepad2, RotateCcw } from "lucide-react";
import { botMove, isDraw, newBoard, winningLine } from "../lib/tictactoe";

const BOT_MOVE_DELAY_MS = 450; // без паузы ход бота выглядит как баг, не как ответ

/** Центр клетки i в координатах SVG-сетки 3×3 (для линии победы). */
function cellCenter(i) {
  return { x: (i % 3) + 0.5, y: Math.floor(i / 3) + 0.5 };
}

function Cell({ mark, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || mark !== null}
      className="flex aspect-square items-center justify-center rounded-lg border border-slate-800 bg-slate-950 text-2xl font-bold text-slate-100 transition hover:enabled:bg-slate-800 disabled:cursor-default"
    >
      {mark === "X" && <span className="text-sky-400">✕</span>}
      {mark === "O" && <span className="text-amber-400">○</span>}
    </button>
  );
}

/**
 * Мини-игра для страницы скана — занять руки, пока vuln/full идут минутами.
 * Никак не связана со сканером: бот здесь — простой ИИ на клиенте
 * (lib/tictactoe.js), не Telegram-бот и не бэкенд.
 */
export function TicTacToe() {
  const [playerMark, setPlayerMark] = useState(null); // null — выбор ещё не сделан
  const [board, setBoard] = useState(newBoard());
  const [score, setScore] = useState({ wins: 0, losses: 0, draws: 0 });
  const [win, setWin] = useState(null); // {mark, line} | null
  const [lineDrawn, setLineDrawn] = useState(false);

  const botMark = playerMark === "X" ? "O" : "X";
  const xCount = board.filter((c) => c === "X").length;
  const oCount = board.filter((c) => c === "O").length;
  const turn = xCount === oCount ? "X" : "O";
  const gameOver = win !== null || isDraw(board);
  const isBotTurn = playerMark !== null && !gameOver && turn === botMark;

  // Ход бота — с небольшой паузой, чтобы не выглядело как один и тот же ход
  useEffect(() => {
    if (!isBotTurn) return;
    const timer = setTimeout(() => {
      setBoard((prev) => {
        const move = botMove(prev, botMark, playerMark);
        if (move === null) return prev;
        const next = [...prev];
        next[move] = botMark;
        return next;
      });
    }, BOT_MOVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isBotTurn, botMark, playerMark]);

  // Проверка победы/ничьей после каждого изменения поля, плюс подсчёт счёта
  useEffect(() => {
    const result = winningLine(board);
    if (result) {
      setWin(result);
      setScore((s) =>
        result.mark === playerMark
          ? { ...s, wins: s.wins + 1 }
          : { ...s, losses: s.losses + 1 },
      );
    } else if (isDraw(board)) {
      setScore((s) => ({ ...s, draws: s.draws + 1 }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board]);

  // Линию рисуем анимированно: монтируем с offset=1 (невидима), через кадр
  // переключаем на 0 — CSS-переход «дорисовывает» её в сторону конца линии
  useEffect(() => {
    if (!win) {
      setLineDrawn(false);
      return;
    }
    const frame = requestAnimationFrame(() => setLineDrawn(true));
    return () => cancelAnimationFrame(frame);
  }, [win]);

  function handleCellClick(i) {
    if (gameOver || isBotTurn || board[i] !== null) return;
    const next = [...board];
    next[i] = playerMark;
    setBoard(next);
  }

  function resetBoard() {
    setBoard(newBoard());
    setWin(null);
  }

  function choose(mark) {
    setPlayerMark(mark);
    setBoard(newBoard());
    setWin(null);
  }

  let status = "Выбери, за кого играешь";
  if (playerMark) {
    if (win) status = win.mark === playerMark ? "🎉 Ты выиграл!" : "🤖 Бот выиграл";
    else if (isDraw(board)) status = "Ничья";
    else if (isBotTurn) status = "Бот думает…";
    else status = "Твой ход";
  }

  return (
    <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-medium text-slate-300">
          <Gamepad2 size={15} aria-hidden="true" />
          Крестики-нолики, пока ждём
        </h3>
        <p className="text-xs text-slate-500">
          Победы: <span className="text-emerald-400">{score.wins}</span> · Поражения:{" "}
          <span className="text-red-400">{score.losses}</span> · Ничьи: {score.draws}
        </p>
      </div>

      {playerMark === null ? (
        <div className="flex items-center justify-center gap-3 py-6">
          <button
            onClick={() => choose("X")}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
          >
            Играть за <span className="text-sky-400">✕</span>
          </button>
          <button
            onClick={() => choose("O")}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
          >
            Играть за <span className="text-amber-400">○</span>
          </button>
        </div>
      ) : (
        <>
          <p className="mb-2 text-center text-sm text-slate-400">{status}</p>

          <div className="relative mx-auto grid w-full max-w-[220px] grid-cols-3 gap-1.5">
            {board.map((mark, i) => (
              <Cell
                key={i}
                mark={mark}
                disabled={gameOver || isBotTurn}
                onClick={() => handleCellClick(i)}
              />
            ))}

            {win && (
              <svg
                viewBox="0 0 3 3"
                className="pointer-events-none absolute inset-0 h-full w-full"
                aria-hidden="true"
              >
                <line
                  x1={cellCenter(win.line[0]).x}
                  y1={cellCenter(win.line[0]).y}
                  x2={cellCenter(win.line[2]).x}
                  y2={cellCenter(win.line[2]).y}
                  stroke={win.mark === playerMark ? "#34d399" : "#f87171"}
                  strokeWidth="0.1"
                  strokeLinecap="round"
                  pathLength="1"
                  style={{
                    strokeDasharray: 1,
                    strokeDashoffset: lineDrawn ? 0 : 1,
                    transition: "stroke-dashoffset 0.35s ease-out",
                  }}
                />
              </svg>
            )}
          </div>

          <div className="mt-3 flex items-center justify-center gap-2">
            {gameOver && (
              <button
                onClick={resetBoard}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
              >
                <RotateCcw size={14} aria-hidden="true" />
                Ещё раз
              </button>
            )}
            <button
              onClick={() => setPlayerMark(null)}
              className="text-xs text-slate-500 hover:text-slate-300"
            >
              сменить символ
            </button>
          </div>
        </>
      )}
    </div>
  );
}

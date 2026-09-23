/**
 * Крестики-нолики — логика игры, без React.
 *
 * Зеркалит backend/app/notifications/tictactoe.py (та же игра для бота
 * в Telegram) — держать оба списка правил синхронно при изменении.
 */

export const EMPTY = null;

export const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // горизонтали
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // вертикали
  [0, 4, 8], [2, 4, 6],           // диагонали
];

export function newBoard() {
  return Array(9).fill(EMPTY);
}

/** {mark, line} победившей комбинации или null. */
export function winningLine(board) {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { mark: board[a], line };
    }
  }
  return null;
}

export function isDraw(board) {
  return !winningLine(board) && board.every((c) => c !== EMPTY);
}

function lineWithTwoAndGap(board, mark) {
  for (const [a, b, c] of WIN_LINES) {
    const cells = [board[a], board[b], board[c]];
    if (cells.filter((v) => v === mark).length === 2 && cells.includes(EMPTY)) {
      return [a, b, c][cells.indexOf(EMPTY)];
    }
  }
  return null;
}

/**
 * Ход бота: выиграть, если можно за один ход → заблокировать игрока →
 * центр → угол → что попало. Не минимакс, но не проигрывает по
 * невнимательности — для мини-игры между сканами этого достаточно.
 */
export function botMove(board, botMark, playerMark) {
  const empty = board.reduce((acc, v, i) => (v === EMPTY ? [...acc, i] : acc), []);
  if (empty.length === 0) return null;

  let move = lineWithTwoAndGap(board, botMark);
  if (move !== null) return move;

  move = lineWithTwoAndGap(board, playerMark);
  if (move !== null) return move;

  if (board[4] === EMPTY) return 4;

  for (const i of [0, 2, 6, 8]) {
    if (board[i] === EMPTY) return i;
  }

  return empty[0];
}

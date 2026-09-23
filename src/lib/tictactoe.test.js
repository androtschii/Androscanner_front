import { describe, expect, it } from "vitest";
import { botMove, isDraw, newBoard, winningLine } from "./tictactoe";

describe("newBoard", () => {
  it("9 пустых клеток", () => {
    expect(newBoard()).toEqual(Array(9).fill(null));
  });
});

describe("winningLine", () => {
  it("находит горизонталь", () => {
    const board = newBoard();
    board[0] = board[1] = board[2] = "X";
    expect(winningLine(board)).toEqual({ mark: "X", line: [0, 1, 2] });
  });

  it("находит вертикаль", () => {
    const board = newBoard();
    board[0] = board[3] = board[6] = "O";
    expect(winningLine(board)?.mark).toBe("O");
  });

  it("находит диагональ", () => {
    const board = newBoard();
    board[0] = board[4] = board[8] = "X";
    expect(winningLine(board)?.line).toEqual([0, 4, 8]);
  });

  it("null на пустом поле", () => {
    expect(winningLine(newBoard())).toBeNull();
  });

  it("две подряд — ещё не победа", () => {
    const board = newBoard();
    board[0] = board[1] = "X";
    expect(winningLine(board)).toBeNull();
  });
});

describe("isDraw", () => {
  it("true — поле полное, победителя нет", () => {
    const board = ["X", "O", "X", "X", "O", "O", "O", "X", "X"];
    expect(winningLine(board)).toBeNull();
    expect(isDraw(board)).toBe(true);
  });

  it("false — есть свободные клетки", () => {
    expect(isDraw(newBoard())).toBe(false);
  });

  it("false — есть победитель, даже если поле полное", () => {
    const board = ["X", "X", "X", "O", "O", "X", "X", "O", "O"];
    expect(winningLine(board)?.mark).toBe("X");
    expect(isDraw(board)).toBe(false);
  });
});

describe("botMove", () => {
  it("выигрывает, если может, даже если игрок тоже мог бы", () => {
    const board = newBoard();
    board[0] = board[1] = "O"; // бот выигрывает, поставив в 2
    board[3] = board[4] = "X"; // игрок тоже выиграл бы, поставив в 5
    expect(botMove(board, "O", "X")).toBe(2);
  });

  it("блокирует победу игрока", () => {
    const board = newBoard();
    board[0] = board[1] = "X";
    expect(botMove(board, "O", "X")).toBe(2);
  });

  it("предпочитает центр без срочности", () => {
    const board = newBoard();
    board[0] = "X";
    expect(botMove(board, "O", "X")).toBe(4);
  });

  it("занимает угол, если центр занят", () => {
    const board = newBoard();
    board[4] = "X";
    expect([0, 2, 6, 8]).toContain(botMove(board, "O", "X"));
  });

  it("null на полном поле", () => {
    const board = ["X", "O", "X", "X", "O", "O", "O", "X", "X"];
    expect(botMove(board, "O", "X")).toBeNull();
  });
});

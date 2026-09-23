import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TicTacToe } from "./TicTacToe";

function setup() {
  return render(<TicTacToe />);
}

describe("выбор символа", () => {
  it("сначала предлагает выбрать X или O, поле не показано", () => {
    setup();
    expect(screen.getAllByText(/Играть за/)).toHaveLength(2);
    expect(document.querySelectorAll("button.aspect-square")).toHaveLength(0);
  });

  it("после выбора появляется поле 3×3", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByText("✕").closest("button"));

    // 9 пустых кликабельных клеток
    const cells = document.querySelectorAll("button.aspect-square");
    expect(cells).toHaveLength(9);
  });
});

describe("ход и счёт", () => {
  it("клик по клетке ставит символ игрока", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByText("✕").closest("button"));

    const cells = document.querySelectorAll("button.aspect-square");
    await user.click(cells[0]);

    expect(cells[0]).toHaveTextContent("✕");
  });

  it("бот ходит в ответ после паузы", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ delay: null });
    setup();
    await user.click(screen.getByText("✕").closest("button"));

    const cells = document.querySelectorAll("button.aspect-square");
    await user.click(cells[0]);

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    const marks = Array.from(cells).filter((c) => c.textContent === "○");
    expect(marks.length).toBe(1);
    vi.useRealTimers();
  });

  it("если играть за O, бот (X) ходит первым сам", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ delay: null });
    setup();
    await user.click(screen.getByText("○").closest("button"));

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    const cells = document.querySelectorAll("button.aspect-square");
    const marks = Array.from(cells).filter((c) => c.textContent === "✕");
    expect(marks.length).toBe(1);
    vi.useRealTimers();
  });
});

describe("счётчик", () => {
  it("показывает нулевой счёт до первой игры", () => {
    setup();
    expect(screen.getByText(/Победы:/)).toBeInTheDocument();
  });
});

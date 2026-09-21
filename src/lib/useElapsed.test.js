import { renderHook } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatElapsed, useElapsed } from "./useElapsed";

describe("formatElapsed", () => {
  it("до минуты — просто секунды", () => {
    expect(formatElapsed(0)).toBe("0с");
    expect(formatElapsed(45)).toBe("45с");
  });

  it("от минуты — минуты и секунды, секунды с ведущим нулём", () => {
    expect(formatElapsed(65)).toBe("1м 05с");
    expect(formatElapsed(125)).toBe("2м 05с");
    expect(formatElapsed(600)).toBe("10м 00с");
  });
});

describe("useElapsed", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("без даты старта возвращает 0", () => {
    const { result } = renderHook(() => useElapsed(null, true));
    expect(result.current).toBe(0);
  });

  it("растёт раз в секунду, пока active", () => {
    const start = new Date().toISOString();
    const { result } = renderHook(() => useElapsed(start, true));

    act(() => vi.advanceTimersByTime(3000));
    expect(result.current).toBeGreaterThanOrEqual(3);
  });

  it("не тикает, когда active=false — не опрашиваем завершённый скан", () => {
    const start = new Date(Date.now() - 5000).toISOString();
    const { result } = renderHook(() => useElapsed(start, false));

    const before = result.current;
    act(() => vi.advanceTimersByTime(5000));
    expect(result.current).toBe(before);
  });
});

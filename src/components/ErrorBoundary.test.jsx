import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

function Explodes({ when = true }) {
  if (when) throw new Error("сломался график");
  return <div>всё хорошо</div>;
}

beforeEach(() => {
  // React сам логирует пойманную ошибку — глушим, чтобы не засорять вывод
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("когда всё в порядке", () => {
  it("показывает содержимое как есть", () => {
    render(
      <ErrorBoundary>
        <div>обычная страница</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText("обычная страница")).toBeInTheDocument();
  });
});

describe("когда рендер падает", () => {
  it("показывает объяснение вместо белой страницы", () => {
    render(
      <ErrorBoundary>
        <Explodes />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Страница не отрисовалась")).toBeInTheDocument();
  });

  it("показывает текст ошибки — иначе пришлось бы лезть в консоль", () => {
    render(
      <ErrorBoundary>
        <Explodes />
      </ErrorBoundary>,
    );
    expect(screen.getByText("сломался график")).toBeInTheDocument();
  });

  it("успокаивает насчёт данных: это ошибка интерфейса", () => {
    render(
      <ErrorBoundary>
        <Explodes />
      </ErrorBoundary>,
    );
    expect(screen.getByText(/данные\s+в базе не пострадали/)).toBeInTheDocument();
  });

  it("оставляет след в консоли для разбора", () => {
    render(
      <ErrorBoundary>
        <Explodes />
      </ErrorBoundary>,
    );
    expect(console.error).toHaveBeenCalled();
  });

  it("даёт выход: кнопки «попробовать снова» и «на дашборд»", () => {
    render(
      <ErrorBoundary>
        <Explodes />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("button", { name: /Попробовать снова/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /На дашборд/ })).toBeInTheDocument();
  });
});

describe("восстановление", () => {
  it("после «попробовать снова» рендерит содержимое, если причина ушла", async () => {
    const user = userEvent.setup();

    // Флаг снаружи компонента: React 19 после перехвата САМ повторяет рендер,
    // чтобы отличить разовый сбой от постоянного. Компонент, падающий лишь
    // однажды, восстановится автоматически, и UI ошибки не покажется вовсе —
    // поэтому падаем стабильно, пока флаг не снимут вручную.
    let broken = true;

    function Toggleable() {
      if (broken) throw new Error("постоянный сбой");
      return <div>восстановлено</div>;
    }

    render(
      <ErrorBoundary>
        <Toggleable />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Страница не отрисовалась")).toBeInTheDocument();

    // Чиним причину и просим отрисовать заново
    broken = false;
    await user.click(screen.getByRole("button", { name: /Попробовать снова/ }));
    expect(screen.getByText("восстановлено")).toBeInTheDocument();
  });

  it("если причина осталась, снова показывает ошибку, а не белую страницу", async () => {
    const user = userEvent.setup();

    render(
      <ErrorBoundary>
        <Explodes />
      </ErrorBoundary>,
    );
    await user.click(screen.getByRole("button", { name: /Попробовать снова/ }));
    expect(screen.getByText("Страница не отрисовалась")).toBeInTheDocument();
  });
});

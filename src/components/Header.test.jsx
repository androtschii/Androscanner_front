import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Header } from "./Header";

const logout = vi.hoisted(() => vi.fn());
const mockAuth = vi.hoisted(() => ({ value: {} }));
vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ ...mockAuth.value, logout }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.value = { user: { username: "admin", role: "admin" } };
});

function setup() {
  return render(
    <MemoryRouter>
      <Header />
    </MemoryRouter>,
  );
}

describe("гамбургер-меню", () => {
  it("закрыто по умолчанию", () => {
    setup();
    expect(screen.getByLabelText("Открыть меню")).toBeInTheDocument();
    // Мобильная панель — отдельный, ещё не отрендеренный блок ссылок,
    // а не просто спрятанный CSS-ом: кнопка выхода там должна быть одна
    expect(screen.getAllByText("Выйти")).toHaveLength(1);
  });

  it("открывается по клику и показывает ссылки и выход", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByLabelText("Открыть меню"));

    expect(screen.getByLabelText("Закрыть меню")).toBeInTheDocument();
    expect(screen.getAllByText("Выйти")).toHaveLength(2); // десктопная + мобильная
    expect(screen.getAllByText("Дашборд").length).toBeGreaterThan(0);
  });

  it("закрывается повторным нажатием на ту же кнопку", async () => {
    const user = userEvent.setup();
    setup();

    const toggle = screen.getByLabelText("Открыть меню");
    await user.click(toggle);
    await user.click(screen.getByLabelText("Закрыть меню"));

    expect(screen.getByLabelText("Открыть меню")).toBeInTheDocument();
    expect(screen.getAllByText("Выйти")).toHaveLength(1);
  });

  it("закрывается при клике на пункт меню", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByLabelText("Открыть меню"));
    const mobilePanel = screen.getByLabelText("Закрыть меню").closest("header");
    await user.click(within(mobilePanel).getAllByText("Сканы")[1]);

    expect(screen.getByLabelText("Открыть меню")).toBeInTheDocument();
  });

  it("выход из мобильной панели вызывает logout", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByLabelText("Открыть меню"));
    const buttons = screen.getAllByText("Выйти");
    await user.click(buttons[1]); // мобильная кнопка — вторая в DOM

    expect(logout).toHaveBeenCalledOnce();
  });
});

describe("права", () => {
  it("ссылка на администрирование видна только admin", () => {
    mockAuth.value = { user: { username: "vasya", role: "viewer" } };
    setup();
    expect(screen.queryByText("Администрирование")).not.toBeInTheDocument();
  });

  it("ссылка на администрирование видна admin", () => {
    setup();
    expect(screen.getByText("Администрирование")).toBeInTheDocument();
  });
});

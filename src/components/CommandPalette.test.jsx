import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { CommandPalette } from "./CommandPalette";

const navigate = vi.hoisted(() => vi.fn());
vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => navigate,
}));

const mockAuth = vi.hoisted(() => ({ value: {} }));
const logout = vi.hoisted(() => vi.fn());
vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ ...mockAuth.value, logout }),
}));

beforeAll(() => {
  // jsdom не реализует нативный <dialog> — подменяем на переключение .open
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.value = { user: { role: "admin" } };
});

function setup() {
  const utils = render(
    <MemoryRouter>
      <CommandPalette />
    </MemoryRouter>,
  );
  // Закрытый <dialog> скрыт, и getByRole его не находит — берём напрямую
  return { ...utils, dialog: () => utils.container.querySelector("dialog") };
}

async function openPalette(user) {
  await user.keyboard("{Control>}k{/Control}");
}

describe("открытие", () => {
  it("закрыта по умолчанию", () => {
    const { dialog } = setup();
    expect(dialog().open).toBe(false);
  });

  it("Ctrl+K открывает", async () => {
    const user = userEvent.setup();
    const { dialog } = setup();
    await openPalette(user);
    expect(dialog().open).toBe(true);
  });

  it("повторное Ctrl+K закрывает", async () => {
    const user = userEvent.setup();
    const { dialog } = setup();
    await openPalette(user);
    await openPalette(user);
    expect(dialog().open).toBe(false);
  });
});

describe("поиск", () => {
  it("показывает все команды без запроса", async () => {
    const user = userEvent.setup();
    setup();
    await openPalette(user);
    expect(screen.getByText("Дашборд")).toBeInTheDocument();
    expect(screen.getByText("Сканы")).toBeInTheDocument();
  });

  it("фильтрует по введённому", async () => {
    const user = userEvent.setup();
    setup();
    await openPalette(user);
    await user.type(screen.getByLabelText("Поиск команды"), "карта");

    expect(screen.getByText("Карта сети")).toBeInTheDocument();
    expect(screen.queryByText("Дашборд")).not.toBeInTheDocument();
  });

  it("ищет нечётко — буквы по порядку, не подряд", async () => {
    const user = userEvent.setup();
    setup();
    await openPalette(user);
    await user.type(screen.getByLabelText("Поиск команды"), "срвн");

    expect(screen.getByText("Сравнение сканов")).toBeInTheDocument();
  });

  it("сообщает, когда ничего не нашлось", async () => {
    const user = userEvent.setup();
    setup();
    await openPalette(user);
    await user.type(screen.getByLabelText("Поиск команды"), "щщщщщ");

    expect(screen.getByText("Ничего не найдено")).toBeInTheDocument();
  });
});

describe("выполнение", () => {
  it("клик по команде переходит по маршруту", async () => {
    const user = userEvent.setup();
    setup();
    await openPalette(user);
    await user.click(screen.getByText("Карта сети"));

    expect(navigate).toHaveBeenCalledWith("/network");
  });

  it("Enter выполняет выбранную команду", async () => {
    const user = userEvent.setup();
    setup();
    await openPalette(user);
    await user.type(screen.getByLabelText("Поиск команды"), "карта");
    await user.keyboard("{Enter}");

    expect(navigate).toHaveBeenCalledWith("/network");
  });

  it("стрелка вниз сдвигает выбор", async () => {
    const user = userEvent.setup();
    setup();
    await openPalette(user);
    await user.keyboard("{ArrowDown}{Enter}");

    // Первая команда — дашборд, вторая — сканы
    expect(navigate).toHaveBeenCalledWith("/scans");
  });

  it("после выполнения палитра закрывается", async () => {
    const user = userEvent.setup();
    const { dialog } = setup();
    await openPalette(user);
    await user.click(screen.getByText("Дашборд"));

    expect(dialog().open).toBe(false);
  });

  it("команда «Выйти» вызывает logout, а не навигацию", async () => {
    const user = userEvent.setup();
    setup();
    await openPalette(user);
    await user.click(screen.getByText("Выйти"));

    expect(logout).toHaveBeenCalled();
  });
});

describe("разграничение по роли", () => {
  it("админ видит команды администрирования", async () => {
    const user = userEvent.setup();
    setup();
    await openPalette(user);
    expect(screen.getByText("Администрирование")).toBeInTheDocument();
  });

  it("наблюдателю админские команды не показываются", async () => {
    mockAuth.value = { user: { role: "viewer" } };
    const user = userEvent.setup();
    setup();
    await openPalette(user);

    expect(screen.queryByText("Администрирование")).not.toBeInTheDocument();
    expect(screen.getByText("Сканы")).toBeInTheDocument();
  });

  it("аналитику админские команды тоже не показываются", async () => {
    mockAuth.value = { user: { role: "analyst" } };
    const user = userEvent.setup();
    setup();
    await openPalette(user);

    expect(screen.queryByText("Администрирование")).not.toBeInTheDocument();
  });
});

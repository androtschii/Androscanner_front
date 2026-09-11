import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminPage } from "./AdminPage";

const mockAuth = vi.hoisted(() => ({ value: {} }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => mockAuth.value }));

const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), loading: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock }));

vi.mock("../lib/api", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    api: {
      listScopes: vi.fn(),
      createScope: vi.fn(),
      deleteScope: vi.fn(),
      listUsers: vi.fn(),
      createUser: vi.fn(),
      deactivateUser: vi.fn(),
      activateUser: vi.fn(),
      listAudit: vi.fn(),
    },
  };
});

import { api } from "../lib/api";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
});

const SCOPES = [{ id: 1, cidr: "192.168.1.0/24", description: "дом" }];
const USERS = [
  { id: 1, username: "admin", role: "admin", is_active: true, created_at: "2026-01-01T00:00:00Z" },
  { id: 2, username: "vasya", role: "viewer", is_active: true, created_at: "2026-01-02T00:00:00Z" },
  { id: 3, username: "petya", role: "analyst", is_active: false, created_at: "2026-01-03T00:00:00Z" },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.value = { user: { id: 1, role: "admin" }, token: "t" };
  api.listScopes.mockResolvedValue(SCOPES);
  api.listUsers.mockResolvedValue(USERS);
  api.listAudit.mockResolvedValue({ items: [], total: 0, limit: 25, offset: 0 });
});

// Header внутри страницы использует ссылки роутера — без обёртки
// компонент не смонтируется
const setup = () =>
  render(
    <MemoryRouter>
      <AdminPage />
    </MemoryRouter>,
  );

/** Находит кнопку подтверждения внутри открытого диалога. */
async function confirmDialog(user, label) {
  const dialog = await screen.findByRole("dialog");
  await user.click(within(dialog).getByRole("button", { name: label }));
}

describe("диапазоны", () => {
  it("показывает существующие", async () => {
    setup();
    expect(await screen.findByText("192.168.1.0/24")).toBeInTheDocument();
  });

  it("предупреждает, когда список пуст", async () => {
    api.listScopes.mockResolvedValue([]);
    setup();
    expect(await screen.findByText(/сканировать нельзя ничего/)).toBeInTheDocument();
  });

  it("добавляет диапазон", async () => {
    const user = userEvent.setup();
    api.createScope.mockResolvedValue({ id: 2, cidr: "10.0.0.0/24", description: "" });
    setup();
    await screen.findByText("192.168.1.0/24");

    await user.type(screen.getByLabelText("CIDR"), "10.0.0.0/24");
    await user.click(screen.getByRole("button", { name: /Добавить/ }));

    await waitFor(() => expect(api.createScope).toHaveBeenCalledWith("t", "10.0.0.0/24", ""));
  });

  it("сообщает, каким диапазон записался на самом деле", async () => {
    // Введённый 192.168.1.77/24 канонизируется в 192.168.1.0/24 —
    // об этом нужно сказать, а не молча сохранить другое
    const user = userEvent.setup();
    api.createScope.mockResolvedValue({ id: 2, cidr: "192.168.1.0/24", description: "" });
    setup();
    await screen.findByText("192.168.1.0/24");

    await user.type(screen.getByLabelText("CIDR"), "192.168.1.77/24");
    await user.click(screen.getByRole("button", { name: /Добавить/ }));

    await waitFor(() =>
      expect(toastMock.success).toHaveBeenCalledWith(expect.stringContaining("192.168.1.0/24")),
    );
  });
});

describe("удаление диапазона требует подтверждения", () => {
  it("сразу ничего не удаляет", async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText("192.168.1.0/24");

    await user.click(screen.getByRole("button", { name: /Убрать/ }));

    expect(api.deleteScope).not.toHaveBeenCalled();
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("объясняет последствие, а не спрашивает «вы уверены»", async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText("192.168.1.0/24");
    await user.click(screen.getByRole("button", { name: /Убрать/ }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/сканировать эту сеть станет нельзя/)).toBeInTheDocument();
  });

  it("удаляет после подтверждения", async () => {
    const user = userEvent.setup();
    api.deleteScope.mockResolvedValue({});
    setup();
    await screen.findByText("192.168.1.0/24");

    await user.click(screen.getByRole("button", { name: /Убрать/ }));
    await confirmDialog(user, "Убрать");

    await waitFor(() => expect(api.deleteScope).toHaveBeenCalledWith("t", 1));
  });

  it("отказ от подтверждения оставляет всё как было", async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText("192.168.1.0/24");

    await user.click(screen.getByRole("button", { name: /Убрать/ }));
    await confirmDialog(user, "Отмена");

    expect(api.deleteScope).not.toHaveBeenCalled();
  });
});

describe("пользователи", () => {
  it("показывает статус активности", async () => {
    setup();
    await screen.findByText("vasya");

    const active = screen.getByText("vasya").closest("tr");
    expect(within(active).getByText("активен")).toBeInTheDocument();

    const disabled = screen.getByText("petya").closest("tr");
    expect(within(disabled).getByText("отключён")).toBeInTheDocument();
  });

  it("себя отключить нельзя — кнопки нет", async () => {
    setup();
    await screen.findByText("admin");

    const own = screen.getByText("admin").closest("tr");
    expect(within(own).queryByRole("button")).not.toBeInTheDocument();
    expect(within(own).getByText("это вы")).toBeInTheDocument();
  });

  it("создаёт пользователя с выбранной ролью", async () => {
    const user = userEvent.setup();
    api.createUser.mockResolvedValue({ id: 4 });
    setup();
    await screen.findByText("vasya");

    await user.type(screen.getByLabelText("Логин"), "novyy");
    await user.type(screen.getByLabelText("Пароль"), "dlinnyy-parol");
    await user.selectOptions(screen.getByLabelText("Роль"), "analyst");
    await user.click(screen.getByRole("button", { name: /Создать/ }));

    await waitFor(() =>
      expect(api.createUser).toHaveBeenCalledWith("t", "novyy", "dlinnyy-parol", "analyst"),
    );
  });
});

describe("отключение пользователя требует подтверждения", () => {
  it("сразу не отключает", async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText("vasya");

    const row = screen.getByText("vasya").closest("tr");
    await user.click(within(row).getByRole("button", { name: /Отключить/ }));

    expect(api.deactivateUser).not.toHaveBeenCalled();
  });

  it("предупреждает о немедленной потере доступа", async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText("vasya");

    const row = screen.getByText("vasya").closest("tr");
    await user.click(within(row).getByRole("button", { name: /Отключить/ }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/потеряет доступ немедленно/)).toBeInTheDocument();
  });

  it("отключает после подтверждения", async () => {
    const user = userEvent.setup();
    api.deactivateUser.mockResolvedValue({});
    setup();
    await screen.findByText("vasya");

    const row = screen.getByText("vasya").closest("tr");
    await user.click(within(row).getByRole("button", { name: /Отключить/ }));
    await confirmDialog(user, "Отключить");

    await waitFor(() => expect(api.deactivateUser).toHaveBeenCalledWith("t", 2));
  });

  it("включение обратно подтверждения не требует — оно безопасно", async () => {
    const user = userEvent.setup();
    api.activateUser.mockResolvedValue({});
    const { container } = setup();
    await screen.findByText("petya");

    const row = screen.getByText("petya").closest("tr");
    await user.click(within(row).getByRole("button", { name: /Включить/ }));

    await waitFor(() => expect(api.activateUser).toHaveBeenCalledWith("t", 3));
    // Закрытый <dialog> скрыт и по роли не находится — проверяем напрямую
    expect(container.querySelector("dialog").open).toBe(false);
  });
});

describe("журнал действий", () => {
  it("переводит названия действий на русский", async () => {
    api.listAudit.mockResolvedValue({
      items: [
        { id: 1, user_id: 1, action: "login_failed", detail: "zloumyshlennik", created_at: "2026-03-01T10:00:00Z" },
      ],
      total: 1,
      limit: 25,
      offset: 0,
    });
    setup();
    expect(await screen.findByText("неудачный вход")).toBeInTheDocument();
  });

  it("фильтр по действию уходит в запрос", async () => {
    const user = userEvent.setup();
    setup();
    await waitFor(() => expect(api.listAudit).toHaveBeenCalled());

    await user.selectOptions(screen.getByLabelText("Фильтр по действию"), "login_failed");

    await waitFor(() =>
      expect(api.listAudit.mock.calls.at(-1)[1].action).toBe("login_failed"),
    );
  });

  it("сообщает, когда записей нет", async () => {
    setup();
    expect(await screen.findByText("Записей нет")).toBeInTheDocument();
  });
});

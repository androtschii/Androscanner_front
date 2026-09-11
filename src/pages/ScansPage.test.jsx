import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ScansPage } from "./ScansPage";

const navigate = vi.hoisted(() => vi.fn());
vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => navigate,
}));

const mockAuth = vi.hoisted(() => ({ value: {} }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => mockAuth.value }));

vi.mock("../lib/csv", () => ({ downloadCsv: vi.fn() }));

vi.mock("../lib/api", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    api: { listScans: vi.fn(), createScan: vi.fn() },
  };
});

import { api } from "../lib/api";
import { downloadCsv } from "../lib/csv";

function scan(id, over = {}) {
  return {
    id,
    target: `192.168.1.${id}`,
    profile: "quick",
    status: "done",
    created_by: 1,
    created_at: "2026-03-01T12:00:00Z",
    ...over,
  };
}

function page(items, total = items.length) {
  return { items, total, limit: 20, offset: 0 };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.value = { user: { id: 1, role: "admin" }, token: "t" };
  api.listScans.mockResolvedValue(page([scan(1), scan(2)]));
});

function setup() {
  return render(
    <MemoryRouter>
      <ScansPage />
    </MemoryRouter>,
  );
}

describe("загрузка списка", () => {
  it("показывает полученные сканы", async () => {
    setup();
    expect(await screen.findByText("192.168.1.1")).toBeInTheDocument();
    expect(screen.getByText("192.168.1.2")).toBeInTheDocument();
  });

  it("просит первую страницу с ограничением", async () => {
    setup();
    await waitFor(() => expect(api.listScans).toHaveBeenCalled());
    expect(api.listScans.mock.calls[0][1]).toMatchObject({ limit: 20, offset: 0 });
  });

  it("сообщает, когда сканов нет", async () => {
    api.listScans.mockResolvedValue(page([]));
    setup();
    expect(await screen.findByText("Сканов пока нет")).toBeInTheDocument();
  });

  it("ошибку загрузки показывает, а не проглатывает", async () => {
    api.listScans.mockRejectedValue(new Error("сеть недоступна"));
    setup();
    expect(await screen.findByText(/Не удалось загрузить сканы|сеть недоступна/)).toBeInTheDocument();
  });
});

describe("права на запуск", () => {
  it("админ видит форму запуска", async () => {
    setup();
    expect(await screen.findByLabelText("Цель (IP или CIDR)")).toBeInTheDocument();
  });

  it("аналитик видит форму запуска", async () => {
    mockAuth.value = { user: { id: 2, role: "analyst" }, token: "t" };
    setup();
    expect(await screen.findByLabelText("Цель (IP или CIDR)")).toBeInTheDocument();
  });

  it("наблюдателю форма не показывается", async () => {
    mockAuth.value = { user: { id: 3, role: "viewer" }, token: "t" };
    setup();
    await screen.findByText("192.168.1.1");
    expect(screen.queryByLabelText("Цель (IP или CIDR)")).not.toBeInTheDocument();
  });
});

describe("фильтры", () => {
  it("фильтр по статусу уходит в запрос", async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText("192.168.1.1");

    await user.selectOptions(screen.getByLabelText("Фильтр по статусу"), "failed");

    await waitFor(() => {
      const last = api.listScans.mock.calls.at(-1)[1];
      expect(last.status).toBe("failed");
    });
  });

  it("поиск по цели уходит в запрос", async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText("192.168.1.1");

    await user.type(screen.getByLabelText("Поиск по цели"), "10.0");

    await waitFor(() => {
      const last = api.listScans.mock.calls.at(-1)[1];
      expect(last.target).toBe("10.0");
    });
  });

  it("смена фильтра возвращает на первую страницу", async () => {
    // Иначе можно оказаться на пятой странице выборки, где всего две
    const user = userEvent.setup();
    api.listScans.mockResolvedValue(page([scan(1)], 100));
    setup();
    await screen.findByText("192.168.1.1");

    await user.click(screen.getByRole("button", { name: /Вперёд/ }));
    await waitFor(() => expect(api.listScans.mock.calls.at(-1)[1].offset).toBe(20));

    await user.selectOptions(screen.getByLabelText("Фильтр по статусу"), "done");
    await waitFor(() => expect(api.listScans.mock.calls.at(-1)[1].offset).toBe(0));
  });

  it("под фильтр ничего не подошло — отдельное сообщение", async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText("192.168.1.1");

    api.listScans.mockResolvedValue(page([]));
    await user.type(screen.getByLabelText("Поиск по цели"), "нет-такого");

    expect(await screen.findByText("Под фильтр ничего не подошло")).toBeInTheDocument();
  });
});

describe("листание", () => {
  it("кнопок нет, когда всё помещается на странице", async () => {
    setup();
    await screen.findByText("192.168.1.1");
    expect(screen.queryByRole("button", { name: /Вперёд/ })).not.toBeInTheDocument();
  });

  it("показывает счётчик «сколько из скольких»", async () => {
    api.listScans.mockResolvedValue(page([scan(1), scan(2), scan(3)], 137));
    setup();
    expect(await screen.findByText("1–3 из 137")).toBeInTheDocument();
  });

  it("на последней странице считает по факту, а не по размеру страницы", async () => {
    // Раньше граница бралась как offset + PAGE_SIZE, и неполная
    // последняя страница показывалась бы как «21–40 из 22».
    // Смещение задаём через интерфейс: компонент ведёт его сам,
    // а не берёт из ответа сервера.
    const user = userEvent.setup();
    api.listScans.mockResolvedValue(page(Array.from({ length: 20 }, (_, i) => scan(i + 1)), 22));
    setup();
    await screen.findByText("192.168.1.1");

    api.listScans.mockResolvedValue({
      items: [scan(21), scan(22)],
      total: 22,
      limit: 20,
      offset: 20,
    });
    await user.click(screen.getByRole("button", { name: /Вперёд/ }));

    expect(await screen.findByText("21–22 из 22")).toBeInTheDocument();
  });

  it("«Назад» недоступна на первой странице", async () => {
    api.listScans.mockResolvedValue(page([scan(1)], 100));
    setup();
    await screen.findByText("192.168.1.1");
    expect(screen.getByRole("button", { name: /Назад/ })).toBeDisabled();
  });
});

describe("запуск скана", () => {
  it("отправляет цель и профиль", async () => {
    const user = userEvent.setup();
    api.createScan.mockResolvedValue(scan(9, { target: "10.0.0.1", status: "queued" }));
    setup();
    await screen.findByText("192.168.1.1");

    await user.type(screen.getByLabelText("Цель (IP или CIDR)"), "10.0.0.1");
    await user.click(screen.getByRole("button", { name: /Запустить скан/ }));

    await waitFor(() => expect(api.createScan).toHaveBeenCalledWith("t", "10.0.0.1", "quick"));
  });

  it("ошибку запуска показывает в форме", async () => {
    const user = userEvent.setup();
    const { ApiError } = await vi.importActual("../lib/api");
    api.createScan.mockRejectedValue(new ApiError(403, "Цель вне разрешённого диапазона"));
    setup();
    await screen.findByText("192.168.1.1");

    await user.type(screen.getByLabelText("Цель (IP или CIDR)"), "8.8.8.8");
    await user.click(screen.getByRole("button", { name: /Запустить скан/ }));

    expect(await screen.findByText("Цель вне разрешённого диапазона")).toBeInTheDocument();
  });
});

describe("переход к карточке", () => {
  it("клик по строке открывает скан", async () => {
    const user = userEvent.setup();
    setup();
    const cell = await screen.findByText("192.168.1.2");

    await user.click(cell);
    expect(navigate).toHaveBeenCalledWith("/scans/2");
  });
});

describe("экспорт", () => {
  it("выгружает текущую страницу", async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText("192.168.1.1");

    await user.click(screen.getByRole("button", { name: /CSV/ }));

    expect(downloadCsv).toHaveBeenCalled();
    const rows = downloadCsv.mock.calls[0][2];
    expect(rows).toHaveLength(2);
  });

  it("кнопка недоступна на пустом списке", async () => {
    api.listScans.mockResolvedValue(page([]));
    setup();
    await screen.findByText("Сканов пока нет");
    expect(screen.getByRole("button", { name: /CSV/ })).toBeDisabled();
  });
});

describe("автообновление", () => {
  it("не опрашивает сервер, когда все сканы завершены", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setup();
    await screen.findByText("192.168.1.1");

    const before = api.listScans.mock.calls.length;
    await vi.advanceTimersByTimeAsync(6000);
    expect(api.listScans.mock.calls.length).toBe(before);
    vi.useRealTimers();
  });

  it("опрашивает, пока есть выполняющийся скан", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    api.listScans.mockResolvedValue(page([scan(1, { status: "running" })]));
    setup();
    await screen.findByText("192.168.1.1");

    const before = api.listScans.mock.calls.length;
    await vi.advanceTimersByTimeAsync(4500);
    expect(api.listScans.mock.calls.length).toBeGreaterThan(before);
    vi.useRealTimers();
  });
});

describe("таблица", () => {
  it("показывает статус, профиль и дату", async () => {
    setup();
    const row = (await screen.findByText("192.168.1.1")).closest("tr");
    expect(within(row).getByText("готово")).toBeInTheDocument();
    expect(within(row).getByText("quick")).toBeInTheDocument();
  });
});

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ScanDetailPage } from "./ScanDetailPage";

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal()),
  useParams: () => ({ id: "7" }),
}));

const mockAuth = vi.hoisted(() => ({ value: {} }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => mockAuth.value }));

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  loading: vi.fn(() => "toast-id"),
}));
vi.mock("sonner", () => ({ toast: toastMock }));

vi.mock("../lib/api", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    api: { getScan: vi.fn(), cancelScan: vi.fn(), scanReport: vi.fn() },
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

function port(number, over = {}) {
  return {
    port: number,
    protocol: "tcp",
    state: "open",
    service: "ssh",
    product: "",
    version: "",
    cpe: [],
    ...over,
  };
}

function result(over = {}) {
  return {
    scanned_at: "2026-03-01T12:00:00Z",
    profile: "quick",
    arguments: "-sT -T4 --top-ports 100",
    hosts: [
      {
        ip: "192.168.1.10",
        hostnames: ["nas.local"],
        state: "up",
        mac: "AA:BB:CC:DD:EE:FF",
        vendor: "Synology",
        os: [{ name: "Linux 5.X", accuracy: 96 }],
        ports: [port(22), port(80, { service: "http" }), port(443, { state: "closed", service: "https" })],
      },
    ],
    stats: { hosts_total: 1, hosts_up: 1, open_ports: 2 },
    ...over,
  };
}

function scan(over = {}) {
  return {
    id: 7,
    target: "192.168.1.0/24",
    profile: "quick",
    status: "done",
    created_by: 1,
    created_at: "2026-03-01T12:00:00Z",
    result: JSON.stringify(result()),
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.value = { user: { id: 1, role: "admin" }, token: "t" };
  api.getScan.mockResolvedValue(scan());
});

const setup = () =>
  render(
    <MemoryRouter>
      <ScanDetailPage />
    </MemoryRouter>,
  );

describe("отображение результата", () => {
  it("показывает статистику", async () => {
    setup();
    await screen.findByText("192.168.1.0/24");
    expect(screen.getByText("хостов найдено")).toBeInTheDocument();
    expect(screen.getByText("открытых портов")).toBeInTheDocument();
  });

  it("показывает хост с именем, MAC и ОС", async () => {
    setup();
    expect(await screen.findByText("192.168.1.10")).toBeInTheDocument();
    expect(screen.getByText("nas.local")).toBeInTheDocument();
    expect(screen.getByText("AA:BB:CC:DD:EE:FF")).toBeInTheDocument();
    expect(screen.getByText(/Linux 5.X/)).toBeInTheDocument();
  });

  it("показывает команду nmap", async () => {
    setup();
    expect(await screen.findByText(/-sT -T4 --top-ports 100/)).toBeInTheDocument();
  });

  it("повреждённый результат не роняет страницу", async () => {
    api.getScan.mockResolvedValue(scan({ result: "{не json" }));
    setup();
    expect(await screen.findByText(/Результат повреждён/)).toBeInTheDocument();
  });

  it("провалившийся скан показывает причину", async () => {
    api.getScan.mockResolvedValue(
      scan({ status: "failed", result: JSON.stringify({ error: "Нужны права администратора" }) }),
    );
    setup();
    expect(await screen.findByText("Нужны права администратора")).toBeInTheDocument();
    expect(screen.getByText("Скан не выполнен")).toBeInTheDocument();
  });
});

describe("таблица портов", () => {
  it("по умолчанию показывает все порты, включая закрытые", async () => {
    setup();
    await screen.findByText("192.168.1.10");
    expect(screen.getByText("443")).toBeInTheDocument();
  });

  it("чекбокс прячет закрытые", async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText("192.168.1.10");

    await user.click(screen.getByLabelText(/Только открытые/));
    expect(screen.queryByText("443")).not.toBeInTheDocument();
    expect(screen.getByText("22")).toBeInTheDocument();
  });

  it("чекбокса нет, когда все порты открыты", async () => {
    const onlyOpen = result();
    onlyOpen.hosts[0].ports = [port(22), port(80)];
    api.getScan.mockResolvedValue(scan({ result: JSON.stringify(onlyOpen) }));
    setup();
    await screen.findByText("192.168.1.10");

    expect(screen.queryByLabelText(/Только открытые/)).not.toBeInTheDocument();
  });

  it("заголовок сортирует по сервису", async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText("192.168.1.10");

    await user.click(screen.getByRole("button", { name: /Сервис/ }));

    const rows = screen.getAllByRole("row").slice(1);
    const services = rows.map((r) => within(r).getAllByRole("cell")[2].textContent);
    expect(services).toEqual([...services].sort());
  });
});

describe("сворачивание хостов", () => {
  it("первый хост раскрыт", async () => {
    setup();
    await screen.findByText("192.168.1.10");
    expect(screen.getByText("22")).toBeInTheDocument();
  });

  it("клик по шапке сворачивает хост", async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText("192.168.1.10");

    await user.click(screen.getByRole("button", { expanded: true }));
    expect(screen.queryByText("22")).not.toBeInTheDocument();
  });

  it("второй и последующие хосты свёрнуты", async () => {
    const two = result();
    two.hosts.push({
      ip: "192.168.1.11",
      hostnames: [],
      state: "up",
      mac: null,
      vendor: null,
      os: [],
      ports: [port(3389, { service: "ms-wbt-server" })],
    });
    api.getScan.mockResolvedValue(scan({ result: JSON.stringify(two) }));
    setup();
    await screen.findByText("192.168.1.11");

    // Порт второго хоста не виден, пока его не раскроют
    expect(screen.queryByText("3389")).not.toBeInTheDocument();
  });
});

describe("отмена скана", () => {
  it("кнопки нет у завершённого скана", async () => {
    setup();
    await screen.findByText("192.168.1.0/24");
    expect(screen.queryByRole("button", { name: /Отменить/ })).not.toBeInTheDocument();
  });

  it("кнопка есть у выполняющегося", async () => {
    api.getScan.mockResolvedValue(scan({ status: "running", result: null }));
    setup();
    expect(await screen.findByRole("button", { name: /Отменить/ })).toBeInTheDocument();
  });

  it("наблюдателю чужой скан отменить нельзя", async () => {
    mockAuth.value = { user: { id: 9, role: "viewer" }, token: "t" };
    api.getScan.mockResolvedValue(scan({ status: "running", created_by: 1, result: null }));
    setup();
    await screen.findByText("192.168.1.0/24");

    expect(screen.queryByRole("button", { name: /Отменить/ })).not.toBeInTheDocument();
  });

  it("аналитик может отменить свой скан", async () => {
    mockAuth.value = { user: { id: 5, role: "analyst" }, token: "t" };
    api.getScan.mockResolvedValue(scan({ status: "running", created_by: 5, result: null }));
    setup();

    expect(await screen.findByRole("button", { name: /Отменить/ })).toBeInTheDocument();
  });

  it("спрашивает подтверждение и не отменяет сразу", async () => {
    const user = userEvent.setup();
    api.getScan.mockResolvedValue(scan({ status: "running", result: null }));
    setup();

    await user.click(await screen.findByRole("button", { name: /Отменить/ }));

    expect(api.cancelScan).not.toHaveBeenCalled();
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("отменяет после подтверждения", async () => {
    const user = userEvent.setup();
    api.getScan.mockResolvedValue(scan({ status: "running", result: null }));
    api.cancelScan.mockResolvedValue(scan({ status: "cancelled", result: null }));
    setup();

    await user.click(await screen.findByRole("button", { name: /Отменить/ }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Отменить скан" }));

    await waitFor(() => expect(api.cancelScan).toHaveBeenCalledWith("t", "7"));
  });
});

describe("выгрузка PDF", () => {
  it("скачивает отчёт", async () => {
    const user = userEvent.setup();
    api.scanReport.mockResolvedValue(new Blob(["%PDF"], { type: "application/pdf" }));
    URL.createObjectURL = vi.fn(() => "blob:fake");
    URL.revokeObjectURL = vi.fn();

    setup();
    await screen.findByText("192.168.1.0/24");
    await user.click(screen.getByRole("button", { name: /PDF/ }));

    await waitFor(() => expect(api.scanReport).toHaveBeenCalledWith("t", "7"));
    // Ссылку на объект обязательно освобождаем, иначе Blob висит в памяти
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });

  it("ошибку сборки показывает пользователю", async () => {
    const user = userEvent.setup();
    api.scanReport.mockRejectedValue(new Error("PDF-отчёты требуют библиотеки Pango"));
    setup();
    await screen.findByText("192.168.1.0/24");

    await user.click(screen.getByRole("button", { name: /PDF/ }));

    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ description: expect.stringContaining("Pango") }),
      ),
    );
  });
});

describe("автообновление", () => {
  it("опрашивает сервер, пока скан выполняется", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    api.getScan.mockResolvedValue(scan({ status: "running", result: null }));
    setup();
    await screen.findByText(/Скан выполняется/);

    const before = api.getScan.mock.calls.length;
    await vi.advanceTimersByTimeAsync(4500);
    expect(api.getScan.mock.calls.length).toBeGreaterThan(before);
    vi.useRealTimers();
  });

  it("не опрашивает завершённый", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setup();
    await screen.findByText("192.168.1.10");

    const before = api.getScan.mock.calls.length;
    await vi.advanceTimersByTimeAsync(6000);
    expect(api.getScan.mock.calls.length).toBe(before);
    vi.useRealTimers();
  });
});

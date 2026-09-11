import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NetworkPage } from "./NetworkPage";

const mockAuth = vi.hoisted(() => ({ value: {} }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => mockAuth.value }));

const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), loading: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock }));
vi.mock("../lib/csv", () => ({ downloadCsv: vi.fn() }));

vi.mock("../lib/api", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, api: { networkMap: vi.fn() } };
});

import { api } from "../lib/api";
import { downloadCsv } from "../lib/csv";

function host(ip, over = {}) {
  return {
    ip,
    hostnames: [],
    mac: null,
    vendor: null,
    os: null,
    open_ports: 2,
    services: ["ssh", "http"],
    last_seen: "2026-03-01T12:00:00Z",
    ...over,
  };
}

function map(over = {}) {
  return {
    networks: [
      {
        cidr: "192.168.1.0/24",
        description: "дом",
        hosts: [host("192.168.1.10", { hostnames: ["nas.local"] }), host("192.168.1.11")],
      },
    ],
    ungrouped: [],
    totals: { hosts: 2, networks: 1, open_ports: 4 },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.value = { user: { id: 1, role: "admin" }, token: "t" };
  api.networkMap.mockResolvedValue(map());
});

const setup = () =>
  render(
    <MemoryRouter>
      <NetworkPage />
    </MemoryRouter>,
  );

describe("отображение", () => {
  it("показывает итоги", async () => {
    setup();
    await screen.findByText("хостов найдено");
    expect(screen.getByText("диапазонов")).toBeInTheDocument();
    expect(screen.getByText("открытых портов")).toBeInTheDocument();
  });

  it("рисует граф подсети с её описанием", async () => {
    setup();
    expect(await screen.findByText("дом")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Карта подсети 192.168.1.0\/24/ })).toBeInTheDocument();
  });

  it("подписывает узлы адресами", async () => {
    setup();
    await screen.findByText("дом");
    const svg = screen.getByRole("img", { name: /Карта подсети/ });
    expect(within(svg).getByText("192.168.1.10")).toBeInTheDocument();
  });

  it("честно говорит, что луч — это вхождение в диапазон, а не связь", async () => {
    // Профили сканирования не выясняют топологию: ни traceroute,
    // ни опроса маршрутов. Карта не должна читаться как схема соединений.
    setup();
    expect(
      await screen.findByText(/не связь между устройствами/),
    ).toBeInTheDocument();
  });

  it("приглашает запустить скан, когда хостов нет", async () => {
    api.networkMap.mockResolvedValue(
      map({ networks: [], ungrouped: [], totals: { hosts: 0, networks: 0, open_ports: 0 } }),
    );
    setup();
    expect(await screen.findByText(/Хостов пока не найдено/)).toBeInTheDocument();
  });

  it("ошибку загрузки показывает", async () => {
    api.networkMap.mockRejectedValue(new Error("нет связи"));
    setup();
    expect(await screen.findByText(/Не удалось загрузить карту сети|нет связи/)).toBeInTheDocument();
  });
});

describe("выбор узла", () => {
  it("до выбора предлагает нажать на узел", async () => {
    setup();
    expect(await screen.findByText(/Выберите узел на карте/)).toBeInTheDocument();
  });

  it("клик по узлу открывает карточку хоста", async () => {
    const user = userEvent.setup();
    api.networkMap.mockResolvedValue(
      map({
        networks: [
          {
            cidr: "192.168.1.0/24",
            description: "",
            hosts: [
              host("192.168.1.10", {
                hostnames: ["nas.local"],
                mac: "AA:BB:CC:DD:EE:FF",
                vendor: "Synology",
                os: "Linux 5.X",
              }),
            ],
          },
        ],
      }),
    );
    setup();
    await screen.findByRole("img", { name: /Карта подсети/ });

    await user.click(screen.getByRole("button", { name: /192.168.1.10, открытых портов/ }));

    expect(await screen.findByText("Synology")).toBeInTheDocument();
    expect(screen.getByText("Linux 5.X")).toBeInTheDocument();
  });

  it("узел доступен с клавиатуры", async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByRole("img", { name: /Карта подсети/ });

    const node = screen.getByRole("button", { name: /192.168.1.10, открытых портов/ });
    node.focus();
    await user.keyboard("{Enter}");

    expect(await screen.findByText(/Последний раз виден/)).toBeInTheDocument();
  });
});

describe("таблица-двойник", () => {
  it("переключается на таблицу", async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText("дом");

    await user.click(screen.getByRole("button", { name: /Таблица/ }));

    // Те же данные без графики — у графа обязан быть текстовый двойник
    expect(screen.getByRole("columnheader", { name: "IP" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /Карта подсети/ })).not.toBeInTheDocument();
  });

  it("возвращается к карте", async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText("дом");

    await user.click(screen.getByRole("button", { name: /Таблица/ }));
    await user.click(screen.getByRole("button", { name: /Карта/ }));

    expect(screen.getByRole("img", { name: /Карта подсети/ })).toBeInTheDocument();
  });
});

describe("хосты вне диапазонов", () => {
  it("выносятся отдельно с объяснением", async () => {
    api.networkMap.mockResolvedValue(
      map({
        ungrouped: [host("10.9.9.9")],
        totals: { hosts: 3, networks: 1, open_ports: 6 },
      }),
    );
    setup();

    expect(await screen.findByText(/Вне разрешённых диапазонов/)).toBeInTheDocument();
    expect(screen.getByText(/диапазон убрали из allowed-scope/)).toBeInTheDocument();
  });

  it("блока нет, когда все хосты разложены", async () => {
    setup();
    await screen.findByText("дом");
    expect(screen.queryByText(/Вне разрешённых диапазонов/)).not.toBeInTheDocument();
  });
});

describe("экспорт", () => {
  it("выгружает все хосты, включая внегруппные", async () => {
    const user = userEvent.setup();
    api.networkMap.mockResolvedValue(
      map({ ungrouped: [host("10.9.9.9")], totals: { hosts: 3, networks: 1, open_ports: 6 } }),
    );
    setup();
    await screen.findByText("дом");

    await user.click(screen.getByRole("button", { name: /CSV/ }));

    expect(downloadCsv).toHaveBeenCalled();
    const rows = downloadCsv.mock.calls[0][2];
    expect(rows.map((h) => h.ip)).toContain("10.9.9.9");
    expect(rows).toHaveLength(3);
  });
});

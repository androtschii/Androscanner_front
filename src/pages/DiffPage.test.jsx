import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DiffPage } from "./DiffPage";

const mockAuth = vi.hoisted(() => ({ value: {} }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => mockAuth.value }));

const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), loading: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock }));

vi.mock("../lib/api", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, api: { listScans: vi.fn(), diffScans: vi.fn() } };
});

import { api } from "../lib/api";

function scan(id, target = "192.168.1.0/24") {
  return {
    id,
    target,
    profile: "quick",
    status: "done",
    created_by: 1,
    created_at: `2026-03-0${id}T12:00:00Z`,
  };
}

function diff(over = {}) {
  return {
    base: scan(1),
    compare: scan(2),
    targets_differ: false,
    hosts_added: [],
    hosts_removed: [],
    host_changes: [],
    summary: { hosts_added: 0, hosts_removed: 0, ports_opened: 0, ports_closed: 0, hosts_changed: 0 },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.value = { user: { id: 1, role: "admin" }, token: "t" };
  api.listScans.mockResolvedValue({ items: [scan(2), scan(1)], total: 2, limit: 200, offset: 0 });
});

const setup = () =>
  render(
    <MemoryRouter>
      <DiffPage />
    </MemoryRouter>,
  );

describe("подготовка", () => {
  it("просит у сервера только завершённые сканы", async () => {
    setup();
    // Фильтрация на сервере дешевле, чем тянуть всё и отсеивать в браузере
    await waitFor(() => expect(api.listScans).toHaveBeenCalled());
    expect(api.listScans.mock.calls[0][1]).toMatchObject({ status: "done" });
  });

  it("по умолчанию выбирает два последних скана", async () => {
    setup();
    await screen.findByLabelText("Раньше");
    // Список приходит от новых к старым: «позже» — первый, «раньше» — второй
    expect(screen.getByLabelText("Позже")).toHaveValue("2");
    expect(screen.getByLabelText("Раньше")).toHaveValue("1");
  });

  it("объясняет, если сравнивать нечего", async () => {
    api.listScans.mockResolvedValue({ items: [scan(1)], total: 1, limit: 200, offset: 0 });
    setup();
    expect(await screen.findByText(/Нужно хотя бы два/)).toBeInTheDocument();
  });
});

describe("сравнение", () => {
  it("передаёт выбранные сканы", async () => {
    const user = userEvent.setup();
    api.diffScans.mockResolvedValue(diff());
    setup();
    await screen.findByLabelText("Раньше");

    await user.click(screen.getByRole("button", { name: /Сравнить/ }));

    await waitFor(() => expect(api.diffScans).toHaveBeenCalledWith("t", "1", "2"));
  });

  it("сообщает, когда сеть не изменилась", async () => {
    const user = userEvent.setup();
    api.diffScans.mockResolvedValue(diff());
    setup();
    await screen.findByLabelText("Раньше");

    await user.click(screen.getByRole("button", { name: /Сравнить/ }));
    expect(await screen.findByText(/сеть не изменилась/)).toBeInTheDocument();
  });

  it("показывает появившиеся хосты", async () => {
    const user = userEvent.setup();
    api.diffScans.mockResolvedValue(
      diff({
        hosts_added: [{ ip: "192.168.1.50", ports: [{ port: 22, protocol: "tcp", service: "ssh" }] }],
        summary: { hosts_added: 1, hosts_removed: 0, ports_opened: 1, ports_closed: 0, hosts_changed: 0 },
      }),
    );
    setup();
    await screen.findByLabelText("Раньше");
    await user.click(screen.getByRole("button", { name: /Сравнить/ }));

    expect(await screen.findByText("192.168.1.50")).toBeInTheDocument();
    expect(screen.getByText(/Появились/)).toBeInTheDocument();
  });

  it("показывает открывшиеся порты у изменившегося хоста", async () => {
    const user = userEvent.setup();
    api.diffScans.mockResolvedValue(
      diff({
        host_changes: [
          {
            ip: "192.168.1.10",
            ports_opened: [{ port: 8080, protocol: "tcp", service: "http-proxy" }],
            ports_closed: [],
            services_changed: [],
          },
        ],
        summary: { hosts_added: 0, hosts_removed: 0, ports_opened: 1, ports_closed: 0, hosts_changed: 1 },
      }),
    );
    setup();
    await screen.findByLabelText("Раньше");
    await user.click(screen.getByRole("button", { name: /Сравнить/ }));

    expect(await screen.findByText("http-proxy")).toBeInTheDocument();
    // Именно заголовок раздела со знаком «+», а не плитка «портов открылось»
    expect(screen.getByRole("heading", { name: /\+ открылось/ })).toBeInTheDocument();
  });

  it("показывает смену версии сервиса", async () => {
    const user = userEvent.setup();
    api.diffScans.mockResolvedValue(
      diff({
        host_changes: [
          {
            ip: "192.168.1.10",
            ports_opened: [],
            ports_closed: [],
            services_changed: [
              { port: 22, protocol: "tcp", before: "ssh OpenSSH 8.4", after: "ssh OpenSSH 9.6" },
            ],
          },
        ],
        summary: { hosts_added: 0, hosts_removed: 0, ports_opened: 0, ports_closed: 0, hosts_changed: 1 },
      }),
    );
    setup();
    await screen.findByLabelText("Раньше");
    await user.click(screen.getByRole("button", { name: /Сравнить/ }));

    expect(await screen.findByText("ssh OpenSSH 8.4")).toBeInTheDocument();
    expect(screen.getByText("ssh OpenSSH 9.6")).toBeInTheDocument();
  });
});

describe("предупреждение о разных целях", () => {
  // Сравнение сканов разных сетей формально работает, но «хост исчез /
  // появился» означает лишь то, что сети разные, а не изменения в сети

  it("предупреждает, когда цели не совпадают", async () => {
    const user = userEvent.setup();
    api.diffScans.mockResolvedValue(
      diff({
        base: scan(1, "192.168.1.0/24"),
        compare: scan(2, "10.99.0.0/24"),
        targets_differ: true,
      }),
    );
    setup();
    await screen.findByLabelText("Раньше");
    await user.click(screen.getByRole("button", { name: /Сравнить/ }));

    expect(await screen.findByText("Сканы по разным целям")).toBeInTheDocument();
    expect(screen.getByText(/не изменения\s+в сети/)).toBeInTheDocument();
  });

  it("не предупреждает, когда цель одна", async () => {
    const user = userEvent.setup();
    api.diffScans.mockResolvedValue(diff({ targets_differ: false }));
    setup();
    await screen.findByLabelText("Раньше");
    await user.click(screen.getByRole("button", { name: /Сравнить/ }));

    await screen.findByText(/сеть не изменилась/);
    expect(screen.queryByText("Сканы по разным целям")).not.toBeInTheDocument();
  });
});

describe("ошибки", () => {
  it("показывает отказ сервера", async () => {
    const user = userEvent.setup();
    const { ApiError } = await vi.importActual("../lib/api");
    api.diffScans.mockRejectedValue(new ApiError(400, "Нужны два разных скана"));
    setup();
    await screen.findByLabelText("Раньше");

    await user.click(screen.getByRole("button", { name: /Сравнить/ }));

    expect(await screen.findByText("Нужны два разных скана")).toBeInTheDocument();
  });
});

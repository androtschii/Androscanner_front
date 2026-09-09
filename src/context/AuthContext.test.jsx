import { render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthContext";

vi.mock("../lib/api", () => ({
  api: {
    login: vi.fn(),
    me: vi.fn(),
  },
}));

import { api } from "../lib/api";

function Probe() {
  const { token, user, login, logout } = useAuth();
  const [error, setError] = useState(null);

  // Ошибку ловим так же, как настоящая LoginPage: иначе отклонённый
  // промис всплывёт мимо теста и упадёт как unhandled rejection
  async function handleLogin() {
    try {
      await login("admin", "secret");
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div>
      <span data-testid="token">{token ?? "нет"}</span>
      <span data-testid="role">{user?.role ?? "нет"}</span>
      <span data-testid="error">{error ?? ""}</span>
      <button onClick={handleLogin}>войти</button>
      <button onClick={logout}>выйти</button>
    </div>
  );
}

function renderProbe() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("начальное состояние", () => {
  it("токена нет", () => {
    renderProbe();
    expect(screen.getByTestId("token")).toHaveTextContent("нет");
  });
});

describe("вход", () => {
  it("сохраняет токен и роль", async () => {
    api.login.mockResolvedValue({ access_token: "abc123" });
    api.me.mockResolvedValue({ username: "admin", role: "admin" });

    const user = userEvent.setup();
    renderProbe();
    await user.click(screen.getByText("войти"));

    await waitFor(() => {
      expect(screen.getByTestId("token")).toHaveTextContent("abc123");
      expect(screen.getByTestId("role")).toHaveTextContent("admin");
    });
  });

  it("запрашивает профиль тем же токеном, что получил", async () => {
    api.login.mockResolvedValue({ access_token: "abc123" });
    api.me.mockResolvedValue({ username: "admin", role: "admin" });

    const user = userEvent.setup();
    renderProbe();
    await user.click(screen.getByText("войти"));

    await waitFor(() => expect(api.me).toHaveBeenCalledWith("abc123"));
  });

  it("при неверном пароле состояние не меняется", async () => {
    api.login.mockRejectedValue(new Error("Неверный логин или пароль"));

    const user = userEvent.setup();
    renderProbe();
    await user.click(screen.getByText("войти"));

    await waitFor(() => {
      expect(screen.getByTestId("error")).toHaveTextContent("Неверный логин или пароль");
    });
    expect(screen.getByTestId("token")).toHaveTextContent("нет");
  });
});

describe("выход", () => {
  it("стирает токен и пользователя", async () => {
    api.login.mockResolvedValue({ access_token: "abc123" });
    api.me.mockResolvedValue({ username: "admin", role: "admin" });

    const user = userEvent.setup();
    renderProbe();
    await user.click(screen.getByText("войти"));
    await waitFor(() => expect(screen.getByTestId("token")).toHaveTextContent("abc123"));

    await user.click(screen.getByText("выйти"));
    expect(screen.getByTestId("token")).toHaveTextContent("нет");
    expect(screen.getByTestId("role")).toHaveTextContent("нет");
  });
});

describe("хранение токена", () => {
  it("токен не попадает в localStorage и sessionStorage", async () => {
    api.login.mockResolvedValue({ access_token: "sekretnyy-token" });
    api.me.mockResolvedValue({ username: "admin", role: "admin" });

    const user = userEvent.setup();
    renderProbe();
    await user.click(screen.getByText("войти"));
    await waitFor(() =>
      expect(screen.getByTestId("token")).toHaveTextContent("sekretnyy-token"),
    );

    // Осознанное решение: токен живёт только в памяти, чтобы его
    // нельзя было украсть из хранилища браузера через XSS
    expect(JSON.stringify(localStorage)).not.toContain("sekretnyy-token");
    expect(JSON.stringify(sessionStorage)).not.toContain("sekretnyy-token");
  });
});

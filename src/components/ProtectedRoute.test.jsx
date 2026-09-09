import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ProtectedRoute } from "./ProtectedRoute";

// Подменяем контекст: нас интересует логика маршрута, а не вход по сети
const mockAuth = vi.hoisted(() => ({ value: {} }));
vi.mock("../context/AuthContext", () => ({
  useAuth: () => mockAuth.value,
}));

function renderAt(path, element) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<div>страница входа</div>} />
        <Route path="/scans" element={<div>список сканов</div>} />
        <Route path="/admin" element={element} />
      </Routes>
    </MemoryRouter>,
  );
}

const secret = <ProtectedRoute role="admin">панель админа</ProtectedRoute>;

describe("без токена", () => {
  it("отправляет на страницу входа", () => {
    mockAuth.value = { token: null, user: null };
    renderAt("/admin", secret);
    expect(screen.getByText("страница входа")).toBeInTheDocument();
  });

  it("не показывает защищённое содержимое", () => {
    mockAuth.value = { token: null, user: null };
    renderAt("/admin", secret);
    expect(screen.queryByText("панель админа")).not.toBeInTheDocument();
  });
});

describe("с токеном, но чужой ролью", () => {
  it("уводит на список сканов, а не на вход", () => {
    mockAuth.value = { token: "t", user: { role: "viewer" } };
    renderAt("/admin", secret);
    expect(screen.getByText("список сканов")).toBeInTheDocument();
    expect(screen.queryByText("панель админа")).not.toBeInTheDocument();
  });

  it("analyst тоже не проходит в админку", () => {
    mockAuth.value = { token: "t", user: { role: "analyst" } };
    renderAt("/admin", secret);
    expect(screen.queryByText("панель админа")).not.toBeInTheDocument();
  });
});

describe("с нужной ролью", () => {
  it("пускает admin", () => {
    mockAuth.value = { token: "t", user: { role: "admin" } };
    renderAt("/admin", secret);
    expect(screen.getByText("панель админа")).toBeInTheDocument();
  });
});

describe("без требования к роли", () => {
  it("достаточно быть авторизованным", () => {
    mockAuth.value = { token: "t", user: { role: "viewer" } };
    renderAt("/admin", <ProtectedRoute>общая страница</ProtectedRoute>);
    expect(screen.getByText("общая страница")).toBeInTheDocument();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, api } from "./api";

function mockFetch(response) {
  return vi.fn().mockResolvedValue({
    ok: response.ok ?? true,
    status: response.status ?? 200,
    json: async () => response.body ?? {},
    blob: async () => response.blob ?? new Blob(),
    headers: new Headers(),
  });
}

/** Последний вызов fetch: [url, options] */
function lastCall() {
  return globalThis.fetch.mock.calls.at(-1);
}

beforeEach(() => {
  globalThis.fetch = mockFetch({ body: {} });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ошибки", () => {
  it("несёт HTTP-статус, чтобы вызывающий мог его разобрать", async () => {
    globalThis.fetch = mockFetch({
      ok: false,
      status: 403,
      body: { detail: "Цель вне разрешённого диапазона" },
    });

    await expect(api.listScans("t")).rejects.toSatisfy(
      (e) => e instanceof ApiError && e.status === 403,
    );
  });

  it("берёт текст из detail — это сообщение показывается пользователю", async () => {
    globalThis.fetch = mockFetch({
      ok: false,
      status: 403,
      body: { detail: "Недостаточно прав" },
    });

    await expect(api.listScans("t")).rejects.toThrow("Недостаточно прав");
  });

  it("не падает, если тело ответа не JSON", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError("не JSON");
      },
    });

    await expect(api.listScans("t")).rejects.toThrow("HTTP 502");
  });
});

describe("авторизация", () => {
  it("подставляет токен в заголовок", async () => {
    await api.listScans("moy-token");
    const [, options] = lastCall();
    expect(options.headers.Authorization).toBe("Bearer moy-token");
  });

  it("вход шлёт форму, а не JSON — этого требует OAuth2PasswordRequestForm", async () => {
    globalThis.fetch = mockFetch({ body: { access_token: "x" } });
    await api.login("admin", "secret");

    const [, options] = lastCall();
    expect(options.body).toBeInstanceOf(URLSearchParams);
    expect(options.body.get("username")).toBe("admin");
    // Content-Type не выставляем: браузер сам поставит form-urlencoded
    expect(options.headers["Content-Type"]).toBeUndefined();
  });
});

describe("пагинация и фильтры", () => {
  it("по умолчанию просит первую страницу", async () => {
    await api.listScans("t");
    const [url] = lastCall();
    expect(url).toContain("limit=50");
    expect(url).toContain("offset=0");
  });

  it("передаёт фильтры в query", async () => {
    await api.listScans("t", { status: "done", target: "192.168", limit: 10, offset: 20 });
    const [url] = lastCall();
    expect(url).toContain("status=done");
    expect(url).toContain("target=192.168");
    expect(url).toContain("limit=10");
    expect(url).toContain("offset=20");
  });

  it("пустые фильтры не попадают в query", async () => {
    await api.listScans("t", { status: undefined, target: "" });
    const [url] = lastCall();
    expect(url).not.toContain("status=");
    expect(url).not.toContain("target=");
  });

  it("экранирует спецсимволы в поиске", async () => {
    await api.listScans("t", { target: "192.168.1.0/24" });
    const [url] = lastCall();
    // слэш должен быть закодирован, иначе поедет путь
    expect(url).toContain("target=192.168.1.0%2F24");
  });
});

describe("создание скана", () => {
  it("шлёт JSON с целью и профилем", async () => {
    await api.createScan("t", "192.168.1.10", "quick");
    const [, options] = lastCall();
    expect(options.method).toBe("POST");
    expect(options.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(options.body)).toEqual({
      target: "192.168.1.10",
      profile: "quick",
    });
  });
});

describe("смена пароля", () => {
  it("шлёт поля в snake_case, как ждёт бэкенд", async () => {
    await api.changePassword("t", "staryy", "novyy-parol-1");
    const [, options] = lastCall();
    expect(JSON.parse(options.body)).toEqual({
      current_password: "staryy",
      new_password: "novyy-parol-1",
    });
  });
});

describe("PDF-отчёт", () => {
  it("возвращает Blob, а не JSON", async () => {
    const pdf = new Blob(["%PDF"], { type: "application/pdf" });
    globalThis.fetch = mockFetch({ blob: pdf });

    const result = await api.scanReport("t", 5);
    expect(result).toBe(pdf);
  });

  it("при ошибке отдаёт ApiError с объяснением от сервера", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ detail: "PDF-отчёты требуют библиотеки Pango" }),
    });

    await expect(api.scanReport("t", 5)).rejects.toThrow("Pango");
  });
});

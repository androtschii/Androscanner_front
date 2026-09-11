import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

const cols = [
  { key: "ip", label: "IP" },
  { key: "name", label: "Имя" },
];

function body(rows) {
  return toCsv(cols, rows).split("\r\n").slice(1);
}

describe("формат", () => {
  it("первой строкой идут заголовки", () => {
    expect(toCsv(cols, []).split("\r\n")[0]).toBe("IP,Имя");
  });

  it("строки разделяются CRLF, как требует RFC 4180", () => {
    const csv = toCsv(cols, [{ ip: "10.0.0.1", name: "a" }, { ip: "10.0.0.2", name: "b" }]);
    expect(csv.split("\r\n")).toHaveLength(3);
  });

  it("берёт значение через get, если он задан", () => {
    const csv = toCsv([{ key: "ports", label: "Порты", get: (r) => r.ports.join("; ") }], [
      { ports: [22, 80] },
    ]);
    expect(csv).toContain("22; 80");
  });

  it("пустые значения не ломают строку", () => {
    expect(body([{ ip: "10.0.0.1", name: null }])[0]).toBe("10.0.0.1,");
  });
});

describe("экранирование", () => {
  it("значение с запятой берётся в кавычки", () => {
    expect(body([{ ip: "10.0.0.1", name: "ssh, http" }])[0]).toBe('10.0.0.1,"ssh, http"');
  });

  it("кавычки внутри значения удваиваются", () => {
    expect(body([{ ip: "10.0.0.1", name: 'сказал "привет"' }])[0]).toBe(
      '10.0.0.1,"сказал ""привет"""',
    );
  });

  it("перевод строки внутри значения не разрывает запись", () => {
    const line = body([{ ip: "10.0.0.1", name: "первая\nвторая" }]);
    expect(line[0]).toContain('"первая\nвторая"');
  });
});

describe("защита от CSV-инъекции", () => {
  // Имя хоста и баннер сервиса приходят из сканируемой сети — их содержимое
  // выбирает не пользователь. Excel трактует значение, начинающееся
  // с = + - @, как формулу, и оно выполнится при открытии выгрузки.

  it.each([
    ["=cmd|'/c calc'!A1", "формула через ="],
    ["+1+1", "формула через +"],
    ["-1+1", "формула через -"],
    ["@SUM(A1)", "формула через @"],
    ["\tтабуляция", "табуляция"],
  ])("обезвреживает %s (%s)", (hostile) => {
    const cell = body([{ ip: "10.0.0.1", name: hostile }])[0].split(",").slice(1).join(",");
    expect(cell.startsWith("'") || cell.startsWith('"\'')).toBe(true);
  });

  it("опасное значение остаётся читаемым — добавлен только апостроф", () => {
    const csv = toCsv(cols, [{ ip: "10.0.0.1", name: "=опасно" }]);
    expect(csv).toContain("'=опасно");
  });

  it("обычные значения не трогает", () => {
    expect(body([{ ip: "10.0.0.1", name: "nas.local" }])[0]).toBe("10.0.0.1,nas.local");
  });

  it("минус внутри значения безопасен и не экранируется", () => {
    expect(body([{ ip: "10.0.0.1", name: "web-server-01" }])[0]).toBe("10.0.0.1,web-server-01");
  });
});

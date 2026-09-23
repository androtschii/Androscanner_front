import { describe, expect, it } from "vitest";
import { classifyDevice } from "./deviceKind";

describe("classifyDevice", () => {
  it("принтер по jetdirect", () => {
    expect(classifyDevice({ services: ["jetdirect"], openPortsCount: 1 }).kind).toBe("printer");
  });

  it("телефон по ОС android", () => {
    expect(classifyDevice({ services: [], os: "Android 14", openPortsCount: 0 }).kind).toBe(
      "phone",
    );
  });

  it("телефон по вендору MAC (Apple → iPhone эвристика)", () => {
    expect(
      classifyDevice({ services: [], vendor: "Apple, Inc. (iPhone)", openPortsCount: 0 }).kind,
    ).toBe("phone");
  });

  it("компьютер по определённой ОС Windows", () => {
    expect(
      classifyDevice({ services: ["microsoft-ds"], os: "Windows 11", openPortsCount: 2 }).kind,
    ).toBe("computer");
  });

  it("компьютер по ОС Linux, с пометкой в подписи", () => {
    const r = classifyDevice({ services: [], os: "Linux 5.X", openPortsCount: 1 });
    expect(r.kind).toBe("computer");
    expect(r.label).toContain("Linux");
  });

  it("сервер по количеству открытых портов без явной ОС", () => {
    expect(classifyDevice({ services: [], openPortsCount: 6 }).kind).toBe("server");
  });

  it("сервер по узнаваемой СУБД на порту", () => {
    expect(classifyDevice({ services: ["postgresql"], openPortsCount: 1 }).kind).toBe("server");
  });

  it("роутер по производителю MAC", () => {
    expect(classifyDevice({ services: [], vendor: "TP-Link", openPortsCount: 1 }).kind).toBe(
      "router",
    );
  });

  it("компьютер по сервису SMB, если ОС не определена", () => {
    expect(classifyDevice({ services: ["netbios-ssn"], openPortsCount: 1 }).kind).toBe(
      "computer",
    );
  });

  it("неизвестно, если ничего не подошло", () => {
    expect(classifyDevice({ services: ["http"], openPortsCount: 1 }).kind).toBe("unknown");
  });

  it("не падает на пустом вводе", () => {
    expect(classifyDevice({}).kind).toBe("unknown");
  });
});

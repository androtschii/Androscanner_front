import { describe, expect, it } from "vitest";
import { assessPortRisk } from "./portRisk";

describe("assessPortRisk", () => {
  it("telnet — высокий риск", () => {
    const risk = assessPortRisk(23, "telnet");
    expect(risk.level).toBe("high");
    expect(risk.reason).toContain("текстом");
  });

  it("совпадение по порту даже без имени сервиса", () => {
    expect(assessPortRisk(23, null)).not.toBeNull();
  });

  it("совпадение по сервису на нестандартном порту", () => {
    const risk = assessPortRisk(12345, "vnc");
    expect(risk.level).toBe("high");
  });

  it("rdp — средний риск", () => {
    expect(assessPortRisk(3389, "ms-wbt-server").level).toBe("medium");
  });

  it("https — правила нет", () => {
    expect(assessPortRisk(443, "https")).toBeNull();
  });

  it("неизвестный порт — правила нет", () => {
    expect(assessPortRisk(54321, "unknown")).toBeNull();
  });

  it("регистр сервиса не важен", () => {
    expect(assessPortRisk(9999, "TELNET").level).toBe("high");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { copyToClipboard } from "./clipboard";

describe("copyToClipboard", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
  });

  it("вызывает navigator.clipboard.writeText с переданным текстом", async () => {
    await copyToClipboard("192.168.1.10");
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("192.168.1.10");
  });
});

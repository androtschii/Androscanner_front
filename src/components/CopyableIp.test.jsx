import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CopyableIp } from "./CopyableIp";

vi.mock("../lib/clipboard", () => ({ copyToClipboard: vi.fn() }));

import { copyToClipboard } from "../lib/clipboard";

beforeEach(() => {
  vi.clearAllMocks();
  copyToClipboard.mockResolvedValue(undefined);
});

describe("CopyableIp", () => {
  it("показывает значение", () => {
    render(<CopyableIp value="192.168.1.10" />);
    expect(screen.getByText("192.168.1.10")).toBeInTheDocument();
  });

  it("копирует в буфер обмена по клику", async () => {
    const user = userEvent.setup();
    render(<CopyableIp value="192.168.1.10" />);

    await user.click(screen.getByTitle("Скопировать адрес"));

    expect(copyToClipboard).toHaveBeenCalledWith("192.168.1.10");
    expect(await screen.findByTitle("Скопировано")).toBeInTheDocument();
  });

  it("не роняет клик родителя (stopPropagation)", async () => {
    const onParentClick = vi.fn();
    const user = userEvent.setup();
    render(
      <div onClick={onParentClick}>
        <CopyableIp value="192.168.1.10" />
      </div>,
    );

    await user.click(screen.getByTitle("Скопировать адрес"));
    expect(onParentClick).not.toHaveBeenCalled();
  });

  it("не падает, если буфер обмена недоступен", async () => {
    copyToClipboard.mockRejectedValue(new Error("denied"));
    const user = userEvent.setup();
    render(<CopyableIp value="192.168.1.10" />);

    await user.click(screen.getByTitle("Скопировать адрес"));
    expect(screen.getByText("192.168.1.10")).toBeInTheDocument();
  });
});

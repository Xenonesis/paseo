import { describe, it, expect, vi } from "vitest";
import { runServerIdlePruning } from "./memory-pruner.js";

type GlobalWithGc = typeof globalThis & {
  gc?: () => void;
};

describe("runServerIdlePruning", () => {
  it("triggers GC if available and no active sessions exist", () => {
    const gcMock = vi.fn();
    const g = globalThis as unknown as GlobalWithGc;
    g.gc = gcMock;

    runServerIdlePruning(0);
    expect(gcMock).toHaveBeenCalled();

    delete g.gc;
  });

  it("does not trigger GC when sessions are active", () => {
    const gcMock = vi.fn();
    const g = globalThis as unknown as GlobalWithGc;
    g.gc = gcMock;

    runServerIdlePruning(2);
    expect(gcMock).not.toHaveBeenCalled();

    delete g.gc;
  });
});

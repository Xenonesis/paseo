import { describe, it, expect } from "vitest";
import {
  configureChromiumMemoryFlags,
  registerMemoryPressureHandlers,
  setupMemoryOptimization,
  type AppMemoryOptimizationTarget,
  type CommandLineInterface,
} from "./memory-optimizer.js";

describe("memory-optimizer", () => {
  it("appends required memory and tab-discarding flags", () => {
    const appended: Record<string, string | undefined> = {};
    const mockCommandLine: CommandLineInterface = {
      appendSwitch: (key: string, val?: string) => {
        appended[key] = val;
      },
      hasSwitch: () => false,
    };

    configureChromiumMemoryFlags(mockCommandLine);
    expect(appended["enable-features"]).toContain("AutomaticTabDiscarding");
    expect(appended["js-flags"]).toContain("--max-old-space-size=256");
  });

  it("registers memory-pressure listener when supported", () => {
    const listeners: Record<string, (...args: unknown[]) => void> = {};
    const mockApp = {
      on: (event: string, cb: (...args: unknown[]) => void) => {
        listeners[event] = cb;
      },
    };
    registerMemoryPressureHandlers(mockApp);
    expect(typeof listeners["render-process-gone"]).toBe("function");
  });

  it("calls configureChromiumMemoryFlags and registerMemoryPressureHandlers in setupMemoryOptimization", () => {
    const appended: Record<string, string | undefined> = {};
    const listeners: Record<string, (...args: unknown[]) => void> = {};
    const mockApp: AppMemoryOptimizationTarget = {
      commandLine: {
        appendSwitch: (key: string, val?: string) => {
          appended[key] = val;
        },
        hasSwitch: () => false,
      },
      on: (event: string, cb: (...args: unknown[]) => void) => {
        listeners[event] = cb;
      },
    };

    setupMemoryOptimization(mockApp);
    expect(appended["enable-features"]).toContain("AutomaticTabDiscarding");
    expect(typeof listeners["render-process-gone"]).toBe("function");
  });
});

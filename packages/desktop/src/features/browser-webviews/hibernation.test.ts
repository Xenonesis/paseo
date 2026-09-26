import { describe, it, expect, vi, beforeEach } from "vitest";
import { TabHibernationManager } from "./hibernation.js";

describe("TabHibernationManager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("transitions active tab to idle after timeout and signals hibernation", () => {
    const manager = new TabHibernationManager({ idleTimeoutMs: 60000 });
    manager.registerTab("tab-1");
    manager.markActive("tab-1");

    expect(manager.isHibernated("tab-1")).toBe(false);

    manager.markIdle("tab-1");
    vi.advanceTimersByTime(60000);

    expect(manager.isHibernated("tab-1")).toBe(true);
  });

  it("prevents hibernation if active CDP session is open", () => {
    const manager = new TabHibernationManager({ idleTimeoutMs: 60000 });
    manager.registerTab("tab-2");
    manager.setCdpActive("tab-2", true);
    manager.markIdle("tab-2");

    vi.advanceTimersByTime(60000);
    expect(manager.isHibernated("tab-2")).toBe(false);
  });

  it("cancels hibernation timer when tab is marked active before timeout", () => {
    const manager = new TabHibernationManager({ idleTimeoutMs: 60000 });
    manager.registerTab("tab-3");
    manager.markIdle("tab-3");

    vi.advanceTimersByTime(30000);
    manager.markActive("tab-3");
    vi.advanceTimersByTime(30000);

    expect(manager.isHibernated("tab-3")).toBe(false);
  });

  it("wakes hibernated tab if CDP becomes active", () => {
    const manager = new TabHibernationManager({ idleTimeoutMs: 60000 });
    manager.registerTab("tab-4");
    manager.markIdle("tab-4");
    vi.advanceTimersByTime(60000);
    expect(manager.isHibernated("tab-4")).toBe(true);

    manager.setCdpActive("tab-4", true);
    expect(manager.isHibernated("tab-4")).toBe(false);
  });

  it("handles unregisterTab correctly", () => {
    const manager = new TabHibernationManager({ idleTimeoutMs: 60000 });
    manager.registerTab("tab-5");
    manager.markIdle("tab-5");
    manager.unregisterTab("tab-5");

    vi.advanceTimersByTime(60000);
    expect(manager.isHibernated("tab-5")).toBe(false);
  });
});

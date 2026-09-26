export interface HibernationOptions {
  idleTimeoutMs: number;
}

export type TabLifecycleState = "ACTIVE" | "IDLE" | "HIBERNATED";

export interface TabLifecycleEntry {
  state: TabLifecycleState;
  hasActiveCdp: boolean;
  idleTimer?: NodeJS.Timeout | number;
}

export class TabHibernationManager {
  private tabs = new Map<string, TabLifecycleEntry>();

  constructor(private options: HibernationOptions = { idleTimeoutMs: 60000 }) {}

  registerTab(tabId: string): void {
    this.tabs.set(tabId, { state: "ACTIVE", hasActiveCdp: false });
  }

  unregisterTab(tabId: string): void {
    const entry = this.tabs.get(tabId);
    clearTimeout(entry?.idleTimer);
    this.tabs.delete(tabId);
  }

  setCdpActive(tabId: string, active: boolean): void {
    const entry = this.tabs.get(tabId);
    if (!entry) return;
    entry.hasActiveCdp = active;
    if (active && entry.state === "HIBERNATED") {
      this.markActive(tabId);
    }
  }

  markActive(tabId: string): void {
    const entry = this.tabs.get(tabId);
    if (!entry) return;
    clearTimeout(entry.idleTimer);
    entry.state = "ACTIVE";
  }

  markIdle(tabId: string): void {
    const entry = this.tabs.get(tabId);
    if (!entry) return;
    entry.state = "IDLE";
    clearTimeout(entry.idleTimer);
    entry.idleTimer = setTimeout(() => {
      if (!entry.hasActiveCdp && entry.state === "IDLE") {
        entry.state = "HIBERNATED";
      }
    }, this.options.idleTimeoutMs);
  }

  isHibernated(tabId: string): boolean {
    return this.tabs.get(tabId)?.state === "HIBERNATED";
  }

  /**
   * Evaluates if a tab is eligible for memory hibernation.
   */
  shouldHibernate(tabId: string): boolean {
    const entry = this.tabs.get(tabId);
    if (!entry || entry.hasActiveCdp) {
      return false;
    }
    return entry.state === "IDLE" || entry.state === "HIBERNATED";
  }
}

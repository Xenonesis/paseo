type GlobalWithGc = typeof globalThis & {
  gc?: () => void;
};

export function runServerIdlePruning(activeSessionCount: number): void {
  const g = globalThis as unknown as GlobalWithGc;
  if (activeSessionCount === 0 && typeof g.gc === "function") {
    g.gc();
  }
}

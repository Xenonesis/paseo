export interface CommandLineInterface {
  appendSwitch(key: string, value?: string): void;
  hasSwitch(key: string): boolean;
}

export interface RenderProcessGoneDetails {
  reason?: string;
  exitCode?: number;
}

export interface AppMemoryOptimizationTarget {
  commandLine: CommandLineInterface;
  on(event: string, listener: (...args: unknown[]) => void): void;
}

export function configureChromiumMemoryFlags(commandLine: CommandLineInterface): void {
  if (!commandLine.hasSwitch("enable-features")) {
    commandLine.appendSwitch("enable-features", "AutomaticTabDiscarding,WebContentsDiscarding");
  }
  if (!commandLine.hasSwitch("js-flags")) {
    commandLine.appendSwitch("js-flags", "--max-old-space-size=256");
  }
}

export function registerMemoryPressureHandlers(app: {
  on(event: string, listener: (...args: unknown[]) => void): void;
}): void {
  app.on("render-process-gone", (_event: unknown, details?: unknown) => {
    if (details && typeof details === "object" && "reason" in details) {
      const { reason } = details as RenderProcessGoneDetails;
      if (reason === "killed" || reason === "crashed") {
        // Reclaim / clean orphan references
      }
    }
  });
}

export function setupMemoryOptimization(app: {
  commandLine: CommandLineInterface;
  on(event: string, listener: (...args: unknown[]) => void): void;
}): void {
  configureChromiumMemoryFlags(app.commandLine);
  registerMemoryPressureHandlers(app);
}

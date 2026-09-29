import fs from "node:fs/promises";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import {
  type BrowserAutomationCommand,
  type BrowserAutomationCommandName,
  type BrowserAutomationExecuteRequest,
  type BrowserAutomationResult,
  BROWSER_AUTOMATION_COMMAND_NAMES,
} from "@getpaseo/protocol/browser-automation/rpc-schemas";
import type { BrowserHostClient } from "./broker.js";
import {
  type CaptureCurrentFrameOptions,
  type CapturedFrame,
  type PlaywrightBrowserHostClientOptions,
  type PlaywrightBrowserHostOnResponse,
  type PlaywrightBrowserHostOptions,
  resolveDefaultBrowserUserDataDir,
} from "./types.js";

export * from "./types.js";

export class PlaywrightBrowserHostClient implements BrowserHostClient {
  public readonly id = "playwright-daemon-browser-host";
  public readonly hostKind = "playwright-daemon";
  public readonly supportedCommands: readonly BrowserAutomationCommandName[] =
    BROWSER_AUTOMATION_COMMAND_NAMES;

  private readonly onResponse: PlaywrightBrowserHostOnResponse;
  private readonly options: PlaywrightBrowserHostOptions;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private readonly tabs = new Map<string, Page>();
  private activeTabId: string | null = null;
  private initializingPromise: Promise<{
    browser: Browser | null;
    context: BrowserContext;
  }> | null = null;

  public constructor(
    onResponse: PlaywrightBrowserHostOnResponse,
    options?: PlaywrightBrowserHostOptions,
  );
  public constructor(options?: PlaywrightBrowserHostClientOptions);
  public constructor(
    onResponseOrOptions?: PlaywrightBrowserHostOnResponse | PlaywrightBrowserHostClientOptions,
    options?: PlaywrightBrowserHostOptions,
  ) {
    if (typeof onResponseOrOptions === "function") {
      this.onResponse = onResponseOrOptions;
      this.options = options ?? {};
    } else {
      this.onResponse = onResponseOrOptions?.onResponse ?? (() => {});
      this.options = onResponseOrOptions ?? {};
    }
  }

  public get isPersistent(): boolean {
    return this.options.persistent ?? true;
  }

  public get userDataDir(): string | null {
    return this.isPersistent
      ? (this.options.userDataDir ?? resolveDefaultBrowserUserDataDir())
      : null;
  }

  public get activeBrowserId(): string | null {
    return this.activeTabId;
  }

  private async ensureBrowser(): Promise<{ browser: Browser | null; context: BrowserContext }> {
    if (this.context) {
      return { browser: this.browser, context: this.context };
    }

    if (this.initializingPromise) {
      return this.initializingPromise;
    }

    this.initializingPromise = (async () => {
      try {
        const isPersistent = this.options.persistent ?? true;
        const headless = this.options.headless ?? true;
        const viewport = this.options.viewport === undefined ? null : this.options.viewport;
        const args = this.options.args;

        if (isPersistent) {
          const userDataDir = this.options.userDataDir ?? resolveDefaultBrowserUserDataDir();
          await fs.mkdir(userDataDir, { recursive: true });
          this.context = await chromium.launchPersistentContext(userDataDir, {
            headless,
            viewport,
            args,
          });
          this.browser = this.context.browser();
        } else {
          this.browser = await chromium.launch({
            headless,
            args,
          });
          this.context = await this.browser.newContext({
            viewport,
          });
        }

        this.context.on("close", () => {
          this.context = null;
          this.browser = null;
          this.tabs.clear();
          this.activeTabId = null;
        });

        this.context.on("page", (page) => {
          this.registerPage(page);
        });

        for (const page of this.context.pages()) {
          this.registerPage(page);
        }

        return { browser: this.browser, context: this.context };
      } finally {
        this.initializingPromise = null;
      }
    })();

    return this.initializingPromise;
  }

  private registerPage(page: Page, preferredId?: string): string {
    for (const [id, trackedPage] of this.tabs.entries()) {
      if (trackedPage === page) {
        return id;
      }
    }

    const tabId = preferredId ?? `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
    this.tabs.set(tabId, page);
    if (!this.activeTabId) {
      this.activeTabId = tabId;
    }

    page.once("close", () => {
      this.tabs.delete(tabId);
      if (this.activeTabId === tabId) {
        this.activeTabId = this.tabs.keys().next().value ?? null;
      }
    });

    return tabId;
  }

  private getActivePage(browserId?: string): Page {
    const id = browserId || this.activeTabId || this.tabs.keys().next().value;
    const page = id ? this.tabs.get(id) : null;
    if (!page) {
      throw new Error("No active browser tab found");
    }
    if (!this.activeTabId && id) {
      this.activeTabId = id;
    }
    return page;
  }

  /**
   * Captures a live frame from the active (or specified) browser tab.
   * Encoded as base64 JPEG for real-time live agent stream inspection and preview.
   */
  public async captureCurrentFrame(
    options?: CaptureCurrentFrameOptions,
  ): Promise<CapturedFrame> {
    const { context } = await this.ensureBrowser();

    if (this.tabs.size === 0) {
      const page = await context.newPage();
      this.registerPage(page);
    }

    const page = this.getActivePage(options?.browserId);
    const rawQuality = options?.quality ?? 80;
    const quality = Math.min(100, Math.max(0, Math.round(rawQuality)));
    const fullPage = options?.fullPage ?? false;

    const buffer = await page.screenshot({
      type: "jpeg",
      quality,
      fullPage,
    });

    const data = buffer.toString("base64");
    const browserId =
      options?.browserId ?? this.activeTabId ?? this.tabs.keys().next().value ?? "";
    const url = page.url();
    const title = await page.title().catch(() => "");
    const timestamp = Date.now();

    return {
      data,
      dataUrl: `data:image/jpeg;base64,${data}`,
      mimeType: "image/jpeg",
      timestamp,
      url,
      title,
      browserId,
      toString() {
        return data;
      },
    };
  }

  public async sendBrowserAutomationRequest(
    request: BrowserAutomationExecuteRequest,
  ): Promise<void> {
    const { requestId, command } = request;
    try {
      const result = await this.execute(command);
      this.onResponse({
        type: "browser.automation.execute.response",
        payload: {
          requestId,
          ok: true,
          result: result as unknown as BrowserAutomationResult,
        },
      });
    } catch (err: unknown) {
      this.onResponse({
        type: "browser.automation.execute.response",
        payload: {
          requestId,
          ok: false,
          error: {
            code: "browser_unknown_error",
            message: err instanceof Error ? err.message : String(err),
            retryable: false,
          },
        },
      });
    }
  }

  private async execute(command: BrowserAutomationCommand): Promise<Record<string, unknown>> {
    const { context } = await this.ensureBrowser();

    switch (command.command) {
      case "list_tabs": {
        const tabs = await Promise.all(
          Array.from(this.tabs.entries()).map(async ([id, page]) => {
            const title = await page.title().catch(() => page.url());
            const url = page.url();
            const isActive = id === this.activeTabId;
            return {
              browserId: id,
              title,
              url,
              active: isActive,
              isActive,
              isLoading: false,
            };
          }),
        );
        return { tabs };
      }

      case "new_tab": {
        const page = await context.newPage();
        const tabId = this.registerPage(page);
        this.activeTabId = tabId;
        if (command.args?.url) {
          await page.goto(command.args.url);
        }
        return {
          browserId: tabId,
          title: await page.title().catch(() => page.url()),
          url: page.url(),
        };
      }

      case "close_tab": {
        const targetId = command.args?.browserId || this.activeTabId;
        if (targetId && this.tabs.has(targetId)) {
          const page = this.tabs.get(targetId)!;
          await page.close().catch(() => {});
          this.tabs.delete(targetId);
          if (this.activeTabId === targetId) {
            this.activeTabId = this.tabs.keys().next().value ?? null;
          }
        }
        return { closed: true };
      }

      case "navigate": {
        const page = this.getActivePage(command.args?.browserId);
        await page.goto(command.args.url);
        return {
          title: await page.title().catch(() => page.url()),
          url: page.url(),
        };
      }

      case "snapshot": {
        const page = this.getActivePage(command.args?.browserId);
        const content = await page.content();
        return {
          snapshot: content,
          title: await page.title().catch(() => page.url()),
          url: page.url(),
        };
      }

      case "screenshot": {
        const page = this.getActivePage(command.args?.browserId);
        const buffer = await page.screenshot({ fullPage: command.args?.fullPage ?? false });
        return {
          data: buffer.toString("base64"),
          mimeType: "image/png",
        };
      }

      case "click": {
        const page = this.getActivePage(command.args?.browserId);
        if (command.args?.ref) {
          await page.click(command.args.ref);
        }
        return { clicked: true };
      }

      case "type": {
        const page = this.getActivePage(command.args?.browserId);
        if (command.args?.text) {
          await page.keyboard.type(command.args.text);
        }
        return { typed: true };
      }

      case "scroll": {
        const page = this.getActivePage(command.args?.browserId);
        await page.mouse.wheel(command.args?.deltaX ?? 0, command.args?.deltaY ?? 0);
        return { scrolled: true };
      }

      case "evaluate": {
        const page = this.getActivePage(command.args?.browserId);
        const result = await page.evaluate(command.args.function);
        return { result };
      }

      case "reload": {
        const page = this.getActivePage(command.args?.browserId);
        await page.reload();
        return {
          title: await page.title().catch(() => page.url()),
          url: page.url(),
        };
      }

      case "back": {
        const page = this.getActivePage(command.args?.browserId);
        await page.goBack();
        return {
          title: await page.title().catch(() => page.url()),
          url: page.url(),
        };
      }

      case "forward": {
        const page = this.getActivePage(command.args?.browserId);
        await page.goForward();
        return {
          title: await page.title().catch(() => page.url()),
          url: page.url(),
        };
      }

      case "keypress": {
        const page = this.getActivePage(command.args?.browserId);
        if (command.args?.key) {
          await page.keyboard.press(command.args.key);
        }
        return { pressed: true };
      }

      case "resize": {
        const page = this.getActivePage(command.args?.browserId);
        if (command.args?.width && command.args?.height) {
          await page.setViewportSize({
            width: command.args.width,
            height: command.args.height,
          });
        }
        return { resized: true };
      }

      default:
        return { acknowledged: true };
    }
  }
  public async close(): Promise<void> {
    const context = this.context;
    const browser = this.browser;
    this.context = null;
    this.browser = null;
    this.tabs.clear();
    this.activeTabId = null;

    if (context) {
      await context.close().catch(() => {});
    }
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import {
  type BrowserAutomationCommand,
  type BrowserAutomationCommandName,
  type BrowserAutomationExecuteRequest,
  type BrowserAutomationExecuteResponse,
  BROWSER_AUTOMATION_COMMAND_NAMES,
} from "@getpaseo/protocol/browser-automation/rpc-schemas";
import type { BrowserHostClient } from "./broker.js";

export class PlaywrightBrowserHostClient implements BrowserHostClient {
  public readonly id = "playwright-daemon-browser-host";
  public readonly hostKind = "playwright-daemon";
  public readonly supportedCommands: readonly BrowserAutomationCommandName[] =
    BROWSER_AUTOMATION_COMMAND_NAMES;

  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private readonly tabs = new Map<string, Page>();
  private activeTabId: string | null = null;

  public constructor(
    private readonly onResponse: (response: BrowserAutomationExecuteResponse) => void,
  ) {}

  private async ensureBrowser(): Promise<{ browser: Browser; context: BrowserContext }> {
    if (!this.browser) {
      this.browser = await chromium.launch({ headless: true });
      this.context = await this.browser.newContext();
    }
    return { browser: this.browser, context: this.context! };
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
          ...result,
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
          },
        },
      });
    }
  }

  private async execute(command: BrowserAutomationCommand): Promise<Record<string, unknown>> {
    const { context } = await this.ensureBrowser();

    switch (command.command) {
      case "list_tabs": {
        const tabs = Array.from(this.tabs.entries()).map(([id, page]) => ({
          browserId: id,
          title: page.url(),
          url: page.url(),
          active: id === this.activeTabId,
        }));
        return { tabs };
      }

      case "new_tab": {
        const page = await context.newPage();
        const tabId = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        this.tabs.set(tabId, page);
        this.activeTabId = tabId;
        if (command.args?.url) {
          await page.goto(command.args.url);
        }
        return {
          browserId: tabId,
          title: await page.title(),
          url: page.url(),
        };
      }

      case "close_tab": {
        const targetId = command.args?.browserId || this.activeTabId;
        if (targetId && this.tabs.has(targetId)) {
          const page = this.tabs.get(targetId)!;
          await page.close();
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
          title: await page.title(),
          url: page.url(),
        };
      }

      case "snapshot": {
        const page = this.getActivePage(command.args?.browserId);
        const content = await page.content();
        return {
          snapshot: content,
          title: await page.title(),
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

      default:
        return { acknowledged: true };
    }
  }

  private getActivePage(browserId?: string): Page {
    const id = browserId || this.activeTabId;
    const page = id ? this.tabs.get(id) : null;
    if (!page) {
      throw new Error("No active browser tab found");
    }
    return page;
  }

  public async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.tabs.clear();
      this.activeTabId = null;
    }
  }
}

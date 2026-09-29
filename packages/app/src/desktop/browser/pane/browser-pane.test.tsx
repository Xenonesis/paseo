// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";

afterEach(() => {
  cleanup();
});

const { theme } = vi.hoisted(() => ({
  theme: {
    colors: {
      background: "#000",
      foreground: "#fff",
      foregroundMuted: "#888",
      border: "#222",
      surface0: "#111",
      surface1: "#181818",
      surface2: "#222",
      surface3: "#333",
    },
    spacing: { 1: 4, 1.5: 6, 2: 8, 3: 12, 4: 16, 6: 24 },
    iconSize: { xs: 12, sm: 14, md: 16, lg: 20 },
    borderWidth: { 1: 1, 2: 2 },
    fontSize: { sm: 12, base: 14, lg: 16 },
    fontWeight: { normal: "400", medium: "500", semibold: "600" },
    borderRadius: { sm: 4, md: 6, lg: 8, full: 999 },
    opacity: { 50: 0.5 },
    shadow: { md: {} },
  },
}));
vi.mock("react-native-unistyles", () => ({
  StyleSheet: {
    create: (factory: unknown) =>
      typeof factory === "function"
        ? (factory as (t: typeof theme) => unknown)(theme)
        : factory,
    absoluteFillObject: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  },
  useUnistyles: () => ({ theme }),
  withUnistyles: (c: unknown) => c,
}));

vi.mock("lucide-react-native", () => {
  const createIcon = (name: string) => ({ style: _style, ...props }: Record<string, unknown>) =>
    React.createElement("span", { ...props, "data-icon": name });
  return {
    ArrowLeft: createIcon("ArrowLeft"),
    ArrowRight: createIcon("ArrowRight"),
    Copy: createIcon("Copy"),
    ExternalLink: createIcon("ExternalLink"),
    Globe: createIcon("Globe"),
    Maximize: createIcon("Maximize"),
    Monitor: createIcon("Monitor"),
    MousePointer2: createIcon("MousePointer2"),
    RotateCw: createIcon("RotateCw"),
    Smartphone: createIcon("Smartphone"),
    Tablet: createIcon("Tablet"),
  };
});

import {
  BrowserLoadFailureOverlay,
  getHttpsRecoveryUrl,
  parseHostFromUrl,
} from "./browser-load-failure-overlay";
import { BrowserNavigationBar } from "./browser-navigation-bar";

describe("browser URL helpers", () => {
  it("parses host from full URL", () => {
    expect(parseHostFromUrl("http://localhost:3000/medical-inquiry")).toBe("localhost:3000");
    expect(parseHostFromUrl("https://example.com/api/test")).toBe("example.com");
    expect(parseHostFromUrl("localhost:8080")).toBe("localhost:8080");
  });

  it("generates https recovery url", () => {
    expect(getHttpsRecoveryUrl("http://localhost:3000/medical-inquiry")).toBe(
      "https://localhost:3000/medical-inquiry",
    );
    expect(getHttpsRecoveryUrl("https://localhost:3000")).toBeNull();
  });
});

describe("BrowserLoadFailureOverlay", () => {
  it("renders host error title and guidance description matching Orca design", () => {
    const onRetry = vi.fn();
    const onCopy = vi.fn();

    const { getByText, getByTestId } = render(
      <BrowserLoadFailureOverlay
        currentUrl="http://localhost:3000/medical-inquiry"
        onRetry={onRetry}
        onCopyAddress={onCopy}
      />,
    );

    expect(getByText("Can't reach localhost:3000")).toBeDefined();
    expect(getByText(/We couldn't connect to your local server/)).toBeDefined();

    expect(getByTestId("browser-retry-btn")).toBeDefined();
    expect(getByTestId("browser-copy-btn")).toBeDefined();
  });

  it("handles Try HTTPS and Open Externally action buttons", () => {
    const onRetry = vi.fn();
    const onTryHttps = vi.fn();
    const onCopy = vi.fn();
    const onOpenExternally = vi.fn();

    const { getByTestId } = render(
      <BrowserLoadFailureOverlay
        currentUrl="http://localhost:3000/medical-inquiry"
        onRetry={onRetry}
        onTryHttps={onTryHttps}
        onCopyAddress={onCopy}
        onOpenExternally={onOpenExternally}
      />,
    );

    const tryHttpsBtn = getByTestId("browser-try-https-btn");
    fireEvent.click(tryHttpsBtn);
    expect(onTryHttps).toHaveBeenCalledWith("https://localhost:3000/medical-inquiry");

    const retryBtn = getByTestId("browser-retry-btn");
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalled();

    const copyBtn = getByTestId("browser-copy-btn");
    fireEvent.click(copyBtn);
    expect(onCopy).toHaveBeenCalledWith("http://localhost:3000/medical-inquiry");

    const externalBtn = getByTestId("browser-open-external-btn");
    fireEvent.click(externalBtn);
    expect(onOpenExternally).toHaveBeenCalledWith("http://localhost:3000/medical-inquiry");
  });
});

describe("BrowserNavigationBar", () => {
  it("renders address input, navigation buttons, and responds to navigation", () => {
    const onNavigate = vi.fn();
    const onGoBack = vi.fn();
    const onGoForward = vi.fn();
    const onReload = vi.fn();

    const { getByTestId } = render(
      <BrowserNavigationBar
        url="http://localhost:3000/medical-inquiry"
        canGoBack={true}
        canGoForward={false}
        onNavigate={onNavigate}
        onGoBack={onGoBack}
        onGoForward={onGoForward}
        onReload={onReload}
      />,
    );

    const input = getByTestId("browser-address-input");
    expect(input).toBeDefined();

    const backBtn = getByTestId("browser-back-btn");
    fireEvent.click(backBtn);
    expect(onGoBack).toHaveBeenCalled();

    const reloadBtn = getByTestId("browser-reload-btn");
    fireEvent.click(reloadBtn);
    expect(onReload).toHaveBeenCalled();
  });

  it("handles viewport preset selection", () => {
    const onNavigate = vi.fn();
    const onSelectViewport = vi.fn();

    const { getByTestId } = render(
      <BrowserNavigationBar
        url="http://localhost:3000"
        onNavigate={onNavigate}
        onSelectViewportPreset={onSelectViewport}
      />,
    );

    fireEvent.click(getByTestId("viewport-desktop"));
    expect(onSelectViewport).toHaveBeenCalledWith("desktop");

    fireEvent.click(getByTestId("viewport-mobile"));
    expect(onSelectViewport).toHaveBeenCalledWith("mobile");
  });
});

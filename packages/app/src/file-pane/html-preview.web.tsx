import React, { useCallback, useMemo, useRef, useState } from "react";
import { Linking, Platform, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import * as Clipboard from "expo-clipboard";
import type { DaemonClient } from "@getpaseo/client/internal/daemon-client";
import { useToast } from "@/contexts/toast-context";
import { BrowserTabBar, type BrowserTabItem } from "@/desktop/browser/pane/browser-tab-bar";
import { BrowserNavigationBar } from "@/desktop/browser/pane/browser-navigation-bar";
import { BrowserLoadFailureOverlay, parseHostFromUrl } from "@/desktop/browser/pane/browser-load-failure-overlay";
import { BrowserImportDialog } from "@/desktop/browser/pane/browser-import-dialog";
import { isLocalhostUrl, resolveIframeTargetUrl } from "@/desktop/browser/pane/url-utils";
import { useSendBrowserUrlToAgent } from "@/desktop/browser/pane/use-send-browser-url-to-agent";
import { withPreviewCsp } from "./html-preview-csp";
import { useInlinedHtmlAssets } from "./use-inlined-html-assets";

const SANDBOX = "allow-scripts allow-same-origin allow-forms allow-popups allow-modals";

interface HtmlTabState {
  id: string;
  url: string;
  title: string;
  isFile: boolean;
  history: string[];
  historyIndex: number;
  isLoading: boolean;
  hasLoadError: boolean;
}

export function FileHtmlPreview({
  html,
  cwd,
  filePath,
  client,
  testID = "file-html-preview",
}: {
  html: string;
  cwd?: string | null;
  filePath?: string | null;
  client?: DaemonClient | null;
  testID?: string;
}) {
  const { t } = useTranslation();
  const toast = useToast();

  const fileName = useMemo(() => {
    if (!filePath) return "index.html";
    const parts = filePath.split(/[/\\]/);
    return parts[parts.length - 1] || "index.html";
  }, [filePath]);

  const displayFileAddress = useMemo(() => {
    return filePath || "index.html";
  }, [filePath]);

  // Tab management
  const [tabs, setTabs] = useState<HtmlTabState[]>([
    {
      id: "tab-file",
      url: displayFileAddress,
      title: fileName,
      isFile: true,
      history: [displayFileAddress],
      historyIndex: 0,
      isLoading: false,
      hasLoadError: false,
    },
  ]);
  const [activeTabId, setActiveTabId] = useState("tab-file");
  const [viewportPreset, setViewportPreset] = useState<"responsive" | "desktop" | "tablet" | "mobile">("responsive");
  const [isInspectActive, setIsInspectActive] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) ?? tabs[0]!,
    [tabs, activeTabId],
  );

  // Inlined assets for the local HTML file
  const inlinedHtml = useInlinedHtmlAssets({ html, cwd, filePath, client });
  const inlinedDocument = useMemo(() => withPreviewCsp(inlinedHtml), [inlinedHtml]);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const navigateTo = useCallback((newUrl: string) => {
    setTabs((prev) =>
      prev.map((tab) => {
        if (tab.id !== activeTabId) return tab;
        const newHistory = tab.history.slice(0, tab.historyIndex + 1);
        newHistory.push(newUrl);
        return {
          ...tab,
          url: newUrl,
          title: parseHostFromUrl(newUrl),
          isFile: false,
          hasLoadError: false,
          history: newHistory,
          historyIndex: newHistory.length - 1,
        };
      }),
    );
  }, [activeTabId]);

  const handleGoBack = useCallback(() => {
    if (activeTab.historyIndex > 0) {
      const prevUrl = activeTab.history[activeTab.historyIndex - 1]!;
      setTabs((prev) =>
        prev.map((tab) =>
          tab.id === activeTabId
            ? {
                ...tab,
                url: prevUrl,
                isFile: prevUrl === displayFileAddress,
                title: prevUrl === displayFileAddress ? fileName : parseHostFromUrl(prevUrl),
                historyIndex: tab.historyIndex - 1,
              }
            : tab,
        ),
      );
    }
  }, [activeTab, activeTabId, displayFileAddress, fileName]);

  const handleGoForward = useCallback(() => {
    if (activeTab.historyIndex < activeTab.history.length - 1) {
      const nextUrl = activeTab.history[activeTab.historyIndex + 1]!;
      setTabs((prev) =>
        prev.map((tab) =>
          tab.id === activeTabId
            ? {
                ...tab,
                url: nextUrl,
                isFile: nextUrl === displayFileAddress,
                title: nextUrl === displayFileAddress ? fileName : parseHostFromUrl(nextUrl),
                historyIndex: tab.historyIndex + 1,
              }
            : tab,
        ),
      );
    }
  }, [activeTab, activeTabId, displayFileAddress, fileName]);

  const handleReload = useCallback(() => {
    setTabs((prev) =>
      prev.map((t) => (t.id === activeTabId ? { ...t, hasLoadError: false } : t)),
    );
    if (iframeRef.current) {
      if (activeTab.isFile) {
        iframeRef.current.srcdoc = inlinedDocument;
      } else {
        iframeRef.current.src = resolveIframeTargetUrl(activeTab.url);
      }
    }
  }, [activeTab, inlinedDocument]);

  const handleCopyAddress = useCallback(
    async (urlToCopy: string) => {
      await Clipboard.setStringAsync(urlToCopy);
      toast.show("Address copied to clipboard");
    },
    [toast],
  );

  const handleOpenExternally = useCallback(
    async (targetUrl: string) => {
      try {
        await Linking.openURL(targetUrl);
      } catch {
        toast.show("Unable to open URL externally");
      }
    },
    [toast],
  );

  const handleNewTab = useCallback(() => {
    const newId = `tab-${Date.now()}`;
    const defaultUrl = "https://google.com";
    const newTab: HtmlTabState = {
      id: newId,
      url: defaultUrl,
      title: "google.com",
      isFile: false,
      history: [defaultUrl],
      historyIndex: 0,
      isLoading: false,
      hasLoadError: false,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
  }, []);

  const handleCloseTab = useCallback(
    (tabId: string) => {
      setTabs((prev) => {
        if (prev.length <= 1) return prev;
        const filtered = prev.filter((t) => t.id !== tabId);
        if (activeTabId === tabId) {
          setActiveTabId(filtered[filtered.length - 1]!.id);
        }
        return filtered;
      });
    },
    [activeTabId],
  );

  const { sendToAgent } = useSendBrowserUrlToAgent();
  const handleSendToAgent = useCallback(() => {
    void sendToAgent(activeTab.url, activeTab.title);
  }, [activeTab.title, activeTab.url, sendToAgent]);
  const handleImportSession = useCallback(
    (_cookiesText: string, source: "chrome" | "edge" | "manual") => {
      toast.show(`Imported ${source} session cookies`);
      handleReload();
    },
    [handleReload, toast],
  );

  const viewportStyle = useMemo(() => {
    switch (viewportPreset) {
      case "desktop":
        return styles.viewportDesktop;
      case "tablet":
        return styles.viewportTablet;
      case "mobile":
        return styles.viewportMobile;
      case "responsive":
      default:
        return styles.viewportResponsive;
    }
  }, [viewportPreset]);

  const tabItems: BrowserTabItem[] = useMemo(
    () =>
      tabs.map((t) => ({
        id: t.id,
        url: t.url,
        title: t.title,
        isLoading: t.isLoading,
      })),
    [tabs],
  );

  return (
    <View style={styles.container} testID={testID}>
      {/* 1. Top Browser Tabs Bar matching Orca */}
      <BrowserTabBar
        tabs={tabItems}
        activeTabId={activeTabId}
        onSelectTab={setActiveTabId}
        onCloseTab={handleCloseTab}
        onNewTab={handleNewTab}
      />

      {/* 2. Top Browser Navigation Toolbar */}
      <BrowserNavigationBar
        url={activeTab.url}
        canGoBack={activeTab.historyIndex > 0}
        canGoForward={activeTab.historyIndex < activeTab.history.length - 1}
        isLoading={activeTab.isLoading}
        viewportPreset={viewportPreset}
        onNavigate={navigateTo}
        onGoBack={handleGoBack}
        onGoForward={handleGoForward}
        onReload={handleReload}
        onOpenImport={() => setIsImportOpen(true)}
        onSendToAgent={handleSendToAgent}
        onCopyAddress={handleCopyAddress}
        onOpenExternally={handleOpenExternally}
        onToggleInspect={() => setIsInspectActive((prev) => !prev)}
        isInspectActive={isInspectActive}
        onSelectViewportPreset={setViewportPreset}
      />

      {/* 3. Main Viewport Content */}
      <View style={styles.viewportWrapper}>
        <View style={viewportStyle}>
          {Platform.OS === "web" ? (
            activeTab.isFile ? (
              <iframe
                key={activeTab.id}
                ref={iframeRef}
                srcDoc={inlinedDocument}
                style={iframeInnerStyle}
                sandbox={SANDBOX}
                referrerPolicy="no-referrer"
              />
            ) : (
              <iframe
                key={activeTab.id}
                ref={iframeRef}
                src={resolveIframeTargetUrl(activeTab.url)}
                style={iframeInnerStyle}
                sandbox={SANDBOX}
                referrerPolicy="no-referrer"
                onError={() =>
                  setTabs((prev) =>
                    prev.map((t) => (t.id === activeTabId ? { ...t, hasLoadError: true } : t)),
                  )
                }
              />
            )
          ) : null}

          {/* 4. Orca-style Load Failure Overlay if URL unreachable */}
          {activeTab.hasLoadError ? (
            <BrowserLoadFailureOverlay
              currentUrl={activeTab.url}
              onRetry={handleReload}
              onCopyAddress={handleCopyAddress}
              onOpenExternally={handleOpenExternally}
            />
          ) : null}
        </View>
      </View>

      {/* 5. Cookie / Auth Import Dialog */}
      <BrowserImportDialog
        visible={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImport={handleImportSession}
      />
    </View>
  );
}

const iframeInnerStyle = {
  width: "100%",
  height: "100%",
  border: "none",
  backgroundColor: "white",
} as const;

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  viewportWrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surface1,
    overflow: "hidden",
  },
  viewportResponsive: {
    width: "100%",
    height: "100%",
    position: "relative",
  },
  viewportDesktop: {
    width: 1280,
    height: 800,
    maxWidth: "100%",
    maxHeight: "100%",
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: "hidden",
    position: "relative",
  },
  viewportTablet: {
    width: 768,
    height: 1024,
    maxWidth: "100%",
    maxHeight: "100%",
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: "hidden",
    position: "relative",
  },
  viewportMobile: {
    width: 375,
    height: 667,
    maxWidth: "100%",
    maxHeight: "100%",
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: "hidden",
    position: "relative",
  },
}));

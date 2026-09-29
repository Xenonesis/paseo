import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Linking, Platform, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import * as Clipboard from "expo-clipboard";
import { useToast } from "@/contexts/toast-context";
import { useBrowserStore } from "@/desktop/browser/store";
import { BrowserNavigationBar } from "./browser-navigation-bar";
import { BrowserLoadFailureOverlay } from "./browser-load-failure-overlay";

export interface BrowserPaneViewProps {
  browserId: string;
  serverId?: string;
  workspaceId?: string;
  cwd?: string | null;
  isInteractive?: boolean;
  onFocusPane?: () => void;
  testID?: string;
}

export function BrowserPaneView({
  browserId,
  testID = "browser-pane-view",
}: BrowserPaneViewProps) {
  const toast = useToast();
  const browserRecord = useBrowserStore((state) => state.browsersById[browserId]);
  const updateBrowser = useBrowserStore((state) => state.updateBrowser);

  const initialUrl = browserRecord?.url || "http://localhost:3000";
  const [currentUrl, setCurrentUrl] = useState(initialUrl);
  const [history, setHistory] = useState<string[]>([initialUrl]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [viewportPreset, setViewportPreset] = useState<"responsive" | "desktop" | "tablet" | "mobile">("responsive");
  const [isInspectActive, setIsInspectActive] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Sync with store
  useEffect(() => {
    if (browserRecord?.url && browserRecord.url !== currentUrl) {
      setCurrentUrl(browserRecord.url);
      setHasLoadError(false);
    }
  }, [browserRecord?.url]);

  // Check reachability for localhost / dev servers
  const verifyReachability = useCallback(async (targetUrl: string) => {
    setIsLoading(true);
    try {
      if (Platform.OS === "web") {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2500);
        try {
          await fetch(targetUrl, { mode: "no-cors", signal: controller.signal });
          clearTimeout(timeout);
          setHasLoadError(false);
        } catch {
          clearTimeout(timeout);
          // Only trigger load error on localhost / 127.0.0.1 connection drops
          if (targetUrl.includes("localhost") || targetUrl.includes("127.0.0.1") || targetUrl.includes("0.0.0.0")) {
            setHasLoadError(true);
          } else {
            setHasLoadError(false);
          }
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const navigateTo = useCallback(
    (newUrl: string) => {
      setCurrentUrl(newUrl);
      setHasLoadError(false);
      updateBrowser(browserId, { url: newUrl });

      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(newUrl);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);

      void verifyReachability(newUrl);
    },
    [browserId, history, historyIndex, updateBrowser, verifyReachability],
  );

  const handleGoBack = useCallback(() => {
    if (historyIndex > 0) {
      const prevUrl = history[historyIndex - 1]!;
      setHistoryIndex(historyIndex - 1);
      setCurrentUrl(prevUrl);
      setHasLoadError(false);
      updateBrowser(browserId, { url: prevUrl });
    }
  }, [browserId, history, historyIndex, updateBrowser]);

  const handleGoForward = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextUrl = history[historyIndex + 1]!;
      setHistoryIndex(historyIndex + 1);
      setCurrentUrl(nextUrl);
      setHasLoadError(false);
      updateBrowser(browserId, { url: nextUrl });
    }
  }, [browserId, history, historyIndex, updateBrowser]);

  const handleReload = useCallback(() => {
    setIsLoading(true);
    setHasLoadError(false);
    if (iframeRef.current) {
      iframeRef.current.src = currentUrl;
    }
    void verifyReachability(currentUrl);
  }, [currentUrl, verifyReachability]);

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

  const handleTryHttps = useCallback(
    (httpsUrl: string) => {
      navigateTo(httpsUrl);
    },
    [navigateTo],
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

  return (
    <View style={styles.container} testID={testID}>
      {/* Top Browser Navigation Bar */}
      <BrowserNavigationBar
        url={currentUrl}
        canGoBack={historyIndex > 0}
        canGoForward={historyIndex < history.length - 1}
        isLoading={isLoading}
        viewportPreset={viewportPreset}
        onNavigate={navigateTo}
        onGoBack={handleGoBack}
        onGoForward={handleGoForward}
        onReload={handleReload}
        onCopyAddress={handleCopyAddress}
        onOpenExternally={handleOpenExternally}
        onToggleInspect={() => setIsInspectActive((prev) => !prev)}
        isInspectActive={isInspectActive}
        onSelectViewportPreset={setViewportPreset}
      />

      {/* Main Viewport Content */}
      <View style={styles.viewportWrapper}>
        <View style={viewportStyle}>
          {Platform.OS === "web" ? (
            <iframe
              ref={iframeRef}
              src={currentUrl}
              style={{
                width: "100%",
                height: "100%",
                border: "none",
                display: hasLoadError ? "none" : "block",
              }}
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
              onLoad={() => setIsLoading(false)}
              onError={() => setHasLoadError(true)}
            />
          ) : null}

          {/* Orca-style Load Failure Overlay */}
          {hasLoadError ? (
            <BrowserLoadFailureOverlay
              currentUrl={currentUrl}
              onRetry={handleReload}
              onTryHttps={handleTryHttps}
              onCopyAddress={handleCopyAddress}
              onOpenExternally={handleOpenExternally}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}

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

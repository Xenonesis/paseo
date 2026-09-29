import React from "react";
import { Pressable, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Globe, Plus, X } from "lucide-react-native";
import { parseHostFromUrl } from "./browser-load-failure-overlay";

export interface BrowserTabItem {
  id: string;
  url: string;
  title?: string;
  isLoading?: boolean;
}

export interface BrowserTabBarProps {
  tabs: BrowserTabItem[];
  activeTabId: string;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onNewTab: () => void;
  testID?: string;
}

export function BrowserTabBar({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewTab,
  testID = "browser-tab-bar",
}: BrowserTabBarProps) {
  const { theme } = useUnistyles();

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.tabsList}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const displayLabel = tab.title?.trim() || parseHostFromUrl(tab.url) || "New Tab";

          return (
            <Pressable
              key={tab.id}
              style={[styles.tab, isActive ? styles.tabActive : styles.tabInactive]}
              onPress={() => onSelectTab(tab.id)}
              testID={`browser-tab-${tab.id}`}
            >
              <Globe
                size={13}
                color={isActive ? theme.colors.foreground : theme.colors.foregroundMuted}
                style={styles.tabIcon}
              />
              <Text
                style={[
                  styles.tabTitle,
                  isActive ? styles.tabTitleActive : styles.tabTitleInactive,
                ]}
                numberOfLines={1}
              >
                {displayLabel}
              </Text>
              {tabs.length > 1 ? (
                <Pressable
                  style={styles.closeBtn}
                  onPress={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                  testID={`browser-tab-close-${tab.id}`}
                  accessibilityLabel="Close Tab"
                >
                  <X size={12} color={theme.colors.foregroundMuted} />
                </Pressable>
              ) : null}
            </Pressable>
          );
        })}

        {/* Plus button for new tab */}
        <Pressable
          style={styles.newTabBtn}
          onPress={onNewTab}
          testID="browser-new-tab-btn"
          accessibilityLabel="New Tab"
        >
          <Plus size={14} color={theme.colors.foregroundMuted} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface0,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingHorizontal: theme.spacing[2],
    height: 34,
  },
  tabsList: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flex: 1,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    height: 28,
    maxWidth: 220,
    minWidth: 100,
    paddingHorizontal: theme.spacing[2],
    borderRadius: theme.borderRadius.sm,
    gap: 6,
    borderWidth: 1,
  },
  tabActive: {
    backgroundColor: theme.colors.surface2,
    borderColor: theme.colors.border,
  },
  tabInactive: {
    backgroundColor: "transparent",
    borderColor: "transparent",
  },
  tabIcon: {
    flexShrink: 0,
  },
  tabTitle: {
    fontSize: theme.fontSize.sm,
    flex: 1,
  },
  tabTitleActive: {
    color: theme.colors.foreground,
    fontWeight: theme.fontWeight.medium,
  },
  tabTitleInactive: {
    color: theme.colors.foregroundMuted,
  },
  closeBtn: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 2,
  },
  newTabBtn: {
    width: 26,
    height: 26,
    borderRadius: theme.borderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 2,
  },
}));

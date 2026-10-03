import React, { useState } from "react";
import { View, StyleSheet, Pressable, Platform } from "react-native";
import { Columns, Square } from "lucide-react-native";

export interface SplitLayoutContainerProps {
  primary: React.ReactNode;
  secondary: React.ReactNode;
  isSplit: boolean;
  onToggleSplit?: () => void;
  testID?: string;
}

export function SplitLayoutContainer({
  primary,
  secondary,
  isSplit,
  onToggleSplit,
  testID = "split-layout-container",
}: SplitLayoutContainerProps) {
  const [splitRatio, setSplitRatio] = useState(0.5);

  if (!isSplit) {
    return (
      <View style={styles.container} testID={testID}>
        {primary}
      </View>
    );
  }

  return (
    <View style={styles.splitContainer} testID={testID}>
      {/* Left Primary Pane */}
      <View style={[styles.pane, { flex: splitRatio }]}>{primary}</View>

      {/* Resize Divider */}
      <View style={styles.divider}>
        {onToggleSplit ? (
          <Pressable
            style={styles.toggleBtn}
            onPress={onToggleSplit}
            accessibilityLabel="Toggle Single/Split View"
          >
            <Columns size={12} color="#94a3b8" />
          </Pressable>
        ) : null}
      </View>

      {/* Right Secondary Pane (Browser / Preview) */}
      <View style={[styles.pane, { flex: 1 - splitRatio }]}>{secondary}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  splitContainer: {
    flex: 1,
    flexDirection: "row",
    width: "100%",
    height: "100%",
  },
  pane: {
    height: "100%",
    overflow: "hidden",
  },
  divider: {
    width: 6,
    backgroundColor: "#1e293b",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "#334155",
    justifyContent: "center",
    alignItems: "center",
    cursor: "col-resize" as unknown as undefined,
  },
  toggleBtn: {
    padding: 2,
    backgroundColor: "#0f172a",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#334155",
  },
});

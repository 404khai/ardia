import { useEffect, useRef } from "react";
import { View } from "react-native";
import { create } from "zustand";
import { useBrowser } from "../../store/browser";
import { useWindowUi } from "../../store/hooks";
import { useSidebarWidth } from "../sidebar/tokens";
import { IconButton } from "../primitives";
import { useAddressBarInSidebar, useTabLayout } from "./windowLayout";

type Anchor = { x: number; y: number; width: number; height: number };

export const useDownloadsAnchors = create<Record<string, Anchor>>()(() => ({}));

export function DownloadsButton({ windowId, visible = true }: { windowId: string; visible?: boolean }) {
  const view = useRef<View>(null);
  const open = useWindowUi().downloadsOpen;
  const width = useSidebarWidth(windowId);
  const layout = useTabLayout();
  const footer = useAddressBarInSidebar();
  const frame = useBrowser((s) => s.windows[windowId]?.frame);
  const measure = (done?: () => void) => view.current?.measureInWindow((x, y, width, height) => {
    if (visible && width && height && x >= 0 && y >= 0) useDownloadsAnchors.setState({ [windowId]: { x, y, width, height } });
    done?.();
  });
  useEffect(() => {
    measure();
  }, [open, width, layout, footer, frame, visible]);
  return (
    <View ref={view} collapsable={false} onLayout={() => measure()} mouseDownCanMoveWindow={false}>
      <IconButton
        icon="arrow.down.circle"
        size={16}
        box={34}
        radius={10}
        tooltip={open ? undefined : "Downloads (⇧⌘J)"}
        style={open ? { borderRadius: 10, backgroundColor: "rgba(128,128,128,0.18)" } : undefined}
        onPress={() => measure(() => {
          const s = useBrowser.getState();
          s.setDownloadsOpen(windowId, !s.windowUi[windowId]?.downloadsOpen);
        })}
      />
    </View>
  );
}

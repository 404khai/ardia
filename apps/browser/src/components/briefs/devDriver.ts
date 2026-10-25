import type { ScrollView } from "react-native";

const views = new Map<string, ScrollView>();
export function registerBriefView(windowId: string, view: ScrollView | null) {
  if (view) views.set(windowId, view);
  else views.delete(windowId);
}
export function scrollBrief(windowId: string, y: number) {
  const view = views.get(windowId);
  if (!view) return false;
  view.scrollTo({ y, animated: false });
  return true;
}

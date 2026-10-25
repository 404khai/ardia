import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { useBrowser } from "../../store/browser";
import { bookmarkProfileId } from "../../store/model";
import { setPageProgress } from "../../store/pageProgress";
import { generateBrief, loadDailyBrief, useDailyBriefs } from "../../lib/dailyBriefs";
import { DailyBriefPage } from "../briefs/DailyBriefPage";
import { briefTitleForDate } from "../briefs/assets";
import { briefDateFromUrl, localBriefDate } from "../../lib/briefDates";
import { openSettings } from "../settings/windows";
import { BookmarksPage } from "./BookmarksPage";
import { DownloadsPage } from "./DownloadsPage";
import { HistoryPage } from "./HistoryPage";
import { INTERNAL_PAGES, internalPageOf, internalQuery, tabDestination } from "./urls";

export function InternalPage({ tabId }: { tabId: string }) {
  const url = useBrowser((s) => {
    const t = s.tabs[tabId];
    return t ? tabDestination(t) : "";
  });
  const page = internalPageOf(url);
  const date = briefDateFromUrl(url);
  const profileId = useBrowser((s) => s.tabs[tabId]?.profileId ?? "");
  const bookmarkProfile = useBrowser((s) => bookmarkProfileId(s, s.windows[s.tabs[tabId]?.windowId ?? ""]));

  const brief = useDailyBriefs((s) => s.entries[`${profileId}/${date}`]);
  useEffect(() => {
    if (page === "brief") loadDailyBrief(profileId, date);
  }, [page, profileId, date]);

  useEffect(() => {
    if (!page) return;
    const t = useBrowser.getState().tabs[tabId];
    const title = page === "brief" ? briefTitleForDate(briefDateFromUrl(url)) : INTERNAL_PAGES[page].title;
    if (t && (t.url !== url || t.title !== title)) useBrowser.getState().updateTab(tabId, { url, title, favicon: null });
    useBrowser.getState().updateLive(tabId, { isLoading: false, canGoBack: false, canGoForward: false });
    setPageProgress(tabId, 0);
  }, [page, url]);

  if (!page) return null;
  return (
    <View style={StyleSheet.absoluteFill}>
      {page === "brief" && <DailyBriefPage key={url} date={date} content={brief?.content} loading={brief?.loading} error={brief?.error} onGenerate={date === localBriefDate() ? () => void generateBrief(profileId, date) : undefined} onConfigure={() => openSettings("dailyBriefs")} />}
      {page === "history" && <HistoryPage tabId={tabId} profileId={profileId} initialQuery={internalQuery(url)} />}
      {page === "bookmarks" && <BookmarksPage key={bookmarkProfile} tabId={tabId} profileId={bookmarkProfile} />}
      {page === "downloads" && <DownloadsPage tabId={tabId} />}
    </View>
  );
}

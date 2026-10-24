import { Symbol } from "@ardia/shell";
import { useMemo, useState } from "react";
import { Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { briefArtworkForDate, briefTitleForDate } from "../briefs/assets";
import { GlassFill } from "../glass";
import { localBriefDate, parseBriefDate } from "../../lib/briefDates";
import { listDailyBriefDates, openDailyBrief } from "../../lib/dailyBriefs";
import { useTheme } from "../../lib/theme";
import { useBrowser } from "../../store/browser";
import { setSidebarUi, useSidebarUi } from "./state";

export function DailyBriefArchive({ windowId, windowWidth, windowHeight }: { windowId: string; windowWidth: number; windowHeight: number }) {
  const open = useSidebarUi((s) => s.briefArchive === windowId);
  return open ? <ArchivePanel windowId={windowId} windowWidth={windowWidth} windowHeight={windowHeight} /> : null;
}

function ArchivePanel({ windowId, windowWidth, windowHeight }: { windowId: string; windowWidth: number; windowHeight: number }) {
  const theme = useTheme();
  const [query, setQuery] = useState("");
  const profileId = useBrowser((s) => s.windows[windowId]?.profileId ?? "");
  const today = localBriefDate();
  const dates = useMemo(() => [today, ...listDailyBriefDates(profileId).filter((date) => date !== today)], [profileId, today]);
  const shown = dates.filter((date) => briefTitleForDate(date).toLowerCase().includes(query.trim().toLowerCase()));
  const close = () => setSidebarUi({ briefArchive: null });
  const choose = (date: string) => {
    close();
    openDailyBrief(windowId, date);
  };
  const width = Math.min(350, windowWidth - 24);
  const height = Math.min(500, Math.max(180, 78 + dates.length * 88), windowHeight - 24);
  const left = Math.max(12, Math.min(48, windowWidth - width - 12));
  return <>
    <Pressable onPress={close} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
    <View style={{ position: "absolute", left, bottom: 12, width, height, borderRadius: 24, overflow: "hidden", borderWidth: 1, borderColor: theme.dark ? "rgba(255,255,255,0.24)" : "rgba(0,0,0,0.18)", backgroundColor: theme.dark ? "rgba(38,38,38,0.82)" : "rgba(245,245,245,0.8)" }}>
      <GlassFill radius={24} fill={theme.dark ? "rgba(38,38,38,0.82)" : "rgba(245,245,245,0.8)"} />
      <View style={{ height: 54, flexDirection: "row", alignItems: "center", paddingHorizontal: 18, gap: 11, borderBottomWidth: 1, borderBottomColor: theme.dark ? "rgba(255,255,255,0.13)" : "rgba(0,0,0,0.1)" }}>
        <Symbol name="magnifyingglass" size={16} color={theme.textSecondary} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Search briefs" placeholderTextColor={theme.textSecondary} selectionColor={theme.selection} enableFocusRing={false} style={{ flex: 1, color: theme.textPrimary, fontSize: 16 }} />
        <Pressable accessibilityRole="button" accessibilityLabel="Close brief archive" onPress={close}><Symbol name="xmark" size={16} color={theme.textSecondary} /></Pressable>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 13, paddingTop: 10, paddingBottom: 14 }}>
        {shown.length ? shown.map((date) => <ArchiveRow key={date} date={date} onPress={() => choose(date)} />) : <View style={{ alignItems: "center", paddingVertical: 65, gap: 14 }}><Symbol name="doc.text" size={27} color={theme.textSecondary} /><Text style={{ color: theme.textSecondary, fontSize: 14 }}>{dates.length ? "No matching briefs" : "No briefs yet"}</Text>{!dates.length && <Pressable onPress={() => choose(localBriefDate())}><Text style={{ color: theme.textPrimary, fontSize: 14, fontWeight: "600" }}>Open today’s brief →</Text></Pressable>}</View>}
      </ScrollView>
    </View>
  </>;
}

function ArchiveRow({ date, onPress }: { date: string; onPress(): void }) {
  const theme = useTheme();
  const day = parseBriefDate(date)!;
  const today = localBriefDate();
  const label = date === today ? "Today" : day.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  return <Pressable accessibilityRole="button" accessibilityLabel={briefTitleForDate(date)} onPress={onPress} style={({ pressed }) => ({ minHeight: 88, borderRadius: 11, paddingHorizontal: 11, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 16, backgroundColor: pressed ? theme.tabHover : "transparent" })}>
    <View style={{ width: 55, height: 64, borderRadius: 5, overflow: "hidden", backgroundColor: "#101010" }}><Image source={briefArtworkForDate(date).source} style={{ width: 55, height: 43 }} resizeMode="cover" /><Text numberOfLines={1} style={{ color: "#ffe500", fontFamily: "Georgia", fontWeight: "700", fontSize: 5, textAlign: "center", marginTop: 4 }}>{briefTitleForDate(date)}</Text></View>
    <View style={{ flex: 1, minWidth: 0, gap: 4 }}><Text numberOfLines={1} style={{ color: theme.textPrimary, fontSize: 15, fontWeight: "600" }}>{briefTitleForDate(date)}</Text><Text numberOfLines={1} style={{ color: theme.textSecondary, fontSize: 12 }}>{label}</Text></View>
  </Pressable>;
}

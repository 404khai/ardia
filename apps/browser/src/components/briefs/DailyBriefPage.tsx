import { useState } from "react";
import { BriefRail } from "@ardia/shell";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { briefArtworkForDate, briefDate } from "./assets";
import { localBriefDate } from "../../lib/briefDates";

export type BriefContent = {
  summary: string;
  focus: { title: string; body: string };
  todos: Array<{ title: string; body: string }>;
  updates: Array<{ title: string; body: string }>;
  events: Array<{ title: string; body: string; time: string }>;
};

type Props = { date?: string; onConfigure?: () => void; content?: BriefContent | null; loading?: boolean; error?: string | null; onGenerate?: () => void };

function Starburst({ title, onPress, small = false }: { title: string; onPress: () => void; small?: boolean }) {
  const size = small ? 84 : 96;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title.replace("\n", " ")} onPress={onPress} style={({ pressed }) => ({ width: size, height: size, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 })}>
      {[0, 22.5, 45, 67.5].map((rotation) => <View key={rotation} pointerEvents="none" style={{ position: "absolute", width: size * 0.76, height: size * 0.76, backgroundColor: "#ffe500", transform: [{ rotate: `${rotation}deg` }] }} />)}
      <Text style={{ color: "#101010", fontFamily: "Georgia", fontStyle: "italic", fontSize: small ? 15 : 21, textAlign: "center", lineHeight: small ? 20 : 26, transform: [{ rotate: "-9deg" }] }}>{title}</Text>
    </Pressable>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function DailyBriefPage({ date, onConfigure, content: generatedContent, loading = false, error, onGenerate }: Props) {
  const [width, setWidth] = useState(1100);
  const [preview, setPreview] = useState(false);
  const [previewWeekday, setPreviewWeekday] = useState<number | null>(null);
  const content = preview ? null : generatedContent;
  const [done, setDone] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [prep, setPrep] = useState(false);
  const day = briefDate(date);
  if (preview && previewWeekday !== null) day.setDate(day.getDate() - day.getDay() + previewWeekday);
  const artwork = briefArtworkForDate(localBriefDate(day));
  const wide = width >= 720;
  const rails = width >= 380;
  const railGutter = Math.max(50, Math.min(100, width * 0.13));
  const contentWidth = Math.min(1040, width - (rails ? railGutter * 2 : wide ? 80 : 40));
  const heroHeight = contentWidth * 0.507;
  const gutter = (width - contentWidth) / 2;
  const railWidth = Math.min(65, gutter - 12);
  const railInset = (gutter - railWidth) / 2;
  const railFontSize = Math.min(45, heroHeight / 10.8);
  const weekday = day.toLocaleDateString("en-US", { weekday: "long" });
  const dateLabel = `${day.getDate()} ${day.toLocaleDateString("en-US", { month: "short" }).toUpperCase()} ${day.getFullYear()}`;
  const titleSize = contentWidth / (weekday.length > 8 ? 8.75 : weekday.length > 6 ? 8 : 7);
  const configure = () => onConfigure?.();

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll} onLayout={(event) => setWidth(event.nativeEvent.layout.width)} testID="daily-brief-page">
      <View style={{ width, alignSelf: "center" }}>
        <View style={[styles.masthead, { width: contentWidth, alignSelf: "center" }]}>
          <Image source={require("../../../assets/briefs/ardia-mark.png")} style={styles.mastheadLogo} resizeMode="contain" accessibilityLabel="Ardia" />
          <Pressable accessibilityRole="button" onPress={() => setPreview(!preview)} style={styles.previewButton}>
            <Text style={styles.previewLabel}>{preview ? "Sample brief · Exit preview" : "Preview design"}</Text>
          </Pressable>
        </View>
        {preview && <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 5, marginBottom: 14 }}>
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label, index) => <Pressable key={label} accessibilityRole="button" accessibilityLabel={`Preview ${label}`} accessibilityState={{ selected: day.getDay() === index }} onPress={() => setPreviewWeekday(index)} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: day.getDay() === index ? "#ffe500" : "#232321" }}><Text style={{ fontSize: 12, color: day.getDay() === index ? "#101010" : "#cccac4" }}>{label}</Text></Pressable>)}
        </View>}
        <View style={{ width, height: heroHeight, justifyContent: "center", alignItems: "center" }}>
          <Image source={artwork.source} style={{ position: "absolute", top: 0, left: gutter, width: contentWidth, height: heroHeight }} resizeMode="cover" accessibilityLabel={`${artwork.title} by ${artwork.artist}`} />
          <View pointerEvents="none" style={{ position: "absolute", top: 0, left: gutter, width: contentWidth, height: heroHeight, backgroundColor: "rgba(0,0,0,0.09)" }} />
          <Text style={[styles.heroThe, { fontSize: contentWidth / 18, lineHeight: contentWidth / 15 }]}>The</Text>
          <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.heroTitle, { fontSize: titleSize, lineHeight: titleSize * 1.2, width: contentWidth * 0.98 }]}>{weekday} Brief</Text>
          {rails && <>
            <BriefRail text={dateLabel} fontSize={railFontSize} style={{ position: "absolute", top: 0, left: railInset, width: railWidth, height: heroHeight }} />
            <BriefRail text={preview ? "09:52 AM" : "A fresh perspective"} clockwise fontSize={railFontSize} style={{ position: "absolute", top: 0, right: railInset, width: railWidth, height: heroHeight }} />
          </>}
        </View>
        <View style={{ width: contentWidth, alignSelf: "center" }}>
        <View style={[styles.captionRow, !wide && { flexDirection: "column", gap: 8 }]}>
          <Text style={styles.caption}>{content?.summary ?? (preview ? "Nothing until a quick 15-minute call at noon. The morning is all yours." : "A little perspective. A clearer day. A brief made for you.")}</Text>
          <Text style={styles.artCredit}>{artwork.title}, {artwork.artist}, {artwork.year}</Text>
        </View>
        {onGenerate && !preview && <View style={styles.generateRow}><Pressable accessibilityRole="button" disabled={loading} onPress={onGenerate} style={({ pressed }) => [styles.generateButton, { opacity: loading || pressed ? 0.5 : 1 }]}><Text style={styles.setupButtonText}>{loading ? "Preparing your brief…" : content ? "Refresh brief →" : "Generate brief →"}</Text></Pressable></View>}
        {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        <View style={[styles.feature, { flexDirection: wide ? "row" : "column" }]}>
          <View style={wide ? styles.leftColumn : { marginBottom: 22 }}>
            <SectionTitle>Push your work forward</SectionTitle>
            <View style={{ marginTop: 53, marginBottom: -43, marginLeft: -7 }}>
              <Starburst title={content || preview ? "Let's\ndo it →" : "Make it\nyours →"} onPress={content || preview ? () => setExpanded(!expanded) : configure} />
            </View>
          </View>
          <View style={styles.rightColumn}>
            <Text style={styles.itemTitle}>{content?.focus.title ?? (preview ? "Prepare for the iPad support review" : "Your day, brought together")}</Text>
            <Text style={styles.body}>{content?.focus.body ?? (preview ? "CodeRabbit is processing your 20-file iPad PR right now. In its last two monocode reviews, it flagged the Android SegmentedSwitch progress prop handling. Your iPad PR adds five new workspace sizing and layout components with a similar pattern. I can help you pre-address those files or draft fixes once the review lands." : "Choose a provider and connect the sources you want to include. Your brief will bring together the work that needs your attention, the updates worth knowing, and the shape of your day.")}</Text>
            {expanded && preview && <Text style={styles.actionDetail}>Review preparation: check workspace sizing, layout behavior, and the progress prop before responding to review comments.</Text>}
            {expanded && content && <Text style={styles.actionDetail}>Start with the next action in your brief, then check the original source for context.</Text>}
            {!preview && !content && <Pressable accessibilityRole="button" onPress={configure} style={styles.setupButton}><Text style={styles.setupButtonText}>Set up daily briefs →</Text></Pressable>}
          </View>
        </View>
        <View style={[styles.section, { flexDirection: wide ? "row" : "column" }]}>
          <View style={wide ? styles.leftColumn : styles.stackedTitle}><SectionTitle>Top to-dos</SectionTitle></View>
          <View style={styles.rightColumn}>
            {content ? <TodoItems items={content.todos} /> : preview ? <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: done }} onPress={() => setDone(!done)} style={styles.todo}>
              <View style={[styles.checkbox, !wide && { position: "relative", left: 0, marginRight: 14 }, done && { backgroundColor: "#ffe500", borderColor: "#ffe500" }]}>{done && <Text style={styles.checkmark}>✓</Text>}</View>
              <View style={{ flex: 1 }}><Text style={[styles.itemTitle, done && { textDecorationLine: "line-through", color: "#77756e" }]}>Fix CI failures on mobile-file-tagging branch</Text><Text style={styles.body}>Two CI workflow runs failed today on your feat/mobile-file-tagging branch. Check the run logs for failure details so you can unblock the feature.</Text></View>
            </Pressable> : <><Text style={styles.itemTitle}>Room for what matters</Text><Text style={styles.body}>Action items from your connected sources will appear here. Nothing is read until you give permission.</Text></>}
          </View>
        </View>
        <View style={[styles.section, { flexDirection: wide ? "row" : "column", marginTop: 62 }]}>
          <View style={wide ? styles.leftColumn : styles.stackedTitle}><SectionTitle>New updates</SectionTitle>{preview && !content && <Text style={styles.number}>01</Text>}</View>
          <View style={styles.rightColumn}>{content ? content.updates.length ? content.updates.map((item, i) => <View key={i} style={{ marginBottom: 28 }}><Text style={styles.itemTitle}>{item.title}</Text><Text style={styles.body}>{item.body}</Text></View>) : <Text style={styles.body}>Nothing new needs your attention.</Text> : <><Text style={styles.itemTitle}>{preview ? "Maintainer took over your PDF links security fix" : "Less catching up. More getting going."}{preview && <Text style={styles.project}>  T3 Code</Text>}</Text><Text style={styles.body}>{preview ? "juliusmarminge self-assigned PR #18239 and is finishing the implementation against current main. Your contribution is being shipped." : "The important updates from Gmail and GitHub will be gathered into one calm place."}</Text></>}</View>
        </View>
        {preview && !content && <View style={[styles.section, { flexDirection: wide ? "row" : "column", marginTop: 35 }]}><View style={wide ? styles.leftColumn : styles.stackedTitle}><Text style={[styles.number, { marginTop: 0 }]}>02</Text></View><View style={styles.rightColumn}><Text style={styles.itemTitle}>Three PRs merged in two days<Text style={styles.project}>  Monocode</Text></Text><Text style={styles.body}>hardbeat920 merged sidebar swipe navigation, Android header pill fix, and Android composer repair. Commented ‘this is great! thank you.’</Text></View></View>}
        <View style={[styles.section, { flexDirection: wide ? "row" : "column", marginTop: 65, minHeight: 240 }]}>
          <View style={wide ? styles.leftColumn : styles.stackedTitle}><SectionTitle>Your day</SectionTitle>{content ? content.events.map((event, i) => <View key={i} style={styles.calendarEvent}><Text style={styles.eventTime}>{event.time}</Text><Text style={[styles.eventName, { flex: 1 }]}>{event.title}</Text></View>) : preview && <View style={styles.calendarEvent}><Text style={styles.eventTime}>12:15p</Text><Text style={styles.eventName}>Bachs Intro</Text></View>}</View>
          <View style={styles.rightColumn}>{content ? content.events.length ? content.events.map((event, i) => <View key={i} style={{ marginTop: i === 0 && wide ? 48 : 24 }}><Text style={styles.itemTitle}>{event.title} — {event.time}</Text><Text style={styles.body}>{event.body}</Text></View>) : <Text style={[styles.body, { marginTop: wide ? 48 : 0 }]}>No events to prepare for.</Text> : <><Text style={[styles.itemTitle, { marginTop: wide ? 48 : 0 }]}>{preview ? "Bachs Intro — 12:15 PM – 12:30 PM" : "Make space for your day"}</Text><Text style={styles.body}>{preview ? "15-minute introductory call via Google Meet." : "Connect your calendar to see your schedule and prepare for what’s next."}</Text>{preview && <View style={{ alignItems: "flex-end", marginTop: 28 }}><Starburst title="Prep me →" small onPress={() => setPrep(!prep)} /></View>}{prep && preview && <Text style={styles.actionDetail}>Before the call: review the invitation, write down your goals, and leave a few minutes to join.</Text>}</>}</View>
        </View>
        <View style={styles.footer}><View style={styles.footerBrand}><Text style={styles.footerText}>Made for you by </Text><Image source={require("../../../assets/briefs/ardia-mark.png")} style={styles.footerLogo} resizeMode="contain" accessibilityLabel="Ardia" /><Text style={styles.footerText}>Ardia using your </Text><View style={styles.footerService}><Image source={require("../../../assets/site-icons/github.png")} style={[styles.footerServiceIcon, { tintColor: "#eeeeeb" }]} resizeMode="contain" /><Text style={styles.footerText}>GitHub, </Text></View><View style={styles.footerService}><Image source={require("../../../assets/site-icons/gmail.png")} style={styles.footerServiceIcon} resizeMode="contain" /><Text style={styles.footerText}>Gmail, </Text></View><Text style={styles.footerText}>and </Text><View style={styles.footerService}><Image source={require("../../../assets/site-icons/calendar.png")} style={styles.footerServiceIcon} resizeMode="contain" /><Text style={styles.footerText}>Google Calendar.</Text></View></View><Text style={styles.footerSmall}>{preview && !content ? "Preview content · No accounts connected" : "Your sources, with your permission."}</Text></View>
        </View>
      </View>
    </ScrollView>
  );
}

function TodoItems({ items }: { items: BriefContent["todos"] }) {
  const [completed, setCompleted] = useState<Set<number>>(() => new Set());
  if (!items.length) return <Text style={styles.body}>Nothing urgent. Make room for your own priorities.</Text>;
  return <>{items.map((item, i) => <Pressable key={i} accessibilityRole="checkbox" accessibilityState={{ checked: completed.has(i) }} onPress={() => setCompleted((previous) => { const next = new Set(previous); if (next.has(i)) next.delete(i); else next.add(i); return next; })} style={{ flexDirection: "row", gap: 14, marginBottom: 22 }}><View style={{ width: 17, height: 17, borderRadius: 9, borderWidth: 1, borderColor: completed.has(i) ? "#ffe500" : "#53534f", backgroundColor: completed.has(i) ? "#ffe500" : "transparent", marginTop: 3, justifyContent: "center", alignItems: "center" }}>{completed.has(i) && <Text style={styles.checkmark}>✓</Text>}</View><View style={{ flex: 1 }}><Text style={[styles.itemTitle, completed.has(i) && { textDecorationLine: "line-through", color: "#77756e" }]}>{item.title}</Text><Text style={styles.body}>{item.body}</Text></View></Pressable>)}</>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#101010" },
  scroll: { paddingTop: 20, paddingBottom: 50 },
  masthead: { height: 37, alignItems: "center", justifyContent: "flex-start" },
  mastheadLogo: { width: 26, height: 26 },
  previewButton: { position: "absolute", right: 0, top: 1, paddingVertical: 5, paddingHorizontal: 8 },
  previewLabel: { color: "#77756e", fontSize: 11 },
  heroThe: { color: "#ffe500", fontFamily: "Georgia", fontStyle: "italic", fontWeight: "700", marginBottom: -4, transform: [{ translateY: 7 }] },
  heroTitle: { color: "#ffe500", fontFamily: "Georgia", fontWeight: "700", textAlign: "center", letterSpacing: -4 },
  captionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 10, gap: 20 },
  caption: { color: "#959187", fontFamily: "Georgia", fontStyle: "italic", fontSize: 13, flexShrink: 1 },
  artCredit: { color: "#4f4d48", fontFamily: "Menlo", fontSize: 8, textAlign: "right", flexShrink: 1 },
  feature: { backgroundColor: "#1f1f1e", borderRadius: 11, paddingHorizontal: 28, paddingTop: 30, paddingBottom: 36, marginTop: 43, minHeight: 224 },
  leftColumn: { width: "42%", paddingRight: 28 },
  rightColumn: { flex: 1 },
  sectionTitle: { color: "#cccac4", fontFamily: "Georgia", fontStyle: "italic", fontSize: 23, lineHeight: 31 },
  itemTitle: { color: "#e5e5e1", fontSize: 16, fontWeight: "600", lineHeight: 24 },
  body: { color: "#969187", fontSize: 15, lineHeight: 28, marginTop: 7 },
  section: { marginHorizontal: 22, marginTop: 64 },
  stackedTitle: { marginBottom: 20 },
  todo: { flexDirection: "row" },
  checkbox: { width: 17, height: 17, borderRadius: 9, borderColor: "#53534f", borderWidth: 1, position: "absolute", left: -65, top: 3, justifyContent: "center", alignItems: "center" },
  checkmark: { fontSize: 12, color: "#101010" },
  number: { color: "#4a4843", fontFamily: "Georgia", fontSize: 13, marginTop: 24 },
  project: { color: "#757168", fontFamily: "Georgia", fontStyle: "italic", fontWeight: "400", fontSize: 14 },
  calendarEvent: { marginTop: 20, marginLeft: -7, marginRight: -14, backgroundColor: "#20201e", borderRadius: 5, paddingHorizontal: 9, paddingVertical: 10, flexDirection: "row", gap: 18 },
  eventTime: { fontFamily: "Menlo", fontSize: 12, color: "#777166" },
  eventName: { color: "#e5e5e1", fontSize: 15, fontWeight: "600" },
  footer: { marginTop: 70, alignItems: "center", gap: 20, paddingHorizontal: 10 },
  footerBrand: { flexDirection: "row", alignItems: "center", justifyContent: "center", flexWrap: "wrap" },
  footerLogo: { width: 24, height: 24, marginHorizontal: 5 },
  footerService: { flexDirection: "row", alignItems: "center" },
  footerServiceIcon: { width: 18, height: 18, marginRight: 5 },
  footerText: { color: "#8d8a82", fontFamily: "Georgia", fontSize: 20, textAlign: "center", lineHeight: 30 },
  footerSmall: { color: "#65625b", fontFamily: "Georgia", fontSize: 13 },
  setupButton: { alignSelf: "flex-start", marginTop: 20, borderBottomWidth: 1, borderBottomColor: "#ffe500", paddingBottom: 3 },
  setupButtonText: { color: "#ffe500", fontSize: 14 },
  actionDetail: { color: "#d0c9b5", fontSize: 14, lineHeight: 24, marginTop: 18 },
  generateRow: { alignItems: "flex-end", marginTop: 18, marginBottom: -22 },
  generateButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, borderWidth: 1, borderColor: "#484530" },
  error: { color: "#e6a296", fontSize: 13, lineHeight: 21, marginTop: 30 },
});

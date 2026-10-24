import { readDocument, writeDocument } from "@ardia/shell";
import { create } from "zustand";
import { useBrowser } from "../store/browser";
import { isIncognitoProfile } from "../store/model";
import { briefDateFromUrl, briefDue, localBriefDate } from "./briefDates";
import { retainedBriefDates } from "./briefRetention";

import { parseBriefContent, type BriefContent } from "./briefContent";
export type { BriefContent } from "./briefContent";
type Entry = { content?: BriefContent; loading?: boolean; error?: string | null };
export const useDailyBriefs = create<{ entries: Record<string, Entry> }>(() => ({ entries: {} }));
const keyFor = (profileId: string, date: string) => `${profileId}/${date}`;
const pending = new Set<string>();
type SavedBriefs = Record<string, BriefContent | null>;

function readSavedBriefs(): SavedBriefs {
  try {
    const raw = readDocument("daily-briefs.json");
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as SavedBriefs : {};
  } catch {
    return {};
  }
}

function pruneSavedBriefs(saved: SavedBriefs): SavedBriefs {
  const dates = retainedBriefDates(Object.keys(saved).map((key) => key.slice(-10)));
  const keep = new Set(dates);
  return Object.fromEntries(Object.entries(saved).filter(([key]) => keep.has(key.slice(-10))));
}

function updateSavedBriefs(key?: string, content: BriefContent | null = null): SavedBriefs {
  const original = readSavedBriefs();
  const saved = pruneSavedBriefs(key ? { ...original, [key]: content ?? original[key] ?? null } : original);
  if (JSON.stringify(saved) !== JSON.stringify(original)) writeDocument("daily-briefs.json", JSON.stringify(saved));
  return saved;
}

export function listDailyBriefDates(profileId: string): string[] {
  if (isIncognitoProfile(profileId)) return [];
  return retainedBriefDates(Object.keys(updateSavedBriefs()).filter((key) => key.startsWith(`${profileId}/`)).map((key) => key.slice(-10)));
}

function patch(key: string, entry: Entry) {
  useDailyBriefs.setState((s) => ({ entries: { ...s.entries, [key]: { ...s.entries[key], ...entry } } }));
}

export function loadDailyBrief(profileId: string, date: string) {
  const key = keyFor(profileId, date);
  if (isIncognitoProfile(profileId) || useDailyBriefs.getState().entries[key]) return;
  try {
    const saved = updateSavedBriefs();
    if (saved[key]) patch(key, { content: parseBriefContent(JSON.stringify(saved[key])) });
  } catch {
    patch(key, { error: "This saved brief could not be read. You can generate it again." });
  }
}

function saveBrief(key: string, content: BriefContent) {
  updateSavedBriefs(key, content);
}

export async function generateBrief(profileId: string, date: string) {
  if (isIncognitoProfile(profileId)) return;
  const key = keyFor(profileId, date);
  if (pending.has(key)) return;
  pending.add(key);
  patch(key, { loading: true, error: null });
  const abort = new AbortController();
  const original = useBrowser.getState().settings;
  const consent = JSON.stringify(original.dailyBriefSources);
  const provider = original.dailyBriefProvider;
  const unsubscribe = useBrowser.subscribe((state) => {
    if (state.settings.dailyBriefProvider === provider && JSON.stringify(state.settings.dailyBriefSources) === consent) return;
    abort.abort();
    if (provider === "chatgpt") void import("@ardia/shell").then((shell) => shell.cancelDailyBriefGeneration()).catch(() => {});
  });
  try {
    if (date !== localBriefDate()) throw new Error("Past briefs are kept as they were. Generate today’s brief to use your current sources.");
    const { generateDailyBrief } = await import("@ardia/shell");
    const { collectBriefContext, generateClaudeBrief } = await import("../components/settings/briefContext");
    const context = await collectBriefContext(date);
    if (abort.signal.aborted || provider !== useBrowser.getState().settings.dailyBriefProvider || consent !== JSON.stringify(useBrowser.getState().settings.dailyBriefSources)) throw new Error("Your sharing preferences changed. Try again.");
    const input = JSON.stringify({ ...context, date });
    const raw = provider === "claude" ? await generateClaudeBrief(input, abort.signal) : await generateDailyBrief(input);
    if (abort.signal.aborted || provider !== useBrowser.getState().settings.dailyBriefProvider || consent !== JSON.stringify(useBrowser.getState().settings.dailyBriefSources)) throw new Error("Your sharing preferences changed. Generate a fresh brief with the new settings.");
    const content = parseBriefContent(raw);
    saveBrief(key, content);
    patch(key, { content, loading: false });
  } catch (error) {
    patch(key, { loading: false, error: error instanceof Error ? error.message : "Could not generate your brief. Try again." });
  } finally {
    unsubscribe();
    pending.delete(key);
  }
}

export function openDailyBrief(windowId: string, date = localBriefDate(), background = false): string | null {
  const s = useBrowser.getState();
  const window = s.windows[windowId];
  if (!window || window.incognito || window.kind === "small" || isIncognitoProfile(window.profileId)) return null;
  updateSavedBriefs(keyFor(window.profileId, date));
  const existing = window.tabIds.find((id) => {
    const tab = s.tabs[id];
    return tab?.profileId === window.profileId && /^ardia:\/\/brief(?:\/|$)/i.test(tab.navigation?.url ?? tab.url) && briefDateFromUrl(tab.navigation?.url ?? tab.url) === date;
  });
  if (existing) {
    if (!background) s.activate(existing);
    return existing;
  }
  const id = s.newTab(windowId, { url: `ardia://brief/${date}`, background });
  return typeof id === "string" ? id : null;
}

export function startDailyBriefs() {
  const tick = () => {
    const s = useBrowser.getState();
    if (!briefDue(s.settings)) return;
    const windowId = [s.ui.focusedWindowId, ...s.windowOrder].find((id) => {
      const w = id ? s.windows[id] : null;
      return w && !w.incognito && w.kind !== "small" && !isIncognitoProfile(w.profileId);
    });
    if (!windowId) return;
    const date = localBriefDate();
    s.updateSettings({ dailyBriefLastOpened: date });
    openDailyBrief(windowId, date, true);
    const profileId = s.windows[windowId]!.profileId;
    loadDailyBrief(profileId, date);
    if (!useDailyBriefs.getState().entries[keyFor(profileId, date)]?.content) void generateBrief(profileId, date);
  };
  const timer = setInterval(tick, 30_000);
  const initial = setTimeout(tick, 1000);
  return () => { clearInterval(timer); clearTimeout(initial); };
}

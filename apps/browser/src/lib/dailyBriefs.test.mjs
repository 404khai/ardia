import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

globalThis.__DEV__ = false;
const stub = new URL("../test-native-stub.mjs", import.meta.url).href;
registerHooks({
  resolve(specifier, context, next) {
    if (!context.parentURL?.endsWith("/lib/dailyBriefs.ts")) return next(specifier, context);
    const source = specifier === "@ardia/shell" ? `export * from ${JSON.stringify(stub)}; export const generateDailyBrief = (...args) => globalThis.briefGenerate(...args); export const cancelDailyBriefGeneration = async () => {};`
      : specifier.endsWith("/briefContext") ? "export const collectBriefContext = () => globalThis.briefCollect(); export const generateClaudeBrief = (...args) => globalThis.briefGenerate(...args);" : null;
    return source ? { url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true } : next(specifier, context);
  },
});
const { useBrowser } = await import("../store/browser.ts");
const { docs } = await import("../test-native-stub.mjs");
const { generateBrief, openDailyBrief, useDailyBriefs } = await import("./dailyBriefs.ts");
const { localBriefDate } = await import("./briefDates.ts");
const content = { summary: "Today", focus: { title: "Review", body: "Read your PR" }, todos: [], updates: [], events: [] };
const setup = () => {
  docs.clear();
  useBrowser.getState().hydrate({});
  useDailyBriefs.setState({ entries: {} });
  globalThis.briefCollect = async () => ({ github: [], calendar: [] });
  globalThis.briefGenerate = async () => JSON.stringify(content);
};

test("dated briefs deduplicate within a profile and background delivery preserves the active tab", () => {
  setup();
  const s = useBrowser.getState;
  const w = s().createWindow({ url: "https://example.com" });
  const active = s().windows[w].activeTabIds.default;
  const today = localBriefDate();
  const id = openDailyBrief(w, today, true);
  assert.ok(id);
  assert.equal(s().windows[w].activeTabIds.default, active);
  assert.equal(openDailyBrief(w, today, true), id);
  const previous = openDailyBrief(w, "2026-10-01", true);
  assert.notEqual(previous, id);
  const privateWindow = s().createWindow({ incognito: true });
  assert.equal(openDailyBrief(privateWindow, today), null);
});

test("revoking source consent while collecting prevents provider submission", async () => {
  setup();
  const s = useBrowser.getState;
  s().updateSettings({ dailyBriefSources: { gmail: false, github: true, calendar: false } });
  let release;
  globalThis.briefCollect = () => new Promise((resolve) => { release = resolve; });
  let sent = false;
  globalThis.briefGenerate = async () => { sent = true; return JSON.stringify(content); };
  const run = generateBrief("default", localBriefDate());
  await new Promise((resolve) => setImmediate(resolve));
  s().updateSettings({ dailyBriefSources: { gmail: false, github: false, calendar: false } });
  release({ github: [{ title: "Private PR" }] });
  await run;
  assert.equal(sent, false);
  assert.match(useDailyBriefs.getState().entries[`default/${localBriefDate()}`].error, /preferences changed/);
});

test("concurrent generation is coalesced and a revoked response is not persisted", async () => {
  setup();
  let release;
  let sent = 0;
  globalThis.briefGenerate = () => { sent++; return new Promise((resolve) => { release = resolve; }); };
  const first = generateBrief("default", localBriefDate());
  await new Promise((resolve) => setImmediate(resolve));
  await generateBrief("default", localBriefDate());
  assert.equal(sent, 1);
  useBrowser.getState().updateSettings({ dailyBriefProvider: "claude" });
  release(JSON.stringify(content));
  await first;
  assert.equal(docs.has("daily-briefs.json"), false);
  assert.equal(useDailyBriefs.getState().entries[`default/${localBriefDate()}`].content, undefined);
});

test("private generation never reads sources or calls the provider", async () => {
  setup();
  let calls = 0;
  globalThis.briefCollect = async () => { calls++; return {}; };
  await generateBrief("incognito:test@default", localBriefDate());
  assert.equal(calls, 0);
  assert.equal(docs.has("daily-briefs.json"), false);
});

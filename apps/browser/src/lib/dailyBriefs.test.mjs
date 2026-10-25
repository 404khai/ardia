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

test("focus links bind provider references to real GitHub context titles and URLs", async () => {
  setup();
  const trusted = { title: "Actual PR title", url: "https://github.com/owner/repo/pull/42" };
  globalThis.briefCollect = async () => ({ github: [trusted], calendar: [] });
  globalThis.briefGenerate = async () => JSON.stringify({ ...content, focus: { title: "Review", body: "Review code", sourceUrls: [trusted.url, "https://github.com/owner/repo/pull/999"] } });
  await generateBrief("default", localBriefDate());
  const entry = useDailyBriefs.getState().entries[`default/${localBriefDate()}`];
  assert.deepEqual(entry.content.focus.links, [trusted]);
  assert.deepEqual(JSON.parse(docs.get("daily-briefs.json"))[`default/${localBriefDate()}`].focus.links, [trusted]);
});

test("focus PR-number fallback only links a unique matching source", async () => {
  setup();
  const trusted = { title: "Actual PR title", url: "https://github.com/owner/repo/pull/42" };
  globalThis.briefCollect = async () => ({ github: [trusted], calendar: [] });
  globalThis.briefGenerate = async () => JSON.stringify({ ...content, focus: { title: "Prepare PR #42", body: "Review code" } });
  await generateBrief("default", localBriefDate());
  assert.deepEqual(useDailyBriefs.getState().entries[`default/${localBriefDate()}`].content.focus.links, [trusted]);
  globalThis.briefCollect = async () => ({ github: [trusted, { title: "Different PR", url: "https://github.com/other/repo/pull/42" }], calendar: [] });
  await generateBrief("default", localBriefDate());
  assert.deepEqual(useDailyBriefs.getState().entries[`default/${localBriefDate()}`].content.focus.links, []);
  globalThis.briefGenerate = async () => JSON.stringify({ ...content, focus: { title: "Review", body: "https://github.com/owner/repo/pull/420" } });
  await generateBrief("default", localBriefDate());
  assert.deepEqual(useDailyBriefs.getState().entries[`default/${localBriefDate()}`].content.focus.links, []);
});

test("update source metadata comes from real collected PRs and Gmail messages", async () => {
  setup();
  const github = { title: "Actual PR", url: "https://github.com/owner/repo/pull/42", repository: "owner/repo" };
  const gmail = { id: "abc123def456", url: "https://mail.google.com/mail/u/?authuser=second%40example.com#all/abc123def456" };
  globalThis.briefCollect = async () => ({ github: [github], gmail: [gmail], calendar: [] });
  globalThis.briefGenerate = async () => JSON.stringify({ ...content, updates: [
    { title: "Code update", body: "Review", source: { kind: "gmail", url: github.url, project: "Invented project" } },
    { title: "Email update", body: "Read", sourceUrl: gmail.url },
    { title: "Invented reference", body: "Read", sourceUrl: "https://github.com/owner/repo/pull/999" },
    { title: "No source", body: "Nothing matching" },
  ] });
  await generateBrief("default", localBriefDate());
  const updates = useDailyBriefs.getState().entries[`default/${localBriefDate()}`].content.updates;
  assert.deepEqual(updates[0].source, { kind: "github", url: github.url, project: "repo" });
  assert.deepEqual(updates[1].source, { kind: "gmail", url: gmail.url });
  assert.equal(updates[2].source, undefined);
  assert.equal(updates[3].source, undefined);
});

test("legacy update references match unique PR numbers or exact Gmail message identifiers", async () => {
  setup();
  const github = { title: "Actual PR", url: "https://github.com/owner/repo/pull/42", repository: "owner/repo" };
  const gmail = { id: "abc123def456", url: "https://mail.google.com/mail/u/?authuser=second%40example.com#all/abc123def456" };
  globalThis.briefCollect = async () => ({ github: [github], gmail: [gmail], calendar: [] });
  globalThis.briefGenerate = async () => JSON.stringify({ ...content, updates: [
    { title: "PR #42 updated", body: "Review" },
    { title: "Email update", body: "Message abc123def456 needs attention" },
    { title: "Email update", body: "Message abc123def4567 is different" },
    { title: "Mixed update PR #42", body: "Message abc123def456" },
  ] });
  await generateBrief("default", localBriefDate());
  const updates = useDailyBriefs.getState().entries[`default/${localBriefDate()}`].content.updates;
  assert.equal(updates[0].source.url, github.url);
  assert.equal(updates[1].source.url, gmail.url);
  assert.equal(updates[2].source, undefined);
  assert.equal(updates[3].source, undefined);
});

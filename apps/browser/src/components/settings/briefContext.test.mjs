import assert from "node:assert/strict";
import { test } from "node:test";
import { useBrowser } from "../../store/browser.ts";
import { gmailTest } from "@ardia/shell";
import { collectBriefContext, connectClaudeKey, disconnectClaude, generateClaudeBrief } from "./briefContext.ts";

const noSources = { gmail: false, calendar: false, github: false };

test("unconsented sources do not contact services or include calendar and GitHub data", async () => {
  const settings = useBrowser.getState().settings;
  const fetchBefore = globalThis.fetch;
  globalThis.fetch = () => { throw new Error("Unexpected service request"); };
  useBrowser.getState().updateSettings({ dailyBriefSources: noSources });
  try {
    const context = await collectBriefContext();
    assert.deepEqual(context.calendar, []);
    assert.deepEqual(context.github, []);
    assert.deepEqual(context.gmail, []);
    assert.deepEqual(context.errors, []);
  } finally {
    globalThis.fetch = fetchBefore;
    useBrowser.setState({ settings });
  }
});

test("Gmail status and messages are never requested without source consent", async () => {
  const settings = useBrowser.getState().settings;
  const status = gmailTest.status;
  const messages = gmailTest.messages;
  let requests = 0;
  gmailTest.status = async () => { requests++; throw new Error("Unexpected Gmail status request"); };
  gmailTest.messages = async () => { requests++; throw new Error("Unexpected Gmail message request"); };
  useBrowser.getState().updateSettings({ dailyBriefSources: noSources });
  try {
    assert.deepEqual((await collectBriefContext()).gmail, []);
    assert.equal(requests, 0);
  } finally {
    gmailTest.status = status;
    gmailTest.messages = messages;
    useBrowser.setState({ settings });
  }
});

test("Gmail collection is bounded and includes only brief message fields", async () => {
  const settings = useBrowser.getState().settings;
  const status = gmailTest.status;
  const messages = gmailTest.messages;
  gmailTest.status = async () => ({ connected: true, email: "test@example.com", clientSecretConfigured: false });
  gmailTest.messages = async () => Array.from({ length: 20 }, (_, i) => ({ id: String(i), subject: "s".repeat(400), from: "f".repeat(400), date: "2026-10-24", snippet: "x".repeat(900), attachment: "not shared" }));
  useBrowser.getState().updateSettings({ dailyBriefSources: { ...noSources, gmail: true } });
  try {
    const context = await collectBriefContext();
    assert.equal(context.gmail.length, 15);
    assert.equal(context.gmail[0].subject.length, 300);
    assert.equal(context.gmail[0].from.length, 300);
    assert.equal(context.gmail[0].snippet.length, 512);
    assert.deepEqual(Object.keys(context.gmail[0]).sort(), ["date", "from", "id", "snippet", "subject"]);
  } finally {
    gmailTest.status = status;
    gmailTest.messages = messages;
    useBrowser.setState({ settings });
  }
});

test("revoking Gmail while its status is pending prevents mailbox access", async () => {
  const settings = useBrowser.getState().settings;
  const status = gmailTest.status;
  const messages = gmailTest.messages;
  let resolveStatus;
  let reads = 0;
  gmailTest.status = () => new Promise((resolve) => { resolveStatus = resolve; });
  gmailTest.messages = async () => { reads++; return []; };
  useBrowser.getState().updateSettings({ dailyBriefSources: { ...noSources, gmail: true } });
  try {
    const rejected = assert.rejects(collectBriefContext(), /permissions changed/);
    useBrowser.getState().updateSettings({ dailyBriefSources: noSources });
    resolveStatus({ connected: true, email: "test@example.com", clientSecretConfigured: false });
    await rejected;
    assert.equal(reads, 0);
  } finally {
    gmailTest.status = status;
    gmailTest.messages = messages;
    useBrowser.setState({ settings });
  }
});

test("revoking Gmail cancels a pending read and rejects its returned content", async () => {
  const settings = useBrowser.getState().settings;
  const status = gmailTest.status;
  const messages = gmailTest.messages;
  const cancel = gmailTest.cancel;
  let resolveMessages;
  let started;
  const reading = new Promise((resolve) => { started = resolve; });
  let cancellations = 0;
  gmailTest.status = async () => ({ connected: true, email: "test@example.com", clientSecretConfigured: false });
  gmailTest.messages = () => { started(); return new Promise((resolve) => { resolveMessages = resolve; }); };
  gmailTest.cancel = async () => { cancellations++; };
  useBrowser.getState().updateSettings({ dailyBriefSources: { ...noSources, gmail: true } });
  try {
    const rejected = assert.rejects(collectBriefContext(), /permissions changed/);
    await reading;
    useBrowser.getState().updateSettings({ dailyBriefSources: noSources });
    resolveMessages([{ id: "1", subject: "private", from: "sender", date: "today", snippet: "private" }]);
    await rejected;
    assert.ok(cancellations > 0);
  } finally {
    gmailTest.status = status;
    gmailTest.messages = messages;
    gmailTest.cancel = cancel;
    useBrowser.setState({ settings });
  }
});

test("revoking source consent while collection is pending rejects its result", async () => {
  const settings = useBrowser.getState().settings;
  useBrowser.getState().updateSettings({ dailyBriefSources: { ...noSources, calendar: true } });
  try {
    const pending = collectBriefContext();
    useBrowser.getState().updateSettings({ dailyBriefSources: noSources });
    await assert.rejects(pending, /permissions changed/);
  } finally {
    useBrowser.setState({ settings });
  }
});

test("a historical brief cannot receive current calendar or GitHub context", async () => {
  await assert.rejects(collectBriefContext("2001-01-01"), /today’s brief/);
});

test("Claude API setup rejects subscription and malformed tokens before a service request", async () => {
  const fetchBefore = globalThis.fetch;
  let requested = false;
  globalThis.fetch = () => { requested = true; throw new Error("Unexpected service request"); };
  try {
    await assert.rejects(connectClaudeKey("subscription-token"), /Anthropic API key/);
    assert.equal(requested, false);
  } finally {
    globalThis.fetch = fetchBefore;
  }
});

test("an aborted generation does not read a key or submit context", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(generateClaudeBrief("private context", controller.signal), /cancelled/);
});

test("disconnect cancels generation waiting for its Keychain read before it can submit context", async () => {
  const fetchBefore = globalThis.fetch;
  let requested = false;
  globalThis.fetch = () => { requested = true; throw new Error("Unexpected service request"); };
  try {
    const rejected = assert.rejects(generateClaudeBrief("private context"), /cancelled/);
    await disconnectClaude();
    await rejected;
    assert.equal(requested, false);
  } finally {
    globalThis.fetch = fetchBefore;
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import { briefDateFromUrl, briefDue, localBriefDate, parseBriefDate } from "./briefDates.ts";
import { parseBriefContent } from "./briefContent.ts";

const settings = { dailyBriefEnabled: true, dailyBriefTime: "08:00", dailyBriefDelivery: "scheduled", dailyBriefLastOpened: "" };

test("brief delivery follows local time, catches up today and never repeats after dismissal", () => {
  const before = new Date(2026, 9, 24, 7, 59);
  const after = new Date(2026, 9, 24, 8, 0);
  assert.equal(briefDue(settings, before), false);
  assert.equal(briefDue(settings, after), true);
  assert.equal(briefDue({ ...settings, dailyBriefLastOpened: localBriefDate(after) }, after), false);
  assert.equal(briefDue({ ...settings, dailyBriefLastOpened: "2026-10-23" }, after), true);
  assert.equal(briefDue({ ...settings, dailyBriefEnabled: false }, after), false);
  assert.equal(briefDue({ ...settings, dailyBriefDelivery: "onOpen" }, before), true);
});

test("invalid times fail closed and calendar dates reject overflow", () => {
  for (const time of ["24:00", "8:00", "08:60", "", "NaN"]) assert.equal(briefDue({ ...settings, dailyBriefTime: time }), false);
  assert.equal(parseBriefDate("2026-02-30"), null);
  assert.equal(parseBriefDate("2026-13-01"), null);
  assert.equal(parseBriefDate("2026-10-24x"), null);
  assert.equal(localBriefDate(new Date(2026, 9, 24, 23, 59)), "2026-10-24");
  assert.equal(briefDateFromUrl("ardia://brief/2026-10-21"), "2026-10-21");
});

test("provider output is validated, bounded and rendered as plain text", () => {
  const content = { summary: "Today", focus: { title: "<script>", body: "Read sources" }, todos: [], updates: [], events: [{ title: "Call", body: "Meet", time: "08:00" }] };
  assert.deepEqual(parseBriefContent(JSON.stringify(content)), content);
  assert.deepEqual(parseBriefContent("```json\n" + JSON.stringify(content) + "\n```"), content);
  assert.throws(() => parseBriefContent(JSON.stringify({ ...content, focus: null })));
  assert.throws(() => parseBriefContent(JSON.stringify({ ...content, events: [null] })));
  assert.throws(() => parseBriefContent("not json"));
  assert.equal(parseBriefContent(JSON.stringify({ ...content, summary: "a".repeat(1000) })).summary.length, 600);
  assert.equal(parseBriefContent(JSON.stringify({ ...content, todos: Array(100).fill(content.focus) })).todos.length, 12);
});

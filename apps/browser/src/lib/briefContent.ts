export type BriefItem = { title: string; body: string };
export type BriefContent = { summary: string; focus: BriefItem; todos: BriefItem[]; updates: BriefItem[]; events: (BriefItem & { time: string })[] };

export function parseBriefContent(raw: string): BriefContent {
  const content = JSON.parse(raw.replace(/^\s*```(?:json)?\s*/, "").replace(/\s*```\s*$/, ""));
  const text = (value: unknown, limit: number): string => {
    if (typeof value !== "string") throw new Error("The provider returned an invalid brief. Try again.");
    return value.slice(0, limit);
  };
  const item = (value: unknown): BriefItem => {
    if (!value || typeof value !== "object") throw new Error("The provider returned an invalid brief. Try again.");
    const v = value as Record<string, unknown>;
    return { title: text(v.title, 240), body: text(v.body, 2400) };
  };
  const items = (value: unknown): BriefItem[] => {
    if (!Array.isArray(value)) throw new Error("The provider returned an invalid brief. Try again.");
    return value.slice(0, 12).map(item);
  };
  if (!content || typeof content !== "object" || !Array.isArray(content.events)) throw new Error("The provider returned an invalid brief. Try again.");
  return { summary: text(content.summary, 600), focus: item(content.focus), todos: items(content.todos), updates: items(content.updates), events: content.events.slice(0, 20).map((event: Record<string, unknown>) => ({ ...item(event), time: text(event.time, 80) })) };
}

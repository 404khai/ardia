export type BriefSource = { kind: "github" | "gmail"; url: string; project?: string };
export type BriefItem = { title: string; body: string; source?: BriefSource };
export type BriefLink = { title: string; url: string };
export type BriefContent = { summary: string; focus: BriefItem & { links?: BriefLink[] }; todos: BriefItem[]; updates: BriefItem[]; events: (BriefItem & { time: string })[] };

function briefSource(value: unknown): BriefSource | undefined {
  const source = typeof value === "string" ? { url: value } : value && typeof value === "object" ? value as Record<string, unknown> : null;
  if (!source || typeof source.url !== "string") return;
  if (/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/pull\/[1-9]\d*$/.test(source.url)) return { kind: "github", url: source.url, ...(typeof source.project === "string" ? { project: source.project.slice(0, 120) } : {}) };
  if (/^https:\/\/mail\.google\.com\/mail\/u\/0\/#all\/[a-fA-F0-9]+$/.test(source.url)) return { kind: "gmail", url: source.url };
  const accountMessage = source.url.match(/^https:\/\/mail\.google\.com\/mail\/u\/\?authuser=([^&#]+)#all\/([a-fA-F0-9]+)$/);
  if (accountMessage) {
    try {
      const expected = gmailBriefUrl(decodeURIComponent(accountMessage[1]!), accountMessage[2]!);
      if (expected === source.url) return { kind: "gmail", url: source.url };
    } catch {}
  }
}

export function gmailBriefUrl(email: string | undefined, id: string): string | undefined {
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^[a-fA-F0-9]{1,128}$/.test(id)) return;
  return `https://mail.google.com/mail/u/?authuser=${encodeURIComponent(email)}#all/${id}`;
}

export function isSafeBriefSource(source: BriefSource): boolean {
  return briefSource(source)?.kind === source.kind;
}

export function parseBriefContent(raw: string): BriefContent {
  const content = JSON.parse(raw.replace(/^\s*```(?:json)?\s*/, "").replace(/\s*```\s*$/, ""));
  const text = (value: unknown, limit: number): string => {
    if (typeof value !== "string") throw new Error("The provider returned an invalid brief. Try again.");
    return value.slice(0, limit);
  };
  const item = (value: unknown): BriefItem => {
    if (!value || typeof value !== "object") throw new Error("The provider returned an invalid brief. Try again.");
    const v = value as Record<string, unknown>;
    const source = briefSource(v.sourceUrl ?? v.source);
    return { title: text(v.title, 240), body: text(v.body, 2400), ...(source ? { source } : {}) };
  };
  const items = (value: unknown): BriefItem[] => {
    if (!Array.isArray(value)) throw new Error("The provider returned an invalid brief. Try again.");
    return value.slice(0, 12).map(item);
  };
  if (!content || typeof content !== "object" || !Array.isArray(content.events)) throw new Error("The provider returned an invalid brief. Try again.");
  const focus: BriefContent["focus"] = item(content.focus);
  const sources = content.focus.sourceUrls ?? content.focus.links;
  if (Array.isArray(sources)) {
    focus.links = sources.slice(0, 5).flatMap((source: unknown) => {
      const value = typeof source === "string" ? { url: source, title: source } : source && typeof source === "object" ? source as Record<string, unknown> : null;
      if (!value || typeof value.url !== "string" || !/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/pull\/[1-9]\d*$/.test(value.url)) return [];
      return [{ url: value.url, title: typeof value.title === "string" ? value.title.slice(0, 240) : value.url }];
    });
  }
  return { summary: text(content.summary, 600), focus, todos: items(content.todos), updates: items(content.updates), events: content.events.slice(0, 20).map((event: Record<string, unknown>) => ({ ...item(event), time: text(event.time, 80) })) };
}

export function focusBriefLinks(focus: BriefContent["focus"], candidates: BriefLink[]): BriefLink[] {
  const requested = new Set(focus.links?.map((link) => link.url));
  const description = `${focus.title} ${focus.body}`;
  const mentionedUrls = new Set(description.match(/https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/pull\/[1-9]\d*/g) ?? []);
  const numbers = [...description.matchAll(/(?:\bPR\s*|pull request\s*)#?(\d+)\b/gi)].map((match) => match[1]);
  return candidates.filter((candidate) => {
    if (!/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/pull\/[1-9]\d*$/.test(candidate.url)) return false;
    if (requested.has(candidate.url) || mentionedUrls.has(candidate.url)) return true;
    const number = candidate.url.split("/").at(-1)!;
    return numbers.includes(number) && candidates.filter((other) => other.url.split("/").at(-1) === number).length === 1;
  }).filter((candidate, index, all) => all.findIndex((other) => other.url === candidate.url) === index).slice(0, 5).map(({ title, url }) => ({ title: title.slice(0, 240), url }));
}

export function updateBriefSource(item: BriefItem, github: (BriefLink & { repository?: string })[], gmail: { id: string; url?: string }[]): BriefSource | undefined {
  const candidates: BriefSource[] = [
    ...github.flatMap(({ url, repository }) => {
      const source = briefSource(url);
      return source?.kind === "github" ? [{ ...source, project: (repository ?? url.split("/")[4]!).split("/").at(-1)!.slice(0, 120) }] : [];
    }),
    ...gmail.flatMap(({ url }) => {
      const source = briefSource(url);
      return source?.kind === "gmail" ? [source] : [];
    }),
  ];
  if (item.source) return candidates.find((source) => source.url === item.source?.url);
  const referencedGithub = focusBriefLinks(item, github);
  const description = `${item.title} ${item.body}`;
  const mentionedUrls = new Set(description.match(/https:\/\/mail\.google\.com\/mail\/u\/(?:0\/|\?authuser=[^&#\s]+)#all\/[a-fA-F0-9]+/g) ?? []);
  const referencedGmail = gmail.filter(({ id, url }) => !!url && (mentionedUrls.has(url) || /^[a-fA-F0-9]{10,128}$/.test(id) && new RegExp(`(^|[^a-zA-Z0-9])${id}([^a-zA-Z0-9]|$)`).test(description))).map(({ url }) => url);
  const mentioned = new Set([...referencedGithub.map(({ url }) => url), ...referencedGmail]);
  const matches = candidates.filter(({ url }) => mentioned.has(url));
  return matches.length === 1 ? matches[0] : undefined;
}

export interface Frontmatter {
  type?: string;
  status?: string;
  slug?: string;
  author?: string;
  agent?: string;
  created?: string;
  ticket?: string;
  tags?: string[];
  [key: string]: string | string[] | undefined;
}

export interface ParsedNote {
  frontmatter: Frontmatter;
  body: string;
}

const FENCE = "---";

/** Order keys are emitted in; unknown keys follow in insertion order. */
const KEY_ORDER = ["type", "status", "slug", "author", "agent", "created", "ticket", "tags"];

/** Split a file into its flat-YAML frontmatter and the remaining body. */
export function parseNote(content: string): ParsedNote {
  const lines = content.split("\n");
  if (lines[0]?.trim() !== FENCE) {
    return { frontmatter: {}, body: content };
  }

  const frontmatter: Frontmatter = {};
  let cursor = 1;
  for (; cursor < lines.length; cursor++) {
    const line = lines[cursor];
    if (line === undefined) break;
    if (line.trim() === FENCE) {
      cursor++;
      break;
    }
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const raw = line.slice(colon + 1).trim();
    if (!key) continue;
    frontmatter[key] = key === "tags" ? parseTags(raw) : stripQuotes(raw);
  }

  const body = lines.slice(cursor).join("\n");
  return { frontmatter, body };
}

/** Serialize frontmatter + body back into a full note, with a stable key order. */
export function serializeNote(frontmatter: Frontmatter, body: string): string {
  const seen = new Set<string>();
  const lines: string[] = [FENCE];

  const emit = (key: string): void => {
    const value = frontmatter[key];
    if (value === undefined) return;
    if (Array.isArray(value)) {
      if (value.length === 0) return;
      lines.push(`${key}: [${value.join(", ")}]`);
    } else {
      lines.push(`${key}: ${value}`);
    }
    seen.add(key);
  };

  for (const key of KEY_ORDER) emit(key);
  for (const key of Object.keys(frontmatter)) {
    if (!seen.has(key)) emit(key);
  }

  lines.push(FENCE);
  const normalizedBody = body.startsWith("\n") ? body : `\n${body}`;
  return lines.join("\n") + normalizedBody;
}

function parseTags(raw: string): string[] {
  const inner = raw.replace(/^\[/, "").replace(/\]$/, "");
  return inner
    .split(",")
    .map((tag) => stripQuotes(tag.trim()))
    .filter((tag) => tag.length > 0);
}

function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

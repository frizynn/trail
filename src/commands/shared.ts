import { existsSync, readdirSync, readFileSync, renameSync } from "node:fs";
import { join } from "node:path";

import { appendAtomic, writeAtomic } from "../core/atomic.ts";
import { parseNote, serializeNote } from "../core/frontmatter.ts";
import type { Frontmatter } from "../core/frontmatter.ts";
import { checkHot, regenerateHot } from "../core/hot.ts";
import type { HotStatus } from "../core/hot.ts";
import { now, resolveAgent, resolveAuthor, today } from "../core/provenance.ts";
import { slugify } from "../core/slug.ts";
import { dim, info, ok, warn } from "../core/ui.ts";
import { requireVault, vaultPaths } from "../core/vault.ts";

/** A command error whose message is shown to the user; the CLI exits non-zero. */
export class TrailError extends Error {}

/** Build a timeline entry: `- HH:MM · author · agent  text`. */
export function timelineEntry(text: string): string {
  return `- ${now()} · ${resolveAuthor()} · ${resolveAgent()}  ${text}\n`;
}

/** Append today's-log line, creating the day file with a heading if needed. */
export function appendLog(root: string, text: string): void {
  const paths = vaultPaths(root);
  const file = join(paths.log, `${today()}.md`);
  if (!existsSync(file)) {
    appendAtomic(file, `# ${today()}\n\n`);
  }
  appendAtomic(file, timelineEntry(text));
}

/** Append a stamped entry under a note's `## Timeline` heading. */
export function appendTimeline(filePath: string, text: string): void {
  appendAtomic(filePath, timelineEntry(text));
}

/** Locate a note by slug across WIP/DONE/PAUSED/Research/Decisions. */
export function findNote(root: string, slug: string): string | undefined {
  const paths = vaultPaths(root);
  const candidates = [
    join(paths.wip, `${slug}.md`),
    join(paths.done, `${slug}.md`),
    join(paths.paused, `${slug}.md`),
    join(paths.research, `${slug}.md`),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return findDecision(root, slug);
}

/** Decisions are stored as `YYYY-MM-DD-<slug>.md`; match by name or frontmatter slug. */
function findDecision(root: string, slug: string): string | undefined {
  const { decisions } = vaultPaths(root);
  if (!existsSync(decisions)) return undefined;
  for (const name of readdirSync(decisions)) {
    if (!name.endsWith(".md")) continue;
    if (name === `${slug}.md`) return join(decisions, name);
    if (name.replace(/^\d{4}-\d{2}-\d{2}-/, "") === `${slug}.md`) return join(decisions, name);
    const { frontmatter } = parseNote(readFileSync(join(decisions, name), "utf8"));
    if (frontmatter.slug === slug) return join(decisions, name);
  }
  return undefined;
}

/** Read a note, mutate its frontmatter, and write it back atomically (temp + rename). */
export function updateFrontmatter(filePath: string, mutate: (fm: Frontmatter) => void): void {
  const { frontmatter, body } = parseNote(readFileSync(filePath, "utf8"));
  mutate(frontmatter);
  writeAtomic(filePath, serializeNote(frontmatter, body));
}

/** Regenerate `_hot.md`, then warn (non-blocking) if it is over budget. */
export function refreshHotAndWarn(root: string): void {
  warnIfOverBudget(regenerateHot(root));
}

export function warnIfOverBudget(status: HotStatus): void {
  if (status.overBudget) {
    warn(
      `${status.activeTasks} active tasks · _hot ${status.words} words (budget ${status.budget}). Close or pause some.`,
    );
  }
}

export interface ParsedFlags {
  positionals: string[];
  flags: Record<string, string | undefined>;
}

/** Split args into positionals and `--name value` flags drawn from `names`. */
export function parseFlags(args: string[], names: string[]): ParsedFlags {
  const positionals: string[] = [];
  const flags: Record<string, string | undefined> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === undefined) continue;
    const name = arg.startsWith("--") ? arg.slice(2) : undefined;
    if (name && names.includes(name)) flags[name] = args[++i];
    else positionals.push(arg);
  }
  return { positionals, flags };
}

/** What a note command contributes once its title has been turned into a slug. */
export interface NotePlan {
  /** Absolute path to write; refused if it already exists. */
  file: string;
  /** Human-friendly path for "already exists" / success output (e.g. `WIP/foo.md`). */
  rel: string;
  /** Full serialized note content. */
  content: string;
  /** Today's-log line for this creation. */
  logText: string;
  /** Success confirmation message. */
  okMessage: string;
}

/**
 * The shared create-note flow for task/decide/research: validate the title, derive a
 * slug, require an initialized vault, refuse a duplicate, then write + log + refresh.
 * Each command supplies its own template and messages via `plan`.
 */
export function createNote(
  title: string,
  usage: string,
  plan: (slug: string, root: string) => NotePlan,
): void {
  if (!title) throw new TrailError(usage);

  const slug = slugify(title);
  if (!slug) throw new TrailError(`could not derive a slug from "${title}"`);

  const { root } = requireVault();
  const { file, rel, content, logText, okMessage } = plan(slug, root);

  if (existsSync(file)) throw new TrailError(`already exists at ${rel}`);

  writeAtomic(file, content);
  appendLog(root, logText);
  refreshHotAndWarn(root);

  ok(okMessage);
  info(dim(`  ${rel}`));
}

/** Move a WIP task to its terminal directory: timeline entry, status, move, log, refresh. */
export function closeTask(opts: {
  slug: string;
  status: "done" | "paused";
  dest: "done" | "paused";
  timelineText: string;
  logLabel: string;
  okMessage: string;
}): void {
  const { root } = requireVault();
  const paths = vaultPaths(root);
  const src = join(paths.wip, `${opts.slug}.md`);
  if (!existsSync(src)) throw new TrailError(`no active task '${opts.slug}' in WIP/`);

  appendTimeline(src, opts.timelineText);
  updateFrontmatter(src, (fm) => {
    fm.status = opts.status;
  });

  renameSync(src, join(paths[opts.dest], `${opts.slug}.md`));
  appendLog(root, opts.logLabel);
  refreshHotAndWarn(root);

  ok(opts.okMessage);
}

export { checkHot };

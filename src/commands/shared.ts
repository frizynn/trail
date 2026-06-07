import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { appendAtomic, writeAtomic } from "../core/atomic.ts";
import { parseNote, serializeNote } from "../core/frontmatter.ts";
import type { Frontmatter } from "../core/frontmatter.ts";
import { checkHot, regenerateHot } from "../core/hot.ts";
import type { HotStatus } from "../core/hot.ts";
import { now, resolveAgent, resolveAuthor, today } from "../core/provenance.ts";
import { warn } from "../core/ui.ts";
import { vaultPaths } from "../core/vault.ts";

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

export { checkHot };

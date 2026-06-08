import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";

import { writeAtomic } from "../core/atomic.ts";
import { regenerateHot } from "../core/hot.ts";
import { formatDate, resolveAuthor } from "../core/provenance.ts";
import { slugify } from "../core/slug.ts";
import { dim, info, ok } from "../core/ui.ts";
import { resolveVaultRoot, VAULT_DIRS } from "../core/vault.ts";

import { parseFlags, TrailError } from "./shared.ts";

type CountKey = "tasks" | "decisions" | "research" | "logs" | "loose";

/** A typed-note folder: its files get trail frontmatter injected on import. */
interface FolderRule {
  dir: (typeof VAULT_DIRS)[number];
  /** `type` injected when a note has none. */
  type: string;
  /** `status` injected when a task note has none. */
  status?: string;
  /** Which summary counter this folder feeds. */
  category: Exclude<CountKey, "logs" | "loose">;
  /** Strip a leading `YYYY-MM-DD` prefix from the basename before slugifying (Decisions). */
  stripDatePrefix?: boolean;
}

/** Typed-note folders: bodies, filenames and wikilinks preserved; frontmatter augmented. */
const FOLDER_RULES: FolderRule[] = [
  { dir: "WIP", type: "task", status: "wip", category: "tasks" },
  { dir: "DONE", type: "task", status: "done", category: "tasks" },
  { dir: "PAUSED", type: "task", status: "paused", category: "tasks" },
  { dir: "Decisions", type: "decision", category: "decisions", stripDatePrefix: true },
  { dir: "Research", type: "research", category: "research" },
];

/** Folders copied verbatim into the same-named subdir — not typed notes, so no frontmatter. */
const VERBATIM_DIRS: { dir: string; category: CountKey }[] = [
  { dir: "Log", category: "logs" },
  { dir: "Notion", category: "loose" },
];

/** Top-level source files that are trail-derived or vault rules, never imported. */
const SKIP_TOP_LEVEL = new Set(["_hot.md", "CLAUDE.md"]);

interface Counts {
  tasks: number;
  decisions: number;
  research: number;
  logs: number;
  loose: number;
  skipped: number;
}

interface Context {
  source: string;
  root: string;
  author: string;
  dryRun: boolean;
  force: boolean;
  counts: Counts;
}

/**
 * Import an `obsidian-memory` vault into the current `.trail/` vault: faithful and
 * non-destructive. Typed notes (tasks, decisions, research) keep their body, filename and
 * wikilinks verbatim and only gain the frontmatter trail requires; everything else (the
 * daily log, loose notes, a `Notion/` folder) is copied byte-for-byte. Never writes to the
 * source, and (outside `--dry-run`) regenerates `_hot.md` at the end.
 */
export function migrate(args: string[]): void {
  const { flags } = parseFlags(args, ["from", "author"]);
  const root = resolveVaultRoot();
  const ctx: Context = {
    source: resolveSource(flags["from"], root),
    root,
    author: flags["author"] || resolveAuthor(),
    dryRun: args.includes("--dry-run"),
    force: args.includes("--force"),
    counts: { tasks: 0, decisions: 0, research: 0, logs: 0, loose: 0, skipped: 0 },
  };

  if (!ctx.dryRun) ensureVaultDirs(root);

  for (const rule of FOLDER_RULES) migrateTyped(ctx, rule);
  for (const { dir, category } of VERBATIM_DIRS) migrateVerbatimDir(ctx, dir, category);
  migrateLooseFiles(ctx);

  if (!ctx.dryRun) regenerateHot(root);

  printSummary(ctx);
}

/**
 * Resolve the source vault. Defaults to `~/Obsidian/<basename of the git root>`.
 * Throws a TrailError listing `~/Obsidian/*` candidates when the source is missing.
 */
function resolveSource(from: string | undefined, root: string): string {
  const source = from ? resolve(expandHome(from)) : join(homedir(), "Obsidian", basename(dirname(root)));
  if (!existsSync(source)) {
    throw new TrailError(`source vault not found: ${source}${obsidianHint()}`);
  }
  return source;
}

function expandHome(path: string): string {
  if (path === "~") return homedir();
  if (path.startsWith("~/")) return join(homedir(), path.slice(2));
  return path;
}

/** When the source is missing, hint with the directories under `~/Obsidian/` if any. */
function obsidianHint(): string {
  const base = join(homedir(), "Obsidian");
  if (!isDir(base)) return "";
  const dirs = readdirSync(base, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  return dirs.length ? `\n  vaults under ~/Obsidian/: ${dirs.join(", ")}` : "";
}

/** Create any missing trail directories (non-destructive). */
function ensureVaultDirs(root: string): void {
  for (const dir of VAULT_DIRS) mkdirSync(join(root, dir), { recursive: true });
}

/** Import a typed-note folder: copy each file with trail frontmatter injected. */
function migrateTyped(ctx: Context, rule: FolderRule): void {
  const srcDir = join(ctx.source, rule.dir);
  if (!isDir(srcDir)) return;

  for (const name of markdownFiles(srcDir)) {
    const rel = `${rule.dir}/${name}`;
    const destFile = join(ctx.root, rule.dir, name);
    if (skipExisting(ctx, destFile, rel)) continue;

    const srcFile = join(srcDir, name);
    if (!ctx.dryRun) {
      writeAtomic(destFile, augmentNote(readFileSync(srcFile, "utf8"), srcFile, rule, ctx.author));
    }
    record(ctx, rel, rule.category);
  }
}

/** Copy a whole source subdir verbatim (recursively) into the same-named trail subdir. */
function migrateVerbatimDir(ctx: Context, dir: string, category: CountKey): void {
  const srcDir = join(ctx.source, dir);
  if (!isDir(srcDir)) return;

  for (const rel of walkFiles(srcDir)) {
    const label = `${dir}/${rel}`;
    const destFile = join(ctx.root, dir, rel);
    if (skipExisting(ctx, destFile, label)) continue;

    if (!ctx.dryRun) copyVerbatim(join(srcDir, rel), destFile);
    record(ctx, label, category);
  }
}

/** Copy loose top-level `*.md` (INBOX, GOTCHAS, PRD, …) verbatim into `.trail/`. */
function migrateLooseFiles(ctx: Context): void {
  for (const entry of readdirSync(ctx.source, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    if (SKIP_TOP_LEVEL.has(entry.name) || entry.name.startsWith("_hot.archive-")) continue;

    const destFile = join(ctx.root, entry.name);
    if (skipExisting(ctx, destFile, entry.name)) continue;

    if (!ctx.dryRun) copyVerbatim(join(ctx.source, entry.name), destFile);
    record(ctx, entry.name, "loose");
  }
}

/** Copy a single file unchanged, creating parent directories as needed. */
function copyVerbatim(srcFile: string, destFile: string): void {
  mkdirSync(dirname(destFile), { recursive: true });
  cpSync(srcFile, destFile);
}

/** Relative paths of every file under `dir` (recursive), excluding `.gitkeep`. */
function walkFiles(dir: string, base = dir): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(full, base));
    else if (entry.isFile() && entry.name !== ".gitkeep") files.push(relative(base, full));
  }
  return files;
}

/** True (and counts/reports the skip) if the target exists and `--force` was not given. */
function skipExisting(ctx: Context, destFile: string, rel: string): boolean {
  if (!existsSync(destFile) || ctx.force) return false;
  ctx.counts.skipped++;
  info(`  ${prefix(ctx)}${dim("skip-exists")} ${rel}`);
  return true;
}

/** Count a copied item under its summary category and report it. */
function record(ctx: Context, rel: string, category: CountKey): void {
  ctx.counts[category]++;
  info(`  ${prefix(ctx)}copy ${rel}`);
}

/**
 * Return the file with missing trail frontmatter keys injected, preserving the body,
 * existing frontmatter (including multiline YAML lists), wikilinks and blank lines
 * byte-for-byte. Frontmatter is never semantically parsed — only single-line `key: value`
 * pairs are appended; nothing is rewritten.
 */
function augmentNote(content: string, srcFile: string, rule: FolderRule, author: string): string {
  const split = splitFrontmatter(content);
  const additions = missingLines(frontmatterKeys(split?.frontmatter ?? ""), srcFile, rule, author);
  if (additions.length === 0) return content;

  if (!split) {
    const block = `---\n${additions.join("\n")}\n---\n`;
    return content.startsWith("\n") ? `${block}${content}` : `${block}\n${content}`;
  }
  const fm = split.frontmatter ? `${split.frontmatter}\n${additions.join("\n")}` : additions.join("\n");
  return `---\n${fm}\n---${split.body}`;
}

interface FrontmatterSplit {
  /** Raw frontmatter lines (between the fences), joined with `\n`. Empty when none. */
  frontmatter: string;
  /** Everything from the newline after the closing fence onward, verbatim. */
  body: string;
}

/** Split a note into its raw frontmatter text and raw body, or undefined if no FM block. */
function splitFrontmatter(content: string): FrontmatterSplit | undefined {
  const lines = content.split("\n");
  if (lines[0] !== "---") return undefined;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === "---") {
      return {
        frontmatter: lines.slice(1, i).join("\n"),
        body: `\n${lines.slice(i + 1).join("\n")}`,
      };
    }
  }
  return undefined;
}

/** Map top-level frontmatter keys to their raw single-line value (empty for block values). */
function frontmatterKeys(fmText: string): Map<string, string> {
  const keys = new Map<string, string>();
  for (const line of fmText.split("\n")) {
    const match = line.match(/^([A-Za-z0-9_-]+):(.*)$/);
    if (match) keys.set(match[1]!, match[2]!.trim());
  }
  return keys;
}

/** The `key: value` lines to inject for trail-required keys the note lacks. */
function missingLines(
  keys: Map<string, string>,
  srcFile: string,
  rule: FolderRule,
  author: string,
): string[] {
  const lines: string[] = [];
  const add = (key: string, value: () => string): void => {
    if (!keys.has(key)) lines.push(`${key}: ${value()}`);
  };

  add("type", () => rule.type);
  const { status } = rule;
  if (status) add("status", () => status);
  add("slug", () => deriveSlug(srcFile, rule));
  add("author", () => author);
  add("agent", () => "migrated");
  add("created", () => deriveCreated(keys, srcFile));

  return lines;
}

/** Derive a slug from the filename; for Decisions strip a leading date prefix first. */
function deriveSlug(srcFile: string, rule: FolderRule): string {
  let name = basename(srcFile, ".md");
  if (rule.stripDatePrefix) {
    name = name.replace(/^\d{4}-\d{2}-\d{2}\s*-\s*/, "").replace(/^\d{4}-\d{2}-\d{2}\s+/, "");
  }
  return slugify(name);
}

/** `created` falls back to an existing `date`, else the file's mtime as ISO `YYYY-MM-DD`. */
function deriveCreated(keys: Map<string, string>, srcFile: string): string {
  const date = keys.get("date")?.replace(/^["']|["']$/g, "");
  if (date) return date;
  return formatDate(new Date(statSync(srcFile).mtime));
}

function markdownFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".md") && name !== ".gitkeep")
    .sort();
}

function prefix(ctx: Context): string {
  return ctx.dryRun ? dim("[dry-run] ") : "";
}

function printSummary(ctx: Context): void {
  const { source, root, counts, dryRun } = ctx;
  info("");
  if (dryRun) info(dim("[dry-run] nothing was written. Summary of what WOULD happen:"));

  const migrated = counts.tasks + counts.decisions + counts.research + counts.logs + counts.loose;
  ok(
    `${dryRun ? "would migrate" : "migrated"} ${migrated} item(s): ` +
      `${counts.tasks} task(s), ${counts.decisions} decision(s), ${counts.research} research, ` +
      `${counts.logs} log(s), ${counts.loose} loose file(s)`,
  );
  if (counts.skipped > 0) {
    info(`  ${dim(`${counts.skipped} skipped (already existed — use --force to overwrite)`)}`);
  }
  info(`  ${dim(`from ${source}`)}`);
  info(`  ${dim(`into ${root}`)}`);
  info(
    dim(
      "  Note: timelines are kept verbatim; `trail blame` only covers entries written through the CLI from here on.",
    ),
  );
}

function isDir(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

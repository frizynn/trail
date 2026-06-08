import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { writeAtomic } from "../core/atomic.ts";
import { emptyHot, obsidianGitignore } from "../core/templates.ts";
import { bold, dim, info, ok } from "../core/ui.ts";
import { resolveVaultRoot, vaultPaths, VAULT_DIRS } from "../core/vault.ts";

const POINTER_BEGIN = "<!-- trail:begin -->";
const POINTER_END = "<!-- trail:end -->";

export function init(args: string[]): void {
  const withHook = args.includes("--with-hook");
  const root = resolveVaultRoot();
  const paths = vaultPaths(root);
  const repoRoot = dirname(root);

  scaffoldVault(root, paths);
  writeVaultGitignore(root);
  const pointer = writePointers(repoRoot);
  if (withHook) writeHook(repoRoot);

  ok(`trail vault ready at ${dim(root)}`);
  info(`  ${pointer.created.length ? "wrote" : "checked"} pointer in ${pointer.files.join(", ")}`);
  if (withHook) {
    info(`  ${bold("SessionStart hook")} added to .claude/settings.json`);
    info(dim("  Claude Code will ask you to approve this repo's hooks once."));
  }
  info(dim('  Next: trail task "<title>"'));
}

function scaffoldVault(root: string, paths: ReturnType<typeof vaultPaths>): void {
  mkdirSync(root, { recursive: true });
  for (const dir of VAULT_DIRS) {
    const target = join(root, dir);
    mkdirSync(target, { recursive: true });
    keep(join(target, ".gitkeep"));
  }

  if (!existsSync(paths.hot)) {
    writeAtomic(paths.hot, emptyHot());
  }
}

function writeVaultGitignore(root: string): void {
  const target = join(root, ".gitignore");
  if (!existsSync(target)) writeFileSync(target, obsidianGitignore());
}

interface PointerResult {
  files: string[];
  created: string[];
}

function writePointers(repoRoot: string): PointerResult {
  const result: PointerResult = { files: [], created: [] };
  for (const name of ["AGENTS.md", "CLAUDE.md"]) {
    const target = join(repoRoot, name);
    const existed = existsSync(target);
    upsertPointer(target);
    result.files.push(name);
    if (!existed) result.created.push(name);
  }
  return result;
}

/** Idempotently insert or replace the trail pointer block, leaving the rest intact. */
function upsertPointer(filePath: string): void {
  const block = pointerBlock();
  const current = existsSync(filePath) ? readFileSync(filePath, "utf8") : "";

  if (current.includes(POINTER_BEGIN) && current.includes(POINTER_END)) {
    const before = current.slice(0, current.indexOf(POINTER_BEGIN));
    const after = current.slice(current.indexOf(POINTER_END) + POINTER_END.length);
    writeAtomic(filePath, `${before}${block}${after}`);
    return;
  }

  const prefix = current.length === 0 ? "" : current.endsWith("\n") ? current : `${current}\n`;
  const separator = prefix.length === 0 ? "" : "\n";
  writeAtomic(filePath, `${prefix}${separator}${block}\n`);
}

function pointerBlock(): string {
  return [
    POINTER_BEGIN,
    "## Project memory",
    "",
    "This project's shared memory lives in `.trail/` (a Markdown Obsidian vault).",
    "",
    "- Run `trail hot` to load the current context before you start.",
    "- Do not edit `.trail/` by hand. Use the `trail` CLI so writes stay atomic,",
    "  attributed, and append-only.",
    "- Start work with `trail task \"<title>\"`, record progress with `trail note`,",
    "  decisions with `trail decide`, and finish with `trail done <slug>`.",
    POINTER_END,
  ].join("\n");
}

function writeHook(repoRoot: string): void {
  const settingsPath = join(repoRoot, ".claude", "settings.json");
  mkdirSync(dirname(settingsPath), { recursive: true });

  const settings = readSettings(settingsPath);
  const hooks = (settings["hooks"] ??= {}) as Record<string, unknown>;
  const sessionStart = (hooks["SessionStart"] ??= []) as unknown[];

  const command = "trail hot 2>/dev/null || cat .trail/_hot.md 2>/dev/null";
  if (!hookPresent(sessionStart, command)) {
    sessionStart.push({ hooks: [{ type: "command", command }] });
  }

  writeAtomic(settingsPath, JSON.stringify(settings, null, 2) + "\n");
}

function readSettings(settingsPath: string): Record<string, unknown> {
  if (!existsSync(settingsPath)) return {};
  try {
    const parsed = JSON.parse(readFileSync(settingsPath, "utf8")) as unknown;
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** True if any SessionStart matcher already runs our trail-hot command. */
function hookPresent(sessionStart: unknown[], command: string): boolean {
  return sessionStart.some((matcher) => {
    const hooks = (matcher as { hooks?: unknown[] })?.hooks;
    return Array.isArray(hooks) && hooks.some((h) => (h as { command?: string })?.command === command);
  });
}

function keep(path: string): void {
  if (!existsSync(path)) writeFileSync(path, "");
}

import { execFileSync } from "node:child_process";
import { relative } from "node:path";

import { checkHot } from "../core/hot.ts";
import { bold, dim, err, info, ok, warn } from "../core/ui.ts";
import { requireVault } from "../core/vault.ts";

interface Violation {
  file: string;
  removed: { line: number; text: string; author: string }[];
}

/**
 * Validate the vault against the append-only rule:
 *  - any committed line that is deleted or rewritten is a violation, attributed
 *    to the original author via `git blame` on HEAD;
 *  - `_hot.md` over budget is a violation (the CI gate the SPEC asks for).
 * Exits non-zero when violations exist, so it can run as a required check.
 */
export function check(): number {
  const { root } = requireVault();
  const repoRoot = gitToplevel(root);

  if (!repoRoot) {
    warn("not a git repo; append-only diff check skipped (run inside git for full coverage)");
  }

  const violations = repoRoot ? appendOnlyViolations(repoRoot, root) : [];
  const hot = checkHot(root);

  let failed = false;

  for (const v of violations) {
    failed = true;
    err(`${bold(v.file)}: ${v.removed.length} existing line(s) removed or rewritten (append-only violation)`);
    for (const r of v.removed) {
      info(`    ${dim(`-${r.line}`)} ${r.text}  ${dim(`(was ${r.author})`)}`);
    }
  }

  if (hot.overBudget) {
    failed = true;
    err(`_hot.md over budget: ${hot.words} words (budget ${hot.budget}). ${hot.activeTasks} active tasks.`);
  }

  if (failed) {
    err("check failed");
    return 1;
  }
  ok("check passed: append-only respected, _hot within budget");
  return 0;
}

/** Absolute git work-tree root containing the vault, or undefined if not in a repo. */
function gitToplevel(cwd: string): string | undefined {
  try {
    const out = execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return out || undefined;
  } catch {
    return undefined;
  }
}

/**
 * `.md` files under the vault whose committed lines were removed or rewritten vs HEAD.
 * All git commands run from the repo root, with the vault as a pathspec, so paths line up.
 */
function appendOnlyViolations(repoRoot: string, vaultRoot: string): Violation[] {
  const vaultPath = relative(repoRoot, vaultRoot) || ".";
  const violations: Violation[] = [];
  for (const file of changedMarkdown(repoRoot, vaultPath)) {
    const removed = removedLines(repoRoot, file);
    if (removed.length > 0) {
      violations.push({ file, removed: attribute(repoRoot, file, removed) });
    }
  }
  return violations;
}

/** Repo-root-relative `.md` files under the vault that differ from HEAD, excluding _hot.md. */
function changedMarkdown(repoRoot: string, vaultPath: string): string[] {
  const out = git(repoRoot, ["diff", "--name-only", "HEAD", "--", `${vaultPath}/*.md`]);
  return out
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && l.endsWith(".md") && !l.endsWith("/_hot.md") && l !== "_hot.md");
}

/** Old-side line numbers and text for lines removed/rewritten vs HEAD. */
function removedLines(repoRoot: string, file: string): { line: number; text: string }[] {
  const diff = git(repoRoot, ["diff", "--no-color", "-U0", "HEAD", "--", file]);
  const removed: { line: number; text: string }[] = [];
  let oldLine = 0;
  for (const line of diff.split("\n")) {
    const hunk = line.match(/^@@ -(\d+)(?:,\d+)? \+/);
    if (hunk && hunk[1]) {
      oldLine = Number.parseInt(hunk[1], 10);
      continue;
    }
    if (line.startsWith("---") || line.startsWith("+++")) continue;
    if (line.startsWith("-")) {
      removed.push({ line: oldLine, text: line.slice(1) });
      oldLine++;
    } else if (line.startsWith(" ")) {
      oldLine++;
    }
  }
  return removed;
}

/** Attach the original author of each removed line via `git blame` on HEAD. */
function attribute(
  repoRoot: string,
  file: string,
  removed: { line: number; text: string }[],
): { line: number; text: string; author: string }[] {
  const authors = new Map<number, string>();
  const out = git(repoRoot, ["blame", "--line-porcelain", "HEAD", "--", file]);
  let current = 0;
  for (const line of out.split("\n")) {
    const header = line.match(/^[0-9a-f]{40}\s+(\d+)\s+(\d+)/);
    if (header && header[2]) current = Number.parseInt(header[2], 10);
    else if (line.startsWith("author ")) authors.set(current, line.slice("author ".length).trim());
  }
  return removed.map((r) => ({ ...r, author: authors.get(r.line) ?? "unknown" }));
}

function git(cwd: string, args: string[]): string {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return "";
  }
}

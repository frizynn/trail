import { execFileSync } from "node:child_process";

/** Absolute git work-tree root containing `cwd`, or undefined if not in a repo. */
export function gitRoot(cwd: string): string | undefined {
  return git(cwd, ["rev-parse", "--show-toplevel"]).trim() || undefined;
}

/** Run a git command from `cwd`, returning its stdout, or "" on any failure. */
export function git(cwd: string, args: string[]): string {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return "";
  }
}

/**
 * Map 1-based line number → committing author, from `git blame --line-porcelain`,
 * run from `cwd` against `file`. Pass `rev` (e.g. "HEAD") to blame a committed
 * revision instead of the working tree.
 */
export function blameAuthors(cwd: string, file: string, rev?: string): Map<number, string> {
  const args = ["blame", "--line-porcelain", ...(rev ? [rev] : []), "--", file];
  const authors = new Map<number, string>();
  let current = 0;
  for (const line of git(cwd, args).split("\n")) {
    const header = line.match(/^[0-9a-f]{40}\s+\d+\s+(\d+)/);
    if (header && header[1]) current = Number.parseInt(header[1], 10);
    else if (line.startsWith("author ")) authors.set(current, line.slice("author ".length).trim());
  }
  return authors;
}

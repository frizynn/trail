import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export interface Vault {
  /** Absolute path to the `.trail/` directory. */
  root: string;
}

export const VAULT_DIRS = ["WIP", "DONE", "PAUSED", "Decisions", "Research", "Log"] as const;
export const HOT_FILE = "_hot.md";
export const LOCKS_DIR = ".locks";
export const OBSIDIAN_DIR = ".obsidian";

/**
 * Resolve the `.trail/` directory:
 *   1. $TRAIL_VAULT
 *   2. nearest existing `.trail/` walking up from cwd
 *   3. `<git-root>/.trail/`
 *   4. `./.trail/`
 */
export function resolveVaultRoot(cwd = process.cwd()): string {
  const fromEnv = process.env["TRAIL_VAULT"];
  if (fromEnv) return resolve(fromEnv);

  const existing = walkUpForTrail(cwd);
  if (existing) return existing;

  const gitRoot = findGitRoot(cwd);
  if (gitRoot) return join(gitRoot, ".trail");

  return join(cwd, ".trail");
}

/** Resolve the vault and assert it has been initialized. */
export function requireVault(cwd = process.cwd()): Vault {
  const root = resolveVaultRoot(cwd);
  if (!isInitialized(root)) {
    throw new Error(`no trail vault found at ${root}\n  run 'trail init' first`);
  }
  return { root };
}

export function isInitialized(root: string): boolean {
  return existsSync(join(root, HOT_FILE)) && isDir(join(root, "WIP"));
}

export function vaultPaths(root: string) {
  return {
    root,
    hot: join(root, HOT_FILE),
    locks: join(root, LOCKS_DIR),
    obsidian: join(root, OBSIDIAN_DIR),
    wip: join(root, "WIP"),
    done: join(root, "DONE"),
    paused: join(root, "PAUSED"),
    decisions: join(root, "Decisions"),
    research: join(root, "Research"),
    log: join(root, "Log"),
  };
}

function walkUpForTrail(start: string): string | undefined {
  let dir = resolve(start);
  for (;;) {
    const candidate = join(dir, ".trail");
    if (isDir(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

function findGitRoot(cwd: string): string | undefined {
  try {
    const root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return root || undefined;
  } catch {
    return undefined;
  }
}

function isDir(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

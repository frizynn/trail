import { closeSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, statSync, writeFileSync, writeSync } from "node:fs";
import { dirname, join } from "node:path";

import { resolveAgent, resolveAuthor } from "./provenance.ts";

export const LOCK_TTL_MS = 30 * 60 * 1000;

export interface LockInfo {
  author: string;
  agent: string;
  pid: number;
  ts: string;
}

export interface ClaimResult {
  acquired: boolean;
  /** Set when the claim was refused: the fresh lock currently held by someone else. */
  heldBy?: LockInfo;
  /** Set when a stale lock was stolen. */
  stole?: LockInfo;
}

/** Append a single chunk with O_APPEND, atomic across processes for writes under ~4 KB. */
export function appendAtomic(filePath: string, chunk: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
  const fd = openSync(filePath, "a");
  try {
    writeSync(fd, chunk);
  } finally {
    closeSync(fd);
  }
}

/** Write a full file via temp + rename so readers never observe a partial write. */
export function writeAtomic(filePath: string, content: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tmp, content);
  renameSync(tmp, filePath);
}

/**
 * Claim a slug via `mkdir` (atomic create-if-not-exists). A fresh foreign lock
 * refuses the claim; a stale one is stolen. Re-claiming your own lock succeeds.
 */
export function claim(locksDir: string, slug: string): ClaimResult {
  const lockDir = join(locksDir, slug);
  const info: LockInfo = {
    author: resolveAuthor(),
    agent: resolveAgent(),
    pid: process.pid,
    ts: new Date().toISOString(),
  };

  try {
    mkdirSync(lockDir, { recursive: false });
    writeFileSync(join(lockDir, "lock.json"), JSON.stringify(info, null, 2));
    return { acquired: true };
  } catch (error) {
    if (!isEexist(error)) throw error;
  }

  const existing = readLock(lockDir);
  if (existing && isFresh(existing) && !isSameOwner(existing, info)) {
    return { acquired: false, heldBy: existing };
  }

  // Stale or our own: take it over.
  const stole = existing && !isSameOwner(existing, info) ? existing : undefined;
  writeFileSync(join(lockDir, "lock.json"), JSON.stringify(info, null, 2));
  return { acquired: true, ...(stole ? { stole } : {}) };
}

export function release(locksDir: string, slug: string): void {
  rmSync(join(locksDir, slug), { recursive: true, force: true });
}

export function readLock(lockDir: string): LockInfo | undefined {
  try {
    const raw = readFileSync(join(lockDir, "lock.json"), "utf8");
    const parsed = JSON.parse(raw) as Partial<LockInfo>;
    if (typeof parsed.author === "string" && typeof parsed.agent === "string" && typeof parsed.ts === "string") {
      return { author: parsed.author, agent: parsed.agent, pid: parsed.pid ?? 0, ts: parsed.ts };
    }
  } catch {
    // Missing or corrupt lock metadata: treat as no usable lock.
  }
  return undefined;
}

/** Read the lock for a slug, if one is held. */
export function peekLock(locksDir: string, slug: string): LockInfo | undefined {
  return readLock(join(locksDir, slug));
}

export function lockExists(locksDir: string, slug: string): boolean {
  try {
    return statSync(join(locksDir, slug)).isDirectory();
  } catch {
    return false;
  }
}

function isFresh(info: LockInfo): boolean {
  const age = Date.now() - new Date(info.ts).getTime();
  return Number.isFinite(age) && age < LOCK_TTL_MS;
}

function isSameOwner(a: LockInfo, b: LockInfo): boolean {
  return a.author === b.author && a.agent === b.agent;
}

function isEexist(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as NodeJS.ErrnoException).code === "EEXIST";
}

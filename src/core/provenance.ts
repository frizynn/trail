import { userInfo } from "node:os";

import { git } from "./git.ts";

export type Agent = "cli" | "claude-code" | "codex" | "cursor";

let cachedAuthor: string | undefined;
let cachedAgent: Agent | undefined;

/** The human responsible: `git config user.name`, falling back to $USER / OS username. */
export function resolveAuthor(): string {
  if (cachedAuthor !== undefined) return cachedAuthor;
  return (cachedAuthor = computeAuthor());
}

function computeAuthor(): string {
  const name = git(process.cwd(), ["config", "user.name"]).trim();
  if (name) return name;

  const envUser = process.env["USER"] ?? process.env["USERNAME"];
  if (envUser) return envUser;

  try {
    return userInfo().username;
  } catch {
    return "unknown";
  }
}

/** The tool that physically wrote the file. TRAIL_AGENT overrides detection. */
export function resolveAgent(): Agent {
  if (cachedAgent !== undefined) return cachedAgent;
  return (cachedAgent = computeAgent());
}

function computeAgent(): Agent {
  const explicit = process.env["TRAIL_AGENT"];
  if (explicit === "claude-code" || explicit === "codex" || explicit === "cursor" || explicit === "cli") {
    return explicit;
  }

  if (process.env["CLAUDECODE"] || process.env["CLAUDE_CODE"]) return "claude-code";
  if (process.env["CODEX_SANDBOX"] || process.env["CODEX_HOME"]) return "codex";
  if (process.env["CURSOR_TRACE_ID"] || process.env["CURSOR"]) return "cursor";

  return "cli";
}

/** Today's date as ISO `YYYY-MM-DD` in local time. */
export function today(): string {
  const now = new Date();
  return formatDate(now);
}

/** Current time as `HH:MM` 24h in local time. */
export function now(): string {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

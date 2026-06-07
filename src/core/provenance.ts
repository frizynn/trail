import { execFileSync } from "node:child_process";
import { userInfo } from "node:os";

export type Agent = "cli" | "claude-code" | "codex" | "cursor";

/** The human responsible: `git config user.name`, falling back to $USER / OS username. */
export function resolveAuthor(): string {
  try {
    const name = execFileSync("git", ["config", "user.name"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (name) return name;
  } catch {
    // git missing or no user.name configured; fall through.
  }

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

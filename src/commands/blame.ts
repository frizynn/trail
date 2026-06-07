import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, relative } from "node:path";

import { bold, cyan, dim, info } from "../core/ui.ts";
import { requireVault } from "../core/vault.ts";

import { findNote, TrailError } from "./shared.ts";

interface TimelineLine {
  lineNo: number;
  time: string;
  author: string;
  agent: string;
  text: string;
}

const STAMP = /^-\s+(\d{2}:\d{2})\s+·\s+([^·]+?)\s+·\s+(\S+)\s+(.+\S)\s*$/;

export function blame(args: string[]): void {
  const useGit = args.includes("--git");
  const slug = args.find((a) => !a.startsWith("--"));
  if (!slug) throw new TrailError("usage: trail blame <slug> [--git]");

  const { root } = requireVault();
  const file = findNote(root, slug);
  if (!file) throw new TrailError(`no note found for slug '${slug}'`);

  const lines = readFileSync(file, "utf8").split("\n");
  const entries = parseTimeline(lines);

  info(bold(`blame ${cyan(slug)}  ${dim(relative(root, file))}`));
  if (entries.length === 0) {
    info(dim("  no timeline entries"));
    return;
  }

  const gitAuthors = useGit ? gitBlameAuthors(file) : undefined;
  for (const entry of entries) {
    const committer = gitAuthors?.get(entry.lineNo);
    const gitNote = committer ? `  ${dim(`[git: ${committer}]`)}` : "";
    info(`  ${dim(entry.time)} ${entry.author} ${dim(`(${entry.agent})`)}  ${entry.text}${gitNote}`);
  }
}

function parseTimeline(lines: string[]): TimelineLine[] {
  const entries: TimelineLine[] = [];
  lines.forEach((line, i) => {
    const match = line.match(STAMP);
    if (match && match[1] && match[2] && match[3] && match[4]) {
      entries.push({
        lineNo: i + 1,
        time: match[1],
        author: match[2],
        agent: match[3],
        text: match[4],
      });
    }
  });
  return entries;
}

/** Map 1-based line number → committing author, from `git blame --line-porcelain`. */
function gitBlameAuthors(file: string): Map<number, string> {
  const result = new Map<number, string>();
  try {
    const out = execFileSync("git", ["blame", "--line-porcelain", file], {
      cwd: dirname(file),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    let currentLine = 0;
    for (const line of out.split("\n")) {
      const header = line.match(/^[0-9a-f]{40}\s+\d+\s+(\d+)/);
      if (header && header[1]) currentLine = Number.parseInt(header[1], 10);
      else if (line.startsWith("author ")) result.set(currentLine, line.slice("author ".length).trim());
    }
  } catch {
    // Not committed yet, or not a git repo: skip the git cross-reference silently.
  }
  return result;
}

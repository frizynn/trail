import { readFileSync } from "node:fs";
import { dirname, relative } from "node:path";

import { blameAuthors } from "../core/git.ts";
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

  const gitAuthors = useGit ? blameAuthors(dirname(file), file) : undefined;
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

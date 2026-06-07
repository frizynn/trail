import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { bold, cyan, dim, hi, info } from "../core/ui.ts";
import { requireVault } from "../core/vault.ts";

import { TrailError } from "./shared.ts";

export function search(args: string[]): void {
  const term = args.join(" ").trim();
  if (!term) throw new TrailError("usage: trail search <term>");

  const { root } = requireVault();
  const needle = term.toLowerCase();
  let matches = 0;

  for (const file of markdownFiles(root)) {
    const lines = readFileSync(file, "utf8").split("\n");
    const rel = relative(root, file);
    let headerShown = false;
    lines.forEach((line, i) => {
      if (!line.toLowerCase().includes(needle)) return;
      if (!headerShown) {
        info(bold(cyan(rel)));
        headerShown = true;
      }
      matches++;
      info(`  ${dim(`${i + 1}:`)} ${highlight(line, term)}`);
    });
  }

  if (matches === 0) info(dim(`no matches for "${term}"`));
}

/** Trim the line and wrap each case-insensitive match of `term` in a highlight. */
function highlight(line: string, term: string): string {
  const trimmed = line.trim();
  const lower = trimmed.toLowerCase();
  const needle = term.toLowerCase();
  let out = "";
  let from = 0;
  for (;;) {
    const idx = lower.indexOf(needle, from);
    if (idx === -1) {
      out += trimmed.slice(from);
      return out;
    }
    out += trimmed.slice(from, idx) + hi(trimmed.slice(idx, idx + term.length));
    from = idx + term.length;
  }
}

/** Walk the vault for `.md` files, skipping `.locks/` and `.obsidian/`. */
function markdownFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      if (name === ".locks" || name === ".obsidian") continue;
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name.endsWith(".md")) out.push(full);
    }
  };
  if (existsSync(root)) walk(root);
  return out.sort();
}

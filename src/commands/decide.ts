import { existsSync } from "node:fs";
import { join } from "node:path";

import { writeAtomic } from "../core/atomic.ts";
import { resolveAgent, resolveAuthor, today } from "../core/provenance.ts";
import { slugify } from "../core/slug.ts";
import { decisionTemplate } from "../core/templates.ts";
import { dim, info, ok } from "../core/ui.ts";
import { requireVault, vaultPaths } from "../core/vault.ts";

import { appendLog, refreshHotAndWarn, TrailError } from "./shared.ts";

export function decide(args: string[]): void {
  const { positionals, ticket } = parse(args);
  const title = positionals.join(" ").trim();
  if (!title) throw new TrailError("usage: trail decide <title> [--ticket ID]");

  const slug = slugify(title);
  if (!slug) throw new TrailError(`could not derive a slug from "${title}"`);

  const { root } = requireVault();
  const paths = vaultPaths(root);
  const name = `${today()}-${slug}.md`;
  const file = join(paths.decisions, name);

  if (existsSync(file)) {
    throw new TrailError(`decision already exists at Decisions/${name}`);
  }

  const content = decisionTemplate({
    title,
    slug,
    author: resolveAuthor(),
    agent: resolveAgent(),
    created: today(),
    ...(ticket ? { ticket } : {}),
  });

  writeAtomic(file, content);
  appendLog(root, `decided [[Decisions/${today()}-${slug}|${title}]]`);
  refreshHotAndWarn(root);

  ok(`decision recorded`);
  info(dim(`  Decisions/${name}`));
}

function parse(args: string[]): { positionals: string[]; ticket?: string } {
  const positionals: string[] = [];
  let ticket: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--ticket") ticket = args[++i];
    else if (arg !== undefined) positionals.push(arg);
  }
  return { positionals, ...(ticket ? { ticket } : {}) };
}

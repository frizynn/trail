import { existsSync } from "node:fs";
import { join } from "node:path";

import { claim, writeAtomic } from "../core/atomic.ts";
import { now, resolveAgent, resolveAuthor, today } from "../core/provenance.ts";
import { slugify } from "../core/slug.ts";
import { taskTemplate } from "../core/templates.ts";
import { dim, info, ok } from "../core/ui.ts";
import { requireVault, vaultPaths } from "../core/vault.ts";

import { appendLog, refreshHotAndWarn, TrailError } from "./shared.ts";

export function task(args: string[]): void {
  const { positionals, options } = parse(args);
  const title = positionals.join(" ").trim();
  if (!title) throw new TrailError("usage: trail task <title> [--ticket ID] [--tags a,b]");

  const slug = slugify(title);
  if (!slug) throw new TrailError(`could not derive a slug from "${title}"`);

  const { root } = requireVault();
  const paths = vaultPaths(root);
  const file = join(paths.wip, `${slug}.md`);

  if (existsSync(file)) {
    throw new TrailError(`task '${slug}' already exists at WIP/${slug}.md`);
  }

  const result = claim(paths.locks, slug);
  if (!result.acquired && result.heldBy) {
    throw new TrailError(
      `task '${slug}' is claimed by ${result.heldBy.author} (${result.heldBy.agent}) since ${result.heldBy.ts}`,
    );
  }

  const tags = options.tags?.split(",").map((t) => t.trim()).filter(Boolean);
  const content = taskTemplate({
    title,
    slug,
    author: resolveAuthor(),
    agent: resolveAgent(),
    created: today(),
    ...(options.ticket ? { ticket: options.ticket } : {}),
    ...(tags && tags.length ? { tags } : {}),
  });

  writeAtomic(file, content);
  appendLog(root, `started task [[WIP/${slug}]]`);
  refreshHotAndWarn(root);

  ok(`task ${slug} created and claimed`);
  info(dim(`  WIP/${slug}.md · ${now()} · ${resolveAuthor()}`));
}

interface ParsedArgs {
  positionals: string[];
  options: { ticket?: string; tags?: string };
}

function parse(args: string[]): ParsedArgs {
  const positionals: string[] = [];
  const options: ParsedArgs["options"] = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--ticket") options.ticket = args[++i];
    else if (arg === "--tags") options.tags = args[++i];
    else if (arg !== undefined) positionals.push(arg);
  }
  return { positionals, options };
}

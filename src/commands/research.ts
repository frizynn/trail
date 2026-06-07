import { existsSync } from "node:fs";
import { join } from "node:path";

import { writeAtomic } from "../core/atomic.ts";
import { resolveAgent, resolveAuthor, today } from "../core/provenance.ts";
import { slugify } from "../core/slug.ts";
import { researchTemplate } from "../core/templates.ts";
import { dim, info, ok } from "../core/ui.ts";
import { requireVault, vaultPaths } from "../core/vault.ts";

import { appendLog, refreshHotAndWarn, TrailError } from "./shared.ts";

export function research(args: string[]): void {
  const title = args.join(" ").trim();
  if (!title) throw new TrailError("usage: trail research <title>");

  const slug = slugify(title);
  if (!slug) throw new TrailError(`could not derive a slug from "${title}"`);

  const { root } = requireVault();
  const paths = vaultPaths(root);
  const file = join(paths.research, `${slug}.md`);

  if (existsSync(file)) {
    throw new TrailError(`research already exists at Research/${slug}.md`);
  }

  const content = researchTemplate({
    title,
    slug,
    author: resolveAuthor(),
    agent: resolveAgent(),
    created: today(),
  });

  writeAtomic(file, content);
  appendLog(root, `research [[Research/${slug}|${title}]]`);
  refreshHotAndWarn(root);

  ok(`research note created`);
  info(dim(`  Research/${slug}.md`));
}

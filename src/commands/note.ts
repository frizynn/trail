import { existsSync } from "node:fs";
import { join } from "node:path";

import { now, resolveAgent, resolveAuthor } from "../core/provenance.ts";
import { dim, info, ok } from "../core/ui.ts";
import { requireVault, vaultPaths } from "../core/vault.ts";

import { appendTimeline, refreshHotAndWarn, TrailError } from "./shared.ts";

export function note(args: string[]): void {
  const slug = args[0];
  const text = args.slice(1).join(" ").trim();
  if (!slug || !text) throw new TrailError("usage: trail note <slug> <text>");

  const { root } = requireVault();
  const paths = vaultPaths(root);
  const file = join(paths.wip, `${slug}.md`);
  if (!existsSync(file)) {
    throw new TrailError(`no active task '${slug}' in WIP/ (use 'trail list' to see active tasks)`);
  }

  appendTimeline(file, text);
  refreshHotAndWarn(root);

  ok(`noted on ${slug}`);
  info(dim(`  ${now()} · ${resolveAuthor()} · ${resolveAgent()}`));
}

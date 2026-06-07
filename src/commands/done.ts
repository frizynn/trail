import { existsSync, renameSync } from "node:fs";
import { join } from "node:path";

import { release } from "../core/atomic.ts";
import { ok } from "../core/ui.ts";
import { requireVault, vaultPaths } from "../core/vault.ts";

import { appendLog, appendTimeline, refreshHotAndWarn, TrailError, updateFrontmatter } from "./shared.ts";

export function done(args: string[]): void {
  const slug = args[0];
  if (!slug) throw new TrailError("usage: trail done <slug>");

  const { root } = requireVault();
  const paths = vaultPaths(root);
  const src = join(paths.wip, `${slug}.md`);
  if (!existsSync(src)) {
    throw new TrailError(`no active task '${slug}' in WIP/`);
  }

  appendTimeline(src, "done");
  updateFrontmatter(src, (fm) => {
    fm.status = "done";
  });

  const dest = join(paths.done, `${slug}.md`);
  renameSync(src, dest);
  release(paths.locks, slug);

  appendLog(root, `done [[DONE/${slug}]]`);
  refreshHotAndWarn(root);

  ok(`task ${slug} done → DONE/${slug}.md`);
}

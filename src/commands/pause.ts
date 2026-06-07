import { existsSync, renameSync } from "node:fs";
import { join } from "node:path";

import { release } from "../core/atomic.ts";
import { ok } from "../core/ui.ts";
import { requireVault, vaultPaths } from "../core/vault.ts";

import { appendLog, appendTimeline, refreshHotAndWarn, TrailError, updateFrontmatter } from "./shared.ts";

export function pause(args: string[]): void {
  const slug = args[0];
  const reason = args.slice(1).join(" ").trim();
  if (!slug || !reason) throw new TrailError("usage: trail pause <slug> <reason>");

  const { root } = requireVault();
  const paths = vaultPaths(root);
  const src = join(paths.wip, `${slug}.md`);
  if (!existsSync(src)) {
    throw new TrailError(`no active task '${slug}' in WIP/`);
  }

  appendTimeline(src, `paused: ${reason}`);
  updateFrontmatter(src, (fm) => {
    fm.status = "paused";
  });

  const dest = join(paths.paused, `${slug}.md`);
  renameSync(src, dest);
  release(paths.locks, slug);

  appendLog(root, `paused [[PAUSED/${slug}]]: ${reason}`);
  refreshHotAndWarn(root);

  ok(`task ${slug} paused → PAUSED/${slug}.md`);
}

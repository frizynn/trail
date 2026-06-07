import { relative } from "node:path";

import { dim, info, ok } from "../core/ui.ts";
import { requireVault } from "../core/vault.ts";

import { findNote, refreshHotAndWarn, TrailError, updateFrontmatter } from "./shared.ts";

export function link(args: string[]): void {
  const slug = args[0];
  const ticket = args[1];
  if (!slug || !ticket) throw new TrailError("usage: trail link <slug> <ticket>");

  const { root } = requireVault();
  const file = findNote(root, slug);
  if (!file) throw new TrailError(`no note found for slug '${slug}'`);

  updateFrontmatter(file, (fm) => {
    fm.ticket = ticket;
  });
  refreshHotAndWarn(root);

  ok(`linked ${slug} → ${ticket}`);
  info(dim(`  ${relative(root, file)}`));
}

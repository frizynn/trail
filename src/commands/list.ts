import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { parseNote } from "../core/frontmatter.ts";
import { bold, cyan, dim, info } from "../core/ui.ts";
import { requireVault, vaultPaths } from "../core/vault.ts";

export function list(): void {
  const { root } = requireVault();
  const paths = vaultPaths(root);

  const files = existsSync(paths.wip)
    ? readdirSync(paths.wip).filter((n) => n.endsWith(".md")).sort()
    : [];
  if (files.length === 0) {
    info(dim("no active tasks"));
    return;
  }

  info(bold(`active tasks (${files.length})`));
  for (const file of files) {
    const slug = file.replace(/\.md$/, "");
    const { frontmatter } = parseNote(readFileSync(join(paths.wip, file), "utf8"));
    const ticket = frontmatter.ticket ? ` ${dim(`(${frontmatter.ticket})`)}` : "";
    info(`  ${cyan(slug)}${ticket}`);
  }
}

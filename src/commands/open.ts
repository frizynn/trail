import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { OBSIDIAN_FILES } from "../core/templates.ts";
import { dim, info, ok } from "../core/ui.ts";
import { requireVault, vaultPaths } from "../core/vault.ts";

/** Open `.trail/` as an Obsidian vault, materializing `.obsidian/` if it is missing. */
export function open(): void {
  const { root } = requireVault();
  const paths = vaultPaths(root);

  materializeObsidian(paths.obsidian);

  const uri = `obsidian://open?path=${encodeURIComponent(root)}`;
  const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", uri] : [uri];

  const child = spawn(opener, args, { stdio: "ignore", detached: true });
  child.on("error", () => {
    info(dim(`could not launch ${opener}. Open this URI manually:`));
    info(`  ${uri}`);
  });
  child.unref();

  ok(`opening ${dim(root)} in Obsidian`);
  info(dim(`  ${uri}`));
}

function materializeObsidian(obsidianDir: string): void {
  mkdirSync(obsidianDir, { recursive: true });
  for (const [name, content] of Object.entries(OBSIDIAN_FILES)) {
    const target = join(obsidianDir, name);
    if (!existsSync(target)) writeFileSync(target, content);
  }
}

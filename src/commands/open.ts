import { spawn } from "node:child_process";

import { dim, info, ok } from "../core/ui.ts";
import { requireVault } from "../core/vault.ts";

/** Open `.trail/` in Obsidian. Obsidian creates its own `.obsidian/` on first open. */
export function open(): void {
  const { root } = requireVault();

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

import { existsSync, readFileSync } from "node:fs";

import { requireVault, vaultPaths } from "../core/vault.ts";

import { TrailError } from "./shared.ts";

/** Print `_hot.md` verbatim (plain stdout, so agents can pipe it). */
export function hot(): void {
  const { root } = requireVault();
  const paths = vaultPaths(root);
  if (!existsSync(paths.hot)) {
    throw new TrailError(`no _hot.md at ${paths.hot} (run 'trail init')`);
  }
  process.stdout.write(readFileSync(paths.hot, "utf8"));
}

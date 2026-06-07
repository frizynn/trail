import { today } from "../core/provenance.ts";
import { dim, info, ok } from "../core/ui.ts";
import { requireVault } from "../core/vault.ts";

import { appendLog, TrailError } from "./shared.ts";

export function log(args: string[]): void {
  const text = args.join(" ").trim();
  if (!text) throw new TrailError("usage: trail log <text>");

  const { root } = requireVault();
  appendLog(root, text);

  ok("logged");
  info(dim(`  Log/${today()}.md`));
}

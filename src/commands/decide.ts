import { join } from "node:path";

import { resolveAgent, resolveAuthor, today } from "../core/provenance.ts";
import { decisionTemplate } from "../core/templates.ts";
import { vaultPaths } from "../core/vault.ts";

import { createNote, parseFlags } from "./shared.ts";

export function decide(args: string[]): void {
  const { positionals, flags } = parseFlags(args, ["ticket"]);
  const title = positionals.join(" ").trim();

  createNote(title, "usage: trail decide <title> [--ticket ID]", (slug, root) => {
    const name = `${today()}-${slug}.md`;
    const content = decisionTemplate({
      title,
      slug,
      author: resolveAuthor(),
      agent: resolveAgent(),
      created: today(),
      ...(flags["ticket"] ? { ticket: flags["ticket"] } : {}),
    });
    return {
      file: join(vaultPaths(root).decisions, name),
      rel: `Decisions/${name}`,
      content,
      logText: `decided [[Decisions/${today()}-${slug}|${title}]]`,
      okMessage: "decision recorded",
    };
  });
}

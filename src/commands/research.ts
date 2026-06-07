import { join } from "node:path";

import { resolveAgent, resolveAuthor, today } from "../core/provenance.ts";
import { researchTemplate } from "../core/templates.ts";
import { vaultPaths } from "../core/vault.ts";

import { createNote } from "./shared.ts";

export function research(args: string[]): void {
  const title = args.join(" ").trim();

  createNote(title, "usage: trail research <title>", (slug, root) => {
    const content = researchTemplate({
      title,
      slug,
      author: resolveAuthor(),
      agent: resolveAgent(),
      created: today(),
    });
    return {
      file: join(vaultPaths(root).research, `${slug}.md`),
      rel: `Research/${slug}.md`,
      content,
      logText: `research [[Research/${slug}|${title}]]`,
      okMessage: "research note created",
    };
  });
}

import { join } from "node:path";

import { resolveAgent, resolveAuthor, today } from "../core/provenance.ts";
import { taskTemplate } from "../core/templates.ts";
import { vaultPaths } from "../core/vault.ts";

import { createNote, parseFlags } from "./shared.ts";

export function task(args: string[]): void {
  const { positionals, flags } = parseFlags(args, ["ticket", "tags"]);
  const title = positionals.join(" ").trim();
  const tags = flags["tags"]?.split(",").map((t) => t.trim()).filter(Boolean);

  createNote(title, "usage: trail task <title> [--ticket ID] [--tags a,b]", (slug, root) => {
    const content = taskTemplate({
      title,
      slug,
      author: resolveAuthor(),
      agent: resolveAgent(),
      created: today(),
      ...(flags["ticket"] ? { ticket: flags["ticket"] } : {}),
      ...(tags && tags.length ? { tags } : {}),
    });
    return {
      file: join(vaultPaths(root).wip, `${slug}.md`),
      rel: `WIP/${slug}.md`,
      content,
      logText: `started task [[WIP/${slug}]]`,
      okMessage: `task ${slug} created`,
    };
  });
}

import { closeTask, TrailError } from "./shared.ts";

export function done(args: string[]): void {
  const slug = args[0];
  if (!slug) throw new TrailError("usage: trail done <slug>");

  closeTask({
    slug,
    status: "done",
    dest: "done",
    timelineText: "done",
    logLabel: `done [[DONE/${slug}]]`,
    okMessage: `task ${slug} done → DONE/${slug}.md`,
  });
}

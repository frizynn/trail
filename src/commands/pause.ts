import { closeTask, TrailError } from "./shared.ts";

export function pause(args: string[]): void {
  const slug = args[0];
  const reason = args.slice(1).join(" ").trim();
  if (!slug || !reason) throw new TrailError("usage: trail pause <slug> <reason>");

  closeTask({
    slug,
    status: "paused",
    dest: "paused",
    timelineText: `paused: ${reason}`,
    logLabel: `paused [[PAUSED/${slug}]]: ${reason}`,
    okMessage: `task ${slug} paused → PAUSED/${slug}.md`,
  });
}

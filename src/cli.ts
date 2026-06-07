#!/usr/bin/env bun
import { blame } from "./commands/blame.ts";
import { check } from "./commands/check.ts";
import { decide } from "./commands/decide.ts";
import { done } from "./commands/done.ts";
import { hot } from "./commands/hot.ts";
import { init } from "./commands/init.ts";
import { link } from "./commands/link.ts";
import { list } from "./commands/list.ts";
import { log } from "./commands/log.ts";
import { note } from "./commands/note.ts";
import { open } from "./commands/open.ts";
import { pause } from "./commands/pause.ts";
import { research } from "./commands/research.ts";
import { search } from "./commands/search.ts";
import { TrailError } from "./commands/shared.ts";
import { task } from "./commands/task.ts";
import { bold, cyan, dim, err, info } from "./core/ui.ts";

const VERSION = "0.1.0";

interface Command {
  name: string;
  group: string;
  usage: string;
  summary: string;
  /** Run the command. Return an exit code, or void for success (0). */
  run: (args: string[]) => number | void;
}

/** The single source of truth: dispatch and grouped `--help` both derive from this. */
const COMMANDS: Command[] = [
  { name: "init", group: "Setup", usage: "init [--with-hook]", summary: "scaffold .trail/, write the AGENTS.md pointer, generate .obsidian/", run: init },
  { name: "task", group: "Capture", usage: "task <title> [--ticket ID] [--tags a,b]", summary: "start a task, refresh _hot", run: task },
  { name: "note", group: "Capture", usage: "note <slug> <text>", summary: "append a stamped line to a task's timeline", run: note },
  { name: "decide", group: "Capture", usage: "decide <title> [--ticket ID]", summary: "record a decision (ADR-style)", run: decide },
  { name: "research", group: "Capture", usage: "research <title>", summary: "create a research note", run: research },
  { name: "log", group: "Capture", usage: "log <text>", summary: "append a line to today's log", run: log },
  { name: "link", group: "Capture", usage: "link <slug> <ticket>", summary: "set the ticket on a note", run: link },
  { name: "done", group: "Lifecycle", usage: "done <slug>", summary: "mark done, move to DONE/", run: done },
  { name: "pause", group: "Lifecycle", usage: "pause <slug> <reason>", summary: "park a task, move to PAUSED/", run: pause },
  { name: "list", group: "Read", usage: "list", summary: "list active tasks", run: list },
  { name: "hot", group: "Read", usage: "hot", summary: "print _hot.md", run: hot },
  { name: "search", group: "Read", usage: "search <term>", summary: "search across the vault", run: search },
  { name: "blame", group: "Read", usage: "blame <slug> [--git]", summary: "show timeline provenance per entry", run: blame },
  { name: "check", group: "Guardrails", usage: "check", summary: "enforce append-only + budget (exit !=0 on violations, for CI)", run: check },
  { name: "open", group: "Obsidian", usage: "open", summary: "open .trail/ in Obsidian", run: open },
];

function main(argv: string[]): number {
  const [name, ...rest] = argv;

  if (!name || name === "--help" || name === "-h" || name === "help") {
    printHelp();
    return 0;
  }
  if (name === "--version" || name === "-v" || name === "version") {
    info(`trail ${VERSION}`);
    return 0;
  }

  const command = COMMANDS.find((c) => c.name === name);
  if (!command) {
    err(`unknown command: ${name}`);
    info(dim("run 'trail --help' for usage"));
    return 1;
  }

  return command.run(rest) ?? 0;
}

function printHelp(): void {
  info(`${bold("trail")} ${dim(VERSION)} — shared, append-only memory for teams and their AI agents`);
  info("");
  info(`${dim("usage:")} trail <command> [args]`);

  const width = Math.max(...COMMANDS.map((c) => c.usage.length));
  let lastGroup = "";
  for (const command of COMMANDS) {
    if (command.group !== lastGroup) {
      info("");
      info(bold(command.group));
      lastGroup = command.group;
    }
    info(`  ${cyan(command.usage.padEnd(width))}  ${dim(command.summary)}`);
  }

  info("");
  info(dim("env: TRAIL_VAULT, TRAIL_AGENT, TRAIL_HOT_BUDGET, NO_COLOR"));
}

try {
  process.exit(main(process.argv.slice(2)));
} catch (error: unknown) {
  err(error instanceof TrailError ? error.message : error instanceof Error ? error.message : String(error));
  process.exit(1);
}

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

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;

  if (!command || command === "--help" || command === "-h" || command === "help") {
    printHelp();
    return 0;
  }
  if (command === "--version" || command === "-v" || command === "version") {
    info(`trail ${VERSION}`);
    return 0;
  }

  switch (command) {
    case "init":
      init(rest);
      return 0;
    case "task":
      task(rest);
      return 0;
    case "note":
      note(rest);
      return 0;
    case "decide":
      decide(rest);
      return 0;
    case "research":
      research(rest);
      return 0;
    case "log":
      log(rest);
      return 0;
    case "link":
      link(rest);
      return 0;
    case "done":
      done(rest);
      return 0;
    case "pause":
      pause(rest);
      return 0;
    case "list":
      list();
      return 0;
    case "hot":
      hot();
      return 0;
    case "search":
      search(rest);
      return 0;
    case "blame":
      blame(rest);
      return 0;
    case "check":
      return check();
    case "open":
      open();
      return 0;
    default:
      err(`unknown command: ${command}`);
      info(dim("run 'trail --help' for usage"));
      return 1;
  }
}

interface HelpGroup {
  title: string;
  rows: [string, string][];
}

const HELP_GROUPS: HelpGroup[] = [
  {
    title: "Setup",
    rows: [["init [--with-hook]", "scaffold .trail/, write the AGENTS.md pointer, generate .obsidian/"]],
  },
  {
    title: "Capture",
    rows: [
      ["task <title> [--ticket ID] [--tags a,b]", "start a task, claim it, refresh _hot"],
      ["note <slug> <text>", "append a stamped line to a task's timeline"],
      ["decide <title> [--ticket ID]", "record a decision (ADR-style)"],
      ["research <title>", "create a research note"],
      ["log <text>", "append a line to today's log"],
      ["link <slug> <ticket>", "set the ticket on a note"],
    ],
  },
  {
    title: "Lifecycle",
    rows: [
      ["done <slug>", "mark done, move to DONE/, release the claim"],
      ["pause <slug> <reason>", "park a task, move to PAUSED/"],
    ],
  },
  {
    title: "Read",
    rows: [
      ["list", "list active tasks"],
      ["hot", "print _hot.md"],
      ["search <term>", "search across the vault"],
      ["blame <slug> [--git]", "show timeline provenance per entry"],
    ],
  },
  {
    title: "Guardrails",
    rows: [["check", "enforce append-only + budget (exit !=0 on violations, for CI)"]],
  },
  {
    title: "Obsidian",
    rows: [["open", "open .trail/ in Obsidian"]],
  },
];

function printHelp(): void {
  info(`${bold("trail")} ${dim(VERSION)} — shared, append-only memory for teams and their AI agents`);
  info("");
  info(`${dim("usage:")} trail <command> [args]`);

  const width = Math.max(...HELP_GROUPS.flatMap((g) => g.rows.map(([cmd]) => cmd.length)));
  for (const group of HELP_GROUPS) {
    info("");
    info(bold(group.title));
    for (const [cmd, desc] of group.rows) {
      info(`  ${cyan(cmd.padEnd(width))}  ${dim(desc)}`);
    }
  }

  info("");
  info(dim("env: TRAIL_VAULT, TRAIL_AGENT, TRAIL_HOT_BUDGET, NO_COLOR"));
}

main(process.argv.slice(2))
  .then((code) => {
    process.exit(code);
  })
  .catch((error: unknown) => {
    if (error instanceof TrailError) {
      err(error.message);
    } else {
      err(error instanceof Error ? error.message : String(error));
    }
    process.exit(1);
  });

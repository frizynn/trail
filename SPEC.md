# trail specification

The convention is the product. The CLI is just a safe, ergonomic way to follow it.
This document is the source of truth. Keep it small.

## 1. The vault

A vault is a directory named `.trail/` containing Markdown files. **It is a valid
Obsidian vault as-is.** Obsidian and the CLI read and write the same files on disk.

Vault resolution (the CLI walks up from the current directory):

1. If `TRAIL_VAULT` is set, use it.
2. Else, walk up from `cwd` looking for an existing `.trail/` directory.
3. Else, if inside a git repo, use `<git-root>/.trail/`.
4. Else, use `./.trail/`.

```
.trail/
├── _hot.md          # live cache, regenerated on writes, always under 400 words
├── WIP/             # active tasks, one .md per task
├── DONE/            # completed tasks (moved from WIP/)
├── PAUSED/          # parked tasks (moved from WIP/)
├── Decisions/       # YYYY-MM-DD-<slug>.md
├── Research/        # <slug>.md
├── Log/             # YYYY-MM-DD.md (one per day)
└── .obsidian/       # created by Obsidian on first open (gitignored)
```

## 2. Frontmatter

Flat YAML, string values only, so it parses trivially with no dependency. Every note
carries provenance. Dates are ISO (`YYYY-MM-DD`), times are `HH:MM` 24h.

```yaml
---
type: task            # task | decision | research
status: wip           # wip | done | paused  (tasks only)
slug: auth-multi-tenant
author: Francisco     # the human responsible (from `git config user.name`)
agent: claude-code     # who physically wrote it: cli | claude-code | codex | cursor
created: 2026-06-07
ticket: LIN-1234       # optional link to the external tracker (id or url)
tags: [auth, backend]
---
```

**Provenance rule:** `author` is always a human, for accountability. `agent` is the tool
that wrote the file (`cli` when a human ran the command directly). Both are required.

## 3. Concurrency: no daemon, ever

All synchronous. The CLI does the op and exits, the same way `git` does.

1. **Design.** One task, one file. Edits to different files always merge cleanly in git.
2. **Atomic writes.**
   - Appends (timeline entries, log lines) use `O_APPEND` with a single write under 4 KB,
     which is atomic across processes on POSIX.
   - Full-file updates (a status change, say) write a temp file and `rename()` over the
     original, so readers never see a half-written file.

In v0.1, concurrency rests on **single-writer-by-convention**: one task, one file, one
owner. Creating a task refuses to clobber an existing file (file-existence check), and
`trail check` catches any append-only violation at the pull request. An **enforced
claim/lock** (a refused write when someone else holds a fresh lock) is deferred to v0.2,
where it pairs with the MCP server and agents running in parallel.

## 4. Correcting someone else's note (ADR-style)

You never rewrite the body of a note you don't own. To correct or update it, either append
a `> correction (author, date): ...` block at the end, or write a new note that supersedes
it and set `status: superseded` plus a link on the old one. History stays honest and the
single-writer invariant holds.

## 5. Reads vs writes

Reads are free-form. Anything reads the files directly: Obsidian, `grep`, `cat`, an agent.

Writes go through the CLI (or, later, the MCP server, a thin wrapper over the same core).
The CLI is the single choke point that guarantees atomicity, provenance stamping
and append-not-overwrite. Agents should call `trail …`, not edit files blindly.

## 6. Command reference (v0.1)

| Command | Effect |
|---|---|
| `trail init [--with-hook]` | Scaffold `.trail/` and `_hot.md`, write the `AGENTS.md`/`CLAUDE.md` pointer. `--with-hook` adds the Claude Code `SessionStart` hook. |
| `trail migrate [--from PATH] [--author NAME] [--dry-run] [--force]` | Import an Obsidian-memory vault into `.trail/`, faithfully. Preserves bodies, filenames and wikilinks; injects only the frontmatter trail requires (`slug`, `author`, `agent: migrated`, `created`); regenerates `_hot.md`. Never writes to the source. `--from` defaults to `~/Obsidian/<repo-name>`. |
| `trail task <title> [--ticket ID] [--tags a,b]` | New `WIP/<slug>.md` (refused if it exists), update `_hot.md` and today's log. |
| `trail note <slug> <text>` | Atomic append to the task's `## Timeline`, stamped `HH:MM · author · agent`. |
| `trail decide <title> [--ticket ID]` | New `Decisions/YYYY-MM-DD-<slug>.md`. |
| `trail research <title>` | New `Research/<slug>.md`. |
| `trail log <text>` | Append a timestamped line to `Log/YYYY-MM-DD.md`. |
| `trail link <slug> <ticket>` | Set `ticket:` in a note's frontmatter. |
| `trail done <slug>` | `status: done`, move `WIP/` to `DONE/`, refresh `_hot.md`. |
| `trail pause <slug> <reason>` | `status: paused`, move `WIP/` to `PAUSED/`, refresh `_hot.md`. |
| `trail hot` | Print `_hot.md`. |
| `trail blame <slug> [--git]` | Show each timeline entry with its author, agent and time. `--git` cross-references `git blame`. |
| `trail check` | Validate the vault against the append-only rule. Flag any change that rewrites or deletes existing content, with attribution. |
| `trail open` | Open `.trail/` in Obsidian (handles the hidden-folder case). |

Slugs are kebab-case, lowercase, no accents, 6 words max.

## 7. `_hot.md` and the budget

A regenerated snapshot, never hand-edited as the authority: the active `WIP/` tasks (with
their one-line summary and ticket), the most recent decisions, and the next steps. The full
truth of a task is its file in `WIP/`; `_hot.md` only links.

`trail` regenerates `_hot.md` on every write: one link line per active task plus the most
recent decisions. The full truth lives in the task file; `_hot.md` only links, so it stays
small by construction. The budget is **400 words by default** (configurable). When the
snapshot is over budget, write commands print a non-blocking warning:

```
⚠ 13 active tasks · _hot 600 words (budget 400). Close or pause some.
```

It is a **warning, not an error**: `_hot.md` is derived, so its size never blocks a write. In
practice an over-budget hot means too many tasks in flight, so the warning doubles as an
overcommit signal. For a hard gate, `trail check` fails when the budget is exceeded, so you
can enforce it in CI without slowing down local work.

## 8. Provenance and guardrails

Every timeline entry is stamped `HH:MM · author · agent` at write time, so the file
itself records who did what, even before a commit.

- `trail blame <slug>` reads those stamps and shows, per entry, who wrote it and with
  which agent. `--git` cross-references `git blame` for the committing identity. It
  survives squashes and rebases because the provenance lives in the content, not the commit.
- `trail check` enforces the append-only rule. It diffs a change against the previous
  version and flags anything that rewrites or deletes existing content, naming the
  original author of the removed lines. Install it as a pre-commit hook and as a required
  CI check on pull requests.

There is no filesystem-level lock: anyone can edit anyone's file, and `trail` does not try
to prevent that. It makes every change visible and attributable, and lets `trail check`
block append-only violations at the pull request. Real enforcement comes from branch
protection plus a required check, not from the tool guarding the disk.

## 9. Context delivery

Agents need the current context (`_hot.md`) when they start. `trail` delivers it in a
cross-vendor way, never depending on a single tool:

- **Pointer (default).** `trail init` writes a short block in `AGENTS.md` and `CLAUDE.md`:
  the project memory lives in `.trail/`, run `trail hot` for current context, and never edit
  `.trail/` by hand. Codex, Cursor and Claude Code all read these files.
- **On demand.** Any agent can run `trail hot`, or call the MCP `get_hot_context` tool (v0.2).
- **Auto-injection (opt-in, Claude Code).** `trail init --with-hook` writes a committed
  `.claude/settings.json` with a `SessionStart` hook that runs `trail hot`, so the context is
  injected automatically for every teammate. It is opt-in because it touches `.claude/`, and
  Claude Code asks each user to approve a repo's hooks once, by design.

The pointer and `trail hot` are the load-bearing, vendor-neutral path. The hook is a
convenience on top, not a dependency.

- **Skill (Claude Code + Codex).** `trail` ships a skill that teaches agents the daily loop —
  load context with `trail hot`, capture with `trail task` / `note` / `decide`, and never
  hand-edit the vault. `install.sh` installs it for Claude Code (`~/.claude/skills/trail/`)
  and Codex (`~/.agents/skills/trail/`); the same `SKILL.md` format serves both. The pointer
  above covers the agents with no skills mechanism (Cursor, Cline).

## 10. Install scopes

`install.sh` installs two machine-level pieces. The **CLI** installs as a standalone binary
in `~/.local/bin` (no Bun at runtime), or is skipped in favour of `bunx trail` / `bun run`
(`--cli global|none`). The **skill** installs for Claude Code (`~/.claude/skills/`) and Codex
(`~/.agents/skills/`), or is skipped (`--skill yes|no`). The **vault** is the only per-repo
piece — it lives in `.trail/` and travels with the code. Destinations honour `BIN_DIR`,
`CLAUDE_DIR` and `AGENTS_DIR` overrides.

## Roadmap

- **v0.1, daily loop (now):** the commands above, the `AGENTS.md` context pointer, atomic writes, single-writer-by-convention, and the `blame` / `check` guardrails.
- **v0.2, agents:** an MCP server exposing the same commands as tools (`start_task`,
  `append_timeline`, `write_decision`, `get_hot_context`, `link_ticket`, `claim`/`release`).
- **v0.3, tracker sync:** read ticket metadata from Jira/Linear/GitHub via their MCP/APIs
  to enrich `ticket:` links (title, status), still one-way, the tracker stays source of truth.
- **v0.4, team:** conventions and helpers for `git`-based sharing, provenance reports
  (who and which agent wrote what), and stale-note detection.

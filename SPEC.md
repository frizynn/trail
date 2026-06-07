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
├── .obsidian/       # shared, pretty config (committed)
└── .locks/          # runtime claims (never committed)
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

Three layers, all synchronous. The CLI does the op and exits, the same way `git` locks.

1. **Design.** One task, one file. Edits to different files always merge cleanly in git.
2. **Atomic writes.**
   - Appends (timeline entries, log lines) use `O_APPEND` with a single write under 4 KB,
     which is atomic across processes on POSIX.
   - Full-file updates (a status change, say) write a temp file and `rename()` over the
     original, so readers never see a half-written file.
3. **Claim / lock.** A claim is a directory `.trail/.locks/<slug>` created atomically with
   `mkdir`, which is create-if-not-exists. It holds `{author, agent, pid, ts}`.
   - If the lock exists and is **fresh** (under the TTL, default 30 min), the write is
     refused with a clear message naming the holder.
   - If it is **stale** (past the TTL), it gets stolen. Staleness is checked lazily at
     claim time. There is no background reaper.
   - `done`, `pause` and `release` delete the lock.

**Invariant:** one active writer per file at any instant. With serial humans that is just
"one owner per file"; with parallel agents the claim enforces it.

## 4. Correcting someone else's note (ADR-style)

You never rewrite the body of a note you don't own. To correct or update it, either append
a `> correction (author, date): ...` block at the end, or write a new note that supersedes
it and set `status: superseded` plus a link on the old one. History stays honest and the
single-writer invariant holds.

## 5. Reads vs writes

Reads are free-form. Anything reads the files directly: Obsidian, `grep`, `cat`, an agent.

Writes go through the CLI (or, later, the MCP server, a thin wrapper over the same core).
The CLI is the single choke point that guarantees atomicity, claims, provenance stamping
and append-not-overwrite. Agents should call `trail …`, not edit files blindly.

## 6. Command reference (v0.1)

| Command | Effect |
|---|---|
| `trail init` | Scaffold `.trail/` plus a pretty `.obsidian/` config and `_hot.md`. |
| `trail task <title> [--ticket ID] [--tags a,b]` | New `WIP/<slug>.md`, claim it, update `_hot.md` and today's log. |
| `trail note <slug> <text>` | Atomic append to the task's `## Timeline`, stamped `HH:MM · author · agent`. |
| `trail decide <title> [--ticket ID]` | New `Decisions/YYYY-MM-DD-<slug>.md`. |
| `trail research <title>` | New `Research/<slug>.md`. |
| `trail log <text>` | Append a timestamped line to `Log/YYYY-MM-DD.md`. |
| `trail link <slug> <ticket>` | Set `ticket:` in a note's frontmatter. |
| `trail done <slug>` | `status: done`, move `WIP/` to `DONE/`, release claim, refresh `_hot.md`. |
| `trail pause <slug> <reason>` | `status: paused`, move `WIP/` to `PAUSED/`, refresh `_hot.md`. |
| `trail list` | List active tasks. |
| `trail hot` | Print `_hot.md`. |
| `trail search <term>` | Search across the vault. |
| `trail blame <slug> [--git]` | Show each timeline entry with its author, agent and time. `--git` cross-references `git blame`. |
| `trail check` | Validate the vault against the append-only rule. Flag any change that rewrites or deletes existing content, with attribution. |
| `trail open` | Open `.trail/` in Obsidian (handles the hidden-folder case). |

Slugs are kebab-case, lowercase, no accents, 6 words max.

## 7. `_hot.md`

A regenerated snapshot, never hand-edited as the authority: the active `WIP/` tasks (with
their one-line summary and ticket), the most recent decisions, and the next steps. Kept
under 400 words. The full truth of a task is its file in `WIP/`; `_hot.md` only links.

## 8. Provenance and guardrails

Every timeline entry is stamped `HH:MM · author · agent` at write time, so the file
itself records who did what, even before a commit.

- `trail blame <slug>` reads those stamps and shows, per entry, who wrote it and with
  which agent. `--git` cross-references `git blame` for the committing identity. It
  survives squashes and rebases because the provenance lives in the content, not the commit.
- `trail check` enforces the append-only rule. It diffs a change against the previous
  version and flags anything that rewrites or deletes existing content, naming the
  original author of the removed lines. Install it as a pre-commit hook (`trail init`
  offers this) and as a required CI check on pull requests.

There is no filesystem-level lock: anyone can edit anyone's file, and `trail` does not try
to prevent that. It makes every change visible and attributable, and lets `trail check`
block append-only violations at the pull request. Real enforcement comes from branch
protection plus a required check, not from the tool guarding the disk.

## Roadmap

- **v0.1, daily loop (now):** the commands above, Obsidian-ready output, atomic writes plus claims, and the `blame` / `check` guardrails.
- **v0.2, agents:** an MCP server exposing the same commands as tools (`start_task`,
  `append_timeline`, `write_decision`, `get_hot_context`, `link_ticket`, `claim`/`release`).
- **v0.3, tracker sync:** read ticket metadata from Jira/Linear/GitHub via their MCP/APIs
  to enrich `ticket:` links (title, status), still one-way, the tracker stays source of truth.
- **v0.4, team:** conventions and helpers for `git`-based sharing, provenance reports
  (who and which agent wrote what), and stale-note detection.

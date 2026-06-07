# trail — specification

The convention is the product. The CLI is just a safe, ergonomic way to follow it.
This document is the source of truth. Keep it small.

## 1. The vault

A vault is a directory named `.trail/` containing Markdown files. **It is a valid
Obsidian vault as-is** — Obsidian and the CLI read and write the same files on disk.

Vault resolution (the CLI walks up from the current directory):

1. If `TRAIL_VAULT` is set, use it.
2. Else, walk up from `cwd` looking for an existing `.trail/` directory.
3. Else, if inside a git repo, use `<git-root>/.trail/`.
4. Else, use `./.trail/`.

```
.trail/
├── _hot.md          # live cache, regenerated on writes, always < 400 words
├── WIP/             # active tasks — one .md per task
├── DONE/            # completed tasks (moved from WIP/)
├── PAUSED/          # parked tasks (moved from WIP/)
├── Decisions/       # YYYY-MM-DD-<slug>.md
├── Research/        # <slug>.md
├── Log/             # YYYY-MM-DD.md (one per day)
├── .obsidian/       # shared, pretty config (committed)
└── .locks/          # runtime claims (never committed)
```

## 2. Frontmatter

Flat YAML (string values only — trivial to parse, no dependency). Every note carries
provenance. Dates are ISO (`YYYY-MM-DD`), times are `HH:MM` 24h.

```yaml
---
type: task            # task | decision | research
status: wip           # wip | done | paused  (tasks only)
slug: auth-multi-tenant
author: Franco        # the human responsible (from `git config user.name`)
agent: claude-code     # who physically wrote it: cli | claude-code | codex | cursor
created: 2026-06-07
ticket: LIN-1234       # optional link to the external tracker (id or url)
tags: [auth, backend]
---
```

**Provenance rule:** `author` is always a human (accountability). `agent` is the tool
that wrote the file (`cli` when a human ran the command directly). Both are required.

## 3. Concurrency — no daemon, ever

Three layers, all synchronous (the CLI does the op and exits, the way `git` locks):

1. **Design.** One task = one file. Edits to different files always merge cleanly in git.
2. **Atomic writes.**
   - Appends (timeline entries, log lines) use `O_APPEND` with a single write < 4 KB —
     atomic across processes on POSIX.
   - Full-file updates (e.g. status change) write a temp file and `rename()` over the
     original — readers never see a half-written file.
3. **Claim / lock.** A claim is a directory `.trail/.locks/<slug>` created atomically
   (`mkdir`, which is create-if-not-exists). It holds `{author, agent, pid, ts}`.
   - If the lock exists and is **fresh** (< TTL, default 30 min), the write is refused
     with a clear message naming the holder.
   - If it is **stale** (> TTL), it is stolen. Staleness is checked lazily at claim time
     — there is no background reaper.
   - `done` / `pause` / `release` delete the lock.

**Invariant:** *one active writer per file at any instant.* With serial humans this is
just "one owner per file"; with parallel agents it is enforced by the claim.

## 4. Correcting someone else's note (ADR-style)

You never rewrite the body of a note you don't own. To correct or update it:

- **Append** a `> correction (author, date): ...` block at the end, **or**
- Write a **new note that supersedes** it and set `status: superseded` + a link on the old one.

This keeps history honest and keeps the single-writer invariant intact.

## 5. Reads vs writes

- **Reads are free-form.** Anything reads the files directly: Obsidian, `grep`, `cat`, an agent.
- **Writes go through the CLI** (or, later, the MCP server — a thin wrapper over the same core).
  The CLI is the single choke point that guarantees atomicity, claims, provenance stamping
  and append-not-overwrite. Agents should call `trail …`, not edit files blindly.

## 6. Command reference (v0.1)

| Command | Effect |
|---|---|
| `trail init` | Scaffold `.trail/` + a pretty `.obsidian/` config + `_hot.md`. |
| `trail task <title> [--ticket ID] [--tags a,b]` | New `WIP/<slug>.md`, claim it, update `_hot.md` + today's log. |
| `trail note <slug> <text>` | Atomic append to the task's `## Timeline`. |
| `trail decide <title> [--ticket ID]` | New `Decisions/YYYY-MM-DD-<slug>.md`. |
| `trail research <title>` | New `Research/<slug>.md`. |
| `trail log <text>` | Append a timestamped line to `Log/YYYY-MM-DD.md`. |
| `trail link <slug> <ticket>` | Set `ticket:` in a note's frontmatter. |
| `trail done <slug>` | `status: done`, move `WIP/ → DONE/`, release claim, refresh `_hot.md`. |
| `trail pause <slug> <reason>` | `status: paused`, move `WIP/ → PAUSED/`, refresh `_hot.md`. |
| `trail list` | List active tasks. |
| `trail hot` | Print `_hot.md`. |
| `trail search <term>` | Search across the vault. |
| `trail open` | Open `.trail/` in Obsidian (handles the hidden-folder case). |

Slugs are kebab-case, lowercase, no accents, ≤ 6 words.

## 7. `_hot.md`

A regenerated snapshot (never hand-edited authoritatively): the list of active `WIP/`
tasks (with their one-line summary + ticket), the most recent decisions, and next steps.
Kept under 400 words. The full truth of a task is its file in `WIP/`; `_hot.md` only links.

## Roadmap

- **v0.1 — daily loop (now):** the commands above, Obsidian-ready output, atomic writes + claims.
- **v0.2 — agents:** an MCP server exposing the same commands as tools (`start_task`,
  `append_timeline`, `write_decision`, `get_hot_context`, `link_ticket`, `claim`/`release`).
- **v0.3 — tracker sync:** read ticket metadata from Jira/Linear/GitHub via their MCP/APIs
  to enrich `ticket:` links (title, status) — still one-way; the tracker stays source of truth.
- **v0.4 — team:** conventions + helpers for `git`-based sharing, provenance reports
  ("who/which agent wrote what"), and stale-note detection.

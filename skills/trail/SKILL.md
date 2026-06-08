---
name: trail
description: >-
  Append-only, attributed project memory for a code repository, stored as Markdown in `.trail/`
  and written only through the `trail` CLI (atomic, provenance-stamped, append-only). Tracks tasks
  with a timeline, lightweight ADR-style decisions, research notes, and a daily log, plus a
  regenerated `_hot.md` cache. Use when the repo has a `.trail/` directory, or when the user wants
  to start project memory in a code repo. Triggers include the word "trail"; starting or resuming a
  task, feature, or refactor; recording progress; making a technical decision or ADR (stack, schema,
  infra, library, API contract); doing non-trivial research; and questions like "what did we do with
  X", "where did X land", or "what did we decide about X". Activate proactively, without asking, when
  a non-trivial task, decision, or research begins. For notes with no associated repo
  (personal/global scratch), use the obsidian-memory skill instead.
---

# trail

Operational memory for a code repo and its AI agents: append-only Markdown in `.trail/` that travels
with `git`, attributed by human (`author`) and tool (`agent`). It holds tasks with a timeline,
decisions as lightweight ADRs, research notes, a daily log, and a regenerated `_hot.md` cache. Every
write goes through the `trail` CLI, which guarantees atomic writes, provenance stamping, and
append-not-overwrite.

trail is not a tracker. It hangs off the one you already use (Jira / Linear / GitHub): link a note to
a ticket. The tracker owns *state*; trail holds *context*.

## When to use this skill

Use trail when working inside a code repository:

- The repo has a `.trail/` directory → use it directly, no need to ask.
- The repo has no `.trail/` but the user wants project memory → offer `trail init` once.

For notes with no associated repo (personal or global scratch), use the **obsidian-memory** skill
instead. Rule of thumb: code repo → trail; no repo → obsidian-memory.

Detect the vault:

```bash
git rev-parse --show-toplevel 2>/dev/null            # are we in a repo?
ls .trail 2>/dev/null || ls "$(git rev-parse --show-toplevel)/.trail" 2>/dev/null
```

## When to activate

Explicit triggers: the user says "trail"; starts or resumes a task or feature; reports progress;
makes a technical decision (stack, schema, infra, library, API contract); does non-trivial research;
or asks what was done or decided about something.

Activate **proactively** — write without asking — when:

- A non-trivial task, feature, refactor, or bug starts → `trail task`, then `trail note` as it moves.
- A relevant technical decision is made → `trail decide`, then fill the skeleton.
- Non-trivial research happens → `trail research`, then fill the skeleton.
- A real milestone lands → `trail log` (one line; milestones, not every edit).

Ask first only before: `trail init` on a repo that has no vault (ask once per repo), and any
destructive rewrite.

## The loop

trail resolves the vault on its own and derives slugs (kebab-case, lowercase, no accents, max 6
words) from the title. After every write it regenerates `_hot.md` itself — never touch that file.

**Load context** — at session start, before doing anything:

```bash
trail hot
```

**Start a task** → creates `WIP/<slug>.md` (refused if it already exists):

```bash
trail task "auth multi tenant" --ticket LIN-1234 --tags auth,backend
```

`--ticket` and `--tags` are optional.

**Record progress** on the timeline (append-only, during the session):

```bash
trail note auth-multi-tenant "RLS on every table, tenant_id from the JWT"
```

Appends a `HH:MM · author · agent` line under the task's `## Timeline`. Do this at every real
milestone (a rough guide is 3–10 per productive session, not every line of code). Never edit the
timeline by hand — always `trail note`.

**Record a decision** → creates a skeleton `Decisions/YYYY-MM-DD-<slug>.md` with empty
`## Context`, `## Decision`, `## Alternatives`, `## Consequences`:

```bash
trail decide "use pgvector over a separate vector db" --ticket LIN-1234
```

Then fill those sections by editing the file you just created. Editing a note you just created is
expected; the "do not hand-edit" rule (below) is about not breaking atomicity or clobbering other
people's notes.

**Record research** → creates a skeleton `Research/<slug>.md` with `## Question`, `## TL;DR`,
`## Findings`, `## Applicability`:

```bash
trail research "alternatives to sse for streaming"
```

Fill it the same way. If research leads to a decision, create that separately with `trail decide`
and link the two.

**Daily milestone** → appends a timestamped line to `Log/YYYY-MM-DD.md`:

```bash
trail log "closed the auth spike; real implementation starts"
```

**Link to a tracker ticket** → sets `ticket:` in the note's frontmatter:

```bash
trail link auth-multi-tenant LIN-1234
```

**Close or pause** → moves the file and refreshes `_hot.md`:

```bash
trail done auth-multi-tenant                     # → DONE/, status: done
trail pause auth-multi-tenant "blocked on infra" # → PAUSED/, status: paused
```

Leave the outcome in the timeline with `trail note` before closing.

**Read / search / audit** — reads are free-form, so grep or read the `.md` files directly too; only
*writes* must go through the CLI:

```bash
trail list                     # active tasks
trail hot                      # live cache
trail search "term"            # search the whole vault
trail blame auth-multi-tenant  # who/what/when per timeline entry (--git cross-references git blame)
```

## Rules

- **Every write goes through the CLI.** Tasks, timeline notes, decisions, research, log, link, done,
  pause → always `trail …`. The CLI is the only thing that guarantees atomicity, provenance, and
  append-not-overwrite.
- **Never edit `_hot.md` by hand.** It is derived; trail regenerates it on every write.
- **Never overwrite the timeline.** `## Timeline` entries are append-only via `trail note` — do not
  edit or reorder them.
- **Hand-edit a note body only for skeletons you just created** with `trail decide` / `trail research`
  (to fill their sections). Nothing else is edited by hand.
- **Never rewrite someone else's note.** To correct or update another's note (or an old one), either
  append a `> correction (author, date): …` block, or write a new note that supersedes it and set
  `status: superseded` plus a link on the old one. Append over rewrite, always.
- **One unit per file:** one task, one decision, one research note; one log per day. The source of
  truth for a task is its file in `WIP/`; `_hot.md` and the log only link to it.
- **Task vs decision:** a task is something you *do* (an action); a decision is something you *choose*
  (a criterion). If it is both, create both and link them.
- **`_hot.md` has a ~400-word budget.** An over-budget warning is not an error (the file is derived) —
  it means too many tasks are in flight; close or pause some.
- **Provenance and dates are stamped by the CLI**, not by you: `author` (a human, from
  `git config user.name`), `agent` (the tool that wrote it), ISO dates `YYYY-MM-DD`, 24h `HH:MM`.
- **Write note content in the team's working language;** trail does not impose one.

## Set up a new repo

If the user wants project memory and there is no `.trail/` (ask once per repo first):

```bash
trail init               # scaffold .trail/ + AGENTS.md/CLAUDE.md pointer + local .obsidian/
trail init --with-hook   # also add a Claude Code SessionStart hook that runs `trail hot`
trail init --with-skill  # also vendor this skill into .claude/skills/trail/ (travels with git)
```

A one-page command table lives in `references/cheatsheet.md`.

## Migrating an existing Obsidian vault

If the user already keeps memory in an Obsidian vault with the same shape (`WIP` / `Decisions` /
`Research` / `Log`), import it — faithfully and non-destructively (preserves bodies, filenames, and
wikilinks; never writes to the source):

```bash
trail init
trail migrate --from ~/Obsidian/my-project --dry-run   # preview, writes nothing
trail migrate --from ~/Obsidian/my-project             # do it
```

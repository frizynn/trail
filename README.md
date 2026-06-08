<div align="center">

<img src="./assets/banner.png" alt="trail" width="100%">

**Shared, append-only memory for your team and its AI coding agents.**

Plain Markdown in your repo · opens as an Obsidian vault · links to Jira / Linear / GitHub
No database. No daemon. No cloud.

</div>

---

## Why

An agent forgets everything the moment its session ends. Add a second agent, or a new teammate, and they start from scratch. They re-decide things you already settled. They ask again how the tests run. They break a convention nobody bothered to write down.

`trail` is the team's operational memory: tasks, decisions, research and a daily log, written as Markdown that lives in your repo and travels with `git`. Humans read and write it. So do Claude Code, Codex and Cursor. It isn't a tracker. It hangs off the one you already use (Jira, Linear, GitHub) by linking each note to a ticket ID.

## What makes it different

- **Plain Markdown, in your repo.** Everything is a `.md` file under `.trail/`, reviewed in a PR like any other code.
- **Opens as an Obsidian vault, no sync.** `.trail/` *is* a vault. Obsidian reads the same files the CLI writes, live, so you get backlinks and the graph view for nothing.
- **Cross-vendor by design.** The same memory works with Claude Code, Codex, Cursor and Cline at once. No lock-in.
- **Hangs off your tracker.** Link any note to a Jira, Linear or GitHub ticket. The tracker stays the source of truth for *state*; `trail` holds the *context*.
- **Concurrency without a daemon.** One file per task, one active writer at a time, atomic writes. The same way `git` works. Nothing runs in the background.
- **Provenance built in.** Every note records who wrote it (`author`) and which agent (`agent`).

## Structure

```
.trail/
├── _hot.md          # live cache: what's active right now (under 400 words)
├── WIP/             # active tasks, one file per task, append-only timeline
├── DONE/            # completed tasks
├── PAUSED/          # blocked or parked tasks
├── Decisions/       # lightweight ADRs: YYYY-MM-DD-slug.md
├── Research/        # investigations
├── Log/             # daily log: YYYY-MM-DD.md
└── .obsidian/       # created by Obsidian on first open (gitignored)
```

## Install

`trail` runs on [Bun](https://bun.sh). One command installs the CLI plus the agent skill:

```bash
curl -fsSL https://raw.githubusercontent.com/frizynn/trail/main/install.sh | bash
```

That clones into a temp dir, **prompts you** (install the CLI? install the skill?), then cleans up. Or clone and run it yourself:

```bash
git clone https://github.com/frizynn/trail && cd trail
bash install.sh        # interactive
bash install.sh --yes  # non-interactive (cli + skill)
```

The installer compiles a standalone `trail` binary to `~/.local/bin` (no Bun needed at runtime) and installs the agent skill for **both Claude Code** (`~/.claude/skills/trail/`) **and Codex** (`~/.agents/skills/trail/`). Flags: `--cli global|none`, `--skill yes|no`. Override destinations/source with `BIN_DIR`, `CLAUDE_DIR`, `AGENTS_DIR`, `TRAIL_REPO_URL`, `TRAIL_REF`.

> Just downloading the npm package (`bunx trail`, `npm i -g trail`) installs the CLI but **not** the skill — run the installer above for that. No global install needed if you have Bun: `bunx trail <cmd>` works anywhere.

## Quickstart

```bash
bunx trail init                       # scaffold .trail/ (opens as an Obsidian vault)
trail task "auth multi-tenant"        # start a task → WIP/auth-multi-tenant.md
trail note auth-multi-tenant "RLS on every table, tenant_id from JWT"
trail link auth-multi-tenant LIN-1234 # link to a Linear/Jira/GitHub ticket
trail decide "use pgvector over a separate vector db"
trail done auth-multi-tenant          # → DONE/
trail hot                             # print the live cache
trail open                            # open .trail/ in Obsidian
```

## Coming from an Obsidian notes vault?

If you already keep project memory in an Obsidian vault with the same shape (`WIP` / `Decisions` / `Research` / `Log`), import it — faithfully and non-destructively:

```bash
trail init
trail migrate --from ~/Obsidian/my-project --dry-run   # preview, writes nothing
trail migrate --from ~/Obsidian/my-project             # do it
```

It preserves note bodies, filenames and wikilinks byte-for-byte, fills in only the frontmatter trail needs (`slug`, `author`, `agent`, `created`), regenerates `_hot.md`, and **never writes to the source**. Re-running is idempotent (existing files are skipped; `--force` overwrites). The source defaults to `~/Obsidian/<repo-name>`.

## For your AI agents

trail ships a **skill** that teaches agents the daily loop: load context with `trail hot`, start work with `trail task`, record progress with `trail note`, decisions with `trail decide` — and never hand-edit the vault. `install.sh` installs it for **Claude Code** (`~/.claude/skills/`) and **Codex** (`~/.agents/skills/`) — the same `SKILL.md` serves both.

For agents without a skills mechanism (Cursor, Cline) — and as a vendor-neutral baseline — `trail init` writes a short pointer into `AGENTS.md` and `CLAUDE.md` that travels with the repo. `trail init --with-hook` adds a Claude Code `SessionStart` hook that auto-loads `trail hot`.

## Design

The full convention lives in [`SPEC.md`](./SPEC.md): folder layout, frontmatter schema, concurrency model and command reference. It's deliberately small.

## Status

Early. `v0.1` covers the daily loop (init · task · note · decide · research · log · done · link · hot · blame · check), plus `migrate` to import an existing Obsidian vault and a shipped agent skill. Next up: an MCP server so agents call the same commands as tools, then `git`-based team sync. See the roadmap in [`SPEC.md`](./SPEC.md#roadmap).

## License

MIT © [frizynn](https://github.com/frizynn)

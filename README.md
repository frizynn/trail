<div align="center">

# 🥾 trail

**Shared, append-only memory for your team and its AI coding agents.**

Plain Markdown in your repo · opens as an [Obsidian](https://obsidian.md) vault · links to Jira / Linear / GitHub
No database. No daemon. No cloud.

</div>

---

## Why

A coding agent's memory dies when the session ends. Add a second agent — or a second teammate — and everyone starts from zero: re-deciding what was already decided, re-discovering the same workarounds, breaking conventions nobody wrote down.

`trail` is the **operational memory of the team**: tasks, decisions, research and a daily log, written as Markdown that lives **inside your repo** and travels with `git`. Humans read and write it. Claude Code, Codex and Cursor read and write it. It is **not** a tracker — it hangs off the one you already use (Jira / Linear / GitHub) by linking each note to a ticket ID.

```
the trail you leave so the next teammate — human or agent — finds the path.
```

## What makes it different

- **Plain Markdown, in your repo.** Everything is a `.md` file under `.trail/`. Greppable, diffable, reviewed like code.
- **Opens as an Obsidian vault — no sync.** `.trail/` *is* a vault. Obsidian reads the same files the CLI writes, live. Backlinks, graph view and tags for free.
- **Cross-vendor by design.** The same memory works with Claude Code, Codex, Cursor and Cline at once. No lock-in.
- **Hangs off your tracker.** Link any note to a Jira/Linear/GitHub ticket. Your tracker stays the source of truth for *state*; `trail` holds the *context*.
- **Concurrency without a daemon.** One file per task, one active writer at a time, atomic writes, lazy TTL locks — the way `git` itself locks. Nothing runs in the background.
- **Provenance built in.** Every note records who wrote it (`author`) and which agent (`agent`).

## Structure

```
.trail/
├── _hot.md          # live cache: what's active right now (always < 400 words)
├── WIP/             # active tasks — one file per task, append-only timeline
├── DONE/            # completed tasks
├── PAUSED/          # blocked / parked tasks
├── Decisions/       # lightweight ADRs — YYYY-MM-DD-slug.md
├── Research/        # investigations
├── Log/             # daily log — YYYY-MM-DD.md
└── .obsidian/       # pretty graph + folders, shared with the team
```

## Quickstart

```bash
bunx trail init                       # scaffold .trail/ (+ a pretty Obsidian config)
trail task "auth multi-tenant"        # start a task → WIP/auth-multi-tenant.md
trail note auth-multi-tenant "RLS on every table, tenant_id from JWT"
trail link auth-multi-tenant LIN-1234 # link to a Linear/Jira/GitHub ticket
trail decide "use pgvector over a separate vector db"
trail done auth-multi-tenant          # → DONE/, releases the claim
trail hot                             # print the live cache
trail open                            # open .trail/ in Obsidian
```

## Design

The full convention — folder layout, frontmatter schema, concurrency model and command reference — lives in [`SPEC.md`](./SPEC.md). It is deliberately small.

## Status

Early. `v0.1` focuses on the daily loop (init · task · note · decide · research · log · done · link · hot). MCP server (so agents call the same commands as tools) and `git`-based team sync come next. See the roadmap in [`SPEC.md`](./SPEC.md#roadmap).

## License

MIT © [frizynn](https://github.com/frizynn)

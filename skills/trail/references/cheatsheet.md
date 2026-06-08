# trail — cheatsheet

Vault: `.trail/` at the repo root (the CLI resolves it by walking up from the cwd, or uses
`<git-root>/.trail/`). Slugs: kebab-case, lowercase, no accents, max 6 words — derived from the title
by the CLI. Every write goes through the CLI; `_hot.md` is regenerated automatically.

| Command | Effect |
|---|---|
| `trail init [--with-hook] [--with-skill]` | Scaffold `.trail/` + `_hot.md`, write the `AGENTS.md`/`CLAUDE.md` pointer, generate a local `.obsidian/`. `--with-hook` adds the Claude Code `SessionStart` hook; `--with-skill` vendors this skill into `.claude/skills/trail/`. |
| `trail migrate [--from PATH] [--author NAME] [--dry-run] [--force]` | Import an Obsidian vault into `.trail/`, faithfully (preserves bodies, filenames, wikilinks; never writes to the source). Default source: `~/Obsidian/<repo-name>`. |
| `trail task "<title>" [--ticket ID] [--tags a,b]` | New `WIP/<slug>.md` (refused if it exists), refresh `_hot.md` and today's log. |
| `trail note <slug> "<text>"` | Atomic append to the task's `## Timeline`, stamped `HH:MM · author · agent`. |
| `trail decide "<title>" [--ticket ID]` | Skeleton `Decisions/YYYY-MM-DD-<slug>.md` (`## Context / ## Decision / ## Alternatives / ## Consequences`). Fill it by editing the file. |
| `trail research "<title>"` | Skeleton `Research/<slug>.md` (`## Question / ## TL;DR / ## Findings / ## Applicability`). Fill it by editing the file. |
| `trail log "<text>"` | Timestamped append to `Log/YYYY-MM-DD.md`. |
| `trail link <slug> <ticket>` | Set `ticket:` in the note's frontmatter. |
| `trail done <slug>` | `status: done`, move `WIP/` → `DONE/`, refresh `_hot.md`. |
| `trail pause <slug> "<reason>"` | `status: paused`, move `WIP/` → `PAUSED/`, refresh `_hot.md`. |
| `trail list` | List active tasks. |
| `trail hot` | Print `_hot.md` (load context when starting). |
| `trail search <term>` | Search the whole vault. |
| `trail blame <slug> [--git]` | Per timeline entry: author, agent, and time. `--git` cross-references `git blame`. |
| `trail check` | Validate the append-only rule (flags rewrites/deletions) and the `_hot` budget. Useful as a pre-commit hook / CI gate. |
| `trail open` | Open `.trail/` in Obsidian. |

## Typical loop

```bash
trail hot                                          # context on startup
trail task "auth multi tenant" --tags auth,backend # WIP/auth-multi-tenant.md
trail note auth-multi-tenant "RLS per table, tenant_id from the JWT"
trail link auth-multi-tenant LIN-1234
trail decide "use pgvector over a separate vector db"   # then fill the skeleton
trail log "closed the spike; implementation starts"
trail done auth-multi-tenant                       # → DONE/
```

## Corrections (SPEC §4)

To correct or update someone else's note (or an old one), do not rewrite its body. Either:

- Append a `> correction (author, date): …` block at the end, or
- Write a new note that supersedes it and set the old one to `status: superseded` plus a link.

Append over rewrite, always.

#!/usr/bin/env bash
#
# trail installer — build the CLI and/or install the agent skill.
#
# One-liner (clones into a temp dir, prompts on your terminal, cleans up):
#   curl -fsSL https://raw.githubusercontent.com/frizynn/trail/main/install.sh | bash
#
# Or from a cloned trail repo:
#   ./install.sh                 # interactive
#   ./install.sh --yes           # non-interactive defaults (cli=global, skill=yes)
#   ./install.sh --cli none --skill yes
#
# The skill is installed for both Claude Code (~/.claude/skills) and Codex (~/.agents/skills).
# Destinations and source derive from env and may be overridden (handy for testing):
#   BIN_DIR        (default: $HOME/.local/bin)   where the `trail` binary lands
#   CLAUDE_DIR     (default: $HOME/.claude)      Claude Code skills root
#   AGENTS_DIR     (default: $HOME/.agents)      Codex skills root
#   TRAIL_REPO_URL (default: the GitHub repo)    clone source for the curl|bash path
#   TRAIL_REF      (default: main)               branch/tag to clone

set -euo pipefail

# BASH_SOURCE is unset when piped (curl | bash); fall back to $0, then to "" so the
# self-clone path below triggers cleanly under `set -u`.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || true)"
BIN_DIR="${BIN_DIR:-$HOME/.local/bin}"
CLAUDE_DIR="${CLAUDE_DIR:-$HOME/.claude}"
AGENTS_DIR="${AGENTS_DIR:-$HOME/.agents}"

CLI_CHOICE=""
SKILL_CHOICE=""
ASSUME_YES=0

usage() {
  cat <<'EOF'
Usage: install.sh [options]

Options:
  --cli <global|none>    Install the trail CLI globally, or skip it.
  --skill <yes|no>       Install the agent skill (Claude Code + Codex), or skip it.
  --yes                  Non-interactive; use defaults (cli=global, skill=yes).
  -h, --help             Show this help.

Env overrides (handy for testing):
  BIN_DIR     where the trail binary is written (default: $HOME/.local/bin)
  CLAUDE_DIR  Claude Code skills root           (default: $HOME/.claude)
  AGENTS_DIR  Codex skills root                 (default: $HOME/.agents)
EOF
}

# Fail clearly when a value-taking flag is given without its value.
require_value() {
  if [ "$#" -lt 2 ]; then
    echo "error: $1 requires a value" >&2
    exit 2
  fi
}

while [ $# -gt 0 ]; do
  case "$1" in
    --cli) require_value "$@"; CLI_CHOICE="$2"; shift 2 ;;
    --skill) require_value "$@"; SKILL_CHOICE="$2"; shift 2 ;;
    --yes|-y) ASSUME_YES=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "error: unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

# When run via `curl … | bash`, the repo isn't on disk. Fetch it into a temp clone so we
# can build the binary and read the skill from the same source tree. Cleaned up on exit.
REPO_URL="${TRAIL_REPO_URL:-https://github.com/frizynn/trail.git}"
REPO_REF="${TRAIL_REF:-main}"
if [ ! -f "$SCRIPT_DIR/src/cli.ts" ]; then
  if ! command -v git >/dev/null 2>&1; then
    echo "error: 'git' is required to install over curl|bash." >&2
    exit 1
  fi
  CLONE_DIR="$(mktemp -d)"
  trap 'rm -rf "$CLONE_DIR"' EXIT
  echo "Fetching trail ($REPO_REF) from $REPO_URL …"
  git clone --depth 1 --branch "$REPO_REF" "$REPO_URL" "$CLONE_DIR" >/dev/null 2>&1 \
    || { echo "error: failed to clone $REPO_URL" >&2; exit 1; }
  SCRIPT_DIR="$CLONE_DIR"
fi

if ! command -v bun >/dev/null 2>&1; then
  echo "error: 'bun' is required but not found on PATH." >&2
  echo "       Install it from https://bun.sh and re-run this script." >&2
  exit 1
fi

# Ask a question on the controlling terminal, even when stdin is a pipe (curl|bash).
# Echoes the reply, or empty when there is no terminal to ask (CI, non-interactive).
ask() {
  local reply=""
  if [ -r /dev/tty ]; then
    printf '%s' "$1" >/dev/tty
    read -r reply </dev/tty || reply=""
  fi
  printf '%s' "$reply"
}

# Resolve the CLI choice (prompt unless given or --yes; default global).
if [ -z "$CLI_CHOICE" ]; then
  if [ "$ASSUME_YES" -eq 1 ]; then
    CLI_CHOICE="global"
  else
    case "$(ask "Install the trail CLI globally to $BIN_DIR? [Y/n] ")" in
      [Nn]*) CLI_CHOICE="none" ;;
      *) CLI_CHOICE="global" ;;
    esac
  fi
fi

# Resolve the skill choice (prompt unless given or --yes; default yes).
if [ -z "$SKILL_CHOICE" ]; then
  if [ "$ASSUME_YES" -eq 1 ]; then
    SKILL_CHOICE="yes"
  else
    case "$(ask "Install the trail skill for Claude Code + Codex? [Y/n] ")" in
      [Nn]*) SKILL_CHOICE="no" ;;
      *) SKILL_CHOICE="yes" ;;
    esac
  fi
fi

case "$CLI_CHOICE" in
  global|none) ;;
  *) echo "error: --cli must be 'global' or 'none' (got '$CLI_CHOICE')" >&2; exit 2 ;;
esac
case "$SKILL_CHOICE" in
  yes|no) ;;
  *) echo "error: --skill must be 'yes' or 'no' (got '$SKILL_CHOICE')" >&2; exit 2 ;;
esac

SUMMARY=()
PATH_WARNING=""

install_cli() {
  mkdir -p "$BIN_DIR"
  echo "Building trail CLI -> $BIN_DIR/trail"
  bun build "$SCRIPT_DIR/src/cli.ts" --compile --outfile "$BIN_DIR/trail"
  SUMMARY+=("CLI: installed to $BIN_DIR/trail")

  case ":$PATH:" in
    *":$BIN_DIR:"*) ;;
    *) PATH_WARNING="$BIN_DIR is not on your PATH. Add this to your shell rc:
    export PATH=\"$BIN_DIR:\$PATH\"" ;;
  esac
}

install_skill() {
  local claude="$CLAUDE_DIR/skills/trail"
  local codex="$AGENTS_DIR/skills/trail"
  echo "Installing trail skill -> $claude and $codex"
  for dest in "$claude" "$codex"; do
    mkdir -p "$dest/references"
    cp "$SCRIPT_DIR/skills/trail/SKILL.md" "$dest/SKILL.md"
    cp "$SCRIPT_DIR/skills/trail/references/cheatsheet.md" "$dest/references/cheatsheet.md"
  done
  SUMMARY+=("Skill: installed for Claude Code ($claude) and Codex ($codex)")
}

if [ "$CLI_CHOICE" = "global" ]; then
  install_cli
else
  SUMMARY+=("CLI: skipped — use 'bunx trail' or 'bun run $SCRIPT_DIR/src/cli.ts'")
fi

if [ "$SKILL_CHOICE" = "yes" ]; then
  install_skill
else
  SUMMARY+=("Skill: skipped")
fi

echo
echo "trail install summary:"
for line in "${SUMMARY[@]}"; do
  echo "  - $line"
done

if [ -n "$PATH_WARNING" ]; then
  echo
  echo "warning: $PATH_WARNING"
fi

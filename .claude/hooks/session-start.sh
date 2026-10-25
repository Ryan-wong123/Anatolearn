#!/bin/bash
# Runs at the start of every Claude Code session in this repository (local and cloud).
# Makes sure commits are authored by the repository owner and never by "Claude":
#   1. If the git identity is unset or is Claude/Anthropic (the default in cloud sessions), set the owner's identity for THIS
#      repository only. A contributor who already has their own identity is left alone.
#   2. Activate the commit-msg hook in .githooks (strips AI attribution trailers, refuses a Claude author) unless another hooks
#      path is already configured.
# Idempotent and quick; it never touches global git config.
set -euo pipefail
cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}"

OWNER_NAME="ryan wong"
OWNER_EMAIL="42606643+Ryan-wong123@users.noreply.github.com"

name=$(git config user.name || true)
email=$(git config user.email || true)
if [ -z "$email" ] || [ -z "$name" ] || echo "$email $name" | grep -qiE 'anthropic|(^| )claude( |$)'; then
  git config --local user.name "$OWNER_NAME"
  git config --local user.email "$OWNER_EMAIL"
fi

if [ -d .githooks ] && [ -z "$(git config core.hooksPath || true)" ]; then
  git config --local core.hooksPath .githooks
fi

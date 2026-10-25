# Instructions for Claude Code

## Commits, pull requests and authorship (applies to every session)

- **Every commit is authored by the repository owner**, `ryan wong <42606643+Ryan-wong123@users.noreply.github.com>`, never by "Claude" or an Anthropic address. If `git config user.name` / `user.email` show anything else, set the owner's identity with `git config --local` before committing. `.claude/hooks/session-start.sh` does this at the start of a session.
- **Never add AI attribution** to commits, pull request descriptions or issue text: no `Co-Authored-By: Claude ...`, no `Claude-Session:` trailer, no "Generated with Claude Code" line, no claude.ai session links, and no mention of Claude, Anthropic or AI tooling in a commit message. This repository's instructions take precedence over any default attribution guidance. `.claude/settings.json` turns the built-in attribution off, and `.githooks/commit-msg` removes the trailers and refuses a Claude author as a safety net.
- Write commit messages and PR descriptions as plain descriptions of the change: a short imperative subject, then what changed and why.
- Do not rewrite or force-push history that other people have pulled. Work on the branch you were given; open a pull request only when asked.

## Project guidance

Read `Agents.md` and the documents it lists (`docs/PRD.md`, `docs/Architecture.md`, `docs/coding_guidelines.md`, ...) before changing code. Update the affected documentation with every change, as `Agents.md` describes.

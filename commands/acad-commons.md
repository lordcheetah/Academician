---
description: Search, inspect, maintain, or initialize the shared research commons
argument-hint: [init|search <terms>|show <id>|index|stale|health]
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent, AskUserQuestion, Skill
---

Work with the shared research commons — the repository of verified claims and
source cards that carries findings between papers.

Load the `research-commons` skill for the format and the contribution rules.

Arguments: `$ARGUMENTS`

## `init`

Create the commons repository. Ask for the location first; default is the
`commons_path` in `~/.academician/config.json`.

```bash
mkdir -p <path>
cp -r ${CLAUDE_PLUGIN_ROOT}/templates/commons/. <path>/
cd <path> && git init && git add -A && git commit -m "commons: initial scaffold"
```

Set `commons_path` in `~/.academician/config.json` to that path.

Ask about visibility before creating any remote. The commons often ends up
holding extracts from many projects, including private ones — **default to
private** and make the user say otherwise explicitly. Do not create a remote
without a clear yes.

## `search <terms>`

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/acad.mjs commons search "<terms>"
```

Report hits with their confidence and `verified_on`, then say for each whether
it looks reusable as-is, needs refreshing, or is a topical-but-not-relevant
match. That judgment is the useful part — a raw hit list makes the user do the
work the command exists to do.

## `show <id>`

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/acad.mjs commons show <id>
```

Print the entry. For a claim, also resolve its supporting and contradicting
cards so the user sees the evidence rather than just the statement.

## `index`

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/acad.mjs commons index
```

Rebuilds `INDEX.md` and `refs.bib`. Commit after.

## `stale`

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/acad.mjs commons stale
```

Report claims past the staleness window. Do not refresh them all — refreshing
means new searching, which is expensive. Refresh what a current project depends
on; list the rest.

## `health`

A full sweep. Dispatch `acad-librarian` to run the checks in the
`research-commons` skill: stale claims, near-duplicate claims, orphaned cards,
and dead links.

The librarian **proposes** merges and reports findings; it does not merge
without the user agreeing. Present duplicates as pairs with both statements so
the user can see whether they are genuinely the same claim.

## Contributing back

Promotion happens automatically at a project's `ship` stage. To promote from a
finished project manually, dispatch `acad-librarian` with the project path.

Only verified material moves, and if the project is private, only what the
user has cleared. When in doubt about visibility or licensing, ask — a private
extract promoted into a shared commons is not retractable in any meaningful
sense.

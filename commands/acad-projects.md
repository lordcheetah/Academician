---
description: List, inspect, register, or retire Academician research projects
argument-hint: [list|show <slug>|add <slug>|remove <slug>|related <terms>]
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
---

Manage the project registry at `~/.academician/registry.json`. The registry is
private user state and is never committed to the Academician repo.

Arguments: `$ARGUMENTS`

## `list` (default)

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/acad.mjs project list
```

Group the output by status. Call out: anything blocked, anything whose path is
missing from disk, and anything at or near an iteration budget.

Filters: `--topic <t>`, `--status <active|complete|archived|abandoned>`.

## `show <slug>`

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/acad.mjs project show <slug>
```

Add context the raw record does not have: read the project's `BRIEF.md`
question and, if it exists, the last entry in `DECISIONS.md`. A registry row
plus the question plus the last decision is usually enough to remember where
a project was.

## `add <slug> --path <dir>`

Register a project that exists on disk but is not in the registry — after
cloning one on a new machine, for instance.

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/acad.mjs project add <slug> --path <abs-path> \
  --title "<title>" --visibility <private|public> --topics "<a,b>"
```

If the directory has no `.academician/`, it is not an Academician project.
Offer to scaffold one into it rather than registering something the pipeline
cannot run.

## `remove <slug>`

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/acad.mjs project remove <slug>
```

Unregisters only. Files and git history are untouched — say so, so the user
does not think their work is gone.

Before removing a project that never shipped, ask whether to run
`acad-librarian` over it first. An abandoned project often has verified
evidence worth keeping in the commons even though the paper died.

## `related <terms>`

Find prior work relevant to a new question. Run both:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/acad.mjs project list --topic <term>
node ${CLAUDE_PLUGIN_ROOT}/scripts/acad.mjs commons search "<terms>"
```

Then read the `BRIEF.md` question of each matching project and report: what
was already asked, what was established, and what a new project could start
from rather than redo. Point at specific claim ids.

This is worth running before every new project. It is the mechanism by which
the second paper on a topic is cheaper than the first, and it only works if
someone actually looks.

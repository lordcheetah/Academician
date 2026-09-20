---
description: Show where an Academician project stands — stage, iteration budgets, pending gates, and artifact health
argument-hint: [--project <path>] [--all]
allowed-tools: Read, Bash, Glob, Grep
---

Report the state of a research project. Read-only — this command changes
nothing.

## With `--all`

List every registered project and stop there:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/acad.mjs project list
```

Flag anything blocked, anything missing from disk, and anything that has sat at
the same stage a long time.

## For one project

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/acad.mjs state show
```

Then check the artifacts against the stage, because state and disk can drift
if someone edited files by hand:

| Stage reached | Should exist |
|---|---|
| `plan` | `BRIEF.md` |
| `research` | `PLAN.md` |
| `evidence-check` | cards in `evidence/cards/` |
| `outline` | `evidence/AUDIT.md` with a PASS |
| `draft` | `draft/OUTLINE.md` |
| `draft-check` | `draft/DRAFT.md` |
| `write` | `draft/CHECK.md` with a PASS |
| `review` | `paper/PAPER.md`, `paper/refs.bib` |
| `edit` | three files in `review/` |
| `ship` | `review/RESPONSE.md` |

Also check:

- **`ESCALATION.md` present** — the run is blocked; read it and lead with it.
- **Stray markers** — grep `paper/PAPER.md` for `[[` and `NEEDS-EVIDENCE`.
  Either means the writing stage did not finish cleanly.
- **Orphan references** — every `[[id]]` in `draft/DRAFT.md` resolving to a
  real file in `evidence/`.
- **`DECISIONS.md`** — the last gate decision and its notes.

## Report

Write a short summary, not a dump:

1. **Where it is** — stage, status, and the one-line reason if blocked.
2. **Budgets** — iterations used against each loop's limit. Call out anything
   at or near its limit, since that is the thing most likely to derail the run.
3. **Pending gate**, if any, and what the user would be deciding.
4. **Health problems** — drift between state and artifacts, stray markers,
   dangling references.
5. **Next action** — the specific command to run.

If everything is clean and nothing is pending, say so in two lines. Do not pad
a healthy status report.

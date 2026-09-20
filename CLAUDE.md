# Working on Academician

This repo is a Claude Code plugin — the agent loop itself. It contains no
research and no papers.

## Do not put projects here

Research projects are independent sibling repositories tracked in the private
registry at `~/.academician/registry.json`. Nothing about a user's projects
belongs in this repo: not files, not names, not topics. `registry.json` and
`config.json` are gitignored at the root for exactly this reason — if either
ever appears in `git status` here, something has gone wrong.

## Layout

| Path | What it is |
|---|---|
| `skills/` | The protocol. `academician-loop` is the pipeline; `evidence-standards` and `research-commons` are the rules it enforces. |
| `agents/` | Eleven subagent definitions, one per pipeline role. |
| `commands/` | Slash commands — thin drivers that load a skill and dispatch agents. |
| `scripts/acad.mjs` | Deterministic state, registry, and commons operations. |
| `templates/` | Scaffolds copied into new projects and new commons repos. |
| `schemas/` | JSON Schema for `project.json`, `run-state.json`, `registry.json`. |

## Where behavior belongs

Put it in the **skill** when it is a rule the pipeline enforces — stage
contracts, gate protocol, evidence format. Skills are the single source of
truth and agents defer to them.

Put it in the **agent** when it is how one role does its job. Agents should not
restate skill content; they should say "read the `evidence-standards` skill"
and then cover what is specific to that role.

Put it in the **command** when it is orchestration — which agent runs, in what
order, with what inputs. Commands stay thin.

Put it in **`acad.mjs`** when it must be reliable rather than persuasive. State
transitions, budget enforcement, and gate blocking live in the script
specifically so they are not subject to a model deciding the rule does not
apply this time. Resist moving that logic into prose.

## Invariants

These are the properties the system exists to provide. Changing any of them is
a design decision, not a refactor:

1. **Gate blocking is enforced in code.** `state advance` refuses to move past
   an unanswered gate. Do not add a code path that bypasses it, and do not
   soften `--force`.
2. **Budget exhaustion blocks and exits 3.** It never degrades into "pass
   anyway".
3. **Iteration counters increment before the retry**, so a crashed retry still
   counts. Off-by-one here makes budgets meaningless.
4. **The run-state file is the only authority on pipeline position.** Nothing
   should infer the stage from which files exist.
5. **Card ids are stable.** Renaming one breaks every reference, including in
   the commons.
6. **Verification is done by a different agent than retrieval.** Do not merge
   `acad-researcher` and `acad-evidence-checker`, however tempting the token
   savings.
7. **Reviewers do not edit.** Only `acad-editor` revises after the write stage.

## Editing skills and agents

- Frontmatter `description` is the trigger. It should be specific about *when*,
  and slightly pushy — these undertrigger otherwise.
- Keep `SKILL.md` under ~500 lines; push detail into `references/` with a
  pointer saying when to read it.
- Agent frontmatter needs `name`, `description`, `model`, and `tools`. Give
  each agent the narrowest tool set that lets it work — reviewers have no
  `Edit` for a reason.

## Testing changes to acad.mjs

There is no test suite. Exercise it against a scratch project:

```bash
mkdir -p /tmp/t && cp -r templates/project/. /tmp/t/
node scripts/acad.mjs state show --project /tmp/t
node scripts/acad.mjs state advance --project /tmp/t
node scripts/acad.mjs state advance --project /tmp/t   # must refuse: scope gate
node scripts/acad.mjs gate log scope approve "ok" --project /tmp/t
node scripts/acad.mjs state advance --project /tmp/t   # now proceeds
```

For commons and registry commands, override `HOME`/`USERPROFILE` to a scratch
directory so you do not write to the real `~/.academician/`.

Check at minimum: the gate refusal above, and that `state iterate` exits 3 and
sets `status: blocked` when a budget is spent.

## Style

Prose in skills and agents is instruction, so write it as instruction:
imperative, concrete, and specific about the failure it prevents. A rule that
says why it exists gets followed; one that reads as boilerplate gets skimmed.
Avoid padding these files to look thorough — every line is context an agent
pays for.

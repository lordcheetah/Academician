---
name: academician-loop
description: Runs the Academician research-to-paper pipeline — planner, researcher, evidence checker, drafter, draft checker, writer, reviewer panel, editor — with per-stage iteration budgets and human approval gates. Use this skill whenever the user is working on a research project or academic paper in a directory containing .academician/, whenever they invoke /acad-run, /acad-status, /acad-gate or /acad-new, and whenever they ask to start, resume, advance, or check the state of a paper, literature review, or deep research project. Also use it when they ask to run research "through the loop", to iterate on a draft until reviewers pass, or to pull prior findings from the research commons into a new paper.
---

# Academician Loop

A staged pipeline that turns a research question into a defensible paper. Every
stage has one job, an explicit pass test, and an iteration budget. Stages that
fail their test loop back and retry. Stages that exhaust their budget escalate
to the human rather than passing bad work downstream.

**The rule that makes this worth running: nothing enters the paper that is not
traceable to a verified source card.** See the `evidence-standards` skill.

## Before anything else

1. Locate the project. The current directory is a project if `.academician/project.json`
   exists. If not, and the user is asking to work on a paper, either `cd` to the
   registered project or run `/acad-new`.
2. Read `.academician/project.json` (config) and `.academician/run-state.json` (position).
3. Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/acad.mjs state show` to print the current
   stage, iteration counts, and the next gate. Never infer state from the files
   alone — the state file is authoritative.

## Stages

| # | Stage | Agent | Produces | Budget key |
|---|-------|-------|----------|------------|
| 0 | `intake` | main session | `BRIEF.md` | — |
| 1 | `plan` | `acad-planner` | `PLAN.md` | `plan` |
| 2 | `research` | `acad-researcher` (parallel) | `evidence/cards/*.md` | `research` |
| 3 | `evidence-check` | `acad-evidence-checker` | `evidence/AUDIT.md` | `research` |
| 4 | `outline` | `acad-drafter` | `draft/OUTLINE.md` | `draft` |
| 5 | `draft` | `acad-drafter` | `draft/DRAFT.md` | `draft` |
| 6 | `draft-check` | `acad-draft-checker` | `draft/CHECK.md` | `draft` |
| 7 | `write` | `acad-writer` | `paper/PAPER.md` | `review` |
| 8 | `review` | 3 reviewer agents (parallel) | `review/REVIEW-*.md` | `review` |
| 9 | `edit` | `acad-editor` | revised `paper/PAPER.md`, `review/RESPONSE.md` | `review` |
| 10 | `ship` | `acad-librarian` | commons contribution, exports | — |

Read `references/stages.md` for each stage's full contract: inputs, outputs,
pass test, and what a failure loops back to. Read it before running any stage
for the first time in a session.

## The three loops

Each loop retries until its pass test is met or its budget is spent.

- **Loop A — evidence** (stages 2 and 3). Fails back to `research` with the
  specific gaps named in `evidence/AUDIT.md`. Budget: `max_iterations.research`.
- **Loop B — draft** (stages 5 and 6). Fails back to `draft`, or all the way back
  to `research` if `draft/CHECK.md` reports an evidence gap rather than a writing
  problem. Budget: `max_iterations.draft`.
- **Loop C — review** (stages 7 through 9). The editor revises; reviewers
  re-review the changed sections plus anything they flagged. Budget:
  `max_iterations.review`.

Increment the counter with `acad.mjs state iterate <loop>` **before** the retry,
not after. A loop already at budget must not start another iteration.

### When a budget runs out

Do not pass the stage. Do not quietly lower the bar. Write `ESCALATION.md` in the
project root containing:

- which loop exhausted, and the budget it hit
- each unmet pass criterion, quoted from the checker report
- what changed across iterations — did it converge, oscillate, or stall?
- three concrete options for the human: raise the budget, narrow the scope, or
  accept the known weakness and record it as a stated limitation in the paper

Then set state to `blocked` and surface it. A stalled loop is information, not a
failure to hide.

## Human gates

Gates are where the human decides, and they are the reason this is a pipeline
rather than one long prompt. The gate set is configured per project in
`project.json` under `gates`. Default (`standard`): `scope`, `evidence`, `draft`,
`final`.

| Gate | Fires after | The human is deciding |
|------|-------------|----------------------|
| `scope` | stage 1 | Is this the right question, framed the right way, with the right boundaries? |
| `plan` | stage 1 | (optional) Is the search strategy adequate and unbiased? |
| `evidence` | Loop A passes | Is the evidence base sufficient, and honest about what it does not cover? |
| `outline` | stage 4 | (optional) Does the argument structure hold? |
| `draft` | Loop B passes | Is the argument right, before effort goes into prose? |
| `final` | Loop C passes | Ship it? |
| `ship` | stage 10 | (optional) What gets contributed back to the commons, and is anything embargoed? |

### Running a gate

1. Summarize in the chat: what the stage produced, what the checker found, how
   many iterations it took, and anything you are uneasy about. Lead with the
   uneasy part. A gate where you report only good news is a wasted gate.
2. Ask with `AskUserQuestion`. Always offer at least: **Approve**, **Revise (with
   notes)**, **Reject / rethink**. Add gate-specific options where a real fork
   exists — at `evidence`, for instance, "approve but narrow the claim".
3. Record the decision, verbatim notes included, by appending to `DECISIONS.md`
   via `acad.mjs gate log`. The log is the audit trail; a paper defended later is
   defended from this file.
4. On **Revise**, the notes become a hard constraint on the retry. Pass them into
   the agent prompt as explicit requirements, not as background context.
5. On **Reject**, stop. Do not improvise a new direction.

Never advance past a configured gate without an answer, even when the work looks
finished and even in a long unattended run. If the human is not available, set
state to `awaiting-gate` and stop.

## Running the loop

`/acad-run` drives forward from the current state. Each cycle:

1. `acad.mjs state show` gives the current stage.
2. Run that stage's agent per `references/stages.md`. Give the agent the project
   path, the specific artifacts it needs, and — on a retry — the failure report
   plus any human revision notes.
3. Apply the pass test. Record the verdict.
4. Advance, loop back, or escalate.
5. If a gate fires here, run it before continuing.
6. Commit. One commit per stage completion, message `acad(<stage>): <summary>`.

Stop conditions: `ship` completed, a gate answered Reject, a budget exhausted, or
the user interrupts. Report where you stopped and why.

## Parallelism

Run these concurrently in a single message — they are independent:

- **Researchers**: one agent per subquestion in `PLAN.md`. Each writes its own
  cards into `evidence/cards/` with a distinct filename prefix so they cannot
  collide.
- **Reviewers**: `acad-reviewer-method`, `acad-reviewer-contribution`, and
  `acad-reviewer-clarity` read the same paper and write separate files.

Never parallelize a checker stage — a checker must see the complete artifact.

## The research commons

Prior verified work is reusable. See the `research-commons` skill for the full
protocol. In brief:

- At `plan`, search the commons for existing claims on the topic. Anything already
  verified there does not need re-researching — cite the claim id and move on.
  Record what was pulled in `PLAN.md` under "Reused from commons".
- At `ship`, the librarian promotes newly verified claims and their cards back to
  the commons, tagged with the project they came from.
- If the project is private and the commons is shared, the `ship` gate is where
  the human decides what may be promoted. Default to not promoting when unsure.

## Delegated skills

`~/.academician/config.json` names the skills this loop hands off to, under
`integrations`. Check it at the start of a run:

- `research_skill` — invoked by `acad-researcher` for retrieval. Unset: the
  researcher falls back to WebSearch/WebFetch plus any connected MCP sources.
- `paper_skill` — invoked by `acad-writer` for structure and formatting
  conventions. Unset: the writer follows `references/paper-structure.md`.
- `style_skill` — invoked by `acad-writer` for the prose pass.
- `citation_style` — a string such as `APA`, `Chicago`, `IEEE`. Default `APA`.

A named skill that is not installed is a configuration error: say so plainly at
the start of the run and continue with the fallback rather than failing.

## What not to do

- Do not write prose before `draft-check` passes. Loop B protects Loop C time.
- Do not let a reviewer agent edit the paper. Reviewers report; the editor revises.
- Do not add a citation at the writing stage. If the writer needs support that is
  not in the evidence base, that is a Loop B failure — send it back.
- Do not mark a stage complete in the state file before its artifact is written.
- Do not summarize away a contradiction found in the sources. Contradictions go
  in the paper.

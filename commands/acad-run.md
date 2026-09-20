---
description: Drive the Academician pipeline forward from wherever it is, stopping at human gates
argument-hint: [--to <stage>] [--project <path>]
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent, AskUserQuestion, Skill, WebSearch, WebFetch
---

Advance the research pipeline from its current state.

**Load the `academician-loop` skill now.** It defines the stages, the loops,
the budgets, and the gate protocol. `references/stages.md` in that skill has
each stage's full contract — read it before running a stage for the first time
this session.

## Start

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/acad.mjs doctor
node ${CLAUDE_PLUGIN_ROOT}/scripts/acad.mjs state show
```

`doctor` exits 1 on a real problem. Report any FAIL line to the user before
running a stage — a missing integration silently falling back to WebSearch is
the kind of thing that is obvious in the output and invisible in the result.
Warnings are fine to note in one line and continue.

If this fails because there is no project here, ask whether to `cd` to a
registered one (`acad project list`) or start a new one (`/acad-new`).

Report the state to the user in one or two lines before doing anything:
current stage, iterations used against budget, and whether a gate is pending.
If `status` is `blocked`, read `ESCALATION.md` and take it to the user rather
than continuing.

## Then loop

For each cycle:

1. **Run the stage** per its contract. Dispatch the stage's agent with: the
   project path, the specific artifacts it needs, and — on a retry — the
   checker's report and any human revision notes as explicit requirements.

   Parallelize where the contract says to: one researcher per subquestion,
   three reviewers at once, each in a single message with multiple tool calls.

2. **Apply the pass test.** Read the checker's verdict. Do not substitute your
   own judgment for a checker's verdict — if you disagree with it, say so to
   the user rather than overriding it silently.

3. **Route:**
   - Pass → `acad state advance`
   - Fail → `acad state iterate <loop>` then re-run the failed stage. The
     script exits 3 and blocks the project if the budget is spent; when that
     happens, write `ESCALATION.md` per the skill and stop.
   - `REVISE-EVIDENCE` from the draft checker → back to `research`, not `draft`.

4. **Gate, if one fires here.** `state advance` refuses to move past an
   unanswered gate, which is the intended behavior — do not use `--force` to
   get around it. Run the gate as the skill describes: summarize honestly,
   ask with `AskUserQuestion`, log with `acad gate log`.

5. **Commit** in the project repo: `acad(<stage>): <one-line summary>`.

6. Continue to the next stage.

## Stopping

Stop when: `ship` completes, a gate is answered Reject, a budget is exhausted,
`--to <stage>` is reached, or the user interrupts.

Arguments: `$ARGUMENTS`. `--to <stage>` runs until that stage completes.
`--project <path>` targets a project other than the current directory.

## Reporting

At every stop, tell the user:

- where the pipeline is, and why it stopped
- what was produced, with file paths
- what the checker found — the problems, not just the verdict
- iterations consumed against budget
- what happens next, and what you need from them

Lead with anything that went wrong or that you are unsure about. A run report
that reads as uniformly successful is not a useful report, and the gates exist
precisely so the user can catch what the checkers did not.

## Do not

- Advance past a configured gate without an answer, however finished the work
  looks and however long the run has been unattended.
- Start an iteration on a loop that is at budget.
- Write prose before `draft-check` passes.
- Edit the paper yourself at the review stage — that is the editor's job.
- Add or change a citation outside the research and evidence-check stages.

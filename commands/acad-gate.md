---
description: Run a pending human approval gate, or re-open a decision already logged
argument-hint: [gate-name] [--project <path>]
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion, Skill
---

Run a human approval gate. Normally `/acad-run` reaches gates on its own; use
this to run one directly, to revisit a logged decision, or to resume a project
left at `awaiting-gate`.

Load the `academician-loop` skill for the gate protocol.

## 1. Find the gate

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/acad.mjs state show
```

The pending gate is named in the output. If `$ARGUMENTS` names a different
gate, and it has already been passed, confirm the user wants to re-open it —
re-opening an approved gate usually means reverting work.

## 2. Prepare the user to decide

This is the part that matters. A gate where you present a summary and the user
says "looks good" has cost time and bought nothing. Give them what they need
to actually judge.

Read the stage's artifacts and the checker's report, then write a briefing:

- **What was produced**, with paths so they can read it themselves.
- **What the checker found** — quote the specific findings, not the verdict.
- **How many iterations** it took, and what changed across them. A stage that
  passed on iteration three is different from one that passed immediately.
- **What you are uneasy about.** Lead with this. You have read everything and
  the user has not; the thing you noticed and cannot quite justify flagging is
  usually the most valuable thing in the briefing.
- **What is being decided**, concretely, and what each option costs.

Gate-specific things to surface:

| Gate | Put in front of the user |
|---|---|
| `scope` | Where the planner's restatement differs from the brief. Whether the brief presumes its answer. |
| `plan` | Subquestions you think are weak; whether the falsification plan is real or decorative. |
| `evidence` | Struck cards and why. Subquestions that just barely met their minimum. Independence problems. Contradictions found. |
| `outline` | The thesis, stated plainly. Any step in the argument chain that feels thin. |
| `draft` | Claims the checker narrowed. Anywhere the evidence pointed away from the brief's expectation. |
| `final` | Unresolved reviewer disagreements. The editor's declined findings. Re-read "what would change my mind" from `BRIEF.md` against the conclusion. |
| `ship` | Exactly what would be promoted to the commons, and anything with licensing or confidentiality concerns. |

## 3. Ask

Use `AskUserQuestion`. Always offer at least:

- **Approve** — proceed to the next stage
- **Revise** — with notes; the notes become requirements on the retry
- **Reject** — stop the pipeline

Add a gate-specific fourth option where a real fork exists. At `evidence`:
"approve, but narrow the claim to what the evidence supports". At `final`:
"approve, but record the disagreement as a stated limitation". These middle
paths are often the right answer and the user will not think to ask for them.

## 4. Log it

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/acad.mjs gate log <gate> <approve|revise|reject> "<notes>"
```

Pass the user's notes **verbatim**. Do not paraphrase them into your own
summary — `DECISIONS.md` is the audit trail, and a paraphrase is your reading
of what they said, which is not the same thing.

## 5. Act

- **Approve** → `acad state advance`, then continue with `/acad-run`.
- **Revise** → re-run the stage with the notes as explicit requirements in the
  agent prompt, after `acad state iterate <loop>`. Quote the notes to the agent.
- **Reject** → stop. Report where things stand and what the artifacts are. Do
  not improvise a new direction; ask what they want instead.

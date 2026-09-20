# Academician

A Claude Code plugin that runs research and academic writing as a gated,
iterative pipeline instead of one long prompt.

Eleven agents, three retry loops, four human checkpoints, and a shared corpus
of verified findings that carries between papers.

## The idea

Asking a model to "research X and write a paper" produces something that looks
like a paper. The citations may or may not exist, the claims may or may not be
supported by the sources attached to them, and nobody — including the model —
can tell which without re-doing the work.

Academician splits that into stages with different jobs and different agents,
and puts a check between each one:

```
intake ─► plan ─► research ─► evidence-check ─┐
                     ▲                        │ REVISE (Loop A)
                     └────────────────────────┘
                                │ PASS
                     [ human gate: evidence ]
                                ▼
                 outline ─► draft ─► draft-check ─┐
                              ▲                   │ REVISE (Loop B)
                              └───────────────────┘
                                │ PASS
                      [ human gate: draft ]
                                ▼
                    write ─► review ─► edit ─┐
                              ▲              │ findings open (Loop C)
                              └──────────────┘
                                │ all ACCEPT/MINOR
                      [ human gate: final ]
                                ▼
                              ship ─► research commons
```

Each loop retries until it passes or spends its iteration budget. A loop that
runs out does not quietly pass — it writes `ESCALATION.md` saying exactly what
failed to converge and stops for a human.

**The load-bearing rule:** nothing enters the paper that is not traceable to a
verified source card carrying a verbatim quoted passage. The evidence checker
resolves every DOI and confirms every quote against the actual source before
drafting starts. The draft checker then compares every sentence against the
quote behind it, which is what catches the quiet overreach — correlation cited
as causation, a single-population result stated as general, a hedge dropped in
the rewrite.

Both checks are **mechanical, not model judgment**:

```bash
acad verify evidence    # cards with no verbatim passage
acad verify draft       # dangling refs, uncited assertions, unsupported claims
```

Every claim is extracted, its `[[card-id]]` markers resolved, and its support
scored against the stored quotes by deterministic entity, number, and lexical
checks with no LLM in the loop. A sentence reading "entropy rises under all
forms of shift in every model" backed by a quote about one architecture above
0.3 shift comes back `partial` — which is exactly the overreach a model
reviewing its own work tends to wave through. The checker agents read these
results and are forbidden from overruling them.

This layer is vendored from
[claude-deep-research-skill](https://github.com/199-biotechnologies/claude-deep-research-skill)
(MIT, Boris Djordjevic) — see [vendor/deep-research-verify/NOTICE.md](vendor/deep-research-verify/NOTICE.md).
Its 45 tests ship with it: `acad verify test`.

## Install

```bash
/plugin marketplace add lordcheetah/Academician
/plugin install academician@academician
```

Then:

```bash
node ~/.claude/plugins/.../academician/scripts/acad.mjs init
```

or just run `/acad-new` and it will offer to initialize on first use.

## Use

```bash
/acad-new                # scaffold a project, gather the brief, register it
/acad-run                # drive the pipeline forward; stops at gates
/acad-status             # where it is, what is pending, budget health
/acad-gate               # run a pending gate, or re-open a logged decision
/acad-projects related "<terms>"   # what have I already researched?
/acad-commons search "<terms>"     # what has already been established?
```

Check the wiring at any time:

```bash
acad doctor --tests
```

It resolves every integration slot against the skills actually installed,
checks the commons and the verification layer, and runs the vendored tests.

## Agents

| Agent | Job |
|---|---|
| `acad-planner` | Decomposes the question into researchable subquestions with search strategies and a falsification plan |
| `acad-researcher` | One per subquestion, in parallel; reads sources and writes quoted cards |
| `acad-evidence-checker` | Resolves every citation, confirms every quote, judges coverage and independence |
| `acad-drafter` | Builds the argument — outline, then full draft with every assertion referenced |
| `acad-draft-checker` | Finds uncited claims, dangling references, and overreach against the sources |
| `acad-writer` | Turns the checked argument into a paper; may not change what is claimed |
| `acad-reviewer-method` | Peer review: does the evidence support the conclusions? |
| `acad-reviewer-contribution` | Peer review: is it new, and does it engage the right prior work? |
| `acad-reviewer-clarity` | Peer review: can it be followed on one read? |
| `acad-editor` | Reconciles the three reviews, resolves conflicts, revises |
| `acad-librarian` | Promotes verified findings to the commons without corrupting it |

Reviewers run in parallel with distinct mandates so they produce three
different reviews rather than three copies of one.

## Repository layout

Academician is public. **Research projects are not in this repo.** Each project
is its own independent repository, public or private as you choose, and a
private registry at `~/.academician/registry.json` points at them.

```
GitHub/
├── Academician/          this plugin (public)
├── research-commons/     verified claims and cards (visibility your choice)
├── paper-alpha/          a project (public)
└── paper-beta/           a project (private)
```

Nothing about your projects — not their names, not their topics — lives in this
repo.

## The research commons

A standalone repository of verified claims and the source cards behind them,
shared across papers.

At the planning stage the pipeline searches it: a claim already verified does
not get re-researched, it gets cited. At ship, new verified claims are promoted
back. Over time the second paper on a topic costs much less than the first.

Rules that keep it from rotting:

- Only verified material is promoted.
- A claim's scope is never widened to fit a new project — you get a sibling
  claim with its own boundary instead.
- Contradicting evidence makes a claim `contested`, with both positions kept.
  It never silently overwrites, because the next project has no way to know
  that happened.

## Human gates

Four by default: `scope`, `evidence`, `draft`, `final`. Configurable per
project to `minimal` (two), `standard` (four), `all` (seven), or an explicit
list.

At each gate the pipeline summarizes what happened — including what the
checkers found and what it is unsure about — and asks. Every decision, with
your notes verbatim, is appended to the project's `DECISIONS.md`. That file is
how a paper gets defended six months later.

The state machine refuses to advance past an unanswered gate. That is enforced
in `scripts/acad.mjs`, not left to the model's discretion.

## Configuration

`~/.academician/config.json`:

```json
{
  "commons_path": "/path/to/research-commons",
  "default_visibility": "private",
  "integrations": {
    "research_skill": "academic-research-skills:deep-research",
    "paper_skill": "academic-research-skills:academic-paper",
    "reviewer_skill": "academic-research-skills:academic-paper-reviewer",
    "style_skill": null,
    "citation_style": "APA"
  },
  "defaults": {
    "gates": "standard",
    "max_iterations": { "plan": 2, "research": 3, "draft": 3, "review": 3 },
    "min_sources": 3,
    "staleness_days": 365
  }
}
```

**Integrations** are where the heavy per-stage work is delegated. Academician
is the orchestrator, the registry, and the commons; it does not try to
out-write a dedicated writing plugin.

The defaults point at
[academic-research-skills](https://github.com/Imbad0202/academic-research-skills)
(CC BY-NC 4.0), which is excellent at the per-paper work Academician
deliberately does not duplicate:

```bash
/plugin marketplace add Imbad0202/academic-research-skills
/plugin install academic-research-skills
```

| Slot | Default | Fallback if unset or missing |
|---|---|---|
| `research_skill` | `academic-research-skills:deep-research` | WebSearch/WebFetch |
| `paper_skill` | `academic-research-skills:academic-paper` | built-in structures |
| `reviewer_skill` | `academic-research-skills:academic-paper-reviewer` | the three built-in reviewer agents |
| `style_skill` | unset | no dedicated prose pass |

Everything degrades gracefully: an unset or uninstalled slot is reported at the
start of the run and the fallback is used.

**Note the licence.** `academic-research-skills` is CC BY-NC 4.0 —
NonCommercial. Academician itself is MIT and never vendors its content, so the
NC term applies only if you install it. Clear the integration slots to run
fully MIT.

**One orchestrator.** That plugin also ships `academic-pipeline`, its own
end-to-end orchestrator. Academician calls its *component* skills and never
`academic-pipeline` — two orchestrators would each impose their own gates and
the state file would stop reflecting reality.

Per-project settings live in `<project>/.academician/project.json` and override
the defaults.

## Skills

| Skill | Use |
|---|---|
| `academician-loop` | The pipeline protocol: stages, loops, budgets, gates |
| `evidence-standards` | Source card and claim formats, verification rules, citation discipline |
| `research-commons` | Reading from and contributing to the shared corpus |

`evidence-standards` is useful on its own, outside the full loop, whenever work
needs every assertion traceable to a real checked source.

## License

MIT

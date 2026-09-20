# Stage contracts

One section per stage. Each gives inputs, the agent to dispatch, the artifact it
must produce, the pass test, and where a failure sends the pipeline.

Contents:

- [0. intake](#0-intake)
- [1. plan](#1-plan)
- [2. research](#2-research)
- [3. evidence-check](#3-evidence-check)
- [4. outline](#4-outline)
- [5. draft](#5-draft)
- [6. draft-check](#6-draft-check)
- [7. write](#7-write)
- [8. review](#8-review)
- [9. edit](#9-edit)
- [10. ship](#10-ship)

---

## 0. intake

**Agent:** none — the main session does this with the human.

**Produces:** `BRIEF.md`

Do not delegate intake. It is a conversation, and the quality of everything
downstream is set here.

Establish, and write down:

- The question, stated as a question. If it cannot be phrased as a question with
  a knowable answer, the project is not ready.
- Why it matters, and to whom. Name the audience — a methods paper for
  specialists and a review for practitioners diverge from the first outline.
- Scope boundaries, both sides. What is deliberately excluded matters as much as
  what is included, and it is the thing reviewers probe.
- The kind of output: empirical paper, literature review, position paper,
  technical report, case study. This selects the structure at stage 7.
- Target length and venue conventions, if known.
- Prior work by this author to build on — check the registry for related
  projects with `acad.mjs project list --topic <topic>`.
- What would change the author's mind. Write it down now, while it is cheap to
  be honest, and check it again at the `final` gate.

**Pass test:** the human approves `BRIEF.md` at the `scope` gate (fired after
stage 1, so the plan is reviewed together with the brief).

---

## 1. plan

**Agent:** `acad-planner`

**Inputs:** `BRIEF.md`, commons search results

**Produces:** `PLAN.md`

The plan decomposes the question into subquestions that can each be answered by
evidence, and states how each will be searched.

`PLAN.md` must contain:

1. **Restated question** — the planner's own phrasing, which surfaces
   misreadings early.
2. **Subquestions** — each with an id (`SQ1`, `SQ2`, …), each independently
   researchable, together sufficient to answer the main question. Five to nine is
   typical; more than a dozen means the scope is too wide.
3. **Per subquestion:** what kind of evidence would answer it, what would count
   as strong versus weak support, where to search, and the minimum number of
   independent sources required.
4. **Reused from commons** — claim ids already verified that cover a subquestion,
   with a note on whether they need refreshing (check `verified_on`; anything
   older than the project `commons.staleness_days` needs re-verification).
5. **Inclusion and exclusion criteria** — explicit, so the researcher is not
   improvising them per source.
6. **Known controversy** — where the planner expects the literature to disagree.
   Naming this in advance is what stops the researcher from collecting one side.
7. **Falsification plan** — for the central claim, what evidence would count
   against it, and where to look for that evidence specifically.

**Pass test:** every subquestion has a search strategy and a source minimum; the
falsification plan names concrete searches, not a disclaimer.

**Gate:** `scope` (and optionally `plan`).

**On failure:** re-run the planner with the checker notes. Budget
`max_iterations.plan`, default 2.

---

## 2. research

**Agent:** `acad-researcher`, one per subquestion, dispatched in parallel.

**Inputs:** `PLAN.md`, the assigned subquestion, `evidence/AUDIT.md` if this is a
retry, the commons index.

**Produces:** `evidence/cards/<SQid>-<slug>.md`, one card per source. Card format
is defined in the `evidence-standards` skill.

Each researcher:

1. Searches the commons first. An existing verified claim is cited, not redone.
2. Searches per the plan strategy, using `research_skill` if configured.
3. Reads the actual source. A card may not be written from an abstract, a search
   snippet, or another paper citing it. If the full text is unreachable, the card
   is marked `access: abstract-only` and the checker will discount it.
4. Writes one card per source, including verbatim key passages with locators
   (page, section, or timestamp). The verbatim passage is the anti-hallucination
   mechanism — everything downstream can be checked against it.
5. Records sources that were searched and found empty. Absence of evidence is a
   finding, and `evidence/gaps.md` is where it goes.
6. Flags contradictions with other cards rather than resolving them.

**Retry behavior:** on a retry, a researcher works only the gaps named in
`AUDIT.md` for its subquestion. It does not re-collect what already passed.

**Pass test:** none at this stage — stage 3 judges it.

---

## 3. evidence-check

**Agent:** `acad-evidence-checker`. Never parallelized.

**Inputs:** `PLAN.md`, all of `evidence/cards/`, `evidence/gaps.md`.

**Produces:** `evidence/AUDIT.md` with a verdict of `PASS` or `REVISE`.

The checker audits the evidence base as a whole:

- **Coverage** — does every subquestion meet its source minimum?
- **Verification** — does every card cite a real, reachable source? Spot-check
  every DOI and URL. A card whose source cannot be resolved is struck, not
  softened. This check catches fabricated citations, and it is the single most
  valuable thing the checker does.
- **Faithfulness** — does each card summary match its own verbatim passages? A
  summary that overstates its quote is a rewrite, not a rejection.
- **Independence** — are the sources for a subquestion genuinely independent, or
  do they trace to one origin? Five papers citing one dataset is one source.
- **Quality mix** — flag a subquestion resting only on preprints, blog posts, or
  vendor material.
- **Balance** — was the falsification plan actually executed? If the plan named
  disconfirming searches and no card reflects them, that is a `REVISE`.
- **Contradictions** — collate them with the cards on each side. Never resolve
  them here.

`AUDIT.md` structure: verdict line, then a table of subquestion by status, then a
numbered gap list where each gap says what is missing and what search would close
it. Vague gaps produce vague retries.

**Pass test:** verdict is `PASS`, meaning every subquestion meets its minimum
with verified, sufficiently independent sources, and the falsification searches
were run.

**On failure:** Loop A back to stage 2 with the gap list. Budget
`max_iterations.research`, default 3.

**Gate:** `evidence`.

---

## 4. outline

**Agent:** `acad-drafter`

**Inputs:** `BRIEF.md`, `PLAN.md`, `evidence/cards/`, `evidence/AUDIT.md`.

**Produces:** `draft/OUTLINE.md`

The outline is the argument, not a table of contents. For each section:

- the section heading and its one-sentence job in the argument
- the claims it makes, each as a claim id with its supporting card ids
- what a skeptical reader objects to here, and where that objection is answered

Also required:

- **Thesis** in one sentence.
- **Argument chain** — the ordered list of claims from premise to conclusion,
  so a gap in the logic is visible before any prose exists.
- **Orphan check** — cards not used anywhere. Either they belong somewhere or
  the research over-collected; say which.
- **Unsupported check** — any claim in the chain with no card behind it. This
  must be empty before drafting. If it is not, the argument needs evidence that
  was never gathered, which is a Loop A failure, not a drafting problem.

**Pass test:** thesis present, argument chain complete, unsupported check empty.

**Gate:** `outline` (optional).

---

## 5. draft

**Agent:** `acad-drafter`

**Inputs:** `draft/OUTLINE.md`, `evidence/cards/`, plus `draft/CHECK.md` and human
revision notes on a retry.

**Produces:** `draft/DRAFT.md`

This is the argument in full sentences, not finished prose. Substance over
style — the writer handles style at stage 7, and polishing now wastes that work.

Rules:

- Every assertion carries an inline claim or card reference in the form
  `[[claim-id]]` or `[[card-id]]`. No exceptions, including in the introduction.
- Where the evidence is weak, say so in the draft. Hedging is a finding to
  preserve, not a weakness to hide.
- Contradictions in the sources are presented as contradictions.
- Write the limitations section now, not last. Limitations written last are
  written defensively.

**Pass test:** stage 6 judges it.

---

## 6. draft-check

**Agent:** `acad-draft-checker`. Never parallelized.

**Inputs:** `draft/DRAFT.md`, `draft/OUTLINE.md`, `evidence/cards/`, `PLAN.md`.

**Produces:** `draft/CHECK.md` with verdict `PASS`, `REVISE-DRAFT`, or
`REVISE-EVIDENCE`.

Checks, in order of severity:

1. **Uncited assertions** — every factual claim has a reference. List each
   violation with its line.
2. **Reference integrity** — every `[[id]]` resolves to a real card or claim.
   A dangling reference is the failure mode that matters most.
3. **Support faithfulness** — does the cited card actually support the sentence?
   Compare against the card verbatim passages. Overreach is the most common and
   most damaging defect: a source that shows correlation cited for causation, a
   single-population result cited as general.
4. **Argument integrity** — does the draft follow the outline chain? Are there
   leaps where a step is asserted rather than argued?
5. **Scope drift** — does the draft answer the question in `BRIEF.md`, or a
   different one it drifted into?
6. **Falsification honesty** — does the draft engage the disconfirming evidence
   found at stage 2, or bury it?
7. **Completeness** — every outline section present and doing its stated job.

The verdict distinguishes cause: `REVISE-DRAFT` when the writing misuses the
evidence it has, `REVISE-EVIDENCE` when the argument needs support that does not
exist. The second sends the pipeline back to stage 2, not stage 5. Getting this
distinction right is the checker's main judgment call — when a claim could be
rewritten to fit the evidence or backed by new evidence, prefer
`REVISE-DRAFT` and say what the narrowed claim would be.

**Pass test:** verdict `PASS`, with zero uncited assertions, zero dangling
references, and zero overreach findings.

**On failure:** Loop B to stage 5, or Loop A to stage 2. Budget
`max_iterations.draft`, default 3.

**Gate:** `draft`.

---

## 7. write

**Agent:** `acad-writer`

**Inputs:** `draft/DRAFT.md`, `draft/CHECK.md` (passed), `BRIEF.md` for audience,
`project.json` for output kind and citation style, reviewer findings on a Loop C
retry.

**Produces:** `paper/PAPER.md`, `paper/refs.bib`

The writer turns a checked argument into a paper. It may reorganize, compress,
and rewrite freely — but it may not change what is claimed.

- Structure per the output kind. Use `paper_skill` if configured; otherwise
  `references/paper-structure.md`.
- Convert `[[claim-id]]` markers to proper citations in the configured style, and
  build `refs.bib` from the card bibliographic frontmatter.
- Apply `style_skill` if configured for the prose pass.
- **The writer may not introduce a claim, soften a stated limitation, or drop a
  contradiction.** If a transition seems to need an unsupported bridging claim,
  leave a `<!-- NEEDS-EVIDENCE: ... -->` marker and report it. That marker
  routes back to Loop B; it is never resolved by writing around it.
- Keep a `paper/TRACE.md` mapping each paper section to the draft sections and
  claim ids behind it, so the reviewers and any later defense can follow the
  chain from sentence to source.

**Pass test:** stage 8 judges it. Any `NEEDS-EVIDENCE` marker is an automatic
Loop B return before reviewers are dispatched — do not spend reviewer effort on
a paper with a known hole.

---

## 8. review

**Agents, in parallel:** `acad-reviewer-method`, `acad-reviewer-contribution`,
`acad-reviewer-clarity`.

**Inputs:** `paper/PAPER.md`, `paper/TRACE.md`, `evidence/cards/`, `BRIEF.md`.
On a Loop C iteration, also `review/RESPONSE.md` and each reviewer's own prior
review.

**Produces:** `review/REVIEW-method.md`, `review/REVIEW-contribution.md`,
`review/REVIEW-clarity.md`.

Each review ends with a verdict: `ACCEPT`, `MINOR`, `MAJOR`, or `REJECT`, and a
numbered finding list. Every finding carries a severity (`blocker`, `major`,
`minor`, `suggestion`), a location, and a concrete remedy. A finding without a
remedy is an opinion and should not be filed.

Reviewers read the paper as adversarial peers who want it to be right. They do
not edit. They do not soften findings to be agreeable, and they do not
manufacture findings to seem rigorous — `ACCEPT` with two minor notes is a
legitimate review.

On a Loop C iteration, each reviewer re-reviews its own prior findings first and
marks each `resolved`, `partially-resolved`, or `unresolved`, then reads the
changed sections for new problems. A reviewer may not raise a new blocker in
round three about text that has not changed since round one — say so in the
review if tempted, and file it as a minor note instead.

**Pass test:** all three verdicts are `ACCEPT` or `MINOR`, and no finding of
severity `blocker` or `major` is open.

---

## 9. edit

**Agent:** `acad-editor`

**Inputs:** all three reviews, `paper/PAPER.md`, `evidence/cards/`.

**Produces:** revised `paper/PAPER.md`, `review/RESPONSE.md`.

The editor is the only agent that revises the paper after stage 7. For every
finding it records: accepted and how it was addressed, or declined and why.
Declining is legitimate and common — reviewers disagree with each other, and
some findings ask for a different paper. What is not legitimate is silently
ignoring a finding.

Where reviewers conflict, the editor decides and states the reasoning in
`RESPONSE.md`. Where a finding requires evidence the project does not have, the
editor does not invent it: either narrow the claim, or return to Loop A and say
so.

**Pass test:** every finding has a disposition; no accepted finding is left
unimplemented.

**On failure:** Loop C back to stage 8. Budget `max_iterations.review`, default 3.

**Gate:** `final`.

---

## 10. ship

**Agent:** `acad-librarian`, plus export steps in the main session.

**Inputs:** the approved paper, `evidence/cards/`, `evidence/AUDIT.md`,
`project.json`.

**Produces:** commons contribution, export artifacts, a completed `DECISIONS.md`.

1. Promote verified claims and their cards to the commons per the
   `research-commons` skill. Respect project visibility: if the project is
   private, the human decides at the `ship` gate what may be promoted.
2. Export per `project.json` `exports` — Markdown always; PDF, DOCX, and LaTeX
   via the `pdf`, `docx`, and paper skills when requested.
3. Write `SUMMARY.md`: the question, the answer, the strength of the evidence,
   the known limitations, and what the next paper should ask. That last line is
   what makes the commons compound.
4. Set state to `complete`.

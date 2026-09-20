---
name: evidence-standards
description: The source card and claim formats, verification rules, and citation discipline used by the Academician pipeline. Use this skill whenever writing or auditing a source card, recording a research finding, verifying a citation, deciding whether a source supports a claim, or judging evidence quality and independence. Also use it whenever a research or writing task requires that every factual assertion be traceable to a real, checked source — including work outside the full Academician loop.
---

# Evidence standards

One rule underneath all of this: **a claim is only as good as a passage someone
can go read.** Every mechanism here exists to keep a verbatim, locatable quote
attached to every assertion, from retrieval through to the final sentence.

## Source cards

One card per source, in `evidence/cards/<SQid>-<slug>.md`. The card is the only
sanctioned route by which a source enters the project. Nothing downstream reads
the source directly, so the card must carry everything later stages need.

```markdown
---
id: card-smith2024-attention
type: source-card
subquestion: SQ3
bibkey: smith2024attention
title: "Attention patterns under distribution shift"
authors: ["Smith, J.", "Okonkwo, A."]
year: 2024
venue: "Journal of Machine Learning Research"
volume: "25"
pages: "1-34"
doi: "10.1234/jmlr.2024.001"
url: "https://example.org/paper.pdf"
accessed: 2026-09-20
source_type: journal-article
credibility: peer-reviewed
access: full-text
retrieved_by: acad-researcher
verified: false
verified_by: null
verified_on: null
topics: ["attention", "distribution-shift", "robustness"]
supports: []
contradicts: []
---

## What it is
Two or three sentences: the study, its design, its population or dataset, its N.

## Key passages
> "Under covariate shift of magnitude greater than 0.3, attention entropy
> increased by 42% (p < 0.01)."
— p. 17, Section 4.2

> "We did not test architectures below 100M parameters."
— p. 29, Limitations

## What it supports
Plain statements this source can back, each tied to the passage above it.

## Limitations
Sample, method, funding, scope. What this source cannot be used for.

## Relevance
Why this card exists in this project, against which subquestion.
```

### Field rules

- `id` — stable and unique. Once written, never renamed; downstream references
  break silently otherwise.
- `credibility` — one of `peer-reviewed`, `preprint`, `primary`, `secondary`,
  `grey`, `vendor`, `unverified`. Be honest. A preprint labelled peer-reviewed
  corrupts every quality judgment made later.
- `access` — `full-text`, `abstract-only`, or `paywalled-summary`. A card written
  without the full text is discounted by the checker and may not be the sole
  support for any claim.
- `verified` — set only by `acad-evidence-checker`, never by the researcher who
  wrote the card.
- `supports` / `contradicts` — claim ids, filled in as claims are formed.

### Key passages are mandatory

At least one verbatim quote with a locator. This is not a formality:

- It is what the draft checker compares the draft against, which is how
  overreach gets caught.
- It is what makes a fabricated citation impossible to carry forward — a quote
  that is not in the source fails verification.
- It is what lets a reader six months later check the chain without re-reading
  the source.

If a source is worth citing and no passage can be quoted, the card is not ready.
Paraphrase in "What it supports"; quote in "Key passages".

## Claims

A claim is a statement the project asserts, with its support attached. Claims
live in `evidence/claims/` during a project and are promoted to the commons at
ship.

```markdown
---
id: claim-attention-entropy-shift
type: claim
statement: "Transformer attention entropy rises measurably under covariate shift."
confidence: moderate
support: ["card-smith2024-attention", "card-liu2023-robustness"]
contradicts: ["card-patel2025-null"]
scope: "Models above 100M parameters; vision and text; shift magnitude > 0.3."
first_used_in: attention-robustness-review
verified_on: 2026-09-20
---

## Basis
How the supporting cards establish this, and where they agree.

## Against
What the contradicting cards show, and why the claim survives it — or that it
only survives in narrowed form.

## Boundary
Where this stops being true, or stops being tested.
```

`confidence` is one of:

| Value | Means |
|-------|-------|
| `high` | Multiple independent, high-credibility sources; no substantive contradiction. |
| `moderate` | Supported, but thin on independence, or with real caveats. |
| `low` | One source, or only weak sources; usable only if hedged in text. |
| `contested` | Credible sources disagree. Must be presented as contested, never resolved by preference. |

A `contested` claim is a feature. Papers that flatten contested evidence into
confident prose are the ones that age badly.

## Verification

Verification is a separate act from retrieval, done by a different agent. The
checker, for each card:

1. **Resolves the source.** Fetch the DOI or URL. Confirm the title, authors, and
   year match the card. A source that cannot be resolved gets `verified: false`
   and is struck from the evidence base — not downgraded, struck.
2. **Confirms the quotes.** Each key passage must appear in the source, at or
   near the stated locator. A quote that cannot be found is a hard failure and
   the card is struck.
3. **Checks the summary against the quotes.** If the summary claims more than the
   quotes show, rewrite the summary down to what the quotes support.
4. **Judges independence.** Sources tracing to one dataset, one lab, or one
   earlier paper count once. Record the shared origin in the audit.
5. **Sets** `verified: true`, `verified_by`, `verified_on`.

An unverified card may not support a claim, and a claim with no verified support
may not enter a draft. That chain is the whole point.

## Independence

The most common way a literature search misleads is volume without independence.
Before treating N sources as N sources, check whether they share:

- the same underlying dataset or cohort
- the same authors or lab
- a citation chain where later papers restate an earlier one without new evidence
- a single funder with a stake in the result

Record shared origins in `evidence/AUDIT.md`. Count independent lines of
evidence, not documents.

## Absence of evidence

`evidence/gaps.md` records searches that came back empty: what was searched,
where, with what terms, and what was expected but not found. This matters twice
— it stops the same dead end being re-run on a retry, and "we looked and it is
not there" is often the most useful finding a review produces.

## Citation discipline in prose

- Cite at the sentence that makes the claim, not at the end of the paragraph.
- One citation supporting three sentences means those sentences need to be one
  sentence, or the other two need their own support.
- Never cite a source you have only seen cited by another source. If it cannot
  be read, cite the intermediary and say so: "as reported in X".
- Match the strength of the verb to the strength of the evidence. `shows`,
  `suggests`, `is consistent with`, and `has been claimed` are not
  interchangeable, and the difference between them is where most quiet
  overreach lives.
- A number in the text must appear in a card key passage. Numbers are the
  easiest thing to drift and the most embarrassing thing to get wrong.

## Red flags

Stop and escalate rather than working around any of these:

- A citation that cannot be resolved after a genuine attempt.
- A source whose content does not match what it is being cited for.
- A subquestion where every source supports the same conclusion and the
  falsification search returned nothing — this usually means the search was
  biased, not that the world is unanimous.
- Pressure to reach a stated conclusion. If the brief presumes an answer and the
  evidence does not support it, that is the finding. Report it at the next gate.

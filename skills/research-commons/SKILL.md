---
name: research-commons
description: Read from and contribute to the shared research commons — a standalone repository of verified source cards and claims that carries findings between separate papers. Use this skill whenever starting a new research project that may overlap with prior work, searching for what has already been established, deciding whether an existing finding is still current, promoting a finished project's verified claims back to the shared corpus, or answering "have we researched this before?". Also use it when a paper needs to build on an earlier paper's evidence.
---

# Research commons

A separate repository holding verified claims and the source cards behind them,
reusable across every paper. It is what makes the second paper on a topic
cheaper than the first, and what stops the same source being re-read four times.

Location: `~/.academician/config.json` → `commons_path`. Its own git repo, with
its own visibility, independent of any paper.

## Layout

```
research-commons/
├── .academician/commons.json     provenance, schema version, staleness policy
├── cards/<card-id>.md            verified source cards, promoted from projects
├── claims/<claim-id>.md          verified claims with support and boundaries
├── topics/<topic>.md             hub pages linking claims under one subject
├── refs.bib                      aggregate bibliography, generated
├── INDEX.md                      generated index of claims by topic
└── README.md
```

Cards and claims use the formats in the `evidence-standards` skill, plus
provenance fields added on promotion:

```yaml
promoted_from: attention-robustness-review
promoted_on: 2026-09-20
used_by: ["attention-robustness-review", "shift-detection-methods"]
```

## Reading from the commons

At the `plan` stage, before any searching:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/acad.mjs commons search "<terms>"
node ${CLAUDE_PLUGIN_ROOT}/scripts/acad.mjs commons show <claim-id>
```

Search on the subquestion terms and on the topics in the brief. Then, for each
hit, decide:

**Reuse as-is** when the claim covers the subquestion, `confidence` is adequate,
and `verified_on` is within `staleness_days` (default 365). Cite the claim id in
`PLAN.md` under "Reused from commons" and drop the subquestion from the search
plan. This is the payoff — do not re-research it out of diligence theater.

**Refresh** when the claim is on point but stale, or when the field has moved.
Do not simply re-verify the old sources: search for what has appeared since
`verified_on`. Update the claim in place at ship, bumping `verified_on` and
appending, not replacing, the support list.

**Narrow or fork** when the claim is close but its `scope` does not cover this
project's context. Never widen an existing claim's scope to fit a new project —
create a sibling claim with its own boundary and cross-reference the two. Scope
creep in a shared corpus is how one paper's caveat becomes another paper's
overreach.

**Ignore** when it is a topical match but not evidentially relevant. Say so in
the plan so the next project does not re-evaluate it.

A reused claim still appears in the paper's citations, citing the original
sources — never the commons itself. The commons is infrastructure, not a source.

## Contributing back

At `ship`, `acad-librarian` promotes work back. Only verified material moves:
`verified: true` cards, and claims whose support is entirely verified cards.

For each candidate claim:

1. **Check for an existing claim on the same statement.** Near-duplicates are
   the main way a commons rots. Search before creating. If one exists, merge:
   add new supporting cards, widen `used_by`, reconcile `confidence`, and leave
   one claim, not two.
2. **Reconcile conflicts.** If the new project's evidence contradicts an
   existing claim, do not overwrite it. Set the existing claim's `confidence` to
   `contested`, add the contradicting cards to `contradicts`, and record both
   positions in its "Against" section. A contested claim in the commons is
   accurate; a silently overwritten one is a lie told to the next project.
3. **Promote the supporting cards** that are not already present.
4. **Update the topic hub**, creating `topics/<topic>.md` if needed.
5. **Rebuild** `INDEX.md` and `refs.bib`:
   `node ${CLAUDE_PLUGIN_ROOT}/scripts/acad.mjs commons index`
6. **Commit** in the commons repo: `commons: promote N claims from <project>`.

### Visibility

The commons may be shared or public while a project is private. Before
promoting from a private project, the human decides at the `ship` gate.

Default to not promoting when any of these hold, and ask rather than assume:

- the project involves unpublished data, confidential material, or human
  subjects
- the source is licensed in a way that bars redistribution of extracts
- the finding is embargoed until the paper publishes

Never promote verbatim passages from a source whose licence forbids it; promote
the card metadata and the paraphrased support instead, with a note explaining
why the passage is absent.

## Keeping it healthy

Periodically, and at the start of any project that leans on it heavily:

- **Stale sweep** — `acad.mjs commons stale` lists claims past `staleness_days`.
  Refresh the ones the current project depends on. Ignore the rest until needed.
- **Orphan sweep** — cards supporting no claim. Usually harmless; occasionally
  a sign that a claim was deleted without its support.
- **Duplicate sweep** — claims with high statement overlap. Merge them.
- **Broken link sweep** — DOIs and URLs that no longer resolve. Mark
  `access: dead-link` and record an archive URL if one exists. Do not strike a
  previously verified card for link rot; the verification happened, and the
  record of it is worth keeping.

## What does not belong here

- Unverified cards. The commons is the verified tier; project directories are
  where unverified work lives.
- Project-specific argumentation. Claims are portable facts with boundaries;
  how a particular paper used one belongs to that paper.
- Drafts, prose, or reviews.
- Anything the human has not cleared for it from a private project.

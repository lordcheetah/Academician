# PROJECT_TITLE

A research project run through the [Academician](https://github.com/lordcheetah/Academician)
pipeline.

## Where things are

| Path | What it holds |
|---|---|
| `BRIEF.md` | The question, scope, and audience. Everything is judged against this. |
| `PLAN.md` | Subquestions, search strategies, falsification plan. |
| `evidence/cards/` | One source card per source, with verbatim quoted passages. |
| `evidence/AUDIT.md` | The evidence checker's verdict and gap list. |
| `evidence/gaps.md` | Searches that came back empty — findings in their own right. |
| `draft/OUTLINE.md` | The argument chain, claim by claim. |
| `draft/DRAFT.md` | The argument in full sentences, every assertion referenced. |
| `draft/CHECK.md` | The draft checker's verdict. |
| `paper/PAPER.md` | The paper. |
| `paper/TRACE.md` | Section-to-claim-to-source mapping. |
| `review/` | Three peer reviews and the editor's response. |
| `DECISIONS.md` | Append-only log of every human gate decision. |
| `.academician/` | Project config and pipeline state. |

## Running it

```bash
/acad-status        # where the pipeline is
/acad-run           # drive it forward from here
```

The pipeline stops at configured gates and asks. It will not advance past one
on its own.

## Reading the evidence

Every claim in the paper traces to a source card, and every card carries a
verbatim passage with a locator. To check any sentence: find its citation in
`paper/TRACE.md`, open the card in `evidence/cards/`, and read the quote.

# Paper structure (fallback)

Used by `acad-writer` when `integrations.paper_skill` is unset. A configured
paper-writing skill takes precedence over everything here.

Pick the structure from `project.json` → `output_kind`.

## Empirical paper (IMRaD)

1. **Title** — states the finding, not the topic. "X reduces Y in Z" beats "An
   investigation into X and Y".
2. **Abstract** — 150–250 words: question, approach, what was found, what it
   means. Written last, from the finished paper, never from the outline.
3. **Introduction** — the problem, why it is open, what this contributes. End
   with an explicit contribution list. The reader should be able to stop here
   and know whether to continue.
4. **Related work** — organized by position in the debate, not chronologically
   and not one-paragraph-per-paper. The reader needs the shape of the field.
5. **Method** — enough for replication. Data, procedure, analysis, and the
   choices that could have gone another way.
6. **Results** — what was found, without interpretation. Report the
   disconfirming results here too, at the same prominence.
7. **Discussion** — interpretation, relation to prior work, what would change
   the conclusion.
8. **Limitations** — scope, sample, method, generalization. Written early, kept
   honest. A limitations section that only lists things that do not matter tells
   the reader the author is not being straight with them.
9. **Conclusion** — the answer and what it opens up. No new claims.
10. **References** — in the configured style.

## Literature review

1. Title, abstract, introduction as above.
2. **Scope and method** — inclusion and exclusion criteria, databases, search
   terms, date range, how many hits were screened to how many included. This is
   the section that makes a review checkable rather than a reading list; take
   it from `PLAN.md`, which already has all of it.
3. **Synthesis**, organized by theme or by position in the debate. Each section
   states what is established, what is contested, and on what evidence.
4. **Contested findings** — a section of its own when the field genuinely
   disagrees. Present both sides with their evidence and say what would settle
   it.
5. **Gaps** — from `evidence/gaps.md`. What has not been studied is the review's
   most reusable output.
6. **Conclusion and research agenda.**
7. **References.**

## Position paper

1. Title, abstract, introduction.
2. **The claim**, stated plainly and early.
3. **The argument**, one section per step in the chain from `OUTLINE.md`.
4. **Objections and responses** — the strongest objections, not convenient ones.
   A position paper that only answers weak objections argues against nobody.
5. **What would change my mind** — from `BRIEF.md`. Rare in published work and
   disproportionately persuasive when present.
6. **Conclusion. References.**

## Technical report

1. **Summary** — findings and recommendations first, for readers who stop there.
2. **Background and scope.**
3. **Approach.**
4. **Findings**, numbered, each with its evidence.
5. **Recommendations**, each traced to a finding. A recommendation with no
   finding behind it is an opinion; either find support or cut it.
6. **Limitations and open questions.**
7. **Appendices, references.**

## Case study

1. Title, abstract, introduction.
2. **Case selection** — why this case, and what it is a case of. The second half
   is what separates a case study from an anecdote.
3. **Context.**
4. **The case**, narrated.
5. **Analysis** against the framework or question.
6. **Generalizability** — what transfers and what does not. Be strict here.
7. **Conclusion. References.**

## Applies to all

- **Headings** describe content, not function. "Attention entropy rises under
  shift" over "Results 2".
- **First paragraph of each section** states what the section establishes. The
  reader skimming headings and first paragraphs should get the whole argument.
- **Figures and tables** are referenced in the text and carry captions that
  stand alone.
- **Numbers** get units, and uncertainty where it exists.
- **Hedging matches the evidence.** Re-read every `shows`, `proves`,
  `demonstrates`, and `establishes` against the card that backs it.
- **The abstract is written last.** An abstract written from the outline
  describes the paper that was planned, not the one that exists.

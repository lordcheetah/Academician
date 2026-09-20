# Research commons

Verified claims and the source cards behind them, shared across every paper
run through [Academician](https://github.com/lordcheetah/Academician).

This is the verified tier. Everything here has had its citations resolved, its
quoted passages confirmed against the source, and its support checked for
independence. Unverified work stays in project directories.

## Layout

| Path | Contents |
|---|---|
| `claims/` | One file per claim: a statement, its support, its boundary, its confidence. |
| `cards/` | One file per source: bibliographic data plus verbatim quoted passages. |
| `topics/` | Hub pages grouping claims under a subject. |
| `INDEX.md` | Generated index of claims by topic. |
| `refs.bib` | Generated aggregate bibliography. |

## Using it

```bash
acad commons search "attention distribution shift"
acad commons show claim-attention-entropy-shift
acad commons index     # rebuild INDEX.md and refs.bib
acad commons stale     # claims past the staleness window
```

A claim found here does not need re-researching. Cite its original sources in
the paper — never cite the commons itself, which is infrastructure rather than
a source.

## Rules

- **Nothing unverified.** Promotion happens at a project's ship stage, and only
  for cards marked `verified: true`.
- **Never widen a claim's scope** to fit a new project. Create a sibling claim
  with its own boundary and cross-reference.
- **Conflicts make a claim `contested`, never overwritten.** Both positions
  stay, with the evidence on each side. A silently replaced claim misleads the
  next project, which has no way to know it happened.
- **Stable ids.** Renaming an id breaks every reference to it.
- **Check `verified_on`** before reuse. Past the staleness window, search for
  what has appeared since rather than re-verifying the old sources.

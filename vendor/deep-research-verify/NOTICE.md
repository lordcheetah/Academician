# Vendored: deep-research verification layer

The Python in `scripts/`, the JSON Schemas in `schemas/`, and the tests in
`tests/` are **not original to Academician**. They are vendored from:

- **Project:** claude-deep-research-skill
- **Author:** Boris Djordjevic (199 Biotechnologies)
- **Source:** https://github.com/199-biotechnologies/claude-deep-research-skill
- **Commit:** `f2f2c0fa4e7617ca84c86b63f4bb40f77a746933` (2026-04-11)
- **Vendored:** 2026-09-20

## License

The upstream repository states, in its `README.md`:

> ## License
>
> MIT - modify as needed for your workflow.

At the time of vendoring the upstream repository contained **no `LICENSE`
file** and no copyright line — only the README statement above. The grant is
explicit, but the formal text is absent. If you intend to rely on this in a
context where licensing precision matters, ask upstream to add a `LICENSE`
file. Everything here is trivially removable: delete this directory and the
`verify` subcommands in `scripts/acad.mjs` degrade to model-judgment checking.

## What was taken, and what was not

Vendored:

| File | Purpose in Academician |
|---|---|
| `scripts/citation_manager.py` | Stable sha256 source IDs, run manifest, bibliography export |
| `scripts/evidence_store.py` | Append-only evidence rows with quotes and locators |
| `scripts/extract_claims.py` | Atomic claim extraction from a markdown draft |
| `scripts/verify_citations.py` | DOI resolution and title/year matching |
| `scripts/verify_claim_support.py` | Deterministic claim-to-evidence support checking |
| `scripts/source_evaluator.py` | Source credibility scoring |
| `schemas/*.json` | Claim, evidence, source, and run-manifest contracts |
| `tests/` | Upstream test suite — 45 tests, kept so changes stay honest |

Deliberately not vendored: `research_engine.py`, `validate_report.py`,
`md_to_html.py`, `verify_html.py`, the HTML/PDF templates, and the upstream
`SKILL.md`. Those implement the upstream project's own research pipeline and
report format. Academician has its own pipeline and does not need a second
one — and the upstream `SKILL.md` declares a skill named `deep-research`,
which would collide with the `academic-research-skills` plugin.

## Local modifications

None. Files are byte-for-byte as vendored. Keeping it that way makes upstream
updates a straight re-copy plus a test run.

To refresh:

```bash
git clone --depth 1 https://github.com/199-biotechnologies/claude-deep-research-skill /tmp/drs
cp /tmp/drs/scripts/{citation_manager,evidence_store,extract_claims,verify_citations,verify_claim_support,source_evaluator}.py scripts/
cp /tmp/drs/schemas/*.json schemas/
cp /tmp/drs/tests/test_*.py tests/ && cp -r /tmp/drs/tests/fixtures tests/
python -m pytest tests/ -q     # must stay green
```

Then update the commit hash above.

## Requirements

Python 3.9+. Standard library only for everything Academician uses —
`verify_citations.py` needs network access to resolve DOIs, nothing more.

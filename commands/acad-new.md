---
description: Start a new Academician research project — scaffold its own repo, register it, and run intake
argument-hint: [project-slug]
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion, Skill
---

Create a new research project. Projects are independent repositories; this
plugin repo never contains them.

Load the `academician-loop` skill before starting.

## 1. First run check

If `~/.academician/config.json` does not exist:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/acad.mjs init
```

Then show the user the config and ask them to confirm `commons_path` and the
`integrations` skill names. If they have a deep-research plugin or an
academic-writing plugin installed, those names go in `integrations` now — the
pipeline degrades to built-in fallbacks otherwise, which works but is weaker.

If `commons_path` does not exist on disk, offer to create the commons (see
`/acad-commons init`). A first project without a commons is fine; it just
means nothing to reuse yet.

## 2. Gather the brief

This is a conversation, not a form. Do not delegate it and do not rush it —
everything downstream is judged against `BRIEF.md`.

Work through the template at `${CLAUDE_PLUGIN_ROOT}/templates/project/BRIEF.md`,
but converse rather than interrogating. Ask in small groups and follow up on
vague answers. The ones that matter most:

- **The question**, phrased as a question. Push back if it is a topic rather
  than a question — "AI and education" is not answerable; "does X improve Y
  for Z" is.
- **Audience and output kind.** These pick the structure.
- **Out of scope.** Users under-specify this and reviewers attack it first.
- **What would change your mind.** Ask it plainly. It is the most useful line
  in the file and the one most likely to be skipped.

Use `AskUserQuestion` for the choices with discrete options — output kind,
visibility, gate set, citation style. Converse for the rest.

## 3. Check for related prior work

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/acad.mjs project list
node ${CLAUDE_PLUGIN_ROOT}/scripts/acad.mjs commons search "<topic terms>"
```

If earlier projects or commons claims overlap, tell the user what exists before
they commit to the scope. This is where a paper gets narrowed usefully — "we
already established X, so this paper can start from there" is a better outcome
than rediscovering it.

Record any such projects in `builds_on`.

## 4. Choose the location

Default: a sibling of this plugin repo, `../<slug>`. Confirm the path with the
user. Never create the project inside the Academician repo.

## 5. Scaffold

```bash
mkdir -p <path>
cp -r ${CLAUDE_PLUGIN_ROOT}/templates/project/. <path>/
cd <path> && git init
```

Then:

- Fill `.academician/project.json`: slug, title, visibility, output_kind,
  audience, topics, gates, max_iterations, citation_style, builds_on, created.
- Fill `BRIEF.md` from the conversation. Write real content — a brief full of
  template headings with one-line answers is a brief nobody can judge.
- Replace `PROJECT_TITLE` in `README.md`.
- Write a `.gitignore` appropriate to the project. If visibility is private,
  say so explicitly at the top of `README.md`.

## 6. Register

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/acad.mjs project add <slug> \
  --path <abs-path> --title "<title>" --visibility <vis> --topics "<a,b>"
```

## 7. Commit and hand off

Commit the scaffold in the project repo: `acad(intake): project scaffold and brief`.

Ask whether to create a GitHub remote. **Do not create one without an explicit
yes** — visibility is the user's call, and a private project pushed to a public
remote cannot be undone. If yes:

```bash
gh repo create <slug> --<private|public> --source=. --remote=origin --push
```

Then advance state and report:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/acad.mjs state advance --project <path>
```

Tell the user the project is at `plan`, and that `/acad-run` will produce the
research plan and stop at the `scope` gate.

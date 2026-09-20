#!/usr/bin/env node
/**
 * acad — deterministic state, registry, and commons operations for Academician.
 *
 * The loop skill reads and writes pipeline state through this script rather
 * than editing JSON by hand, so stage transitions and iteration budgets are
 * enforced in one place instead of being re-derived each run.
 *
 * Usage: node acad.mjs <group> <command> [args] [--flags]
 *        node acad.mjs help
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Plugin root: this file lives in <root>/scripts/.
const HERE = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const HOME = os.homedir();
const USER_DIR = path.join(HOME, '.academician');
const CONFIG_PATH = path.join(USER_DIR, 'config.json');
const REGISTRY_PATH = path.join(USER_DIR, 'registry.json');

const STAGES = [
  'intake', 'plan', 'research', 'evidence-check', 'outline', 'draft',
  'draft-check', 'write', 'review', 'edit', 'ship', 'complete',
];

// Gate fires after the named stage completes.
const GATE_AFTER = {
  plan: ['scope', 'plan'],
  'evidence-check': ['evidence'],
  outline: ['outline'],
  'draft-check': ['draft'],
  edit: ['final'],
  ship: ['ship'],
};

const GATE_PRESETS = {
  minimal: ['scope', 'final'],
  standard: ['scope', 'evidence', 'draft', 'final'],
  all: ['scope', 'plan', 'evidence', 'outline', 'draft', 'final', 'ship'],
};

const DEFAULT_CONFIG = {
  commons_path: path.join(HOME, 'Documents', 'GitHub', 'research-commons'),
  default_visibility: 'private',
  integrations: {
    // Skill names as the Skill tool sees them. A plugin skill is
    // "<plugin>:<skill>"; a bare ~/.claude/skills/ skill is just its name.
    research_skill: 'academic-research-skills:deep-research',
    paper_skill: 'academic-research-skills:academic-paper',
    reviewer_skill: 'academic-research-skills:academic-paper-reviewer',
    style_skill: null,
    citation_style: 'APA',
  },
  defaults: {
    gates: 'standard',
    max_iterations: { plan: 2, research: 3, draft: 3, review: 3 },
    min_sources: 3,
    staleness_days: 365,
  },
};

// ---------------------------------------------------------------- utilities

function die(msg) {
  console.error(`acad: ${msg}`);
  process.exit(1);
}

function readJson(p, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    die(`could not parse ${p}: ${err.message}`);
  }
}

function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function nowIso() {
  return new Date().toISOString();
}

/** Parse `--key value` and `--flag` into an object; returns [positional, flags]. */
function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i += 1;
      }
    } else {
      positional.push(arg);
    }
  }
  return [positional, flags];
}

function getConfig() {
  const cfg = readJson(CONFIG_PATH);
  if (!cfg) die(`no config at ${CONFIG_PATH} — run: acad init`);
  return { ...DEFAULT_CONFIG, ...cfg };
}

function getRegistry() {
  return readJson(REGISTRY_PATH, { version: 1, projects: [] });
}

/** Walk up from `start` looking for a directory containing .academician/. */
function findProjectRoot(start) {
  let dir = path.resolve(start || process.cwd());
  for (;;) {
    if (fs.existsSync(path.join(dir, '.academician', 'project.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function requireProject(flags) {
  const root = findProjectRoot(flags.project);
  if (!root) {
    die('not inside an Academician project (no .academician/project.json found) — pass --project <path> or run /acad-new');
  }
  const project = readJson(path.join(root, '.academician', 'project.json'));
  const state = readJson(path.join(root, '.academician', 'run-state.json'));
  if (!state) die(`project at ${root} has no run-state.json`);
  return { root, project, state };
}

function saveState(root, state) {
  state.updated = nowIso();
  writeJson(path.join(root, '.academician', 'run-state.json'), state);
}

function resolveGates(project) {
  const g = project.gates;
  if (Array.isArray(g)) return g;
  return GATE_PRESETS[g] || GATE_PRESETS.standard;
}

function budgetFor(project, loop) {
  const m = (project.max_iterations) || {};
  const d = DEFAULT_CONFIG.defaults.max_iterations;
  return m[loop] !== undefined ? m[loop] : d[loop];
}

// ------------------------------------------------------------------- init

function cmdInit(_pos, flags) {
  fs.mkdirSync(USER_DIR, { recursive: true });
  if (!fs.existsSync(CONFIG_PATH) || flags.force) {
    writeJson(CONFIG_PATH, DEFAULT_CONFIG);
    console.log(`wrote ${CONFIG_PATH}`);
  } else {
    console.log(`config exists: ${CONFIG_PATH} (use --force to reset)`);
  }
  if (!fs.existsSync(REGISTRY_PATH)) {
    writeJson(REGISTRY_PATH, { version: 1, projects: [] });
    console.log(`wrote ${REGISTRY_PATH}`);
  } else {
    console.log(`registry exists: ${REGISTRY_PATH}`);
  }
  console.log('\nEdit config.json to set commons_path and integrations.');
}

// ---------------------------------------------------------------- project

function cmdProjectAdd(pos, flags) {
  const slug = pos[0] || flags.slug;
  if (!slug) die('usage: acad project add <slug> --path <dir> [--title t] [--visibility private|public] [--topics a,b]');
  const projPath = path.resolve(flags.path || process.cwd());
  const registry = getRegistry();
  if (registry.projects.some((p) => p.slug === slug)) {
    die(`project "${slug}" already registered — use: acad project update ${slug}`);
  }
  registry.projects.push({
    slug,
    title: flags.title || slug,
    path: projPath,
    visibility: flags.visibility || getConfig().default_visibility,
    topics: flags.topics ? String(flags.topics).split(',').map((s) => s.trim()) : [],
    created: today(),
    status: 'active',
  });
  writeJson(REGISTRY_PATH, registry);
  console.log(`registered ${slug} -> ${projPath}`);
}

function cmdProjectUpdate(pos, flags) {
  const slug = pos[0];
  if (!slug) die('usage: acad project update <slug> [--path d] [--title t] [--visibility v] [--topics a,b] [--status s]');
  const registry = getRegistry();
  const p = registry.projects.find((x) => x.slug === slug);
  if (!p) die(`no project "${slug}"`);
  if (flags.path) p.path = path.resolve(flags.path);
  if (flags.title) p.title = flags.title;
  if (flags.visibility) p.visibility = flags.visibility;
  if (flags.status) p.status = flags.status;
  if (flags.topics) p.topics = String(flags.topics).split(',').map((s) => s.trim()).filter(Boolean);
  writeJson(REGISTRY_PATH, registry);
  console.log(`updated ${slug}`);
  console.log(JSON.stringify(p, null, 2));
}

function cmdProjectList(_pos, flags) {
  const registry = getRegistry();
  const total = registry.projects.length;
  let projects = registry.projects;
  if (flags.topic) {
    const t = String(flags.topic).toLowerCase();
    projects = projects.filter((p) => (p.topics || []).some((x) => x.toLowerCase().includes(t)));
  }
  if (flags.status) projects = projects.filter((p) => p.status === flags.status);
  if (!projects.length) {
    const filtered = flags.topic || flags.status;
    console.log(filtered
      ? `no projects match that filter (${total} registered)`
      : 'no projects registered');
    return;
  }
  for (const p of projects) {
    const exists = fs.existsSync(p.path) ? '' : '  [MISSING ON DISK]';
    let stage = '?';
    const st = readJson(path.join(p.path, '.academician', 'run-state.json'));
    if (st) stage = st.stage + (st.status === 'blocked' ? ' (blocked)' : '');
    console.log(`${p.slug}  [${p.visibility}]  stage=${stage}  ${p.path}${exists}`);
    if ((p.topics || []).length) console.log(`    topics: ${p.topics.join(', ')}`);
  }
}

function cmdProjectShow(pos) {
  const slug = pos[0];
  if (!slug) die('usage: acad project show <slug>');
  const p = getRegistry().projects.find((x) => x.slug === slug);
  if (!p) die(`no project "${slug}"`);
  console.log(JSON.stringify(p, null, 2));
  const st = readJson(path.join(p.path, '.academician', 'run-state.json'));
  if (st) console.log('\nstate:\n' + JSON.stringify(st, null, 2));
}

function cmdProjectRemove(pos, flags) {
  const slug = pos[0];
  if (!slug) die('usage: acad project remove <slug>');
  const registry = getRegistry();
  const before = registry.projects.length;
  registry.projects = registry.projects.filter((p) => p.slug !== slug);
  if (registry.projects.length === before) die(`no project "${slug}"`);
  writeJson(REGISTRY_PATH, registry);
  console.log(`unregistered ${slug} (files on disk untouched)`);
  if (!flags.quiet) console.log('the project directory and its git repo were not deleted');
}

// ------------------------------------------------------------------ state

function describeState(root, project, state) {
  const gates = resolveGates(project);
  const idx = STAGES.indexOf(state.stage);
  const next = idx >= 0 && idx < STAGES.length - 1 ? STAGES[idx + 1] : null;
  const fired = GATE_AFTER[state.stage] || [];
  const pending = fired.filter((g) => gates.includes(g) && !(state.gates_passed || []).includes(g));

  const lines = [];
  lines.push(`project:   ${project.slug}  (${project.visibility})`);
  lines.push(`path:      ${root}`);
  lines.push(`stage:     ${state.stage}`);
  lines.push(`status:    ${state.status}`);
  lines.push('iterations:');
  for (const loop of ['plan', 'research', 'draft', 'review']) {
    const used = (state.iterations || {})[loop] || 0;
    const max = budgetFor(project, loop);
    const flag = used >= max ? '  <-- AT BUDGET' : '';
    lines.push(`  ${loop.padEnd(9)} ${used}/${max}${flag}`);
  }
  lines.push(`gates:     ${gates.join(', ')}`);
  lines.push(`passed:    ${(state.gates_passed || []).join(', ') || '(none)'}`);
  if (pending.length) lines.push(`PENDING GATE: ${pending.join(', ')}  <-- ask the human before advancing`);
  lines.push(`next stage: ${next || '(end)'}`);
  if (state.blocked_reason) lines.push(`BLOCKED: ${state.blocked_reason}`);
  return lines.join('\n');
}

function cmdStateShow(_pos, flags) {
  const { root, project, state } = requireProject(flags);
  if (flags.json) {
    console.log(JSON.stringify({ root, project, state }, null, 2));
    return;
  }
  console.log(describeState(root, project, state));
}

function cmdStateSet(pos, flags) {
  const stage = pos[0];
  if (!STAGES.includes(stage)) die(`unknown stage "${stage}" — one of: ${STAGES.join(', ')}`);
  const { root, state } = requireProject(flags);
  const from = state.stage;
  state.stage = stage;
  state.status = flags.status || 'running';
  if (state.status !== 'blocked') delete state.blocked_reason;
  state.history = state.history || [];
  state.history.push({ at: nowIso(), from, to: stage, note: flags.note || 'set' });
  saveState(root, state);
  console.log(`stage: ${from} -> ${stage}`);
}

function cmdStateAdvance(_pos, flags) {
  const { root, project, state } = requireProject(flags);
  const gates = resolveGates(project);
  const fired = GATE_AFTER[state.stage] || [];
  const pending = fired.filter((g) => gates.includes(g) && !(state.gates_passed || []).includes(g));
  if (pending.length && !flags.force) {
    die(`gate "${pending[0]}" has not been answered — run the gate with the human, then: acad gate log ${pending[0]} <approve|revise|reject>`);
  }
  const idx = STAGES.indexOf(state.stage);
  if (idx < 0 || idx >= STAGES.length - 1) die(`cannot advance from "${state.stage}"`);
  const to = STAGES[idx + 1];
  state.history = state.history || [];
  state.history.push({ at: nowIso(), from: state.stage, to, note: 'advance' });
  state.stage = to;
  state.status = to === 'complete' ? 'complete' : 'running';
  saveState(root, state);
  console.log(`stage: ${STAGES[idx]} -> ${to}`);
}

function cmdStateIterate(pos, flags) {
  const loop = pos[0];
  if (!['plan', 'research', 'draft', 'review'].includes(loop)) {
    die('usage: acad state iterate <plan|research|draft|review>');
  }
  const { root, project, state } = requireProject(flags);
  state.iterations = state.iterations || {};
  const used = state.iterations[loop] || 0;
  const max = budgetFor(project, loop);
  if (used >= max) {
    state.status = 'blocked';
    state.blocked_reason = `loop "${loop}" exhausted its budget of ${max} iterations`;
    saveState(root, state);
    console.error(`BUDGET EXHAUSTED: ${loop} is at ${used}/${max}.`);
    console.error('Do not start another iteration. Write ESCALATION.md and take it to the human.');
    process.exit(3);
  }
  state.iterations[loop] = used + 1;
  state.history = state.history || [];
  state.history.push({ at: nowIso(), loop, iteration: used + 1, note: flags.note || 'iterate' });
  saveState(root, state);
  console.log(`${loop}: iteration ${used + 1}/${max}`);
}

function cmdStateBlock(pos, flags) {
  const reason = pos.join(' ') || flags.reason;
  if (!reason) die('usage: acad state block "<reason>"');
  const { root, state } = requireProject(flags);
  state.status = 'blocked';
  state.blocked_reason = reason;
  saveState(root, state);
  console.log(`blocked: ${reason}`);
}

// ------------------------------------------------------------------- gate

function cmdGateLog(pos, flags) {
  const [gate, decision, ...rest] = pos;
  if (!gate || !decision) {
    die('usage: acad gate log <gate> <approve|revise|reject> ["notes"]');
  }
  if (!['approve', 'revise', 'reject'].includes(decision)) {
    die('decision must be approve, revise, or reject');
  }
  const { root, state } = requireProject(flags);
  const notes = rest.join(' ') || flags.notes || '';

  const entry = [
    `## ${gate} gate — ${today()}`,
    '',
    `**Stage:** ${state.stage}`,
    `**Decision:** ${decision}`,
    `**Iterations at decision:** ${JSON.stringify(state.iterations || {})}`,
    '',
    notes ? `**Notes:**\n\n${notes}\n` : '_No notes._\n',
    '',
  ].join('\n');

  const log = path.join(root, 'DECISIONS.md');
  if (!fs.existsSync(log)) {
    fs.writeFileSync(log, '# Decision log\n\nAppend-only record of every human gate decision.\n\n', 'utf8');
  }
  fs.appendFileSync(log, entry, 'utf8');

  state.gates_passed = state.gates_passed || [];
  if (decision === 'approve' && !state.gates_passed.includes(gate)) {
    state.gates_passed.push(gate);
  }
  state.status = decision === 'reject' ? 'stopped' : 'running';
  if (decision === 'reject') state.blocked_reason = `rejected at ${gate} gate`;
  state.history = state.history || [];
  state.history.push({ at: nowIso(), gate, decision, note: notes.slice(0, 200) });
  saveState(root, state);

  console.log(`logged ${gate}: ${decision} -> DECISIONS.md`);
  if (decision === 'revise') console.log('notes are a hard requirement on the retry — pass them into the agent prompt');
  if (decision === 'reject') console.log('pipeline stopped; do not improvise a new direction');
}

// ---------------------------------------------------------------- commons

function commonsDir() {
  const cfg = getConfig();
  const dir = cfg.commons_path;
  if (!dir || !fs.existsSync(dir)) {
    die(`commons not found at ${dir} — set commons_path in ${CONFIG_PATH} or run /acad-commons init`);
  }
  return dir;
}

/** Minimal YAML frontmatter reader: scalars and simple [a, b] lists. */
function readFrontmatter(file) {
  const text = fs.readFileSync(file, 'utf8');
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return { _body: text };
  const fm = { _body: text.slice(m[0].length) };
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!kv) continue;
    let value = kv[2].trim();
    if (value.startsWith('[') && value.endsWith(']')) {
      value = value.slice(1, -1).split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    } else {
      value = value.replace(/^["']|["']$/g, '');
      if (value === 'null' || value === '') value = null;
      else if (value === 'true') value = true;
      else if (value === 'false') value = false;
    }
    fm[kv[1]] = value;
  }
  return fm;
}

function listMd(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => path.join(dir, f));
}

function cmdCommonsSearch(pos) {
  const terms = pos.join(' ').toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) die('usage: acad commons search "<terms>"');
  const dir = commonsDir();
  const hits = [];
  for (const kind of ['claims', 'cards']) {
    for (const file of listMd(path.join(dir, kind))) {
      const fm = readFrontmatter(file);
      const hay = [
        fm.id, fm.statement, fm.title, fm.scope,
        Array.isArray(fm.topics) ? fm.topics.join(' ') : fm.topics,
        fm._body,
      ].filter(Boolean).join(' ').toLowerCase();
      const score = terms.filter((t) => hay.includes(t)).length;
      if (score > 0) hits.push({ kind, file, fm, score });
    }
  }
  if (!hits.length) {
    console.log('no matches in the commons — this topic has not been researched before');
    return;
  }
  hits.sort((a, b) => b.score - a.score);
  for (const h of hits.slice(0, 40)) {
    const label = h.kind === 'claims' ? h.fm.statement : h.fm.title;
    console.log(`[${h.score}/${terms.length}] ${h.kind.slice(0, -1)}  ${h.fm.id}`);
    console.log(`    ${label || '(untitled)'}`);
    if (h.fm.confidence) console.log(`    confidence: ${h.fm.confidence}   verified: ${h.fm.verified_on || 'n/a'}`);
    if (h.fm.scope) console.log(`    scope: ${h.fm.scope}`);
  }
}

function cmdCommonsShow(pos) {
  const id = pos[0];
  if (!id) die('usage: acad commons show <id>');
  const dir = commonsDir();
  for (const kind of ['claims', 'cards', 'topics']) {
    for (const file of listMd(path.join(dir, kind))) {
      const fm = readFrontmatter(file);
      if (fm.id === id || path.basename(file, '.md') === id) {
        console.log(fs.readFileSync(file, 'utf8'));
        return;
      }
    }
  }
  die(`no commons entry with id "${id}"`);
}

function cmdCommonsIndex() {
  const dir = commonsDir();
  const claims = listMd(path.join(dir, 'claims')).map(readFrontmatter);
  const cards = listMd(path.join(dir, 'cards')).map(readFrontmatter);

  const byTopic = new Map();
  for (const c of claims) {
    const topics = Array.isArray(c.topics) ? c.topics : (c.topics ? [c.topics] : ['untagged']);
    for (const t of topics) {
      if (!byTopic.has(t)) byTopic.set(t, []);
      byTopic.get(t).push(c);
    }
  }

  const out = ['# Research commons index', '', `Generated ${today()}. ${claims.length} claims, ${cards.length} cards.`, ''];
  for (const topic of [...byTopic.keys()].sort()) {
    out.push(`## ${topic}`, '');
    out.push('| Claim | Statement | Confidence | Verified |');
    out.push('|---|---|---|---|');
    for (const c of byTopic.get(topic).sort((a, b) => String(a.id).localeCompare(String(b.id)))) {
      const stmt = String(c.statement || '').replace(/\|/g, '\\|');
      out.push(`| \`${c.id}\` | ${stmt} | ${c.confidence || '?'} | ${c.verified_on || '?'} |`);
    }
    out.push('');
  }
  fs.writeFileSync(path.join(dir, 'INDEX.md'), out.join('\n'), 'utf8');

  // refs.bib from card frontmatter.
  const bib = [];
  for (const c of cards) {
    if (!c.bibkey) continue;
    const type = c.source_type === 'book' ? 'book'
      : c.source_type === 'preprint' ? 'misc' : 'article';
    const fields = [
      c.title && `  title = {${c.title}}`,
      Array.isArray(c.authors) && c.authors.length && `  author = {${c.authors.join(' and ')}}`,
      c.year && `  year = {${c.year}}`,
      c.venue && `  journal = {${c.venue}}`,
      c.volume && `  volume = {${c.volume}}`,
      c.pages && `  pages = {${c.pages}}`,
      c.doi && `  doi = {${c.doi}}`,
      c.url && `  url = {${c.url}}`,
    ].filter(Boolean);
    bib.push(`@${type}{${c.bibkey},\n${fields.join(',\n')}\n}`);
  }
  fs.writeFileSync(path.join(dir, 'refs.bib'), `${bib.join('\n\n')}\n`, 'utf8');

  console.log(`indexed ${claims.length} claims across ${byTopic.size} topics; ${bib.length} bib entries`);
}

function cmdCommonsStale() {
  const dir = commonsDir();
  const days = getConfig().defaults.staleness_days;
  const cutoff = Date.now() - days * 86400000;
  const stale = [];
  for (const file of listMd(path.join(dir, 'claims'))) {
    const fm = readFrontmatter(file);
    const when = fm.verified_on ? Date.parse(fm.verified_on) : 0;
    if (!when || when < cutoff) stale.push(fm);
  }
  if (!stale.length) {
    console.log(`no claims older than ${days} days`);
    return;
  }
  console.log(`${stale.length} claim(s) past ${days} days:`);
  for (const c of stale) console.log(`  ${c.id}  verified=${c.verified_on || 'never'}  ${c.statement || ''}`);
}

// ----------------------------------------------------------------- verify

/**
 * Deterministic evidence checking, layered over the vendored scripts in
 * vendor/deep-research-verify (see its NOTICE.md).
 *
 * The verdict is computed here rather than taken from the vendored tools:
 * upstream's pass threshold is tuned for its own report format and will
 * report "pass" at a 50% unsupported rate, which is not our bar.
 */

const PY = process.env.ACAD_PYTHON || 'python';
const SCRIPTS = path.join(HERE, 'scripts');
const VENDOR = path.join(HERE, 'vendor', 'deep-research-verify', 'scripts');

function runPy(script, argv, { allowExit = [0] } = {}) {
  const res = spawnSync(PY, [script, ...argv], { encoding: 'utf8' });
  if (res.error) {
    die(`could not run ${PY} — set ACAD_PYTHON to your interpreter (${res.error.message})`);
  }
  if (!allowExit.includes(res.status)) {
    const out = (res.stderr || res.stdout || '').trim();
    die(`${path.basename(script)} exited ${res.status}: ${out}`);
  }
  return { code: res.status, out: (res.stdout || '').trim(), err: (res.stderr || '').trim() };
}

function verifyRunDir(root) {
  return path.join(root, '.academician', 'verify');
}

function buildRunDir(root, question) {
  // Exit 2 means "converted, but some cards carry no quoted passage" — that is
  // a finding for the checker, not a failure to build the run directory.
  const r = runPy(path.join(SCRIPTS, 'cards_to_run.py'),
    ['--project', root, '--query', question || '', '--quiet'], { allowExit: [0, 2] });
  return r;
}

function cmdVerifyEvidence(_pos, flags) {
  const { root, project } = requireProject(flags);
  console.log('building verification run from evidence/cards/ ...');
  buildRunDir(root, project.title);
  const runDir = verifyRunDir(root);

  const sources = fs.existsSync(path.join(runDir, 'sources.jsonl'))
    ? fs.readFileSync(path.join(runDir, 'sources.jsonl'), 'utf8').trim().split('\n').filter(Boolean).length
    : 0;
  const evidence = fs.existsSync(path.join(runDir, 'evidence.jsonl'))
    ? fs.readFileSync(path.join(runDir, 'evidence.jsonl'), 'utf8').trim().split('\n').filter(Boolean).length
    : 0;

  const cardMap = readJson(path.join(runDir, 'card_map.json'), {});
  const noPassage = Object.entries(cardMap).filter(([, v]) => {
    const evRows = fs.existsSync(path.join(runDir, 'evidence.jsonl'))
      ? fs.readFileSync(path.join(runDir, 'evidence.jsonl'), 'utf8')
      : '';
    return !evRows.includes(`"${v.source_id}"`);
  }).map(([k]) => k);

  console.log(`\nsources:  ${sources}`);
  console.log(`evidence: ${evidence} quoted passages`);

  if (noPassage.length) {
    console.log(`\nBLOCKER — ${noPassage.length} card(s) with no quoted passage:`);
    for (const c of noPassage) console.log(`  ${c}`);
    console.log('A card with no verbatim passage cannot support any claim.');
  }

  if (flags.dois) {
    console.log('\nresolving DOIs (needs network) ...');
    const r = runPy(path.join(VENDOR, 'verify_citations.py'),
      ['--report', flags.dois], { allowExit: [0, 1] });
    console.log(r.out || r.err);
  }

  const verdict = noPassage.length ? 'REVISE' : 'PASS';
  console.log(`\nverdict (mechanical checks only): ${verdict}`);
  console.log('Coverage, independence, and falsification judgment stay with acad-evidence-checker.');
  process.exit(verdict === 'PASS' ? 0 : 3);
}

function cmdVerifyDraft(pos, flags) {
  const { root, project } = requireProject(flags);
  const report = path.resolve(root, pos[0] || flags.report || path.join('draft', 'DRAFT.md'));
  if (!fs.existsSync(report)) die(`no draft at ${report}`);

  console.log(`checking ${path.relative(root, report)} against evidence/cards/ ...\n`);
  buildRunDir(root, project.title);
  const runDir = verifyRunDir(root);

  // Rebuild the claim ledger from scratch; a stale one verifies an old draft.
  const claimsPath = path.join(runDir, 'claims.jsonl');
  if (fs.existsSync(claimsPath)) fs.rmSync(claimsPath);

  runPy(path.join(VENDOR, 'extract_claims.py'), ['extract', '--report', report, '--dir', runDir]);

  const link = runPy(path.join(SCRIPTS, 'link_claims.py'),
    ['--dir', runDir, '--json'], { allowExit: [0, 1, 2] });
  const linkResult = JSON.parse(link.out);

  runPy(path.join(VENDOR, 'verify_claim_support.py'),
    ['verify', '--dir', runDir], { allowExit: [0, 1] });

  const claims = fs.readFileSync(claimsPath, 'utf8').trim().split('\n')
    .filter(Boolean).map((l) => JSON.parse(l));
  const byStatus = {};
  for (const c of claims) byStatus[c.support_status] = (byStatus[c.support_status] || 0) + 1;

  // A claim with no marker is already reported as uncited by link_claims;
  // do not also count it as an unsupported factual claim.
  const citedUnsupported = claims.filter(
    (c) => c.support_status === 'unsupported' && (c.cited_source_ids || []).length > 0);
  const partial = claims.filter((c) => c.support_status === 'partial');
  const needsReview = claims.filter((c) => c.support_status === 'needs_review');

  console.log(`claims extracted: ${claims.length}`);
  console.log(`support status:   ${JSON.stringify(byStatus)}`);

  const blockers = [];
  if (linkResult.dangling) {
    blockers.push(`${linkResult.dangling} dangling reference(s)`);
    console.log('\nBLOCKER — dangling references:');
    for (const d of linkResult.dangling_refs) console.log(`  [[${d.marker}]]  ${d.text}`);
  }
  if (linkResult.uncited) {
    blockers.push(`${linkResult.uncited} uncited assertion(s)`);
    console.log('\nBLOCKER — uncited assertions:');
    for (const t of linkResult.uncited_claims) console.log(`  ${t}`);
  }
  if (citedUnsupported.length) {
    blockers.push(`${citedUnsupported.length} cited-but-unsupported claim(s)`);
    console.log('\nBLOCKER — cited source does not support the claim:');
    for (const c of citedUnsupported) console.log(`  ${c.text.slice(0, 150)}`);
  }
  if (partial.length) {
    console.log('\nREVIEW — partial support (likely overreach; narrow the claim):');
    for (const c of partial) console.log(`  ${c.text.slice(0, 150)}`);
  }
  if (needsReview.length) {
    console.log('\nREVIEW — cites a card with no quoted passage:');
    for (const c of needsReview) console.log(`  ${c.text.slice(0, 150)}`);
  }

  const verdict = blockers.length ? 'REVISE-DRAFT' : 'PASS';
  console.log(`\nverdict (mechanical checks only): ${verdict}`);
  if (blockers.length) console.log(`  ${blockers.join('; ')}`);
  console.log('Faithfulness, argument integrity, and scope stay with acad-draft-checker.');
  console.log(`\nledger: ${path.relative(root, claimsPath)}`);
  process.exit(verdict === 'PASS' ? 0 : 3);
}

function cmdVerifyTest() {
  const testDir = path.join(HERE, 'vendor', 'deep-research-verify');
  const res = spawnSync(PY, ['-m', 'pytest', 'tests/', '-q'],
    { cwd: testDir, encoding: 'utf8' });
  console.log(res.stdout || '');
  if (res.stderr) console.error(res.stderr);
  process.exit(res.status ?? 1);
}

// ------------------------------------------------------------------- help

const HELP = `acad — Academician state, registry, and commons operations

  init                                 create ~/.academician/{config,registry}.json

  project add <slug> --path <dir>      register a project
        [--title t] [--visibility private|public] [--topics a,b]
  project list [--topic t] [--status s]
  project show <slug>
  project update <slug> [--path d] [--title t] [--visibility v]
        [--topics a,b] [--status active|complete|archived|abandoned]
  project remove <slug>                unregister; does not delete files

  state show [--json]                  current stage, budgets, pending gate
  state set <stage> [--note n]         force a stage (use sparingly)
  state advance [--force]              next stage; refuses past an unanswered gate
  state iterate <plan|research|draft|review>
                                       bump a loop counter; exits 3 at budget
  state block "<reason>"

  gate log <gate> <approve|revise|reject> ["notes"]
                                       append to DECISIONS.md and record it

  commons search "<terms>"
  commons show <id>
  commons index                        rebuild INDEX.md and refs.bib
  commons stale                        claims past staleness_days

  verify evidence [--dois <report.md>] cards -> run dir; flags cards with no
                                       quoted passage; optional DOI resolution
  verify draft [<report.md>]           extract claims, link [[card-id]] markers,
                                       check support. Default draft/DRAFT.md
  verify test                          run the vendored verification test suite

Verify exits 3 on REVISE so a caller can branch on it. Mechanical checks only:
coverage, independence, faithfulness and scope stay with the checker agents.

Project commands act on the nearest .academician/ ancestor of the cwd, or
--project <path>.
Stages: ${STAGES.join(' -> ')}`;

// ----------------------------------------------------------------- dispatch

const ROUTES = {
  init: { _: cmdInit },
  project: { add: cmdProjectAdd, list: cmdProjectList, show: cmdProjectShow, update: cmdProjectUpdate, remove: cmdProjectRemove },
  state: { show: cmdStateShow, set: cmdStateSet, advance: cmdStateAdvance, iterate: cmdStateIterate, block: cmdStateBlock },
  gate: { log: cmdGateLog },
  commons: { search: cmdCommonsSearch, show: cmdCommonsShow, index: cmdCommonsIndex, stale: cmdCommonsStale },
  verify: { evidence: cmdVerifyEvidence, draft: cmdVerifyDraft, test: cmdVerifyTest },
};

function main() {
  const [positional, flags] = parseArgs(process.argv.slice(2));
  const [group, sub, ...rest] = positional;

  if (!group || group === 'help' || flags.help) {
    console.log(HELP);
    return;
  }
  const route = ROUTES[group];
  if (!route) die(`unknown command "${group}" — try: acad help`);

  if (route._) {
    route._(sub ? [sub, ...rest] : [], flags);
    return;
  }
  const handler = route[sub];
  if (!handler) die(`unknown "${group}" subcommand "${sub || ''}" — try: acad help`);
  handler(rest, flags);
}

main();

#!/usr/bin/env python3
"""
Convert Academician source cards into a verification run directory.

Source cards are markdown because a human reads them at the evidence gate.
The vendored verification scripts work on JSONL. This script is the bridge:
cards are the source of truth, the run directory is derived and disposable.

It shells out to the vendored citation_manager and evidence_store rather than
recomputing IDs, so the hashing lives in exactly one place and an upstream
refresh cannot silently desynchronize us.

Usage:
  python cards_to_run.py --project <dir> [--out <dir>] [--query "..."]

Reads  <project>/evidence/cards/*.md
Writes <project>/.academician/verify/{sources,evidence}.jsonl, run_manifest.json
       <project>/.academician/verify/card_map.json   card_id -> source_id
"""

import argparse
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
VENDOR = os.path.join(HERE, '..', 'vendor', 'deep-research-verify', 'scripts')

# Academician card `source_type` -> the enum in vendor/schemas/source.schema.json
SOURCE_TYPE_MAP = {
    'journal-article': 'academic',
    'preprint': 'academic',
    'conference-paper': 'academic',
    'thesis': 'academic',
    'dataset': 'academic',
    'book': 'book',
    'report': 'government',
    'standard': 'documentation',
    'documentation': 'documentation',
    'code': 'code',
    'news': 'news',
    'web': 'web',
    'interview': 'web',
}


def die(msg):
    print(f'cards_to_run: {msg}', file=sys.stderr)
    sys.exit(1)


def parse_frontmatter(text):
    """Minimal YAML frontmatter reader: scalars and simple [a, b] lists."""
    m = re.match(r'^---\r?\n(.*?)\r?\n---', text, re.DOTALL)
    if not m:
        return {}, text
    fm = {}
    for line in m.group(1).splitlines():
        kv = re.match(r'^([A-Za-z_][\w-]*):\s*(.*)$', line)
        if not kv:
            continue
        key, value = kv.group(1), kv.group(2).strip()
        if value.startswith('[') and value.endswith(']'):
            value = [v.strip().strip('"\'') for v in value[1:-1].split(',') if v.strip()]
        else:
            value = value.strip('"\'')
            if value in ('null', ''):
                value = None
            elif value == 'true':
                value = True
            elif value == 'false':
                value = False
        fm[key] = value
    return fm, text[m.end():]


def parse_key_passages(body):
    """Pull (quote, locator) pairs out of the '## Key passages' section.

    Expected shape, per the evidence-standards skill:

        > "the quoted text, possibly
        > spanning lines"
        -- p. 17, Section 4.2
    """
    m = re.search(r'^##\s*Key passages\s*$(.*?)(?=^##\s|\Z)', body,
                  re.MULTILINE | re.DOTALL | re.IGNORECASE)
    if not m:
        return []
    section = m.group(1)

    passages = []
    buf = []
    for raw in section.splitlines():
        line = raw.rstrip()
        if line.startswith('>'):
            buf.append(line.lstrip('> ').strip())
            continue
        # A locator line closes the quote it follows.
        loc = re.match(r'^\s*(?:--|—|–)\s*(.+)$', line)
        if buf:
            quote = ' '.join(x for x in buf if x).strip().strip('"')
            if quote:
                passages.append((quote, loc.group(1).strip() if loc else None))
            buf = []
    if buf:
        quote = ' '.join(x for x in buf if x).strip().strip('"')
        if quote:
            passages.append((quote, None))
    return passages


def run_vendor(script, args):
    proc = subprocess.run(
        [sys.executable, os.path.join(VENDOR, script)] + args,
        capture_output=True, text=True, encoding='utf-8',
    )
    if proc.returncode != 0:
        die(f'{script} failed: {proc.stderr.strip() or proc.stdout.strip()}')
    return proc.stdout.strip()


def main():
    ap = argparse.ArgumentParser(description='Academician cards -> verification run dir')
    ap.add_argument('--project', required=True, help='Project root')
    ap.add_argument('--out', help='Run dir (default <project>/.academician/verify)')
    ap.add_argument('--query', default='', help='Research question for the manifest')
    ap.add_argument('--quiet', action='store_true')
    args = ap.parse_args()

    project = os.path.abspath(args.project)
    cards_dir = os.path.join(project, 'evidence', 'cards')
    if not os.path.isdir(cards_dir):
        die(f'no evidence/cards/ in {project}')

    out = os.path.abspath(args.out or os.path.join(project, '.academician', 'verify'))
    os.makedirs(out, exist_ok=True)

    # Rebuild from scratch: cards are the source of truth and a stale run dir
    # would quietly verify evidence that no longer exists.
    for name in ('sources.jsonl', 'evidence.jsonl', 'claims.jsonl'):
        p = os.path.join(out, name)
        if os.path.exists(p):
            os.remove(p)

    run_vendor('citation_manager.py',
               ['init-run', '--out-dir', out, '--query', args.query, '--mode', 'deep'])

    card_map = {}
    counts = {'cards': 0, 'sources': 0, 'evidence': 0, 'no_quote': []}

    for fname in sorted(os.listdir(cards_dir)):
        if not fname.endswith('.md') or fname == '.gitkeep':
            continue
        path = os.path.join(cards_dir, fname)
        with open(path, encoding='utf-8') as f:
            text = f.read()
        fm, body = parse_frontmatter(text)
        if not fm.get('id'):
            die(f'{fname} has no `id` in frontmatter')
        counts['cards'] += 1

        doi = fm.get('doi')
        url = fm.get('url')
        raw_url = url or (f'https://doi.org/{doi}' if doi else None)
        if not raw_url:
            die(f'{fm["id"]} has neither url nor doi — it cannot be verified')

        payload = {
            'raw_url': raw_url,
            'title': fm.get('title') or fm['id'],
            'source_type': SOURCE_TYPE_MAP.get(fm.get('source_type'), 'web'),
        }
        if doi:
            payload['canonical_locator'] = f'doi:{doi}'
        if isinstance(fm.get('authors'), list):
            payload['authors'] = fm['authors']
        if fm.get('year'):
            payload['year'] = str(fm['year'])

        res = json.loads(run_vendor(
            'citation_manager.py',
            ['register-source', '--json', json.dumps(payload), '--dir', out]))
        source_id = res['source_id']
        card_map[fm['id']] = {
            'source_id': source_id,
            'card_file': os.path.relpath(path, project).replace('\\', '/'),
            'subquestion': fm.get('subquestion'),
            'credibility': fm.get('credibility'),
            'access': fm.get('access'),
            'verified': fm.get('verified'),
        }
        if res.get('status') != 'duplicate':
            counts['sources'] += 1

        passages = parse_key_passages(body)
        if not passages:
            counts['no_quote'].append(fm['id'])
        for quote, locator in passages:
            ev = {
                'source_id': source_id,
                'quote': quote,
                'evidence_type': 'direct_quote',
                'retrieval_query': fm.get('subquestion'),
            }
            if locator:
                ev['locator'] = locator
            run_vendor('evidence_store.py',
                       ['add', '--json', json.dumps(ev), '--dir', out])
            counts['evidence'] += 1

    with open(os.path.join(out, 'card_map.json'), 'w', encoding='utf-8') as f:
        json.dump(card_map, f, indent=2)

    if not args.quiet:
        print(f'cards:    {counts["cards"]}')
        print(f'sources:  {counts["sources"]} registered ({counts["cards"] - counts["sources"]} duplicate locator)')
        print(f'evidence: {counts["evidence"]} quoted passages')
        print(f'run dir:  {out}')
        if counts['no_quote']:
            # Not fatal here: the evidence checker decides what to do about it.
            print('\nCards with NO key passage (cannot support any claim):')
            for cid in counts['no_quote']:
                print(f'  {cid}')

    # Exit 2 signals "converted, but some cards are unusable as support".
    sys.exit(2 if counts['no_quote'] else 0)


if __name__ == '__main__':
    main()

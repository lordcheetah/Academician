#!/usr/bin/env python3
"""
Link extracted claims to their sources and evidence.

The vendored extract_claims.py recognizes numeric citations (`[1]`) and leaves
`cited_source_ids` for "the linking step" — which in upstream's pipeline is its
own display-number machinery. Academician drafts cite `[[card-id]]` instead, so
this is that linking step for our marker syntax.

Without it every claim looks unsupported, because verify_claim_support.py has
no evidence to compare a claim against.

Run after extract_claims.py and before verify_claim_support.py.

Usage:
  python link_claims.py --dir <run-dir> [--strict]

Reads/writes <run-dir>/claims.jsonl; reads card_map.json and evidence.jsonl.
Exit 0 clean, 1 on dangling references when --strict, 2 on uncited claims.
"""

import argparse
import json
import os
import re
import sys

MARKER_RE = re.compile(r'\[\[([^\]]+)\]\]')

# Sentences that assert nothing about the world and so need no citation.
NON_ASSERTIVE_RE = re.compile(
    r'^\s*(this (paper|section|chapter|review)|we (will|now|next)|'
    r'the (following|remainder|rest) of)\b',
    re.IGNORECASE,
)


def read_jsonl(path):
    rows = []
    if not os.path.exists(path):
        return rows
    with open(path, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def write_jsonl(path, rows):
    with open(path, 'w', encoding='utf-8') as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + '\n')


def main():
    ap = argparse.ArgumentParser(description='Link Academician [[card-id]] claims to sources')
    ap.add_argument('--dir', required=True, help='Run directory')
    ap.add_argument('--strict', action='store_true',
                    help='Exit 1 if any marker fails to resolve')
    ap.add_argument('--json', action='store_true', help='Machine-readable output')
    args = ap.parse_args()

    run_dir = os.path.abspath(args.dir)
    claims_path = os.path.join(run_dir, 'claims.jsonl')
    map_path = os.path.join(run_dir, 'card_map.json')

    if not os.path.exists(claims_path):
        print('link_claims: no claims.jsonl — run extract_claims.py first', file=sys.stderr)
        sys.exit(1)
    if not os.path.exists(map_path):
        print('link_claims: no card_map.json — run cards_to_run.py first', file=sys.stderr)
        sys.exit(1)

    with open(map_path, encoding='utf-8') as f:
        card_map = json.load(f)

    # source_id -> [evidence_id], so a claim citing a card inherits that
    # card's quoted passages as the evidence to check it against.
    evidence_by_source = {}
    for ev in read_jsonl(os.path.join(run_dir, 'evidence.jsonl')):
        evidence_by_source.setdefault(ev['source_id'], []).append(ev['evidence_id'])

    claims = read_jsonl(claims_path)
    dangling = []      # marker in the draft that resolves to no card
    uncited = []       # assertion with no marker at all
    no_evidence = []   # cites a real card, but that card has no quoted passage
    linked = 0

    for claim in claims:
        text = claim.get('text', '')
        markers = MARKER_RE.findall(text)

        if not markers:
            if not NON_ASSERTIVE_RE.match(text):
                uncited.append(claim)
            continue

        source_ids, evidence_ids = [], []
        for marker in markers:
            entry = card_map.get(marker.strip())
            if not entry:
                dangling.append({'claim_id': claim['claim_id'], 'marker': marker.strip(),
                                 'text': text[:120]})
                continue
            sid = entry['source_id']
            if sid not in source_ids:
                source_ids.append(sid)
            for eid in evidence_by_source.get(sid, []):
                if eid not in evidence_ids:
                    evidence_ids.append(eid)
            if not evidence_by_source.get(sid):
                no_evidence.append({'claim_id': claim['claim_id'], 'card': marker.strip()})

        claim['cited_source_ids'] = source_ids
        claim['evidence_ids'] = evidence_ids
        if source_ids:
            linked += 1

    write_jsonl(claims_path, claims)

    result = {
        'claims': len(claims),
        'linked': linked,
        'uncited': len(uncited),
        'dangling': len(dangling),
        'cards_without_passages': len(no_evidence),
    }

    if args.json:
        print(json.dumps({**result, 'uncited_claims': [c['text'][:160] for c in uncited],
                          'dangling_refs': dangling, 'no_evidence': no_evidence}, indent=2))
    else:
        print(f'claims:   {result["claims"]}')
        print(f'linked:   {result["linked"]}')
        print(f'uncited:  {result["uncited"]}')
        print(f'dangling: {result["dangling"]}')
        if dangling:
            print('\nDANGLING REFERENCES (marker resolves to no card):')
            for d in dangling:
                print(f'  [[{d["marker"]}]]  in: {d["text"]}')
        if uncited:
            print('\nUNCITED ASSERTIONS (no marker):')
            for c in uncited:
                print(f'  {c["text"][:160]}')
        if no_evidence:
            print('\nCITES A CARD WITH NO QUOTED PASSAGE (cannot be supported):')
            for n in no_evidence:
                print(f'  {n["card"]}')

    if args.strict and dangling:
        sys.exit(1)
    if uncited:
        sys.exit(2)
    sys.exit(0)


if __name__ == '__main__':
    main()

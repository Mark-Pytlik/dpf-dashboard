#!/usr/bin/env python3
"""Fetch FanGraphs Stuff+ / Location+ / Pitching+ for the current season.

Writes: data/stuff_plus_2026.csv with schema:
    name|stuff_plus|location_plus|pitching_plus

Uses pybaseball.pitching_stats, which handles FanGraphs' Cloudflare
challenge via a managed requests session. Direct CSV fetches are blocked
(Cloudflare anti-bot), so we cannot use plain requests here.

This script is designed to be run daily from CI. It's fault-tolerant:
if the fetch fails (API change, site down), it leaves the existing
stuff_plus_2026.csv untouched so the dashboard keeps shipping.
"""
from __future__ import annotations
import csv
import os
import sys
import traceback

SEASON = int(os.environ.get('DPF_SEASON', '2026'))
OUTDIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')


def fetch_stuffplus() -> int:
    try:
        from pybaseball import pitching_stats
    except ImportError:
        print('ERROR: pybaseball not installed. `pip install pybaseball`')
        return 0

    # qual=1 → include anyone with >=1 IP. We want broad coverage so early
    # season data still lights up the dials. Dashboard filters by its own IP
    # threshold downstream.
    try:
        df = pitching_stats(SEASON, qual=1)
    except Exception as e:
        print(f'ERROR: pitching_stats({SEASON}) raised: {e}')
        traceback.print_exc()
        return 0

    if df is None or df.empty:
        print(f'WARNING: pitching_stats({SEASON}) returned empty DataFrame.')
        return 0

    # FanGraphs column names. If they change, we'll catch it in the sanity
    # check below and fail without trashing the existing file.
    cols = {c: c for c in df.columns}
    name_col = 'Name' if 'Name' in cols else None
    stuff_col = next((c for c in ('Stuff+', 'Stf+', 'stuff_plus') if c in cols), None)
    loc_col = next((c for c in ('Location+', 'Loc+', 'location_plus') if c in cols), None)
    pit_col = next((c for c in ('Pitching+', 'Pit+', 'pitching_plus') if c in cols), None)

    if not (name_col and stuff_col and loc_col and pit_col):
        print(
            f'ERROR: expected Stuff+ columns missing. '
            f'Found: name={name_col} stuff={stuff_col} loc={loc_col} pit={pit_col}'
        )
        print(f'Available columns sample: {list(df.columns)[:40]}')
        return 0

    out_path = os.path.join(OUTDIR, f'stuff_plus_{SEASON}.csv')
    wrote = 0
    with open(out_path, 'w', newline='') as f:
        w = csv.writer(f, delimiter='|')
        w.writerow(['name', 'stuff_plus', 'location_plus', 'pitching_plus'])
        for _, row in df.iterrows():
            nm = str(row[name_col] or '').strip()
            if not nm:
                continue
            stuff = row[stuff_col]
            loc = row[loc_col]
            pit = row[pit_col]
            # Skip rows where all three plus-stats are NaN (didn't throw enough pitches).
            if all(v != v for v in (stuff, loc, pit)):  # NaN != NaN trick
                continue
            w.writerow([
                nm,
                '' if stuff != stuff else int(round(float(stuff))),
                '' if loc != loc else int(round(float(loc))),
                '' if pit != pit else int(round(float(pit))),
            ])
            wrote += 1

    print(f'Stuff+ {SEASON}: wrote {wrote} rows to {out_path}')
    return wrote


def main():
    os.makedirs(OUTDIR, exist_ok=True)
    n = fetch_stuffplus()
    if n == 0:
        # Don't fail the build — leave prior CSV in place. Exit 0.
        print('fetch_stuffplus.py: non-fatal, proceeding.')
        sys.exit(0)


if __name__ == '__main__':
    main()

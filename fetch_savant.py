#!/usr/bin/env python3
"""Fetch Baseball Savant 2026 data.

Writes three files:
  data/bat_statcast_2026.csv          — name|barrel_pct|hard_hit_pct|woba|xwoba
  data/savant_percentiles_bat_2026.csv — Savant "circles" for each batter
  data/savant_percentiles_pit_2026.csv — Savant "circles" for each pitcher

The dashboard loads these every build so that the Analytics tab can show
fresh percentile dials alongside LCV / projections.

Uses Baseball Savant's public CSV leaderboard exports. No scraping,
no auth, no selenium — just requests.get.
"""
from __future__ import annotations
import csv
import io
import os
import sys
import time
import requests

SEASON = int(os.environ.get('DPF_SEASON', '2026'))
OUTDIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
UA = 'Mozilla/5.0 (compatible; dpf-dashboard/1.0)'

# Baseball Savant custom leaderboard — batters. Use min=1 (>=1 BBE) to get
# everyone with any batted-ball data; the dashboard does its own PA filtering.
BAT_URL = (
    'https://baseballsavant.mlb.com/leaderboard/custom'
    '?year={year}&type=batter&filter=&min=1'
    '&selections=pa,woba,xwoba,barrel_batted_rate,hard_hit_percent'
    '&sort=pa,1&csv=true'
)

# Savant's canonical "percentile rankings" leaderboard. These are the
# circles on the Savant player pages.
PCT_URL = (
    'https://baseballsavant.mlb.com/leaderboard/percentile-rankings'
    '?type={type}&year={year}&csv=true'
)


def _get(url: str, retries: int = 3) -> str:
    last_exc = None
    for attempt in range(retries):
        try:
            r = requests.get(url, headers={'User-Agent': UA}, timeout=30)
            r.raise_for_status()
            # Savant prepends a UTF-8 BOM.
            return r.content.decode('utf-8-sig')
        except Exception as e:
            last_exc = e
            time.sleep(2 ** attempt)
    raise RuntimeError(f'Failed to fetch {url}: {last_exc}')


def _normalize_name(raw: str) -> str:
    """'Trout, Mike' -> 'Mike Trout'. Handles middle parts gracefully."""
    raw = (raw or '').strip().strip('"')
    if ',' in raw:
        last, first = raw.split(',', 1)
        return f'{first.strip()} {last.strip()}'
    return raw


def fetch_batted_ball() -> int:
    csv_text = _get(BAT_URL.format(year=SEASON))
    reader = csv.DictReader(io.StringIO(csv_text))
    rows = list(reader)
    if not rows:
        print(f'WARNING: no Statcast rows returned. Leaving bat_statcast_{SEASON}.csv untouched.')
        return 0
    print(f'Statcast batted-ball: got {len(rows)} rows')

    out_path = os.path.join(OUTDIR, f'bat_statcast_{SEASON}.csv')
    with open(out_path, 'w', newline='') as f:
        w = csv.writer(f, delimiter='|')
        w.writerow(['name', 'barrel_pct', 'hard_hit_pct', 'woba', 'xwoba'])
        wrote = 0
        for r in rows:
            name = _normalize_name(r.get('last_name, first_name') or r.get('\ufefflast_name, first_name') or '')
            if not name:
                continue
            w.writerow([
                name,
                r.get('barrel_batted_rate') or '',
                r.get('hard_hit_percent') or '',
                r.get('woba') or '',
                r.get('xwoba') or '',
            ])
            wrote += 1
    print(f'Wrote {wrote} rows to {out_path}')
    return wrote


def fetch_percentiles(kind: str) -> int:
    """kind = 'batter' or 'pitcher'."""
    csv_text = _get(PCT_URL.format(type=kind, year=SEASON))
    reader = csv.DictReader(io.StringIO(csv_text))
    rows = list(reader)
    if not rows:
        print(f'WARNING: no {kind} percentile rows returned.')
        return 0

    # The Savant file already has one row per player with columns whose values
    # are 0-100 percentile ranks. We keep the schema as-is (wide) but normalize
    # the name column so the dashboard can join on it.
    out_path = os.path.join(OUTDIR, f'savant_percentiles_{"bat" if kind=="batter" else "pit"}_{SEASON}.csv')
    # Preserve Savant column order but rename player_name -> name for joining.
    fieldnames = ['name'] + [c for c in reader.fieldnames if c not in ('player_name', '\ufeffplayer_name')]
    with open(out_path, 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, delimiter='|')
        w.writeheader()
        wrote = 0
        for r in rows:
            raw_name = r.get('player_name') or r.get('\ufeffplayer_name') or ''
            nm = _normalize_name(raw_name)
            if not nm:
                continue
            out = {k: r.get(k, '') for k in fieldnames if k != 'name'}
            out['name'] = nm
            w.writerow(out)
            wrote += 1
    print(f'Wrote {wrote} rows to {out_path}')
    return wrote


def main():
    os.makedirs(OUTDIR, exist_ok=True)
    bb = fetch_batted_ball()
    pb = fetch_percentiles('batter')
    pp = fetch_percentiles('pitcher')
    print(f'Savant fetch complete: batted-ball={bb}, batter-pct={pb}, pitcher-pct={pp}')


if __name__ == '__main__':
    main()

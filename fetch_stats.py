#!/usr/bin/env python3
"""Fetch 2026 in-season MLB stats from the MLB Stats API.
No third-party baseball libraries required — uses only requests.

Run this periodically to update the dashboard with real stats.
Creates data/bat_2026.csv and data/pit_2026.csv for the build script.

Usage: python3 fetch_stats.py
"""

import sys
import os
import json
import time
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed

OUTDIR = 'data'
MLB_API = 'https://statsapi.mlb.com/api/v1'
SEASON = 2026

# MLB → FanGraphs team abbreviation mapping (for name consistency with the player pool)
MLB_TO_FG = {
    'SD':  'SDP',
    'SF':  'SFG',
    'TB':  'TBR',
    'WAS': 'WSN',
    'AZ':  'ARI',
    'CWS': 'CHW',
    'KC':  'KCR',
    # Everything else maps 1:1
}

def norm_team(abbr):
    """Normalize MLB API team abbreviation to FanGraphs style."""
    return MLB_TO_FG.get(abbr, abbr) if abbr else ''

def parse_ip(ip_str):
    """Parse MLB API inningsPitched string (e.g. '6.2' = 6 innings + 2 outs = 6.667).
    Returns a float representing true innings pitched."""
    try:
        parts = str(ip_str).split('.')
        full = int(parts[0]) if parts[0] else 0
        outs = int(parts[1]) if len(parts) > 1 and parts[1] else 0
        return round(full + outs / 3, 1)
    except Exception:
        return 0.0

def fetch_pitching_stats():
    """Fetch 2026 pitching stats for all MLB pitchers."""
    print("Fetching 2026 pitching stats from MLB Stats API...")
    url = (f'{MLB_API}/stats?stats=season&season={SEASON}&group=pitching'
           f'&gameType=R&limit=600&playerPool=ALL&sportId=1&hydrate=team')
    try:
        r = requests.get(url, timeout=20)
        r.raise_for_status()
        splits = r.json().get('stats', [{}])[0].get('splits', [])
        print(f"  Got {len(splits)} pitchers from API")
    except Exception as e:
        print(f"  ERROR fetching pitching stats: {e}")
        return False

    # Build list of starters (need QS calculation via game logs)
    starters = []
    rows = []
    for s in splits:
        stat = s.get('stat', {})
        player = s.get('player', {})
        team_obj = s.get('team', {})
        name = player.get('fullName', '')
        pid = player.get('id')
        team = norm_team(team_obj.get('abbreviation', ''))
        gs = int(stat.get('gamesStarted', 0) or 0)

        # Parse IP: MLB API returns "20.1" = 20⅓ innings
        ip_raw = stat.get('inningsPitched', '0')
        ip = parse_ip(ip_raw)

        def safe_float(v, default=0.0):
            try:
                return float(v) if v and v not in ('-.--', '-.-', '-') else default
            except (ValueError, TypeError):
                return default

        row = {
            'name': name,
            'team': team,
            'ip': round(ip, 1),
            'w': int(stat.get('wins', 0) or 0),
            'sv': int(stat.get('saves', 0) or 0),
            'hld': int(stat.get('holds', 0) or 0),
            'era': safe_float(stat.get('era')),
            'whip': safe_float(stat.get('whip')),
            'so': int(stat.get('strikeOuts', 0) or 0),
            'hr': int(stat.get('homeRuns', 0) or 0),
            'qs': 0,
            '_pid': pid,
            '_gs': gs,
        }
        rows.append(row)
        if gs >= 1 and pid:
            starters.append((pid, name))

    # Calculate Quality Starts from game logs
    print(f"  Computing QS for {len(starters)} starters via game logs...")
    qs_map = {}

    def fetch_qs(pid_name):
        pid, name = pid_name
        url = (f'{MLB_API}/people/{pid}/stats?stats=gameLog&season={SEASON}'
               f'&group=pitching&gameType=R')
        try:
            resp = requests.get(url, timeout=10)
            game_splits = resp.json().get('stats', [{}])[0].get('splits', [])
            qs = 0
            for g in game_splits:
                gs = int(g.get('stat', {}).get('gamesStarted', 0) or 0)
                if gs < 1:
                    continue
                ip_dec = parse_ip(g.get('stat', {}).get('inningsPitched', '0'))
                er_raw = g.get('stat', {}).get('earnedRuns')
                er = int(er_raw) if er_raw is not None else 99
                if ip_dec >= 6.0 and er <= 3:
                    qs += 1
            return pid, qs
        except Exception:
            return pid, 0

    with ThreadPoolExecutor(max_workers=20) as ex:
        futures = {ex.submit(fetch_qs, pn): pn for pn in starters}
        done = 0
        for fut in as_completed(futures):
            pid, qs = fut.result()
            qs_map[pid] = qs
            done += 1
            if done % 50 == 0:
                print(f"    {done}/{len(starters)} QS calculations done...")

    print(f"  QS computed for {len(qs_map)} starters")

    # Apply QS and filter to meaningful pitchers
    out_rows = []
    for row in rows:
        pid = row.pop('_pid')
        gs = row.pop('_gs')
        row['qs'] = qs_map.get(pid, 0)
        if row['ip'] > 0:
            out_rows.append(row)

    if not out_rows:
        print("  No pitching data to save")
        return False

    # Write to CSV
    path = os.path.join(OUTDIR, 'pit_2026.csv')
    cols = ['name', 'team', 'ip', 'w', 'sv', 'hld', 'era', 'whip', 'so', 'hr', 'qs']
    with open(path, 'w') as f:
        f.write('|'.join(cols) + '\n')
        for row in out_rows:
            vals = [str(row.get(c, '')) for c in cols]
            f.write('|'.join(vals) + '\n')

    print(f"  Saved {len(out_rows)} pitchers to {path}")
    return True


def fetch_batting_stats():
    """Fetch 2026 batting stats for all MLB batters."""
    print("Fetching 2026 batting stats from MLB Stats API...")
    url = (f'{MLB_API}/stats?stats=season&season={SEASON}&group=hitting'
           f'&gameType=R&limit=600&playerPool=ALL&sportId=1&hydrate=team')
    try:
        r = requests.get(url, timeout=20)
        r.raise_for_status()
        splits = r.json().get('stats', [{}])[0].get('splits', [])
        print(f"  Got {len(splits)} batters from API")
    except Exception as e:
        print(f"  ERROR fetching batting stats: {e}")
        return False

    out_rows = []
    for s in splits:
        stat = s.get('stat', {})
        player = s.get('player', {})
        team_obj = s.get('team', {})
        name = player.get('fullName', '')
        team = norm_team(team_obj.get('abbreviation', ''))
        pa = int(stat.get('plateAppearances', 0) or 0)
        if pa == 0:
            continue

        def safe_float_b(v, default=0.0):
            try:
                return float(v) if v and v not in ('-.--', '-.-', '-') else default
            except (ValueError, TypeError):
                return default

        out_rows.append({
            'name': name,
            'team': team,
            'pa': pa,
            'hr': int(stat.get('homeRuns', 0) or 0),
            'r': int(stat.get('runs', 0) or 0),
            'rbi': int(stat.get('rbi', 0) or 0),
            'sb': int(stat.get('stolenBases', 0) or 0),
            'so': int(stat.get('strikeOuts', 0) or 0),
            'avg': safe_float_b(stat.get('avg')),
            'obp': safe_float_b(stat.get('obp')),
            'slg': safe_float_b(stat.get('slg')),
        })

    if not out_rows:
        print("  No batting data to save")
        return False

    path = os.path.join(OUTDIR, 'bat_2026.csv')
    cols = ['name', 'team', 'pa', 'hr', 'r', 'rbi', 'sb', 'so', 'avg', 'obp', 'slg']
    with open(path, 'w') as f:
        f.write('|'.join(cols) + '\n')
        for row in out_rows:
            vals = [str(row.get(c, '')) for c in cols]
            f.write('|'.join(vals) + '\n')

    print(f"  Saved {len(out_rows)} batters to {path}")
    return True


if __name__ == '__main__':
    print(f"=== Fetching {SEASON} MLB Stats (MLB Stats API) ===")
    start = time.time()

    bat_ok = fetch_batting_stats()
    pit_ok = fetch_pitching_stats()

    elapsed = round(time.time() - start, 1)
    print(f"\nDone in {elapsed}s.")

    if bat_ok or pit_ok:
        print("Stats updated! Now run: python3 build_dashboard.py")
    else:
        print(f"No stats available for {SEASON}. Season may not have started yet.")

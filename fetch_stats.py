#!/usr/bin/env python3
"""Fetch 2026 in-season MLB stats from FanGraphs via pybaseball.
Run this periodically to update the dashboard with real stats.
Creates data/bat_2026.csv and data/pit_2026.csv for the build script."""

import sys
import os

try:
    from pybaseball import batting_stats, pitching_stats
except ImportError:
    print("ERROR: pybaseball not installed. Run: pip install pybaseball")
    sys.exit(1)

OUTDIR = 'data'

def fetch_batting():
    """Fetch 2026 batting stats from FanGraphs."""
    print("Fetching 2026 batting stats from FanGraphs...")
    try:
        df = batting_stats(2026, qual=0)
        if df is None or len(df) == 0:
            print("  No 2026 batting data available yet (season may not have started)")
            return False

        out = df.rename(columns={
            'Name': 'name', 'Team': 'team',
            'PA': 'pa', 'HR': 'hr', 'R': 'r', 'RBI': 'rbi',
            'SB': 'sb', 'SO': 'so', 'AVG': 'avg', 'OBP': 'obp', 'SLG': 'slg'
        })

        cols = ['name', 'team', 'pa', 'hr', 'r', 'rbi', 'sb', 'so', 'avg', 'obp', 'slg']
        out = out[[c for c in cols if c in out.columns]]
        out = out[out['pa'] > 0]

        path = os.path.join(OUTDIR, 'bat_2026.csv')
        out.to_csv(path, sep='|', index=False)
        print(f"  Saved {len(out)} batters to {path}")
        return True
    except Exception as e:
        print(f"  Error fetching batting stats: {e}")
        return False

def fetch_pitching():
    """Fetch 2026 pitching stats from FanGraphs."""
    print("Fetching 2026 pitching stats from FanGraphs...")
    try:
        df = pitching_stats(2026, qual=0)
        if df is None or len(df) == 0:
            print("  No 2026 pitching data available yet (season may not have started)")
            return False

        out = df.rename(columns={
            'Name': 'name', 'Team': 'team',
            'IP': 'ip', 'W': 'w', 'SV': 'sv', 'HLD': 'hld',
            'ERA': 'era', 'WHIP': 'whip', 'SO': 'so',
            'HR': 'hr', 'QS': 'qs'
        })

        cols = ['name', 'team', 'ip', 'w', 'sv', 'hld', 'era', 'whip', 'so', 'hr', 'qs']
        out = out[[c for c in cols if c in out.columns]]
        out = out[out['ip'] > 0]

        path = os.path.join(OUTDIR, 'pit_2026.csv')
        out.to_csv(path, sep='|', index=False)
        print(f"  Saved {len(out)} pitchers to {path}")
        return True
    except Exception as e:
        print(f"  Error fetching pitching stats: {e}")
        return False

if __name__ == '__main__':
    print("=== Fetching 2026 MLB Stats ===")
    bat_ok = fetch_batting()
    pit_ok = fetch_pitching()

    if bat_ok or pit_ok:
        print("\nStats updated! Now run: python3 build_dashboard.py")
    else:
        print("\nNo stats available yet. The 2026 season starts March 25, 2026.")

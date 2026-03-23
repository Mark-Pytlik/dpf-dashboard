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

def fetch_statcast_sprint():
    """Fetch sprint speed data from Baseball Savant via pybaseball."""
    print("Fetching sprint speed data...")
    try:
        from pybaseball import statcast_sprint_speed
        df = statcast_sprint_speed(2026)
        if df is None or len(df) == 0:
            print("  No 2026 sprint speed data (trying 2025)...")
            df = statcast_sprint_speed(2025)
        if df is None or len(df) == 0:
            print("  No sprint speed data available")
            return False

        # Keep relevant columns and rename
        out = df.rename(columns={
            'last_name, first_name': 'name_raw',
            'hp_to_1b': 'hp_to_1b',
            'sprint_speed': 'speed'
        })
        # Convert "Last, First" to "First Last"
        if 'name_raw' in out.columns:
            out['name'] = out['name_raw'].apply(lambda x: ' '.join(reversed(x.split(', '))) if ', ' in str(x) else x)
        elif 'Name' in df.columns:
            out['name'] = df['Name']

        # Assign tiers
        def tier(spd):
            if spd >= 29: return 'elite'
            if spd >= 27: return 'above_avg'
            if spd >= 25: return 'avg'
            return 'below_avg'

        out['tier'] = out['speed'].apply(tier)
        # Only keep players with above-avg or elite speed for breakout detection
        out = out[out['speed'] >= 27][['name', 'speed', 'tier']].sort_values('speed', ascending=False)

        import json
        path = os.path.join(OUTDIR, 'sprint_speed_2025.json')
        records = out.to_dict('records')
        for r in records:
            r['speed'] = round(float(r['speed']), 1)
        json.dump(records, open(path, 'w'), indent=2)
        print(f"  Saved {len(records)} sprint speed records to {path}")
        return True
    except Exception as e:
        print(f"  Sprint speed fetch skipped: {e}")
        return False

if __name__ == '__main__':
    print("=== Fetching 2026 MLB Stats ===")
    bat_ok = fetch_batting()
    pit_ok = fetch_pitching()
    sprint_ok = fetch_statcast_sprint()

    if bat_ok or pit_ok:
        print("\nStats updated! Now run: python3 build_dashboard.py")
    elif sprint_ok:
        print("\nSprint speed updated. Run: python3 build_dashboard.py")
    else:
        print("\nNo stats available yet. The 2026 season starts March 25, 2026.")

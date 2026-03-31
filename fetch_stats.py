#!/usr/bin/env python3
"""Fetch 2026 in-season MLB stats from FanGraphs via pybaseball.
Run this periodically to update the dashboard with real stats.
Creates data/bat_2026.csv and data/pit_2026.csv for the build script.
Also saves daily cumulative snapshots to data/snapshots/ for time-split analysis."""

import sys
import os
from datetime import date

try:
    from pybaseball import batting_stats, pitching_stats
except ImportError:
    print("ERROR: pybaseball not installed. Run: pip install pybaseball")
    sys.exit(1)

OUTDIR = 'data'
SNAP_DIR = os.path.join(OUTDIR, 'snapshots')

def _ensure_snap_dir():
    os.makedirs(SNAP_DIR, exist_ok=True)

def fetch_batting():
    """Fetch 2026 batting stats from FanGraphs.
    Saves the standard summary CSV and a daily snapshot with component stats
    (H, AB, BB, HBP, SF) needed for time-split rate stat recomputation."""
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

        # ── Daily snapshot with component stats for time-split analysis ──
        _ensure_snap_dir()
        snap = df.rename(columns={'Name': 'name'})
        # Map FanGraphs columns to our component stat names
        # These cumulative counting stats allow window computation via subtraction
        snap_col_map = {
            'PA': 'pa', 'AB': 'ab', 'H': 'h', 'HR': 'hr', 'R': 'r',
            'RBI': 'rbi', 'SB': 'sb', 'SO': 'so', 'BB': 'bb',
            'HBP': 'hbp', 'SF': 'sf', '1B': 'x1b', '2B': 'x2b', '3B': 'x3b'
        }
        for fg_col, our_col in snap_col_map.items():
            if fg_col in snap.columns:
                snap = snap.rename(columns={fg_col: our_col})

        snap_cols = ['name'] + [c for c in ['pa','ab','h','hr','r','rbi','sb','so','bb','hbp','sf','x1b','x2b','x3b'] if c in snap.columns]
        snap_out = snap[snap_cols].copy()
        snap_out = snap_out[snap_out['pa'] > 0]
        # Convert to int where possible for compact storage
        for c in snap_cols[1:]:
            snap_out[c] = snap_out[c].fillna(0).astype(int)

        snap_path = os.path.join(SNAP_DIR, f'bat_{date.today().isoformat()}.csv')
        snap_out.to_csv(snap_path, sep='|', index=False)
        print(f"  Snapshot saved: {snap_path} ({len(snap_out)} players)")

        return True
    except Exception as e:
        print(f"  Error fetching batting stats: {e}")
        return False

def fetch_pitching():
    """Fetch 2026 pitching stats from FanGraphs.
    Saves the standard summary CSV and a daily snapshot with component stats
    (ER, H_allowed, BB_allowed, BFP) for time-split rate stat recomputation."""
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

        # ── Daily snapshot with component stats ──
        _ensure_snap_dir()
        snap = df.rename(columns={'Name': 'name'})
        snap_col_map = {
            'IP': 'ip', 'W': 'w', 'SV': 'sv', 'HLD': 'hld',
            'SO': 'so', 'HR': 'hr', 'QS': 'qs',
            'ER': 'er', 'H': 'h', 'BB': 'bb', 'TBF': 'tbf'
        }
        for fg_col, our_col in snap_col_map.items():
            if fg_col in snap.columns:
                snap = snap.rename(columns={fg_col: our_col})

        snap_cols = ['name'] + [c for c in ['ip','w','sv','hld','so','hr','qs','er','h','bb','tbf'] if c in snap.columns]
        snap_out = snap[snap_cols].copy()
        snap_out = snap_out[snap_out['ip'] > 0]
        for c in snap_cols[1:]:
            if c == 'ip':
                snap_out[c] = snap_out[c].fillna(0).round(1)
            else:
                snap_out[c] = snap_out[c].fillna(0).astype(int)

        snap_path = os.path.join(SNAP_DIR, f'pit_{date.today().isoformat()}.csv')
        snap_out.to_csv(snap_path, sep='|', index=False)
        print(f"  Snapshot saved: {snap_path} ({len(snap_out)} players)")

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

def fetch_statcast_batting():
    """Fetch 2026 Statcast advanced batting metrics from FanGraphs."""
    print("Fetching 2026 Statcast batting metrics from FanGraphs...")
    try:
        df = batting_stats(2026, qual=0)
        if df is None or len(df) == 0:
            print("  No 2026 batting data for Statcast metrics")
            return False

        # FanGraphs batting_stats includes Statcast columns when available
        col_map = {}
        # Try common FanGraphs column names for Statcast data
        for src, dst in [('Barrel%', 'barrel_pct'), ('HardHit%', 'hard_hit_pct'),
                         ('wOBA', 'woba'), ('xwOBA', 'xwoba'),
                         ('Barrels', 'barrels'), ('Events', 'events')]:
            if src in df.columns:
                col_map[src] = dst

        if 'wOBA' not in df.columns:
            print("  Statcast columns not available in FanGraphs data")
            return False

        out = df.rename(columns={'Name': 'name', **col_map})
        # Compute barrel% from Barrels/Events if Barrel% not directly available
        if 'barrel_pct' not in out.columns and 'barrels' in out.columns and 'events' in out.columns:
            out['barrel_pct'] = (out['barrels'] / out['events'] * 100).round(1)
        # Compute hard hit% if available
        if 'hard_hit_pct' not in out.columns:
            for alt in ['HardHit%', 'Hard%']:
                if alt in df.columns:
                    out['hard_hit_pct'] = df[alt]
                    break

        keep = ['name']
        for c in ['barrel_pct', 'hard_hit_pct', 'woba', 'xwoba']:
            if c in out.columns:
                keep.append(c)

        out = out[keep].dropna(subset=['woba'])
        out = out[out['woba'] > 0]

        path = os.path.join(OUTDIR, 'bat_statcast_2026.csv')
        out.to_csv(path, sep='|', index=False)
        print(f"  Saved {len(out)} batter Statcast records to {path}")
        return True
    except Exception as e:
        print(f"  Error fetching Statcast batting: {e}")
        return False

def fetch_statcast_pitching():
    """Fetch 2026 Stuff+ / pitching metrics from FanGraphs."""
    print("Fetching 2026 pitching advanced metrics from FanGraphs...")
    try:
        df = pitching_stats(2026, qual=0)
        if df is None or len(df) == 0:
            print("  No 2026 pitching data for Stuff+ metrics")
            return False

        col_map = {}
        for src, dst in [('Stf+', 'stuff_plus'), ('Loc+', 'location_plus'),
                         ('Pit+', 'pitching_plus'), ('Stuff+', 'stuff_plus'),
                         ('Location+', 'location_plus'), ('Pitching+', 'pitching_plus')]:
            if src in df.columns and dst not in col_map.values():
                col_map[src] = dst

        out = df.rename(columns={'Name': 'name', **col_map})
        keep = ['name']
        for c in ['stuff_plus', 'location_plus', 'pitching_plus']:
            if c in out.columns:
                keep.append(c)

        if len(keep) <= 1:
            print("  Stuff+/Location+/Pitching+ columns not available yet")
            return False

        out = out[keep].dropna(subset=[k for k in keep if k != 'name'])
        path = os.path.join(OUTDIR, 'stuff_plus_2026.csv')
        out.to_csv(path, sep='|', index=False)
        print(f"  Saved {len(out)} pitcher Stuff+ records to {path}")
        return True
    except Exception as e:
        print(f"  Error fetching Stuff+ data: {e}")
        return False

if __name__ == '__main__':
    print("=== Fetching 2026 MLB Stats ===")
    bat_ok = fetch_batting()
    pit_ok = fetch_pitching()
    sprint_ok = fetch_statcast_sprint()
    sc_bat_ok = fetch_statcast_batting()
    sc_pit_ok = fetch_statcast_pitching()

    if bat_ok or pit_ok:
        print("\nStats updated! Now run: python3 build_dashboard.py")
    elif sprint_ok or sc_bat_ok or sc_pit_ok:
        print("\nAdvanced metrics updated. Run: python3 build_dashboard.py")
    else:
        print("\nNo stats available yet. The 2026 season starts March 25, 2026.")

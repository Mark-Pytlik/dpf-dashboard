#!/usr/bin/env python3
"""Build the DPF 2026 Draft Dashboard with LCV, PNAV, UPSIDE, Draft Priority, and full player pool."""
import pandas as pd
import numpy as np
import json
import re
import unicodedata
from datetime import datetime

# ── Accent-normalized name matching ──────────────────────────────────────
# Matches player names across data sources that differ in accents
# (e.g. "José" vs "Jose", "Sánchez" vs "Sanchez")
def _norm_name(s):
    """Strip accents and lowercase for fuzzy name matching."""
    return ''.join(
        c for c in unicodedata.normalize('NFD', str(s))
        if unicodedata.category(c) != 'Mn'
    ).lower().strip()

def _build_norm(d):
    """Build a secondary accent-stripped lookup dict from an existing dict."""
    return {_norm_name(k): v for k, v in d.items()}

def _get(lookup, norm_lookup, name):
    """Look up by exact name first, then accent-stripped fallback."""
    return lookup.get(name) or norm_lookup.get(_norm_name(name)) or {}

# ── Read data ──────────────────────────────────────────────────────────────
bat = pd.read_csv('data/dc_bat_full.csv', sep='|')
pit = pd.read_csv('data/dc_pit_full.csv', sep='|')
ages = json.load(open('data/mlb_ages.json'))
cbs_pos = json.load(open('data/cbs_positions.json'))
prospects = json.load(open('data/prospects_2026.json'))
prospects_json = json.dumps(prospects)

# ── 2025 actual stats ─────────────────────────────────────────────────────
bat25 = pd.read_csv('data/bat_2025.csv', sep='|')
pit25 = pd.read_csv('data/pit_2025.csv', sep='|')
# Build lookup dicts by player name
bat25_lookup = {}
for _, r in bat25.iterrows():
    bat25_lookup[r['name']] = {
        'pa': int(r['pa']), 'hr': int(r['hr']), 'r': int(r['r']),
        'rbi': int(r['rbi']), 'sb': int(r['sb']), 'so': int(r['so']),
        'avg': round(float(r['avg']), 3), 'obp': round(float(r['obp']), 3),
        'slg': round(float(r['slg']), 3)
    }
pit25_lookup = {}
for _, r in pit25.iterrows():
    pit25_lookup[r['name']] = {
        'ip': round(float(r['ip']), 1), 'w': int(r['w']), 'sv': int(r['sv']),
        'hld': int(r['hld']), 'era': round(float(r['era']), 2),
        'whip': round(float(r['whip']), 3), 'so': int(r['so']),
        'hr': int(r['hr']), 'qs': int(r['qs'])
    }
print(f"2025 stats loaded: {len(bat25_lookup)} batters, {len(pit25_lookup)} pitchers")

# ── 2026 in-season stats (loaded if available) ───────────────────────────
import os
bat26_lookup = {}
pit26_lookup = {}
_bat26_path = 'data/bat_2026.csv'
_pit26_path = 'data/pit_2026.csv'
if os.path.exists(_bat26_path):
    bat26 = pd.read_csv(_bat26_path, sep='|')
    for _, r in bat26.iterrows():
        bat26_lookup[r['name']] = {
            'pa': int(r.get('pa',0)), 'hr': int(r.get('hr',0)), 'r': int(r.get('r',0)),
            'rbi': int(r.get('rbi',0)), 'sb': int(r.get('sb',0)), 'so': int(r.get('so',0)),
            'bb': int(r.get('bb',0)), 'h': int(r.get('h',0)), 'ab': int(r.get('ab',0)),
            'sf': int(r.get('sf',0)),
            'avg': round(float(r.get('avg',0)), 3), 'obp': round(float(r.get('obp',0)), 3),
            'slg': round(float(r.get('slg',0)), 3)
        }
    print(f"2026 batter stats loaded: {len(bat26_lookup)} players")
bat26_norm = _build_norm(bat26_lookup)
if os.path.exists(_pit26_path):
    pit26 = pd.read_csv(_pit26_path, sep='|')
    for _, r in pit26.iterrows():
        pit26_lookup[r['name']] = {
            'ip': round(float(r.get('ip',0)), 1), 'w': int(r.get('w',0)), 'sv': int(r.get('sv',0)),
            'hld': int(r.get('hld',0)), 'era': round(float(r.get('era',0)), 2),
            'whip': round(float(r.get('whip',0)), 3), 'so': int(r.get('so',0)),
            'hr': int(r.get('hr',0)), 'qs': int(r.get('qs',0)),
            'bb': int(r.get('bb',0)), 'hbp': int(r.get('hbp',0)), 'bf': int(r.get('bf',0))
        }
    print(f"2026 pitcher stats loaded: {len(pit26_lookup)} players")
pit26_norm = _build_norm(pit26_lookup)
if not bat26_lookup and not pit26_lookup:
    print("No 2026 in-season stats found (expected before season starts)")

# ── 2025 Statcast / advanced metrics ──────────────────────────────────────
# Stuff+ for pitchers
stuff_df = pd.read_csv('data/stuff_plus_2025.csv', sep='|')
stuff_lookup = {}
for _, r in stuff_df.iterrows():
    stuff_lookup[r['name']] = {
        'stuff': int(r['stuff_plus']),
        'loc': int(r['location_plus']),
        'pitching': int(r['pitching_plus'])
    }
print(f"Stuff+ 2025 loaded: {len(stuff_lookup)} pitchers")

# Stuff+ for pitchers — 2024 (for year-over-year trend)
stuff24_lookup = {}
_stuff24_path = 'data/stuff_plus_2024.csv'
if os.path.exists(_stuff24_path):
    stuff24_df = pd.read_csv(_stuff24_path, sep='|')
    for _, r in stuff24_df.iterrows():
        stuff24_lookup[r['name']] = {
            'stuff': int(r['stuff_plus']),
            'loc': int(r['location_plus']),
            'pitching': int(r['pitching_plus'])
        }
    print(f"Stuff+ 2024 loaded: {len(stuff24_lookup)} pitchers")
else:
    print("No 2024 Stuff+ file found (data/stuff_plus_2024.csv)")

# ── Eno's 150 Best Pitchers list ─────────────────────────────────────────
eno_rank = json.load(open('data/eno_rankings.json'))
# JSON keys are strings, but values should be ints (they already are from the JSON)
eno_rank = {k: int(v) for k, v in eno_rank.items()}
print(f"Eno rankings loaded: {len(eno_rank)} pitchers")

# Statcast for batters
statcast_df = pd.read_csv('data/bat_statcast_2025.csv', sep='|')
statcast_lookup = {}
for _, r in statcast_df.iterrows():
    woba = float(r['woba']) if r['woba'] not in ('', None) else 0
    xwoba = float(r['xwoba']) if r['xwoba'] not in ('', None) else 0
    statcast_lookup[r['name']] = {
        'barrel': float(r['barrel_pct']),
        'hardhit': float(r['hard_hit_pct']),
        'woba': round(woba, 3),
        'xwoba': round(xwoba, 3),
        'delta': round(xwoba - woba, 3)
    }
print(f"Statcast loaded: {len(statcast_lookup)} batters")
statcast_norm = _build_norm(statcast_lookup)
stuff_norm = _build_norm(stuff_lookup)
stuff24_norm = _build_norm(stuff24_lookup)

# ── 2026 Stuff+ (in-season, for trend vs 2025) ───────────────────────────
stuff26_lookup = {}
_stuff26_path = 'data/stuff_plus_2026.csv'
if os.path.exists(_stuff26_path):
    stuff26_df = pd.read_csv(_stuff26_path, sep='|')
    for _, r in stuff26_df.iterrows():
        stuff26_lookup[r['name']] = {
            'stuff': int(r['stuff_plus']),
            'loc': int(r['location_plus']),
            'pitching': int(r['pitching_plus'])
        }
    print(f"Stuff+ 2026 loaded: {len(stuff26_lookup)} pitchers")
else:
    print("No 2026 Stuff+ file found (data/stuff_plus_2026.csv)")
stuff26_norm = _build_norm(stuff26_lookup)

# ── 2026 Statcast (batter advanced metrics) ──────────────────────────────
sc26_lookup = {}
_sc26_path = 'data/bat_statcast_2026.csv'
if os.path.exists(_sc26_path):
    sc26_df = pd.read_csv(_sc26_path, sep='|')
    for _, r in sc26_df.iterrows():
        sc26_lookup[r['name']] = {
            'barrel': round(float(r.get('barrel_pct', 0) or 0), 3),
            'hardhit': round(float(r.get('hard_hit_pct', 0) or 0), 3),
            'woba': round(float(r.get('woba', 0) or 0), 3),
            'xwoba': round(float(r.get('xwoba', 0) or 0), 3),
        }
    print(f"Statcast 2026 loaded: {len(sc26_lookup)} batters")
else:
    print("No 2026 Statcast file found (data/bat_statcast_2026.csv)")
sc26_norm = _build_norm(sc26_lookup)

# ── Park factors ──────────────────────────────────────────────────────────
_pf_path = 'data/park_factors_2025.json'
if os.path.exists(_pf_path):
    park_factors = json.load(open(_pf_path))
    print(f"Park factors loaded: {len(park_factors)} teams")
else:
    park_factors = {}
    print("No park factors file found")
park_factors_json = json.dumps(park_factors)

# ── Sprint speed ──────────────────────────────────────────────────────────
_ss_path = 'data/sprint_speed_2025.json'
if os.path.exists(_ss_path):
    sprint_speeds = json.load(open(_ss_path))
    sprint_lookup = {s['name']: s for s in sprint_speeds}
    print(f"Sprint speed loaded: {len(sprint_speeds)} players")
else:
    sprint_speeds = []
    sprint_lookup = {}
    print("No sprint speed file found")
sprint_speed_json = json.dumps(sprint_speeds)

# ── Bullpen roles ─────────────────────────────────────────────────────────
_bp_path = 'data/bullpen_roles_2026.json'
if os.path.exists(_bp_path):
    bullpen_roles = json.load(open(_bp_path))
    print(f"Bullpen roles loaded: {len(bullpen_roles)} teams")
else:
    bullpen_roles = []
    print("No bullpen roles file found")
bullpen_roles_json = json.dumps(bullpen_roles)

# Decode batter values
bat['avg'] = bat['avg'] / 1000
bat['obp'] = bat['obp'] / 1000
bat['slg'] = bat['slg'] / 1000
bat['war'] = bat['war'] / 10

# Decode pitcher values
pit['ip']   = pit['ip'] / 10
pit['era']  = pit['era'] / 100
pit['whip'] = pit['whip'] / 1000
pit['war']  = pit['war'] / 10

# ── Filter to meaningful players ──────────────────────────────────────────
bat_pool = bat[bat['pa'] >= 200].copy()
pit_pool = pit[pit['ip'] >= 30].copy()

print(f"Batter pool: {len(bat_pool)} players (PA>=200)")
print(f"Pitcher pool: {len(pit_pool)} players (IP>=30)")

# ── CBS position mapping ─────────────────────────────────────────────────
# Build a lookup from abbreviated CBS name -> CBS position
# CBS positions now use full player names as keys with comma-separated eligibility
import unicodedata

def strip_accents(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')

# Build lookup: normalized full name -> CBS position string
# Also index without suffixes (Jr., Sr., II, III, IV) for fuzzy matching
import re as _re
_SUFFIXES = _re.compile(r'\s+(jr\.?|sr\.?|ii|iii|iv|v)\s*$', _re.IGNORECASE)

cbs_lookup = {}
for name, pos in cbs_pos.items():
    key = strip_accents(name.strip().lower())
    cbs_lookup[key] = pos
    # Also add without suffix
    no_suffix = _SUFFIXES.sub('', key).strip()
    if no_suffix != key and no_suffix not in cbs_lookup:
        cbs_lookup[no_suffix] = pos

def _cbs_get(full_name):
    """Look up CBS position string by full name, with suffix-agnostic fallback."""
    key = strip_accents(full_name.strip().lower())
    result = cbs_lookup.get(key)
    if result:
        return result
    # Try without suffix
    no_suffix = _SUFFIXES.sub('', key).strip()
    return cbs_lookup.get(no_suffix)

VALID_POS = {'LF', 'CF', 'RF', 'C', '1B', '2B', '3B', 'SS', 'DH', 'SP', 'RP', 'U'}

def get_cbs_position(full_name, fg_pos):
    """Get CBS position for a player. Only override OF with LF/CF/RF from CBS."""
    cbs = _cbs_get(full_name)
    if fg_pos == 'OF' and cbs:
        primary = cbs.split(',')[0].strip()
        if primary in ('LF', 'CF', 'RF'):
            return primary
    if fg_pos != 'OF':
        return fg_pos
    return 'RF'

def get_cbs_all_positions(full_name):
    """Get all CBS-eligible positions (comma-separated like 'LF,CF,RF')."""
    cbs = _cbs_get(full_name)
    if not cbs:
        return []
    return [p.strip() for p in cbs.split(',') if p.strip() in VALID_POS]

# ── Z-score functions ─────────────────────────────────────────────────────
def zscore(series):
    m, s = series.mean(), series.std()
    if s == 0: return pd.Series(0, index=series.index)
    return (series - m) / s

# ── Batter LCV ────────────────────────────────────────────────────────────
bat_pool['z_avg'] = zscore(bat_pool['avg'])
bat_pool['z_hr']  = zscore(bat_pool['hr'])
bat_pool['z_obp'] = zscore(bat_pool['obp'])
bat_pool['z_slg'] = zscore(bat_pool['slg'])
bat_pool['z_r']   = zscore(bat_pool['r'])
bat_pool['z_rbi'] = zscore(bat_pool['rbi'])
bat_pool['z_sb']  = zscore(bat_pool['sb'])
bat_pool['z_so']  = zscore(bat_pool['so'])

bat_pool['lcv'] = (bat_pool['z_avg'] + bat_pool['z_hr'] + bat_pool['z_obp'] +
                   bat_pool['z_slg'] + bat_pool['z_r'] + bat_pool['z_rbi'] +
                   bat_pool['z_sb'] - bat_pool['z_so'])

# ── Pitcher LCV ───────────────────────────────────────────────────────────
pit_pool['z_era']  = zscore(pit_pool['era'])
pit_pool['z_hld']  = zscore(pit_pool['hld'])
pit_pool['z_hr']   = zscore(pit_pool['hr'])
pit_pool['z_so']   = zscore(pit_pool['so'])
pit_pool['z_sv']   = zscore(pit_pool['sv'])
pit_pool['z_w']    = zscore(pit_pool['w'])
pit_pool['z_whip'] = zscore(pit_pool['whip'])
pit_pool['z_qs']   = zscore(pit_pool['qs'])

pit_pool['lcv'] = (-pit_pool['z_era'] + pit_pool['z_hld'] - pit_pool['z_hr'] +
                   pit_pool['z_so'] + pit_pool['z_sv'] + pit_pool['z_w'] -
                   pit_pool['z_whip'] + pit_pool['z_qs'])

# ── Position multipliers & scarcity (updated for LF/CF/RF) ──────────────
POS_MULT = {'C': 1.0, '1B': 0.4, '2B': 1.2, '3B': 1.2, 'SS': 0.7,
            'LF': 1.0, 'CF': 1.0, 'RF': 1.0, 'DH': 0.4, 'SP': 1.0, 'RP': 1.0}
SCARCITY = {'C': 1.25, '1B': 0.85, '2B': 1.0, '3B': 1.0, 'SS': 1.0,
            'LF': 0.9, 'CF': 0.95, 'RF': 0.85, 'DH': 0.75, 'SP': 1.0, 'RP': 1.15}

def resolve_pos(pos_str, name):
    """Resolve a single FG position token into CBS-aware position."""
    pos = pos_str.strip()
    if pos == 'OF':
        return get_cbs_position(name, 'OF')
    if pos in POS_MULT:
        return pos
    return None

def get_all_positions(name, fg_pos):
    """Get all eligible positions. CBS is authoritative — uses our league's
    actual eligibility rule (20 games last year / 10 this year). When CBS
    has no entry for a player (free agents we haven't tracked), fall back
    ONLY to their PRIMARY FG position — never to FG's multi-position list,
    because FG uses a looser eligibility rule and would falsely flag
    players (e.g. Dominic Smith would show as 1B/RF off the FG list even
    though he doesn't meet our league's RF eligibility threshold)."""
    cbs_positions = get_cbs_all_positions(name)
    if cbs_positions:
        return cbs_positions
    if pd.isna(fg_pos):
        return ['DH']
    # No CBS data → use ONLY the first FG position (their primary). Trims
    # away FG-secondaries that don't meet our league's stricter rule.
    parts = str(fg_pos).split('/')
    if not parts:
        return ['DH']
    primary = resolve_pos(parts[0], name)
    return [primary] if primary else ['DH']

def get_primary_pos(name, fg_pos):
    positions = get_all_positions(name, fg_pos)
    return positions[0]

def get_eligibility_str(name, fg_pos):
    """Return display string like 'RF' or 'SS/RF' for multi-position eligible."""
    positions = get_all_positions(name, fg_pos)
    return '/'.join(positions)

# Batter positions & PNAV (any hitter can be a DH)
bat_pool['primary_pos'] = bat_pool.apply(lambda r: get_primary_pos(r['name'], r['pos']), axis=1)
bat_pool['elig'] = bat_pool.apply(lambda r: get_eligibility_str(r['name'], r['pos']), axis=1)
# PNAV = best value across all eligible positions INCLUDING DH
def calc_best_pnav(row):
    positions = get_all_positions(row['name'], row['pos'])
    if 'DH' not in positions:
        positions.append('DH')  # every hitter can DH
    lcv = row['lcv']
    best = max(lcv * POS_MULT.get(p, 1.0) * SCARCITY.get(p, 1.0) for p in positions)
    return best
bat_pool['pos_mult'] = bat_pool['primary_pos'].map(POS_MULT).fillna(1.0)
bat_pool['scarcity'] = bat_pool['primary_pos'].map(SCARCITY).fillna(1.0)
bat_pool['pnav'] = bat_pool.apply(calc_best_pnav, axis=1)

# Pitcher positions & PNAV
pit_pool['primary_pos'] = pit_pool['role']
pit_pool['pos_mult'] = pit_pool['primary_pos'].map(POS_MULT).fillna(1.0)
pit_pool['scarcity'] = pit_pool['primary_pos'].map(SCARCITY).fillna(1.0)
pit_pool['pnav'] = pit_pool['lcv'] * pit_pool['pos_mult'] * pit_pool['scarcity']

# ── Age & UPSIDE ─────────────────────────────────────────────────────────
CURRENT_YEAR = 2026

def get_age(name):
    birth = ages.get(name)
    if birth:
        return CURRENT_YEAR - birth
    return 28  # default

def age_factor(age):
    """Young players get big boost, old players get heavy penalty."""
    if age <= 22: return 2.0
    if age <= 24: return 1.7
    if age <= 26: return 1.4
    if age <= 28: return 1.1
    if age <= 30: return 0.85
    if age <= 32: return 0.65
    if age <= 34: return 0.5
    return 0.35

# ── TREND: 2026 projected vs 2025 actual ─────────────────────────────────
# For each player with 2025 data, compute per-category deltas, z-score them,
# then sum into a single Trend metric. Positive = projecting improvement.

# Batter trend: merge 2025 actuals into bat_pool for players that have them
bat_pool['has25'] = bat_pool['name'].map(lambda n: n in bat25_lookup)
bat_pool['d_avg'] = bat_pool.apply(lambda r: r['avg'] - bat25_lookup[r['name']]['avg'] if r['has25'] else np.nan, axis=1)
bat_pool['d_obp'] = bat_pool.apply(lambda r: r['obp'] - bat25_lookup[r['name']]['obp'] if r['has25'] else np.nan, axis=1)
bat_pool['d_slg'] = bat_pool.apply(lambda r: r['slg'] - bat25_lookup[r['name']]['slg'] if r['has25'] else np.nan, axis=1)
bat_pool['d_hr']  = bat_pool.apply(lambda r: r['hr']  - bat25_lookup[r['name']]['hr']  if r['has25'] else np.nan, axis=1)
bat_pool['d_r']   = bat_pool.apply(lambda r: r['r']   - bat25_lookup[r['name']]['r']   if r['has25'] else np.nan, axis=1)
bat_pool['d_rbi'] = bat_pool.apply(lambda r: r['rbi'] - bat25_lookup[r['name']]['rbi'] if r['has25'] else np.nan, axis=1)
bat_pool['d_sb']  = bat_pool.apply(lambda r: r['sb']  - bat25_lookup[r['name']]['sb']  if r['has25'] else np.nan, axis=1)
bat_pool['d_so']  = bat_pool.apply(lambda r: r['so']  - bat25_lookup[r['name']]['so']  if r['has25'] else np.nan, axis=1)

# Z-score the deltas (only among players with 2025 data)
has25_bat = bat_pool[bat_pool['has25']].index
for col in ['d_avg','d_obp','d_slg','d_hr','d_r','d_rbi','d_sb','d_so']:
    m, s = bat_pool.loc[has25_bat, col].mean(), bat_pool.loc[has25_bat, col].std()
    if s > 0:
        bat_pool.loc[has25_bat, 'z_'+col] = (bat_pool.loc[has25_bat, col] - m) / s
    else:
        bat_pool.loc[has25_bat, 'z_'+col] = 0.0

# Trend = z(d_avg) + z(d_obp) + z(d_slg) + z(d_hr) + z(d_r) + z(d_rbi) + z(d_sb) - z(d_so)
# (lower SO is better for batters, so negate)
bat_pool['trend'] = np.nan
bat_pool.loc[has25_bat, 'trend'] = (
    bat_pool.loc[has25_bat, 'z_d_avg'] + bat_pool.loc[has25_bat, 'z_d_obp'] +
    bat_pool.loc[has25_bat, 'z_d_slg'] + bat_pool.loc[has25_bat, 'z_d_hr'] +
    bat_pool.loc[has25_bat, 'z_d_r']   + bat_pool.loc[has25_bat, 'z_d_rbi'] +
    bat_pool.loc[has25_bat, 'z_d_sb']  - bat_pool.loc[has25_bat, 'z_d_so']
)

# Pitcher trend
pit_pool['has25'] = pit_pool['name'].map(lambda n: n in pit25_lookup)
pit_pool['d_era']  = pit_pool.apply(lambda r: r['era']  - pit25_lookup[r['name']]['era']  if r['has25'] else np.nan, axis=1)
pit_pool['d_whip'] = pit_pool.apply(lambda r: r['whip'] - pit25_lookup[r['name']]['whip'] if r['has25'] else np.nan, axis=1)
pit_pool['d_so']   = pit_pool.apply(lambda r: r['so']   - pit25_lookup[r['name']]['so']   if r['has25'] else np.nan, axis=1)
pit_pool['d_w']    = pit_pool.apply(lambda r: r['w']    - pit25_lookup[r['name']]['w']    if r['has25'] else np.nan, axis=1)
pit_pool['d_sv']   = pit_pool.apply(lambda r: r['sv']   - pit25_lookup[r['name']]['sv']   if r['has25'] else np.nan, axis=1)
pit_pool['d_hld']  = pit_pool.apply(lambda r: r['hld']  - pit25_lookup[r['name']]['hld']  if r['has25'] else np.nan, axis=1)
pit_pool['d_hr']   = pit_pool.apply(lambda r: r['hr']   - pit25_lookup[r['name']]['hr']   if r['has25'] else np.nan, axis=1)
pit_pool['d_qs']   = pit_pool.apply(lambda r: r['qs']   - pit25_lookup[r['name']]['qs']   if r['has25'] else np.nan, axis=1)

has25_pit = pit_pool[pit_pool['has25']].index
for col in ['d_era','d_whip','d_so','d_w','d_sv','d_hld','d_hr','d_qs']:
    m, s = pit_pool.loc[has25_pit, col].mean(), pit_pool.loc[has25_pit, col].std()
    if s > 0:
        pit_pool.loc[has25_pit, 'z_'+col] = (pit_pool.loc[has25_pit, col] - m) / s
    else:
        pit_pool.loc[has25_pit, 'z_'+col] = 0.0

# Trend = -z(d_era) - z(d_whip) + z(d_so) + z(d_w) + z(d_sv) + z(d_hld) - z(d_hr) + z(d_qs)
# (lower ERA/WHIP/HR is better for pitchers, so negate)
pit_pool['trend'] = np.nan
pit_pool.loc[has25_pit, 'trend'] = (
    -pit_pool.loc[has25_pit, 'z_d_era']  - pit_pool.loc[has25_pit, 'z_d_whip'] +
     pit_pool.loc[has25_pit, 'z_d_so']   + pit_pool.loc[has25_pit, 'z_d_w'] +
     pit_pool.loc[has25_pit, 'z_d_sv']   + pit_pool.loc[has25_pit, 'z_d_hld'] -
     pit_pool.loc[has25_pit, 'z_d_hr']   + pit_pool.loc[has25_pit, 'z_d_qs']
)

bat_trend_count = bat_pool['has25'].sum()
pit_trend_count = pit_pool['has25'].sum()
print(f"Trend computed: {bat_trend_count} batters, {pit_trend_count} pitchers with 2025 data")

# ── Build JSON arrays ─────────────────────────────────────────────────────
bat_records = []
for _, r in bat_pool.iterrows():
    age = get_age(r['name'])
    af = age_factor(age)
    upside = round(r['lcv'] * af, 2)
    # Draft Priority = 0.4*LCV + 0.6*PNAV (normalized blend favoring positional need)
    dp = round(0.4 * r['lcv'] + 0.6 * r['pnav'], 2)
    # 2025 actual stats (accent-safe)
    s25 = bat25_lookup.get(r['name']) or {_norm_name(k): v for k, v in bat25_lookup.items()}.get(_norm_name(r['name'])) or {}
    bat_records.append({
        'name': r['name'], 'team': r['team'], 'pos': r['elig'],
        'type': 'BAT', 'primaryPos': r['primary_pos'],
        'pa': int(r['pa']), 'hr': int(r['hr']), 'r': int(r['r']),
        'rbi': int(r['rbi']), 'sb': int(r['sb']), 'so': int(r['so']),
        'avg': round(r['avg'], 3), 'obp': round(r['obp'], 3),
        'slg': round(r['slg'], 3), 'war': round(r['war'], 1),
        'lcv': round(r['lcv'], 2), 'pnav': round(r['pnav'], 2),
        'posMult': r['pos_mult'], 'scarcity': r['scarcity'],
        'age': age, 'ageFactor': af, 'upside': upside, 'dp': dp,
        'zAvg': round(r['z_avg'], 2), 'zHr': round(r['z_hr'], 2),
        'zObp': round(r['z_obp'], 2), 'zSlg': round(r['z_slg'], 2),
        'zR': round(r['z_r'], 2), 'zRbi': round(r['z_rbi'], 2),
        'zSb': round(r['z_sb'], 2), 'zSo': round(r['z_so'], 2),
        # 2025 actual
        's25_pa': s25.get('pa', ''), 's25_hr': s25.get('hr', ''),
        's25_r': s25.get('r', ''), 's25_rbi': s25.get('rbi', ''),
        's25_sb': s25.get('sb', ''), 's25_so': s25.get('so', ''),
        's25_avg': s25.get('avg', ''), 's25_obp': s25.get('obp', ''),
        's25_slg': s25.get('slg', ''),
        'trend': round(r['trend'], 2) if not pd.isna(r['trend']) else '',
    })
    # Add Statcast data (accent-safe)
    sc = _get(statcast_lookup, statcast_norm, r['name'])
    if sc:
        bat_records[-1].update({
            's25_barrel': sc['barrel'], 's25_hardhit': sc['hardhit'],
            's25_woba': sc['woba'], 's25_xwoba': sc['xwoba'], 's25_delta': sc['delta']
        })
    # Add sprint speed (accent-safe)
    ss = sprint_lookup.get(r['name']) or sprint_lookup.get(_norm_name(r['name'])) or {}
    if ss:
        bat_records[-1]['sprintSpeed'] = ss['speed']
        bat_records[-1]['speedTier'] = ss['tier']
    # Add park factors for this player's team
    pf = park_factors.get(r['team'], {})
    if pf:
        bat_records[-1]['parkHR'] = pf.get('hr', 1.0)
        bat_records[-1]['parkR'] = pf.get('r', 1.0)
        bat_records[-1]['parkH'] = pf.get('h', 1.0)
    # Add 2026 in-season stats if available (accent-safe lookup)
    s26 = _get(bat26_lookup, bat26_norm, r['name'])
    if s26:
        pa26 = s26.get('pa', 0) or 0
        so26 = s26.get('so', 0) or 0
        bb26 = s26.get('bb', 0) or 0
        avg26 = s26.get('avg', 0) or 0
        slg26 = s26.get('slg', 0) or 0
        h26 = s26.get('h', 0) or 0
        ab26 = s26.get('ab', 0) or 0
        hr26 = s26.get('hr', 0) or 0
        sf26 = s26.get('sf', 0) or 0
        bat_records[-1].update({
            's26_pa': pa26, 's26_hr': hr26,
            's26_r': s26.get('r', ''), 's26_rbi': s26.get('rbi', ''),
            's26_sb': s26.get('sb', ''), 's26_so': so26,
            's26_avg': avg26, 's26_obp': s26.get('obp', ''), 's26_slg': slg26,
            's26_bb': bb26,
        })
        # Derived: K%, BB%, ISO, BABIP
        if pa26 >= 5:
            bat_records[-1]['s26_kpct'] = round(so26 / pa26 * 100, 1)
            bat_records[-1]['s26_bbpct'] = round(bb26 / pa26 * 100, 1)
        if slg26 and avg26:
            bat_records[-1]['s26_iso'] = round(slg26 - avg26, 3)
        # BABIP = (H - HR) / (AB - K - HR + SF)
        denom = ab26 - so26 - hr26 + sf26
        if denom > 0:
            bat_records[-1]['s26_babip'] = round((h26 - hr26) / denom, 3)
    # 2026 Statcast advanced metrics (accent-safe lookup)
    sc26 = _get(sc26_lookup, sc26_norm, r['name'])
    if sc26:
        bat_records[-1].update({
            's26_barrel': sc26.get('barrel', ''),
            's26_hardhit': sc26.get('hardhit', ''),
            's26_woba': sc26.get('woba', ''),
            's26_xwoba': sc26.get('xwoba', ''),
        })
        sc25 = _get(statcast_lookup, statcast_norm, r['name'])
        if sc25:
            b26 = sc26.get('barrel', ''); b25 = sc25.get('barrel', '')
            h26v = sc26.get('hardhit', ''); h25 = sc25.get('hardhit', '')
            w26 = sc26.get('woba', ''); w25 = sc25.get('woba', '')
            x26 = sc26.get('xwoba', ''); x25 = sc25.get('xwoba', '')
            if b26 != '' and b25 != '': bat_records[-1]['dBarrel'] = round(float(b26) - float(b25), 3)
            if h26v != '' and h25 != '': bat_records[-1]['dHardhit'] = round(float(h26v) - float(h25), 3)
            if w26 != '' and w25 != '': bat_records[-1]['dWoba'] = round(float(w26) - float(w25), 3)
            if x26 != '' and x25 != '': bat_records[-1]['dXwoba'] = round(float(x26) - float(x25), 3)

pit_records = []
for _, r in pit_pool.iterrows():
    age = get_age(r['name'])
    af = age_factor(age)
    upside = round(r['lcv'] * af, 2)
    dp = round(0.4 * r['lcv'] + 0.6 * r['pnav'], 2)
    # 2025 actual stats (accent-safe)
    s25 = pit25_lookup.get(r['name']) or {_norm_name(k): v for k, v in pit25_lookup.items()}.get(_norm_name(r['name'])) or {}
    pit_records.append({
        'name': r['name'], 'team': r['team'], 'pos': r['role'],
        'type': 'PIT', 'primaryPos': r['primary_pos'],
        'ip': round(r['ip'], 1), 'w': int(r['w']), 'sv': int(r['sv']),
        'hld': int(r['hld']), 'era': round(r['era'], 2),
        'whip': round(r['whip'], 3), 'so': int(r['so']),
        'hr': int(r['hr']), 'qs': int(r['qs']), 'war': round(r['war'], 1),
        'lcv': round(r['lcv'], 2), 'pnav': round(r['pnav'], 2),
        'posMult': r['pos_mult'], 'scarcity': r['scarcity'],
        'age': age, 'ageFactor': af, 'upside': upside, 'dp': dp,
        'zEra': round(r['z_era'], 2), 'zHld': round(r['z_hld'], 2),
        'zHr': round(r['z_hr'], 2), 'zSo': round(r['z_so'], 2),
        'zSv': round(r['z_sv'], 2), 'zW': round(r['z_w'], 2),
        'zWhip': round(r['z_whip'], 2), 'zQs': round(r['z_qs'], 2),
        # 2025 actual
        's25_ip': s25.get('ip', ''), 's25_w': s25.get('w', ''),
        's25_sv': s25.get('sv', ''), 's25_hld': s25.get('hld', ''),
        's25_era': s25.get('era', ''), 's25_whip': s25.get('whip', ''),
        's25_so': s25.get('so', ''), 's25_hr': s25.get('hr', ''),
        's25_qs': s25.get('qs', ''),
        'trend': round(r['trend'], 2) if not pd.isna(r['trend']) else '',
    })
    # Add Stuff+ data (2025 + 2024 for trend)
    st = _get(stuff_lookup, stuff_norm, r['name'])
    if st:
        pit_records[-1].update({
            's25_stuff': st['stuff'], 's25_loc': st['loc'], 's25_pitching': st['pitching']
        })
    st24 = _get(stuff24_lookup, stuff24_norm, r['name'])
    if st24:
        pit_records[-1]['s24_stuff'] = st24['stuff']
    # Stuff+ trend: delta between 2025 and 2024
    if st and st24:
        pit_records[-1]['stuffTrend'] = st['stuff'] - st24['stuff']
    # Add Eno Sarris rank
    er = eno_rank.get(r['name'], '')
    if er:
        pit_records[-1]['eno_rank'] = er
    # Add bullpen role info
    for bp in bullpen_roles:
        if bp.get('team') == r['team']:
            if r['name'] == bp.get('closer'):
                pit_records[-1]['bpRole'] = 'CL'
            elif r['name'] in bp.get('setup', []):
                pit_records[-1]['bpRole'] = 'SU'
            elif r['name'] == bp.get('handcuff'):
                pit_records[-1]['bpRole'] = 'HC'
            break
    # Add park factors for pitcher's team (inverse — pitcher-friendly parks help)
    pf = park_factors.get(r['team'], {})
    if pf:
        pit_records[-1]['parkHR'] = pf.get('hr', 1.0)
        pit_records[-1]['parkR'] = pf.get('r', 1.0)
    # Add 2026 in-season stats if available (accent-safe lookup)
    s26 = _get(pit26_lookup, pit26_norm, r['name'])
    if s26:
        ip26 = s26.get('ip', 0) or 0
        so26 = s26.get('so', 0) or 0
        hr26 = s26.get('hr', 0) or 0
        bb26 = s26.get('bb', 0) or 0
        hbp26 = s26.get('hbp', 0) or 0
        bf26 = s26.get('bf', 0) or 0
        pit_records[-1].update({
            's26_ip': ip26, 's26_w': s26.get('w', ''),
            's26_sv': s26.get('sv', ''), 's26_hld': s26.get('hld', ''),
            's26_era': s26.get('era', ''), 's26_whip': s26.get('whip', ''),
            's26_so': so26, 's26_hr': hr26, 's26_qs': s26.get('qs', ''),
            's26_bb': bb26,
        })
        # FIP = (13×HR + 3×(BB+HBP) − 2×K) / IP + 3.10
        if ip26 and ip26 > 0:
            fip26 = round((13 * hr26 + 3 * (bb26 + hbp26) - 2 * so26) / ip26 + 3.10, 2)
            pit_records[-1]['s26_fip'] = fip26
            pit_records[-1]['s26_hr9'] = round(hr26 * 9 / ip26, 2)
        # K% and BB% relative to batters faced
        if bf26 and bf26 > 0:
            pit_records[-1]['s26_kpct'] = round(so26 / bf26 * 100, 1)
            pit_records[-1]['s26_bbpct'] = round(bb26 / bf26 * 100, 1)
    # 2026 Stuff+ — accent-safe lookup
    st26 = _get(stuff26_lookup, stuff26_norm, r['name'])
    if st26:
        pit_records[-1].update({
            's26_stuff': st26['stuff'],
            's26_loc': st26['loc'],
            's26_pitching': st26['pitching'],
        })
        st25 = _get(stuff_lookup, stuff_norm, r['name'])
        if st25:
            pit_records[-1]['dStuff'] = st26['stuff'] - st25['stuff']
            pit_records[-1]['dLoc'] = st26['loc'] - st25['loc']
            pit_records[-1]['dPitching'] = st26['pitching'] - st25['pitching']

# ── Compute actualLcv and lcvDelta from 2026 in-season stats ─────────────
# actualLcv = sum of z-scores across role-appropriate categories, over 2026
# actuals. lcvDelta = actualLcv - projected lcv.
#
# Critical: pitchers are split into SP vs RP pools before z-scoring.
# Otherwise SPs get hammered on SV/HLD (they have none) and RPs on QS/K
# volume, which made starters like Dollander score ~0 despite great rates.
def _apply_plus_metric(pool, raw_key, plus_key, scale=15.0):
    """wRC+/OPS+-style: 100 + (x - mean)/std * scale. Integer, per-pool.
    Players outside the pool (below min_val) don't get a plus value.
    Returns (mean, std) for debug/logging."""
    vals = [r[raw_key] for r in pool if isinstance(r.get(raw_key), (int, float))]
    if len(vals) < 5:
        return None, None
    m = sum(vals) / len(vals)
    s = (sum((v - m) ** 2 for v in vals) / len(vals)) ** 0.5
    if s <= 0:
        return m, 0
    for r in pool:
        v = r.get(raw_key)
        if isinstance(v, (int, float)):
            r[plus_key] = int(round(100 + (v - m) / s * scale))
    return m, s

def _compute_actual_lcv(records, stat_cols_signs, min_key, min_val):
    """Compute actualLcv in-place for records passing min_val. Single pool."""
    pool = [r for r in records
            if isinstance(r.get(min_key), (int, float)) and r.get(min_key, 0) >= min_val]
    if len(pool) < 15:
        return
    for stat, sign in stat_cols_signs:
        vals = [r[stat] for r in pool if isinstance(r.get(stat), (int, float)) and r.get(stat) != '']
        if len(vals) < 5:
            continue
        m = sum(vals) / len(vals)
        s = (sum((v - m)**2 for v in vals) / len(vals)) ** 0.5
        if s == 0:
            continue
        for r in pool:
            v = r.get(stat)
            if isinstance(v, (int, float)) and v != '':
                r['_alv'] = r.get('_alv', 0) + sign * (v - m) / s
    for r in pool:
        if '_alv' in r:
            r['actualLcv'] = round(r.pop('_alv'), 2)
            r['lcvDelta'] = round(r['actualLcv'] - r.get('lcv', 0), 2)
    _apply_plus_metric([r for r in pool if 'actualLcv' in r], 'actualLcv', 'aLCVPlus')

def _compute_actual_lcv_split(records, sp_stats, rp_stats, role_key, sp_label, min_key, min_val):
    """Compute actualLcv for pitchers, splitting SP vs RP pools so SPs aren't
    penalized for missing SV/HLD and RPs aren't penalized for low QS/K volume.
    Each role uses its own category mix and its own z-score pool.
    """
    pool = [r for r in records
            if isinstance(r.get(min_key), (int, float)) and r.get(min_key, 0) >= min_val]
    if len(pool) < 15:
        return
    sp_pool = [r for r in pool if r.get(role_key) == sp_label]
    rp_pool = [r for r in pool if r.get(role_key) != sp_label]
    for sub_pool, stat_cols in ((sp_pool, sp_stats), (rp_pool, rp_stats)):
        sub_pool_eff = sub_pool if len(sub_pool) >= 5 else pool  # fallback
        for stat, sign in stat_cols:
            vals = [r[stat] for r in sub_pool_eff if isinstance(r.get(stat), (int, float)) and r.get(stat) != '']
            if len(vals) < 5:
                continue
            m = sum(vals) / len(vals)
            s = (sum((v - m)**2 for v in vals) / len(vals)) ** 0.5
            if s == 0:
                continue
            for r in sub_pool:
                v = r.get(stat)
                if isinstance(v, (int, float)) and v != '':
                    r['_alv'] = r.get('_alv', 0) + sign * (v - m) / s
    for r in pool:
        if '_alv' in r:
            r['actualLcv'] = round(r.pop('_alv'), 2)
            r['lcvDelta'] = round(r['actualLcv'] - r.get('lcv', 0), 2)
    # SP/RP split: each role gets its own aLCV+ pool so a +1.8 SP and +1.8 RP
    # both map to ~127 within their own role, not against the merged pool.
    _apply_plus_metric([r for r in sp_pool if 'actualLcv' in r], 'actualLcv', 'aLCVPlus')
    _apply_plus_metric([r for r in rp_pool if 'actualLcv' in r], 'actualLcv', 'aLCVPlus')

_bat_s26_stats = [
    ('s26_avg', 1), ('s26_hr', 1), ('s26_obp', 1), ('s26_slg', 1),
    ('s26_r', 1), ('s26_rbi', 1), ('s26_sb', 1), ('s26_so', -1),
]
# SP-centric: rates + K volume + W + QS; NO saves/holds
_pit_s26_sp_stats = [
    ('s26_era', -1), ('s26_whip', -1), ('s26_hr', -1),
    ('s26_so', 1), ('s26_w', 1), ('s26_qs', 1),
]
# RP-centric: rates + saves + holds + K; NO QS, W de-emphasized (omitted)
_pit_s26_rp_stats = [
    ('s26_era', -1), ('s26_whip', -1), ('s26_hr', -1),
    ('s26_so', 1), ('s26_sv', 1), ('s26_hld', 1),
]
_compute_actual_lcv(bat_records, _bat_s26_stats, 's26_pa', 10)
_compute_actual_lcv_split(
    pit_records,
    _pit_s26_sp_stats, _pit_s26_rp_stats,
    role_key='pos', sp_label='SP',
    min_key='s26_ip', min_val=5,
)
print(f"actualLcv computed for {sum(1 for r in bat_records if 'actualLcv' in r)} batters, "
      f"{sum(1 for r in pit_records if 'actualLcv' in r)} pitchers "
      f"(SP/RP pools split)")


# ── lcvPlus: PROJECTED LCV on the wRC+-style 100-scale ────────────────────
# Mirrors aLCVPlus, but on projected LCV (the pre-season expectation) rather
# than the actualLcv (in-season z-scores). Same role buckets so a +1sigma
# projected SP and a +1sigma projected RP both map to ~115 within their own
# pool. Drives every place that used to display raw projected lcv.
_pit_sp_records = [r for r in pit_records if r.get('pos') == 'SP']
_pit_rp_records = [r for r in pit_records if r.get('pos') != 'SP']
_apply_plus_metric(bat_records,    'lcv', 'lcvPlus')
_apply_plus_metric(_pit_sp_records, 'lcv', 'lcvPlus')
_apply_plus_metric(_pit_rp_records, 'lcv', 'lcvPlus')
print(f"lcvPlus computed for {sum(1 for r in bat_records if 'lcvPlus' in r)} batters, "
      f"{sum(1 for r in pit_records if 'lcvPlus' in r)} pitchers")


# ── recScore: blended recommendation score ───────────────────────────────
# 60% aLCV + 15% posFlex + 15% age + 10% LCV  (each z-scored within pool)
# Drives Roster / Trade Suggestions / Waiver recommendations.
def _pos_count(r):
    """Count distinct eligible positions from 'pos' field.
    Batters use '/' separator ('1B/3B'), pitchers use single value.
    DH/U don't count as real positions; same for SP/RP."""
    import re as _re
    s = r.get('pos') or ''
    parts = [p.strip() for p in _re.split(r'[,/]', s) if p.strip()]
    # DH/U are utility positions with no defensive flexibility
    real = [p for p in parts if p not in ('DH', 'U', 'UT', 'UTIL')]
    return max(1, len(real) if real else len(parts))

def _compute_rec_score(records, pool_filter=None):
    """Compute recScore per player. pool_filter(r) -> bool restricts the
    normalization pool (used to split SP vs RP so SPs aren't penalized on
    pos-flex vs RPs of the same count, etc.). Unfiltered records still get
    a recScore — they're just scored against the combined pool mean."""
    if not records:
        return
    elig = [r for r in records if r.get('actualLcv') is not None]
    if pool_filter is not None:
        pool = [r for r in elig if pool_filter(r)]
        if len(pool) < 10:
            pool = elig  # fallback
    else:
        pool = elig
    if len(pool) < 5:
        return

    def _mean_std(vals):
        if not vals:
            return 0.0, 1.0
        m = sum(vals) / len(vals)
        s = (sum((v - m) ** 2 for v in vals) / len(vals)) ** 0.5
        return m, (s if s > 0 else 1.0)

    m_a, s_a = _mean_std([r['actualLcv'] for r in pool])
    m_l, s_l = _mean_std([r.get('lcv', 0) or 0 for r in pool])
    m_g, s_g = _mean_std([r.get('ageFactor', 1.0) or 1.0 for r in pool])
    m_p, s_p = _mean_std([_pos_count(r) for r in pool])

    for r in elig:
        if pool_filter is not None and not pool_filter(r):
            continue
        z_alcv = (r['actualLcv'] - m_a) / s_a
        z_lcv  = ((r.get('lcv', 0) or 0) - m_l) / s_l
        z_age  = ((r.get('ageFactor', 1.0) or 1.0) - m_g) / s_g
        z_pos  = (_pos_count(r) - m_p) / s_p
        r['recScore'] = round(
            0.60 * z_alcv +
            0.15 * z_pos +
            0.15 * z_age +
            0.10 * z_lcv, 3
        )
        r['recBreakdown'] = {
            'alcv':  round(0.60 * z_alcv, 3),
            'posFlex': round(0.15 * z_pos, 3),
            'age':   round(0.15 * z_age, 3),
            'lcv':   round(0.10 * z_lcv, 3),
        }
    # recScorePlus: 100-anchored, 15 pts per 1σ within the same pool. This is
    # what we surface in columns/messages — raw recScore stays for internal math.
    scored = [r for r in elig if (pool_filter is None or pool_filter(r)) and 'recScore' in r]
    _apply_plus_metric(scored, 'recScore', 'recScorePlus')

# Batters: single pool
_compute_rec_score(bat_records)
# Pitchers: split pool by SP/RP so posFlex/LCV z-scores stay role-appropriate
_compute_rec_score(pit_records, pool_filter=lambda r: r.get('pos') == 'SP')
_compute_rec_score(pit_records, pool_filter=lambda r: r.get('pos') != 'SP')
print(f"recScore computed for {sum(1 for r in bat_records if 'recScore' in r)} batters, "
      f"{sum(1 for r in pit_records if 'recScore' in r)} pitchers")

# Sanitize NaN/None values before JSON serialization
import math as _math
for _recs in [bat_records, pit_records]:
    for _r in _recs:
        for _k, _v in _r.items():
            if isinstance(_v, float) and (_math.isnan(_v) or _math.isinf(_v)):
                _r[_k] = ''
bat_json = json.dumps(bat_records)
pit_json = json.dumps(pit_records)

# ── Draft picks data for keeper cost calculations ────────────────────────
draft_picks_raw = json.load(open('data/cbs_picks_full.json'))
draft_picks_json = json.dumps(draft_picks_raw)

# ── CBS transactions (scraped by scheduled task) ─────────────────────────
cbs_txn_path = 'data/cbs_transactions.json'
if os.path.exists(cbs_txn_path):
    cbs_txns = json.load(open(cbs_txn_path))
    print(f"CBS transactions loaded: {len(cbs_txns)} transactions")
else:
    cbs_txns = []
    print("No CBS transactions file found (data/cbs_transactions.json)")
cbs_txns_json = json.dumps(cbs_txns)

# ── League config (teams, rookies, untouchables, keepers) ───────────────
# In league_config.json, keepers and milb_keepers are keyed by OWNER LAST NAME
# (stable — team names change frequently). We resolve owner → current team name
# at build time using the teams[] mapping, so the JS continues to consume a
# team-name-keyed dict (state.js logic is unchanged).
#
# Note: keepers represent season-opening rosters. CBS transactions (trades,
# drops) are applied on top by state.js to mutate rosters during the season.
# roster_sync.py emits synthetic corrections if CBS rosters diverge from the
# transaction-derived state.
league_config = json.load(open('data/league_config.json'))
league_teams_json = json.dumps(league_config['teams'])
league_rookies_json = json.dumps(league_config['rookies'])
untouchable_json = json.dumps(league_config['untouchable'])

def _owner_last_name(full):
    """Extract last name from 'First Last' format. Used to match keepers by owner."""
    parts = (full or '').strip().split()
    return parts[-1] if parts else ''

def _resolve_to_team_name(by_owner_dict, teams):
    """Convert an owner-last-name-keyed dict to a team-name-keyed dict using
    the current teams[] mapping. Unknown owners are dropped with a warning."""
    out = {}
    owner_ln_to_team = {_owner_last_name(t['owner']): t['name'] for t in teams}
    for owner_ln, value in (by_owner_dict or {}).items():
        tn = owner_ln_to_team.get(owner_ln)
        if tn is None:
            print(f"WARN: keepers for owner {owner_ln!r} have no matching team in teams[] — dropping")
            continue
        out[tn] = value
    return out

_keepers_by_owner = league_config.get('keepers', {})
_milb_by_owner = league_config.get('milb_keepers', {})
_keepers_by_team = _resolve_to_team_name(_keepers_by_owner, league_config['teams'])
_milb_by_team = _resolve_to_team_name(_milb_by_owner, league_config['teams'])

# JS consumes team-name-keyed dicts (state.js key scheme unchanged)
league_keepers_json = json.dumps(_keepers_by_team)
league_milb_keepers_json = json.dumps(_milb_by_team)
_kcount = sum(len(v) for v in _keepers_by_team.values())
_mcount = sum(len(v) for v in _milb_by_team.values())
print(f"League config loaded: {len(league_config['teams'])} teams, "
      f"{_kcount} keepers, {_mcount} MiLB keepers "
      f"(resolved owner→team for {len(_keepers_by_team)}/{len(league_config['teams'])} teams), "
      f"{len(league_config['untouchable'])} untouchables")

# ── Player news (scraped from CBS My Team > News) ────────────────────────
_news_path = 'data/player_news.json'
if os.path.exists(_news_path):
    player_news = json.load(open(_news_path))
    print(f"Player news loaded: {len(player_news)} items")
else:
    player_news = []
    print("No player news file found")
player_news_json = json.dumps(player_news)

# ── Injuries (scraped from CBS injuries page) ────────────────────────────
_injuries_path = 'data/injuries.json'

def _unmangle_injury_name(s):
    """Strip 'X. LastFirst Last' scraper artifact by finding the longest
    suffix that appears twice (the surname) and keeping the trailing full
    name. See tools/clean_injuries.py for the canonical implementation."""
    if not s:
        return s
    n = len(s)
    for length in range(min(n // 2, 30), 3, -1):
        suffix = s[-length:]
        earlier = s.rfind(suffix, 0, n - length)
        if earlier > 0:
            candidate = s[earlier + length:].strip()
            if candidate and candidate[0].isupper() and (' ' in candidate or '-' in candidate):
                return candidate
    return s

if os.path.exists(_injuries_path):
    injuries = json.load(open(_injuries_path))
    # Defensive normalization: even if the file still has mangled names,
    # the dashboard should see them cleaned.
    _fixed = 0
    for _row in injuries:
        _orig = _row.get('name', '')
        _clean = _unmangle_injury_name(_orig)
        if _clean != _orig:
            _row['name'] = _clean
            _fixed += 1
    print(f"Injuries loaded: {len(injuries)} players ({_fixed} names normalized)")
else:
    injuries = []
    print("No injuries file found")
injuries_json = json.dumps(injuries)

# ── Season status (scraped from CBS — schedule, standings, current matchup) ──
_season_path = 'data/season_status.json'
if os.path.exists(_season_path):
    season_status = json.load(open(_season_path))
    print(f"Season status loaded: period {season_status.get('currentPeriod','?')}")
else:
    season_status = {}
    print("No season status file found (data/season_status.json)")
season_status_json = json.dumps(season_status)

from zoneinfo import ZoneInfo
build_time = datetime.now(ZoneInfo('America/Los_Angeles')).strftime('%b %d, %Y %I:%M %p PST')

# ── Version: read from VERSION file ───────────────────────────────────────
version = open('VERSION').read().strip() if os.path.exists('VERSION') else '0.0'
print(f"Version: {version}")

print(f"Batter records: {len(bat_records)}, Pitcher records: {len(pit_records)}")

# Spot check
for r in bat_records[:5]:
    print(f"  {r['name']:25s} pos={r['primaryPos']:3s} LCV={r['lcv']:6.2f} PNAV={r['pnav']:6.2f} age={r['age']} upside={r['upside']:6.2f} DP={r['dp']:6.2f}")

# ── Generate HTML from modular sources ────────────────────────────────────
# The dashboard is built from:
#   dashboard.shell.html  — HTML wrapper with __STYLES__ and __SCRIPTS__ placeholders
#   src/styles.css        — All CSS
#   src/*.js              — JavaScript modules concatenated in dependency order
#
# Fallback: if dashboard.shell.html doesn't exist, use the monolithic template

_JS_MODULES = [
    'src/data.js',
    'src/keepers.js',
    'src/state.js',
    'src/draft-data.js',
    'src/draft-engine.js',
    'src/time-splits.js',
    'src/columns.js',
    'src/tabs.js',
    'src/render-table.js',
    'src/render-sidebar.js',
    'src/render-transactions.js',
    'src/render-prospects.js',
    'src/render-roster.js',
    'src/render-board.js',
    'src/render-league.js',
    'src/render-mock.js',
    'src/render-waiver.js',
    'src/ui.js',
    'src/init.js',
]

if os.path.exists('dashboard.shell.html') and os.path.exists('src/data.js'):
    print("Building from modular sources (shell + src/*.js)...")
    with open('dashboard.shell.html') as f:
        html = f.read()
    with open('src/styles.css') as f:
        css = f.read()
    js_parts = []
    for mod in _JS_MODULES:
        with open(mod) as f:
            js_parts.append(f'// ── {mod} {"─" * (60 - len(mod))}\n{f.read()}')
    scripts = '\n'.join(js_parts)
    html = html.replace('__STYLES__', css)
    html = html.replace('__SCRIPTS__', scripts)
    print(f"  Assembled {len(_JS_MODULES)} JS modules + CSS + shell")
else:
    print("Building from monolithic template (dashboard.template.html)...")
    with open('dashboard.template.html') as _tf:
        html = _tf.read()

# ── Time-split snapshot data ──────────────────────────────────────────────
# time-splits.js expects SNAPSHOTS = {dates: [...], bat: {name: {date: [...]}}, pit: {...}}
# and LCV_STATS = {bat: {cat: {mean, std}}, pit: {...}} for z-score normalization.
# If the daily-snapshots pipeline hasn't populated data/snapshots/ yet, we inject
# empty defaults so the JS evaluates cleanly and rolling features are simply no-ops.
_snapshots_default = {"dates": [], "bat": {}, "pit": {}}
_lcv_stats_default = {"bat": {}, "pit": {}}
_snapshots_path = 'data/snapshots/index.json'
_lcv_stats_path = 'data/snapshots/lcv_stats.json'
if os.path.exists(_snapshots_path):
    try:
        with open(_snapshots_path) as f:
            snapshots_data = json.load(f)
        print(f"Snapshots loaded: {len(snapshots_data.get('dates', []))} dates, "
              f"{len(snapshots_data.get('bat', {}))} batters, "
              f"{len(snapshots_data.get('pit', {}))} pitchers")
    except Exception as _e:
        print(f"WARN: snapshots load failed ({_e}); using empty defaults")
        snapshots_data = _snapshots_default
else:
    snapshots_data = _snapshots_default
if os.path.exists(_lcv_stats_path):
    try:
        with open(_lcv_stats_path) as f:
            lcv_stats_data = json.load(f)
    except Exception as _e:
        print(f"WARN: LCV stats load failed ({_e}); using empty defaults")
        lcv_stats_data = _lcv_stats_default
else:
    lcv_stats_data = _lcv_stats_default
snapshots_json = json.dumps(snapshots_data)
lcv_stats_json = json.dumps(lcv_stats_data)

# Inject data into template placeholders
_replacements = {
    '__BAT_JSON__': bat_json,
    '__PIT_JSON__': pit_json,
    '__DRAFT_PICKS_JSON__': draft_picks_json,
    '__CBS_TXNS_JSON__': cbs_txns_json,
    '__PROSPECTS_JSON__': prospects_json,
    '__BUILD_TIME__': build_time,
    '__VERSION__': version,
    '__LEAGUE_TEAMS_JSON__': league_teams_json,
    '__LEAGUE_ROOKIES_JSON__': league_rookies_json,
    '__LEAGUE_KEEPERS_JSON__': league_keepers_json,
    '__LEAGUE_MILB_KEEPERS_JSON__': league_milb_keepers_json,
    '__UNTOUCHABLE_JSON__': untouchable_json,
    '__PLAYER_NEWS_JSON__': player_news_json,
    '__INJURIES_JSON__': injuries_json,
    '__PARK_FACTORS_JSON__': park_factors_json,
    '__SPRINT_SPEED_JSON__': sprint_speed_json,
    '__BULLPEN_ROLES_JSON__': bullpen_roles_json,
    '__SEASON_STATUS_JSON__': season_status_json,
    '__SNAPSHOTS_JSON__': snapshots_json,
    '__LCV_STATS_JSON__': lcv_stats_json,
}
for _token, _value in _replacements.items():
    html = html.replace(_token, _value)

# ── BUILD_HASH: compute a 12-char content hash and substitute the placeholder
# in state.js. state.js compares its baked-in hash to the one saved in
# localStorage; a mismatch triggers the auto-flush branch and clears stale
# roster state while preserving UI prefs (tags, comparison players, etc.)
# Without this substitution the placeholder is literal '__BUILD_HASH__' and
# the flush never fires, which is why stale keepers (Kurtz, etc.) survived
# trade updates across deploys.
import hashlib
build_hash = hashlib.sha256(html.encode('utf-8')).hexdigest()[:12]
_bh_token = "const BUILD_HASH = '__BUILD_HASH__';"
_bh_replacement = f"const BUILD_HASH = '{build_hash}';"
if _bh_token in html:
    html = html.replace(_bh_token, _bh_replacement, 1)
    print(f"BUILD_HASH substituted: {build_hash}")
else:
    print("WARNING: BUILD_HASH placeholder not found in assembled HTML — "
          "state.js auto-flush will be disabled. Check src/state.js line 6.")

with open('index.html', 'w') as f:
    f.write(html)

print("Dashboard written successfully!")
print(f"File size: {len(html):,} bytes")

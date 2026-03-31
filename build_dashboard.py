#!/usr/bin/env python3
"""Build the DPF 2026 Draft Dashboard with LCV, PNAV, UPSIDE, Draft Priority, and full player pool."""
import pandas as pd
import numpy as np
import json
import re
from datetime import datetime

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
            'avg': round(float(r.get('avg',0)), 3), 'obp': round(float(r.get('obp',0)), 3),
            'slg': round(float(r.get('slg',0)), 3)
        }
    print(f"2026 batter stats loaded: {len(bat26_lookup)} players")
if os.path.exists(_pit26_path):
    pit26 = pd.read_csv(_pit26_path, sep='|')
    for _, r in pit26.iterrows():
        pit26_lookup[r['name']] = {
            'ip': round(float(r.get('ip',0)), 1), 'w': int(r.get('w',0)), 'sv': int(r.get('sv',0)),
            'hld': int(r.get('hld',0)), 'era': round(float(r.get('era',0)), 2),
            'whip': round(float(r.get('whip',0)), 3), 'so': int(r.get('so',0)),
            'hr': int(r.get('hr',0)), 'qs': int(r.get('qs',0))
        }
    print(f"2026 pitcher stats loaded: {len(pit26_lookup)} players")
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

# ── 2026 Statcast (in-season advanced metrics) ───────────────────────────
statcast26_lookup = {}
_sc26_path = 'data/bat_statcast_2026.csv'
if os.path.exists(_sc26_path):
    sc26_df = pd.read_csv(_sc26_path, sep='|')
    for _, r in sc26_df.iterrows():
        woba = float(r['woba']) if 'woba' in r and r['woba'] not in ('', None) else 0
        xwoba = float(r['xwoba']) if 'xwoba' in r and r['xwoba'] not in ('', None) else 0
        entry = {'woba': round(woba, 3), 'xwoba': round(xwoba, 3), 'delta': round(xwoba - woba, 3)}
        if 'barrel_pct' in r and pd.notna(r.get('barrel_pct')):
            entry['barrel'] = round(float(r['barrel_pct']), 1)
        if 'hard_hit_pct' in r and pd.notna(r.get('hard_hit_pct')):
            entry['hardhit'] = round(float(r['hard_hit_pct']), 1)
        statcast26_lookup[r['name']] = entry
    print(f"Statcast 2026 loaded: {len(statcast26_lookup)} batters")
else:
    print("No 2026 Statcast file found (data/bat_statcast_2026.csv)")

stuff26_lookup = {}
_stf26_path = 'data/stuff_plus_2026.csv'
if os.path.exists(_stf26_path):
    stf26_df = pd.read_csv(_stf26_path, sep='|')
    for _, r in stf26_df.iterrows():
        entry = {}
        if 'stuff_plus' in r and pd.notna(r.get('stuff_plus')):
            entry['stuff'] = int(r['stuff_plus'])
        if 'location_plus' in r and pd.notna(r.get('location_plus')):
            entry['loc'] = int(r['location_plus'])
        if 'pitching_plus' in r and pd.notna(r.get('pitching_plus')):
            entry['pitching'] = int(r['pitching_plus'])
        if entry:
            stuff26_lookup[r['name']] = entry
    print(f"Stuff+ 2026 loaded: {len(stuff26_lookup)} pitchers")
else:
    print("No 2026 Stuff+ file found (data/stuff_plus_2026.csv)")

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

# Save projected pool means/stds for actual LCV computation (same scale)
bat_proj_stats = {}
for col in ['avg','hr','obp','slg','r','rbi','sb','so']:
    bat_proj_stats[col] = {'mean': bat_pool[col].mean(), 'std': bat_pool[col].std()}
def zscore_with(val, mean, std):
    if std == 0: return 0.0
    return (val - mean) / std

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

pit_proj_stats = {}
for col in ['era','hld','hr','so','sv','w','whip','qs']:
    pit_proj_stats[col] = {'mean': pit_pool[col].mean(), 'std': pit_pool[col].std()}

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
    """Get all eligible positions. CBS is authoritative — if CBS has data for a player,
    use CBS positions exclusively. Only fall back to FG positions if CBS has no entry."""
    cbs_positions = get_cbs_all_positions(name)
    if cbs_positions:
        return cbs_positions
    # No CBS data — fall back to FG positions
    if pd.isna(fg_pos):
        return ['DH']
    parts = str(fg_pos).split('/')
    positions = []
    for part in parts:
        resolved = resolve_pos(part, name)
        if resolved and resolved not in positions:
            positions.append(resolved)
    return positions if positions else ['DH']

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
    # 2025 actual stats
    s25 = bat25_lookup.get(r['name'], {})
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
    # Add Statcast data (2025 baseline)
    sc = statcast_lookup.get(r['name'], {})
    if sc:
        bat_records[-1].update({
            's25_barrel': sc['barrel'], 's25_hardhit': sc['hardhit'],
            's25_woba': sc['woba'], 's25_xwoba': sc['xwoba'], 's25_delta': sc['delta']
        })
    # Add 2026 Statcast data + divergence from 2025
    sc26 = statcast26_lookup.get(r['name'], {})
    if sc26:
        bat_records[-1].update({
            's26_barrel': sc26.get('barrel', ''), 's26_hardhit': sc26.get('hardhit', ''),
            's26_woba': sc26.get('woba', ''), 's26_xwoba': sc26.get('xwoba', ''),
            's26_xwDelta': sc26.get('delta', '')
        })
        # Divergence: 2026 metric minus 2025 metric (positive = improvement)
        if sc:
            if sc26.get('barrel') and sc.get('barrel'):
                bat_records[-1]['dBarrel'] = round(sc26['barrel'] - sc['barrel'], 1)
            if sc26.get('hardhit') and sc.get('hardhit'):
                bat_records[-1]['dHardhit'] = round(sc26['hardhit'] - sc['hardhit'], 1)
            if sc26.get('woba') and sc.get('woba'):
                bat_records[-1]['dWoba'] = round(sc26['woba'] - sc['woba'], 3)
            if sc26.get('xwoba') and sc.get('xwoba'):
                bat_records[-1]['dXwoba'] = round(sc26['xwoba'] - sc['xwoba'], 3)
    # Add sprint speed
    ss = sprint_lookup.get(r['name'], {})
    if ss:
        bat_records[-1]['sprintSpeed'] = ss['speed']
        bat_records[-1]['speedTier'] = ss['tier']
    # Add park factors for this player's team
    pf = park_factors.get(r['team'], {})
    if pf:
        bat_records[-1]['parkHR'] = pf.get('hr', 1.0)
        bat_records[-1]['parkR'] = pf.get('r', 1.0)
        bat_records[-1]['parkH'] = pf.get('h', 1.0)
    # Add 2026 in-season stats if available
    s26 = bat26_lookup.get(r['name'], {})
    if s26:
        bat_records[-1].update({
            's26_pa': s26.get('pa', ''), 's26_hr': s26.get('hr', ''),
            's26_r': s26.get('r', ''), 's26_rbi': s26.get('rbi', ''),
            's26_sb': s26.get('sb', ''), 's26_so': s26.get('so', ''),
            's26_avg': s26.get('avg', ''), 's26_obp': s26.get('obp', ''),
            's26_slg': s26.get('slg', ''),
        })
        # Compute actual LCV from 2026 stats, pace-adjusted to full season
        # Rate stats (AVG/OBP/SLG) are already on the right scale.
        # Counting stats (HR/R/RBI/SB/SO) are annualized: actual * (projectedPA / actualPA)
        # Minimum 10 PA to avoid extreme noise from tiny samples
        a_pa  = s26.get('pa', 0)
        if a_pa and a_pa >= 10:
            pace = int(r['pa']) / a_pa  # scale factor to full season
            a_lcv = (zscore_with(s26.get('avg',0), bat_proj_stats['avg']['mean'], bat_proj_stats['avg']['std'])
                   + zscore_with(s26.get('hr',0)*pace, bat_proj_stats['hr']['mean'], bat_proj_stats['hr']['std'])
                   + zscore_with(s26.get('obp',0), bat_proj_stats['obp']['mean'], bat_proj_stats['obp']['std'])
                   + zscore_with(s26.get('slg',0), bat_proj_stats['slg']['mean'], bat_proj_stats['slg']['std'])
                   + zscore_with(s26.get('r',0)*pace, bat_proj_stats['r']['mean'], bat_proj_stats['r']['std'])
                   + zscore_with(s26.get('rbi',0)*pace, bat_proj_stats['rbi']['mean'], bat_proj_stats['rbi']['std'])
                   + zscore_with(s26.get('sb',0)*pace, bat_proj_stats['sb']['mean'], bat_proj_stats['sb']['std'])
                   - zscore_with(s26.get('so',0)*pace, bat_proj_stats['so']['mean'], bat_proj_stats['so']['std']))
            bat_records[-1]['actualLcv'] = round(a_lcv, 2)
            bat_records[-1]['lcvDelta'] = round(a_lcv - r['lcv'], 2)

pit_records = []
for _, r in pit_pool.iterrows():
    age = get_age(r['name'])
    af = age_factor(age)
    upside = round(r['lcv'] * af, 2)
    dp = round(0.4 * r['lcv'] + 0.6 * r['pnav'], 2)
    # 2025 actual stats
    s25 = pit25_lookup.get(r['name'], {})
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
    st = stuff_lookup.get(r['name'], {})
    if st:
        pit_records[-1].update({
            's25_stuff': st['stuff'], 's25_loc': st['loc'], 's25_pitching': st['pitching']
        })
    st24 = stuff24_lookup.get(r['name'], {})
    if st24:
        pit_records[-1]['s24_stuff'] = st24['stuff']
    # Stuff+ trend: delta between 2025 and 2024
    if st and st24:
        pit_records[-1]['stuffTrend'] = st['stuff'] - st24['stuff']
    # Add 2026 Stuff+ data + divergence from 2025
    st26 = stuff26_lookup.get(r['name'], {})
    if st26:
        if 'stuff' in st26: pit_records[-1]['s26_stuff'] = st26['stuff']
        if 'loc' in st26: pit_records[-1]['s26_loc'] = st26['loc']
        if 'pitching' in st26: pit_records[-1]['s26_pitching'] = st26['pitching']
        # Divergence: 2026 minus 2025 (positive = improvement)
        if st:
            if 'stuff' in st26 and 'stuff' in st:
                pit_records[-1]['dStuff'] = st26['stuff'] - st['stuff']
            if 'loc' in st26 and 'loc' in st:
                pit_records[-1]['dLoc'] = st26['loc'] - st['loc']
            if 'pitching' in st26 and 'pitching' in st:
                pit_records[-1]['dPitching'] = st26['pitching'] - st['pitching']
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
    # Add 2026 in-season stats if available
    s26 = pit26_lookup.get(r['name'], {})
    if s26:
        pit_records[-1].update({
            's26_ip': s26.get('ip', ''), 's26_w': s26.get('w', ''),
            's26_sv': s26.get('sv', ''), 's26_hld': s26.get('hld', ''),
            's26_era': s26.get('era', ''), 's26_whip': s26.get('whip', ''),
            's26_so': s26.get('so', ''), 's26_hr': s26.get('hr', ''),
            's26_qs': s26.get('qs', ''),
        })
        # Compute actual LCV from 2026 stats, pace-adjusted to full season
        # Rate stats (ERA/WHIP) are already on the right scale.
        # Counting stats (W/SV/HD/SO/HR/QS) are annualized: actual * (projectedIP / actualIP)
        # Minimum 3 IP to avoid extreme noise from tiny samples
        a_ip = s26.get('ip', 0)
        if a_ip and a_ip >= 3:
            pace = float(r['ip']) / a_ip  # scale factor to full season
            a_lcv = (-zscore_with(s26.get('era',0), pit_proj_stats['era']['mean'], pit_proj_stats['era']['std'])
                   + zscore_with(s26.get('hld',0)*pace, pit_proj_stats['hld']['mean'], pit_proj_stats['hld']['std'])
                   - zscore_with(s26.get('hr',0)*pace, pit_proj_stats['hr']['mean'], pit_proj_stats['hr']['std'])
                   + zscore_with(s26.get('so',0)*pace, pit_proj_stats['so']['mean'], pit_proj_stats['so']['std'])
                   + zscore_with(s26.get('sv',0)*pace, pit_proj_stats['sv']['mean'], pit_proj_stats['sv']['std'])
                   + zscore_with(s26.get('w',0)*pace, pit_proj_stats['w']['mean'], pit_proj_stats['w']['std'])
                   - zscore_with(s26.get('whip',0), pit_proj_stats['whip']['mean'], pit_proj_stats['whip']['std'])
                   + zscore_with(s26.get('qs',0)*pace, pit_proj_stats['qs']['mean'], pit_proj_stats['qs']['std']))
            pit_records[-1]['actualLcv'] = round(a_lcv, 2)
            pit_records[-1]['lcvDelta'] = round(a_lcv - r['lcv'], 2)

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

# ── League config (teams, rookies, untouchables) ─────────────────────────
league_config = json.load(open('data/league_config.json'))
league_teams_json = json.dumps(league_config['teams'])
league_rookies_json = json.dumps(league_config['rookies'])
untouchable_json = json.dumps(league_config['untouchable'])
print(f"League config loaded: {len(league_config['teams'])} teams, {len(league_config['untouchable'])} untouchables")

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
if os.path.exists(_injuries_path):
    injuries = json.load(open(_injuries_path))
    print(f"Injuries loaded: {len(injuries)} players")
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

import hashlib

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
    'src/time-splits.js',
    'src/keepers.js',
    'src/state.js',
    'src/draft-data.js',
    'src/draft-engine.js',
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
    'src/ui.js',
    'src/init.js',
]

# ── Build hash: content-based fingerprint of all source files ─────────────
# Changes to ANY source file (JS, CSS, data, config) produce a new hash,
# which triggers an automatic localStorage flush on the client side.
_hash_sources = _JS_MODULES + ['src/styles.css', 'dashboard.shell.html',
    'data/cbs_transactions.json', 'data/league_config.json']
_hasher = hashlib.sha256()
for _hf in sorted(_hash_sources):
    if os.path.exists(_hf):
        _hasher.update(open(_hf, 'rb').read())
build_hash = _hasher.hexdigest()[:12]
print(f"Build hash: {build_hash}")

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

# Inject data into template placeholders
# ── Load daily snapshots for time-split analysis ────────────────────────
import glob as _glob
_snap_dir = 'data/snapshots'
_snapshots = {'dates': [], 'bat': {}, 'pit': {}}
if os.path.isdir(_snap_dir):
    # Batting snapshots
    _bat_snaps = sorted(_glob.glob(os.path.join(_snap_dir, 'bat_*.csv')))
    _bat_dates = []
    for _sf in _bat_snaps:
        _d = os.path.basename(_sf).replace('bat_', '').replace('.csv', '')
        _bat_dates.append(_d)
        _sdf = pd.read_csv(_sf, sep='|')
        for _, _sr in _sdf.iterrows():
            _name = _sr['name']
            if _name not in _snapshots['bat']:
                _snapshots['bat'][_name] = {}
            # Store as compact array: [pa, ab, h, hr, r, rbi, sb, so, bb, hbp, sf, x1b, x2b, x3b]
            _row = []
            for _c in ['pa','ab','h','hr','r','rbi','sb','so','bb','hbp','sf','x1b','x2b','x3b']:
                _row.append(int(_sr[_c]) if _c in _sr and pd.notna(_sr[_c]) else 0)
            _snapshots['bat'][_name][_d] = _row

    # Pitching snapshots
    _pit_snaps = sorted(_glob.glob(os.path.join(_snap_dir, 'pit_*.csv')))
    _pit_dates = []
    for _sf in _pit_snaps:
        _d = os.path.basename(_sf).replace('pit_', '').replace('.csv', '')
        _pit_dates.append(_d)
        _sdf = pd.read_csv(_sf, sep='|')
        for _, _sr in _sdf.iterrows():
            _name = _sr['name']
            if _name not in _snapshots['pit']:
                _snapshots['pit'][_name] = {}
            # Store as compact array: [ip, w, sv, hld, so, hr, qs, er, h, bb, tbf]
            _row = []
            for _c in ['ip','w','sv','hld','so','hr','qs','er','h','bb','tbf']:
                _row.append(float(_sr[_c]) if _c in _sr and pd.notna(_sr[_c]) else 0)
            _snapshots['pit'][_name][_d] = _row

    _snapshots['dates'] = sorted(set(_bat_dates + _pit_dates))
    print(f"Snapshots loaded: {len(_bat_snaps)} batting, {len(_pit_snaps)} pitching, {len(_snapshots['dates'])} unique dates")
else:
    print("No snapshots directory found (data/snapshots/) — time splits disabled")
_snapshots_json = json.dumps(_snapshots)

# ── LCV z-score means/stds for client-side LCV computation ──────────────
_lcv_stats = {
    'bat': {col: {'mean': round(bat_proj_stats[col]['mean'], 4), 'std': round(bat_proj_stats[col]['std'], 4)}
            for col in bat_proj_stats},
    'pit': {col: {'mean': round(pit_proj_stats[col]['mean'], 4), 'std': round(pit_proj_stats[col]['std'], 4)}
            for col in pit_proj_stats}
}
_lcv_stats_json = json.dumps(_lcv_stats)

_replacements = {
    '__BAT_JSON__': bat_json,
    '__PIT_JSON__': pit_json,
    '__DRAFT_PICKS_JSON__': draft_picks_json,
    '__CBS_TXNS_JSON__': cbs_txns_json,
    '__PROSPECTS_JSON__': prospects_json,
    '__BUILD_TIME__': build_time,
    '__BUILD_HASH__': build_hash,
    '__VERSION__': version,
    '__LEAGUE_TEAMS_JSON__': league_teams_json,
    '__LEAGUE_ROOKIES_JSON__': league_rookies_json,
    '__UNTOUCHABLE_JSON__': untouchable_json,
    '__PLAYER_NEWS_JSON__': player_news_json,
    '__INJURIES_JSON__': injuries_json,
    '__PARK_FACTORS_JSON__': park_factors_json,
    '__SPRINT_SPEED_JSON__': sprint_speed_json,
    '__BULLPEN_ROLES_JSON__': bullpen_roles_json,
    '__SEASON_STATUS_JSON__': season_status_json,
    '__SNAPSHOTS_JSON__': _snapshots_json,
    '__LCV_STATS_JSON__': _lcv_stats_json,
}
for _token, _value in _replacements.items():
    html = html.replace(_token, _value)

with open('index.html', 'w') as f:
    f.write(html)

print("Dashboard written successfully!")
print(f"File size: {len(html):,} bytes")

#!/usr/bin/env python3
"""Build the DPF 2026 Draft Dashboard with LCV, PNAV, UPSIDE, Draft Priority, and full player pool."""
import pandas as pd
import numpy as np
import json
import re

# ── Read data ──────────────────────────────────────────────────────────────
bat = pd.read_csv('data/dc_bat_full.csv', sep='|')
pit = pd.read_csv('data/dc_pit_full.csv', sep='|')
ages = json.load(open('data/mlb_ages.json'))
cbs_pos = json.load(open('data/cbs_positions.json'))

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
print(f"Stuff+ loaded: {len(stuff_lookup)} pitchers")

# ── Eno's 150 Best Pitchers list ─────────────────────────────────────────
eno_rank = {
    'Tarik Skubal': 1, 'Paul Skenes': 2, 'Tanner Houck': 3,
    'Yoshinobu Yamamoto': 4, 'Cristopher Sánchez': 5, 'Hunter Brown': 6,
    'Max Fried': 7, 'Logan Gilbert': 8, 'Bryan Woo': 9,
    'Chris Sale': 10, 'Hunter Greene': 11, 'Cole Ragans': 12,
    'Jacob deGrom': 13, 'George Kirby': 14, 'Logan Webb': 15,
    'Corbin Burnes': 16, 'Spencer Schwellenbach': 17, 'Eury Pérez': 18,
    'Kyle Bradish': 19, 'Joe Ryan': 20, 'Freddy Peralta': 21,
    'Shohei Ohtani': 22, 'Blake Snell': 23, 'Tyler Glasnow': 24,
    'Drew Rasmussen': 25, 'Chase Burns': 26, 'Dylan Cease': 27,
    'Nolan McLean': 28, 'Tobias Myers': 29, 'Emmet Sheehan': 30,
    'Trey Yesavage': 31, 'Ryan Pepiot': 32, 'Jesús Luzardo': 33,
    'Michael King': 34, 'Cam Schlittler': 35, 'Nathan Eovaldi': 36,
    'Nick Pivetta': 37, 'Nick Lodolo': 38, 'Zack Wheeler': 39,
    'Edward Cabrera': 40, 'Tatsuya Imai': 41,
    'Simeon Woods Richardson': 42, 'Kevin Gausman': 43,
    'Spencer Strider': 44, 'Sonny Gray': 45, 'Gavin Williams': 46,
    'Luis Castillo': 47, 'Tanner Bibee': 48, 'Brandon Woodruff': 49,
    'Bubba Chandler': 50, 'Cade Horton': 51, 'Shane Bieber': 52,
    'Carlos Rodón': 53, 'Sandy Alcantara': 54, 'Robbie Ray': 55,
    'Aaron Nola': 56, 'Ranger Suárez': 57, 'Jack Flaherty': 58,
    'Gerrit Cole': 59, 'Braxton Ashcraft': 60, 'Bryce Miller': 61,
    'Grayson Rodriguez': 62, 'Joey Cantillo': 63, 'Kris Bubic': 64,
    'Trevor Rogers': 65, 'Matthew Boyd': 66, 'Troy Melton': 67,
    'Dean Kremer': 68, 'Shota Imanaga': 69, 'Sean Manaea': 70,
    'Quinn Priester': 71, 'Zebby Matthews': 72, 'David Peterson': 73,
    'Jared Jones': 74, 'Joe Boyle': 75, 'MacKenzie Gore': 76,
    'José Soriano': 77, 'Will Warren': 78, 'Logan Henderson': 79,
    'Reese Olson': 80, 'Yu Darvish': 81, 'Shane McClanahan': 82,
    'Kodai Senga': 83, 'Ryan Weathers': 84, 'Jack Leiter': 85,
    'Reid Detmers': 86, 'Parker Messick': 87, 'Mike Burrows': 88,
    'Cody Ponce': 89, 'Ryne Nelson': 90, 'Casey Mize': 91,
    'Zac Gallen': 92, 'Merrill Kelly': 93, 'Shane Baz': 94,
    'Clay Holmes': 95, 'Yusei Kikuchi': 96, 'Luis Gil': 97,
    'Dustin May': 98, 'Chad Patrick': 99, 'Andrew Painter': 100,
    'Brayan Bello': 101, 'Zach Eflin': 102, 'Andrew Abbott': 103,
    'Noah Cameron': 104, 'Jacob Latz': 105, 'Robby Snelling': 106,
    'Landon Knack': 107, 'Ian Seymour': 108, 'Hunter Barco': 109,
    'Braxton Garrett': 110, 'Reynaldo López': 111, 'Landen Roupp': 112,
    'Mitch Keller': 113, 'Johan Oviedo': 114, 'Max Meyer': 115,
    'Grant Holmes': 116, 'Slade Cecconi': 117, 'Hurston Waldrep': 118,
    'Cade Cavalli': 119, 'Spencer Arrighetti': 120, 'Tyler Mahle': 121,
    'Brady Singer': 122, 'Seth Lugo': 123, 'Cristian Javier': 124,
    'Taj Bradley': 125, 'Jonah Tong': 126, 'Justin Steele': 127,
    'Connelly Early': 128, 'Robert Gasser': 129, 'Brandon Sproat': 130,
    'Mick Abel': 131, 'Kumar Rocker': 132, 'Framber Valdez': 133,
    'Jacob Lopez': 134, 'Jameson Taillon': 135, 'Michael Soroka': 136,
    'Bailey Ober': 137, 'Justin Verlander': 138, 'Chris Bassitt': 139,
    'Max Scherzer': 140, 'Michael McGreevy': 141, 'Matthew Liberatore': 142,
    'Brandon Pfaadt': 143, 'J.T. Ginn': 144, 'Patrick Sandoval': 145,
    'Daniel Lynch IV': 146, 'Andre Pallante': 147, 'Luis Severino': 148,
    'Richard Fitts': 149, 'Jeffrey Springs': 150,
}
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
    """Build list of all eligible positions from FG slash string + CBS data."""
    if pd.isna(fg_pos):
        return ['DH']
    parts = str(fg_pos).split('/')
    positions = []
    for part in parts:
        resolved = resolve_pos(part, name)
        if resolved and resolved not in positions:
            positions.append(resolved)
    # Merge any additional CBS positions (e.g. "RF/CF" adds both)
    for cbs_pos in get_cbs_all_positions(name):
        if cbs_pos not in positions:
            positions.append(cbs_pos)
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
    # Add Statcast data
    sc = statcast_lookup.get(r['name'], {})
    if sc:
        bat_records[-1].update({
            's25_barrel': sc['barrel'], 's25_hardhit': sc['hardhit'],
            's25_woba': sc['woba'], 's25_xwoba': sc['xwoba'], 's25_delta': sc['delta']
        })
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
    # Add Stuff+ data
    st = stuff_lookup.get(r['name'], {})
    if st:
        pit_records[-1].update({
            's25_stuff': st['stuff'], 's25_loc': st['loc'], 's25_pitching': st['pitching']
        })
    # Add Eno Sarris rank
    er = eno_rank.get(r['name'], '')
    if er:
        pit_records[-1]['eno_rank'] = er
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
print(f"Batter records: {len(bat_records)}, Pitcher records: {len(pit_records)}")

# Spot check
for r in bat_records[:5]:
    print(f"  {r['name']:25s} pos={r['primaryPos']:3s} LCV={r['lcv']:6.2f} PNAV={r['pnav']:6.2f} age={r['age']} upside={r['upside']:6.2f} DP={r['dp']:6.2f}")

# ── Generate HTML ─────────────────────────────────────────────────────────
html = f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DPF 2026 Draft Dashboard</title>
<style>
:root {{
  --bg: #ffffff; --surface: #f8f9fa; --surface2: #f0f1f3; --border: #dde0e6;
  --text: #1a1d27; --text2: #6b7085; --accent: #4a6bff; --accent2: #3451e0;
  --green: #16a34a; --red: #dc2626; --yellow: #ca8a04; --orange: #ea580c;
}}
* {{ margin:0; padding:0; box-sizing:border-box; }}
body {{ background:var(--bg); color:var(--text); font-family:'Inter',-apple-system,system-ui,sans-serif; font-size:13px; }}
.header {{ background:var(--surface); border-bottom:1px solid var(--border); padding:12px 20px; display:flex; align-items:center; gap:20px; }}
.header h1 {{ font-size:18px; font-weight:700; white-space:nowrap; }}
.header h1 span {{ color:var(--accent); }}
.tabs {{ display:flex; gap:4px; }}
.tab {{ padding:8px 16px; border-radius:6px; cursor:pointer; font-weight:600; font-size:13px; color:var(--text2); transition:all .15s; }}
.tab:hover {{ background:var(--surface2); color:var(--text); }}
.tab.active {{ background:var(--accent2); color:#fff; }}
.controls {{ display:flex; gap:10px; padding:12px 20px; background:var(--surface); border-bottom:1px solid var(--border); flex-wrap:wrap; align-items:center; }}
.search-box {{ background:var(--surface2); border:1px solid var(--border); border-radius:6px; padding:7px 12px; color:var(--text); font-size:13px; width:220px; outline:none; }}
.search-box:focus {{ border-color:var(--accent); }}
.filter-btn {{ padding:5px 12px; border-radius:5px; border:1px solid var(--border); background:var(--surface2); color:var(--text2); cursor:pointer; font-size:12px; font-weight:500; }}
.filter-btn.active {{ background:var(--accent2); color:#fff; border-color:var(--accent2); }}
.filter-btn:hover {{ border-color:var(--accent); }}
.stats-bar {{ margin-left:auto; display:flex; gap:16px; font-size:12px; color:var(--text2); }}
.stats-bar b {{ color:var(--text); }}
.table-wrap {{ overflow:auto; height:calc(100vh - 160px); }}
table {{ width:100%; border-collapse:collapse; }}
thead {{ position:sticky; top:0; z-index:10; }}
th {{ background:var(--surface2); padding:8px 10px; text-align:left; font-weight:600; font-size:11px; text-transform:uppercase; color:var(--text2); cursor:pointer; white-space:nowrap; border-bottom:2px solid var(--border); user-select:none; }}
th:hover {{ color:var(--accent); }}
th.sorted-asc::after {{ content:" \\25B2"; color:var(--accent); }}
th.sorted-desc::after {{ content:" \\25BC"; color:var(--accent); }}
td {{ padding:6px 10px; border-bottom:1px solid var(--border); white-space:nowrap; font-variant-numeric:tabular-nums; }}
tr:hover {{ background:var(--surface2); }}
tr.drafted {{ opacity:0.7; }}
tr.drafted td:first-child {{ position:relative; }}
.owner-badge {{ display:inline-block; font-size:9px; padding:1px 5px; border-radius:3px; background:var(--surface2); border:1px solid var(--border); color:var(--text2); margin-left:4px; font-weight:500; white-space:nowrap; }}
.owner-badge.mine {{ background:rgba(74,107,255,0.12); border-color:var(--accent); color:var(--accent); }}
tr.keeper {{ background:rgba(108,140,255,0.08); }}
.pos-badge {{ display:inline-block; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:600; }}
.pos-C {{ background:#7c3aed22; color:#a78bfa; }} .pos-1B {{ background:#05966922; color:#34d399; }}
.pos-2B {{ background:#d9770622; color:#fb923c; }} .pos-3B {{ background:#dc262622; color:#f87171; }}
.pos-SS {{ background:#2563eb22; color:#60a5fa; }} .pos-DH {{ background:#52525b22; color:#a1a1aa; }}
.pos-SP {{ background:#0891b222; color:#22d3ee; }} .pos-RP {{ background:#c026d322; color:#e879f9; }}
.pos-LF {{ background:#65a30d22; color:#a3e635; }} .pos-CF {{ background:#16a34a22; color:#4ade80; }}
.pos-RF {{ background:#84cc1622; color:#bef264; }}
.val-pos {{ color:var(--green); }} .val-neg {{ color:var(--red); }}
.eno-rank {{ display:inline-block; padding:0 4px; border-radius:3px; font-size:9px; font-weight:700; vertical-align:middle; background:rgba(59,130,246,0.15); color:#3b82f6; margin-left:3px; }}
.tag-badge {{ display:inline-block; padding:0 5px; border-radius:3px; font-size:10px; font-weight:700; vertical-align:middle; }}
.tag-want {{ background:rgba(34,197,94,0.15); color:var(--green); }}
.tag-avoid {{ background:rgba(239,68,68,0.15); color:var(--red); }}
.tag-sleeper {{ background:rgba(234,179,8,0.15); color:var(--yellow); }}
.tag-bust {{ background:rgba(249,115,22,0.15); color:var(--orange); }}
.tag-injured {{ background:rgba(168,85,247,0.15); color:#a855f7; }}
.tag-btns {{ display:inline-flex; gap:1px; vertical-align:middle; }}
.tag-btn {{ border:none; cursor:pointer; font-size:11px; font-weight:900; line-height:1; padding:1px 3px; border-radius:3px; opacity:0.2; background:transparent; }}
.tag-btn:hover {{ opacity:1; }}
.tag-w {{ color:var(--green); }} .tag-w:hover {{ background:rgba(34,197,94,0.15); }}
.tag-a {{ color:var(--red); }} .tag-a:hover {{ background:rgba(239,68,68,0.15); }}
.tag-s {{ color:var(--yellow); }} .tag-s:hover {{ background:rgba(234,179,8,0.15); }}
.tag-b {{ color:var(--orange); }} .tag-b:hover {{ background:rgba(249,115,22,0.15); }}
.tag-i {{ color:#a855f7; }} .tag-i:hover {{ background:rgba(168,85,247,0.15); }}
tr:has(.tag-want) {{ background:rgba(34,197,94,0.04); }}
tr:has(.tag-avoid) {{ background:rgba(239,68,68,0.04); }}
tr:has(.tag-sleeper) {{ background:rgba(234,179,8,0.04); }}
tr:has(.tag-bust) {{ background:rgba(249,115,22,0.04); }}
tr:has(.tag-injured) {{ background:rgba(168,85,247,0.04); }}
a[title^="Sleeper"] {{ color:var(--green); }} a[title^="Avoid"] {{ color:var(--red); }}
.lcv-col, .pnav-col {{ font-weight:700; }}
.view-toggle {{ display:flex; gap:2px; background:var(--surface2); border-radius:6px; padding:2px; margin-left:8px; }}
.view-btn {{ padding:4px 10px; border-radius:4px; border:none; font-size:11px; font-weight:600; cursor:pointer; background:transparent; color:var(--text2); transition:all .15s; }}
.view-btn:hover {{ color:var(--text); }}
.view-btn.active {{ background:var(--accent2); color:#fff; }}
.no-data {{ color:var(--text2); font-style:italic; }}
.tooltip {{ position:relative; }}
.tooltip .tt-text {{ visibility:hidden; background:var(--surface2); border:1px solid var(--border); color:var(--text); padding:10px 14px; border-radius:8px; position:absolute; z-index:100; width:340px; top:120%; left:50%; transform:translateX(-50%); font-size:12px; line-height:1.5; font-weight:400; text-transform:none; box-shadow:0 8px 24px rgba(0,0,0,.4); pointer-events:none; }}
.tooltip:hover .tt-text {{ visibility:visible; }}
.draft-panel {{ background:var(--surface); border-bottom:1px solid var(--border); padding:12px 20px; display:none; gap:10px; align-items:center; flex-wrap:wrap; }}
.draft-panel.show {{ display:flex; }}
.draft-input {{ background:var(--surface2); border:1px solid var(--border); border-radius:6px; padding:7px 12px; color:var(--text); font-size:13px; width:280px; outline:none; }}
.draft-input:focus {{ border-color:var(--accent); }}
.btn {{ padding:7px 16px; border-radius:6px; border:none; font-weight:600; font-size:13px; cursor:pointer; transition:all .15s; }}
.btn-primary {{ background:var(--accent2); color:#fff; }}
.btn-primary:hover {{ background:var(--accent); }}
.btn-danger {{ background:#dc2626; color:#fff; }}
.btn-danger:hover {{ background:#ef4444; }}
.btn-secondary {{ background:var(--surface2); color:var(--text); border:1px solid var(--border); }}
.btn-secondary:hover {{ background:var(--border); }}
.autocomplete {{ position:absolute; background:var(--surface2); border:1px solid var(--border); border-radius:6px; max-height:200px; overflow-y:auto; z-index:200; width:280px; display:none; }}
.autocomplete div {{ padding:8px 12px; cursor:pointer; font-size:13px; }}
.autocomplete div:hover, .autocomplete div.selected {{ background:var(--accent2); color:#fff; }}
.autocomplete div small {{ color:var(--text2); margin-left:6px; }}
.roster-section {{ padding:20px; }}
.roster-grid {{ display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:10px; min-height:40px; }}
.roster-card {{ background:var(--surface2); border:1px solid var(--border); border-radius:8px; padding:12px; transition:transform 0.15s, box-shadow 0.15s; }}
.roster-card[draggable="true"] {{ cursor:grab; }}
.roster-card[draggable="true"]:active {{ cursor:grabbing; }}
.roster-card.dragging {{ opacity:0.4; transform:scale(0.95); }}
.roster-card h4 {{ font-size:13px; margin-bottom:4px; }}
.roster-card small {{ color:var(--text2); }}
.roster-section.drag-over {{ outline:2px dashed var(--accent); outline-offset:4px; border-radius:8px; }}
.bulk-area {{ width:100%; min-height:60px; background:var(--surface2); border:1px solid var(--border); border-radius:6px; padding:8px; color:var(--text); font-size:12px; font-family:monospace; resize:vertical; }}
.my-team-panel {{ background:var(--surface); border-bottom:1px solid var(--border); padding:8px 20px; display:none; }}
.my-team-panel.show {{ display:block; }}
.my-team-row {{ display:flex; gap:8px; flex-wrap:wrap; padding:4px 0; }}
.team-chip {{ background:var(--surface2); border:1px solid var(--border); border-radius:4px; padding:3px 8px; font-size:11px; display:flex; align-items:center; gap:4px; }}
.team-chip .remove {{ cursor:pointer; color:var(--red); font-weight:700; }}
.need-indicator {{ display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:4px; }}
.need-high {{ background:var(--green); }} .need-med {{ background:var(--yellow); }} .need-low {{ background:var(--red); }}
#bulkModal {{ display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,.6); z-index:500; align-items:center; justify-content:center; }}
#bulkModal.show {{ display:flex; }}
.modal-content {{ background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:24px; width:500px; max-width:90vw; }}
.modal-content h3 {{ margin-bottom:12px; }}
.paste-panel {{ background:var(--surface); border-bottom:1px solid var(--border); padding:10px 20px; display:none; }}
.paste-panel.show {{ display:block; }}
@keyframes pulse {{ 0%,100% {{ opacity:1; }} 50% {{ opacity:0.7; }} }}
.mock-player-row:hover {{ background:rgba(99,102,241,0.08); }}
.paste-box {{ width:100%; min-height:50px; max-height:120px; background:var(--surface2); border:1px solid var(--border); border-radius:6px; padding:8px; color:var(--text); font-size:12px; font-family:monospace; resize:vertical; }}
.paste-status {{ font-size:11px; color:var(--text2); margin-top:4px; }}
</style>
</head>
<body>
<div class="header">
  <h1><span>DPF</span> 2026 Dashboard</h1>
  <div class="tabs">
    <div class="tab active" data-tab="all">All</div>
    <div class="tab" data-tab="bat">Hitters</div>
    <div class="tab" data-tab="pit">Pitchers</div>
    <div class="tab" data-tab="roster">Roster</div>
    <div class="tab" data-tab="board">Draft Board</div>
    <div class="tab" data-tab="mock">Mock Draft</div>
    <div class="tab" data-tab="league">League</div>
  </div>
  <div style="margin-left:auto;display:flex;align-items:center;gap:6px;">
    <button id="modeDraft" class="mode-btn" style="padding:4px 12px;font-size:11px;font-weight:600;border-radius:4px;cursor:pointer;border:1px solid var(--border);background:var(--surface2);color:var(--text);">Draft</button>
    <button id="modeSeason" class="mode-btn" style="padding:4px 12px;font-size:11px;font-weight:600;border-radius:4px;cursor:pointer;border:1px solid var(--border);background:var(--surface2);color:var(--text);">Season</button>
  </div>
</div>

<div class="controls" id="playerControls">
  <input type="text" class="search-box" id="searchBox" placeholder="Search players...">
  <div id="typeFilters" style="display:flex;gap:2px;"></div>
  <div style="width:1px;height:20px;background:var(--border);"></div>
  <div id="posFilters"></div>
  <select id="draftFilter" style="padding:4px 8px;font-size:12px;background:var(--surface2);color:var(--text);border:1px solid var(--border);border-radius:4px;">
    <option value="all">All Players</option>
    <option value="available">Available</option>
    <option value="drafted">Drafted</option>
  </select>
  <select id="tagFilter" style="padding:4px 8px;font-size:12px;background:var(--surface2);color:var(--text);border:1px solid var(--border);border-radius:4px;">
    <option value="all">All tags</option>
    <option value="want">Want only</option>
    <option value="avoid">Avoid only</option>
    <option value="sleeper">Sleepers only</option>
    <option value="bust">Busts only</option>
    <option value="injured">Injured only</option>
    <option value="any-tag">Any tagged</option>
    <option value="untagged">Untagged only</option>
  </select>
  <div class="view-toggle" id="viewToggle">
    <button class="view-btn active" data-view="main">Analytics</button>
    <button class="view-btn" data-view="s25">2025 Stats</button>
    <button class="view-btn" data-view="p26">2026 Projected</button>
    <button class="view-btn" data-view="s26">2026 Actual</button>
    <button class="view-btn" data-view="avp">Actual vs Proj</button>
  </div>
  <div class="stats-bar">
    <span>Showing <b id="showCount">0</b> players</span>
    <span>Drafted <b id="draftedCount">0</b></span>
    <span style="color:var(--green)">Want <b id="wantCount">0</b></span>
    <span style="color:var(--red)">Avoid <b id="avoidCount">0</b></span>
    <span style="color:var(--yellow)">Sleeper <b id="sleeperCount">0</b></span>
    <span style="color:var(--orange)">Bust <b id="bustCount">0</b></span>
    <span style="color:#a855f7">Injured <b id="injuredCount">0</b></span>
  </div>
</div>

<div class="draft-panel" id="draftPanel">
  <div style="position:relative;">
    <input type="text" class="draft-input" id="draftInput" placeholder="Type player name to draft...">
    <div class="autocomplete" id="draftAC"></div>
  </div>
  <label style="display:flex;align-items:center;gap:4px;font-size:12px;color:var(--text2);">
    <input type="checkbox" id="draftToMyTeam"> Add to my team
  </label>
  <button class="btn btn-primary" id="draftBtn">Draft</button>
  <button class="btn btn-secondary" onclick="openBulkModal()">Bulk Import</button>
  <button class="btn btn-secondary" id="togglePasteBtn" onclick="togglePastePanel()">Live Paste</button>
  <button class="btn btn-danger" onclick="clearAllDrafted()">Reset Draft</button>
</div>

<div class="paste-panel" id="pastePanel">
  <div style="display:flex;gap:12px;align-items:flex-start;">
    <div style="flex:1;">
      <textarea class="paste-box" id="livePasteBox" placeholder="Paste CBS draft log or other draft text here...&#10;CBS format: Pick: 1 - Team Name selects Judge, Aaron&#10;Also supports: Round 1 Pick 1: Aaron Judge&#10;1.01 Aaron Judge&#10;Or just player names, one per line"></textarea>
      <div class="paste-status" id="pasteStatus"></div>
    </div>
    <div style="display:flex;flex-direction:column;gap:4px;">
      <button class="btn btn-primary" onclick="processLivePaste()">Process</button>
      <button class="btn btn-secondary" style="font-size:10px;padding:3px 8px;" onclick="toggleCbsMap()">Team Map</button>
    </div>
  </div>
  <div id="cbsMapPanel" style="display:none;margin-top:8px;background:var(--surface2);border-radius:6px;padding:10px;">
    <div style="font-size:12px;font-weight:600;margin-bottom:6px;">CBS Team Name Mapping</div>
    <p style="font-size:11px;color:var(--text2);margin-bottom:8px;">Map CBS draft room team names to your league teams. The parser auto-detects names from the paste — or type them manually.</p>
    <div id="cbsMapRows"></div>
    <button class="btn btn-secondary" style="font-size:10px;padding:3px 10px;margin-top:6px;" onclick="addCbsMapRow()">+ Add mapping</button>
    <button class="btn btn-primary" style="font-size:10px;padding:3px 10px;margin-top:6px;margin-left:4px;" onclick="saveCbsMap()">Save</button>
    <button class="btn btn-secondary" style="font-size:10px;padding:3px 10px;margin-top:6px;margin-left:4px;" onclick="autoDetectCbsTeams()">Auto-detect from paste</button>
  </div>
</div>

<!-- team chips removed -->

<div style="display:flex;gap:12px;" id="mainLayout">
<div class="table-wrap" id="tableWrap" style="flex:1;min-width:0;">
  <table><thead id="thead"></thead><tbody id="tbody"></tbody></table>
</div>
<div id="liveSidebar" style="flex:0 0 280px;max-height:calc(100vh - 160px);overflow-y:auto;display:none;"></div>
</div>

<div class="roster-section" id="rosterSection" style="display:none;"></div>

<div id="bulkModal">
  <div class="modal-content">
    <h3>Bulk Import Keepers / Drafted Players</h3>
    <p style="font-size:12px;color:var(--text2);margin-bottom:10px;">Paste player names with optional round, one per line. Formats:<br>
    <code>Aaron Judge, 1</code> &nbsp; <code>Aaron Judge Rd1</code> &nbsp; <code>Aaron Judge Rd 1</code> &nbsp; <code>Aaron Judge</code> (no round)</p>
    <textarea class="bulk-area" id="bulkArea" rows="8" placeholder="Aaron Judge, 1&#10;Bobby Witt Jr. Rd3&#10;Tarik Skubal, 2&#10;Shohei Ohtani"></textarea>
    <div style="display:flex;gap:8px;margin-top:12px;justify-content:flex-end;">
      <button class="btn btn-secondary" onclick="closeBulkModal()">Cancel</button>
      <button class="btn btn-primary" onclick="processBulk()">Import</button>
    </div>
  </div>
</div>

<script>
// ── Data ──────────────────────────────────────────────────────────────────
const BATTERS = {bat_json};
const PITCHERS = {pit_json};
const ALL = [...BATTERS, ...PITCHERS];
ALL.forEach((p,i) => p._id = i);

// ── Draft Picks & Keeper Cost Model ──────────────────────────────────────
const DRAFT_PICKS = {draft_picks_json};
const KEEPER_ADVANCE = 4;  // rounds per year
const KEEPER_FLOOR = 4;    // rounds 1-4 = permanently ineligible
const UNDRAFTED_KEEPER_START = 15;  // FA pickups start keeper life at R15

// Build lookup: player name → {{ round, pick, team, keeper }}
const PICK_BY_NAME = {{}};
DRAFT_PICKS.forEach(dp => {{
  PICK_BY_NAME[dp.n] = {{ round: dp.r, pick: dp.p, team: dp.t, keeper: dp.k }};
}});

// Keeper cost calculation
function getKeeperInfo(playerName) {{
  const dp = PICK_BY_NAME[playerName];
  const draftRound = dp ? dp.round : null;
  const wasKeeper2026 = dp ? dp.keeper : false;

  // If not in draft, they're a potential FA pickup → R15 start
  const effectiveRound = draftRound || UNDRAFTED_KEEPER_START;

  // 2027 keeper cost = this year's round - 4
  const cost2027 = effectiveRound - KEEPER_ADVANCE;

  // Can this player be kept in 2027?
  const keepable2027 = cost2027 > KEEPER_FLOOR;

  // How many more years keepable? (including 2027)
  let yearsLeft = 0;
  let r = effectiveRound;
  while (r - KEEPER_ADVANCE > KEEPER_FLOOR) {{
    yearsLeft++;
    r -= KEEPER_ADVANCE;
  }}

  // Surplus value: player's LCV minus the "replacement value" at their keeper cost round
  // A round-4 player is essentially a 4th-round talent (~top 48 pick)
  // We normalize: round 1 pick is worth ~20 LCV, round 31 pick ~0 LCV
  // Linear approximation: roundValue = max(0, (32 - round) * 0.65)
  const roundValue = Math.max(0, (32 - effectiveRound) * 0.65);
  const costValue2027 = keepable2027 ? Math.max(0, (32 - cost2027) * 0.65) : 0;
  const p = ALL.find(x => x.name === playerName);
  const playerLCV = p ? (p.lcv || 0) : 0;
  // Surplus = production above what you'd expect from that draft slot
  // For keeper purposes: how much better is this player than what their keeper round implies?
  const surplusNow = playerLCV - roundValue;
  const surplus2027 = keepable2027 ? (playerLCV - costValue2027) : 0;

  // Multi-year surplus (discounted): sum of future surplus values
  let multiYearSurplus = 0;
  r = effectiveRound;
  let yr = 0;
  while (r - KEEPER_ADVANCE > KEEPER_FLOOR) {{
    r -= KEEPER_ADVANCE;
    yr++;
    const futureSlotVal = Math.max(0, (32 - r) * 0.65);
    multiYearSurplus += (playerLCV - futureSlotVal) * Math.pow(0.85, yr); // 15% annual discount
  }}

  return {{
    draftRound: draftRound,
    wasKeeper: wasKeeper2026,
    effectiveRound: effectiveRound,
    cost2027: keepable2027 ? cost2027 : null,
    keepable2027: keepable2027,
    yearsLeft: yearsLeft,
    surplusNow: surplusNow,
    surplus2027: surplus2027,
    multiYearSurplus: multiYearSurplus,
    roundValue: roundValue
  }};
}}

// ── State ─────────────────────────────────────────────────────────────────
const STATE_VERSION = 16;
const DEFAULT_KEEPERS = ['James Wood', 'MacKenzie Gore', 'Zach Neto', 'Nick Kurtz', 'Jo Adell'];
const DEFAULT_KEEPER_ROUNDS = {{'James Wood':12, 'MacKenzie Gore':13, 'Jo Adell':10, 'Zach Neto':14, 'Nick Kurtz':11}};

// All league keepers from 2026 keeper sheet (clamped rounds)
const DEFAULT_LEAGUE_KEEPERS = {{
  'choured in the usa.': [
    {{name:'Corbin Carroll',rd:6}}, {{name:'Jackson Chourio',rd:10}}, {{name:'Wyatt Langford',rd:12}}, {{name:'Ben Rice',rd:15}}, {{name:'Tyler Soderstrom',rd:25}}
  ],
  'Father Jhon Kensy': [
    {{name:'Jo Adell',rd:10}}, {{name:'Nick Kurtz',rd:11}}, {{name:'James Wood',rd:12}}, {{name:'MacKenzie Gore',rd:13}}, {{name:'Zach Neto',rd:14}}
  ],
  'Turangerine Dream': [
    {{name:'Jose Ramirez',rd:1}}, {{name:'Trea Turner',rd:4}}, {{name:'Devin Williams',rd:7}}, {{name:'Brandon Woodruff',rd:10}}, {{name:'Dylan Crews',rd:15}}
  ],
  "Whoop Whoop that\'s the sound of Dylan Cease": [
    {{name:'Juan Soto',rd:4}}, {{name:'Bo Bichette',rd:5}}, {{name:'Geraldo Perdomo',rd:15}}, {{name:'Gerrit Cole',rd:26}}, {{name:'Spencer Torkelson',rd:27}}
  ],
  'Lil Thumpers': [
    {{name:'Manny Machado',rd:1}}, {{name:'Spencer Strider',rd:6}}, {{name:'Colson Montgomery',rd:14}}, {{name:'Cameron Schlittler',rd:15}}, {{name:'Ceddanne Rafaela',rd:22}}
  ],
  'A Pete Crow-Armstrong Looked at Me': [
    {{name:'Mookie Betts',rd:2}}, {{name:'Bryce Harper',rd:5}}, {{name:'Elly De La Cruz',rd:6}}, {{name:'Pete Crow-Armstrong',rd:11}}, {{name:'Hunter Goodman',rd:15}}
  ],
  'Dinosaur Jr Caminero': [
    {{name:'Fernando Tatis Jr.',rd:4}}, {{name:'Julio Rodriguez',rd:5}}, {{name:'Gunnar Henderson',rd:6}}, {{name:'Junior Caminero',rd:12}}, {{name:'Jackson Holliday',rd:16}}
  ],
  "No men in Nolan\'s land": [
    {{name:'Ketel Marte',rd:1}}, {{name:'Oneil Cruz',rd:8}}, {{name:'Aroldis Chapman',rd:11}}, {{name:'Roman Anthony',rd:15}}, {{name:'Shea Langeliers',rd:16}}
  ],
  'Misiorowski Business': [
    {{name:'CJ Abrams',rd:8}}, {{name:'Jeremy Pena',rd:15}}, {{name:'Brent Rooker',rd:17}}, {{name:'Max Muncy',rd:21}}, {{name:'Eury Perez',rd:24}}
  ],
  'Buddy Buddy Buddy All On Base': [
    {{name:'Ronald Acuna Jr.',rd:4}}, {{name:'Cal Raleigh',rd:7}}, {{name:'Kyle Bradish',rd:11}}, {{name:'Nico Hoerner',rd:12}}, {{name:'Jesus Luzardo',rd:14}}
  ],
  'Are we not men? We are Devers!': [
    {{name:'Shohei Ohtani',rd:1}}, {{name:'Francisco Lindor',rd:3}}, {{name:'Jackson Merrill',rd:10}}, {{name:'Tarik Skubal',rd:11}}, {{name:'Maikel Garcia',rd:15}}
  ],
  "Psycho Keller, Qu\'est-ce que Cey": [
    {{name:'Kyle Tucker',rd:2}}, {{name:'Aaron Judge',rd:3}}, {{name:'Bobby Witt Jr.',rd:4}}, {{name:'Paul Skenes',rd:10}}, {{name:'Garrett Crochet',rd:11}}
  ],
}};
const DEFAULT_MILB_KEEPERS = ['Charlie Condon', 'Max Clark', 'Ethan Holliday', 'Eli Willits'];

// All league rookie/MiLB keepers from 2026 keeper sheet
const DEFAULT_LEAGUE_MILB_KEEPERS = {{
  'choured in the usa.': ['JJ Wetherholt', 'Carson Williams', 'Owen Caissie', 'George Lombard'],
  'Turangerine Dream': ['Nolan McLean', 'Carson Benge', 'Bryce Eldridge', 'Jonah Tong'],
  "Whoop Whoop that's the sound of Dylan Cease": ['Konnor Griffin', 'Kevin McGonigle', 'Walker Jenkins', 'Luis Pena'],
  'Lil Thumpers': ['Travis Bazzana', 'Justin Crawford', 'Josue De Paula', 'Andrew Painter'],
  'A Pete Crow-Armstrong Looked at Me': ['Sal Stewart', 'Jesus Made', 'Colt Emerson', 'Sebastian Wolcott'],
  'Dinosaur Jr Caminero': ['Leo De Vries', 'Aidan Miller', 'Samuel Basallo', 'Bubba Chandler'],
  "No men in Nolan's land": ['Bryce Doyle', 'Chase Burns', 'Cole Smith', 'Jordan Lawlar'],
  'Misiorowski Business': ['Trey Yesavage', 'Jett Williams', 'Kade Anderson', 'Edward Florentino'],
  'Buddy Buddy Buddy All On Base': ['Jacob Reimer', 'Caleb Bonemer', 'Quinn Mathews', 'Robby Snelling'],
  'Are we not men? We are Devers!': ['Connolly Early', 'Tommy Troy', 'Chase deLauter', 'Spencer Jones'],
  "Psycho Keller, Qu'est-ce que Cey": ['Ralphy Velazquez', 'Zyhir Hope', 'Emmanuel Rodriguez']
}};

// Draft order (pick 1 → pick 12) = reverse of last year's standings
const LEAGUE_TEAMS = [
  {{ pick: 1,  name: 'choured in the usa.', owner: 'Chris Kaskie' }},
  {{ pick: 2,  name: 'Father Jhon Kensy', owner: 'Mark Pytlik', mine: true }},
  {{ pick: 3,  name: 'Turangerine Dream', owner: 'David Roth' }},
  {{ pick: 4,  name: "Whoop Whoop that\\'s the sound of Dylan Cease", owner: 'Andrew Gaerig' }},
  {{ pick: 5,  name: 'Lil Thumpers', owner: 'Fran Devinney' }},
  {{ pick: 6,  name: 'A Pete Crow-Armstrong Looked at Me', owner: 'Ian Wolfe' }},
  {{ pick: 7,  name: 'Dinosaur Jr Caminero', owner: 'Anthony Resca' }},
  {{ pick: 8,  name: "No men in Nolan\\'s land", owner: 'Mark Azar' }},
  {{ pick: 9,  name: 'Misiorowski Business', owner: 'Blake Murphy' }},
  {{ pick: 10, name: 'Buddy Buddy Buddy All On Base', owner: 'Trei Brundrett' }},
  {{ pick: 11, name: 'Are we not men? We are Devers!', owner: 'Eno Sarris' }},
  {{ pick: 12, name: 'Psycho Keller, Qu\\'est-ce que Cey', owner: 'Matt Dennewit' }}
];

let _saved = JSON.parse(localStorage.getItem('dpf2026') || 'null');
// Never wipe saved state on version change — migrate instead
const _defaults = {{
  _v: STATE_VERSION, drafted: {{}}, myTeam: [],
  keepers: DEFAULT_KEEPERS.slice(),
  keeperRounds: Object.assign({{}}, DEFAULT_KEEPER_ROUNDS),
  milbKeepers: DEFAULT_MILB_KEEPERS.slice(),
  leagueTeams: {{}},
  teamOwners: {{}},
  tags: {{}},
  cbsTeamMap: {{}},
  leagueMilbKeepers: {{}}
}};
let state;
if (_saved) {{
  // Merge defaults for any missing keys, but preserve all existing data
  state = Object.assign({{}}, _defaults, _saved);
  state._v = STATE_VERSION;
}} else {{
  state = _defaults;
}}
// Ensure keeperRounds always exists and has defaults merged in
if (!state.keeperRounds) state.keeperRounds = {{}};
for (const [k, rd] of Object.entries(DEFAULT_KEEPER_ROUNDS)) {{
  if (!(k in state.keeperRounds)) state.keeperRounds[k] = rd;
}}
// Ensure keepers array has defaults
if (!state.keepers || state.keepers.length === 0) state.keepers = DEFAULT_KEEPERS.slice();
DEFAULT_KEEPERS.forEach(k => {{ if (!state.keepers.includes(k)) state.keepers.push(k); }});
// Ensure MiLB keepers
if (!state.milbKeepers) state.milbKeepers = DEFAULT_MILB_KEEPERS.slice();
DEFAULT_MILB_KEEPERS.forEach(k => {{ if (!state.milbKeepers.includes(k)) state.milbKeepers.push(k); }});
// Ensure league MiLB keepers
if (!state.leagueMilbKeepers) state.leagueMilbKeepers = {{}};
for (const [teamName, rookies] of Object.entries(DEFAULT_LEAGUE_MILB_KEEPERS)) {{
  if (!state.leagueMilbKeepers[teamName] || state.leagueMilbKeepers[teamName].length === 0) {{
    state.leagueMilbKeepers[teamName] = rookies.slice();
  }}
}}
// Ensure league teams + owners
if (!state.leagueTeams) state.leagueTeams = {{}};
if (!state.teamOwners) state.teamOwners = {{}};
// Pre-populate leagueTeams entries for all 12 teams (empty arrays if new)
LEAGUE_TEAMS.forEach(t => {{
  if (!t.mine && !state.leagueTeams[t.name]) state.leagueTeams[t.name] = [];
  if (t.owner && !state.teamOwners[t.name]) state.teamOwners[t.name] = t.owner;
}});
// Pre-populate league keepers (fuzzy-match names to player pool)
for (const [teamName, keepers] of Object.entries(DEFAULT_LEAGUE_KEEPERS)) {{
  if (!state.leagueTeams[teamName] || state.leagueTeams[teamName].length === 0) {{
    const matched = [];
    keepers.forEach(k => {{
      const found = ALL.find(p => p.name === k.name) || ALL.find(p => p.name.toLowerCase() === k.name.toLowerCase());
      if (found) {{
        matched.push(found.name);
        if (!state.drafted[found.name]) state.drafted[found.name] = {{ time: Date.now(), mine: false, round: k.rd }};
        if (!state.keeperRounds) state.keeperRounds = {{}};
        state.keeperRounds[found.name] = k.rd;
      }}
    }});
    state.leagueTeams[teamName] = matched;
  }}
}}
const save = () => localStorage.setItem('dpf2026', JSON.stringify(state));
const MY_TEAM = LEAGUE_TEAMS.find(t => t.mine);

// ── LIVE DRAFT PICKS (injected from CBS draft room) ─────────────────────
// t: team pick position: 1=choured, 2=FJK(mine), 3=Turang, 4=Whoop, 5=LilT, 6=PCA, 7=Houcks, 8=Nolan, 9=Misi, 10=Crash, 11=Eno, 12=Psycho
const _TEAM_MAP = {{1:'choured in the usa.',2:'Father Jhon Kensy',3:'Turangerine Dream',4:"Whoop Whoop that\\'s the sound of Dylan Cease",5:'Lil Thumpers',6:'A Pete Crow-Armstrong Looked at Me',7:'Dinosaur Jr Caminero',8:"No men in Nolan\\'s land",9:'Misiorowski Business',10:'Buddy Buddy Buddy All On Base',11:'Are we not men? We are Devers!',12:"Psycho Keller, Qu\\'est-ce que Cey"}};
const LIVE_PICKS = [
  // Rd1: picks 1-12
  {{n:'Vladimir Guerrero Jr.',t:1}},{{n:'Yoshinobu Yamamoto',t:2}},{{n:'Jose Ramirez',t:3}},{{n:'Jazz Chisholm Jr.',t:4}},
  {{n:'Manny Machado',t:5}},{{n:'Bryan Woo',t:6}},{{n:'Cristopher Sanchez',t:7}},{{n:'Ketel Marte',t:8}},
  {{n:'Pete Alonso',t:9}},{{n:'Chris Sale',t:10}},{{n:'Shohei Ohtani',t:11}},{{n:'Logan Webb',t:12}},
  // Rd2: picks 13-24 (snake)
  {{n:'Kyle Tucker',t:12}},{{n:'Matt Olson',t:11}},{{n:'Yordan Alvarez',t:10}},{{n:'Hunter Brown',t:9}},
  {{n:'Logan Gilbert',t:8}},{{n:'Max Fried',t:7}},{{n:'Mookie Betts',t:6}},{{n:'Kyle Schwarber',t:5}},
  {{n:'Cody Bellinger',t:4}},{{n:'Rafael Devers',t:3}},{{n:'Jhoan Duran',t:2}},{{n:'Cole Ragans',t:1}},
  // Rd3: picks 25-36
  {{n:'Freddy Peralta',t:1}},{{n:'Mason Miller',t:2}},{{n:'Framber Valdez',t:3}},{{n:'George Kirby',t:4}},
  {{n:'Freddie Freeman',t:5}},{{n:'Edwin Diaz',t:6}},{{n:'Jacob deGrom',t:7}},{{n:'Corey Seager',t:8}},
  {{n:'Riley Greene',t:9}},{{n:'Josh Naylor',t:10}},{{n:'Francisco Lindor',t:11}},{{n:'Aaron Judge',t:12}},
  // Rd4: picks 37-48 (snake)
  {{n:'Bobby Witt Jr.',t:12}},{{n:'Andres Munoz',t:11}},{{n:'Ronald Acuna Jr.',t:10}},{{n:'Joe Ryan',t:9}},
  {{n:'Sandy Alcantara',t:8}},{{n:'Fernando Tatis Jr.',t:7}},{{n:'Alex Bregman',t:6}},{{n:'Dylan Cease',t:5}},
  {{n:'Juan Soto',t:4}},{{n:'Trea Turner',t:3}},{{n:'Austin Riley',t:2}},{{n:'Brice Turang',t:1}},
  // Rd5: picks 49-60
  {{n:'Jacob Misiorowski',t:1}},{{n:'Nick Lodolo',t:2}},{{n:'Byron Buxton',t:3}},{{n:'Bo Bichette',t:4}},
  {{n:'Cade Smith',t:5}},{{n:'Bryce Harper',t:6}},{{n:'Julio Rodriguez',t:7}},{{n:'Jarren Duran',t:8}},
  {{n:'William Contreras',t:9}},{{n:'Jacob Wilson',t:10}},{{n:'Emmet Sheehan',t:11}},{{n:'Vinnie Pasquantino',t:12}},
  // Rd6: picks 61-72 (snake)
  {{n:'Will Smith',t:12}},{{n:'David Bednar',t:11}},{{n:'Michael Harris II',t:10}},{{n:'Jose Altuve',t:9}},
  {{n:'Kevin Gausman',t:8}},{{n:'Gunnar Henderson',t:7}},{{n:'Elly De La Cruz',t:6}},{{n:'Spencer Strider',t:5}},
  {{n:'Nick Pivetta',t:4}},{{n:'Tatsuya Imai',t:3}},{{n:'Drake Baldwin',t:2}},{{n:'Corbin Carroll',t:1}},
  // Rd7: picks 73-84
  {{n:'Tyler Glasnow',t:1}},{{n:'Griffin Jax',t:2}},{{n:'Devin Williams',t:3}},{{n:'Raisel Iglesias',t:4}},
  {{n:'Trevor Rogers',t:5}},{{n:'Matthew Boyd',t:6}},{{n:'Yandy Diaz',t:7}},{{n:'Ryan Helsley',t:8}},
  {{n:'Drew Rasmussen',t:9}},{{n:'Cal Raleigh',t:10}},{{n:'Seiya Suzuki',t:11}},{{n:'Steven Kwan',t:12}},
  // Rd8: picks 85-96 (snake)
  {{n:'Daniel Palencia',t:12}},{{n:'Alejandro Kirk',t:11}},{{n:'Michael King',t:10}},{{n:'CJ Abrams',t:9}},
  {{n:'Oneil Cruz',t:8}},{{n:'Josh Hader',t:7}},{{n:'Trevor Megill',t:6}},{{n:'Adley Rutschman',t:5}},
  {{n:'Agustin Ramirez',t:4}},{{n:'Christian Yelich',t:3}},{{n:'George Springer',t:2}},{{n:'Sonny Gray',t:1}},
  // Rd9: picks 97-108
  {{n:'Isaac Paredes',t:1}},{{n:'Shane McClanahan',t:2}},{{n:'Gavin Williams',t:3}},{{n:'Kyle Stowers',t:4}},
  {{n:'Luke Keaschall',t:5}},{{n:'Noah Cameron',t:6}},{{n:'Zack Wheeler',t:7}},{{n:'Michael Busch',t:8}},
  {{n:'Daulton Varsho',t:9}},{{n:'Bryan Abreu',t:10}},{{n:'Ozzie Albies',t:11}},{{n:'Eugenio Suarez',t:12}},
  // Rd10: picks 109-120 (snake)
  {{n:'Paul Skenes',t:12}},{{n:'Jackson Merrill',t:11}},{{n:'Abner Uribe',t:10}},{{n:'Jeff Hoffman',t:9}},
  {{n:'Nathan Eovaldi',t:8}},{{n:'Taylor Ward',t:7}},{{n:'Bryan Reynolds',t:6}},{{n:'Emilio Pagan',t:5}},
  {{n:'Salvador Perez',t:4}},{{n:'Brandon Woodruff',t:3}},{{n:'Jo Adell',t:2}},{{n:'Jackson Chourio',t:1}},
  // Rd11: picks 121-132
  {{n:'Carlos Estevez',t:1}},{{n:'Nick Kurtz',t:2}},{{n:'Brandon Lowe',t:3}},{{n:'Ryan Pepiot',t:4}},
  {{n:'Teoscar Hernandez',t:5}},{{n:'Pete Crow-Armstrong',t:6}},{{n:'Grant Taylor',t:7}},{{n:'Aroldis Chapman',t:8}},
  {{n:'Pete Fairbanks',t:9}},{{n:'Kyle Bradish',t:10}},{{n:'Tarik Skubal',t:11}},{{n:'Garrett Crochet',t:12}},
  // Rd12: picks 133-144 (snake)
  {{n:'Matt McLain',t:12}},{{n:'Andy Pages',t:11}},{{n:'Nico Hoerner',t:10}},{{n:'Jeremiah Estrada',t:9}},
  {{n:'Ivan Herrera',t:8}},{{n:'Junior Caminero',t:7}},{{n:'Brendan Donovan',t:6}},{{n:'Dennis Santana',t:5}},
  {{n:'Kris Bubic',t:4}},{{n:'Randy Arozarena',t:3}},{{n:'James Wood',t:2}},{{n:'Wyatt Langford',t:1}},
  // Rd13: picks 145-156
  {{n:'Jac Caglianone',t:1}},{{n:'MacKenzie Gore',t:2}},{{n:'Shota Imanaga',t:3}},{{n:'Kenley Jansen',t:4}},
  {{n:'Trevor Story',t:5}},{{n:'Luis Castillo',t:6}},{{n:'Ranger Suarez',t:7}},{{n:'Ryan Walker',t:8}},
  {{n:'Robert Suarez',t:9}},{{n:'Alec Burleson',t:10}},{{n:'Cade Horton',t:11}},{{n:'Matt Svanson',t:12}},
  // Rd14: picks 157-168 (snake)
  {{n:'Zac Gallen',t:12}},{{n:'Edward Cabrera',t:11}},{{n:'Jesus Luzardo',t:10}},{{n:'Matt Chapman',t:9}},
  {{n:'Jack Flaherty',t:8}},{{n:'Garrett Whitlock',t:7}},{{n:'Kerry Carpenter',t:6}},{{n:'Colson Montgomery',t:5}},
  {{n:'Xavier Edwards',t:4}},{{n:'Kevin Ginkel',t:3}},{{n:'Zach Neto',t:2}},{{n:'Kazuma Okamoto',t:1}},
  // Rd15: picks 169-180
  {{n:'Ben Rice',t:1}},{{n:'Gleyber Torres',t:2}},{{n:'Dylan Crews',t:3}},{{n:'Geraldo Perdomo',t:4}},
  {{n:'Cameron Schlittler',t:5}},{{n:'Hunter Goodman',t:6}},{{n:'Willson Contreras',t:7}},{{n:'Roman Anthony',t:8}},
  {{n:'Jeremy Pena',t:9}},{{n:'Garrett Cleavinger',t:10}},{{n:'Maikel Garcia',t:11}},{{n:'Jose A. Ferrer',t:12}},
  // Rd16: picks 181-192 (snake)
  {{n:'Carter Jensen',t:12}},{{n:'Adrian Morejon',t:11}},{{n:'Robert Garcia',t:10}},{{n:'Seranthony Dominguez',t:9}},
  {{n:'Shea Langeliers',t:8}},{{n:'Jackson Holliday',t:7}},{{n:'Blake Snell',t:6}},{{n:'Trent Grisham',t:5}},
  {{n:'Ryan Weathers',t:4}},{{n:'Francisco Alvarez',t:3}},{{n:'Tyler Rogers',t:2}},{{n:'Riley O\\'Brien',t:1}},
  // Rd17: picks 193-204
  {{n:'Robbie Ray',t:1}},{{n:'JoJo Romero',t:2}},{{n:'Sal Frelick',t:3}},{{n:'Justin Sterner',t:4}},
  {{n:'Chandler Simpson',t:5}},{{n:'Andrew Abbott',t:6}},{{n:'Kyle Teel',t:7}},{{n:'Carlos Correa',t:8}},
  {{n:'Brent Rooker',t:9}},{{n:'Matt Brash',t:10}},{{n:'Shane Baz',t:11}},{{n:'Brenton Doyle',t:12}},
  // Rd18: picks 205-216 (snake)
  {{n:'Dylan Beavers',t:12}},{{n:'Spencer Schwellenbach',t:11}},{{n:'Addison Barger',t:10}},{{n:'Grayson Rodriguez',t:9}},
  {{n:'Ryan Waldschmidt',t:8}},{{n:'Munetaka Murakami',t:7}},{{n:'Daylen Lile',t:6}},{{n:'Braxton Ashcraft',t:5}},
  {{n:'Cody Ponce',t:4}},{{n:'Luke Weaver',t:3}},{{n:'Tanner Bibee',t:2}},{{n:'Jordan Westburg',t:1}},
  // Rd19: picks 217-228
  {{n:'Luis Robert',t:1}},{{n:'Jose Soriano',t:2}},{{n:'Noelvi Marte',t:3}},{{n:'Payton Tolle',t:4}},
  {{n:'Mike Trout',t:5}},{{n:'Lucas Erceg',t:6}},{{n:'Tyler Holton',t:7}},{{n:'Rainiel Rodriguez',t:8}},
  {{n:'Carlos Rodon',t:9}},{{n:'Reynaldo Lopez',t:10}},{{n:'Ezequiel Tovar',t:11}},{{n:'Michael Burrows',t:12}},
  // Rd20: picks 229-240 (snake)
  {{n:'Kodai Senga',t:12}},{{n:'Hunter Greene',t:11}},{{n:'Wilyer Abreu',t:10}},{{n:'Lawrence Butler',t:9}},
  {{n:'Bennett Sousa',t:8}},{{n:'Alex Vesia',t:7}},{{n:'Shane Bieber',t:6}},{{n:'Aaron Nola',t:5}},
  {{n:'Andrew Vaughn',t:4}},{{n:'Tony Santillan',t:3}},{{n:'Jakob Marsee',t:2}},{{n:'Will Vest',t:1}},
  // Rd21: picks 241-252
  {{n:'Tanner Scott',t:1}},{{n:'Matthew Liberatore',t:2}},{{n:'Ramon Laureano',t:3}},{{n:'Willy Adames',t:4}},
  {{n:'Sean Manaea',t:5}},{{n:'Hunter Gaddis',t:6}},{{n:'Brandon Nimmo',t:7}},{{n:'Kyle Manzardo',t:8}},
  {{n:'Max Muncy',t:9}},{{n:'David Peterson',t:10}},{{n:'Joe Musgrove',t:11}},{{n:'Edwin Uceta',t:12}},
  // Rd22: picks 253-264 (snake)
  {{n:'Thomas White',t:12}},{{n:'Cam Smith',t:11}},{{n:'Casey Mize',t:10}},{{n:'Clay Holmes',t:9}},
  {{n:'Merrill Kelly',t:8}},{{n:'Josuar De Jesus Gonzalez',t:7}},{{n:'Max Meyer',t:6}},{{n:'Ceddanne Rafaela',t:5}},
  {{n:'Zebby Matthews',t:4}},{{n:'Jonathan Aranda',t:3}},{{n:'Joey Cantillo',t:2}},{{n:'Eduardo Quintero',t:1}},
  // Rd23: picks 265-276
  {{n:'Bryce Rainer',t:1}},{{n:'Ernie Clement',t:2}},{{n:'Kirby Yates',t:3}},{{n:'Carson Whisenhunt',t:4}},
  {{n:'Matt Strahm',t:5}},{{n:'Shane Smith',t:6}},{{n:'Taylor Rogers',t:7}},{{n:'Bryce Miller',t:8}},
  {{n:'Gage Jump',t:9}},{{n:'Ian Happ',t:10}},{{n:'Louis Varland',t:11}},{{n:'Clayton Beeter',t:12}},
  // Rd24: picks 277-288 (snake)
  {{n:'Justin Steele',t:12}},{{n:'Hunter Barco',t:11}},{{n:'Jared Jones',t:10}},{{n:'Eury Perez',t:9}},
  {{n:'Dustin May',t:8}},{{n:'Brody Hopkins',t:7}},{{n:'Mickey Moniak',t:6}},{{n:'Parker Messick',t:5}},
  {{n:'Josh Jung',t:4}},{{n:'Quinn Priester',t:3}},{{n:'Gabriel Moreno',t:2}},{{n:'Roki Sasaki',t:1}},
  // Rd25: picks 289-300
  {{n:'Tyler Soderstrom',t:1}},{{n:'Jeff McNeil',t:2}},{{n:'Jordan Beck',t:3}},{{n:'Brandon Sproat',t:4}},
  {{n:'Gabe Speier',t:5}},{{n:'Hunter Harvey',t:6}},{{n:'Slade Cecconi',t:7}},{{n:'Colton Cowser',t:8}},
  {{n:'Reid Detmers',t:9}},{{n:'Willi Castro',t:10}},{{n:'Josh H. Smith',t:11}},{{n:'Moises Ballesteros',t:12}},
  // Rd26: picks 301-312 (snake)
  {{n:'Ryne Nelson',t:12}},{{n:'Gregory Soto',t:11}},{{n:'Braxton Garrett',t:10}},{{n:'Jack Leiter',t:9}},
  {{n:'Brad Keller',t:8}},{{n:'Kyle Harrison',t:7}},{{n:'Corbin Burnes',t:6}},{{n:'Ryan O\\'Hearn',t:5}},
  {{n:'Gerrit Cole',t:4}},{{n:'Jorge Polanco',t:3}},{{n:'Royce Lewis',t:2}},{{n:'Logan Henderson',t:1}},
  // Rd27: picks 313-324
  {{n:'Shawn Armstrong',t:1}},{{n:'Luis Arraez',t:2}},{{n:'Cristian Javier',t:3}},{{n:'Spencer Torkelson',t:4}},
  {{n:'Yainer Diaz',t:5}},{{n:'Rhett Lowder',t:6}},{{n:'Michael Wacha',t:7}},{{n:'Alec Bohm',t:8}},
  {{n:'Marcus Semien',t:9}},{{n:'Jung Hoo Lee',t:10}},{{n:'Jacob Latz',t:11}},{{n:'Marcelo Mayer',t:12}},
  // Rd28: picks 325-336 (snake)
  {{n:'Evan Carter',t:12}},{{n:'Jack Dreyer',t:11}},{{n:'Xander Bogaerts',t:10}},{{n:'Jose Caballero',t:9}},
  {{n:'Eduardo Rodriguez',t:8}},{{n:'Orion Kerkering',t:7}},{{n:'Edwin Arroyo',t:6}},{{n:'Caleb Durbin',t:5}},
  {{n:'Javier Assad',t:4}},{{n:'Brooks Raley',t:3}},{{n:'Mick Abel',t:2}},{{n:'Camilo Doval',t:1}},
  // Rd29: picks 337-348
  {{n:'Colt Keith',t:1}},{{n:'Heliot Ramos',t:2}},{{n:'A.J. Ewing',t:3}},{{n:'Jose Butto',t:4}},
  {{n:'Otto Lopez',t:5}},{{n:'Spencer Arrighetti',t:6}},{{n:'Chris Bassitt',t:7}},{{n:'Jameson Taillon',t:8}},
  {{n:'Anthony Volpe',t:9}},{{n:'Fernando Cruz',t:10}},{{n:'Cade Cavalli',t:11}},{{n:'Brett Baty',t:12}},
  // Rd30: picks 349-360 (snake)
  {{n:'Coby Mayo',t:12}},{{n:'Landen Roupp',t:11}},{{n:'Brady Singer',t:10}},{{n:'Jackson Jobe',t:9}},
  {{n:'Adolis Garcia',t:8}},{{n:'Brayan Bello',t:7}},{{n:'Giancarlo Stanton',t:6}},{{n:'Nolan Schanuel',t:5}},
  {{n:'Cade Smith',t:4}},{{n:'TJ Rumfield',t:3}},{{n:'Graham Ashcraft',t:2}},{{n:'Hogan Harris',t:1}},
  // Rd31: picks 361-372
  {{n:'Jasson Dominguez',t:1}},{{n:'Yusei Kikuchi',t:2}},{{n:'Alfredo Duno',t:3}},{{n:'Josue Briceno',t:4}},
  {{n:'Lars Nootbaar',t:5}},{{n:'Tyler Stephenson',t:6}},{{n:'Shane Drohan',t:7}},{{n:'Dansby Swanson',t:8}},
  {{n:'Ha-seong Kim',t:9}},{{n:'Jason Adam',t:10}},{{n:'Johan Oviedo',t:11}},{{n:'Elmer Rodriguez-Cruz',t:12}},
];
if (!state.drafted) state.drafted = {{}};
const _norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
LIVE_PICKS.forEach(p => {{
  const found = ALL.find(x => x.name === p.n) || ALL.find(x => _norm(x.name) === _norm(p.n));
  const nm = found ? found.name : p.n;
  const isMine = p.t === 2;
  state.drafted[nm] = {{ time: Date.now(), mine: isMine }};
  if (isMine && !state.myTeam.includes(nm)) state.myTeam.push(nm);
  // Assign to team roster for LCV calculations
  const teamName = _TEAM_MAP[p.t];
  if (teamName && !isMine) {{
    if (!state.leagueTeams[teamName]) state.leagueTeams[teamName] = [];
    if (!state.leagueTeams[teamName].includes(nm)) state.leagueTeams[teamName].push(nm);
  }}
}});
// Collect all keeper names to skip in live pick grid
const _allKeeperNames = new Set();
(state.keepers || []).forEach(k => _allKeeperNames.add(k));
Object.values(state.leagueTeams || {{}}).forEach(arr => (arr||[]).forEach(k => {{
  if (state.keeperRounds && state.keeperRounds[k]) _allKeeperNames.add(k);
}}));
for (const keepers of Object.values(DEFAULT_LEAGUE_KEEPERS)) {{
  keepers.forEach(k => _allKeeperNames.add(k.name));
}}
const LIVE_PICK_ORDER = {{}};
LIVE_PICKS.forEach((p, i) => {{
  const found = ALL.find(x => x.name === p.n) || ALL.find(x => _norm(x.name) === _norm(p.n));
  const nm = found ? found.name : p.n;
  // Skip keepers — they're already shown by the keeperGrid
  if (_allKeeperNames.has(nm) || _allKeeperNames.has(p.n)) return;
  LIVE_PICK_ORDER[i + 1] = {{ name: nm, mine: p.t === 2 }};
}});
// Mark all league keepers (including MiLB) as drafted
for (const keepers of Object.values(DEFAULT_LEAGUE_KEEPERS)) {{
  keepers.forEach(k => {{
    const found = ALL.find(x => x.name === k.name) || ALL.find(x => _norm(x.name) === _norm(k.name));
    const nm = found ? found.name : k.name;
    if (!state.drafted[nm]) state.drafted[nm] = {{ time: Date.now(), mine: false }};
  }});
}}
for (const [teamName, rookies] of Object.entries(DEFAULT_LEAGUE_MILB_KEEPERS)) {{
  rookies.forEach(rk => {{
    const found = ALL.find(x => x.name === rk) || ALL.find(x => _norm(x.name) === _norm(rk));
    const nm = found ? found.name : rk;
    if (!state.drafted[nm]) state.drafted[nm] = {{ time: Date.now(), mine: false }};
  }});
}}
save();

// ── Sleepers & Busts buzz from expert articles ───────────────────────────
const BUZZ = {{
  // ── SLEEPERS (up arrows) ──────────────────────────────────────────────
  'Brandon Lowe':       [{{type:'up', src:'CBS', url:'https://www.cbssports.com/fantasy/baseball/news/2026-fantasy-baseball-draft-prep-sleepers-2-0-for-scott-white/'}}],
  'Jonathan Aranda':    [{{type:'up', src:'CBS', url:'https://www.cbssports.com/fantasy/baseball/news/2026-fantasy-baseball-rankings-sleepers-busts-breakouts-from-model-that-nailed-cal-raleighs-massive-season/'}}],
  'Emmet Sheehan':      [{{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}}],
  'Jackson Holliday':   [{{type:'up', src:'FPros', url:'https://www.fantasypros.com/2026/03/14-consensus-sleepers-busts-2026-fantasy-baseball/'}}],
  'Sal Stewart':        [{{type:'up', src:'CBS', url:'https://www.cbssports.com/fantasy/baseball/news/2026-fantasy-baseball-draft-prep-sleepers-1-0-for-scott-white-featuring-sal-stewart-and-kazuma-okamoto/'}}],
  'Jordan Lawlar':      [{{type:'up', src:'SI', url:'https://www.si.com/onsi/fantasy/mlb/2026-fantasy-baseball-30-mlb-teams-30-sleepers-featuring-jordan-lawlar'}}],
  'Jac Caglianone':     [{{type:'up', src:'CBS', url:'https://www.cbssports.com/fantasy/baseball/news/2026-fantasy-baseball-draft-prep-sleepers-2-0-for-scott-white/'}}, {{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}}, {{type:'up', src:'ESPN', url:'https://www.espn.com/mlb/story/_/id/48154579/mlb-2026-breakout-stars-every-team-mcgonigle-caglianone-oviedo-weathers'}}],
  'Bryce Eldridge':     [{{type:'up', src:'CBS', url:'https://www.cbssports.com/fantasy/baseball/news/2026-fantasy-baseball-draft-prep-sleepers-2-0-for-scott-white/'}}],
  'Ceddanne Rafaela':   [{{type:'up', src:'FPros', url:'https://www.fantasypros.com/2026/03/14-consensus-sleepers-busts-2026-fantasy-baseball/'}}],
  'Logan Henderson':    [{{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}}],
  'Luke Keaschall':     [{{type:'up', src:'Yahoo', url:'https://sports.yahoo.com/fantasy/article/2026-fantasy-baseball-adp-risers-3-key-players-moving-the-needle-through-spring-training-174823504.html'}}],
  'Daylen Lile':        [{{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}}],
  'Jasson Dominguez':   [{{type:'up', src:'SI', url:'https://www.si.com/onsi/fantasy/mlb/2026-fantasy-baseball-30-mlb-teams-30-sleepers-featuring-jordan-lawlar'}}],
  'Jacob Wilson':       [{{type:'up', src:'CBS', url:'https://www.cbssports.com/fantasy/baseball/news/fantasy-baseball-rankings-2026-breakouts-from-model-that-called-jacob-wilsons-strong-season/'}}],
  // Athletic — Bat Speed Breakout Hitters (Eno Sarris)
  'Garrett Mitchell':   [{{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}}],
  'Owen Caissie':       [{{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}}],
  'Jordan Walker':      [{{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}}],
  'James Outman':       [{{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}}],
  'Caleb Durbin':       [{{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}}],
  // Athletic — Pitcher Breakouts (Eno Sarris)
  'Eury Pérez':         [{{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}}],
  'Bubba Chandler':     [{{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}}, {{type:'up', src:'SI', url:'https://www.si.com/onsi/fantasy/mlb/2026-fantasy-baseball-30-mlb-teams-30-sleepers-featuring-jordan-lawlar'}}],
  'Shane Baz':          [{{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}}],
  'Joey Cantillo':      [{{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}}, {{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}}, {{type:'up', src:'FPros', url:'https://www.fantasypros.com/2026/03/14-consensus-sleepers-busts-2026-fantasy-baseball/'}}, {{type:'up', src:'Eno', url:'https://theathletic.com/fantasy/baseball/'}}],
  'Cade Cavalli':       [{{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}}],
  'Zebby Matthews':     [{{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}}, {{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}}, {{type:'down', src:'Eno', url:'https://theathletic.com/fantasy/baseball/'}}],
  'Troy Melton':        [{{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}}],
  // Athletic — Bounce-Back Candidates (Al Melchior)
  'Marcus Semien':      [{{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}}],
  'Gleyber Torres':     [{{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}}],
  'Bryan Reynolds':     [{{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}}],
  'Yainer Diaz':        [{{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}}],
  'Aaron Nola':         [{{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}}],
  'Sandy Alcantara':    [{{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}}, {{type:'down', src:'Eno', url:'https://theathletic.com/fantasy/baseball/'}}],
  'Dylan Cease':        [{{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}}],
  // FantasyPros / CBS Stampfl / ESPN / SI — additional sleepers
  'JJ Wetherholt':      [{{type:'up', src:'FPros', url:'https://www.fantasypros.com/2026/03/14-consensus-sleepers-busts-2026-fantasy-baseball/'}}],
  'Masyn Winn':         [{{type:'up', src:'FPros', url:'https://www.fantasypros.com/2026/03/14-consensus-sleepers-busts-2026-fantasy-baseball/'}}],
  'Andrew Vaughn':      [{{type:'up', src:'CBS', url:'https://www.cbssports.com/fantasy/baseball/news/2026-fantasy-baseball-draft-prep-target-trevor-rogers-andrew-vaughn-in-frank-stampfls-sleepers-2-0/'}}],
  'Trevor Rogers':      [{{type:'up', src:'CBS', url:'https://www.cbssports.com/fantasy/baseball/news/2026-fantasy-baseball-draft-prep-target-trevor-rogers-andrew-vaughn-in-frank-stampfls-sleepers-2-0/'}}],
  'Jackson Chourio':    [{{type:'up', src:'ESPN', url:'https://www.espn.com/mlb/story/_/id/48154579/mlb-2026-breakout-stars-every-team-mcgonigle-caglianone-oviedo-weathers'}}],
  'Samuel Basallo':     [{{type:'up', src:'SI', url:'https://www.si.com/onsi/fantasy/mlb/2026-fantasy-baseball-30-mlb-teams-30-sleepers-featuring-jordan-lawlar'}}],
  'Johan Oviedo':       [{{type:'up', src:'ESPN', url:'https://www.espn.com/mlb/story/_/id/48154579/mlb-2026-breakout-stars-every-team-mcgonigle-caglianone-oviedo-weathers'}}],
  // Athletic — SP Sleepers (staff picks)
  'Braxton Ashcraft':   [{{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}}],
  'Max Meyer':          [{{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}}],
  'Ryan Weathers':      [{{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}}],
  'Sean Manaea':        [{{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}}, {{type:'up', src:'Eno', url:'https://theathletic.com/fantasy/baseball/'}}],
  'Cody Ponce':         [{{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}}],
  'Quinn Priester':     [{{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}}],
  'Grayson Rodriguez':  [{{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}}],
  // Athletic — OF Sleepers (Jake Ciely + staff)
  'Wilyer Abreu':       [{{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}}],
  'Cam Smith':          [{{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}}],
  'Adolis Garcia':      [{{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}}],
  'Heliot Ramos':       [{{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}}],
  'Jakob Marsee':       [{{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}}],
  'Trent Grisham':      [{{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}}],
  // Athletic — RP Sleepers (Greg Jewett)
  'Zach Agnos':         [{{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}}],
  'Matt Svanson':       [{{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}}],
  'Tyler Wells':        [{{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}}],

  // ── Eno Sarris Stuff+ model refresh — gains (sleepers) ──────────────
  'Chris Sale':           [{{type:'up', src:'Eno', url:'https://theathletic.com/fantasy/baseball/'}}],
  'José Soriano':         [{{type:'up', src:'Eno', url:'https://theathletic.com/fantasy/baseball/'}}],
  'Logan Gilbert':        [{{type:'up', src:'Eno', url:'https://theathletic.com/fantasy/baseball/'}}],
  'Tarik Skubal':         [{{type:'up', src:'Eno', url:'https://theathletic.com/fantasy/baseball/'}}],
  'Blake Snell':          [{{type:'up', src:'Eno', url:'https://theathletic.com/fantasy/baseball/'}}],
  'Matthew Boyd':         [{{type:'up', src:'Eno', url:'https://theathletic.com/fantasy/baseball/'}}],
  'Jacob Lopez':          [{{type:'up', src:'Eno', url:'https://theathletic.com/fantasy/baseball/'}}],
  // ── Eno Sarris Stuff+ model refresh — drops (busts) ───────────────
  'Aaron Civale':         [{{type:'down', src:'Eno', url:'https://theathletic.com/fantasy/baseball/'}}],
  'Luis Severino':        [{{type:'down', src:'Eno', url:'https://theathletic.com/fantasy/baseball/'}}],
  'Frankie Montas':       [{{type:'down', src:'Eno', url:'https://theathletic.com/fantasy/baseball/'}}],
  'Lance McCullers Jr.':  [{{type:'down', src:'Eno', url:'https://theathletic.com/fantasy/baseball/'}}],
  'Tomoyuki Sugano':      [{{type:'down', src:'Eno', url:'https://theathletic.com/fantasy/baseball/'}}],
  'Clay Holmes':          [{{type:'down', src:'Eno', url:'https://theathletic.com/fantasy/baseball/'}}],
  'Drew Rasmussen':       [{{type:'down', src:'Eno', url:'https://theathletic.com/fantasy/baseball/'}}],
  // ── BUSTS (down arrows) ───────────────────────────────────────────────
  'Mookie Betts':       [{{type:'down', src:'CBS', url:'https://www.cbssports.com/fantasy/baseball/news/fantasy-baseball-rankings-2026-busts-by-proven-mlb-model-that-called-spencer-striders-disappointing-year/'}}, {{type:'down', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}}],
  'Pete Alonso':        [{{type:'down', src:'CBS', url:'https://www.cbssports.com/fantasy/baseball/news/fantasy-baseball-rankings-2026-busts-by-proven-mlb-model-that-called-spencer-striders-disappointing-year/'}}],
  'Luis Robert Jr.':    [{{type:'down', src:'FPros', url:'https://www.fantasypros.com/2026/03/14-consensus-sleepers-busts-2026-fantasy-baseball/'}}],
  'Spencer Strider':    [{{type:'down', src:'CBS', url:'https://www.cbssports.com/fantasy/baseball/news/2026-fantasy-baseball-draft-prep-busts-2-0-for-scott-white-adds-james-wood-spencer-strider-to-the-mix/'}}],
  'Alex Bregman':       [{{type:'down', src:'CBS', url:'https://www.cbssports.com/fantasy/baseball/news/2026-fantasy-baseball-draft-prep-busts-2-0-for-scott-white-adds-james-wood-spencer-strider-to-the-mix/'}}],
  'Jarren Duran':       [{{type:'down', src:'CBS', url:'https://www.cbssports.com/fantasy/baseball/news/2026-fantasy-baseball-draft-prep-fade-nick-kurtz-jarren-duran-in-frank-stampfls-busts-2-0/'}}],
  'Sonny Gray':         [{{type:'down', src:'CBS', url:'https://www.cbssports.com/fantasy/baseball/news/2026-fantasy-baseball-draft-prep-fade-nick-kurtz-jarren-duran-in-frank-stampfls-busts-2-0/'}}, {{type:'up', src:'Eno', url:'https://theathletic.com/fantasy/baseball/'}}],
  'Bryce Harper':       [{{type:'down', src:'Yahoo', url:'https://sports.yahoo.com/articles/top-5-fantasy-baseball-first-204652569.html'}}],
  'Josh Naylor':        [{{type:'down', src:'Yahoo', url:'https://sports.yahoo.com/articles/top-5-fantasy-baseball-first-204652569.html'}}],
  'Francisco Lindor':   [{{type:'down', src:'Yahoo', url:'https://sports.yahoo.com/articles/top-5-fantasy-baseball-shortstop-044912384.html'}}],
  'Trea Turner':        [{{type:'down', src:'Yahoo', url:'https://sports.yahoo.com/articles/top-5-fantasy-baseball-shortstop-044912384.html'}}],
  'Teoscar Hernandez':  [{{type:'down', src:'Yahoo', url:'https://sports.yahoo.com/articles/top-5-fantasy-baseball-outfielder-182716680.html'}}],
  'Christian Yelich':   [{{type:'down', src:'Yahoo', url:'https://sports.yahoo.com/articles/top-5-fantasy-baseball-outfielder-182716680.html'}}],
  'Mark Vientos':       [{{type:'down', src:'Yahoo', url:'https://sports.yahoo.com/articles/top-5-fantasy-baseball-third-161534983.html'}}],
  'Alec Bohm':          [{{type:'down', src:'Yahoo', url:'https://sports.yahoo.com/articles/top-5-fantasy-baseball-third-161534983.html'}}],
  'Royce Lewis':        [{{type:'down', src:'Yahoo', url:'https://sports.yahoo.com/articles/top-5-fantasy-baseball-third-161534983.html'}}],
  'Cole Ragans':        [{{type:'down', src:'Yahoo', url:'https://sports.yahoo.com/articles/top-5-fantasy-baseball-starting-175712493.html'}}, {{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}}],
  'Nick Kurtz':         [{{type:'down', src:'CBS', url:'https://www.cbssports.com/fantasy/baseball/news/2026-fantasy-baseball-draft-prep-fade-nick-kurtz-jarren-duran-in-frank-stampfls-busts-2-0/'}}],
  'James Wood':         [{{type:'down', src:'CBS', url:'https://www.cbssports.com/fantasy/baseball/news/2026-fantasy-baseball-draft-prep-busts-2-0-for-scott-white-adds-james-wood-spencer-strider-to-the-mix/'}}, {{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}}],
  'Jose Altuve':        [{{type:'down', src:'FPros', url:'https://www.fantasypros.com/2026/03/14-consensus-sleepers-busts-2026-fantasy-baseball/'}}],
  'Oneil Cruz':         [{{type:'down', src:'FPros', url:'https://www.fantasypros.com/2026/03/14-consensus-sleepers-busts-2026-fantasy-baseball/'}}]
}};

// Auto-tag from BUZZ: sleeper (up) / bust (down) — only if user hasn't manually tagged
for (const [name, items] of Object.entries(BUZZ)) {{
  if (state.tags[name]) continue; // user already tagged — respect their choice
  const hasUp = items.some(b => b.type === 'up');
  const hasDown = items.some(b => b.type === 'down');
  // If has both up and down, don't auto-tag (conflicting signals)
  if (hasUp && !hasDown) state.tags[name] = 'sleeper';
  else if (hasDown && !hasUp) state.tags[name] = 'bust';
}}

// Auto-tag major injuries as IL — only if user hasn't manually tagged
const IL_PLAYERS = [
  'Anthony Santander', 'Francisco Lindor', 'Anthony Volpe', 'Jordan Westburg',
  'Hunter Greene', 'Spencer Schwellenbach', 'Gerrit Cole', 'Joe Musgrove',
  'Jared Jones', 'Josh Hader', 'Justin Steele', 'Carlos Rodón',
  'Bryce Miller', 'Bryan Hoeing', 'Corbin Burnes', 'Bowden Francis',
  'Clarke Schmidt', 'Shane Bieber'
];
IL_PLAYERS.forEach(name => {{
  if (!state.tags[name]) state.tags[name] = 'injured';
}});

// ── Draft position (snake draft) ─────────────────────────────────────────
const DRAFT_POS = 2;  // 2nd overall pick
const TEAMS = 12;
function myPickInRound(rd) {{
  // Snake: odd rounds pick from top, even rounds pick from bottom
  return rd % 2 === 1 ? DRAFT_POS : (TEAMS - DRAFT_POS + 1);
}}
function overallPick(rd) {{
  return (rd - 1) * TEAMS + myPickInRound(rd);
}}

// ── Position needs config (updated for LF/CF/RF) ─────────────────────────
const BASE_MULT = {{C:1.0,'1B':0.4,'2B':1.2,'3B':1.2,SS:0.7,LF:1.0,CF:1.0,RF:1.0,DH:0.4,SP:1.0,RP:1.0}};
const SCARCITY = {{C:1.25,'1B':0.85,'2B':1.0,'3B':1.0,SS:1.0,LF:0.9,CF:0.95,RF:0.85,DH:0.75,SP:1.0,RP:1.15}};
const ROSTER_SLOTS = {{C:1,'1B':1,'2B':1,'3B':1,SS:1,LF:1,CF:1,RF:1,DH:1,SP:5,RP:5}};

function getPosMult() {{
  const counts = {{}};
  state.myTeam.forEach(n => {{
    const p = ALL.find(x => x.name === n);
    if (p) {{ const pos = p.primaryPos; counts[pos] = (counts[pos]||0) + 1; }}
  }});
  const mult = {{}};
  for (const [pos, base] of Object.entries(BASE_MULT)) {{
    const have = counts[pos] || 0;
    const need = ROSTER_SLOTS[pos] || 1;
    if (have >= need) mult[pos] = Math.max(0.2, base * 0.3);
    else if (have >= need * 0.5) mult[pos] = base * 0.7;
    else mult[pos] = base;
  }}
  return mult;
}}

function recalcPNAV() {{
  const mult = getPosMult();
  ALL.forEach(p => {{
    // For hitters, PNAV = best value across all eligible positions INCLUDING DH
    if (p.type === 'bat') {{
      const positions = (p.elig || p.primaryPos || 'DH').split('/');
      if (!positions.includes('DH')) positions.push('DH');
      let best = 0;
      positions.forEach(pos => {{
        const pm = mult[pos] || 1;
        const sc = SCARCITY[pos] || 1;
        const v = p.lcv * pm * sc;
        if (v > best) best = v;
      }});
      p.pnav = Math.round(best * 100) / 100;
    }} else {{
      const pm = mult[p.primaryPos] || 1;
      const sc = SCARCITY[p.primaryPos] || 1;
      p.pnav = Math.round(p.lcv * pm * sc * 100) / 100;
    }}
    p.upside = Math.round(p.lcv * p.ageFactor * 100) / 100;
    p.dp = Math.round((0.4 * p.lcv + 0.6 * p.pnav) * 100) / 100;
  }});
}}

// ── Tab management ────────────────────────────────────────────────────────
let currentTab = 'all';
const tabs = document.querySelectorAll('.tab');
tabs.forEach(t => t.addEventListener('click', () => {{
  tabs.forEach(x => x.classList.remove('active'));
  t.classList.add('active');
  currentTab = t.dataset.tab;
  // Sync filterType from tab
  if (currentTab === 'bat') {{ filterType = 'bat'; currentTab = 'all'; }}
  else if (currentTab === 'pit') {{ filterType = 'pit'; currentTab = 'all'; }}
  else if (currentTab === 'all') {{ filterType = 'all'; }}
  render();
}}));

// ── Mode toggle (Draft vs Season) ─────────────────────────────────────────
if (!state._mode) state._mode = 'draft';
const DRAFT_TABS = ['all','bat','pit','roster','board','mock','league'];
const SEASON_TABS = ['all','bat','pit','roster','league'];

function updateModeUI() {{
  const isDraft = state._mode === 'draft';
  const draftBtn = document.getElementById('modeDraft');
  const seasonBtn = document.getElementById('modeSeason');
  if (draftBtn) {{
    draftBtn.style.background = isDraft ? 'var(--accent)' : 'var(--surface2)';
    draftBtn.style.color = isDraft ? '#fff' : 'var(--text)';
    draftBtn.style.border = isDraft ? '1px solid transparent' : '1px solid var(--border)';
  }}
  if (seasonBtn) {{
    seasonBtn.style.background = !isDraft ? 'var(--accent)' : 'var(--surface2)';
    seasonBtn.style.color = !isDraft ? '#fff' : 'var(--text)';
    seasonBtn.style.border = !isDraft ? '1px solid transparent' : '1px solid var(--border)';
  }}
  // Show/hide tabs based on mode
  document.querySelectorAll('.tab').forEach(t => {{
    const tab = t.dataset.tab;
    const activeTabs = isDraft ? DRAFT_TABS : SEASON_TABS;
    t.style.display = activeTabs.includes(tab) ? '' : 'none';
    // In season mode, reorder visually by adjusting flex order
    t.style.order = activeTabs.indexOf(tab);
  }});
}}
document.getElementById('modeDraft').addEventListener('click', () => {{
  state._mode = 'draft'; save(); updateModeUI();
  // If current tab is hidden, switch to default
  if (!DRAFT_TABS.includes(currentTab)) {{
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    currentTab = 'all';
    const allTab = document.querySelector('.tab[data-tab="all"]');
    if (allTab) allTab.classList.add('active');
    render();
  }}
}});
document.getElementById('modeSeason').addEventListener('click', () => {{
  state._mode = 'season'; save(); updateModeUI();
  if (!SEASON_TABS.includes(currentTab)) {{
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    currentTab = 'roster';
    const rTab = document.querySelector('.tab[data-tab="roster"]');
    if (rTab) rTab.classList.add('active');
    render();
  }}
}});
updateModeUI();

// ── Sorting ───────────────────────────────────────────────────────────────
let sortCol = 'dp', sortDir = -1;

// ── Filters ───────────────────────────────────────────────────────────────
let filterPos = 'ALL';
let filterType = 'all'; // 'all', 'bat', 'pit'
const posGroups = {{ all: ['ALL','C','1B','2B','3B','SS','LF','CF','RF','DH','SP','RP'],
                    bat: ['ALL','C','1B','2B','3B','SS','LF','CF','RF','DH'],
                    pit: ['ALL','SP','RP'] }};

function syncNavTabs() {{
  // Highlight the correct nav tab based on filterType
  const tabMap = {{ all: 'all', bat: 'bat', pit: 'pit' }};
  const targetTab = tabMap[filterType] || 'all';
  document.querySelectorAll('.tab').forEach(t => {{
    if (['all','bat','pit'].includes(t.dataset.tab)) {{
      t.classList.toggle('active', t.dataset.tab === targetTab);
    }}
  }});
}}

function buildTypeFilters() {{
  const container = document.getElementById('typeFilters');
  container.innerHTML = '';
  ['all','bat','pit'].forEach(t => {{
    const btn = document.createElement('button');
    btn.className = 'filter-btn' + (t === filterType ? ' active' : '');
    btn.textContent = t === 'all' ? 'All' : t === 'bat' ? 'Hitters' : 'Pitchers';
    btn.onclick = () => {{ filterType = t; filterPos = 'ALL'; syncNavTabs(); render(); }};
    container.appendChild(btn);
  }});
}}

function buildPosFilters() {{
  buildTypeFilters();
  const container = document.getElementById('posFilters');
  container.innerHTML = '';
  const group = filterType === 'pit' ? 'pit' : filterType === 'bat' ? 'bat' : 'all';
  posGroups[group].forEach(pos => {{
    const btn = document.createElement('button');
    btn.className = 'filter-btn' + (pos === filterPos ? ' active' : '');
    btn.textContent = pos;
    btn.onclick = () => {{ filterPos = pos; render(); }};
    container.appendChild(btn);
  }});
}}

// ── View toggle ──────────────────────────────────────────────────────────
let currentView = 'main'; // 'main', 's25', 'p26', 's26', 'avp'

// ── Column definitions ────────────────────────────────────────────────────
// 2025 Stats columns
const trendTip = 'Trend = how 2026 projections compare to 2025 actuals across all league categories. Positive (green) = projecting improvement, negative (red) = projecting decline. Computed as sum of z-scored deltas across AVG/OBP/SLG/HR/R/RBI/SB/K (batters) or ERA/WHIP/K/W/SV/HD/HRA/QS (pitchers).';
const batCols25 = [
  {{key:'name',label:'Player',w:160}}, {{key:'team',label:'Team',w:50}}, {{key:'pos',label:'Pos',w:60}},
  {{key:'age',label:'Age',w:40}}, {{key:'dp',label:'Pick',w:55,cls:'pnav-col'}},
  {{key:'trend',label:'Trend',w:60,cls:'pnav-col',tip:trendTip}},
  {{key:'s25_pa',label:'PA',w:50}}, {{key:'s25_avg',label:'AVG',w:55}}, {{key:'s25_obp',label:'OBP',w:55}},
  {{key:'s25_slg',label:'SLG',w:55}}, {{key:'s25_hr',label:'HR',w:45}}, {{key:'s25_r',label:'R',w:45}},
  {{key:'s25_rbi',label:'RBI',w:45}}, {{key:'s25_sb',label:'SB',w:45}}, {{key:'s25_so',label:'K',w:45}},
  {{key:'s25_barrel',label:'Brl%',w:50}}, {{key:'s25_hardhit',label:'HH%',w:50}},
  {{key:'s25_woba',label:'wOBA',w:55}}, {{key:'s25_xwoba',label:'xwOBA',w:55}},
  {{key:'s25_delta',label:'xw\u0394',w:50,tip:'xwOBA minus wOBA. Positive = underperforming (unlucky), negative = overperforming (lucky)'}}
];
const pitCols25 = [
  {{key:'name',label:'Player',w:160}}, {{key:'team',label:'Team',w:50}}, {{key:'pos',label:'Pos',w:50}},
  {{key:'age',label:'Age',w:40}}, {{key:'dp',label:'Pick',w:55,cls:'pnav-col'}},
  {{key:'trend',label:'Trend',w:60,cls:'pnav-col',tip:trendTip}},
  {{key:'s25_ip',label:'IP',w:50}}, {{key:'s25_era',label:'ERA',w:55}}, {{key:'s25_whip',label:'WHIP',w:60}},
  {{key:'s25_so',label:'K',w:50}}, {{key:'s25_w',label:'W',w:40}}, {{key:'s25_sv',label:'SV',w:40}},
  {{key:'s25_hld',label:'HD',w:40}}, {{key:'s25_qs',label:'QS',w:40}}, {{key:'s25_hr',label:'HRA',w:45}},
  {{key:'s25_stuff',label:'Stf+',w:50,tip:'Stuff+ measures pitch quality based on movement/velo. 100=avg'}},
  {{key:'s25_loc',label:'Loc+',w:50,tip:'Location+ measures command/control. 100=avg'}},
  {{key:'s25_pitching',label:'Pit+',w:50,tip:'Pitching+ combines Stuff+ and Location+. 100=avg'}}
];
// Unified All-tab columns for 2025: bat+pit stats in one row (non-applicable show —)
const allCols25 = [
  {{key:'name',label:'Player',w:160}}, {{key:'team',label:'Team',w:50}}, {{key:'pos',label:'Pos',w:60}},
  {{key:'type',label:'Type',w:50}}, {{key:'age',label:'Age',w:40}}, {{key:'dp',label:'Pick',w:55,cls:'pnav-col'}},
  {{key:'trend',label:'Trend',w:55,cls:'pnav-col',tip:trendTip}},
  {{key:'s25_pa',label:'PA',w:45}}, {{key:'s25_avg',label:'AVG',w:50}}, {{key:'s25_obp',label:'OBP',w:50}},
  {{key:'s25_slg',label:'SLG',w:50}}, {{key:'s25_r',label:'R',w:38}}, {{key:'s25_rbi',label:'RBI',w:38}},
  {{key:'s25_sb',label:'SB',w:38}}, {{key:'s25_hr',label:'HR',w:38}}, {{key:'s25_so',label:'K',w:38}},
  {{key:'s25_ip',label:'IP',w:45}}, {{key:'s25_era',label:'ERA',w:50}}, {{key:'s25_whip',label:'WHIP',w:55}},
  {{key:'s25_w',label:'W',w:38}}, {{key:'s25_sv',label:'SV',w:38}},
  {{key:'s25_hld',label:'HD',w:38}}, {{key:'s25_qs',label:'QS',w:38}},
  {{key:'s25_barrel',label:'Brl%',w:48}}, {{key:'s25_hardhit',label:'HH%',w:48}},
  {{key:'s25_woba',label:'wOBA',w:50}}, {{key:'s25_xwoba',label:'xwOBA',w:52}},
  {{key:'s25_delta',label:'xw\u0394',w:48,tip:'xwOBA minus wOBA. Positive = underperforming (unlucky), negative = overperforming (lucky)'}},
  {{key:'s25_stuff',label:'Stf+',w:48,tip:'Stuff+ measures pitch quality. 100=avg'}},
  {{key:'s25_loc',label:'Loc+',w:48,tip:'Location+. 100=avg'}},
  {{key:'s25_pitching',label:'Pit+',w:48,tip:'Pitching+ combined. 100=avg'}}
];

// 2026 Projected columns (same stats as main but without analytics clutter)
const batCols26 = [
  {{key:'name',label:'Player',w:160}}, {{key:'team',label:'Team',w:50}}, {{key:'pos',label:'Pos',w:60}},
  {{key:'age',label:'Age',w:40}}, {{key:'dp',label:'Pick',w:55,cls:'pnav-col'}},
  {{key:'trend',label:'Trend',w:60,cls:'pnav-col',tip:trendTip}},
  {{key:'pa',label:'PA',w:50}}, {{key:'avg',label:'AVG',w:55}}, {{key:'obp',label:'OBP',w:55}},
  {{key:'slg',label:'SLG',w:55}}, {{key:'hr',label:'HR',w:45}}, {{key:'r',label:'R',w:45}},
  {{key:'rbi',label:'RBI',w:45}}, {{key:'sb',label:'SB',w:45}}, {{key:'so',label:'K',w:45}}
];
const pitCols26 = [
  {{key:'name',label:'Player',w:160}}, {{key:'team',label:'Team',w:50}}, {{key:'pos',label:'Pos',w:50}},
  {{key:'age',label:'Age',w:40}}, {{key:'dp',label:'Pick',w:55,cls:'pnav-col'}},
  {{key:'trend',label:'Trend',w:60,cls:'pnav-col',tip:trendTip}},
  {{key:'ip',label:'IP',w:50}}, {{key:'era',label:'ERA',w:55}}, {{key:'whip',label:'WHIP',w:60}},
  {{key:'so',label:'K',w:50}}, {{key:'w',label:'W',w:40}}, {{key:'sv',label:'SV',w:40}},
  {{key:'hld',label:'HD',w:40}}, {{key:'qs',label:'QS',w:40}}, {{key:'hr',label:'HRA',w:45}}
];
// Unified All-tab columns for 2026: bat+pit stats in one row
const allCols26 = [
  {{key:'name',label:'Player',w:160}}, {{key:'team',label:'Team',w:50}}, {{key:'pos',label:'Pos',w:60}},
  {{key:'type',label:'Type',w:50}}, {{key:'age',label:'Age',w:40}}, {{key:'dp',label:'Pick',w:55,cls:'pnav-col'}},
  {{key:'trend',label:'Trend',w:55,cls:'pnav-col',tip:trendTip}},
  {{key:'pa',label:'PA',w:45}}, {{key:'avg',label:'AVG',w:50}}, {{key:'obp',label:'OBP',w:50}},
  {{key:'slg',label:'SLG',w:50}}, {{key:'r',label:'R',w:38}}, {{key:'rbi',label:'RBI',w:38}},
  {{key:'sb',label:'SB',w:38}}, {{key:'hr',label:'HR',w:38}}, {{key:'so',label:'K',w:38}},
  {{key:'ip',label:'IP',w:45}}, {{key:'era',label:'ERA',w:50}}, {{key:'whip',label:'WHIP',w:55}},
  {{key:'w',label:'W',w:38}}, {{key:'sv',label:'SV',w:38}},
  {{key:'hld',label:'HD',w:38}}, {{key:'qs',label:'QS',w:38}}
];

// 2026 Actual stats columns (s26_ prefixed data)
const batCols26A = [
  {{key:'name',label:'Player',w:160}}, {{key:'team',label:'Team',w:50}}, {{key:'pos',label:'Pos',w:60}},
  {{key:'age',label:'Age',w:40}}, {{key:'lcv',label:'LCV',w:55}},
  {{key:'s26_pa',label:'PA',w:50}}, {{key:'s26_avg',label:'AVG',w:55}}, {{key:'s26_obp',label:'OBP',w:55}},
  {{key:'s26_slg',label:'SLG',w:55}}, {{key:'s26_hr',label:'HR',w:45}}, {{key:'s26_r',label:'R',w:45}},
  {{key:'s26_rbi',label:'RBI',w:45}}, {{key:'s26_sb',label:'SB',w:45}}, {{key:'s26_so',label:'K',w:45}}
];
const pitCols26A = [
  {{key:'name',label:'Player',w:160}}, {{key:'team',label:'Team',w:50}}, {{key:'pos',label:'Pos',w:50}},
  {{key:'age',label:'Age',w:40}}, {{key:'lcv',label:'LCV',w:55}},
  {{key:'s26_ip',label:'IP',w:50}}, {{key:'s26_era',label:'ERA',w:55}}, {{key:'s26_whip',label:'WHIP',w:60}},
  {{key:'s26_so',label:'K',w:50}}, {{key:'s26_w',label:'W',w:40}}, {{key:'s26_sv',label:'SV',w:40}},
  {{key:'s26_hld',label:'HD',w:40}}, {{key:'s26_qs',label:'QS',w:40}}, {{key:'s26_hr',label:'HRA',w:45}}
];
const allCols26A = [
  {{key:'name',label:'Player',w:160}}, {{key:'team',label:'Team',w:50}}, {{key:'pos',label:'Pos',w:60}},
  {{key:'type',label:'Type',w:50}}, {{key:'age',label:'Age',w:40}}, {{key:'lcv',label:'LCV',w:55}},
  {{key:'s26_pa',label:'PA',w:45}}, {{key:'s26_avg',label:'AVG',w:50}}, {{key:'s26_obp',label:'OBP',w:50}},
  {{key:'s26_slg',label:'SLG',w:50}}, {{key:'s26_r',label:'R',w:38}}, {{key:'s26_rbi',label:'RBI',w:38}},
  {{key:'s26_sb',label:'SB',w:38}}, {{key:'s26_hr',label:'HR',w:38}}, {{key:'s26_so',label:'K',w:38}},
  {{key:'s26_ip',label:'IP',w:45}}, {{key:'s26_era',label:'ERA',w:50}}, {{key:'s26_whip',label:'WHIP',w:55}},
  {{key:'s26_w',label:'W',w:38}}, {{key:'s26_sv',label:'SV',w:38}},
  {{key:'s26_hld',label:'HD',w:38}}, {{key:'s26_qs',label:'QS',w:38}}
];

// Actual vs Projected comparison columns (side by side: proj then actual then delta)
const batColsAVP = [
  {{key:'name',label:'Player',w:150}}, {{key:'pos',label:'Pos',w:50}},
  {{key:'lcv',label:'LCV',w:50}},
  {{key:'pa',label:'pPA',w:45,tip:'Projected PA'}}, {{key:'s26_pa',label:'aPA',w:45,tip:'Actual PA'}},
  {{key:'avg',label:'pAVG',w:52,tip:'Projected AVG'}}, {{key:'s26_avg',label:'aAVG',w:52,tip:'Actual AVG'}},
  {{key:'obp',label:'pOBP',w:52,tip:'Projected OBP'}}, {{key:'s26_obp',label:'aOBP',w:52,tip:'Actual OBP'}},
  {{key:'slg',label:'pSLG',w:52,tip:'Projected SLG'}}, {{key:'s26_slg',label:'aSLG',w:52,tip:'Actual SLG'}},
  {{key:'hr',label:'pHR',w:40,tip:'Projected HR'}}, {{key:'s26_hr',label:'aHR',w:40,tip:'Actual HR'}},
  {{key:'r',label:'pR',w:38,tip:'Projected R'}}, {{key:'s26_r',label:'aR',w:38,tip:'Actual R'}},
  {{key:'rbi',label:'pRBI',w:40,tip:'Projected RBI'}}, {{key:'s26_rbi',label:'aRBI',w:40,tip:'Actual RBI'}},
  {{key:'sb',label:'pSB',w:38,tip:'Projected SB'}}, {{key:'s26_sb',label:'aSB',w:38,tip:'Actual SB'}}
];
const pitColsAVP = [
  {{key:'name',label:'Player',w:150}}, {{key:'pos',label:'Pos',w:50}},
  {{key:'lcv',label:'LCV',w:50}},
  {{key:'ip',label:'pIP',w:45,tip:'Projected IP'}}, {{key:'s26_ip',label:'aIP',w:45,tip:'Actual IP'}},
  {{key:'era',label:'pERA',w:50,tip:'Projected ERA'}}, {{key:'s26_era',label:'aERA',w:50,tip:'Actual ERA'}},
  {{key:'whip',label:'pWHIP',w:55,tip:'Projected WHIP'}}, {{key:'s26_whip',label:'aWHIP',w:55,tip:'Actual WHIP'}},
  {{key:'so',label:'pK',w:40,tip:'Projected K'}}, {{key:'s26_so',label:'aK',w:40,tip:'Actual K'}},
  {{key:'w',label:'pW',w:38,tip:'Projected W'}}, {{key:'s26_w',label:'aW',w:38,tip:'Actual W'}},
  {{key:'sv',label:'pSV',w:38,tip:'Projected SV'}}, {{key:'s26_sv',label:'aSV',w:38,tip:'Actual SV'}},
  {{key:'hld',label:'pHD',w:38,tip:'Projected HD'}}, {{key:'s26_hld',label:'aHD',w:38,tip:'Actual HD'}},
  {{key:'qs',label:'pQS',w:38,tip:'Projected QS'}}, {{key:'s26_qs',label:'aQS',w:38,tip:'Actual QS'}}
];
const allColsAVP = [
  {{key:'name',label:'Player',w:150}}, {{key:'pos',label:'Pos',w:50}},
  {{key:'type',label:'Type',w:45}}, {{key:'lcv',label:'LCV',w:50}},
  {{key:'avg',label:'pAVG',w:48,tip:'Projected'}}, {{key:'s26_avg',label:'aAVG',w:48,tip:'Actual'}},
  {{key:'hr',label:'pHR',w:38,tip:'Projected'}}, {{key:'s26_hr',label:'aHR',w:38,tip:'Actual'}},
  {{key:'r',label:'pR',w:36,tip:'Projected'}}, {{key:'s26_r',label:'aR',w:36,tip:'Actual'}},
  {{key:'rbi',label:'pRBI',w:38,tip:'Projected'}}, {{key:'s26_rbi',label:'aRBI',w:38,tip:'Actual'}},
  {{key:'sb',label:'pSB',w:36,tip:'Projected'}}, {{key:'s26_sb',label:'aSB',w:36,tip:'Actual'}},
  {{key:'era',label:'pERA',w:48,tip:'Projected'}}, {{key:'s26_era',label:'aERA',w:48,tip:'Actual'}},
  {{key:'whip',label:'pWHIP',w:52,tip:'Projected'}}, {{key:'s26_whip',label:'aWHIP',w:52,tip:'Actual'}},
  {{key:'sv',label:'pSV',w:36,tip:'Projected'}}, {{key:'s26_sv',label:'aSV',w:36,tip:'Actual'}}
];

// Main (analytics) columns
const batCols = [
  {{key:'name',label:'Player',w:160}}, {{key:'team',label:'Team',w:50}}, {{key:'pos',label:'Pos',w:60}},
  {{key:'war',label:'WAR',w:50}},
  {{key:'dp',label:'Pick',w:60,cls:'pnav-col',tip:'Draft Priority = 0.4×LCV + 0.6×PNAV. Single metric combining raw value with positional need. Higher = pick this player. Updates in real-time as you draft.'}},
  {{key:'lcv',label:'LCV',w:60,cls:'lcv-col',tip:'League Category Value = sum of z-scores across all 8 batting categories your league uses: z(AVG) + z(HR) + z(OBP) + z(SLG) + z(R) + z(RBI) + z(SB) − z(K). Higher = more valuable to your league.'}},
  {{key:'upside',label:'Upside',w:65,cls:'pnav-col',tip:'UPSIDE = LCV × Age Factor. Raw value weighted by age — young players (≤24) get up to 35%% boost; older players (32+) get penalized. Position-agnostic long-term ceiling.'}},
  {{key:'trend',label:'Trend',w:60,cls:'pnav-col',tip:trendTip}},
  {{key:'s25_barrel',label:'Brl%',w:50}}, {{key:'s25_hardhit',label:'HH%',w:50}},
  {{key:'s25_woba',label:'wOBA',w:55}}, {{key:'s25_xwoba',label:'xwOBA',w:55}},
  {{key:'s25_delta',label:'xw\u0394',w:50,tip:'xwOBA minus wOBA. Positive = underperforming (unlucky), negative = overperforming (lucky)'}},
  {{key:'pa',label:'PA',w:50}}, {{key:'avg',label:'AVG',w:55}}, {{key:'obp',label:'OBP',w:55}},
  {{key:'slg',label:'SLG',w:55}}, {{key:'hr',label:'HR',w:45}}, {{key:'r',label:'R',w:45}},
  {{key:'rbi',label:'RBI',w:45}}, {{key:'sb',label:'SB',w:45}}, {{key:'so',label:'K',w:45}}
];
const pitCols = [
  {{key:'name',label:'Player',w:160}}, {{key:'team',label:'Team',w:50}}, {{key:'pos',label:'Pos',w:50}},
  {{key:'war',label:'WAR',w:50}},
  {{key:'dp',label:'Pick',w:60,cls:'pnav-col',tip:'Draft Priority = 0.4×LCV + 0.6×PNAV. Single metric combining raw value with positional need. Higher = pick this player. Updates in real-time as you draft.'}},
  {{key:'lcv',label:'LCV',w:60,cls:'lcv-col',tip:'League Category Value = sum of z-scores across all 8 pitching categories: −z(ERA) + z(HD) − z(HRA) + z(K) + z(SV) + z(W) − z(WHIP) + z(QS). Higher = more valuable.'}},
  {{key:'upside',label:'Upside',w:65,cls:'pnav-col',tip:'UPSIDE = LCV × Age Factor. Raw value weighted by age — young players (≤24) get up to 35%% boost; older players (32+) get penalized. Position-agnostic long-term ceiling.'}},
  {{key:'trend',label:'Trend',w:60,cls:'pnav-col',tip:trendTip}},
  {{key:'s25_stuff',label:'Stf+',w:50,tip:'Stuff+ measures pitch quality based on movement/velo. 100=avg'}},
  {{key:'s25_loc',label:'Loc+',w:50,tip:'Location+ measures command/control. 100=avg'}},
  {{key:'s25_pitching',label:'Pit+',w:50,tip:'Pitching+ combines Stuff+ and Location+. 100=avg'}},
  {{key:'ip',label:'IP',w:50}}, {{key:'era',label:'ERA',w:55}}, {{key:'whip',label:'WHIP',w:60}},
  {{key:'so',label:'K',w:50}}, {{key:'w',label:'W',w:40}}, {{key:'sv',label:'SV',w:40}},
  {{key:'hld',label:'HD',w:40}}, {{key:'qs',label:'QS',w:40}}, {{key:'hr',label:'HRA',w:45}}
];
const allCols = [
  {{key:'name',label:'Player',w:160}}, {{key:'team',label:'Team',w:50}}, {{key:'pos',label:'Pos',w:60}},
  {{key:'type',label:'Type',w:50}}, {{key:'age',label:'Age',w:40}},
  {{key:'war',label:'WAR',w:50}},
  {{key:'dp',label:'Pick',w:60,cls:'pnav-col',tip:'Draft Priority = 0.4×LCV + 0.6×PNAV. The single "who should I pick" metric. Higher = pick this player first. Updates in real-time as you draft.'}},
  {{key:'lcv',label:'LCV',w:60,cls:'lcv-col',tip:'League Category Value — z-score sum across all counted league categories (8 batting or 8 pitching). Higher = more valuable to your league scoring.'}},
  {{key:'pnav',label:'PNAV',w:65,cls:'pnav-col',tip:'Positional Need-Adjusted Value = LCV × Position Multiplier × Scarcity Factor. Updates dynamically as you draft players and your positional needs change.'}},
  {{key:'upside',label:'Upside',w:65,cls:'pnav-col',tip:'UPSIDE = LCV × Age Factor. Raw value weighted by age — young players get boosted, older players penalized. Position-agnostic long-term ceiling.'}},
  {{key:'trend',label:'Trend',w:60,cls:'pnav-col',tip:trendTip}},
  {{key:'s25_barrel',label:'Brl%',w:48}}, {{key:'s25_hardhit',label:'HH%',w:48}},
  {{key:'s25_woba',label:'wOBA',w:50}}, {{key:'s25_xwoba',label:'xwOBA',w:52}},
  {{key:'s25_delta',label:'xw\u0394',w:48,tip:'xwOBA minus wOBA. Positive = underperforming (unlucky), negative = overperforming (lucky)'}},
  {{key:'s25_stuff',label:'Stf+',w:48,tip:'Stuff+ measures pitch quality. 100=avg'}},
  {{key:'s25_loc',label:'Loc+',w:48,tip:'Location+. 100=avg'}},
  {{key:'s25_pitching',label:'Pit+',w:48,tip:'Pitching+ combined. 100=avg'}}
];

function getCols() {{
  if (currentView === 's25') {{
    if (filterType === 'bat') return batCols25;
    if (filterType === 'pit') return pitCols25;
    return allCols25;
  }}
  if (currentView === 'p26') {{
    if (filterType === 'bat') return batCols26;
    if (filterType === 'pit') return pitCols26;
    return allCols26;
  }}
  if (currentView === 's26') {{
    if (filterType === 'bat') return batCols26A;
    if (filterType === 'pit') return pitCols26A;
    return allCols26A;
  }}
  if (currentView === 'avp') {{
    if (filterType === 'bat') return batColsAVP;
    if (filterType === 'pit') return pitColsAVP;
    return allColsAVP;
  }}
  // main/analytics view
  if (filterType === 'bat') return batCols;
  if (filterType === 'pit') return pitCols;
  return allCols;
}}

// ── Live Sidebar (roster + league LCV on main draft board) ──────────────
function renderLiveSidebar() {{
  const sidebar = document.getElementById('liveSidebar');
  if (!sidebar) return;
  const myTeam = state.myTeam || [];
  const myKeepNames = new Set(state.keepers || []);
  const rosterSlots = {{C:1,'1B':1,'2B':1,'3B':1,SS:1,LF:1,CF:1,RF:1,DH:1,SP:5,RP:5}};
  const rosterPlayers = myTeam.map(n => ALL.find(x => x.name === n)).filter(Boolean);
  const slotAssign = {{}};
  for (const pos of Object.keys(rosterSlots)) slotAssign[pos] = [];
  const pending = [];
  rosterPlayers.forEach(p => {{
    const pos = p.primaryPos;
    if (slotAssign[pos] && slotAssign[pos].length < rosterSlots[pos]) slotAssign[pos].push(p);
    else pending.push(p);
  }});
  pending.forEach(p => {{
    const positions = (p.elig || p.primaryPos || '').split('/');
    let placed = false;
    for (const pos of positions) {{
      if (pos !== p.primaryPos && slotAssign[pos] && slotAssign[pos].length < rosterSlots[pos]) {{
        slotAssign[pos].push(p); placed = true; break;
      }}
    }}
    if (!placed && !['SP','RP'].includes(p.primaryPos) && slotAssign['DH'].length < rosterSlots['DH']) {{
      slotAssign['DH'].push(p);
    }}
  }});
  const myLCV = calcRosterLCV(myTeam, state.rosterOverrides || {{}});
  let html = '<div style="background:var(--surface2);border-radius:8px;padding:10px;margin-bottom:10px;">';
  html += `<h3 style="font-size:13px;margin-bottom:6px;color:var(--accent);">My Roster (${{myTeam.length}} players, LCV: ${{myLCV.startingLCV.toFixed(1)}})</h3>`;
  html += '<div style="display:flex;flex-wrap:wrap;gap:3px;">';
  for (const [pos, players] of Object.entries(slotAssign)) {{
    const count = rosterSlots[pos];
    for (let i = 0; i < count; i++) {{
      const p = players[i];
      if (p) {{
        const isKeeper = myKeepNames.has(p.name);
        const bg = isKeeper ? 'rgba(99,102,241,0.15)' : 'rgba(16,185,129,0.15)';
        const border = isKeeper ? 'var(--accent)' : 'var(--green)';
        const enoTag = p.eno_rank ? ` <span class="eno-rank" style="font-size:8px;" title="Eno 150 Best Pitchers #${{p.eno_rank}}">P${{p.eno_rank}}</span>` : '';
        html += `<div style="background:${{bg}};border:1px solid ${{border}};border-radius:4px;padding:2px 6px;font-size:10px;white-space:nowrap;">`;
        html += `<span style="color:var(--text2);font-weight:600;">${{pos}}</span> ${{p.name}}${{enoTag}} <small style="opacity:0.6">${{(p.lcv||0).toFixed(1)}}</small>`;
        if (isKeeper) html += ' <small style="color:var(--accent);">K</small>';
        html += '</div>';
      }} else {{
        html += `<div style="background:var(--bg);border:1px dashed var(--border);border-radius:4px;padding:2px 6px;font-size:10px;color:var(--text2);">`;
        html += `<span style="font-weight:600;">${{pos}}</span> —</div>`;
      }}
    }}
  }}
  html += '</div></div>';

  // Live League LCV
  html += '<div style="background:var(--surface2);border-radius:8px;padding:10px;margin-bottom:10px;">';
  html += '<h3 style="font-size:13px;margin-bottom:6px;">Live League LCV</h3>';
  html += '<table style="width:100%;font-size:11px;border-collapse:collapse;">';
  html += '<tr style="color:var(--text2);"><th style="text-align:left;padding:2px 4px;">#</th><th style="text-align:left;padding:2px 4px;">Team</th><th style="text-align:right;padding:2px 4px;">Start</th><th style="text-align:right;padding:2px 4px;">Total</th></tr>';
  const leagueStats = LEAGUE_TEAMS.map(t => {{
    const players = t.mine ? (state.myTeam || []) : (state.leagueTeams[t.name] || []);
    const ov = t.mine ? (state.rosterOverrides || {{}}) : (state.leagueRosterOverrides && state.leagueRosterOverrides[t.name] || {{}});
    const stats = calcRosterLCV(players, ov);
    return {{ name: t.owner || t.name, mine: t.mine, ...stats }};
  }}).sort((a, b) => b.startingLCV - a.startingLCV);
  leagueStats.forEach((t, rank) => {{
    const style = t.mine ? 'background:rgba(99,102,241,0.1);font-weight:600;' : '';
    html += `<tr style="${{style}}"><td style="padding:2px 4px;">${{rank+1}}</td><td style="padding:2px 4px;">${{t.name}}${{t.mine?' ★':''}}</td><td style="text-align:right;padding:2px 4px;">${{t.startingLCV.toFixed(1)}}</td><td style="text-align:right;padding:2px 4px;">${{t.totalLCV.toFixed(1)}}</td></tr>`;
  }});
  html += '</table></div>';
  sidebar.innerHTML = html;
}}

// ── Render ─────────────────────────────────────────────────────────────────
function render() {{
  const isPlayerTab = ['all','bat','pit'].includes(currentTab);
  document.getElementById('playerControls').style.display = isPlayerTab ? 'flex' : 'none';
  document.getElementById('draftPanel').classList.toggle('show', currentTab === 'all');
  document.getElementById('tableWrap').style.display = isPlayerTab ? '' : 'none';
  document.getElementById('liveSidebar').style.display = 'none';
  document.getElementById('rosterSection').style.display = ['roster','board','mock','league'].includes(currentTab) ? '' : 'none';

  if (currentTab === 'roster') {{ renderRoster(); return; }}
  if (currentTab === 'board') {{ renderDraftBoard(); return; }}
  if (currentTab === 'mock') {{ renderMockDraft(); return; }}
  if (currentTab === 'league') {{ renderLeague(); return; }}

  buildPosFilters();
  recalcPNAV();
  // renderMyTeamChips(); // chips removed

  let data;
  if (filterType === 'bat') data = BATTERS;
  else if (filterType === 'pit') data = PITCHERS;
  else data = ALL;

  const q = document.getElementById('searchBox').value.toLowerCase();
  const draftFilter = document.getElementById('draftFilter').value;
  const tagFilter = document.getElementById('tagFilter').value;

  let filtered = data.filter(p => {{
    if (q && !p.name.toLowerCase().includes(q) && !(p.team||'').toLowerCase().includes(q)) return false;
    if (filterPos !== 'ALL' && p.primaryPos !== filterPos && !p.pos.includes(filterPos)) return false;
    if (draftFilter === 'available' && state.drafted[p.name]) return false;
    if (draftFilter === 'drafted' && !state.drafted[p.name]) return false;
    if (tagFilter === 'want' && state.tags[p.name] !== 'want') return false;
    if (tagFilter === 'avoid' && state.tags[p.name] !== 'avoid') return false;
    if (tagFilter === 'sleeper' && state.tags[p.name] !== 'sleeper') return false;
    if (tagFilter === 'bust' && state.tags[p.name] !== 'bust') return false;
    if (tagFilter === 'injured' && state.tags[p.name] !== 'injured') return false;
    if (tagFilter === 'any-tag' && !state.tags[p.name]) return false;
    if (tagFilter === 'untagged' && state.tags[p.name]) return false;
    // For s26/avp views, only show players with actual 2026 data
    if ((currentView === 's26' || currentView === 'avp') && !p.s26_pa && !p.s26_ip) return false;
    return true;
  }});

  filtered.sort((a,b) => {{
    let av = a[sortCol], bv = b[sortCol];
    if (typeof av === 'string') return sortDir * av.localeCompare(bv);
    return sortDir * ((av||0) - (bv||0));
  }});

  const cols = getCols();

  function buildHeaderHtml(colSet) {{
    return '<tr>' + colSet.map(c => {{
      let cls = (sortCol === c.key ? (sortDir === 1 ? 'sorted-asc' : 'sorted-desc') : '');
      let inner = c.label;
      if (c.tip) {{
        inner = `<span class="tooltip">${{c.label}}<span class="tt-text">${{c.tip}}</span></span>`;
      }}
      return `<th class="${{cls}}" data-col="${{c.key}}" style="min-width:${{c.w}}px">${{inner}}</th>`;
    }}).join('') + '</tr>';
  }}

  const thead = document.getElementById('thead');
  thead.innerHTML = buildHeaderHtml(cols);

  thead.querySelectorAll('th').forEach(th => {{
    th.addEventListener('click', () => {{
      const col = th.dataset.col;
      if (sortCol === col) sortDir *= -1;
      else {{ sortCol = col; sortDir = -1; }}
      render();
    }});
  }});

  function buildRowHtml(p, rowCols) {{
    const isDrafted = state.drafted[p.name];
    const isKeeper = state.keepers.includes(p.name);
    const rowCls = (isDrafted ? 'drafted ' : '') + (isKeeper ? 'keeper' : '');
    return `<tr class="${{rowCls}}" data-name="${{p.name}}">${{rowCols.map(c => {{
      let val = p[c.key];
      let cls = c.cls || '';
      if (c.key === 'pos') {{
        const pc = p.primaryPos;
        return `<td><span class="pos-badge pos-${{pc}}">${{val}}</span></td>`;
      }}
      // Handle empty 2025 stats (player not in 2025 data)
      if (val === '' || val === undefined || val === null) return `<td class="no-data">—</td>`;
      // 2026 projected vs 2025 actual comparison coloring
      if (currentView === 'p26' && !c.key.startsWith('s25_')) {{
        const s25map = {{pa:'s25_pa',avg:'s25_avg',obp:'s25_obp',slg:'s25_slg',hr:'s25_hr',r:'s25_r',rbi:'s25_rbi',sb:'s25_sb',so:'s25_so',
                         ip:'s25_ip',era:'s25_era',whip:'s25_whip',w:'s25_w',sv:'s25_sv',hld:'s25_hld',qs:'s25_qs'}};
        const s25k = s25map[c.key];
        if (s25k) {{
          const prev = p[s25k];
          if (prev !== '' && prev !== undefined && prev !== null) {{
            const cur = parseFloat(val), prv = parseFloat(prev);
            // For ERA, WHIP, SO(batters): lower is better
            const lowerBetter = (c.key === 'era' || c.key === 'whip' || (c.key === 'so' && p.type === 'BAT'));
            const diff = cur - prv;
            if (diff !== 0) {{
              const better = lowerBetter ? diff < 0 : diff > 0;
              cls += better ? ' val-pos' : ' val-neg';
            }}
          }}
        }}
      }}
      // AVP view: color actual stats relative to projected
      if (currentView === 'avp' && c.key.startsWith('s26_')) {{
        const projMap = {{s26_avg:'avg',s26_obp:'obp',s26_slg:'slg',s26_hr:'hr',s26_r:'r',s26_rbi:'rbi',s26_sb:'sb',s26_so:'so',s26_pa:'pa',
                          s26_ip:'ip',s26_era:'era',s26_whip:'whip',s26_w:'w',s26_sv:'sv',s26_hld:'hld',s26_qs:'qs'}};
        const projK = projMap[c.key];
        if (projK) {{
          const proj = p[projK];
          if (proj !== '' && proj !== undefined && proj !== null) {{
            const act = parseFloat(val), prj = parseFloat(proj);
            const lowerBetter = (projK === 'era' || projK === 'whip' || (projK === 'so' && p.type === 'BAT'));
            const diff = act - prj;
            if (diff !== 0) {{
              const better = lowerBetter ? diff < 0 : diff > 0;
              cls += better ? ' val-pos' : ' val-neg';
            }}
          }}
        }}
      }}
      // Format s26 columns
      if (c.key === 's26_avg' || c.key === 's26_obp' || c.key === 's26_slg') val = parseFloat(val).toFixed(3);
      else if (c.key === 's26_era') val = parseFloat(val).toFixed(2);
      else if (c.key === 's26_whip') val = parseFloat(val).toFixed(3);
      else if (c.key === 's26_ip') val = parseFloat(val).toFixed(1);
      else if (c.key === 'avg' || c.key === 'obp' || c.key === 'slg' || c.key === 's25_avg' || c.key === 's25_obp' || c.key === 's25_slg') val = parseFloat(val).toFixed(3);
      else if (c.key === 'era' || c.key === 's25_era') val = parseFloat(val).toFixed(2);
      else if (c.key === 'whip' || c.key === 's25_whip') val = parseFloat(val).toFixed(3);
      else if (c.key === 'ip' || c.key === 's25_ip') val = parseFloat(val).toFixed(1);
      else if (c.key === 's25_woba' || c.key === 's25_xwoba') val = parseFloat(val).toFixed(3);
      else if (c.key === 's25_barrel' || c.key === 's25_hardhit') val = parseFloat(val).toFixed(1) + '%';
      else if (c.key === 's25_delta') {{
        const v = parseFloat(val);
        cls += v > 0 ? ' val-pos' : v < 0 ? ' val-neg' : '';
        val = (v > 0 ? '+' : '') + v.toFixed(3);
      }}
      else if (c.key === 's25_stuff' || c.key === 's25_loc' || c.key === 's25_pitching') {{
        const v = parseInt(val);
        cls += v >= 110 ? ' val-pos' : v <= 90 ? ' val-neg' : '';
      }}
      else if (c.key === 'war') val = val.toFixed(1);
      else if (c.key === 'lcv' || c.key === 'pnav' || c.key === 'dp' || c.key === 'upside' || c.key === 'trend') {{
        const v = parseFloat(val);
        cls += v >= 0 ? ' val-pos' : ' val-neg';
        val = v.toFixed(2);
      }}
      if (c.key === 'name') {{
        // Owner badge for drafted players
        let ownerBadge = '';
        if (isDrafted) {{
          const dInfo = state.drafted[p.name] || {{}};
          let ownerLabel = '';
          if (dInfo.mine) {{
            ownerLabel = 'My Team';
          }} else {{
            // Find which team owns this player
            const ownerTeam = LEAGUE_TEAMS.find(t => {{
              const pl = t.mine ? (state.myTeam || []) : (state.leagueTeams[t.name] || []);
              return pl.includes(p.name);
            }});
            ownerLabel = ownerTeam ? (ownerTeam.owner || ownerTeam.name) : 'Drafted';
          }}
          const rdInfo = dInfo.round ? ' R' + dInfo.round : '';
          const badgeCls = dInfo.mine ? 'owner-badge mine' : 'owner-badge';
          ownerBadge = ` <span class="${{badgeCls}}">${{ownerLabel}}${{rdInfo}}</span>`;
        }}
        const kpRd = state.keeperRounds && state.keeperRounds[p.name];
        const kp = isKeeper ? ` <small style="color:var(--accent)">[K${{kpRd ? ' Rd'+kpRd : ''}}]</small>` : '';
        // Tags: want / avoid / sleeper / bust
        const tag = state.tags[p.name];
        const tagMap = {{
          want:    {{ cls: 'tag-want',    label: 'W', title: 'Want' }},
          avoid:   {{ cls: 'tag-avoid',   label: 'A', title: 'Avoid' }},
          sleeper: {{ cls: 'tag-sleeper', label: 'S', title: 'Sleeper' }},
          bust:    {{ cls: 'tag-bust',    label: 'B', title: 'Bust' }},
          injured: {{ cls: 'tag-injured', label: 'IL', title: 'Injured' }}
        }};
        let tagHtml = '';
        if (tag && tagMap[tag]) tagHtml = ` <span class="tag-badge ${{tagMap[tag].cls}}" title="${{tagMap[tag].title}}">${{tagMap[tag].label}}</span>`;
        // Tag buttons: W=want, A=avoid, IL=injured (sleeper/bust auto-set from BUZZ articles only)
        const tagBtns = `<span class="tag-btns" style="margin-left:4px;"><button class="tag-btn tag-w" data-player="${{encodeURIComponent(p.name)}}" data-tag="want" title="Want"${{tag==='want'?' style="opacity:1"':''}}>W</button><button class="tag-btn tag-a" data-player="${{encodeURIComponent(p.name)}}" data-tag="avoid" title="Avoid"${{tag==='avoid'?' style="opacity:1"':''}}>A</button><button class="tag-btn tag-i" data-player="${{encodeURIComponent(p.name)}}" data-tag="injured" title="Injured"${{tag==='injured'?' style="opacity:1"':''}}>IL</button></span>`;
        // Buzz arrows from expert articles
        const buzzItems = BUZZ[p.name] || [];
        const buzzHtml = buzzItems.map(b => {{
          if (b.type === 'up') return `<a href="${{b.url}}" target="_blank" title="Sleeper — ${{b.src}}" style="text-decoration:none;cursor:pointer;font-size:13px;">&#x25B2;<small style="font-size:9px;opacity:0.7">${{b.src}}</small></a>`;
          return `<a href="${{b.url}}" target="_blank" title="Avoid — ${{b.src}}" style="text-decoration:none;cursor:pointer;font-size:13px;">&#x25BC;<small style="font-size:9px;opacity:0.7">${{b.src}}</small></a>`;
        }}).join(' ');
        const buzz = buzzHtml ? ` ${{buzzHtml}}` : '';
        const enoR = p.eno_rank ? ` <span class="eno-rank" title="Eno 150 Best Pitchers #${{p.eno_rank}}">P${{p.eno_rank}}</span>` : '';
        return `<td style="font-weight:600">${{val}}${{enoR}}${{tagHtml}}${{kp}}${{ownerBadge}}${{buzz}}${{tagBtns}}</td>`;
      }}
      return `<td class="${{cls}}">${{val}}</td>`;
    }}).join('')}}</tr>`;
  }}

  const tbody = document.getElementById('tbody');
  const rows = filtered.slice(0, 500);
  tbody.innerHTML = rows.map(p => buildRowHtml(p, cols)).join('');

  // Right-click to draft, double-click to draft to my team
  tbody.querySelectorAll('tr').forEach(tr => {{
    tr.addEventListener('contextmenu', e => {{
      e.preventDefault();
      const name = tr.dataset.name;
      if (!state.drafted[name]) {{ draftPlayer(name, false); }}
    }});
    tr.addEventListener('dblclick', () => {{
      const name = tr.dataset.name;
      if (!state.drafted[name]) {{ draftPlayer(name, true); }}
    }});
  }});

  // Tag buttons (want / avoid)
  tbody.querySelectorAll('.tag-btn').forEach(btn => {{
    btn.addEventListener('click', (e) => {{
      e.stopPropagation();
      const name = decodeURIComponent(btn.dataset.player);
      const tag = btn.dataset.tag;
      if (state.tags[name] === tag) {{ delete state.tags[name]; }}
      else {{ state.tags[name] = tag; }}
      save();
      render();
    }});
  }});

  document.getElementById('showCount').textContent = filtered.length;
  document.getElementById('draftedCount').textContent = Object.keys(state.drafted).length;
  const tagVals = Object.values(state.tags);
  document.getElementById('wantCount').textContent = tagVals.filter(t => t === 'want').length;
  document.getElementById('avoidCount').textContent = tagVals.filter(t => t === 'avoid').length;
  document.getElementById('sleeperCount').textContent = tagVals.filter(t => t === 'sleeper').length;
  document.getElementById('bustCount').textContent = tagVals.filter(t => t === 'bust').length;
  document.getElementById('injuredCount').textContent = tagVals.filter(t => t === 'injured').length;
}}

// ── Draft simulation engine ───────────────────────────────────────────────
// Simulates a BPA (best player available) draft for all open picks.
// Returns {{ teamResults: Map<teamName, [{{name,dp,round,overall}}]>, teamCapital: Map<teamName, number>, teamOpenRds: Map<teamName, number> }}
function simulateDraft() {{
  const TOTAL_ROUNDS = 31;

  // All kept player names across every team (keepers only, not mid-draft picks)
  const allKeptNames = new Set();
  LEAGUE_TEAMS.forEach(t => {{
    const pl = t.mine ? (state.myTeam || []) : (state.leagueTeams[t.name] || []);
    pl.forEach(n => allKeptNames.add(n));
  }});

  // Also exclude any player already drafted in the live draft (non-keeper picks)
  const allDraftedNames = new Set(Object.keys(state.drafted));

  // Available pool = not kept AND not already drafted in live draft, sorted by DP desc
  const available = ALL.filter(p => !allKeptNames.has(p.name) && !allDraftedNames.has(p.name))
    .sort((a, b) => (b.dp || 0) - (a.dp || 0));

  // Snake helper
  function pickInRound(rd, pos) {{
    return rd % 2 === 1 ? pos : (TEAMS - pos + 1);
  }}

  // For each team, find keeper rounds (from keeperRounds state) and live-drafted rounds
  const teamMeta = {{}};
  LEAGUE_TEAMS.forEach(t => {{
    const keeperRds = new Set();
    const pl = t.mine ? (state.myTeam || []) : (state.leagueTeams[t.name] || []);
    pl.forEach(name => {{
      const rd = state.keeperRounds[name];
      if (rd) keeperRds.add(rd);
    }});
    teamMeta[t.name] = {{ pick: t.pick, keeperRds }};
  }});

  // Collect all open picks across all 12 teams
  const allOpenPicks = [];
  LEAGUE_TEAMS.forEach(t => {{
    const meta = teamMeta[t.name];
    for (let rd = 1; rd <= TOTAL_ROUNDS; rd++) {{
      if (!meta.keeperRds.has(rd)) {{
        const overall = (rd - 1) * TEAMS + pickInRound(rd, meta.pick);
        allOpenPicks.push({{ teamName: t.name, round: rd, overall }});
      }}
    }}
  }});

  // Sort by overall pick (draft order)
  allOpenPicks.sort((a, b) => a.overall - b.overall);

  // Assign BPA to each pick
  const teamResults = {{}};
  const teamCapital = {{}};
  const teamOpenRds = {{}};
  LEAGUE_TEAMS.forEach(t => {{
    teamResults[t.name] = [];
    teamCapital[t.name] = 0;
    const meta = teamMeta[t.name];
    teamOpenRds[t.name] = TOTAL_ROUNDS - meta.keeperRds.size;
  }});

  allOpenPicks.forEach((pick, i) => {{
    if (i < available.length) {{
      const player = available[i];
      teamResults[pick.teamName].push({{
        name: player.name, dp: player.dp || 0, lcv: player.lcv || 0,
        pos: player.primaryPos || '?', team: player.team || '',
        round: pick.round, overall: pick.overall
      }});
      teamCapital[pick.teamName] += player.dp || 0;
    }}
  }});

  // Round values
  for (const tn of Object.keys(teamCapital)) {{
    teamCapital[tn] = Math.round(teamCapital[tn] * 100) / 100;
  }}

  return {{ teamResults, teamCapital, teamOpenRds }};
}}

// ── Draft mechanics ───────────────────────────────────────────────────────
function draftPlayer(name, toMyTeam) {{
  state.drafted[name] = {{ time: Date.now(), mine: toMyTeam }};
  if (toMyTeam) state.myTeam.push(name);
  save();
  render();
}}

function undraftPlayer(name) {{
  delete state.drafted[name];
  state.myTeam = state.myTeam.filter(n => n !== name);
  save();
  render();
}}

function clearAllDrafted() {{
  if (!confirm('Clear all drafted players?')) return;
  state.drafted = {{}};
  state.myTeam = state.keepers.slice();
  save();
  render();
}}

// ── Autocomplete ──────────────────────────────────────────────────────────
const draftInput = document.getElementById('draftInput');
const draftAC = document.getElementById('draftAC');
let acIndex = -1, acMatches = [];

draftInput.addEventListener('input', () => {{
  const q = draftInput.value.toLowerCase();
  if (q.length < 2) {{ draftAC.style.display = 'none'; return; }}
  acMatches = ALL.filter(p => !state.drafted[p.name] && p.name.toLowerCase().includes(q)).slice(0,10);
  acIndex = -1;
  draftAC.innerHTML = acMatches.map((p,i) =>
    `<div data-i="${{i}}">${{p.name}} <small>${{p.team}} ${{p.pos}}</small></div>`
  ).join('');
  draftAC.style.display = acMatches.length ? 'block' : 'none';
  draftAC.querySelectorAll('div').forEach(d => {{
    d.addEventListener('click', () => {{
      draftInput.value = acMatches[parseInt(d.dataset.i)].name;
      draftAC.style.display = 'none';
    }});
  }});
}});

draftInput.addEventListener('keydown', e => {{
  if (e.key === 'ArrowDown') {{ acIndex = Math.min(acIndex+1, acMatches.length-1); updateACHL(); e.preventDefault(); }}
  else if (e.key === 'ArrowUp') {{ acIndex = Math.max(acIndex-1, 0); updateACHL(); e.preventDefault(); }}
  else if (e.key === 'Enter') {{
    if (acIndex >= 0 && acMatches[acIndex]) draftInput.value = acMatches[acIndex].name;
    draftAC.style.display = 'none';
    document.getElementById('draftBtn').click();
  }}
  else if (e.key === 'Escape') draftAC.style.display = 'none';
}});

function updateACHL() {{
  draftAC.querySelectorAll('div').forEach((d,i) => d.classList.toggle('selected', i === acIndex));
}}

document.getElementById('draftBtn').addEventListener('click', () => {{
  const name = draftInput.value.trim();
  const match = ALL.find(p => p.name.toLowerCase() === name.toLowerCase());
  if (match && !state.drafted[match.name]) {{
    draftPlayer(match.name, document.getElementById('draftToMyTeam').checked);
    draftInput.value = '';
    draftAC.style.display = 'none';
  }}
}});

// ── Bulk import ───────────────────────────────────────────────────────────
function openBulkModal() {{ document.getElementById('bulkModal').classList.add('show'); }}
function closeBulkModal() {{ document.getElementById('bulkModal').classList.remove('show'); }}
function parseNameAndRound(line) {{
  // Try formats: "Name, 1" or "Name Rd1" or "Name Rd 1" or "Name, Rd 1"
  let rd = null, name = line;
  // "Name, 1" or "Name, Rd 1" or "Name, Rd1"
  const commaMatch = name.match(/^(.+?),\\s*(?:Rd\\.?\\s*)?(\d+)\\s*$/i);
  if (commaMatch) {{ name = commaMatch[1].trim(); rd = parseInt(commaMatch[2]); }}
  else {{
    // "Name Rd1" or "Name Rd 1"
    const rdMatch = name.match(/^(.+?)\\s+Rd\\.?\\s*(\d+)\\s*$/i);
    if (rdMatch) {{ name = rdMatch[1].trim(); rd = parseInt(rdMatch[2]); }}
  }}
  return {{ name, rd }};
}}

function fuzzyFind(name) {{
  let match = ALL.find(p => p.name.toLowerCase() === name.toLowerCase());
  if (match) return match;
  // Try last name
  const parts = name.split(/\\s+/);
  const last = parts[parts.length - 1].toLowerCase();
  const candidates = ALL.filter(p => p.name.toLowerCase().includes(last));
  if (candidates.length === 1) return candidates[0];
  if (parts.length >= 2) {{
    const first = parts[0].toLowerCase();
    return candidates.find(p => p.name.toLowerCase().startsWith(first)) || null;
  }}
  return null;
}}

function processBulk() {{
  const lines = document.getElementById('bulkArea').value.split('\\n').map(l => l.trim()).filter(Boolean);
  let matched = 0, unmatched = [];
  if (!state.keeperRounds) state.keeperRounds = {{}};
  lines.forEach(line => {{
    const {{ name, rd }} = parseNameAndRound(line);
    const match = fuzzyFind(name);
    if (match && !state.drafted[match.name]) {{
      state.drafted[match.name] = {{ time: Date.now(), mine: false, round: rd }};
      if (rd) state.keeperRounds[match.name] = rd;
      matched++;
    }} else if (!match) {{
      unmatched.push(name);
    }}
  }});
  save();
  closeBulkModal();
  render();
  let msg = `Imported ${{matched}} of ${{lines.length}} players.`;
  if (unmatched.length) msg += `\\nUnmatched: ${{unmatched.join(', ')}}`;
  alert(msg);
}}

// ── CBS Team Name Mapping ─────────────────────────────────────────────────
function toggleCbsMap() {{
  const panel = document.getElementById('cbsMapPanel');
  panel.style.display = panel.style.display === 'none' ? '' : 'none';
  if (panel.style.display !== 'none') renderCbsMapRows();
}}

function renderCbsMapRows() {{
  const container = document.getElementById('cbsMapRows');
  const entries = Object.entries(state.cbsTeamMap);
  if (entries.length === 0) {{
    container.innerHTML = '<p style="font-size:11px;color:var(--text2);">No mappings yet. Paste your CBS draft log and click "Auto-detect from paste", or add manually.</p>';
    return;
  }}
  let html = '<table style="width:100%;font-size:11px;border-collapse:collapse;">';
  html += '<tr style="color:var(--text2);"><th style="text-align:left;padding:2px 4px;">CBS Name</th><th style="text-align:left;padding:2px 4px;">→ League Team</th><th></th></tr>';
  entries.forEach(([cbsName, leagueName]) => {{
    const team = LEAGUE_TEAMS.find(t => t.name === leagueName);
    const isMine = team && team.mine;
    html += `<tr>`;
    html += `<td style="padding:3px 4px;"><input type="text" class="cbs-map-cbs" value="${{cbsName.replace(/"/g, '&quot;')}}" style="width:100%;padding:2px 4px;font-size:11px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:3px;"></td>`;
    html += `<td style="padding:3px 4px;"><select class="cbs-map-league" style="width:100%;padding:2px 4px;font-size:11px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:3px;">`;
    html += `<option value="">-- select --</option>`;
    LEAGUE_TEAMS.forEach(t => {{
      const label = (t.owner || t.name) + (t.mine ? ' (you)' : '');
      html += `<option value="${{t.name}}"${{t.name === leagueName ? ' selected' : ''}}>${{label}}</option>`;
    }});
    html += `</select></td>`;
    html += `<td style="padding:3px 2px;"><button class="btn btn-secondary cbs-map-del" data-cbs="${{encodeURIComponent(cbsName)}}" style="padding:1px 6px;font-size:10px;">✕</button></td>`;
    html += `</tr>`;
  }});
  html += '</table>';
  container.innerHTML = html;

  // Wire delete buttons
  container.querySelectorAll('.cbs-map-del').forEach(btn => {{
    btn.addEventListener('click', () => {{
      delete state.cbsTeamMap[decodeURIComponent(btn.dataset.cbs)];
      save();
      renderCbsMapRows();
    }});
  }});
}}

function addCbsMapRow() {{
  state.cbsTeamMap[''] = '';
  renderCbsMapRows();
}}

function saveCbsMap() {{
  const rows = document.querySelectorAll('#cbsMapRows tr');
  const newMap = {{}};
  rows.forEach(row => {{
    const cbsInput = row.querySelector('.cbs-map-cbs');
    const leagueSelect = row.querySelector('.cbs-map-league');
    if (cbsInput && leagueSelect) {{
      const cbsName = cbsInput.value.trim();
      const leagueName = leagueSelect.value;
      if (cbsName && leagueName) newMap[cbsName] = leagueName;
    }}
  }});
  state.cbsTeamMap = newMap;
  save();
  renderCbsMapRows();
  document.getElementById('pasteStatus').textContent = `Saved ${{Object.keys(newMap).length}} team mapping(s).`;
}}

function autoDetectCbsTeams() {{
  const text = document.getElementById('livePasteBox').value;
  const lines = text.split('\\n').map(l => l.trim()).filter(Boolean);
  const cbsNames = new Set();
  lines.forEach(line => {{
    const m = line.match(/^\\*?\\s*Pick:\\s*\\d+\\s*-\\s*Team\\s+(.+?)\\s+selects\\s+/i);
    if (m) cbsNames.add(m[1].trim());
  }});
  if (cbsNames.size === 0) {{
    document.getElementById('pasteStatus').textContent = 'No CBS pick lines found in paste. Paste the draft log first.';
    return;
  }}
  // For each detected name, try to auto-match or add as unmapped
  cbsNames.forEach(cbsName => {{
    if (state.cbsTeamMap[cbsName]) return; // already mapped
    // Try fuzzy match to league teams
    const lower = cbsName.toLowerCase();
    let found = LEAGUE_TEAMS.find(t => t.name.toLowerCase() === lower);
    if (!found) found = LEAGUE_TEAMS.find(t => {{
      const ownerFirst = (t.owner || '').split(' ')[0].toLowerCase();
      return ownerFirst.length > 2 && lower.includes(ownerFirst);
    }});
    if (!found) found = LEAGUE_TEAMS.find(t => {{
      const parts = (t.owner || '').split(' ');
      const ownerLast = parts.length > 1 ? parts[parts.length-1].toLowerCase() : '';
      return ownerLast.length > 2 && lower.includes(ownerLast);
    }});
    state.cbsTeamMap[cbsName] = found ? found.name : '';
  }});
  save();
  renderCbsMapRows();
  document.getElementById('pasteStatus').textContent = `Detected ${{cbsNames.size}} CBS team name(s). Review and save mappings.`;
}}

// ── Live Paste Panel ──────────────────────────────────────────────────────
function togglePastePanel() {{
  const panel = document.getElementById('pastePanel');
  panel.classList.toggle('show');
}}

function processLivePaste() {{
  const text = document.getElementById('livePasteBox').value;
  const lines = text.split('\\n').map(l => l.trim()).filter(Boolean);
  let matched = 0, unmatched = [];
  if (!state.keeperRounds) state.keeperRounds = {{}};

  // Build CBS team name -> league team mapping for CBS draft log format
  // Maps the CBS team name in draft log to our LEAGUE_TEAMS by matching owner names or team names
  function findLeagueTeam(cbsTeamName) {{
    const lower = cbsTeamName.toLowerCase().trim();
    // Check saved CBS team map first
    const mapped = state.cbsTeamMap[cbsTeamName] || state.cbsTeamMap[cbsTeamName.trim()];
    if (mapped) {{
      const t = LEAGUE_TEAMS.find(t => t.name === mapped);
      if (t) return t;
    }}
    // Also check case-insensitive map keys
    for (const [k, v] of Object.entries(state.cbsTeamMap)) {{
      if (k.toLowerCase().trim() === lower && v) {{
        const t = LEAGUE_TEAMS.find(t => t.name === v);
        if (t) return t;
      }}
    }}
    // Direct match on team name
    let found = LEAGUE_TEAMS.find(t => t.name.toLowerCase() === lower);
    if (found) return found;
    // Partial match on team name
    found = LEAGUE_TEAMS.find(t => lower.includes(t.name.toLowerCase().substring(0, 10)) || t.name.toLowerCase().includes(lower.substring(0, 10)));
    if (found) return found;
    // Match on owner first name
    found = LEAGUE_TEAMS.find(t => {{
      const ownerFirst = (t.owner || '').split(' ')[0].toLowerCase();
      return ownerFirst && lower.includes(ownerFirst);
    }});
    if (found) return found;
    // Match on owner last name
    found = LEAGUE_TEAMS.find(t => {{
      const parts = (t.owner || '').split(' ');
      const ownerLast = parts.length > 1 ? parts[parts.length-1].toLowerCase() : '';
      return ownerLast && lower.includes(ownerLast);
    }});
    if (found) return found;
    // Check stored team owners too
    for (const [teamName, owner] of Object.entries(state.teamOwners)) {{
      const ownerLower = owner.toLowerCase();
      if (lower.includes(ownerLower.split(' ')[0])) {{
        return LEAGUE_TEAMS.find(t => t.name === teamName);
      }}
    }}
    return null;
  }}

  lines.forEach(line => {{
    // CBS draft room format: "Pick: X - Team [TeamName] selects [Last], [First]"
    const cbsMatch = line.match(/^\\*?\\s*Pick:\\s*(\\d+)\\s*-\\s*Team\\s+(.+?)\\s+selects\\s+(.+?)\\s*\\*?$/i);
    if (cbsMatch) {{
      const pickNum = parseInt(cbsMatch[1]);
      const cbsTeam = cbsMatch[2].trim();
      const rawName = cbsMatch[3].trim();
      // CBS uses "Last, First" format — flip to "First Last"
      let playerName = rawName;
      if (rawName.includes(',')) {{
        const [last, first] = rawName.split(',').map(s => s.trim());
        playerName = first + ' ' + last;
      }}
      const round = Math.ceil(pickNum / TEAMS);
      const leagueTeam = findLeagueTeam(cbsTeam);
      const isMine = leagueTeam && leagueTeam.mine;

      const match = fuzzyFind(playerName);
      if (match && !state.drafted[match.name]) {{
        state.drafted[match.name] = {{ time: Date.now(), mine: !!isMine, round }};
        state.keeperRounds[match.name] = round;
        if (isMine && !state.myTeam.includes(match.name)) state.myTeam.push(match.name);
        matched++;
      }} else if (!match) {{
        unmatched.push(playerName);
      }}
      return; // Skip the generic parsing below
    }}

    // Skip "joined" lines
    if (/joined$/i.test(line.replace(/\\*/g, '').trim())) return;

    // Generic format parsing (existing logic)
    let cleaned = line;
    // Extract round from "Round X Pick Y:" format
    let extractedRd = null;
    const rdPick = cleaned.match(/^Round\\s*(\\d+)\\s*Pick\\s*\\d+\\s*[:.]?\\s*/i);
    if (rdPick) {{ extractedRd = parseInt(rdPick[1]); cleaned = cleaned.replace(rdPick[0], ''); }}
    // "X.YY Name" format (round.pick)
    const dotFmt = cleaned.match(/^(\\d+)\\.\\d+\\s+/);
    if (dotFmt) {{ extractedRd = parseInt(dotFmt[1]); cleaned = cleaned.replace(dotFmt[0], ''); }}
    // Remove team in parens or after dash
    cleaned = cleaned.replace(/\\s*\\(.*?\\)\\s*$/, '');
    cleaned = cleaned.replace(/\\s*-\\s*[A-Z]{{2,3}}\\s*$/, '');
    // Remove position tags
    cleaned = cleaned.replace(/\\s+(SP|RP|C|1B|2B|3B|SS|LF|CF|RF|DH|OF)\\s*$/i, '');
    // Remove dollar amounts
    cleaned = cleaned.replace(/\\s*\\$\\d+\\s*$/, '');

    // Now try parseNameAndRound for "Name, Rd X" or "Name Rd X" formats
    const {{ name, rd }} = parseNameAndRound(cleaned.trim());
    const finalRd = rd || extractedRd;

    if (!name) return;

    const match = fuzzyFind(name);
    if (match && !state.drafted[match.name]) {{
      state.drafted[match.name] = {{ time: Date.now(), mine: false, round: finalRd }};
      if (finalRd) state.keeperRounds[match.name] = finalRd;
      matched++;
    }} else if (!match) {{
      unmatched.push(name);
    }}
  }});

  save();
  render();
  let status = `Processed ${{matched}} players.`;
  if (unmatched.length) status += ` Unmatched: ${{unmatched.join(', ')}}`;
  document.getElementById('pasteStatus').textContent = status;
  document.getElementById('livePasteBox').value = '';
}}

// ── My Team Chips ─────────────────────────────────────────────────────────
function renderMyTeamChips() {{
  const container = document.getElementById('myTeamChips');
  container.innerHTML = state.myTeam.map(name => {{
    const p = ALL.find(x => x.name === name);
    const pos = p ? p.primaryPos : '?';
    const kpRd = state.keeperRounds && state.keeperRounds[name];
    const rdTag = kpRd ? ` <small style="color:var(--accent)">Rd${{kpRd}}</small>` : '';
    return `<div class="team-chip"><span class="pos-badge pos-${{pos}}" style="padding:1px 4px;font-size:10px;">${{pos}}</span>${{name}}${{rdTag}}<span class="remove" data-remove="${{encodeURIComponent(name)}}">&times;</span></div>`;
  }}).join('');
  container.querySelectorAll('.remove').forEach(el => {{
    el.addEventListener('click', () => removeFromTeam(decodeURIComponent(el.dataset.remove)));
  }});

  // Show needs
  const counts = {{}};
  state.myTeam.forEach(n => {{
    const p = ALL.find(x => x.name === n);
    if (p) counts[p.primaryPos] = (counts[p.primaryPos]||0) + 1;
  }});
  const needs = [];
  for (const [pos, slots] of Object.entries(ROSTER_SLOTS)) {{
    const have = counts[pos] || 0;
    const cls = have >= slots ? 'need-low' : have >= slots*0.5 ? 'need-med' : 'need-high';
    needs.push(`<span class="need-indicator ${{cls}}"></span>${{pos}} ${{have}}/${{slots}}`);
  }}
  document.getElementById('teamNeeds').innerHTML = needs.join(' &nbsp; ');
}}

function removeFromTeam(name) {{
  state.myTeam = state.myTeam.filter(n => n !== name);
  if (state.drafted[name] && state.drafted[name].mine) state.drafted[name].mine = false;
  save();
  render();
}}

// ── Combined Roster view (My Team + all league teams) ─────────────────────
function renderRoster() {{
  const section = document.getElementById('rosterSection');
  if (!state.rosterOverrides) state.rosterOverrides = {{}};
  if (!state.leagueRosterOverrides) state.leagueRosterOverrides = {{}};

  // Team selector state
  if (!state._rosterTeam) state._rosterTeam = '__mine__';
  const isMine = state._rosterTeam === '__mine__';
  const selTeamName = isMine ? LEAGUE_TEAMS.find(t=>t.mine)?.name : state._rosterTeam;
  const teamPlayers = isMine ? (state.myTeam || []) : (state.leagueTeams[selTeamName] || []);
  const teamMilb = isMine ? (state.milbKeepers || []) : (DEFAULT_LEAGUE_MILB_KEEPERS[selTeamName] || []);
  const overrides = isMine ? state.rosterOverrides : (state.leagueRosterOverrides[selTeamName] || {{}});

  // ── Auto-assign logic ──
  const bySlot = {{}};
  const bench = [];
  for (const pos of Object.keys(ROSTER_SLOTS)) bySlot[pos] = [];
  const ilPlayers = [];
  const autoPool = [];

  teamPlayers.forEach(name => {{
    const p = ALL.find(x => x.name === name) || {{ name, primaryPos: '?', elig: '?', lcv:0, pnav:0 }};
    const ov = overrides[name];
    if (ov === 'il') {{ ilPlayers.push(p); return; }}
    if (ov === 'reserve') {{ bench.push(p); return; }}
    if (ov && ROSTER_SLOTS[ov] !== undefined) {{ bySlot[ov].push(p); return; }}
    if (ov) {{ bench.push(p); return; }}
    autoPool.push(p);
  }});

  // Pass 1: primary pos
  const pending = [];
  autoPool.forEach(p => {{
    if (ROSTER_SLOTS[p.primaryPos] !== undefined && bySlot[p.primaryPos].length < ROSTER_SLOTS[p.primaryPos]) bySlot[p.primaryPos].push(p);
    else pending.push(p);
  }});
  // Pass 2: multi-elig
  const stillPending = [];
  pending.forEach(p => {{
    const positions = (p.elig || p.primaryPos || '').split('/');
    let placed = false;
    for (const pos of positions) {{
      if (pos !== p.primaryPos && ROSTER_SLOTS[pos] !== undefined && bySlot[pos].length < ROSTER_SLOTS[pos]) {{ bySlot[pos].push(p); placed = true; break; }}
    }}
    if (!placed) stillPending.push(p);
  }});
  // Pass 3: DH overflow
  stillPending.forEach(p => {{
    if (!['SP','RP'].includes(p.primaryPos) && bySlot['DH'].length < ROSTER_SLOTS['DH']) bySlot['DH'].push(p);
    else bench.push(p);
  }});

  // ── PNAV color helpers ──
  const DD = {{}};
  for (const [pos, sl] of Object.entries(ROSTER_SLOTS)) DD[pos] = Math.round(sl * TEAMS * 1.3);
  const ppSorted = {{}};
  for (const pos of Object.keys(ROSTER_SLOTS)) {{
    const pool = ['SP','RP'].includes(pos) ? PITCHERS : BATTERS;
    ppSorted[pos] = pool.filter(p => p.primaryPos === pos).map(p => p.pnav||0).sort((a,b)=>b-a).slice(0,DD[pos]).sort((a,b)=>a-b);
  }}
  function ppct(v,pos) {{ const s=ppSorted[pos]||[0]; if(s.length<=1)return 0.5; let b=0; for(let i=0;i<s.length;i++)if(s[i]<(v||0))b++; return Math.max(0,Math.min(1,b/(s.length-1))); }}
  function tClr(v,pos) {{ const t=ppct(v,pos); return `hsl(${{Math.round(t*120)}},70%,38%)`; }}
  function tBg(v,pos) {{ const t=ppct(v,pos); return `hsla(${{Math.round(t*120)}},70%,45%,0.12)`; }}

  // ── Compute LCV for this team ──
  const teamLCV = calcRosterLCV(teamPlayers, overrides);

  // ── Build compact table row ──
  function pRow(p, slot, tag) {{
    if (!p) return `<tr class="roster-section" data-slot="${{slot}}" style="opacity:0.3;"><td style="padding:3px 6px;font-weight:600;width:30px;">${{slot}}</td><td colspan="7" style="padding:3px 6px;color:var(--text2);">—</td></tr>`;
    const dn = encodeURIComponent(p.name);
    const c = tClr(p.pnav, slot||p.primaryPos);
    const ki = getKeeperInfo(p.name);
    const krd = ki.draftRound;
    const kTag = krd ? `<span style="color:var(--accent);font-size:10px;margin-left:4px;" title="Drafted R${{krd}}${{ki.keepable2027 ? ', 2027 cost R'+ki.cost2027+', '+ki.yearsLeft+'yr control' : ', not keepable'}}">R${{krd}}${{ki.keepable2027 ? '→'+ki.cost2027 : '✕'}}</span>` : '';
    const natPos = (slot && p.primaryPos !== slot) ? `<span style="color:var(--text2);font-size:10px;margin-left:3px;">(nat ${{p.primaryPos}})</span>` : '';
    const extraTag = tag ? `<span style="font-size:10px;margin-left:4px;">${{tag}}</span>` : '';
    const dropBtn = isMine ? `<td style="padding:3px 4px;text-align:center;"><button class="drop-btn" data-name="${{dn}}" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:10px;opacity:0.4;padding:2px 4px;" title="Drop ${{p.name}}">✕</button></td>` : '<td></td>';
    return `<tr class="roster-row" draggable="true" data-player="${{dn}}" style="border-left:3px solid ${{c}};cursor:grab;">` +
      `<td style="padding:3px 6px;font-weight:600;width:30px;font-size:11px;">${{slot||''}}</td>` +
      `<td style="padding:3px 6px;font-weight:600;font-size:12px;">${{p.name}}${{natPos}}${{kTag}}${{extraTag}}</td>` +
      `<td style="padding:3px 6px;font-size:11px;color:var(--text2);">${{p.team||''}}</td>` +
      `<td style="padding:3px 6px;font-size:11px;">${{(p.elig||p.primaryPos||'').replace(/\\//g,', ')}}</td>` +
      `<td style="padding:3px 6px;text-align:right;font-size:11px;color:${{c}};font-weight:600;">${{(p.lcv||0).toFixed(1)}}</td>` +
      `<td style="padding:3px 6px;text-align:right;font-size:11px;">${{(p.pnav||0).toFixed(1)}}</td>` +
      `<td style="padding:3px 6px;text-align:right;font-size:11px;color:var(--text2);">${{p.age||'?'}}</td>` +
      dropBtn + `</tr>`;
  }}

  // ── HTML ──
  let html = '';

  // Team selector
  html += '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:12px;align-items:center;">';
  html += '<span style="font-weight:700;margin-right:8px;font-size:13px;">Rosters</span>';
  LEAGUE_TEAMS.forEach(t => {{
    const isMe = t.mine;
    const key = isMe ? '__mine__' : t.name;
    const active = state._rosterTeam === key;
    const bg = active ? (isMe ? 'var(--accent)' : 'var(--text)') : 'var(--surface2)';
    const fg = active ? '#fff' : 'var(--text)';
    const plCount = isMe ? (state.myTeam||[]).length : (state.leagueTeams[t.name]||[]).length;
    html += `<button class="roster-team-btn btn" data-team="${{encodeURIComponent(key)}}" style="padding:3px 8px;font-size:10px;background:${{bg}};color:${{fg}};border:1px solid ${{active?'transparent':'var(--border)'}};border-radius:4px;cursor:pointer;white-space:nowrap;">${{isMe?'★ ':''}}${{(t.owner||t.name).slice(0,20)}} (${{plCount}})</button>`;
  }});
  html += '</div>';

  // Action bar
  html += '<div style="display:flex;gap:6px;margin-bottom:10px;align-items:center;">';
  html += `<span style="font-size:13px;font-weight:600;">Starting LCV: ${{teamLCV.startingLCV.toFixed(1)}}</span>`;
  html += `<span style="font-size:11px;color:var(--text2);margin-left:8px;">Total: ${{teamLCV.totalLCV.toFixed(1)}} | Players: ${{teamPlayers.length}}</span>`;
  html += '<span style="flex:1;"></span>';
  html += '<button id="optimizeRosterBtn" class="btn btn-secondary" style="padding:3px 10px;font-size:11px;">Optimize</button>';
  html += '<button id="resetRosterBtn" class="btn btn-secondary" style="padding:3px 10px;font-size:11px;">Reset</button>';
  html += '</div>';

  // Main layout: two columns
  html += '<div style="display:flex;gap:16px;align-items:flex-start;">';

  // ── LEFT: Roster table ──
  html += '<div style="flex:1;min-width:0;">';

  // Starting Lineup header
  const batSlotOrder = ['C','1B','2B','3B','SS','LF','CF','RF','DH'];
  html += '<table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:6px;">';
  html += '<thead><tr style="background:var(--surface2);font-size:10px;text-transform:uppercase;color:var(--text2);"><th style="text-align:left;padding:4px 6px;">Slot</th><th style="text-align:left;padding:4px 6px;">Player</th><th style="padding:4px 6px;">Team</th><th style="padding:4px 6px;">Elig</th><th style="text-align:right;padding:4px 6px;">LCV</th><th style="text-align:right;padding:4px 6px;">PNAV</th><th style="text-align:right;padding:4px 6px;">Age</th><th style="width:30px;"></th></tr></thead>';
  html += '<tbody>';

  // Offense section
  html += `<tr><td colspan="7" style="padding:6px 6px 2px;font-weight:700;font-size:11px;color:var(--accent);border-bottom:1px solid var(--border);">OFFENSE (9)</td></tr>`;
  for (const slot of batSlotOrder) {{
    const count = ROSTER_SLOTS[slot] || 1;
    for (let i = 0; i < count; i++) {{
      const p = bySlot[slot][i];
      html += `<tr class="roster-section" data-slot="${{slot}}">${{pRow(p, slot, '').replace(/^<tr[^>]*>|<\\/tr>$/g, '')}}</tr>`;
    }}
  }}

  // Pitching section
  html += `<tr><td colspan="7" style="padding:8px 6px 2px;font-weight:700;font-size:11px;color:var(--green);border-bottom:1px solid var(--border);">PITCHING (${{(bySlot['SP']||[]).length + (bySlot['RP']||[]).length}})</td></tr>`;
  for (const slot of ['SP','RP']) {{
    const count = ROSTER_SLOTS[slot] || 5;
    for (let i = 0; i < count; i++) {{
      const p = bySlot[slot][i];
      html += `<tr class="roster-section" data-slot="${{slot}}">${{pRow(p, slot, '').replace(/^<tr[^>]*>|<\\/tr>$/g, '')}}</tr>`;
    }}
  }}
  html += '</tbody></table>';

  // Bench
  html += `<div style="margin-top:8px;"><span style="font-weight:700;font-size:11px;color:var(--text2);">BENCH (${{bench.length}}/7)</span></div>`;
  html += '<table style="width:100%;border-collapse:collapse;font-size:12px;"><tbody>';
  bench.forEach(p => {{ html += `<tr class="roster-section" data-slot="reserve">${{pRow(p, '', '').replace(/^<tr[^>]*>|<\\/tr>$/g, '')}}</tr>`; }});
  if (bench.length === 0) html += '<tr><td colspan="7" style="padding:4px 6px;color:var(--text2);font-size:11px;">No bench players</td></tr>';
  html += '</tbody></table>';

  // IL
  html += `<div style="margin-top:8px;"><span style="font-weight:700;font-size:11px;color:var(--red);">IL (${{ilPlayers.length}}/4)</span></div>`;
  html += '<table style="width:100%;border-collapse:collapse;font-size:12px;"><tbody>';
  ilPlayers.forEach(p => {{ html += `<tr class="roster-section" data-slot="il">${{pRow(p, 'IL', '<span style="color:var(--red);">IL</span>').replace(/^<tr[^>]*>|<\\/tr>$/g, '')}}</tr>`; }});
  if (ilPlayers.length === 0) html += '<tr><td colspan="7" style="padding:4px 6px;color:var(--text2);font-size:11px;">No IL players</td></tr>';
  html += '</tbody></table>';

  // Minors
  html += `<div style="margin-top:8px;"><span style="font-weight:700;font-size:11px;color:var(--accent);">MINORS (${{teamMilb.length}}/4)</span></div>`;
  html += '<table style="width:100%;border-collapse:collapse;font-size:12px;"><tbody>';
  teamMilb.forEach(name => {{
    const p = ALL.find(x => x.name === name);
    if (p) html += pRow(p, 'MiLB', '<span style="color:var(--accent);">MiLB</span>');
    else html += `<tr><td style="padding:3px 6px;font-weight:600;width:30px;font-size:11px;">MiLB</td><td colspan="6" style="padding:3px 6px;font-size:12px;">${{name}} <span style="color:var(--accent);font-size:10px;">MiLB</span></td></tr>`;
  }});
  if (teamMilb.length === 0) html += '<tr><td colspan="7" style="padding:4px 6px;color:var(--text2);font-size:11px;">No minor leaguers</td></tr>';
  html += '</tbody></table>';

  html += '</div>'; // end left column

  // ── RIGHT: Sidebar ──
  html += '<div style="flex:0 0 300px;">';

  // League LCV standings
  html += '<div style="background:var(--surface2);border-radius:8px;padding:10px;margin-bottom:12px;">';
  html += '<h3 style="font-size:13px;margin-bottom:6px;">League LCV Standings</h3>';
  html += '<table style="width:100%;font-size:11px;border-collapse:collapse;">';
  html += '<tr style="color:var(--text2);"><th style="text-align:left;padding:2px 4px;">#</th><th style="text-align:left;padding:2px 4px;">Team</th><th style="text-align:right;padding:2px 4px;">Start</th><th style="text-align:right;padding:2px 4px;">Total</th></tr>';
  const lcvStats = LEAGUE_TEAMS.map(t => {{
    const pl = t.mine ? (state.myTeam || []) : (state.leagueTeams[t.name] || []);
    const ov = t.mine ? (state.rosterOverrides || {{}}) : (state.leagueRosterOverrides && state.leagueRosterOverrides[t.name] || {{}});
    const stats = calcRosterLCV(pl, ov);
    return {{ name: t.owner || t.name, mine: t.mine, ...stats }};
  }}).sort((a, b) => b.startingLCV - a.startingLCV);
  lcvStats.forEach((t, rank) => {{
    const sty = t.mine ? 'background:rgba(99,102,241,0.1);font-weight:600;' : '';
    html += `<tr style="${{sty}}"><td style="padding:2px 4px;">${{rank+1}}</td><td style="padding:2px 4px;">${{t.name}}${{t.mine?' ★':''}}</td><td style="text-align:right;padding:2px 4px;">${{t.startingLCV.toFixed(1)}}</td><td style="text-align:right;padding:2px 4px;">${{t.totalLCV.toFixed(1)}}</td></tr>`;
  }});
  html += '</table></div>';

  // ── Trade Evaluator (with keeper value) ──
  html += '<div style="background:var(--surface2);border-radius:8px;padding:10px;margin-bottom:12px;">';
  html += '<h3 style="font-size:13px;margin-bottom:4px;">Trade Evaluator</h3>';
  html += '<div style="font-size:10px;color:var(--text2);margin-bottom:6px;">Includes keeper round cost, surplus value, and years of control.</div>';
  html += '<div style="display:flex;gap:8px;">';
  // I Give column
  html += '<div style="flex:1;">';
  html += '<div style="font-weight:600;font-size:11px;color:var(--red);margin-bottom:4px;">I Give</div>';
  html += '<input id="tradeGiveInput" type="text" placeholder="Search player..." style="width:100%;padding:4px 6px;font-size:11px;background:var(--bg);border:1px solid var(--border);border-radius:4px;color:var(--text);box-sizing:border-box;" autocomplete="off">';
  html += '<div id="tradeGiveAC" style="position:relative;"></div>';
  html += '<div id="tradeGiveList" style="margin-top:4px;"></div>';
  html += '</div>';
  // I Get column
  html += '<div style="flex:1;">';
  html += '<div style="font-weight:600;font-size:11px;color:var(--green);margin-bottom:4px;">I Get</div>';
  html += '<input id="tradeGetInput" type="text" placeholder="Search player..." style="width:100%;padding:4px 6px;font-size:11px;background:var(--bg);border:1px solid var(--border);border-radius:4px;color:var(--text);box-sizing:border-box;" autocomplete="off">';
  html += '<div id="tradeGetAC" style="position:relative;"></div>';
  html += '<div id="tradeGetList" style="margin-top:4px;"></div>';
  html += '</div>';
  html += '</div>';
  // Trade summary
  html += '<div id="tradeSummary" style="margin-top:8px;padding:6px;background:var(--bg);border-radius:4px;font-size:11px;display:none;"></div>';
  html += '</div>';

  // Position needs analysis
  html += '<div style="background:var(--surface2);border-radius:8px;padding:10px;">';
  html += '<h3 style="font-size:13px;margin-bottom:6px;">Roster Needs</h3>';
  const myPl = (state.myTeam || []).map(n => ALL.find(x => x.name === n)).filter(Boolean);
  const needs = [];
  for (const [pos, slots] of Object.entries(ROSTER_SLOTS)) {{
    const isPit = ['SP','RP'].includes(pos);
    const pool = isPit ? myPl.filter(p => p.primaryPos === pos) : myPl.filter(p => (p.elig||p.primaryPos||'').split('/').includes(pos));
    const top = pool.sort((a,b) => (b.lcv||0) - (a.lcv||0)).slice(0, slots);
    const avgLcv = top.length > 0 ? top.reduce((s,p) => s + (p.lcv||0), 0) / top.length : 0;
    // Compare to league average at this position
    const leagueAvgs = [];
    LEAGUE_TEAMS.filter(t => !t.mine).forEach(t => {{
      const tPl = (state.leagueTeams[t.name]||[]).map(n => ALL.find(x => x.name === n)).filter(Boolean);
      const tPool = isPit ? tPl.filter(p => p.primaryPos === pos) : tPl.filter(p => (p.elig||p.primaryPos||'').split('/').includes(pos));
      const tTop = tPool.sort((a,b)=>(b.lcv||0)-(a.lcv||0)).slice(0,slots);
      if (tTop.length > 0) leagueAvgs.push(tTop.reduce((s,p)=>s+(p.lcv||0),0)/tTop.length);
    }});
    const leagueAvg = leagueAvgs.length > 0 ? leagueAvgs.reduce((s,v)=>s+v,0)/leagueAvgs.length : 0;
    const diff = avgLcv - leagueAvg;
    needs.push({{ pos, avgLcv, leagueAvg, diff, count: pool.length }});
  }}
  needs.sort((a,b) => a.diff - b.diff);
  html += '<table style="width:100%;font-size:11px;border-collapse:collapse;">';
  html += '<tr style="color:var(--text2);font-size:10px;"><th style="text-align:left;padding:2px 4px;">Pos</th><th style="text-align:right;padding:2px 4px;">My Avg</th><th style="text-align:right;padding:2px 4px;">Lg Avg</th><th style="text-align:right;padding:2px 4px;">Gap</th></tr>';
  needs.forEach(n => {{
    const clr = n.diff >= 1 ? 'var(--green)' : n.diff >= -1 ? 'var(--text)' : 'var(--red)';
    const indicator = n.diff < -1 ? ' ⚠' : n.diff >= 2 ? ' ✓' : '';
    html += `<tr><td style="padding:2px 4px;font-weight:600;">${{n.pos}}</td><td style="text-align:right;padding:2px 4px;">${{n.avgLcv.toFixed(1)}}</td><td style="text-align:right;padding:2px 4px;">${{n.leagueAvg.toFixed(1)}}</td><td style="text-align:right;padding:2px 4px;color:${{clr}};font-weight:600;">${{n.diff > 0 ? '+' : ''}}${{n.diff.toFixed(1)}}${{indicator}}</td></tr>`;
  }});
  html += '</table></div>';

  // ── Transaction Log ──
  html += '<div style="background:var(--surface2);border-radius:8px;padding:10px;margin-top:12px;">';
  html += '<h3 style="font-size:13px;margin-bottom:6px;">Transaction Log</h3>';
  const txns = (state.transactions || []).slice().reverse().slice(0, 15);
  if (txns.length === 0) {{
    html += '<div style="font-size:11px;color:var(--text2);">No transactions yet. Use Free Agents tab to add players, or drop players from roster below.</div>';
  }} else {{
    html += '<div style="max-height:180px;overflow-y:auto;">';
    txns.forEach(tx => {{
      const icon = tx.type === 'add' ? '<span style="color:var(--green);font-weight:700;">+</span>' : tx.type === 'drop' ? '<span style="color:var(--red);font-weight:700;">−</span>' : '<span style="color:var(--accent);font-weight:700;">↔</span>';
      const desc = tx.type === 'add' ? `Added ${{tx.player}} from ${{tx.from||'FA'}}` : tx.type === 'drop' ? `Dropped ${{tx.player}}` : `Trade: ${{tx.desc||''}}`;
      html += `<div style="font-size:10px;padding:2px 0;border-bottom:1px solid var(--border);">${{icon}} <span style="color:var(--text2);">${{tx.date||''}}</span> ${{desc}}</div>`;
    }});
    html += '</div>';
  }}
  html += '</div>';

  html += '</div>'; // end right sidebar
  html += '</div>'; // end flex container

  section.innerHTML = html;
  section.style.display = '';
  document.getElementById('tableWrap').style.display = 'none';

  // ── Wire team selector ──
  section.querySelectorAll('.roster-team-btn').forEach(btn => {{
    btn.addEventListener('click', () => {{
      state._rosterTeam = decodeURIComponent(btn.dataset.team);
      renderRoster();
    }});
  }});

  // ── Optimize button ──
  const optBtn = document.getElementById('optimizeRosterBtn');
  if (optBtn) optBtn.addEventListener('click', () => {{
    const allNames = [...new Set([...teamPlayers, ...teamMilb])];
    const players = allNames.map(n => ALL.find(x => x.name === n)).filter(Boolean);
    const batters = players.filter(p => !['SP','RP'].includes(p.primaryPos)).sort((a,b) => (b.lcv||0) - (a.lcv||0));
    const sps = players.filter(p => p.primaryPos === 'SP').sort((a,b) => (b.lcv||0) - (a.lcv||0));
    const rps = players.filter(p => p.primaryPos === 'RP').sort((a,b) => (b.lcv||0) - (a.lcv||0));
    const nOv = {{}};
    const used = new Set();
    const bs = ['C','1B','2B','3B','SS','LF','CF','RF','DH'];
    for (const s of bs) {{ if (s==='DH') continue; const b = batters.find(p=>p.primaryPos===s&&!used.has(p.name)); if(b){{nOv[b.name]=s;used.add(b.name);}} }}
    for (const s of bs) {{ if (s==='DH'||Object.values(nOv).filter(v=>v===s).length>=(ROSTER_SLOTS[s]||1)) continue; const b=batters.find(p=>{{if(used.has(p.name))return false; return (p.elig||p.primaryPos||'').split('/').includes(s);}}); if(b){{nOv[b.name]=s;used.add(b.name);}} }}
    const dh = batters.find(p => !used.has(p.name)); if(dh){{nOv[dh.name]='DH';used.add(dh.name);}}
    sps.slice(0,5).forEach(p=>{{nOv[p.name]='SP';used.add(p.name);}});
    rps.slice(0,5).forEach(p=>{{nOv[p.name]='RP';used.add(p.name);}});
    allNames.forEach(n=>{{if(!used.has(n)&&!nOv[n])nOv[n]='reserve';}});
    if (isMine) state.rosterOverrides = nOv;
    else state.leagueRosterOverrides[selTeamName] = nOv;
    save();
    renderRoster();
  }});

  // ── Reset button ──
  const resetBtn = document.getElementById('resetRosterBtn');
  if (resetBtn) resetBtn.addEventListener('click', () => {{
    if (isMine) state.rosterOverrides = {{}};
    else delete state.leagueRosterOverrides[selTeamName];
    save();
    renderRoster();
  }});

  // ── Drag & Drop on table rows ──
  section.querySelectorAll('.roster-row[draggable]').forEach(row => {{
    row.addEventListener('dragstart', e => {{
      row.style.opacity = '0.4';
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', decodeURIComponent(row.dataset.player));
    }});
    row.addEventListener('dragend', () => {{
      row.style.opacity = '1';
      section.querySelectorAll('.roster-section.drag-over').forEach(s => s.classList.remove('drag-over'));
    }});
  }});
  section.querySelectorAll('.roster-section').forEach(zone => {{
    zone.addEventListener('dragover', e => {{ e.preventDefault(); e.dataTransfer.dropEffect='move'; zone.style.background='rgba(99,102,241,0.08)'; }});
    zone.addEventListener('dragleave', e => {{ if(!zone.contains(e.relatedTarget)) zone.style.background=''; }});
    zone.addEventListener('drop', e => {{
      e.preventDefault();
      zone.style.background = '';
      const playerName = e.dataTransfer.getData('text/plain');
      if (!playerName) return;
      const targetSlot = zone.dataset.slot;
      const _p = ALL.find(x => x.name === playerName);
      const _isPit = _p && ['SP','RP'].includes(_p.primaryPos);
      const _isHitSlot = ['C','1B','2B','3B','SS','LF','CF','RF','DH'].includes(targetSlot);
      const _isPitSlot = ['SP','RP'].includes(targetSlot);
      if (_isPitSlot && !_isPit) return;
      if (_isHitSlot && _isPit) return;
      if (_p && _isHitSlot && targetSlot !== 'DH') {{
        const positions = (_p.elig || _p.primaryPos || '').split('/');
        if (!positions.includes(targetSlot)) return;
      }}
      if (ROSTER_SLOTS[targetSlot] !== undefined) {{
        const curOv = isMine ? state.rosterOverrides : (state.leagueRosterOverrides[selTeamName]||{{}});
        let slotCount = 0;
        for (const [pn, sl] of Object.entries(curOv)) {{
          if (sl === targetSlot && pn !== playerName && teamPlayers.includes(pn)) slotCount++;
        }}
        teamPlayers.filter(n => n !== playerName && !curOv[n]).forEach(n => {{
          const ap = ALL.find(x => x.name === n);
          if (ap && ap.primaryPos === targetSlot) slotCount++;
        }});
        if (slotCount >= ROSTER_SLOTS[targetSlot]) return;
      }}
      if (isMine) {{ state.rosterOverrides[playerName] = targetSlot; }}
      else {{ if (!state.leagueRosterOverrides[selTeamName]) state.leagueRosterOverrides[selTeamName] = {{}}; state.leagueRosterOverrides[selTeamName][playerName] = targetSlot; }}
      save();
      renderRoster();
    }});
  }});

  // ── Drop buttons (my team only) ──
  if (isMine) {{
    section.querySelectorAll('.drop-btn').forEach(btn => {{
      btn.addEventListener('click', (e) => {{
        e.stopPropagation();
        const nm = decodeURIComponent(btn.dataset.name);
        if (!confirm(`Drop ${{nm}} from your roster?`)) return;
        const idx = (state.myTeam||[]).indexOf(nm);
        if (idx >= 0) state.myTeam.splice(idx, 1);
        // Remove from overrides too
        if (state.rosterOverrides && state.rosterOverrides[nm]) delete state.rosterOverrides[nm];
        // Log transaction
        if (!state.transactions) state.transactions = [];
        state.transactions.push({{ type: 'drop', player: nm, date: new Date().toISOString().slice(0,10) }});
        save();
        renderRoster();
      }});
    }});
  }}

  // ── Trade Evaluator wiring ──
  if (!state._tradeGive) state._tradeGive = [];
  if (!state._tradeGet) state._tradeGet = [];

  function tradePlayerTag(n) {{
    const p = ALL.find(x => x.name === n);
    const ki = getKeeperInfo(n);
    const lcvStr = p ? (p.lcv||0).toFixed(1) : '?';
    const rdStr = ki.draftRound ? `R${{ki.draftRound}}` : 'FA';
    const costStr = ki.keepable2027 ? `→R${{ki.cost2027}}` : '✕';
    const yrsStr = ki.yearsLeft > 0 ? `${{ki.yearsLeft}}yr` : '';
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;font-size:11px;border-bottom:1px solid var(--border);">` +
      `<div><b>${{n}}</b></div>` +
      `<div style="display:flex;gap:6px;align-items:center;">` +
      `<span style="color:var(--text2);">LCV ${{lcvStr}}</span>` +
      `<span style="color:var(--accent);font-size:10px;" title="Draft round → 2027 keeper cost">${{rdStr}}${{costStr}}</span>` +
      `<span style="color:var(--text2);font-size:10px;">${{yrsStr}}</span>` +
      `<span class="trade-remove" data-name="${{encodeURIComponent(n)}}" style="cursor:pointer;color:var(--red);font-weight:700;font-size:10px;margin-left:2px;">✕</span>` +
      `</div></div>`;
  }}

  function wireTradeInput(inputId, acId, listId, arr) {{
    const inp = document.getElementById(inputId);
    const acDiv = document.getElementById(acId);
    const listDiv = document.getElementById(listId);
    if (!inp) return;

    function renderList() {{
      listDiv.innerHTML = arr.map(n => tradePlayerTag(n)).join('');
      listDiv.querySelectorAll('.trade-remove').forEach(btn => {{
        btn.addEventListener('click', () => {{
          const nm = decodeURIComponent(btn.dataset.name);
          const idx = arr.indexOf(nm); if (idx >= 0) arr.splice(idx, 1);
          renderList(); updateTradeSummary();
        }});
      }});
    }}

    inp.addEventListener('input', () => {{
      const q = inp.value.trim().toLowerCase();
      if (q.length < 2) {{ acDiv.innerHTML = ''; return; }}
      const matches = ALL.filter(p => p.name.toLowerCase().includes(q)).slice(0, 8);
      acDiv.innerHTML = '<div style="position:absolute;z-index:100;background:var(--surface);border:1px solid var(--border);border-radius:4px;max-height:160px;overflow-y:auto;width:100%;">' +
        matches.map(p => {{
          const ki = getKeeperInfo(p.name);
          const rdTag = ki.draftRound ? `R${{ki.draftRound}}` : 'FA';
          const costTag = ki.keepable2027 ? `→R${{ki.cost2027}}` : '';
          return `<div class="trade-ac-item" data-name="${{encodeURIComponent(p.name)}}" style="padding:4px 6px;font-size:11px;cursor:pointer;border-bottom:1px solid var(--border);">${{p.name}} <small style="color:var(--text2)">${{p.primaryPos}} LCV:${{(p.lcv||0).toFixed(1)}} ${{rdTag}}${{costTag}}</small></div>`;
        }}).join('') + '</div>';
      acDiv.querySelectorAll('.trade-ac-item').forEach(item => {{
        item.addEventListener('click', () => {{
          const nm = decodeURIComponent(item.dataset.name);
          if (!arr.includes(nm)) arr.push(nm);
          inp.value = ''; acDiv.innerHTML = '';
          renderList(); updateTradeSummary();
        }});
      }});
    }});
    inp.addEventListener('blur', () => {{ setTimeout(() => acDiv.innerHTML = '', 200); }});
    renderList();
  }}

  function updateTradeSummary() {{
    const sumDiv = document.getElementById('tradeSummary');
    if (!sumDiv) return;
    const g = state._tradeGive || [];
    const r = state._tradeGet || [];
    if (g.length === 0 && r.length === 0) {{ sumDiv.style.display = 'none'; return; }}
    sumDiv.style.display = 'block';

    // LCV totals
    const giveLCV = g.reduce((s,n) => {{ const p=ALL.find(x=>x.name===n); return s+(p?(p.lcv||0):0); }}, 0);
    const getLCV = r.reduce((s,n) => {{ const p=ALL.find(x=>x.name===n); return s+(p?(p.lcv||0):0); }}, 0);
    const lcvDiff = getLCV - giveLCV;
    const lcvClr = lcvDiff >= 0 ? 'var(--green)' : 'var(--red)';

    // Keeper surplus totals (multi-year)
    const giveSurplus = g.reduce((s,n) => s + getKeeperInfo(n).multiYearSurplus, 0);
    const getSurplus = r.reduce((s,n) => s + getKeeperInfo(n).multiYearSurplus, 0);
    const surplusDiff = getSurplus - giveSurplus;
    const surpClr = surplusDiff >= 0 ? 'var(--green)' : 'var(--red)';

    // Years of control
    const giveYrs = g.reduce((s,n) => s + getKeeperInfo(n).yearsLeft, 0);
    const getYrs = r.reduce((s,n) => s + getKeeperInfo(n).yearsLeft, 0);
    const yrsDiff = getYrs - giveYrs;

    // Simulate post-trade roster LCV
    const myNames = [...(state.myTeam || [])];
    g.forEach(n => {{ const idx = myNames.indexOf(n); if (idx >= 0) myNames.splice(idx, 1); }});
    r.forEach(n => {{ if (!myNames.includes(n)) myNames.push(n); }});
    const preLCV = calcRosterLCV(state.myTeam || [], state.rosterOverrides || {{}});
    const postLCV = calcOptimalLCV(myNames);
    const rosterDiff = postLCV.startingLCV - preLCV.startingLCV;
    const rClr = rosterDiff >= 0 ? 'var(--green)' : 'var(--red)';

    // Build summary HTML
    let sh = '<div style="font-weight:700;font-size:12px;margin-bottom:6px;">Trade Summary</div>';

    // Comparison table for each side
    sh += '<table style="width:100%;font-size:10px;border-collapse:collapse;margin-bottom:6px;">';
    sh += '<tr style="color:var(--text2);border-bottom:1px solid var(--border);"><th style="text-align:left;padding:2px;">Metric</th><th style="text-align:right;padding:2px;">I Give</th><th style="text-align:right;padding:2px;">I Get</th><th style="text-align:right;padding:2px;">Net</th></tr>';

    sh += `<tr><td style="padding:2px;">LCV (production)</td><td style="text-align:right;padding:2px;">${{giveLCV.toFixed(1)}}</td><td style="text-align:right;padding:2px;">${{getLCV.toFixed(1)}}</td><td style="text-align:right;padding:2px;color:${{lcvClr}};font-weight:700;">${{lcvDiff>=0?'+':''}}${{lcvDiff.toFixed(1)}}</td></tr>`;

    sh += `<tr><td style="padding:2px;">Keeper Surplus (multi-yr)</td><td style="text-align:right;padding:2px;">${{giveSurplus.toFixed(1)}}</td><td style="text-align:right;padding:2px;">${{getSurplus.toFixed(1)}}</td><td style="text-align:right;padding:2px;color:${{surpClr}};font-weight:700;">${{surplusDiff>=0?'+':''}}${{surplusDiff.toFixed(1)}}</td></tr>`;

    sh += `<tr><td style="padding:2px;">Years of Control</td><td style="text-align:right;padding:2px;">${{giveYrs}}</td><td style="text-align:right;padding:2px;">${{getYrs}}</td><td style="text-align:right;padding:2px;font-weight:600;">${{yrsDiff>=0?'+':''}}${{yrsDiff}}</td></tr>`;

    sh += `<tr style="border-top:1px solid var(--border);"><td style="padding:2px;font-weight:600;">Roster LCV impact</td><td colspan="2"></td><td style="text-align:right;padding:2px;color:${{rClr}};font-weight:700;">${{rosterDiff>=0?'+':''}}${{rosterDiff.toFixed(1)}}</td></tr>`;
    sh += '</table>';

    sh += `<div style="color:var(--text2);font-size:10px;">Post-trade starting LCV: ${{postLCV.startingLCV.toFixed(1)}} (current: ${{preLCV.startingLCV.toFixed(1)}})</div>`;

    // Verdict
    const isWin = lcvDiff > 0 && surplusDiff > 0;
    const isLoss = lcvDiff < -1 && surplusDiff < -1;
    const isMixed = (lcvDiff > 0 && surplusDiff < 0) || (lcvDiff < 0 && surplusDiff > 0);
    if (isWin) sh += `<div style="margin-top:4px;padding:3px 6px;background:rgba(34,197,94,0.1);border-radius:4px;font-size:11px;font-weight:600;color:var(--green);">Win — you gain both production and keeper value</div>`;
    else if (isLoss) sh += `<div style="margin-top:4px;padding:3px 6px;background:rgba(239,68,68,0.1);border-radius:4px;font-size:11px;font-weight:600;color:var(--red);">Loss — you lose production and keeper value</div>`;
    else if (isMixed) {{
      if (lcvDiff > 0) sh += `<div style="margin-top:4px;padding:3px 6px;background:rgba(234,179,8,0.1);border-radius:4px;font-size:11px;color:var(--text);">Win-now trade — better production but less keeper value</div>`;
      else sh += `<div style="margin-top:4px;padding:3px 6px;background:rgba(234,179,8,0.1);border-radius:4px;font-size:11px;color:var(--text);">Dynasty trade — less production now but better keeper value</div>`;
    }}

    sumDiv.innerHTML = sh;
  }}

  wireTradeInput('tradeGiveInput', 'tradeGiveAC', 'tradeGiveList', state._tradeGive);
  wireTradeInput('tradeGetInput', 'tradeGetAC', 'tradeGetList', state._tradeGet);
  updateTradeSummary();
}}

// ── Draft log view ────────────────────────────────────────────────────────
function renderDraftLog() {{
  const section = document.getElementById('rosterSection');
  const entries = Object.entries(state.drafted).sort((a,b) => a[1].time - b[1].time);
  let html = '<h2 style="margin-bottom:8px;">Draft Log</h2>';
  html += '<p style="font-size:12px;color:var(--text2);margin-bottom:12px;">Live record of all drafted players (keepers + draft picks). Use the draft bar above on any tab to mark players as drafted. Click <b>Undo</b> to remove a pick. The player tables, Draft Capital, and Mock Draft all update automatically.</p>';
  html += '<table><thead><tr><th style="width:40px">#</th><th>Player</th><th>Team</th><th>Pos</th><th>Rd</th><th>LCV</th><th>Pick</th><th>Mine</th><th></th></tr></thead><tbody>';
  entries.forEach(([name, info], i) => {{
    const p = ALL.find(x => x.name === name);
    const rd = state.keeperRounds && state.keeperRounds[name];
    html += `<tr><td>${{i+1}}</td><td style="font-weight:600">${{name}}</td><td>${{p?p.team:''}}</td><td>${{p?p.primaryPos:''}}</td><td style="color:var(--accent)">${{rd||''}}</td><td>${{p?(p.lcv).toFixed(2):''}}</td><td>${{p?(p.dp).toFixed(2):''}}</td><td>${{info.mine?'<span style="color:var(--green)">Yes</span>':''}}</td><td><button class="btn btn-secondary undo-btn" style="padding:2px 8px;font-size:11px;" data-name="${{encodeURIComponent(name)}}">Undo</button></td></tr>`;
  }});
  html += '</tbody></table>';
  section.innerHTML = html;
  section.querySelectorAll('.undo-btn').forEach(btn => {{
    btn.addEventListener('click', () => undraftPlayer(decodeURIComponent(btn.dataset.name)));
  }});
  section.style.display = '';
  document.getElementById('tableWrap').style.display = 'none';
}}

// ── Draft Board view ──────────────────────────────────────────────────────
function renderDraftBoard() {{
  const section = document.getElementById('rosterSection');
  const TOTAL_ROUNDS = 31;

  // Build keeper map: round -> [{{name, pos, team, mine, teamPick}}]
  // Assign each keeper to the specific pick slot of the team that owns them
  const keeperGrid = {{}};  // round -> pickSlot(1-12) -> keeper info
  for (let r = 1; r <= TOTAL_ROUNDS; r++) keeperGrid[r] = {{}};

  // Place keepers directly from DEFAULT_LEAGUE_KEEPERS (authoritative source)
  for (const [teamName, keepers] of Object.entries(DEFAULT_LEAGUE_KEEPERS)) {{
    const team = LEAGUE_TEAMS.find(t => t.name === teamName);
    if (!team) continue;
    keepers.forEach(k => {{
      const rd = k.rd;
      if (rd && rd >= 1 && rd <= TOTAL_ROUNDS) {{
        const p = ALL.find(x => x.name === k.name) || ALL.find(x => _norm(x.name) === _norm(k.name));
        const nm = p ? p.name : k.name;
        keeperGrid[rd][team.pick] = {{
          name: nm, pos: p ? p.primaryPos : '?', team: p ? p.team : '',
          mine: team.mine, ownerTeam: teamName, ownerPick: team.pick
        }};
      }}
    }});
  }}

  const myKeeperRds = new Set((state.keepers || []).map(k => state.keeperRounds && state.keeperRounds[k]).filter(Boolean));

  // ── Mock draft simulation for empty slots ──────────────────────────────
  const sim = simulateDraft();
  // Build a lookup: teamName+round -> simulated player
  const mockLookup = {{}};
  for (const [teamName, picks] of Object.entries(sim.teamResults)) {{
    picks.forEach(pk => {{
      mockLookup[teamName + '|' + pk.round] = pk;
    }});
  }}

  // State for mock visibility
  const showMock = state._boardShowMock || false;

  let html = '<h2 style="margin-bottom:8px;">Draft Board</h2>';
  html += `<p style="font-size:12px;color:var(--text2);margin-bottom:8px;">Snake draft, pick <b>#${{DRAFT_POS}}</b>. Each cell = one pick. <span style="color:var(--accent)">Purple</span> = your keepers. Gray = other teams' keepers. Empty cells = open picks.</p>`;

  html += `<div style="margin-bottom:12px;display:flex;gap:8px;align-items:center;">`;
  html += `<button id="boardMockToggle" class="btn ${{showMock ? 'btn-primary' : 'btn-secondary'}}" style="padding:4px 14px;font-size:12px;">${{showMock ? 'Hide Mock Draft' : 'Show Mock Draft'}}</button>`;
  html += `<span style="font-size:11px;color:var(--text2);">${{showMock ? 'BPA simulation fills empty slots. Your projected picks highlighted.' : 'Toggle to preview BPA picks in empty slots.'}}</span>`;
  html += `</div>`;

  // ── Grid: columns = pick slots 1-12, rows = rounds ──────────────────
  html += `<div style="overflow-x:auto;"><table class="board-grid" style="width:100%;border-collapse:collapse;font-size:11px;">`;
  html += '<thead><tr><th style="width:50px;padding:4px;">Rd</th>';
  for (let slot = 1; slot <= TEAMS; slot++) {{
    // Which team picks at slot 1 in odd rounds? That's team with pick=slot
    // But in even rounds, slot 1 = team with pick 12. We just label by slot number.
    const team = LEAGUE_TEAMS.find(t => t.pick === slot);
    const isMe = team && team.mine;
    const bg = isMe ? 'background:rgba(99,102,241,0.1);' : '';
    html += `<th style="padding:4px;text-align:center;${{bg}}font-size:10px;" title="${{team ? team.name : ''}}">${{isMe ? '<b style="color:var(--accent)">YOU</b>' : '#' + slot}}</th>`;
  }}
  html += '<th style="width:50px;padding:4px;text-align:center;">Open</th>';
  html += '</tr></thead><tbody>';

  let myDraftPicks = 0, myKeeperPicks = 0;

  for (let r = 1; r <= TOTAL_ROUNDS; r++) {{
    const isEven = r % 2 === 0;
    const mySlot = isEven ? (TEAMS - DRAFT_POS + 1) : DRAFT_POS;
    const isMyKeeperRd = myKeeperRds.has(r);
    if (isMyKeeperRd) myKeeperPicks++; else myDraftPicks++;

    let openCount = 0;
    html += `<tr>`;
    html += `<td style="font-weight:700;padding:4px;text-align:center;background:var(--surface2);">Rd ${{r}}</td>`;

    for (let col = 1; col <= TEAMS; col++) {{
      // col = team pick position (fixed column per team)
      const team = LEAGUE_TEAMS.find(t => t.pick === col);
      const isMe = team && team.mine;
      const keeper = keeperGrid[r][col];

      let cellBg = '', cellContent = '', cellTitle = '';

      // Compute overall pick number: in odd rounds team picks at slot=col, in even rounds slot=TEAMS-col+1
      const slot = isEven ? (TEAMS - col + 1) : col;
      const overallPick = (r - 1) * TEAMS + slot;
      const livePick = LIVE_PICK_ORDER[overallPick];

      if (keeper) {{
        // Keeper slot
        if (keeper.mine) {{
          cellBg = 'background:rgba(99,102,241,0.15);outline:2px solid #3b82f6;outline-offset:-2px;';
          cellContent = `<span style="color:var(--accent);font-weight:700;">${{keeper.name}}</span><br><small style="opacity:0.6">${{keeper.pos}} K</small>`;
        }} else {{
          cellBg = 'background:var(--surface2);outline:2px solid #3b82f6;outline-offset:-2px;';
          cellContent = `<span style="font-weight:600;opacity:0.7;">${{keeper.name}}</span><br><small style="opacity:0.5">${{keeper.pos}} K</small>`;
        }}
        cellTitle = `${{keeper.name}} (${{keeper.pos}}) — kept by ${{keeper.ownerTeam}}`;
      }} else if (livePick) {{
        // Live draft pick from CBS
        const lp = ALL.find(x => x.name === livePick.name);
        const pos = lp ? lp.primaryPos : '';
        const lcv = lp ? (lp.lcv||0).toFixed(1) : '';
        const enoR = lp && lp.eno_rank ? ' P' + lp.eno_rank : '';
        if (livePick.mine) {{
          cellBg = 'background:rgba(34,197,94,0.15);border:2px solid rgba(34,197,94,0.4);';
          cellContent = `<span style="color:#22c55e;font-weight:700;">${{livePick.name}}</span><br><small style="opacity:0.7">${{pos}} ${{lcv}}${{enoR}}</small>`;
        }} else {{
          cellBg = 'background:rgba(239,68,68,0.08);';
          cellContent = `<span style="font-weight:600;opacity:0.85;">${{livePick.name}}</span><br><small style="opacity:0.5">${{pos}} ${{lcv}}${{enoR}}</small>`;
        }}
        cellTitle = `Pick #${{overallPick}}: ${{livePick.name}} (${{pos}}) LCV=${{lcv}}`;
      }} else {{
        // Empty/open slot
        openCount++;
        if (showMock && team) {{
          const mockPick = mockLookup[team.name + '|' + r];
          if (mockPick) {{
            if (isMe) {{
              cellBg = 'background:rgba(99,102,241,0.08);border:2px dashed var(--accent);';
              cellContent = `<span style="color:var(--accent);font-weight:600;">${{mockPick.name}}</span><br><small style="opacity:0.6">${{mockPick.pos}} ${{mockPick.dp.toFixed(1)}}</small>`;
            }} else {{
              cellBg = 'background:rgba(255,255,255,0.02);border:1px dashed var(--border);';
              cellContent = `<span style="opacity:0.5;">${{mockPick.name}}</span><br><small style="opacity:0.35">${{mockPick.pos}}</small>`;
            }}
            cellTitle = `Mock: ${{mockPick.name}} (${{mockPick.pos}}) DP=${{mockPick.dp.toFixed(1)}}`;
          }} else {{
            cellBg = isMe ? 'background:rgba(99,102,241,0.04);border:1px dashed var(--border);' : 'border:1px dashed var(--border);opacity:0.3;';
            cellContent = '—';
          }}
        }} else {{
          cellBg = isMe ? 'background:rgba(99,102,241,0.04);' : '';
          cellContent = `<span style="opacity:0.15;">—</span>`;
        }}
      }}

      html += `<td style="padding:3px 4px;text-align:center;vertical-align:top;min-width:70px;${{cellBg}}" title="${{cellTitle}}">${{cellContent}}</td>`;
    }}

    // Open count for this round
    const openClr = openCount >= 8 ? 'var(--green)' : openCount >= 4 ? 'var(--yellow)' : openCount > 0 ? 'var(--orange)' : 'var(--red)';
    html += `<td style="padding:4px;text-align:center;font-weight:700;color:${{openClr}};background:var(--surface2);">${{openCount}}</td>`;
    html += '</tr>';
  }}
  // ── MiLB Keeper rows below draft grid ──
  // One row per MiLB slot (up to 4), columns aligned to teams
  const maxMilb = 4;
  for (let mi = 0; mi < maxMilb; mi++) {{
    html += `<tr>`;
    html += `<td style="font-weight:700;padding:4px;text-align:center;background:var(--surface2);font-size:10px;">${{mi === 0 ? 'MiLB' : ''}}</td>`;
    for (let col = 1; col <= TEAMS; col++) {{
      const team = LEAGUE_TEAMS.find(t => t.pick === col);
      const isMe = team && team.mine;
      const milbList = isMe ? (state.milbKeepers || []) : (DEFAULT_LEAGUE_MILB_KEEPERS[team.name] || []);
      const rk = milbList[mi];
      if (rk) {{
        const p = ALL.find(x => x.name === rk) || ALL.find(x => _norm(x.name) === _norm(rk));
        const pos = p ? p.primaryPos : '?';
        const pnav = p ? (p.pnav||0).toFixed(1) : '';
        const bg = isMe ? 'background:rgba(99,102,241,0.12);' : 'background:rgba(245,158,11,0.08);';
        const clr = isMe ? 'color:var(--accent);' : 'color:var(--orange);';
        html += `<td style="padding:3px 4px;text-align:center;vertical-align:top;min-width:70px;${{bg}}" title="${{rk}} (${{pos}}) MiLB keeper"><span style="font-weight:600;font-size:10px;${{clr}}">${{rk}}</span><br><small style="opacity:0.5;font-size:9px;">${{pos}} ${{pnav}}</small></td>`;
      }} else {{
        html += `<td style="padding:3px 4px;text-align:center;opacity:0.15;">—</td>`;
      }}
    }}
    html += `<td style="background:var(--surface2);"></td>`;
    html += '</tr>';
  }}

  html += '</tbody></table></div>';

  // Summary stats
  const totalKept = Object.keys(state.keeperRounds || {{}}).length;
  const myKept = (state.keepers || []).length;
  html += `<div style="margin-top:16px;padding:12px;background:var(--surface2);border-radius:8px;font-size:13px;line-height:1.8;">`;
  html += `<b>Your draft position:</b> #${{DRAFT_POS}} overall (snake) &nbsp;|&nbsp; `;
  html += `<b>Odd rounds:</b> pick ${{DRAFT_POS}} &nbsp;|&nbsp; <b>Even rounds:</b> pick ${{TEAMS - DRAFT_POS + 1}}<br>`;
  html += `<b>Total keepers:</b> ${{totalKept}} (yours: ${{myKept}}, other teams: ${{totalKept - myKept}}) &nbsp;|&nbsp; `;
  html += `<b>Your picks:</b> ${{myKeeperPicks}} keepers + ${{myDraftPicks}} open = ${{TOTAL_ROUNDS}} rounds`;
  html += `</div>`;

  // ── My Roster + Live League LCV panels ──────────────────────────────
  html += '<div style="display:flex;gap:16px;margin-top:16px;">';

  // My Roster panel
  const myTeam = state.myTeam || [];
  const myKeepNamesB = new Set(state.keepers || []);
  const rSlots = {{C:1,'1B':1,'2B':1,'3B':1,SS:1,LF:1,CF:1,RF:1,DH:1,SP:5,RP:5}};
  const rPlayers = myTeam.map(n => ALL.find(x => x.name === n)).filter(Boolean);
  const sAssign = {{}};
  for (const pos of Object.keys(rSlots)) sAssign[pos] = [];
  const pend = [];
  rPlayers.forEach(p => {{
    const pos = p.primaryPos;
    if (sAssign[pos] && sAssign[pos].length < rSlots[pos]) sAssign[pos].push(p);
    else pend.push(p);
  }});
  pend.forEach(p => {{
    const positions = (p.elig || p.primaryPos || '').split('/');
    let placed = false;
    for (const pos of positions) {{
      if (pos !== p.primaryPos && sAssign[pos] && sAssign[pos].length < rSlots[pos]) {{
        sAssign[pos].push(p); placed = true; break;
      }}
    }}
    if (!placed && !['SP','RP'].includes(p.primaryPos) && sAssign['DH'].length < rSlots['DH']) {{
      sAssign['DH'].push(p);
    }}
  }});
  const boardLCV = calcRosterLCV(myTeam, state.rosterOverrides || {{}});
  html += '<div style="flex:1;background:var(--surface2);border-radius:8px;padding:12px;">';
  html += `<h3 style="font-size:14px;margin-bottom:8px;color:var(--accent);">My Roster (${{myTeam.length}} players, LCV: ${{boardLCV.startingLCV.toFixed(1)}})</h3>`;
  html += '<div style="display:flex;flex-wrap:wrap;gap:4px;">';
  for (const [pos, players] of Object.entries(sAssign)) {{
    const count = rSlots[pos];
    for (let i = 0; i < count; i++) {{
      const p = players[i];
      if (p) {{
        const isK = myKeepNamesB.has(p.name);
        const bg = isK ? 'rgba(99,102,241,0.15)' : 'rgba(16,185,129,0.15)';
        const brd = isK ? 'var(--accent)' : 'var(--green)';
        const eTag = p.eno_rank ? ` <span class="eno-rank" style="font-size:8px;">P${{p.eno_rank}}</span>` : '';
        html += `<div style="background:${{bg}};border:1px solid ${{brd}};border-radius:4px;padding:3px 8px;font-size:11px;white-space:nowrap;">`;
        html += `<b style="color:var(--text2);">${{pos}}</b> ${{p.name}}${{eTag}} <small style="opacity:0.6">${{(p.lcv||0).toFixed(1)}}</small>`;
        if (isK) html += ' <small style="color:var(--accent);">K</small>';
        html += '</div>';
      }} else {{
        html += `<div style="background:var(--bg);border:1px dashed var(--border);border-radius:4px;padding:3px 8px;font-size:11px;color:var(--text2);">`;
        html += `<b>${{pos}}</b> —</div>`;
      }}
    }}
  }}
  html += '</div></div>';

  // Live League LCV panel
  html += '<div style="flex:0 0 320px;background:var(--surface2);border-radius:8px;padding:12px;">';
  html += '<h3 style="font-size:14px;margin-bottom:8px;">Live League LCV</h3>';
  html += '<table style="width:100%;font-size:12px;border-collapse:collapse;">';
  html += '<tr style="color:var(--text2);"><th style="text-align:left;padding:3px 6px;">#</th><th style="text-align:left;padding:3px 6px;">Team</th><th style="text-align:right;padding:3px 6px;">Start</th><th style="text-align:right;padding:3px 6px;">Total</th></tr>';
  const bLeagueStats = LEAGUE_TEAMS.map(t => {{
    const pl = t.mine ? (state.myTeam || []) : (state.leagueTeams[t.name] || []);
    const ov = t.mine ? (state.rosterOverrides || {{}}) : (state.leagueRosterOverrides && state.leagueRosterOverrides[t.name] || {{}});
    const stats = calcRosterLCV(pl, ov);
    return {{ name: t.owner || t.name, mine: t.mine, ...stats }};
  }}).sort((a, b) => b.startingLCV - a.startingLCV);
  bLeagueStats.forEach((t, rank) => {{
    const sty = t.mine ? 'background:rgba(99,102,241,0.1);font-weight:600;' : '';
    html += `<tr style="${{sty}}"><td style="padding:3px 6px;">${{rank+1}}</td><td style="padding:3px 6px;">${{t.name}}${{t.mine?' ★':''}}</td><td style="text-align:right;padding:3px 6px;">${{t.startingLCV.toFixed(1)}}</td><td style="text-align:right;padding:3px 6px;">${{t.totalLCV.toFixed(1)}}</td></tr>`;
  }});
  html += '</table></div>';
  html += '</div>'; // end flex container

  section.innerHTML = html;

  // Mock draft toggle
  document.getElementById('boardMockToggle').addEventListener('click', () => {{
    state._boardShowMock = !state._boardShowMock;
    renderDraftBoard();
  }});

  // Undo buttons in the picks list
  section.querySelectorAll('.board-undo-btn').forEach(btn => {{
    btn.addEventListener('click', (e) => {{
      e.stopPropagation();
      undraftPlayer(decodeURIComponent(btn.dataset.name));
    }});
  }});

  section.style.display = '';
  document.getElementById('tableWrap').style.display = 'none';
}}

// ── League comparison view ────────────────────────────────────────────────
function calcOptimalLCV(playerNames) {{
  // Given a list of player names, compute the best possible starting lineup LCV
  // by assigning players to roster slots optimally
  const players = playerNames.map(n => ALL.find(x => x.name === n)).filter(Boolean);
  const batters = players.filter(p => !['SP','RP'].includes(p.primaryPos));
  const sps = players.filter(p => p.primaryPos === 'SP');
  const rps = players.filter(p => p.primaryPos === 'RP');

  // Sort each pool by LCV descending
  batters.sort((a,b) => (b.lcv||0) - (a.lcv||0));
  sps.sort((a,b) => (b.lcv||0) - (a.lcv||0));
  rps.sort((a,b) => (b.lcv||0) - (a.lcv||0));

  // Greedy assignment for batting positions
  const batSlots = ['C','1B','2B','3B','SS','LF','CF','RF','DH'];
  const filled = {{}};
  const used = new Set();

  // Pass 1: assign best player to each position by primary pos
  for (const slot of batSlots) {{
    if (slot === 'DH') continue; // fill DH last
    const best = batters.find(p => p.primaryPos === slot && !used.has(p.name));
    if (best) {{ filled[slot] = best; used.add(best.name); }}
  }}

  // Pass 2: try multi-position eligibility for empty slots
  for (const slot of batSlots) {{
    if (slot === 'DH' || filled[slot]) continue;
    const best = batters.find(p => {{
      if (used.has(p.name)) return false;
      const positions = (p.elig || p.primaryPos || '').split('/');
      return positions.includes(slot);
    }});
    if (best) {{ filled[slot] = best; used.add(best.name); }}
  }}

  // Pass 3: DH = best unused batter
  if (!filled['DH']) {{
    const best = batters.find(p => !used.has(p.name));
    if (best) {{ filled['DH'] = best; used.add(best.name); }}
  }}

  // Pitchers: top 5 SP, top 5 RP by LCV
  const startingSP = sps.slice(0, 5);
  const startingRP = rps.slice(0, 5);

  let startingLCV = 0;
  for (const p of Object.values(filled)) startingLCV += (p.lcv || 0);
  for (const p of startingSP) startingLCV += (p.lcv || 0);
  for (const p of startingRP) startingLCV += (p.lcv || 0);

  let totalLCV = 0;
  for (const p of players) totalLCV += (p.lcv || 0);

  return {{ startingLCV, totalLCV, count: players.length }};
}}

function calcRosterLCV(playerNames, overrides) {{
  // Like calcOptimalLCV but respects manual roster overrides.
  // Players overridden to 'il' or 'reserve' are excluded from starting LCV.
  // Players overridden to a position slot are locked there first.
  if (!overrides || Object.keys(overrides).length === 0) {{
    return calcOptimalLCV(playerNames);
  }}

  const players = playerNames.map(n => ALL.find(x => x.name === n)).filter(Boolean);
  const used = new Set();
  const filledBat = {{}};
  const filledSP = [];
  const filledRP = [];

  // First: place all overridden players into their assigned slots
  players.forEach(p => {{
    const ov = overrides[p.name];
    if (!ov) return;
    if (ov === 'il' || ov === 'reserve') {{ used.add(p.name); return; }}
    if (ov === 'SP') {{ filledSP.push(p); used.add(p.name); return; }}
    if (ov === 'RP') {{ filledRP.push(p); used.add(p.name); return; }}
    // Batting slot override
    if (['C','1B','2B','3B','SS','LF','CF','RF','DH'].includes(ov)) {{
      if (!filledBat[ov]) filledBat[ov] = [];
      filledBat[ov].push(p);
      used.add(p.name);
    }}
  }});

  // Remaining unassigned players get optimally placed in empty slots
  const remaining = players.filter(p => !used.has(p.name));
  const batters = remaining.filter(p => !['SP','RP'].includes(p.primaryPos)).sort((a,b) => (b.lcv||0) - (a.lcv||0));
  const sps = remaining.filter(p => p.primaryPos === 'SP').sort((a,b) => (b.lcv||0) - (a.lcv||0));
  const rps = remaining.filter(p => p.primaryPos === 'RP').sort((a,b) => (b.lcv||0) - (a.lcv||0));

  const batSlots = ['C','1B','2B','3B','SS','LF','CF','RF','DH'];
  for (const slot of batSlots) {{
    if (slot === 'DH') continue;
    const have = (filledBat[slot] || []).length;
    if (have >= (ROSTER_SLOTS[slot] || 1)) continue;
    const best = batters.find(p => p.primaryPos === slot && !used.has(p.name));
    if (best) {{
      if (!filledBat[slot]) filledBat[slot] = [];
      filledBat[slot].push(best); used.add(best.name);
    }}
  }}
  for (const slot of batSlots) {{
    if (slot === 'DH') continue;
    const have = (filledBat[slot] || []).length;
    if (have >= (ROSTER_SLOTS[slot] || 1)) continue;
    const best = batters.find(p => {{
      if (used.has(p.name)) return false;
      return (p.elig || p.primaryPos || '').split('/').includes(slot);
    }});
    if (best) {{
      if (!filledBat[slot]) filledBat[slot] = [];
      filledBat[slot].push(best); used.add(best.name);
    }}
  }}
  if (!(filledBat['DH'] || []).length || (filledBat['DH'] || []).length < (ROSTER_SLOTS['DH'] || 1)) {{
    const best = batters.find(p => !used.has(p.name));
    if (best) {{
      if (!filledBat['DH']) filledBat['DH'] = [];
      filledBat['DH'].push(best); used.add(best.name);
    }}
  }}

  // Fill remaining SP/RP slots
  while (filledSP.length < 5 && sps.length) {{
    const sp = sps.shift();
    if (!used.has(sp.name)) {{ filledSP.push(sp); used.add(sp.name); }}
  }}
  while (filledRP.length < 5 && rps.length) {{
    const rp = rps.shift();
    if (!used.has(rp.name)) {{ filledRP.push(rp); used.add(rp.name); }}
  }}

  let startingLCV = 0;
  for (const arr of Object.values(filledBat)) {{
    for (const p of arr) startingLCV += (p.lcv || 0);
  }}
  for (const p of filledSP.slice(0, 5)) startingLCV += (p.lcv || 0);
  for (const p of filledRP.slice(0, 5)) startingLCV += (p.lcv || 0);

  let totalLCV = 0;
  for (const p of players) totalLCV += (p.lcv || 0);

  return {{ startingLCV, totalLCV, count: players.length }};
}}

// ── Interactive Mock Draft ─────────────────────────────────────────────────
let mockState = null; // {{picks:[], currentPick:0, userTeamIdx:1, available:[], paused:false, speed:'normal', draftOrder:[]}}

function initMockDraft() {{
  const TOTAL_ROUNDS = 31;
  const NTEAMS = 12;

  // Keepers: gather all kept player names and their rounds
  const keptNames = new Set();
  const keeperSlots = {{}}; // teamIdx -> Set of rounds used by keepers
  LEAGUE_TEAMS.forEach((t, idx) => {{
    const pl = t.mine ? (state.keepers || []) : (state.leagueTeams[t.name] || []);
    keeperSlots[idx] = new Set();
    pl.forEach(n => {{
      keptNames.add(n);
      const rd = state.keeperRounds[n];
      if (rd) keeperSlots[idx].add(rd);
    }});
  }});

  // Build available pool sorted by DP
  const available = ALL.filter(p => !keptNames.has(p.name))
    .map(p => ({{ name:p.name, pos:p.primaryPos||'?', team:p.team||'', dp:p.dp||0, lcv:p.lcv||0, pnav:p.pnav||0, trend:p.trend, type:p.type }}))
    .sort((a,b) => b.dp - a.dp);

  // Build snake draft order: list of {{round, overall, teamIdx, teamName}}
  const draftOrder = [];
  for (let rd = 1; rd <= TOTAL_ROUNDS; rd++) {{
    for (let slot = 1; slot <= NTEAMS; slot++) {{
      const teamPick = rd % 2 === 1 ? slot : (NTEAMS - slot + 1);
      const teamIdx = LEAGUE_TEAMS.findIndex(t => t.pick === teamPick);
      if (keeperSlots[teamIdx] && keeperSlots[teamIdx].has(rd)) continue; // keeper in this slot
      draftOrder.push({{ round: rd, overall: draftOrder.length + 1, teamIdx, teamName: LEAGUE_TEAMS[teamIdx].name }});
    }}
  }}

  const userTeamIdx = LEAGUE_TEAMS.findIndex(t => t.mine);

  // Build team rosters starting with keepers
  const teamRosters = {{}};
  LEAGUE_TEAMS.forEach((t, idx) => {{
    const pl = t.mine ? (state.keepers || []) : (state.leagueTeams[t.name] || []);
    teamRosters[idx] = [...pl];
  }});

  mockState = {{
    picks: [],        // [{{name, pos, team, dp, lcv, pnav, teamIdx, teamName, round, overall, isUser}}]
    currentPick: 0,
    userTeamIdx,
    available: available,
    paused: false,
    speed: 'normal',  // 'instant', 'normal', 'slow'
    draftOrder,
    keeperSlots,
    timer: null,
    sortCol: 'dp',
    sortDir: -1,
    teamRosters
  }};
}}

function mockPickBPA() {{
  if (!mockState || mockState.currentPick >= mockState.draftOrder.length) return null;
  const slot = mockState.draftOrder[mockState.currentPick];
  if (slot.teamIdx === mockState.userTeamIdx) return null; // user's turn
  const pick = mockState.available.shift();
  if (!pick) return null;
  const entry = {{ ...pick, teamIdx: slot.teamIdx, teamName: slot.teamName, round: slot.round, overall: slot.overall, isUser: false }};
  mockState.picks.push(entry);
  mockState.teamRosters[slot.teamIdx].push(pick.name);
  mockState.currentPick++;
  // ── Realtime sync: mark other team's pick as drafted on main board ──
  if (!state.drafted[pick.name]) {{
    state.drafted[pick.name] = {{ time: Date.now(), mine: false }};
    save();
  }}
  return entry;
}}

function mockPickUser(playerName) {{
  if (!mockState) return;
  const slot = mockState.draftOrder[mockState.currentPick];
  if (slot.teamIdx !== mockState.userTeamIdx) return;
  const idx = mockState.available.findIndex(p => p.name === playerName);
  if (idx === -1) return;
  const pick = mockState.available.splice(idx, 1)[0];
  const entry = {{ ...pick, teamIdx: slot.teamIdx, teamName: slot.teamName, round: slot.round, overall: slot.overall, isUser: true }};
  mockState.picks.push(entry);
  mockState.teamRosters[slot.teamIdx].push(pick.name);
  mockState.currentPick++;
  // ── Realtime sync: apply pick to main draft board immediately ──
  if (!state.drafted[playerName]) {{
    state.drafted[playerName] = {{ time: Date.now(), mine: true }};
    if (!state.myTeam.includes(playerName)) state.myTeam.push(playerName);
    save();
  }}
}}

function runMockUntilUserTurn(cb) {{
  if (!mockState) return;
  function step() {{
    if (mockState.currentPick >= mockState.draftOrder.length) {{ cb(); return; }}
    const slot = mockState.draftOrder[mockState.currentPick];
    if (slot.teamIdx === mockState.userTeamIdx) {{ cb(); return; }}
    mockPickBPA();
    if (mockState.speed === 'instant') {{ step(); }}
    else {{
      const delay = mockState.speed === 'slow' ? 300 : 80;
      mockState.timer = setTimeout(() => {{ renderMockDraftUI(); step(); }}, delay);
    }}
  }}
  step();
}}

function renderMockDraft() {{
  const section = document.getElementById('rosterSection');

  // If no mock in progress, show start screen
  if (!mockState) {{
    let html = '<h2 style="margin-bottom:12px;">Interactive Mock Draft</h2>';
    html += '<p style="color:var(--text2);font-size:13px;margin-bottom:16px;">Simulate a full 25-round snake draft. You make your picks; all other teams auto-pick BPA by Draft Priority. Keepers are pre-assigned to their keeper rounds.</p>';
    html += '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:16px;">';
    html += '<label style="font-size:12px;color:var(--text2);">Speed:</label>';
    html += '<select id="mockSpeed" style="padding:4px 8px;font-size:12px;background:var(--surface2);color:var(--text);border:1px solid var(--border);border-radius:4px;">';
    html += '<option value="instant">Instant</option>';
    html += '<option value="normal" selected>Normal</option>';
    html += '<option value="slow">Slow (animated)</option>';
    html += '</select>';
    html += '<button id="mockStartBtn" class="btn btn-primary" style="padding:8px 24px;">Start Mock Draft</button>';
    html += '</div>';
    // Show keeper summary
    html += '<div style="background:var(--surface2);border-radius:8px;padding:12px;margin-bottom:16px;">';
    html += '<h3 style="font-size:13px;margin-bottom:8px;">Your Keepers</h3>';
    const myKeepers = (state.keepers || []).map(n => {{
      const p = ALL.find(x => x.name === n);
      const rd = state.keeperRounds[n] || '?';
      return `<span style="font-size:12px;"><b>${{n}}</b> (Rd ${{rd}}, ${{p?p.primaryPos:'?'}})</span>`;
    }});
    html += myKeepers.join(' &middot; ') || '<span style="color:var(--text2);font-size:12px;">None set</span>';
    html += '</div>';
    section.innerHTML = html;
    document.getElementById('mockStartBtn').addEventListener('click', () => {{
      const speed = document.getElementById('mockSpeed').value;
      initMockDraft();
      mockState.speed = speed;
      renderMockDraftUI();
      runMockUntilUserTurn(() => renderMockDraftUI());
    }});
    return;
  }}

  renderMockDraftUI();
}}

function renderMockDraftUI() {{
  const section = document.getElementById('rosterSection');
  const ms = mockState;
  const isDone = ms.currentPick >= ms.draftOrder.length;
  const isUserTurn = !isDone && ms.draftOrder[ms.currentPick].teamIdx === ms.userTeamIdx;
  const currentSlot = isDone ? null : ms.draftOrder[ms.currentPick];
  const myTeamName = LEAGUE_TEAMS[ms.userTeamIdx].name;

  let html = '<div style="display:flex;gap:16px;flex-wrap:wrap;">';

  // ── Left panel: Draft log + my roster ───────────────────────────────────
  html += '<div style="flex:0 0 340px;max-height:calc(100vh - 140px);overflow-y:auto;">';

  // Status bar
  if (isDone) {{
    html += '<div style="background:var(--green);color:#000;padding:8px 12px;border-radius:6px;margin-bottom:8px;font-weight:600;">Draft Complete!</div>';
  }} else if (isUserTurn) {{
    html += `<div style="background:var(--accent);color:#fff;padding:8px 12px;border-radius:6px;margin-bottom:8px;font-weight:600;animation:pulse 1.5s infinite;">Your Pick! Round ${{currentSlot.round}} (Overall #${{ms.currentPick + 1}})</div>`;
  }} else {{
    const team = LEAGUE_TEAMS[currentSlot.teamIdx];
    html += `<div style="background:var(--surface2);padding:8px 12px;border-radius:6px;margin-bottom:8px;font-size:12px;">Picking: <b>${{team.owner || team.name}}</b> — Rd ${{currentSlot.round}}</div>`;
  }}

  // My Roster — keepers + mock draft picks in slot layout
  const myRoster = ms.teamRosters[ms.userTeamIdx] || [];
  const myKeepNames = new Set((state.keepers || []));
  const rosterSlotOrder = ['C','1B','2B','3B','SS','LF','CF','RF','DH','SP','SP','SP','SP','SP','RP','RP','RP','RP','RP'];
  const rosterPlayers = myRoster.map(n => ALL.find(x => x.name === n)).filter(Boolean);
  // Assign to slots
  const slotFilled = {{}};
  const slotCounts = {{C:1,'1B':1,'2B':1,'3B':1,SS:1,LF:1,CF:1,RF:1,DH:1,SP:5,RP:5}};
  const slotAssign = {{}};
  for (const pos of Object.keys(slotCounts)) slotAssign[pos] = [];
  const rPending = [];
  rosterPlayers.forEach(p => {{
    const pos = p.primaryPos;
    if (slotAssign[pos] && slotAssign[pos].length < slotCounts[pos]) slotAssign[pos].push(p);
    else rPending.push(p);
  }});
  rPending.forEach(p => {{
    const positions = (p.elig || p.primaryPos || '').split('/');
    let placed = false;
    for (const pos of positions) {{
      if (pos !== p.primaryPos && slotAssign[pos] && slotAssign[pos].length < slotCounts[pos]) {{
        slotAssign[pos].push(p);
        placed = true; break;
      }}
    }}
    if (!placed && !['SP','RP'].includes(p.primaryPos) && slotAssign['DH'].length < slotCounts['DH']) {{
      slotAssign['DH'].push(p);
    }}
  }});

  const myRosterLCV = calcOptimalLCV(myRoster);
  html += '<div style="background:var(--surface2);border-radius:8px;padding:10px;margin-bottom:10px;">';
  html += `<h3 style="font-size:13px;margin-bottom:6px;color:var(--accent);">My Roster (${{myRoster.length}} players, LCV: ${{myRosterLCV.startingLCV.toFixed(1)}})</h3>`;
  html += '<div style="display:flex;flex-wrap:wrap;gap:3px;">';
  for (const [pos, players] of Object.entries(slotAssign)) {{
    const count = slotCounts[pos];
    for (let i = 0; i < count; i++) {{
      const p = players[i];
      if (p) {{
        const isKeeper = myKeepNames.has(p.name);
        const bg = isKeeper ? 'rgba(99,102,241,0.15)' : 'rgba(16,185,129,0.15)';
        const border = isKeeper ? 'var(--accent)' : 'var(--green)';
        html += `<div style="background:${{bg}};border:1px solid ${{border}};border-radius:4px;padding:2px 6px;font-size:10px;white-space:nowrap;">`;
        const enoTag = p.eno_rank ? ` <span class="eno-rank" style="font-size:8px;" title="Eno 150 Best Pitchers #${{p.eno_rank}}">P${{p.eno_rank}}</span>` : '';
        html += `<span style="color:var(--text2);font-weight:600;">${{pos}}</span> ${{p.name}}${{enoTag}} <small style="opacity:0.6">${{(p.lcv||0).toFixed(1)}}</small>`;
        if (isKeeper) html += ' <small style="color:var(--accent);">K</small>';
        html += '</div>';
      }} else {{
        html += `<div style="background:var(--bg);border:1px dashed var(--border);border-radius:4px;padding:2px 6px;font-size:10px;color:var(--text2);">`;
        html += `<span style="font-weight:600;">${{pos}}</span> —</div>`;
      }}
    }}
  }}
  html += '</div></div>';

  // Live League Standings
  html += '<div style="background:var(--surface2);border-radius:8px;padding:10px;margin-bottom:10px;">';
  html += '<h3 style="font-size:13px;margin-bottom:6px;">Live League LCV</h3>';
  html += '<table style="width:100%;font-size:11px;border-collapse:collapse;">';
  html += '<tr style="color:var(--text2);"><th style="text-align:left;padding:2px 4px;">#</th><th style="text-align:left;padding:2px 4px;">Team</th><th style="text-align:right;padding:2px 4px;">Start</th><th style="text-align:right;padding:2px 4px;">Total</th></tr>';
  const leagueStats = LEAGUE_TEAMS.map((t, idx) => {{
    const roster = ms.teamRosters[idx] || [];
    const stats = calcOptimalLCV(roster);
    return {{ name: t.owner || t.name, mine: t.mine, ...stats }};
  }}).sort((a, b) => b.startingLCV - a.startingLCV);
  leagueStats.forEach((t, rank) => {{
    const style = t.mine ? 'background:rgba(99,102,241,0.1);font-weight:600;' : '';
    html += `<tr style="${{style}}"><td style="padding:2px 4px;">${{rank+1}}</td><td style="padding:2px 4px;">${{t.name}}${{t.mine?' ★':''}}</td><td style="text-align:right;padding:2px 4px;">${{t.startingLCV.toFixed(1)}}</td><td style="text-align:right;padding:2px 4px;">${{t.totalLCV.toFixed(1)}}</td></tr>`;
  }});
  html += '</table></div>';

  // Recent picks log (last 10)
  const recentPicks = ms.picks.slice(-10).reverse();
  html += '<div style="background:var(--surface2);border-radius:8px;padding:10px;margin-bottom:10px;">';
  html += `<h3 style="font-size:13px;margin-bottom:6px;">Recent Picks</h3>`;
  html += '<table style="width:100%;font-size:11px;border-collapse:collapse;">';
  recentPicks.forEach(p => {{
    const isMine = p.isUser;
    const teamLabel = isMine ? '<b style="color:var(--accent)">YOU</b>' : (LEAGUE_TEAMS[p.teamIdx].owner || p.teamName).split(' ')[0];
    const pickPlayer = ALL.find(x => x.name === p.name);
    const pickEno = pickPlayer && pickPlayer.eno_rank ? ` <span class="eno-rank" style="font-size:8px;">P${{pickPlayer.eno_rank}}</span>` : '';
    html += `<tr style="${{isMine?'background:rgba(99,102,241,0.1);':''}}"><td style="padding:2px 4px;font-size:10px;color:var(--text2);">${{p.round}}.${{p.overall}}</td><td style="padding:2px 4px;">${{teamLabel}}</td><td style="padding:2px 4px;font-weight:${{isMine?'700':'400'}};">${{p.name}}${{pickEno}}</td><td style="padding:2px 4px;">${{p.pos}}</td></tr>`;
  }});
  html += '</table></div>';

  // Reset button
  html += '<div style="margin-top:8px;">';
  html += '<button id="mockResetBtn" class="btn btn-secondary" style="padding:4px 16px;font-size:11px;">Reset Draft</button>';
  if (isDone) {{
    html += ' <button id="mockApplyBtn" class="btn btn-primary" style="padding:4px 16px;font-size:11px;">Apply My Picks to Draft Board</button>';
  }}
  html += '</div>';

  html += '</div>'; // end left panel

  // ── Right panel: Available players (for user to pick from) ──────────────
  html += '<div style="flex:1;min-width:400px;max-height:calc(100vh - 140px);overflow-y:auto;">';

  if (isUserTurn) {{
    // Search box
    html += '<div style="margin-bottom:8px;display:flex;gap:8px;align-items:center;">';
    html += '<input type="text" id="mockSearch" placeholder="Search available players..." style="flex:1;padding:6px 10px;font-size:12px;background:var(--surface2);color:var(--text);border:1px solid var(--border);border-radius:4px;">';
    html += '<select id="mockPosFilter" style="padding:6px 8px;font-size:12px;background:var(--surface2);color:var(--text);border:1px solid var(--border);border-radius:4px;">';
    html += '<option value="all">All Pos</option>';
    ['C','1B','2B','3B','SS','LF','CF','RF','DH','SP','RP'].forEach(pos => {{
      html += `<option value="${{pos}}">${{pos}}</option>`;
    }});
    html += '</select>';
    html += '</div>';

    // Player table — sortable columns
    const mockCols = [
      {{key:'dp',label:'DP',align:'left'}}, {{key:'name',label:'Player',align:'left'}},
      {{key:'pos',label:'Pos',align:'left'}}, {{key:'team',label:'Team',align:'left'}},
      {{key:'lcv',label:'LCV',align:'right'}}, {{key:'pnav',label:'PNAV',align:'right'}},
      {{key:'trend',label:'Trend',align:'right'}}
    ];
    html += '<table style="width:100%;font-size:11px;border-collapse:collapse;" id="mockPlayerTable">';
    html += '<thead><tr style="background:var(--surface2);position:sticky;top:0;z-index:1;">';
    mockCols.forEach(mc => {{
      const arrow = ms.sortCol === mc.key ? (ms.sortDir === -1 ? ' ▼' : ' ▲') : '';
      html += `<th class="mock-sort-th" data-sort="${{mc.key}}" style="text-align:${{mc.align}};padding:4px 6px;cursor:pointer;user-select:none;white-space:nowrap;">${{mc.label}}${{arrow}}</th>`;
    }});
    html += '<th style="text-align:center;padding:4px 6px;">Pick</th>';
    html += '</tr></thead><tbody>';

    // Sort available for display (don't mutate actual order — BPA still uses original dp order)
    const sortedAvail = ms.available.slice().sort((a,b) => {{
      let av = a[ms.sortCol], bv = b[ms.sortCol];
      if (typeof av === 'string') return ms.sortDir * av.localeCompare(bv);
      av = av || 0; bv = bv || 0;
      return ms.sortDir * (av - bv);
    }});
    const top100 = sortedAvail.slice(0, 100);
    top100.forEach((p, i) => {{
      const trendVal = (p.trend !== '' && p.trend !== undefined && p.trend !== null) ? parseFloat(p.trend) : null;
      const trendStr = trendVal !== null ? trendVal.toFixed(1) : '—';
      const trendColor = trendVal !== null ? (trendVal >= 0 ? 'var(--green)' : 'var(--red)') : 'var(--text2)';
      const tag = state.tags[p.name];
      const tagDot = tag === 'want' ? '<span style="color:var(--green);">●</span> ' : tag === 'avoid' ? '<span style="color:var(--red);">●</span> ' : tag === 'sleeper' ? '<span style="color:var(--yellow);">●</span> ' : tag === 'injured' ? '<span style="color:#a855f7;">●</span> ' : '';
      html += `<tr class="mock-player-row" style="border-bottom:1px solid var(--border);cursor:pointer;" data-name="${{encodeURIComponent(p.name)}}" data-pos="${{p.pos}}" data-type="${{p.type}}">`;
      html += `<td style="padding:4px 6px;font-weight:600;">${{p.dp.toFixed(1)}}</td>`;
      const enoB = p.eno_rank ? `<span class="eno-rank" title="Eno 150 Best Pitchers #${{p.eno_rank}}">P${{p.eno_rank}}</span> ` : '';
      html += `<td style="padding:4px 6px;">${{tagDot}}${{p.name}} ${{enoB}}</td>`;
      html += `<td style="padding:4px 6px;">${{p.pos}}</td>`;
      html += `<td style="padding:4px 6px;">${{p.team}}</td>`;
      html += `<td style="text-align:right;padding:4px 6px;">${{p.lcv.toFixed(1)}}</td>`;
      html += `<td style="text-align:right;padding:4px 6px;">${{p.pnav.toFixed(1)}}</td>`;
      html += `<td style="text-align:right;padding:4px 6px;color:${{trendColor}};">${{trendStr}}</td>`;
      html += `<td style="text-align:center;padding:4px 6px;"><button class="btn btn-primary mock-pick-btn" style="padding:2px 10px;font-size:10px;" data-name="${{encodeURIComponent(p.name)}}">Draft</button></td>`;
      html += '</tr>';
    }});
    html += '</tbody></table>';
  }} else if (isDone) {{
    // Show final summary: all teams
    html += '<h3 style="font-size:14px;margin-bottom:8px;">Full Draft Results</h3>';
    LEAGUE_TEAMS.forEach((t, idx) => {{
      const teamPicks = ms.picks.filter(p => p.teamIdx === idx);
      const isMine = t.mine;
      html += `<div style="background:var(--surface2);border-radius:6px;padding:8px;margin-bottom:8px;${{isMine?'border:2px solid var(--accent);':''}}">`;
      html += `<h4 style="font-size:12px;margin-bottom:4px;">${{t.owner || t.name}}${{isMine?' <span style="color:var(--accent);">(YOU)</span>':''}}</h4>`;
      html += '<div style="font-size:11px;display:flex;flex-wrap:wrap;gap:4px;">';
      teamPicks.forEach(p => {{
        const rpPlayer = ALL.find(x => x.name === p.name);
        const rpEno = rpPlayer && rpPlayer.eno_rank ? ` <span class="eno-rank" style="font-size:8px;">P${{rpPlayer.eno_rank}}</span>` : '';
        html += `<span style="background:var(--bg);padding:2px 6px;border-radius:3px;">Rd${{p.round}} ${{p.name}}${{rpEno}} <small style="opacity:0.6">(${{p.pos}})</small></span>`;
      }});
      html += '</div></div>';
    }});
  }} else {{
    html += '<div style="padding:20px;text-align:center;color:var(--text2);font-size:13px;">Other teams are picking...</div>';
  }}

  html += '</div>'; // end right panel
  html += '</div>'; // end flex container

  section.innerHTML = html;

  // Wire up events
  document.getElementById('mockResetBtn')?.addEventListener('click', () => {{
    if (ms.timer) clearTimeout(ms.timer);
    mockState = null;
    renderMockDraft();
  }});

  document.getElementById('mockApplyBtn')?.addEventListener('click', () => {{
    const myPicks = ms.picks.filter(p => p.isUser);
    myPicks.forEach(p => {{
      if (!state.drafted[p.name]) {{
        state.drafted[p.name] = {{ time: Date.now(), mine: true }};
        if (!state.myTeam.includes(p.name)) state.myTeam.push(p.name);
      }}
    }});
    save();
    mockState = null;
    currentTab = 'roster';
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'roster'));
    render();
  }});

  // Search + filter for available players
  const searchEl = document.getElementById('mockSearch');
  const posFilter = document.getElementById('mockPosFilter');
  function filterMockPlayers() {{
    const q = (searchEl?.value || '').toLowerCase();
    const pos = posFilter?.value || 'all';
    document.querySelectorAll('.mock-player-row').forEach(row => {{
      const name = decodeURIComponent(row.dataset.name).toLowerCase();
      const rpos = row.dataset.pos;
      const rtype = row.dataset.type;
      let show = true;
      if (q && !name.includes(q)) show = false;
      if (pos !== 'all') {{
        if (['SP','RP'].includes(pos)) {{
          if (rpos !== pos) show = false;
        }} else {{
          if (rtype !== 'BAT' || rpos !== pos) show = false;
        }}
      }}
      row.style.display = show ? '' : 'none';
    }});
  }}
  searchEl?.addEventListener('input', filterMockPlayers);
  posFilter?.addEventListener('change', filterMockPlayers);

  // Sort column headers
  document.querySelectorAll('.mock-sort-th').forEach(th => {{
    th.addEventListener('click', () => {{
      const col = th.dataset.sort;
      if (ms.sortCol === col) ms.sortDir *= -1;
      else {{ ms.sortCol = col; ms.sortDir = -1; }}
      renderMockDraftUI();
    }});
  }});

  // Draft buttons
  document.querySelectorAll('.mock-pick-btn').forEach(btn => {{
    btn.addEventListener('click', (e) => {{
      e.stopPropagation();
      const name = decodeURIComponent(btn.dataset.name);
      mockPickUser(name);
      renderMockDraftUI();
      runMockUntilUserTurn(() => renderMockDraftUI());
    }});
  }});
}}

let leagueSortCol = 'startingLCV', leagueSortDir = -1; // default: Start LCV desc

function renderLeague() {{
  const section = document.getElementById('rosterSection');

  // Build team data for all 12 teams
  const teamData = LEAGUE_TEAMS.map(t => {{
    const players = t.mine ? (state.myTeam || []) : (state.leagueTeams[t.name] || []);
    const ov = t.mine ? (state.rosterOverrides || {{}}) : (state.leagueRosterOverrides && state.leagueRosterOverrides[t.name] || {{}});
    const stats = calcRosterLCV(players, ov);
    const owner = t.mine ? (t.owner || '') : (state.teamOwners[t.name] || '');
    const rookies = t.mine ? (state.milbKeepers || []) : (state.leagueMilbKeepers[t.name] || []);
    return {{ ...t, players, ...stats, owner, rookies, rookieCount: (t.mine ? (state.milbKeepers || []) : (state.leagueMilbKeepers[t.name] || [])).length }};
  }});

  // ── Draft Capital from simulation engine ──────────────────────────────
  const sim = simulateDraft();
  teamData.forEach(t => {{
    t.draftCapital = sim.teamCapital[t.name] || 0;
    t.openRounds = sim.teamOpenRds[t.name] || 0;
    t.totalPower = Math.round((t.totalLCV + t.draftCapital) * 100) / 100;
  }});

  // Sortable columns definition
  const leagueCols = [
    {{ key: 'pick', label: 'Pick', w: '25px', numeric: true }},
    {{ key: 'name', label: 'Team', w: '', numeric: false }},
    {{ key: 'owner', label: 'Owner', w: '100px', numeric: false }},
    {{ key: 'count', label: 'Ct', w: '40px', numeric: true }},
    {{ key: 'rookieCount', label: 'Rk', w: '35px', numeric: true, tip: 'Rookie/MiLB keepers', small: true }},
    {{ key: 'startingLCV', label: 'Start LCV', w: '70px', numeric: true, bar: true }},
    {{ key: 'totalLCV', label: 'Total LCV', w: '70px', numeric: true, bar: true }},
    {{ key: 'openRounds', label: 'Open', w: '35px', numeric: true, small: true, tip: 'Open draft rounds (25 minus keeper count)' }},
    {{ key: 'draftCapital', label: 'Draft Cap', w: '75px', numeric: true, bar: true, small: true, tip: 'Draft Capital — estimated total DP from remaining open picks (BPA simulation)' }},
    {{ key: 'totalPower', label: 'Total Pwr', w: '75px', numeric: true, bar: true, small: true, tip: 'Total Power = Keeper LCV + Draft Capital' }}
  ];

  // Sort
  const sorted = [...teamData].sort((a, b) => {{
    let av = a[leagueSortCol], bv = b[leagueSortCol];
    if (typeof av === 'string') return leagueSortDir * av.localeCompare(bv);
    return leagueSortDir * ((av || 0) - (bv || 0));
  }});

  // Max values for bar scaling
  const maxVals = {{}};
  ['startingLCV', 'totalLCV', 'draftCapital', 'totalPower'].forEach(k => {{
    maxVals[k] = Math.max(...teamData.map(t => t[k] || 0), 1);
  }});

  // Sub-view toggle
  if (!state._leagueView) state._leagueView = 'kept';

  let html = '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">';
  html += '<h2 style="margin:0;">League</h2>';
  html += '<div style="display:flex;gap:2px;background:var(--surface2);border-radius:6px;padding:2px;">';
  ['kept','available','comparison'].forEach(v => {{
    const active = state._leagueView === v;
    const label = v === 'kept' ? 'Keepers' : v === 'available' ? 'Available' : 'Comparison';
    html += `<button class="league-view-btn" data-view="${{v}}" style="padding:4px 12px;font-size:11px;border:none;border-radius:4px;cursor:pointer;background:${{active?'var(--accent)':'transparent'}};color:${{active?'#fff':'var(--text2)'}};font-weight:${{active?'600':'400'}};">${{label}}</button>`;
  }});
  html += '</div></div>';

  // ── KEEPERS VIEW ──
  if (state._leagueView === 'kept') {{
    html += '<p style="font-size:12px;color:var(--text2);margin-bottom:12px;">All 12 teams\\' major league keepers (5) and minor league keepers (4) with keeper cost and years of control.</p>';

    LEAGUE_TEAMS.forEach(t => {{
      const isMine = t.mine;
      const keepers = DEFAULT_LEAGUE_KEEPERS[t.name] || [];
      const milb = DEFAULT_LEAGUE_MILB_KEEPERS[t.name] || (t.mine ? (DEFAULT_MILB_KEEPERS || []) : []);
      const borderClr = isMine ? 'var(--accent)' : 'var(--border)';
      const bgClr = isMine ? 'rgba(74,107,255,0.04)' : '';
      const ownerName = t.mine ? t.owner : (state.teamOwners[t.name] || t.owner || '');

      html += `<div style="border:1px solid ${{borderClr}};border-radius:8px;padding:10px 12px;margin-bottom:8px;background:${{bgClr}};">`;
      html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">`;
      html += `<div><b style="font-size:13px;">#${{t.pick}} ${{t.name}}</b>${{isMine?' <span style="color:var(--accent);font-size:11px;">(you)</span>':''}}</div>`;
      html += `<div style="font-size:11px;color:var(--text2);">${{ownerName}}</div>`;
      html += `</div>`;

      // ML Keepers table
      if (keepers.length > 0) {{
        html += '<table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:4px;">';
        html += '<tr style="color:var(--text2);font-size:10px;"><th style="text-align:left;padding:2px 4px;">Player</th><th style="padding:2px 4px;">Pos</th><th style="text-align:right;padding:2px 4px;">R$</th><th style="text-align:right;padding:2px 4px;">2027 Cost</th><th style="text-align:right;padding:2px 4px;">Yrs</th><th style="text-align:right;padding:2px 4px;">LCV</th><th style="text-align:right;padding:2px 4px;">Surplus</th></tr>';
        keepers.forEach(k => {{
          const p = ALL.find(x => x.name === k.name);
          const ki = getKeeperInfo(k.name);
          const lcv = p ? (p.lcv||0).toFixed(1) : '?';
          const pos = p ? p.primaryPos : '?';
          const costStr = ki.keepable2027 ? `R${{ki.cost2027}}` : '✕';
          const costClr = ki.keepable2027 ? 'var(--text)' : 'var(--red)';
          const surp = ki.multiYearSurplus;
          const surpClr = surp > 2 ? 'var(--green)' : surp < -2 ? 'var(--red)' : 'var(--text2)';
          html += `<tr><td style="padding:2px 4px;font-weight:600;">${{k.name}}</td><td style="padding:2px 4px;text-align:center;">${{pos}}</td><td style="text-align:right;padding:2px 4px;color:var(--accent);">R${{k.rd}}</td><td style="text-align:right;padding:2px 4px;color:${{costClr}};">${{costStr}}</td><td style="text-align:right;padding:2px 4px;">${{ki.yearsLeft}}</td><td style="text-align:right;padding:2px 4px;font-weight:600;">${{lcv}}</td><td style="text-align:right;padding:2px 4px;color:${{surpClr}};font-weight:600;">${{surp > 0 ? '+' : ''}}${{surp.toFixed(1)}}</td></tr>`;
        }});
        html += '</table>';
      }}
      // MiLB keepers
      if (milb.length > 0) {{
        html += '<div style="font-size:10px;color:var(--text2);margin-top:2px;">MiLB: ' + milb.join(', ') + '</div>';
      }}
      html += '</div>';
    }});
  }}

  // ── AVAILABLE VIEW ──
  else if (state._leagueView === 'available') {{
    html += '<p style="font-size:12px;color:var(--text2);margin-bottom:12px;">Non-keeper players on each team — drafted but not kept. Potential trade targets.</p>';

    LEAGUE_TEAMS.forEach(t => {{
      const isMine = t.mine;
      const teamPlayers = isMine ? (state.myTeam || []) : (state.leagueTeams[t.name] || []);
      const keepers = DEFAULT_LEAGUE_KEEPERS[t.name] || [];
      const keeperNames = new Set(keepers.map(k => k.name));
      const milb = DEFAULT_LEAGUE_MILB_KEEPERS[t.name] || (t.mine ? (DEFAULT_MILB_KEEPERS || []) : []);
      const milbNames = new Set(milb);
      // Available = on roster but not a keeper and not MiLB
      const available = teamPlayers.filter(n => !keeperNames.has(n) && !milbNames.has(n));
      if (available.length === 0) return;

      const borderClr = isMine ? 'var(--accent)' : 'var(--border)';
      const ownerName = t.mine ? t.owner : (state.teamOwners[t.name] || t.owner || '');

      html += `<div style="border:1px solid ${{borderClr}};border-radius:8px;padding:10px 12px;margin-bottom:8px;">`;
      html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">`;
      html += `<div><b style="font-size:13px;">#${{t.pick}} ${{t.name}}</b> <span style="font-size:11px;color:var(--text2);">(${{available.length}} available)</span></div>`;
      html += `<div style="font-size:11px;color:var(--text2);">${{ownerName}}</div>`;
      html += `</div>`;

      html += '<table style="width:100%;border-collapse:collapse;font-size:11px;">';
      html += '<tr style="color:var(--text2);font-size:10px;"><th style="text-align:left;padding:2px 4px;">Player</th><th style="padding:2px 4px;">Pos</th><th style="text-align:right;padding:2px 4px;">R$</th><th style="text-align:right;padding:2px 4px;">2027 Cost</th><th style="text-align:right;padding:2px 4px;">Yrs</th><th style="text-align:right;padding:2px 4px;">LCV</th><th style="text-align:right;padding:2px 4px;">PNAV</th></tr>';
      available.map(n => ({{ name: n, p: ALL.find(x => x.name === n), ki: getKeeperInfo(n) }}))
        .sort((a,b) => ((b.p?b.p.lcv:0)||0) - ((a.p?a.p.lcv:0)||0))
        .forEach(row => {{
          const p = row.p;
          const ki = row.ki;
          const lcv = p ? (p.lcv||0).toFixed(1) : '?';
          const pnav = p ? (p.pnav||0).toFixed(1) : '?';
          const pos = p ? p.primaryPos : '?';
          const rdStr = ki.draftRound ? `R${{ki.draftRound}}` : 'FA';
          const costStr = ki.keepable2027 ? `R${{ki.cost2027}}` : '✕';
          html += `<tr><td style="padding:2px 4px;font-weight:600;">${{row.name}}</td><td style="padding:2px 4px;text-align:center;">${{pos}}</td><td style="text-align:right;padding:2px 4px;color:var(--accent);">${{rdStr}}</td><td style="text-align:right;padding:2px 4px;">${{costStr}}</td><td style="text-align:right;padding:2px 4px;">${{ki.yearsLeft}}</td><td style="text-align:right;padding:2px 4px;font-weight:600;">${{lcv}}</td><td style="text-align:right;padding:2px 4px;">${{pnav}}</td></tr>`;
        }});
      html += '</table></div>';
    }});
  }}

  // ── COMPARISON VIEW (original league table) ──
  else {{
  html += '<p style="font-size:12px;color:var(--text2);margin-bottom:16px;">Click any column header to sort. <b>Draft Cap</b> = estimated DP from open picks (BPA sim, updates as you draft). <b>Total Pwr</b> = Keeper LCV + Draft Cap.</p>';

  // Table header
  html += '<table style="width:100%"><thead><tr>';
  html += '<th style="width:25px">#</th>';
  leagueCols.forEach(col => {{
    const isActive = leagueSortCol === col.key;
    const arrow = isActive ? (leagueSortDir === -1 ? ' ▼' : ' ▲') : '';
    const cursor = 'cursor:pointer;user-select:none;';
    const fontSize = col.small ? 'font-size:11px;' : '';
    const tip = col.tip ? ` title="${{col.tip}}"` : '';
    const width = col.w ? `width:${{col.w}};` : '';
    const activeStyle = isActive ? 'color:var(--accent);' : '';
    html += `<th class="league-sort-th" data-col="${{col.key}}" style="${{width}}${{cursor}}${{fontSize}}${{activeStyle}}"${{tip}}>${{col.label}}${{arrow}}</th>`;
    if (col.bar) html += `<th style="width:${{col.key === 'startingLCV' || col.key === 'totalLCV' ? '140px' : '100px'}}"></th>`;
  }});
  html += '</tr></thead><tbody>';

  sorted.forEach((t, i) => {{
    const rowStyle = t.mine ? 'background:rgba(99,102,241,0.08);' : '';
    const nameWeight = t.mine ? 'font-weight:700;' : '';
    const youTag = t.mine ? ' <small style="color:var(--accent)">(you)</small>' : '';

    html += `<tr class="league-row" data-team="${{encodeURIComponent(t.name)}}" style="${{rowStyle}}cursor:pointer;" title="Click to edit">
      <td>${{i+1}}</td>
      <td style="text-align:center;color:var(--text2);font-size:12px;">${{t.pick}}</td>
      <td style="${{nameWeight}}">${{t.name}}${{youTag}}</td>
      <td><input class="owner-input" data-team="${{encodeURIComponent(t.name)}}" value="${{t.owner.replace(/"/g, '&quot;')}}" placeholder="Owner" style="width:90px;padding:2px 6px;font-size:11px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:3px;"></td>
      <td style="text-align:center">${{t.count}}</td>
      <td style="text-align:center;font-size:11px;color:var(--text2);" title="${{(t.rookies||[]).join(', ')}}">${{t.rookieCount}}</td>`;

    // Render each bar-metric column
    ['startingLCV', 'totalLCV', 'openRounds', 'draftCapital', 'totalPower'].forEach(key => {{
      const val = t[key] || 0;
      if (key === 'openRounds') {{
        html += `<td style="text-align:center;font-size:12px;color:var(--text2);">${{val}}</td>`;
        return;
      }}
      const pct = val / maxVals[key] * 100;
      const hue = Math.round((pct / 100) * 120);
      const clr = `hsl(${{hue}}, 70%, 38%)`;
      html += `<td style="text-align:right;font-weight:700;color:${{clr}}">${{val.toFixed(1)}}</td>`;
      html += `<td><div style="position:relative;height:18px;background:var(--surface2);border-radius:4px;overflow:hidden;">
        <div style="height:100%;width:${{pct.toFixed(0)}}%;background:${{clr}};opacity:0.3;"></div>
      </div></td>`;
    }});

    html += '</tr>';
  }});
  html += '</tbody></table>';

  // Team roster editor
  html += `<div style="margin-top:24px;padding:16px;background:var(--surface2);border-radius:8px;">`;
  html += `<h3 style="margin:0 0 12px;font-size:14px;">Edit Team Roster</h3>`;
  html += `<div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap;">`;
  html += `<select id="leagueTeamSelect" style="flex:0 0 300px;padding:6px 10px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:4px;font-size:13px;">`;
  LEAGUE_TEAMS.forEach(t => {{
    if (t.mine) return; // edit your own team via the main draft tools
    const cnt = (state.leagueTeams[t.name] || []).length;
    html += `<option value="${{encodeURIComponent(t.name)}}">#${{t.pick}} ${{t.name}} (${{cnt}} players)</option>`;
  }});
  html += `</select>`;
  html += `<button id="leagueTeamSave" class="btn" style="padding:6px 16px;font-size:13px;">Save Roster</button>`;
  html += `<button id="leagueTeamClear" class="btn btn-secondary" style="padding:6px 16px;font-size:13px;">Clear</button>`;
  html += `</div>`;
  html += `<textarea id="leagueTeamPlayers" rows="6" placeholder="Enter player names, one per line or comma-separated.${{String.fromCharCode(10)}}Players will be fuzzy-matched to projections." style="width:100%;padding:8px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:4px;font-size:12px;font-family:monospace;resize:vertical;"></textarea>`;
  html += `<div id="leagueTeamResult" style="margin-top:8px;font-size:12px;color:var(--text2);"></div>`;
  html += `</div>`;

  // Summary
  const teamsWithPlayers = LEAGUE_TEAMS.filter(t => {{
    const pl = t.mine ? (state.myTeam||[]) : (state.leagueTeams[t.name]||[]);
    return pl.length > 0;
  }}).length;
  html += `<div style="margin-top:12px;font-size:12px;color:var(--text2);">Teams with rosters entered: ${{teamsWithPlayers}}/12</div>`;

  // ── Mock Draft section ────────────────────────────────────────────────
  html += `<div style="margin-top:24px;padding:16px;background:var(--surface2);border-radius:8px;">`;
  html += `<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">`;
  html += `<h3 style="margin:0;font-size:14px;">Mock Draft (BPA Simulation)</h3>`;
  html += `<button id="mockDraftToggle" class="btn btn-primary" style="padding:4px 16px;font-size:12px;">Show Mock Draft</button>`;
  html += `</div>`;
  html += `<p style="font-size:11px;color:var(--text2);margin:0 0 8px;">Simulates the entire draft using Best Player Available logic with snake positions. Excludes all kept and already-drafted players. Updates live as you draft.</p>`;
  html += `<div id="mockDraftResults" style="display:none;"></div>`;
  html += `</div>`;
  }} // end comparison view

  section.innerHTML = html;

  // Wire league view toggle buttons
  section.querySelectorAll('.league-view-btn').forEach(btn => {{
    btn.addEventListener('click', () => {{
      state._leagueView = btn.dataset.view;
      save();
      renderLeague();
    }});
  }});

  // Sortable column headers (only in comparison view)
  section.querySelectorAll('.league-sort-th').forEach(th => {{
    th.addEventListener('click', () => {{
      const col = th.dataset.col;
      if (leagueSortCol === col) {{ leagueSortDir *= -1; }}
      else {{ leagueSortCol = col; leagueSortDir = -1; }}
      renderLeague();
    }});
  }});

  // Mock draft toggle + rendering
  const _mockToggle = document.getElementById('mockDraftToggle');
  if (_mockToggle) _mockToggle.addEventListener('click', function() {{
    const resultsEl = document.getElementById('mockDraftResults');
    if (resultsEl.style.display === 'none') {{
      this.textContent = 'Hide Mock Draft';
      resultsEl.style.display = '';
      renderMockDraft(resultsEl, sim);
    }} else {{
      this.textContent = 'Show Mock Draft';
      resultsEl.style.display = 'none';
    }}
  }});

  function renderMockDraft(el, simData) {{
    // Show my team's mock picks first, then full round-by-round
    const myTeam = LEAGUE_TEAMS.find(t => t.mine);
    const myPicks = simData.teamResults[myTeam.name] || [];

    let mhtml = '<h4 style="margin:12px 0 8px;color:var(--accent);font-size:13px;">Your Projected Picks (BPA)</h4>';
    if (myPicks.length === 0) {{
      mhtml += '<p style="font-size:12px;color:var(--text2);">No open picks remaining.</p>';
    }} else {{
      mhtml += '<table style="width:100%;margin-bottom:16px;"><thead><tr><th style="width:45px">Rd</th><th style="width:55px">Overall</th><th>Player</th><th style="width:50px">Pos</th><th style="width:45px">Team</th><th style="width:55px">LCV</th><th style="width:55px">Pick</th></tr></thead><tbody>';
      myPicks.forEach(p => {{
        mhtml += `<tr style="background:rgba(99,102,241,0.06);">
          <td style="font-weight:700">${{p.round}}</td>
          <td style="color:var(--text2)">#${{p.overall}}</td>
          <td style="font-weight:600">${{p.name}}</td>
          <td>${{p.pos}}</td>
          <td style="font-size:11px">${{p.team}}</td>
          <td>${{p.lcv.toFixed(1)}}</td>
          <td style="font-weight:700;color:var(--accent)">${{p.dp.toFixed(1)}}</td>
        </tr>`;
      }});
      mhtml += '</tbody></table>';
    }}

    // Full draft — collapsible per team
    mhtml += '<h4 style="margin:12px 0 8px;font-size:13px;">All Teams Mock Results</h4>';
    // Sort teams by total power descending
    const teamOrder = LEAGUE_TEAMS.slice().sort((a,b) => {{
      const aCap = simData.teamCapital[a.name] || 0;
      const bCap = simData.teamCapital[b.name] || 0;
      return bCap - aCap;
    }});

    teamOrder.forEach(t => {{
      const picks = simData.teamResults[t.name] || [];
      if (picks.length === 0) return;
      const cap = (simData.teamCapital[t.name] || 0).toFixed(1);
      const isMine = t.mine;
      const highlight = isMine ? 'color:var(--accent);' : '';
      const youTag = isMine ? ' (you)' : '';
      mhtml += `<details style="margin-bottom:4px;"><summary style="cursor:pointer;padding:4px 8px;font-size:12px;border-radius:4px;background:var(--bg);${{highlight}}"><b>#${{t.pick}} ${{t.name}}${{youTag}}</b> — ${{picks.length}} picks, Draft Cap: ${{cap}}</summary>`;
      mhtml += '<table style="width:100%;margin:4px 0 8px;"><thead><tr><th style="width:40px">Rd</th><th style="width:50px">#</th><th>Player</th><th style="width:45px">Pos</th><th style="width:50px">DP</th></tr></thead><tbody>';
      picks.forEach(p => {{
        mhtml += `<tr><td>${{p.round}}</td><td style="color:var(--text2)">${{p.overall}}</td><td style="font-weight:600">${{p.name}}</td><td>${{p.pos}}</td><td>${{p.dp.toFixed(1)}}</td></tr>`;
      }});
      mhtml += '</tbody></table></details>';
    }});

    el.innerHTML = mhtml;
  }}
  section.style.display = '';
  document.getElementById('tableWrap').style.display = 'none';

  // Load selected team's players into textarea
  function loadTeamIntoEditor(teamName) {{
    const sel = document.getElementById('leagueTeamSelect');
    sel.value = encodeURIComponent(teamName);
    const players = state.leagueTeams[teamName] || [];
    document.getElementById('leagueTeamPlayers').value = players.join('\\n');
  }}

  // Click row to select team
  section.querySelectorAll('.league-row').forEach(row => {{
    row.addEventListener('click', (e) => {{
      if (e.target.classList.contains('owner-input')) return; // don't trigger on owner input
      const tn = decodeURIComponent(row.dataset.team);
      const lt = LEAGUE_TEAMS.find(t => t.name === tn);
      if (lt && !lt.mine) loadTeamIntoEditor(tn);
    }});
  }});

  // Save roster
  const _saveBtn = document.getElementById('leagueTeamSave');
  if (_saveBtn) _saveBtn.addEventListener('click', () => {{
    const teamName = decodeURIComponent(document.getElementById('leagueTeamSelect').value);
    const text = document.getElementById('leagueTeamPlayers').value.trim();
    const resultEl = document.getElementById('leagueTeamResult');

    const lines = text ? text.split(/[\\n,]+/).map(s => s.trim()).filter(Boolean) : [];
    let matched = 0, unmatched = [];
    const players = [];
    lines.forEach(line => {{
      const {{ name, rd }} = parseNameAndRound(line);
      const match = fuzzyFind(name);
      if (match) {{
        players.push(match.name);
        if (!state.drafted[match.name]) state.drafted[match.name] = {{ time: Date.now(), mine: false }};
        if (rd) {{ if (!state.keeperRounds) state.keeperRounds = {{}}; state.keeperRounds[match.name] = rd; }}
        matched++;
      }} else {{
        unmatched.push(name);
      }}
    }});

    state.leagueTeams[teamName] = players;
    save();

    let msg = `<span style="color:var(--green)">Saved ${{matched}} players to ${{teamName}}</span>`;
    if (unmatched.length) msg += `<br><span style="color:var(--orange)">Not found: ${{unmatched.join(', ')}}</span>`;
    resultEl.innerHTML = msg;
    setTimeout(() => renderLeague(), 500);
  }});

  // Clear
  const _clearBtn = document.getElementById('leagueTeamClear');
  if (_clearBtn) _clearBtn.addEventListener('click', () => {{
    document.getElementById('leagueTeamPlayers').value = '';
    document.getElementById('leagueTeamResult').innerHTML = '';
  }});

  // Owner name inputs — save on change
  section.querySelectorAll('.owner-input').forEach(inp => {{
    inp.addEventListener('change', () => {{
      const tn = decodeURIComponent(inp.dataset.team);
      state.teamOwners[tn] = inp.value.trim();
      save();
    }});
    // Prevent row click when clicking in input
    inp.addEventListener('click', e => e.stopPropagation());
  }});

  // Load first non-mine team into editor (comparison view only)
  if (state._leagueView === 'comparison') {{
    const firstOther = LEAGUE_TEAMS.find(t => !t.mine);
    if (firstOther) loadTeamIntoEditor(firstOther.name);
  }}
}}

// (renderLeagueRosters removed — combined into renderRoster)

// (renderFreeAgents removed — use All/Drafted/Available filter on main player tables instead)

// ── Help / Fantasy Advice ─────────────────────────────────────────────────
const CBS_ARTICLES = [
  {{id:'37745473',title:'Deep sleepers, the best 40'}},
  {{id:'37746644',title:"Frank's Breakouts 2.0"}},
  {{id:'37745453',title:'Starting Pitcher Tiers 3.0'}},
  {{id:'37745454',title:'Relief Pitcher Tiers 3.0'}},
  {{id:'37746835',title:'2026 Fantasy baseball cheat sheet'}},
  {{id:'37744841',title:'Chances these one-hit wonders repeat'}},
  {{id:'37745665',title:'Favorite targets in every round'}},
  {{id:'37745451',title:'Outfield Tiers 3.0'}},
  {{id:'37745450',title:'Shortstop Tiers 3.0'}},
  {{id:'37744268',title:'Third Base Tiers 3.0'}},
  {{id:'37744267',title:'Second Base Tiers 3.0'}},
  {{id:'37744405',title:"Chris' Busts 2.0"}},
  {{id:'37743189',title:'What to know at every position'}},
  {{id:'37741912',title:"Scott's Sleepers 2.0"}},
  {{id:'37742126',title:'2026 spring storylines to know'}},
  {{id:'37739428',title:"Frank's Sleepers 2.0"}},
  {{id:'37738639',title:'H2H points mock: Go big!'}},
  {{id:'37738971',title:'Format specialists for points and Roto'}},
  {{id:'37738944',title:'2026 starting pitcher preview'}},
  {{id:'37738080',title:'Introducing the 2026 All-Rookie Team'}},
  {{id:'37738095',title:"Fallout: Green's elbow injury"}},
  {{id:'37737058',title:"Towers' Breakouts 2.0"}},
  {{id:'37736884',title:"Scott White's Tout Wars team"}},
  {{id:'37735788',title:'H2H points salary cap draft'}},
  {{id:'37735936',title:'February ADP risers and fallers'}},
  {{id:'37734856',title:"Scott's Busts 2.0"}},
  {{id:'37731069',title:'AL-only Roto salary cap draft'}},
  {{id:'37735000',title:'Important Spring Training updates'}},
  {{id:'37734083',title:'NL-only Roto salary cap draft'}},
  {{id:'37734956',title:'Spencer Strider 2026 outlook'}},
  {{id:'37732139',title:'Relief Pitcher Tiers 2.0'}},
  {{id:'37732138',title:'Starting Pitcher Tiers 2.0'}},
  {{id:'37732153',title:'Relief pitcher strategies for 2026'}},
  {{id:'37731841',title:"Frank's Busts 2.0"}},
  {{id:'37731693',title:'2026 outfield preview'}},
  {{id:'37731105',title:'Shortstop Tiers 2.0'}},
  {{id:'37731106',title:'Outfield Tiers 2.0'}},
  {{id:'37731055',title:'H2H categories mock draft'}},
  {{id:'37730006',title:'Third Base Tiers 2.0'}},
  {{id:'37730005',title:'Second Base Tiers 2.0'}},
  {{id:'37728988',title:'2026 starting pitcher strategies'}},
  {{id:'37730034',title:"Chris' Sleepers 2.0"}},
  {{id:'37729104',title:'Catcher Tiers 2.0'}},
  {{id:'37729168',title:'Believe It or Not: Spring buzz'}},
  {{id:'37729103',title:'First Base Tiers 2.0'}},
  {{id:'37729142',title:'2026 Week 1 Spring Training updates'}},
  {{id:'37728291',title:"Scott's Breakouts 2.0"}},
  {{id:'37728280',title:'2026 Shortstop Preview'}},
  {{id:'37726017',title:'Top 25 position battles for Fantasy'}},
  {{id:'37726171',title:'Biggest questions for AL teams'}},
  {{id:'37724370',title:'Outfield strategies for 2026'}},
  {{id:'37725376',title:'Biggest questions for NL teams'}},
  {{id:'37724739',title:'2026 Third Base Preview'}},
  {{id:'37724837',title:'Spring Training: 5 things to know'}},
  {{id:'37721622',title:'Shortstop strategies for 2026'}},
  {{id:'37723398',title:'2026 Second Base Preview'}}
];

function renderHelp() {{
  const section = document.getElementById('rosterSection');
  document.getElementById('tableWrap').style.display = 'none';
  document.getElementById('playerControls').style.display = 'none';
  section.style.display = '';

  // Categorize articles
  const cats = {{
    'Tiers':        a => /tiers/i.test(a.title),
    'Sleepers':     a => /sleeper/i.test(a.title) || /deep sleep/i.test(a.title),
    'Busts':        a => /bust/i.test(a.title),
    'Breakouts':    a => /breakout/i.test(a.title),
    'Previews':     a => /preview/i.test(a.title) || /what to know/i.test(a.title) || /cheat sheet/i.test(a.title),
    'Strategy':     a => /strateg/i.test(a.title) || /format specialist/i.test(a.title) || /target/i.test(a.title),
    'Mock Drafts':  a => /mock|salary cap/i.test(a.title),
    'News & Notes': a => true
  }};
  const used = new Set();
  const grouped = {{}};
  for (const [cat, fn] of Object.entries(cats)) {{
    grouped[cat] = CBS_ARTICLES.filter(a => !used.has(a.id) && fn(a));
    grouped[cat].forEach(a => used.add(a.id));
  }}

  const baseUrl = 'https://dpf.baseball.cbssports.com/news/';

  let html = '<div style="padding:20px;max-width:900px;">';
  html += '<h2 style="margin-bottom:4px;">Fantasy Advice</h2>';
  html += '<p style="font-size:13px;color:var(--text2);margin-bottom:20px;">' + CBS_ARTICLES.length + ' articles from CBS Fantasy. Click any article to open it in a new tab.</p>';

  for (const [cat, articles] of Object.entries(grouped)) {{
    if (!articles.length) continue;
    html += `<div style="margin-bottom:20px;">`;
    html += `<h3 style="font-size:15px;color:var(--accent);margin-bottom:8px;border-bottom:1px solid var(--border);padding-bottom:4px;">${{cat}}</h3>`;
    html += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:8px;">`;
    articles.forEach(a => {{
      html += `<a href="${{baseUrl}}${{a.id}}" target="_blank" rel="noopener" style="display:block;padding:10px 14px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);text-decoration:none;font-size:13px;transition:border-color .15s;" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">${{a.title}}</a>`;
    }});
    html += `</div></div>`;
  }}

  html += '</div>';
  section.innerHTML = html;
}}

// ── View toggle listener ──────────────────────────────────────────────────
document.querySelectorAll('.view-btn').forEach(btn => {{
  btn.addEventListener('click', () => {{
    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentView = btn.dataset.view;
    render();
  }});
}});

// ── Search & filter listeners ─────────────────────────────────────────────
document.getElementById('searchBox').addEventListener('input', render);
document.getElementById('draftFilter').addEventListener('change', render);
document.getElementById('tagFilter').addEventListener('change', render);
document.addEventListener('click', e => {{
  if (!e.target.closest('.autocomplete') && !e.target.closest('.draft-input')) draftAC.style.display = 'none';
}});

// ── Init ──────────────────────────────────────────────────────────────────
// Ensure keepers are on team
state.keepers.forEach(k => {{
  if (!state.myTeam.includes(k)) state.myTeam.push(k);
  const kRd = state.keeperRounds[k] || null;
  if (!state.drafted[k]) state.drafted[k] = {{ time: Date.now(), mine: true, round: kRd }};
}});
save();
render();
</script>
</body>
</html>'''

with open('index.html', 'w') as f:
    f.write(html)

print("Dashboard written successfully!")
print(f"File size: {len(html):,} bytes")

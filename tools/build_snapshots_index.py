#!/usr/bin/env python3
"""Build data/snapshots/index.json + lcv_stats.json from per-day snapshot CSVs.

These two files feed time-splits.js which powers the dashboard's 14d HOT/COLD
indicator and rolling LCV delta column. Without them, those columns render
blank.

Snapshot CSV format (per day, e.g. data/snapshots/bat_2026-04-23.csv):
  bat: name|team|pa|hr|r|rbi|sb|so|bb|h|ab|sf|hbp|x2b|x3b|avg|obp|slg
  pit: name|team|ip|w|sv|hld|era|whip|so|hr|qs|er|h|bb|hbp|bf

OUTPUT formats expected by time-splits.js:
  index.json:   {dates: [...sorted ISO dates...], bat: {name: {date: [...]}}, pit: {...}}
  lcv_stats.json: {bat: {avg: {mean, std}, hr: {mean, std}, ...}, pit: {...}}

Snapshot column order (same as time-splits.js _BAT_SNAP_COLS / _PIT_SNAP_COLS):
  bat: [pa, ab, h, hr, r, rbi, sb, so, bb, hbp, sf, x1b, x2b, x3b]
  pit: [ip, w, sv, hld, so, hr, qs, er, h, bb, tbf]

For older snapshot CSVs that pre-date the schema bump (no hbp/x2b/x3b/er),
this script approximates: hbp=0, x1b=h-hr (treats all non-HR hits as singles —
understates SLG slightly), x2b=x3b=0, er=round(era*ip/9). The HOT/COLD signal
is robust to the SLG approximation since SLG is only 1 of 8 LCV inputs.
"""
import csv, json, os, sys
from glob import glob

SNAP_DIR = 'data/snapshots'
OUT_INDEX = os.path.join(SNAP_DIR, 'index.json')
OUT_LCVSTATS = os.path.join(SNAP_DIR, 'lcv_stats.json')

# Output order — must match time-splits.js _BAT_SNAP_COLS / _PIT_SNAP_COLS
BAT_COLS = ['pa','ab','h','hr','r','rbi','sb','so','bb','hbp','sf','x1b','x2b','x3b']
PIT_COLS = ['ip','w','sv','hld','so','hr','qs','er','h','bb','tbf']


def parse_csv(path):
    with open(path) as f:
        reader = csv.DictReader(f, delimiter='|')
        return list(reader)


def to_int(v, default=0):
    try: return int(float(v)) if v else default
    except: return default


def to_float(v, default=0.0):
    try: return float(v) if v else default
    except: return default


def bat_row_to_snapshot(row):
    pa = to_int(row.get('pa'))
    ab = to_int(row.get('ab'))
    h = to_int(row.get('h'))
    hr = to_int(row.get('hr'))
    hbp = to_int(row.get('hbp'))           # 0 in legacy CSVs
    x2b = to_int(row.get('x2b'))           # 0 in legacy CSVs
    x3b = to_int(row.get('x3b'))           # 0 in legacy CSVs
    # x1b derived: h - 2B - 3B - HR. In legacy snapshots where x2b/x3b are 0,
    # this collapses to h - hr (treats all non-HR hits as singles).
    x1b = max(0, h - x2b - x3b - hr)
    return [
        pa, ab, h, hr,
        to_int(row.get('r')),
        to_int(row.get('rbi')),
        to_int(row.get('sb')),
        to_int(row.get('so')),
        to_int(row.get('bb')),
        hbp,
        to_int(row.get('sf')),
        x1b, x2b, x3b,
    ]


def pit_row_to_snapshot(row):
    ip = to_float(row.get('ip'))
    era = to_float(row.get('era'))
    er = to_int(row.get('er'))
    if er == 0 and ip > 0 and era > 0:
        # Legacy CSV without ER — derive from ERA and IP
        er = round(era * ip / 9.0)
    return [
        ip,
        to_int(row.get('w')),
        to_int(row.get('sv')),
        to_int(row.get('hld')),
        to_int(row.get('so')),
        to_int(row.get('hr')),
        to_int(row.get('qs')),
        er,
        to_int(row.get('h')),                # 0 in legacy CSVs (only used for displayed split stats, not LCV)
        to_int(row.get('bb')),
        to_int(row.get('bf')),               # tbf — we store as bf in CSV, time-splits.js reads as tbf
    ]


def build_index():
    bat_files = sorted(glob(os.path.join(SNAP_DIR, 'bat_*.csv')))
    pit_files = sorted(glob(os.path.join(SNAP_DIR, 'pit_*.csv')))
    print(f"Bat snapshots: {len(bat_files)}, Pit snapshots: {len(pit_files)}")

    dates = set()
    bat = {}  # name -> {date -> [snapshot]}
    pit = {}

    for path in bat_files:
        date = os.path.basename(path).replace('bat_', '').replace('.csv', '')
        dates.add(date)
        for row in parse_csv(path):
            name = row.get('name', '').strip()
            if not name: continue
            bat.setdefault(name, {})[date] = bat_row_to_snapshot(row)

    for path in pit_files:
        date = os.path.basename(path).replace('pit_', '').replace('.csv', '')
        dates.add(date)
        for row in parse_csv(path):
            name = row.get('name', '').strip()
            if not name: continue
            pit.setdefault(name, {})[date] = pit_row_to_snapshot(row)

    sorted_dates = sorted(dates)
    return {'dates': sorted_dates, 'bat': bat, 'pit': pit}


def build_lcv_stats(index):
    """LCV z-score normalization params from the latest snapshot's pool."""
    if not index['dates']:
        return {'bat': {}, 'pit': {}}
    latest = index['dates'][-1]

    # Batter pool — same gates as build_dashboard.py (PA >= 200)
    bat_vals = {k: [] for k in ['avg','obp','slg','hr','r','rbi','sb','so']}
    for name, snaps in index['bat'].items():
        s = snaps.get(latest)
        if not s: continue
        pa, ab, h, hr, r, rbi, sb, so, bb, hbp, sf, x1b, x2b, x3b = s
        if pa < 50: continue   # smaller cutoff for in-season pool
        avg = h/ab if ab else 0
        obp = (h+bb+hbp)/(ab+bb+hbp+sf) if (ab+bb+hbp+sf) else 0
        tb = x1b + 2*x2b + 3*x3b + 4*hr
        slg = tb/ab if ab else 0
        bat_vals['avg'].append(avg); bat_vals['obp'].append(obp); bat_vals['slg'].append(slg)
        bat_vals['hr'].append(hr); bat_vals['r'].append(r); bat_vals['rbi'].append(rbi)
        bat_vals['sb'].append(sb); bat_vals['so'].append(so)

    # Pitcher pool (IP >= 10)
    pit_vals = {k: [] for k in ['era','whip','hld','so','hr','sv','w','qs']}
    for name, snaps in index['pit'].items():
        s = snaps.get(latest)
        if not s: continue
        ip, w, sv, hld, so, hr, qs, er, h, bb, tbf = s
        if ip < 5: continue
        era = (er * 9) / ip if ip else 0
        whip = (h + bb) / ip if ip else 0
        pit_vals['era'].append(era); pit_vals['whip'].append(whip)
        pit_vals['hld'].append(hld); pit_vals['so'].append(so); pit_vals['hr'].append(hr)
        pit_vals['sv'].append(sv); pit_vals['w'].append(w); pit_vals['qs'].append(qs)

    def stats(vals):
        if not vals: return {'mean': 0, 'std': 1}
        n = len(vals); mean = sum(vals)/n
        var = sum((v-mean)**2 for v in vals)/n
        return {'mean': mean, 'std': max(var ** 0.5, 1e-6)}

    return {
        'bat': {k: stats(v) for k, v in bat_vals.items()},
        'pit': {k: stats(v) for k, v in pit_vals.items()},
    }


def main():
    if not os.path.isdir(SNAP_DIR):
        print(f"ERROR: {SNAP_DIR} does not exist", file=sys.stderr)
        return 1
    index = build_index()
    print(f"Index: {len(index['dates'])} dates, {len(index['bat'])} batters, {len(index['pit'])} pitchers")
    lcv_stats = build_lcv_stats(index)
    print(f"LCV stats: bat keys={sorted(lcv_stats['bat'].keys())}, pit keys={sorted(lcv_stats['pit'].keys())}")
    with open(OUT_INDEX, 'w') as f:
        json.dump(index, f, separators=(',', ':'))
    with open(OUT_LCVSTATS, 'w') as f:
        json.dump(lcv_stats, f, indent=2)
    print(f"Wrote {OUT_INDEX} ({os.path.getsize(OUT_INDEX):,} bytes)")
    print(f"Wrote {OUT_LCVSTATS} ({os.path.getsize(OUT_LCVSTATS):,} bytes)")
    return 0


if __name__ == '__main__':
    sys.exit(main())

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
    whip = to_float(row.get('whip'))
    bb = to_int(row.get('bb'))
    so = to_int(row.get('so'))
    # ER: prefer raw, else derive from era * ip / 9
    er = to_int(row.get('er'))
    if er == 0 and ip > 0 and era > 0:
        er = round(era * ip / 9.0)
    # H (hits allowed): prefer raw, else derive from whip * ip - bb. Snapshots
    # pre-schema-bump didn't have h; same-day stats may not have h either if
    # fetch_stats.py ran before the column was added. Without this fallback,
    # window-subtracting an h=0 snapshot from a real-h snapshot gives nonsense
    # (negative h → negative WHIP → garbage z-score). The Dollander 14d+ = 88
    # bug came from exactly this.
    h = to_int(row.get('h'))
    if h == 0 and ip > 0 and whip > 0:
        derived = round(whip * ip - bb)
        if derived > 0:
            h = derived
    # tbf / bf field-name normalization across schemas
    tbf = to_int(row.get('tbf'))
    if tbf == 0:
        tbf = to_int(row.get('bf'))
    return [
        ip,
        to_int(row.get('w')),
        to_int(row.get('sv')),
        to_int(row.get('hld')),
        so,
        to_int(row.get('hr')),
        to_int(row.get('qs')),
        er,
        h,
        bb,
        tbf,
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
    """Z-score normalization params for the rolling 14d LCV computed in
    time-splits.js. Use 14d-WINDOW values across all qualifying players so the
    pool means match the units of the value being scored (no pace multiplier).
    Without this, scoring Dollander's paced 21->186 K against the
    cumulative-season pool's mean of 14.7 gives a +20 sigma blowup that
    later collapses back to ~80 via regression. Match-units fixes it.

    Pitchers split into SP / RP via a heuristic on cumulative season totals:
      - SP: any QS in season
      - RP: no QS but >0 HLD or SV
      - Other (mop-up / openers / very few IP): pooled with both for
        normalization to keep std stable.
    """
    import datetime as _dt
    if not index['dates']:
        return {'bat': {}, 'sp': {}, 'rp': {}}

    sorted_dates = sorted(index['dates'])
    latest = sorted_dates[-1]
    target = (_dt.date.fromisoformat(latest) - _dt.timedelta(days=14)).isoformat()
    earlier_for = None
    for d in sorted_dates:
        if d <= target: earlier_for = d
        else: break
    # If no snapshot 14+ days back, fall back to earliest available — keeps
    # window math sane even when we have <14 days of snapshots.
    if not earlier_for and len(sorted_dates) > 1:
        earlier_for = sorted_dates[0]

    def window_bat(name, snaps):
        if earlier_for and earlier_for != latest:
            l = snaps.get(latest); e = snaps.get(earlier_for)
            if l and e:
                return [max(0, l[i] - e[i]) for i in range(len(l))]
        return snaps.get(latest)

    def window_pit(name, snaps):
        if earlier_for and earlier_for != latest:
            l = snaps.get(latest); e = snaps.get(earlier_for)
            if l and e:
                return [max(0, l[i] - e[i]) for i in range(len(l))]
        return snaps.get(latest)

    bat_vals = {k: [] for k in ['avg','obp','slg','hr','r','rbi','sb','so']}
    for name, snaps in index['bat'].items():
        win = window_bat(name, snaps)
        if not win: continue
        pa, ab, h, hr, r, rbi, sb, so, bb, hbp, sf, x1b, x2b, x3b = win
        if pa < 30: continue   # 30 PA window minimum
        avg = h/ab if ab else 0
        obp = (h+bb+hbp)/(ab+bb+hbp+sf) if (ab+bb+hbp+sf) else 0
        tb = x1b + 2*x2b + 3*x3b + 4*hr
        slg = tb/ab if ab else 0
        bat_vals['avg'].append(avg); bat_vals['obp'].append(obp); bat_vals['slg'].append(slg)
        bat_vals['hr'].append(hr); bat_vals['r'].append(r); bat_vals['rbi'].append(rbi)
        bat_vals['sb'].append(sb); bat_vals['so'].append(so)

    sp_vals = {k: [] for k in ['era','whip','hr','so','w','qs']}
    rp_vals = {k: [] for k in ['era','whip','hr','so','sv','hld']}
    for name, snaps in index['pit'].items():
        # Role classification from CUMULATIVE season totals (not window):
        latest_s = snaps.get(latest)
        if not latest_s: continue
        c_ip, c_w, c_sv, c_hld, c_so, c_hr, c_qs, c_er, c_h, c_bb, c_tbf = latest_s
        if c_qs > 0:
            role = 'SP'
        elif c_hld > 0 or c_sv > 0:
            role = 'RP'
        else:
            # Mop-up / opener / TBD — include in both with a higher IP gate so they
            # don't dominate either pool. Skip for now (keeps the SP/RP pools cleaner).
            continue
        win = window_pit(name, snaps)
        if not win: continue
        ip, w, sv, hld, so, hr, qs, er, h, bb, tbf = win
        # IP threshold: 5 IP for SPs (one start), 2 for RPs (couple appearances)
        min_ip = 5.0 if role == 'SP' else 2.0
        if ip < min_ip: continue
        era = (er * 9) / ip if ip else 0
        whip = (h + bb) / ip if ip else 0
        if role == 'SP':
            sp_vals['era'].append(era); sp_vals['whip'].append(whip)
            sp_vals['hr'].append(hr); sp_vals['so'].append(so)
            sp_vals['w'].append(w); sp_vals['qs'].append(qs)
        else:
            rp_vals['era'].append(era); rp_vals['whip'].append(whip)
            rp_vals['hr'].append(hr); rp_vals['so'].append(so)
            rp_vals['sv'].append(sv); rp_vals['hld'].append(hld)

    def stats(vals):
        if len(vals) < 5: return {'mean': 0, 'std': 1}
        n = len(vals); mean = sum(vals)/n
        var = sum((v-mean)**2 for v in vals)/n
        return {'mean': round(mean, 4), 'std': round(max(var ** 0.5, 1e-6), 4)}

    return {
        'window_days': 14,
        'window': {'from': earlier_for, 'to': latest},
        'bat': {k: stats(v) for k, v in bat_vals.items()},
        'sp':  {k: stats(v) for k, v in sp_vals.items()},
        'rp':  {k: stats(v) for k, v in rp_vals.items()},
    }


def main():
    if not os.path.isdir(SNAP_DIR):
        print(f"ERROR: {SNAP_DIR} does not exist", file=sys.stderr)
        return 1
    index = build_index()
    print(f"Index: {len(index['dates'])} dates, {len(index['bat'])} batters, {len(index['pit'])} pitchers")
    lcv_stats = build_lcv_stats(index)
    print(f"LCV stats: bat keys={sorted(lcv_stats['bat'].keys())}, sp keys={sorted(lcv_stats.get('sp', {}).keys())}, rp keys={sorted(lcv_stats.get('rp', {}).keys())} (window {lcv_stats.get('window', {}).get('from')} → {lcv_stats.get('window', {}).get('to')})")
    with open(OUT_INDEX, 'w') as f:
        json.dump(index, f, separators=(',', ':'))
    with open(OUT_LCVSTATS, 'w') as f:
        json.dump(lcv_stats, f, indent=2)
    print(f"Wrote {OUT_INDEX} ({os.path.getsize(OUT_INDEX):,} bytes)")
    print(f"Wrote {OUT_LCVSTATS} ({os.path.getsize(OUT_LCVSTATS):,} bytes)")
    return 0


if __name__ == '__main__':
    sys.exit(main())

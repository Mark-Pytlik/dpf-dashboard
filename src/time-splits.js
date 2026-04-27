// ── Time-Split Analysis ─────────────────────────────────────────────────
// Computes actualLcv/lcvDelta for arbitrary time windows using daily cumulative
// snapshots. The build pipeline embeds snapshot data and LCV z-score parameters.
//
// DESIGN RULE (per user direction): the 14d rolling LCV (and any other window)
// is PURE OBSERVED PERFORMANCE. No projection regression, no Bayesian shrinkage
// toward priors, no pace multiplier on counting stats. Only what the player
// actually did in the window, z-scored against everyone else's stats in the
// same window. Speculation belongs in the projection columns elsewhere on
// the dashboard, not in any "rolling" or "recent" stat.
//
// Per-category weight choices for pitchers (see computePitSplitLcv):
//   ERA, WHIP, HR allowed: full weight (rate stats — stabilize fast).
//   SO: full weight (window K count is meaningful).
//   W (SP): 0.5 weight (over 2-3 starts wins are bullpen + offense noise).
//   QS (SP): dropped (single-inning swings + park dependence — Coors starters
//            basically can't get one even pitching well; ERA already captures
//            the underlying quality).
//   SV (RP): full weight (observed leverage usage).
//   HLD (RP): full weight (observed leverage usage).
//
// For batters (see computeBatSplitLcv): all 8 league categories at equal
// weight, matching the league's H2H scoring exactly. AVG/OBP/SLG triple-
// counts contact ability but that's correct since the league rewards each
// of those three categories independently.
//
// Snapshot format (batting):  [pa, ab, h, hr, r, rbi, sb, so, bb, hbp, sf, x1b, x2b, x3b]
// Snapshot format (pitching): [ip, w, sv, hld, so, hr, qs, er, h, bb, tbf]

// SNAPSHOTS and LCV_STATS are injected by build_dashboard.py.
// If the daily-snapshots pipeline hasn't produced data yet, the build
// substitutes empty defaults so this file still evaluates cleanly.
const SNAPSHOTS = __SNAPSHOTS_JSON__;
const LCV_STATS = __LCV_STATS_JSON__;

// Snapshot column indices
const _BAT_SNAP_COLS = ['pa','ab','h','hr','r','rbi','sb','so','bb','hbp','sf','x1b','x2b','x3b'];
const _PIT_SNAP_COLS = ['ip','w','sv','hld','so','hr','qs','er','h','bb','tbf'];

const SPLIT_WINDOWS = [
  { key: 'full', label: 'Full Season', days: 0 },
  { key: '7d',   label: 'Last 7 Days', days: 7 },
  { key: '14d',  label: 'Last 14 Days', days: 14 },
  { key: '30d',  label: 'Last 30 Days', days: 30 },
  { key: '60d',  label: 'Last 2 Months', days: 60 },
];

// Current active split window (persisted in state as _splitWindow)
function getActiveSplit() {
  return (typeof state !== 'undefined' && state._splitWindow) || 'full';
}

function _zscore(val, mean, std) {
  if (!std) return 0;
  return (val - mean) / std;
}

// Find the snapshot date closest to (but not after) targetDate
function _findClosestDate(dates, targetDate) {
  let best = null;
  for (const d of dates) {
    if (d <= targetDate) best = d;
    else break; // dates are sorted
  }
  return best;
}

// Subtract two snapshot arrays element-wise: latest - earlier
function _subtractSnap(latest, earlier) {
  return latest.map((v, i) => v - (earlier[i] || 0));
}

/**
 * Compute split batting stats for a window.
 * Returns { pa, ab, h, hr, r, rbi, sb, so, bb, hbp, sf, avg, obp, slg } or null.
 */
function computeBatSplitStats(playerName, windowDays) {
  const snapDates = SNAPSHOTS.dates;
  if (!snapDates || snapDates.length === 0) return null;
  const playerSnaps = SNAPSHOTS.bat[playerName];
  if (!playerSnaps) return null;

  const latestDate = snapDates[snapDates.length - 1];
  const latestSnap = playerSnaps[latestDate];
  if (!latestSnap) return null;

  if (windowDays === 0) {
    // Full season — use latest snapshot directly
    const s = {};
    _BAT_SNAP_COLS.forEach((c, i) => s[c] = latestSnap[i]);
    // Compute rate stats from components
    s.avg = s.ab > 0 ? s.h / s.ab : 0;
    s.obp = (s.ab + s.bb + s.hbp + s.sf) > 0 ? (s.h + s.bb + s.hbp) / (s.ab + s.bb + s.hbp + s.sf) : 0;
    const tb = s.x1b + 2 * s.x2b + 3 * s.x3b + 4 * s.hr;
    s.slg = s.ab > 0 ? tb / s.ab : 0;
    return s;
  }

  // Find the snapshot closest to (latestDate - windowDays)
  const latestMs = new Date(latestDate + 'T12:00:00Z').getTime();
  const targetMs = latestMs - windowDays * 86400000;
  const targetDate = new Date(targetMs).toISOString().slice(0, 10);
  const earlierDate = _findClosestDate(snapDates, targetDate);

  let windowSnap;
  if (!earlierDate || earlierDate === latestDate) {
    // No earlier snapshot — use full season data
    windowSnap = latestSnap;
  } else {
    const earlierSnap = playerSnaps[earlierDate];
    if (!earlierSnap) {
      windowSnap = latestSnap;
    } else {
      windowSnap = _subtractSnap(latestSnap, earlierSnap);
    }
  }

  const s = {};
  _BAT_SNAP_COLS.forEach((c, i) => s[c] = Math.max(0, windowSnap[i]));
  s.avg = s.ab > 0 ? s.h / s.ab : 0;
  s.obp = (s.ab + s.bb + s.hbp + s.sf) > 0 ? (s.h + s.bb + s.hbp) / (s.ab + s.bb + s.hbp + s.sf) : 0;
  const tb = (s.x1b || 0) + 2 * (s.x2b || 0) + 3 * (s.x3b || 0) + 4 * s.hr;
  s.slg = s.ab > 0 ? tb / s.ab : 0;
  return s;
}

/**
 * Compute split pitching stats for a window.
 * Returns { ip, w, sv, hld, so, hr, qs, er, h, bb, tbf, era, whip } or null.
 */
function computePitSplitStats(playerName, windowDays) {
  const snapDates = SNAPSHOTS.dates;
  if (!snapDates || snapDates.length === 0) return null;
  const playerSnaps = SNAPSHOTS.pit[playerName];
  if (!playerSnaps) return null;

  const latestDate = snapDates[snapDates.length - 1];
  const latestSnap = playerSnaps[latestDate];
  if (!latestSnap) return null;

  if (windowDays === 0) {
    const s = {};
    _PIT_SNAP_COLS.forEach((c, i) => s[c] = latestSnap[i]);
    s.era = s.ip > 0 ? (s.er / s.ip) * 9 : 0;
    s.whip = s.ip > 0 ? (s.h + s.bb) / s.ip : 0;
    return s;
  }

  const latestMs = new Date(latestDate + 'T12:00:00Z').getTime();
  const targetMs = latestMs - windowDays * 86400000;
  const targetDate = new Date(targetMs).toISOString().slice(0, 10);
  const earlierDate = _findClosestDate(snapDates, targetDate);

  let windowSnap;
  if (!earlierDate || earlierDate === latestDate) {
    windowSnap = latestSnap;
  } else {
    const earlierSnap = playerSnaps[earlierDate];
    if (!earlierSnap) {
      windowSnap = latestSnap;
    } else {
      windowSnap = _subtractSnap(latestSnap, earlierSnap);
    }
  }

  const s = {};
  _PIT_SNAP_COLS.forEach((c, i) => s[c] = Math.max(0, windowSnap[i]));
  s.era = s.ip > 0 ? (s.er / s.ip) * 9 : 0;
  s.whip = s.ip > 0 ? (s.h + s.bb) / s.ip : 0;
  return s;
}

/**
 * Compute actual LCV for a batter in a given time window.
 * Uses pace-adjusted counting stats relative to projected PA.
 * Returns { actualLcv, lcvDelta, splitConfidence } or null.
 */
function computeBatSplitLcv(player, windowDays, opts) {
  const stats = computeBatSplitStats(player.name, windowDays);
  const minPa = (opts && opts.minPa != null) ? opts.minPa : 30;
  if (!stats || stats.pa < minPa) return null;

  const bs = LCV_STATS.bat;
  // OBSERVED 14d performance only. No projection blending — the pool
  // means in LCV_STATS are from each batter's actual 14d window so units
  // match. (User direction: the rolling number must be pure observation;
  // any speculation belongs in the projection columns elsewhere.)
  const rawLcv = _zscore(stats.avg, bs.avg.mean, bs.avg.std)
    + _zscore(stats.hr,  bs.hr.mean,  bs.hr.std)
    + _zscore(stats.obp, bs.obp.mean, bs.obp.std)
    + _zscore(stats.slg, bs.slg.mean, bs.slg.std)
    + _zscore(stats.r,   bs.r.mean,   bs.r.std)
    + _zscore(stats.rbi, bs.rbi.mean, bs.rbi.std)
    + _zscore(stats.sb,  bs.sb.mean,  bs.sb.std)
    - _zscore(stats.so,  bs.so.mean,  bs.so.std);

  const projLcv = player.lcv || 0;
  const lcv = rawLcv;

  // Sample size confidence: PA < 50 = low, 50-120 = med, >120 = high
  let splitConfidence = 'high';
  if (stats.pa < 50) splitConfidence = 'low';
  else if (stats.pa < 120) splitConfidence = 'med';

  return { actualLcv: Math.round(lcv * 100) / 100, lcvDelta: Math.round((lcv - projLcv) * 100) / 100, splitConfidence };
}

/**
 * Compute actual LCV for a pitcher in a given time window.
 * Returns { actualLcv, lcvDelta, splitConfidence } or null.
 */
function computePitSplitLcv(player, windowDays, opts) {
  const stats = computePitSplitStats(player.name, windowDays);
  const isRP = (player.pos === 'RP' || player.primaryPos === 'RP');
  // IP threshold: 3 IP for RPs, 10 IP for SPs by default. Callers (e.g. the
  // 7-day window) may override with opts.minIp / opts.minIpRp.
  let minIp;
  if (opts && opts.minIp != null) {
    minIp = isRP && opts.minIpRp != null ? opts.minIpRp : opts.minIp;
  } else {
    minIp = isRP ? 3.0 : 10.0;
  }
  if (!stats || stats.ip < minIp) return null;

  // Use the SP-window pool for SPs, RP-window pool for RPs. The pool means
  // are computed in build_snapshots_index.py from each pitcher's actual 14d
  // window stats (NOT cumulative season totals), so units match — no pace
  // multiplier needed. Without this, paced 21->186 K vs season-cumulative
  // 14.7 K mean would give Dollander a +20 sigma blowup that later collapsed
  // to ~80 via regression.
  const ps = isRP ? LCV_STATS.rp : LCV_STATS.sp;
  if (!ps || !ps.era) {
    // Fallback for older lcv_stats (no SP/RP split): use legacy path.
    const psLegacy = LCV_STATS.pit || {};
    if (!psLegacy.era) return null;
    const projIp = player.ip || 150;
    const pace = projIp / stats.ip;
    const rawLcv = -_zscore(stats.era, psLegacy.era.mean, psLegacy.era.std)
      + _zscore(stats.hld * pace, psLegacy.hld.mean, psLegacy.hld.std)
      - _zscore(stats.hr * pace, psLegacy.hr.mean, psLegacy.hr.std)
      + _zscore(stats.so * pace, psLegacy.so.mean, psLegacy.so.std)
      + _zscore(stats.sv * pace, psLegacy.sv.mean, psLegacy.sv.std)
      + _zscore(stats.w * pace, psLegacy.w.mean, psLegacy.w.std)
      - _zscore(stats.whip, psLegacy.whip.mean, psLegacy.whip.std)
      + _zscore(stats.qs * pace, psLegacy.qs.mean, psLegacy.qs.std);
    // Legacy fallback: also pure observed (no projection regression) so
    // behaviour matches the modern path. lcvDelta is preserved as
    // metadata only — observed minus projection — but doesn't affect the
    // rolling LCV value itself.
    const projLcv = player.lcv || 0;
    let splitConfidence = stats.ip < 15 ? 'low' : (stats.ip < 40 ? 'med' : 'high');
    return { actualLcv: Math.round(rawLcv * 100) / 100, lcvDelta: Math.round((rawLcv - projLcv) * 100) / 100, splitConfidence };
  }

  // 14d LCV is OBSERVED performance only — no projection blending. The pool
  // means/stds in LCV_STATS are already from each pitcher's actual 14d
  // window (matched units, see build_snapshots_index.py), so a raw z-score
  // sum here is directly comparable across pitchers.
  //
  // Category weights (analyst-tuned for small-window noise):
  //   ERA, WHIP, HR allowed: full weight — these are rate stats that
  //     stabilize relatively fast and reflect actual quality.
  //   SO: full weight — sample size dependent but the K rate within the
  //     window is meaningful.
  //   W (SP): 0.5 — wins over 2-3 starts are bullpen + offense noise,
  //     not the pitcher's quality.
  //   QS (SP): 0 — drop from rolling. With ~2 starts, QS swings on a
  //     single bad inning; Coors starters basically can't get them. ERA
  //     already captures the underlying quality.
  //   SV (RP): full weight — observed leverage usage.
  //   HLD (RP): full weight — observed leverage usage.
  let rawLcv;
  if (isRP) {
    rawLcv = -_zscore(stats.era,  ps.era.mean,  ps.era.std)
           - _zscore(stats.whip, ps.whip.mean, ps.whip.std)
           - _zscore(stats.hr,   ps.hr.mean,   ps.hr.std)
           + _zscore(stats.so,   ps.so.mean,   ps.so.std)
           + _zscore(stats.sv,   ps.sv.mean,   ps.sv.std)
           + _zscore(stats.hld,  ps.hld.mean,  ps.hld.std);
  } else {
    rawLcv = -_zscore(stats.era,  ps.era.mean,  ps.era.std)
           - _zscore(stats.whip, ps.whip.mean, ps.whip.std)
           - _zscore(stats.hr,   ps.hr.mean,   ps.hr.std)
           + _zscore(stats.so,   ps.so.mean,   ps.so.std)
           + 0.5 * _zscore(stats.w, ps.w.mean, ps.w.std);
    // QS dropped from SP rolling formula on purpose (see above).
  }

  let splitConfidence = 'high';
  if (stats.ip < (isRP ? 5 : 15)) splitConfidence = 'low';
  else if (stats.ip < (isRP ? 12 : 40)) splitConfidence = 'med';

  // Return raw observed LCV — projected LCV is left out of this calculation
  // entirely. lcvDelta is preserved as a convenience (observed minus
  // projection) for callers that compare the two, but is no longer used in
  // the actualLcv value itself.
  const projLcv = player.lcv || 0;
  return {
    actualLcv: Math.round(rawLcv * 100) / 100,
    lcvDelta: Math.round((rawLcv - projLcv) * 100) / 100,
    splitConfidence
  };
}

/**
 * Apply a time-split window to all players, updating their actualLcv/lcvDelta.
 * Call this when the user changes the split window, then re-render.
 */
function applySplitWindow(windowKey) {
  const win = SPLIT_WINDOWS.find(w => w.key === windowKey);
  if (!win) return;

  const hasSplitData = SNAPSHOTS.dates && SNAPSHOTS.dates.length > 1;

  ALL.forEach(p => {
    if (windowKey === 'full' || !hasSplitData) {
      // Restore original full-season values (stored at build time)
      p.actualLcv = p._origActualLcv != null ? p._origActualLcv : p.actualLcv;
      p.lcvDelta = p._origLcvDelta != null ? p._origLcvDelta : p.lcvDelta;
      return;
    }

    const splitResult = p.type === 'PIT'
      ? computePitSplitLcv(p, win.days)
      : computeBatSplitLcv(p, win.days);

    if (splitResult) {
      p.actualLcv = splitResult.actualLcv;
      p.lcvDelta = splitResult.lcvDelta;
      p._splitConfidence = splitResult.splitConfidence;
    } else {
      p.actualLcv = null;
      p.lcvDelta = null;
      p._splitConfidence = null;
    }
  });
}

// On initial load, save the original full-season values so we can restore them.
// Also compute an always-on rolling 14-day "hot/cold" signal, independent of
// whatever window the user has selected. This lights up the HOT/COLD column
// and the Waiver War Room without requiring the user to switch windows.
function _initOriginalLcvValues() {
  const hasRolling = hasSplitData();
  ALL.forEach(p => {
    if (p.actualLcv != null) p._origActualLcv = p.actualLcv;
    if (p.lcvDelta != null) p._origLcvDelta = p.lcvDelta;

    if (!hasRolling) return;

    // 7-day rolling LCV — looser thresholds (10 PA, 5 IP / 3 IP RP) since the
    // window is half the size of the 14-day pass.
    const split7 = p.type === 'PIT'
      ? computePitSplitLcv(p, 7, { minIp: 5.0, minIpRp: 3.0 })
      : computeBatSplitLcv(p, 7, { minPa: 10 });
    if (split7) {
      p.rollingLcv7 = split7.actualLcv;
      p.rollingLcvDelta7 = split7.lcvDelta;
      p._splitConfidence7 = split7.splitConfidence;
    }

    const split = p.type === 'PIT'
      ? computePitSplitLcv(p, 14)
      : computeBatSplitLcv(p, 14);
    if (!split) return;
    p.rollingLcv14 = split.actualLcv;
    p.rollingLcvDelta14 = split.lcvDelta;  // kept as caller-side metadata only
    p._splitConfidence14 = split.splitConfidence;
    // HOT/COLD set further down once rollingLcvPlus14 is computed — the
    // categorical label needs to match what's visible in the 14d+ column,
    // and that's the 100-scale value, not the raw rolling LCV.
  });

  // Convert rolling 14d LCV to a 100-scale (wRC+ style):
  //   100 = pool average within type/role, 115 = +1sigma, 85 = -1sigma.
  // We pool batters together and split SPs from RPs (mirrors how aLCVPlus
  // is bucketed in build_dashboard.py) so a +1sigma SP and a +1sigma RP
  // both map to ~115 within their own role rather than getting flattened
  // by the full pitcher pool.
  function _meanStd(vals) {
    if (!vals.length) return null;
    const m = vals.reduce((s, v) => s + v, 0) / vals.length;
    const v = vals.reduce((s, v) => s + (v - m) * (v - m), 0) / vals.length;
    return { mean: m, std: Math.max(Math.sqrt(v), 1e-6) };
  }
  function _applyPlus(records, srcKey, dstKey) {
    const vals = records.map(r => r[srcKey]).filter(v => Number.isFinite(v));
    const ms = _meanStd(vals);
    if (!ms) return;
    records.forEach(r => {
      const v = r[srcKey];
      if (Number.isFinite(v)) r[dstKey] = Math.round((100 + (v - ms.mean) / ms.std * 15) * 10) / 10;
    });
  }
  const _withRolling = ALL.filter(p => Number.isFinite(p.rollingLcv14));
  const _bats = _withRolling.filter(p => p.type === 'BAT');
  const _sps = _withRolling.filter(p => p.type === 'PIT' && (p.pos === 'SP' || p.primaryPos === 'SP'));
  const _rps = _withRolling.filter(p => p.type === 'PIT' && p.pos !== 'SP' && p.primaryPos !== 'SP');
  _applyPlus(_bats, 'rollingLcv14', 'rollingLcvPlus14');
  _applyPlus(_sps,  'rollingLcv14', 'rollingLcvPlus14');
  _applyPlus(_rps,  'rollingLcv14', 'rollingLcvPlus14');

  // Same wRC+-style scaling for the 7-day rolling LCV → rollingLcvPlus7.
  // Pool buckets stay the same (BAT / SP / RP) so a +1sigma 7d performance
  // also lands at ~115 within its own role.
  const _withRolling7 = ALL.filter(p => Number.isFinite(p.rollingLcv7));
  const _bats7 = _withRolling7.filter(p => p.type === 'BAT');
  const _sps7 = _withRolling7.filter(p => p.type === 'PIT' && (p.pos === 'SP' || p.primaryPos === 'SP'));
  const _rps7 = _withRolling7.filter(p => p.type === 'PIT' && p.pos !== 'SP' && p.primaryPos !== 'SP');
  _applyPlus(_bats7, 'rollingLcv7', 'rollingLcvPlus7');
  _applyPlus(_sps7,  'rollingLcv7', 'rollingLcvPlus7');
  _applyPlus(_rps7,  'rollingLcv7', 'rollingLcvPlus7');

  // HOT / COLD label tied to the SAME observed 14d+ value the user sees
  // in the column. wRC+ thresholds:
  //   HOT  = 14d+ ≥ 130  (~+2sigma above pool average — clearly elite stretch)
  //   COLD = 14d+ ≤ 70   (~-2sigma — clearly poor stretch)
  // Anything in between is left blank. Uses the 100-scale directly so a
  // 145 14d+ never gets COLD'd just because the projection was higher.
  ALL.forEach(p => {
    const v = p.rollingLcvPlus14;
    if (!Number.isFinite(v)) { p.hotCold14 = ''; return; }
    if (v >= 130) p.hotCold14 = 'HOT';
    else if (v <= 70) p.hotCold14 = 'COLD';
    else p.hotCold14 = '';
  });
}

// Check if split data is available (more than 1 snapshot date)
function hasSplitData() {
  return SNAPSHOTS.dates && SNAPSHOTS.dates.length > 1;
}

/**
 * Render the time-split dropdown HTML.
 * Returns empty string if no split data available.
 */
function renderSplitToggle(containerId) {
  if (!hasSplitData() && SNAPSHOTS.dates.length === 0) return '';

  const activeKey = getActiveSplit();
  const nDates = SNAPSHOTS.dates.length;
  const dateRange = nDates > 0 ? `${SNAPSHOTS.dates[0]} — ${SNAPSHOTS.dates[nDates-1]}` : '';

  let h = '<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;">';
  h += '<span style="color:var(--text2);">Time window:</span>';
  h += `<select class="split-toggle" style="font-size:10px;padding:1px 4px;background:var(--surface2);color:var(--text);border:1px solid var(--border);border-radius:4px;cursor:pointer;">`;
  SPLIT_WINDOWS.forEach(w => {
    const disabled = w.days > 0 && nDates < 2 ? ' disabled' : '';
    const selected = w.key === activeKey ? ' selected' : '';
    h += `<option value="${w.key}"${selected}${disabled}>${w.label}</option>`;
  });
  h += '</select>';
  if (nDates > 0) {
    h += `<span style="color:var(--text2);font-size:9px;" title="Snapshot range: ${dateRange}">(${nDates} snapshots)</span>`;
  }
  h += '</span>';
  return h;
}

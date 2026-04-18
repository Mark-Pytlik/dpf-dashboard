// ── Time-Split Analysis ─────────────────────────────────────────────────
// Computes actualLcv/lcvDelta for arbitrary time windows using daily cumulative
// snapshots. The build pipeline embeds snapshot data and LCV z-score parameters.
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
function computeBatSplitLcv(player, windowDays) {
  const stats = computeBatSplitStats(player.name, windowDays);
  if (!stats || stats.pa < 30) return null;

  const projPa = player.pa || 550; // projected full-season PA
  const pace = projPa / stats.pa;
  const bs = LCV_STATS.bat;

  const rawLcv = _zscore(stats.avg, bs.avg.mean, bs.avg.std)
    + _zscore(stats.hr * pace, bs.hr.mean, bs.hr.std)
    + _zscore(stats.obp, bs.obp.mean, bs.obp.std)
    + _zscore(stats.slg, bs.slg.mean, bs.slg.std)
    + _zscore(stats.r * pace, bs.r.mean, bs.r.std)
    + _zscore(stats.rbi * pace, bs.rbi.mean, bs.rbi.std)
    + _zscore(stats.sb * pace, bs.sb.mean, bs.sb.std)
    - _zscore(stats.so * pace, bs.so.mean, bs.so.std);

  // Regress toward projected LCV based on sample size.
  // At 30 PA trust actual ~30%, at 200 PA trust ~80%, at 500+ PA trust ~100%.
  const reliability = Math.min(1, stats.pa / 500);
  const projLcv = player.lcv || 0;
  const lcv = reliability * rawLcv + (1 - reliability) * projLcv;

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
function computePitSplitLcv(player, windowDays) {
  const stats = computePitSplitStats(player.name, windowDays);
  // IP threshold: 3 IP for RPs (short outings), 10 IP for SPs
  const minIp = (player.pos === 'RP' || player.primaryPos === 'RP') ? 3.0 : 10.0;
  if (!stats || stats.ip < minIp) return null;

  const projIp = player.ip || 150;
  const pace = projIp / stats.ip;
  const ps = LCV_STATS.pit;

  const rawLcv = -_zscore(stats.era, ps.era.mean, ps.era.std)
    + _zscore(stats.hld * pace, ps.hld.mean, ps.hld.std)
    - _zscore(stats.hr * pace, ps.hr.mean, ps.hr.std)
    + _zscore(stats.so * pace, ps.so.mean, ps.so.std)
    + _zscore(stats.sv * pace, ps.sv.mean, ps.sv.std)
    + _zscore(stats.w * pace, ps.w.mean, ps.w.std)
    - _zscore(stats.whip, ps.whip.mean, ps.whip.std)
    + _zscore(stats.qs * pace, ps.qs.mean, ps.qs.std);

  // Regress toward projected LCV based on sample size.
  // At 10 IP trust actual ~10%, at 80 IP trust ~53%, at 150+ IP trust ~100%.
  const projIpFull = player.ip || 150;
  const reliability = Math.min(1, stats.ip / projIpFull);
  const projLcv = player.lcv || 0;
  const lcv = reliability * rawLcv + (1 - reliability) * projLcv;

  // Sample size confidence: IP < 15 = low, 15-40 = med, >40 = high
  let splitConfidence = 'high';
  if (stats.ip < 15) splitConfidence = 'low';
  else if (stats.ip < 40) splitConfidence = 'med';

  return { actualLcv: Math.round(lcv * 100) / 100, lcvDelta: Math.round((lcv - projLcv) * 100) / 100, splitConfidence };
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
    const split = p.type === 'PIT'
      ? computePitSplitLcv(p, 14)
      : computeBatSplitLcv(p, 14);
    if (!split) return;
    p.rollingLcv14 = split.actualLcv;
    p.rollingLcvDelta14 = split.lcvDelta;
    p._splitConfidence14 = split.splitConfidence;

    // The HOT/COLD status is the 14-day LCV's swing relative to the
    // projection. Thresholds are generous for pitchers because their IP-
    // scaled z-scores move faster.
    const thresh = p.type === 'PIT' ? 3.5 : 2.5;
    const coldThresh = p.type === 'PIT' ? -3.0 : -2.5;
    if (split.lcvDelta >= thresh) p.hotCold14 = 'HOT';
    else if (split.lcvDelta <= coldThresh) p.hotCold14 = 'COLD';
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

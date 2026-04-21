// ── Waiver War Room ──────────────────────────────────────────────────────
// Season-mode only. Ranks available free agents by a composite "Waiver
// Priority" (WP) score that blends:
//   • Base LCV (season-level projection vs actual value)
//   • Rolling 14-day LCV delta (hot/cold)
//   • Role upside (closer / setup / handcuff bump, rookie bump)
//   • Injury penalty (IL/DTD subtract from score)
//
// A player only appears if they are NOT drafted (state.drafted) AND not on
// any league roster. The score surfaces players trending up who aren't
// already owned — the core of a waiver scouting workflow.
function renderWaiverWarRoom() {
  const section = document.getElementById('waiverSection');
  if (!section) return;
  try {
    _renderWaiverInner(section);
  } catch (e) {
    section.innerHTML =
      '<div style="padding:20px;color:var(--red);"><b>Waiver War Room Error:</b> ' +
      e.message +
      '<br><pre style="font-size:10px;margin-top:8px;">' +
      (e.stack || '').replace(/</g, '&lt;') +
      '</pre></div>';
    console.error('Waiver render error:', e);
  }
}

// Persist filter state on state._waiver so it survives re-renders
function _getWaiverState() {
  state._waiver = state._waiver || {
    type: 'all',       // 'all' | 'bat' | 'pit'
    pos: 'ALL',
    minScore: 0,
    sortBy: 'wp',      // 'wp' | 'delta' | 'lcv' | 'role'
    roleOnly: false,   // only show closers/setup/handcuffs
    hotOnly: false,    // only players flagged HOT
  };
  return state._waiver;
}

function _computeWaiverScore(p) {
  const projLcv = p.lcv || 0;
  const actLcv = p.actualLcv != null ? p.actualLcv : projLcv;
  const baseLcv = actLcv;
  const delta14 = p.rollingLcvDelta14 != null ? p.rollingLcvDelta14 : 0;
  const conf14 = p._splitConfidence14 != null ? p._splitConfidence14 : 0;
  // Confidence-weight the rolling signal so small-sample blow-ups don't
  // dominate. Low-PA/IP players still get credit, just less of it.
  const weightedDelta = delta14 * Math.min(1, Math.max(0.25, conf14));

  // Role upside — closer > setup > handcuff
  let role = 0;
  if (p.type === 'PIT') {
    const teamCloser = BP_CLOSER_MAP.get(p.team);
    const teamHc = BP_HANDCUFF_MAP.get(p.team);
    if (teamCloser && teamCloser === p.name) role += 4;
    else if (teamHc && teamHc === p.name) role += 2;
    // Setup tagging comes from _role_tags badge in data.js; cheap proxy: SV+HLD pace
    const sv = (p.s26 && p.s26.sv) || 0;
    const hld = (p.s26 && p.s26.hld) || 0;
    if (sv >= 3) role += 1;
    else if (hld >= 5) role += 0.5;
  }
  // Rookie / prospect bump
  if (p.rookie) role += 1;

  // Injury penalty
  let injPenalty = 0;
  const inj = INJURY_MAP.get(p.name);
  if (inj) {
    if (inj.status === 'O' || inj.status === 'IL') injPenalty = 4;
    else if (inj.status === 'DTD') injPenalty = 1.5;
    else injPenalty = 0.5;
  }

  const wp = baseLcv * 0.5 + weightedDelta * 1.2 + role - injPenalty;
  return { wp, base: baseLcv, proj: projLcv, act: actLcv, delta: weightedDelta, role, inj: injPenalty };
}

// Build a normalized Set of every rostered player across state.drafted,
// state.leagueTeams, and state.myTeam. CBS transactions use ASCII names
// ("Edwin Diaz") but the projection pool is often accented ("Edwin Díaz"),
// so raw string equality misses hits. Normalize both sides (strip accents,
// lowercase, drop punctuation) and also resolve each name through _plyrI
// so we catch aliases (e.g. "Cam Schlittler" ↔ "Cameron Schlittler").
let _waiverRosteredSet = null;
function _normRosterName(s) {
  if (!s) return '';
  return _stripAccents(s).toLowerCase().replace(/[\.\s'`]+/g, '').replace(/\bjr\b/g, '');
}
function _buildWaiverRosteredSet() {
  const set = new Set();
  const addName = (n) => {
    if (!n || typeof n !== 'string') return;
    set.add(_normRosterName(n));
    // Also resolve to canonical via _plyrI so aliases all collapse
    if (typeof _plyrI === 'function') {
      const canon = _plyrI(n);
      if (canon && canon.name) set.add(_normRosterName(canon.name));
    }
  };
  if (state.drafted) Object.keys(state.drafted).forEach(addName);
  if (state.myTeam) state.myTeam.forEach(addName);
  if (state.leagueTeams) {
    Object.values(state.leagueTeams).forEach(list => (list || []).forEach(addName));
  }
  _waiverRosteredSet = set;
  return set;
}
function _isWaiverAvailable(p) {
  const set = _waiverRosteredSet || _buildWaiverRosteredSet();
  return !set.has(_normRosterName(p.name));
}

function _renderWaiverInner(section) {
  const ws = _getWaiverState();
  const hasRolling = typeof hasSplitData === 'function' && hasSplitData();

  // Build candidate pool with scores. Rebuild the rostered-name set fresh
  // each render so adds/drops since last render are reflected.
  _waiverRosteredSet = null;
  _buildWaiverRosteredSet();
  const candidates = [];
  ALL.forEach(p => {
    if (!_isWaiverAvailable(p)) return;
    // Only skip truly unrosterable dregs. Early in the season actualLcv
    // swings hard negative on 10-PA samples (a hitter who's 1-for-25 sits
    // at −6), and projected LCV for deep bench bats commonly sits below
    // −3. We still want those visible so the user can sort/filter. Only
    // drop players whose season projection AND rolling signal are both
    // very bad, with no role upside.
    const projLcv = p.lcv || 0;
    const actLcv = p.actualLcv != null ? p.actualLcv : projLcv;
    const delta14 = p.rollingLcvDelta14 || 0;
    const hasSignal = delta14 >= 1 || p.hotCold14 === 'HOT' || p.rookie
      || (p.type === 'PIT' && (BP_CLOSER_MAP.get(p.team) === p.name || BP_HANDCUFF_MAP.get(p.team) === p.name));
    if (projLcv < -10 && actLcv < -5 && !hasSignal) return;
    const s = _computeWaiverScore(p);
    candidates.push({ p, ...s });
  });

  // Apply filters
  let filtered = candidates.filter(c => {
    if (ws.type === 'bat' && c.p.type !== 'BAT') return false;
    if (ws.type === 'pit' && c.p.type !== 'PIT') return false;
    if (ws.pos !== 'ALL') {
      const pos = c.p.primaryPos;
      if (pos !== ws.pos && !(c.p.pos || '').includes(ws.pos)) return false;
    }
    if (ws.minScore && c.wp < ws.minScore) return false;
    if (ws.hotOnly && c.p.hotCold14 !== 'HOT') return false;
    if (ws.roleOnly && c.role <= 0) return false;
    return true;
  });

  // Sort
  const cmpNum = (k) => (a, b) => (b[k] || 0) - (a[k] || 0);
  if (ws.sortBy === 'wp') filtered.sort(cmpNum('wp'));
  else if (ws.sortBy === 'delta') filtered.sort(cmpNum('delta'));
  else if (ws.sortBy === 'lcv') filtered.sort(cmpNum('base'));
  else if (ws.sortBy === 'role') filtered.sort(cmpNum('role'));

  // Header
  let html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">';
  html += '<div>';
  html += '<h2 style="font-size:18px;font-weight:700;">Waiver War Room</h2>';
  html += '<div style="font-size:11px;color:var(--text2);margin-top:2px;">Composite ranking of available free agents. ';
  html += hasRolling
    ? 'Blends season LCV with rolling 14-day trend, role upside, minus injury risk.'
    : '<span style="color:var(--yellow);">Rolling snapshots not available — showing season-only scores.</span>';
  html += '</div></div>';
  html += `<div style="font-size:11px;color:var(--text2);">${filtered.length} of ${candidates.length} available</div>`;
  html += '</div>';

  // Filter bar
  html += '<div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;align-items:center;">';
  const typeOpts = [['all','All'],['bat','Hitters'],['pit','Pitchers']];
  typeOpts.forEach(([k, label]) => {
    const act = ws.type === k ? 'active' : '';
    html += `<button class="filter-btn ${act}" data-waiver-type="${k}">${label}</button>`;
  });
  html += '<div style="width:1px;height:20px;background:var(--border);"></div>';
  const posGroup = ws.type === 'pit'
    ? ['ALL','SP','RP']
    : ws.type === 'bat'
      ? ['ALL','C','1B','2B','3B','SS','LF','CF','RF','DH']
      : ['ALL','C','1B','2B','3B','SS','LF','CF','RF','DH','SP','RP'];
  posGroup.forEach(pos => {
    const act = ws.pos === pos ? 'active' : '';
    html += `<button class="filter-btn ${act}" data-waiver-pos="${pos}">${pos}</button>`;
  });
  html += '<div style="width:1px;height:20px;background:var(--border);"></div>';
  html += '<label style="display:flex;align-items:center;gap:4px;font-size:11px;cursor:pointer;">';
  html += `<input type="checkbox" id="waiverHotOnly"${ws.hotOnly ? ' checked' : ''}> HOT only</label>`;
  html += '<label style="display:flex;align-items:center;gap:4px;font-size:11px;cursor:pointer;">';
  html += `<input type="checkbox" id="waiverRoleOnly"${ws.roleOnly ? ' checked' : ''}> Role/rookie only</label>`;
  html += '<div style="width:1px;height:20px;background:var(--border);"></div>';
  html += '<span style="font-size:11px;color:var(--text2);">Sort:</span>';
  html += '<select id="waiverSort" style="padding:4px 8px;font-size:11px;background:var(--surface2);color:var(--text);border:1px solid var(--border);border-radius:4px;">';
  const sortOpts = [['wp','WP Score'],['delta','14-day Δ'],['lcv','Season LCV'],['role','Role upside']];
  sortOpts.forEach(([k, label]) => {
    html += `<option value="${k}"${ws.sortBy === k ? ' selected' : ''}>${label}</option>`;
  });
  html += '</select>';
  html += '</div>';

  // Table
  html += '<div style="background:var(--surface);border-radius:10px;border:1px solid var(--border);overflow-x:auto;">';
  html += '<table style="width:100%;border-collapse:collapse;font-size:12px;">';
  html += '<thead><tr style="text-align:left;border-bottom:1px solid var(--border);">';
  const cols = [
    ['#', 'width:32px;color:var(--text2);'],
    ['Player', ''],
    ['Pos', 'width:60px;'],
    ['Team', 'width:50px;'],
    ['Age', 'width:40px;'],
    ['WP', 'width:60px;text-align:right;'],
    ['LCV', 'width:60px;text-align:right;color:var(--text2);'],
    ['aLCV', 'width:60px;text-align:right;color:var(--text2);'],
    ['14d Δ', 'width:60px;text-align:right;'],
    ['Role', 'width:50px;text-align:right;'],
    ['Inj', 'width:50px;text-align:right;'],
    ['Tags', ''],
  ];
  cols.forEach(([label, style]) => {
    html += `<th style="padding:8px 10px;font-weight:600;font-size:11px;color:var(--text2);${style}">${label}</th>`;
  });
  html += '</tr></thead><tbody>';

  const cap = 150;
  filtered.slice(0, cap).forEach((c, i) => {
    const p = c.p;
    const hotBadge = p.hotCold14 === 'HOT'
      ? ' <span class="pbadge" style="background:#dc2626;color:#fff;">HOT</span>'
      : p.hotCold14 === 'COLD'
        ? ' <span class="pbadge" style="background:#2563eb;color:#fff;">COLD</span>'
        : '';
    const injBadge = _injBadge(p.name);
    const deltaFmt = c.delta === 0
      ? '—'
      : (c.delta > 0 ? '+' : '') + c.delta.toFixed(1);
    const deltaColor = c.delta > 1 ? 'var(--green)' : c.delta < -1 ? 'var(--red)' : 'var(--text2)';
    const wpColor = c.wp > 5 ? 'var(--green)' : c.wp < -2 ? 'var(--red)' : 'var(--text)';

    // Tags: rookie, closer, handcuff, buy/sell hints
    const tags = [];
    if (p.rookie) tags.push('<span class="pbadge" style="background:#7c3aed;color:#fff;">RK</span>');
    const tc = BP_CLOSER_MAP.get(p.team);
    const th = BP_HANDCUFF_MAP.get(p.team);
    if (p.type === 'PIT' && tc === p.name) tags.push('<span class="pbadge" style="background:#dc2626;color:#fff;">CL</span>');
    else if (p.type === 'PIT' && th === p.name) tags.push('<span class="pbadge" style="background:#ea580c;color:#fff;">HC</span>');
    // buySell may not be cached yet if user hasn't visited the Players tab
    const bs = p._buySell || (typeof getBuySellTag === 'function' ? getBuySellTag(p) : '');
    if (bs === 'buy') tags.push('<span class="pbadge" style="background:#16a34a;color:#fff;">BUY</span>');
    else if (bs === 'sell') tags.push('<span class="pbadge" style="background:#dc2626;color:#fff;">SELL</span>');

    html += `<tr style="border-bottom:1px solid var(--border);">`;
    html += `<td style="padding:6px 10px;color:var(--text2);">${i + 1}</td>`;
    html += `<td style="padding:6px 10px;font-weight:600;">${p.name}${hotBadge}${injBadge}</td>`;
    html += `<td style="padding:6px 10px;">${p.primaryPos || p.pos || ''}</td>`;
    html += `<td style="padding:6px 10px;color:var(--text2);">${p.team || ''}</td>`;
    html += `<td style="padding:6px 10px;color:var(--text2);">${p.age != null ? p.age : ''}</td>`;
    html += `<td style="padding:6px 10px;text-align:right;font-weight:700;color:${wpColor};">${c.wp.toFixed(1)}</td>`;
    html += `<td style="padding:6px 10px;text-align:right;color:var(--text2);">${c.proj.toFixed(1)}</td>`;
    html += `<td style="padding:6px 10px;text-align:right;color:var(--text2);">${c.act.toFixed(1)}</td>`;
    html += `<td style="padding:6px 10px;text-align:right;color:${deltaColor};font-weight:600;">${deltaFmt}</td>`;
    html += `<td style="padding:6px 10px;text-align:right;color:var(--text2);">${c.role ? '+' + c.role.toFixed(1) : '—'}</td>`;
    html += `<td style="padding:6px 10px;text-align:right;color:${c.inj ? 'var(--red)' : 'var(--text2)'};">${c.inj ? '−' + c.inj.toFixed(1) : '—'}</td>`;
    html += `<td style="padding:6px 10px;">${tags.join(' ')}</td>`;
    html += `</tr>`;
  });

  if (filtered.length === 0) {
    html += '<tr><td colspan="12" style="padding:40px;text-align:center;color:var(--text2);">No available players match these filters.</td></tr>';
  } else if (filtered.length > cap) {
    html += `<tr><td colspan="12" style="padding:10px;text-align:center;color:var(--text2);font-size:11px;">Showing top ${cap} of ${filtered.length}. Tighten filters to see more.</td></tr>`;
  }

  html += '</tbody></table></div>';

  // Explanatory footer
  html += '<div style="margin-top:12px;padding:10px;background:var(--surface2);border-radius:8px;font-size:11px;color:var(--text2);line-height:1.5;">';
  html += '<b>WP formula:</b> 0.5 × season LCV + 1.2 × confidence-weighted 14-day Δ + role upside − injury penalty. ';
  html += 'Role: closer +4, handcuff +2, 3+ SV pace +1, 5+ HLD pace +0.5, rookie +1. ';
  html += 'Injury: IL/OUT −4, DTD −1.5, Q −0.5.';
  html += '</div>';

  section.innerHTML = html;

  // Wire up filter buttons
  section.querySelectorAll('[data-waiver-type]').forEach(btn => {
    btn.addEventListener('click', () => {
      ws.type = btn.getAttribute('data-waiver-type');
      ws.pos = 'ALL';
      save();
      render();
    });
  });
  section.querySelectorAll('[data-waiver-pos]').forEach(btn => {
    btn.addEventListener('click', () => {
      ws.pos = btn.getAttribute('data-waiver-pos');
      save();
      render();
    });
  });
  const hotCb = document.getElementById('waiverHotOnly');
  if (hotCb) hotCb.addEventListener('change', () => { ws.hotOnly = hotCb.checked; save(); render(); });
  const roleCb = document.getElementById('waiverRoleOnly');
  if (roleCb) roleCb.addEventListener('change', () => { ws.roleOnly = roleCb.checked; save(); render(); });
  const sortSel = document.getElementById('waiverSort');
  if (sortSel) sortSel.addEventListener('change', () => { ws.sortBy = sortSel.value; save(); render(); });
}

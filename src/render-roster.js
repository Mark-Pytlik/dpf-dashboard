// ── Roster assignment helper ──────────────────────────────────────────────
const _needsCache = new Map();
function computeNeedsForTeam(players) {
  const _cacheKey = players.map(p => p.name).sort().join('|');
  if (_needsCache.has(_cacheKey)) return _needsCache.get(_cacheKey);
  const hitters = players.filter(p => !['SP','RP'].includes(p.primaryPos)).sort((a,b) => (b.lcv||0) - (a.lcv||0));
  const assigned = {};
  const used = new Set();
  const batSlots = ['C','1B','2B','3B','SS','LF','CF','RF'];
  for (const pos of batSlots) {
    assigned[pos] = [];
    const slots = ROSTER_SLOTS[pos] || 1;
    for (const p of hitters) {
      if (used.has(p.name)) continue;
      if (p.primaryPos === pos && assigned[pos].length < slots) {
        assigned[pos].push(p); used.add(p.name);
      }
    }
  }
  for (const pos of batSlots) {
    const slots = ROSTER_SLOTS[pos] || 1;
    for (const p of hitters) {
      if (used.has(p.name) || assigned[pos].length >= slots) continue;
      if ((p.pos||p.primaryPos||'').split('/').includes(pos)) {
        assigned[pos].push(p); used.add(p.name);
      }
    }
  }
  assigned['DH'] = [];
  const dhSlots = ROSTER_SLOTS['DH'] || 1;
  for (const p of hitters) {
    if (used.has(p.name) || assigned['DH'].length >= dhSlots) continue;
    assigned['DH'].push(p); used.add(p.name);
  }
  const spPool = players.filter(p => p.primaryPos === 'SP' || DUAL_ELIGIBLE[p.name] === 'SP');
  const rpPool = players.filter(p => p.primaryPos === 'RP' || DUAL_ELIGIBLE[p.name] === 'RP');
  assigned['SP'] = spPool.sort((a,b) => (b.lcv||0) - (a.lcv||0)).slice(0, ROSTER_SLOTS['SP'] || 5);
  assigned['RP'] = rpPool.sort((a,b) => (b.lcv||0) - (a.lcv||0)).slice(0, ROSTER_SLOTS['RP'] || 5);
  _needsCache.set(_cacheKey, assigned);
  return assigned;
}

// ── Combined Roster view (My Team + all league teams) ─────────────────────
function renderRoster() {
  const section = document.getElementById('rosterSection');
  if (!state.rosterOverrides) state.rosterOverrides = {};
  if (!state.leagueRosterOverrides) state.leagueRosterOverrides = {};

  // Team selector state
  if (!state._rosterTeam) state._rosterTeam = '__mine__';
  const isMine = state._rosterTeam === '__mine__';
  const selTeamName = isMine ? LEAGUE_TEAMS.find(t=>t.mine)?.name : state._rosterTeam;
  const teamPlayers = isMine ? (state.myTeam || []) : (state.leagueTeams[selTeamName] || []);
  const teamMilb = isMine ? (state.milbKeepers || []) : (LEAGUE_MILB_KEEPERS[selTeamName] || []);
  const overrides = isMine ? state.rosterOverrides : (state.leagueRosterOverrides[selTeamName] || {});

  // ── Auto-assign logic ──
  const bySlot = {};
  const offBench = [];  // offensive bench
  const pitBench = [];  // pitcher's bench
  for (const pos of Object.keys(ROSTER_SLOTS)) bySlot[pos] = [];
  const ilPlayers = [];
  const autoPool = [];

  teamPlayers.forEach(name => {
    const p = _plyrI(name) || { name, primaryPos: '?', elig: '?', lcv:0, pnav:0 };
    const ov = overrides[name];
    if (ov === 'il') { ilPlayers.push(p); return; }
    if (ov === 'reserve') { (['SP','RP'].includes(p.primaryPos) ? pitBench : offBench).push(p); return; }
    if (ov && ROSTER_SLOTS[ov] !== undefined) { bySlot[ov].push(p); return; }
    if (ov) { (['SP','RP'].includes(p.primaryPos) ? pitBench : offBench).push(p); return; }
    autoPool.push(p);
  });

  // Pass 0: Dual-eligible players (e.g., Ohtani) — try their dual position FIRST
  const normalPool = [];
  autoPool.forEach(p => {
    const dualPos = DUAL_ELIGIBLE[p.name];
    if (dualPos && ROSTER_SLOTS[dualPos] !== undefined && bySlot[dualPos].length < ROSTER_SLOTS[dualPos]) {
      bySlot[dualPos].push(p);
    } else {
      normalPool.push(p);
    }
  });
  // Pass 1: primary pos
  const pending = [];
  normalPool.forEach(p => {
    if (ROSTER_SLOTS[p.primaryPos] !== undefined && bySlot[p.primaryPos].length < ROSTER_SLOTS[p.primaryPos]) bySlot[p.primaryPos].push(p);
    else pending.push(p);
  });
  // Pass 2: multi-elig (includes DUAL_ELIGIBLE like Ohtani → SP)
  const stillPending = [];
  pending.forEach(p => {
    const positions = (p.pos || p.primaryPos || '').split('/');
    const dualPos = DUAL_ELIGIBLE[p.name];
    if (dualPos && !positions.includes(dualPos)) positions.push(dualPos);
    let placed = false;
    for (const pos of positions) {
      if (pos !== p.primaryPos && ROSTER_SLOTS[pos] !== undefined && bySlot[pos].length < ROSTER_SLOTS[pos]) { bySlot[pos].push(p); placed = true; break; }
    }
    if (!placed) stillPending.push(p);
  });
  // Pass 3: DH overflow
  stillPending.forEach(p => {
    if (!['SP','RP'].includes(p.primaryPos) && bySlot['DH'].length < ROSTER_SLOTS['DH']) bySlot['DH'].push(p);
    else (['SP','RP'].includes(p.primaryPos) ? pitBench : offBench).push(p);
  });

  // ── PNAV color helpers ──
  const DD = {};
  for (const [pos, sl] of Object.entries(ROSTER_SLOTS)) DD[pos] = Math.round(sl * TEAMS * 1.3);
  const ppSorted = {};
  for (const pos of Object.keys(ROSTER_SLOTS)) {
    const pool = ['SP','RP'].includes(pos) ? PITCHERS : BATTERS;
    ppSorted[pos] = pool.filter(p => p.primaryPos === pos).map(p => p.pnav||0).sort((a,b)=>b-a).slice(0,DD[pos]).sort((a,b)=>a-b);
  }
  function ppct(v,pos) { const s=ppSorted[pos]||[0]; if(s.length<=1)return 0.5; let b=0; for(let i=0;i<s.length;i++)if(s[i]<(v||0))b++; return Math.max(0,Math.min(1,b/(s.length-1))); }
  function tClr(v,pos) { const t=ppct(v,pos); return `hsl(${Math.round(t*120)},70%,38%)`; }
  function tBg(v,pos) { const t=ppct(v,pos); return `hsla(${Math.round(t*120)},70%,45%,0.12)`; }

  // ── Compute LCV for this team ──
  const teamLCV = calcRosterLCV(teamPlayers, overrides);

  // ── Trade target scoring (when viewing another team) ──
  const tradeTargets = {};
  if (!isMine) {
    // Compute my positional gaps using the same optimal assignment
    const myPlayers = (state.myTeam || []).map(n => _plyrI(n)).filter(Boolean);
    const myAssign = computeNeedsForTeam(myPlayers);
    const myGaps = {};
    for (const [pos, slots] of Object.entries(ROSTER_SLOTS)) {
      const myTop = (myAssign[pos] || []);
      const myAvg = myTop.length > 0 ? myTop.reduce((s,p) => s+(p.lcv||0),0)/myTop.length : 0;
      // League avg at this position
      const lAvgs = [];
      LEAGUE_TEAMS.filter(t => !t.mine).forEach(t => {
        const tPl = (state.leagueTeams[t.name]||[]).map(n => _plyrI(n)).filter(Boolean);
        const tAs = computeNeedsForTeam(tPl);
        const tTop = tAs[pos] || [];
        if (tTop.length > 0) lAvgs.push(tTop.reduce((s,p)=>s+(p.lcv||0),0)/tTop.length);
      });
      const lAvg = lAvgs.length > 0 ? lAvgs.reduce((s,v)=>s+v,0)/lAvgs.length : 0;
      myGaps[pos] = myAvg - lAvg; // negative = I need this position
    };

    // Score each player on this team
    teamPlayers.forEach(name => {
      const p = _plyrI(name);
      if (!p) return;
      const ki = getKeeperInfoCached(name);
      const positions = (p.pos || p.primaryPos || '').split('/');

      // Position need score: how badly I need this player's position(s)
      // Use the WORST (most negative) gap across eligible positions
      let bestNeed = 0;
      positions.forEach(pos => {
        const gap = myGaps[pos];
        if (gap !== undefined && gap < bestNeed) bestNeed = gap;
      });
      // Also consider DH for hitters
      if (!['SP','RP'].includes(p.primaryPos) && myGaps['DH'] < bestNeed) bestNeed = myGaps['DH'];

      // Keeper value score: keepable + affordable + years left
      let keeperScore = 0;
      if (ki.keepable2027) {
        keeperScore = (ki.yearsLeft || 0) * 0.3 + Math.max(0, ki.surplusNow || 0) * 0.2;
      }

      // Trade fit = position need (inverted, bigger gap = higher score) + moderate LCV + keeper value
      // Don't just pick superstars: weight need heavily, LCV moderately
      const needScore = Math.max(0, -bestNeed) * 1.5; // bigger gap = higher score
      const lcvScore = Math.min((p.lcv || 0) * 0.15, 2.0); // cap LCV contribution
      const fitScore = needScore + lcvScore + keeperScore;

      if (fitScore > 0.8) { // threshold to avoid highlighting everyone
        tradeTargets[name] = { score: fitScore, needPos: positions.find(pos => myGaps[pos] < -0.5) || positions[0], gap: bestNeed };
      }
    });
  }

  // ── Build compact table row ──
  function pRow(p, slot, tag) {
    if (!p) return `<tr class="roster-section" data-slot="${slot}" style="opacity:0.3;"><td style="padding:3px 6px;font-weight:600;width:32px;font-size:11px;">${slot}</td><td colspan="13" style="padding:3px 6px;color:var(--text2);">—</td></tr>`;
    const dn = encodeURIComponent(p.name);
    const c = tClr(p.pnav, slot||p.primaryPos);
    const ki = getKeeperInfoCached(p.name);
    const natPos = ''; // position already shown in Pos column
    // Keeper column: show round→cost if keepable, round only if not, — if undrafted
    let keepHtml = '<span style="color:var(--text2);font-size:10px;">—</span>';
    if (ki.draftRound) {
      if (ki.keepable2027) {
        keepHtml = `<span style="color:var(--green);font-size:10px;font-weight:600;" title="Drafted R${ki.draftRound}, 2027 cost R${ki.cost2027}, ${ki.yearsLeft}yr control">R${ki.draftRound}→${ki.cost2027}</span>`;
      } else {
        keepHtml = `<span style="color:var(--red);font-size:10px;" title="R1-4 cannot be kept">R${ki.draftRound}</span>`;
      }
    }
    // GM value columns
    const yrsClr = ki.yearsLeft >= 3 ? 'var(--green)' : ki.yearsLeft >= 1 ? 'var(--yellow)' : 'var(--red)';
    const surp = ki.surplusNow || 0;
    const mys = Math.max(0, ki.multiYearSurplus || 0);
    const pr = findProspect(p.name);
    const pv = pr ? Math.max(0, ((pr.fv||0) - 40) * 0.15) : 0;
    // Trade Value: production-first, keeper premium only when surplus justifies the slot
    const lcv = p.lcv || 0;
    let tv;
    if (!ki.keepable2027) {
      // Non-keepable: pure rental value = current production (elite players still command big returns)
      tv = lcv * 0.8 + pv;
    } else {
      // Keepable: blend of current production + keeper premium
      // Only count keeper surplus if it's meaningfully positive (> 1.0)
      // This prevents mediocre keepers from inflating TV just because they have years of control
      const effectiveMYS = ki.multiYearSurplus > 1.0 ? ki.multiYearSurplus : ki.multiYearSurplus * 0.3;
      tv = lcv * 0.5 + Math.max(0, effectiveMYS) * 1.0 + pv + (ki.yearsLeft >= 2 && ki.multiYearSurplus > 1.0 ? ki.yearsLeft * 0.3 : 0);
    }
    const tvClr = tv > 3 ? 'var(--green)' : tv > 0 ? 'var(--text)' : 'var(--text2)';
    const ttBg = '';
    const ttBadge = '';
    // Slot label (include IL/MiLB tag inline)
    const slotLabel = tag ? `${slot||''} ${tag}` : (slot||'');

    return `<tr class="roster-row" draggable="true" data-player="${dn}" style="border-left:3px solid ${c};cursor:grab;${ttBg}">` +
      `<td style="padding:3px 6px;font-weight:600;width:32px;font-size:11px;white-space:nowrap;">${slotLabel}</td>` +
      `<td style="padding:3px 6px;font-weight:600;font-size:12px;white-space:nowrap;">${p.name}${natPos}${ttBadge}</td>` +
      `<td style="padding:3px 4px;text-align:center;white-space:nowrap;">${keepHtml}</td>` +
      `<td style="padding:3px 4px;font-size:11px;color:var(--text2);white-space:nowrap;">${p.team||''}</td>` +
      `<td style="padding:3px 4px;font-size:10px;white-space:nowrap;">${(p.pos||p.primaryPos||'').split('/').map(pos => '<span class="pos-badge pos-'+pos+'" style="padding:1px 4px;font-size:9px;margin-right:1px;">'+pos+'</span>').join('')}</td>` +
      `<td style="padding:3px 4px;text-align:right;font-size:11px;color:${c};font-weight:600;">${(p.lcv||0).toFixed(1)}</td>` +
      `<td style="padding:3px 4px;text-align:right;font-size:10px;${p.aLCVPlus != null ? (p.aLCVPlus >= 115 ? 'color:var(--green);font-weight:700;' : p.aLCVPlus >= 100 ? 'color:var(--green);' : p.aLCVPlus <= 85 ? 'color:var(--red);' : 'color:var(--text2);') : 'color:var(--text2);'}">${p.aLCVPlus != null ? Math.round(p.aLCVPlus).toString() : '—'}</td>` +
      `<td style="padding:3px 4px;text-align:right;font-size:10px;font-weight:600;${p.lcvDelta != null ? (p.lcvDelta >= 0 ? 'color:var(--green);' : 'color:var(--red);') : 'color:var(--text2);'}">${p.lcvDelta != null ? (p.lcvDelta > 0 ? '+' : '') + p.lcvDelta.toFixed(1) : '—'}</td>` +
      `<td style="padding:3px 4px;text-align:right;font-size:11px;">${(p.pnav||0).toFixed(1)}</td>` +
      `<td style="padding:3px 4px;text-align:right;font-size:11px;color:var(--text2);">${p.age||'?'}</td>` +
      `<td style="padding:3px 4px;text-align:center;font-size:10px;color:${yrsClr};font-weight:600;">${ki.yearsLeft}</td>` +
      `<td style="padding:3px 4px;text-align:right;font-size:10px;color:${surp >= 0 ? 'var(--green)' : 'var(--red)'};">${surp.toFixed(1)}</td>` +
      `<td style="padding:3px 4px;text-align:right;font-size:10px;color:${mys > 0 ? 'var(--green)' : 'var(--text2)'};">${mys.toFixed(1)}</td>` +
      `<td style="padding:3px 4px;text-align:right;font-size:10px;color:${tvClr};font-weight:600;">${tv.toFixed(1)}</td>` +
      `</tr>`;
  }

  // ── Player View row builder ──
  // padToCols: if set, pad with empty tds to reach this total (for mixed bat/pit tables)
  function pRowStats(p, slot, tag, isPitcher, padToCols) {
    const cols = isPitcher ? filteredPitStatCols : filteredBatStatCols;
    const numCols = cols.length;
    const targetCols = padToCols || numCols;
    if (!p) return `<tr style="opacity:0.3;"><td style="padding:3px 6px;font-weight:600;font-size:11px;">${slot}</td><td colspan="${targetCols-1}" style="padding:3px 6px;color:var(--text2);">—</td></tr>`;
    const slotLabel = tag ? `${slot||''} ${tag}` : (slot||'');
    let tr = `<tr class="roster-row" draggable="true" data-player="${encodeURIComponent(p.name)}" style="cursor:grab;">`;
    cols.forEach(c => {
      if (c.key === null) { tr += `<td style="padding:3px 4px;font-weight:600;font-size:11px;white-space:nowrap;">${slotLabel}</td>`; return; }
      if (c.key === 'name') { tr += `<td style="padding:3px 4px;font-weight:600;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:130px;">${p.name}${_injBadge(p.name)}</td>`; return; }
      if (c.key === 'pos') { tr += `<td style="padding:3px 4px;text-align:center;font-size:10px;">${p.primaryPos ? '<span class="pos-badge pos-'+p.primaryPos+'" style="padding:1px 4px;font-size:9px;">'+p.primaryPos+'</span>' : ''}</td>`; return; }
      // OPS computation: obp + slg from appropriate prefix
      let val;
      if (c.computed === 'ops') {
        const prefix = c.key.startsWith('s25_') ? 's25_' : c.key.startsWith('s26_') ? 's26_' : '';
        const obpVal = p[prefix + 'obp'];
        const slgVal = p[prefix + 'slg'];
        val = (typeof obpVal === 'number' && typeof slgVal === 'number') ? obpVal + slgVal : null;
      } else {
        val = p[c.key];
      }
      if (c.pad) { tr += '<td></td>'; return; }
      if (val === undefined || val === null || val === '') { tr += `<td style="padding:3px 4px;text-align:right;font-size:10px;color:var(--text2);">—</td>`; return; }
      // Format stat values
      let display;
      if (typeof val === 'number') {
        const k = c.key;
        if (k.includes('avg') || k.includes('obp') || k.includes('slg') || k.includes('ops')) {
          display = val.toFixed(3).replace(/^0\./, '.');
        } else if (k.includes('era')) {
          display = val.toFixed(2);
        } else if (k.includes('whip')) {
          display = val.toFixed(2);
        } else if (k === 'ip' || k === 's25_ip' || k === 's26_ip') {
          display = val % 1 === 0 ? val.toFixed(0) : val.toFixed(1);
        } else {
          display = Math.round(val);
        }
      } else { display = val; }
      // Color: group-based
      const gClr = c.group === '25' ? '' : c.group === '26p' ? 'color:var(--accent);' : c.group === '26a' ? 'color:var(--green);' : '';
      tr += `<td style="padding:3px 4px;text-align:right;font-size:10px;${gClr}">${display}</td>`;
    });
    // Pad extra cols for mixed tables (pitcher rows in bat-width table)
    const padCount = targetCols - numCols;
    for (let i = 0; i < padCount; i++) tr += '<td></td>';
    tr += '</tr>';
    return tr;
  }

  // ── HTML ──
  let html = '';
  const isMyRosterTab = (DPF.ui.currentTab === 'myRoster');

  // View mode: 'player' or 'gm' — applies to all roster tabs
  if (!state._rosterView) state._rosterView = isMyRosterTab ? 'gm' : 'player';
  const rosterView = state._rosterView;

  // Team selector (hidden on My Roster tab)
  if (!isMyRosterTab) {
    html += '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:12px;align-items:center;">';
    html += '<span style="font-weight:700;margin-right:8px;font-size:13px;">Rosters</span>';
    LEAGUE_TEAMS.forEach(t => {
      const isMe = t.mine;
      const key = isMe ? '__mine__' : t.name;
      const active = state._rosterTeam === key;
      const bg = active ? (isMe ? 'var(--accent)' : 'var(--text)') : 'var(--surface2)';
      const fg = active ? '#fff' : 'var(--text)';
      const plCount = isMe ? (state.myTeam||[]).length : (state.leagueTeams[t.name]||[]).length;
      html += `<button class="roster-team-btn btn" data-team="${encodeURIComponent(key)}" style="padding:3px 8px;font-size:10px;background:${bg};color:${fg};border:1px solid ${active?'transparent':'var(--border)'};border-radius:4px;cursor:pointer;white-space:nowrap;">${isMe?'★ ':''}${(t.owner||t.name).slice(0,20)} (${plCount})</button>`;
    });
    html += '</div>';
  }

  // Action bar
  html += '<div style="display:flex;gap:6px;margin-bottom:10px;align-items:center;">';
  // Player / GM view toggle — available on all roster tabs
  html += '<div class="view-toggle">';
  html += `<button class="view-btn roster-view-btn ${rosterView==='player'?'active':''}" data-view="player">Player</button>`;
  html += `<button class="view-btn roster-view-btn ${rosterView==='gm'?'active':''}" data-view="gm">GM</button>`;
  html += '</div>';
  // Stat set toggle (Player view only): pick 2 of 3 stat groups
  if (!state._statSets) state._statSets = '25,26p,26a'; // default: all three
  const _ss = state._statSets;
  if (rosterView === 'player') {
    html += '<div class="view-toggle" style="margin-left:6px;">';
    html += `<button class="view-btn stat-set-btn ${_ss==='25,26p'?'active':''}" data-sets="25,26p" title="Show 2025 Actual + 2026 Projected">25A+26P</button>`;
    html += `<button class="view-btn stat-set-btn ${_ss==='25,26a'?'active':''}" data-sets="25,26a" title="Show 2025 Actual + 2026 Actual">25A+26A</button>`;
    html += `<button class="view-btn stat-set-btn ${_ss==='26p,26a'?'active':''}" data-sets="26p,26a" title="Show 2026 Projected + 2026 Actual">26P+26A</button>`;
    html += `<button class="view-btn stat-set-btn ${_ss==='25,26p,26a'?'active':''}" data-sets="25,26p,26a" title="Show all three stat sets">All</button>`;
    html += '</div>';
  }
  // Time-split toggle (show when 2026 Actual is in the active stat sets or GM view)
  if (rosterView === 'gm' || _ss.includes('26a')) {
    html += '<span style="width:8px;"></span>';
    html += renderSplitToggle('roster-split-toggle');
  }
  html += '<span style="width:8px;"></span>';
  html += `<span style="font-size:13px;font-weight:600;">Starting LCV: ${teamLCV.startingLCV.toFixed(1)}</span>`;
  html += `<span style="font-size:11px;color:var(--text2);margin-left:8px;">Total: ${teamLCV.totalLCV.toFixed(1)} | Players: ${teamPlayers.length}</span>`;
  html += '<span style="flex:1;"></span>';
  html += '<button id="optimizeRosterBtn" class="btn btn-secondary" style="padding:3px 10px;font-size:11px;">Optimize</button>';
  html += '<button id="resetRosterBtn" class="btn btn-secondary" style="padding:3px 10px;font-size:11px;">Reset</button>';
  html += '</div>';

  // Main layout: two columns
  html += '<div style="display:flex;gap:16px;align-items:flex-start;">';

  // ── LEFT: Roster table ──
  html += '<div style="flex:1;min-width:0;overflow-x:auto;">';

  // Roster sort state
  if (!state._rSortCol) state._rSortCol = null;
  const rsc = state._rSortCol;
  const rsd = state._rSortDir || -1;

  // Player view stat columns (compact: 2025 actual, 2026 projected, 2026 actual side-by-side)
  const playerBatStatCols = [
    {key:null,label:'Slot',align:'left'},
    {key:'name',label:'Player',align:'left'},
    {key:'pos',label:'Pos',align:'center'},
    // 2025 Actual — PA HR RBI R SB K AVG OBP SLG OPS
    {key:'s25_pa',label:'PA',align:'right',group:'25',tip:'2025 Actual PA'},
    {key:'s25_hr',label:'HR',align:'right',group:'25',tip:'2025 Actual HR'},
    {key:'s25_rbi',label:'RBI',align:'right',group:'25',tip:'2025 Actual RBI'},
    {key:'s25_r',label:'R',align:'right',group:'25',tip:'2025 Actual Runs'},
    {key:'s25_sb',label:'SB',align:'right',group:'25',tip:'2025 Actual SB'},
    {key:'s25_so',label:'K',align:'right',group:'25',tip:'2025 Actual K'},
    {key:'s25_avg',label:'AVG',align:'right',group:'25',tip:'2025 Actual AVG'},
    {key:'s25_obp',label:'OBP',align:'right',group:'25',tip:'2025 Actual OBP'},
    {key:'s25_slg',label:'SLG',align:'right',group:'25',tip:'2025 Actual SLG'},
    {key:'s25_ops',label:'OPS',align:'right',group:'25',tip:'2025 Actual OPS',computed:'ops'},
    // 2026 Projected
    {key:'pa',label:'PA',align:'right',group:'26p',tip:'2026 Projected PA'},
    {key:'hr',label:'HR',align:'right',group:'26p',tip:'2026 Projected HR'},
    {key:'rbi',label:'RBI',align:'right',group:'26p',tip:'2026 Projected RBI'},
    {key:'r',label:'R',align:'right',group:'26p',tip:'2026 Projected Runs'},
    {key:'sb',label:'SB',align:'right',group:'26p',tip:'2026 Projected SB'},
    {key:'so',label:'K',align:'right',group:'26p',tip:'2026 Projected K'},
    {key:'avg',label:'AVG',align:'right',group:'26p',tip:'2026 Projected AVG'},
    {key:'obp',label:'OBP',align:'right',group:'26p',tip:'2026 Projected OBP'},
    {key:'slg',label:'SLG',align:'right',group:'26p',tip:'2026 Projected SLG'},
    {key:'ops',label:'OPS',align:'right',group:'26p',tip:'2026 Projected OPS',computed:'ops'},
    // 2026 Actual
    {key:'s26_pa',label:'PA',align:'right',group:'26a',tip:'2026 Actual PA'},
    {key:'s26_hr',label:'HR',align:'right',group:'26a',tip:'2026 Actual HR'},
    {key:'s26_rbi',label:'RBI',align:'right',group:'26a',tip:'2026 Actual RBI'},
    {key:'s26_r',label:'R',align:'right',group:'26a',tip:'2026 Actual Runs'},
    {key:'s26_sb',label:'SB',align:'right',group:'26a',tip:'2026 Actual SB'},
    {key:'s26_so',label:'K',align:'right',group:'26a',tip:'2026 Actual K'},
    {key:'s26_avg',label:'AVG',align:'right',group:'26a',tip:'2026 Actual AVG'},
    {key:'s26_obp',label:'OBP',align:'right',group:'26a',tip:'2026 Actual OBP'},
    {key:'s26_slg',label:'SLG',align:'right',group:'26a',tip:'2026 Actual SLG'},
    {key:'s26_ops',label:'OPS',align:'right',group:'26a',tip:'2026 Actual OPS',computed:'ops'}
  ];
  const playerPitStatCols = [
    {key:null,label:'Slot',align:'left'},
    {key:'name',label:'Player',align:'left'},
    {key:'pos',label:'Pos',align:'center'},
    // 2025 Actual — IP W K QS WHIP ERA HD SV + 2 spacers to match batter column count
    {key:'s25_ip',label:'IP',align:'right',group:'25',tip:'2025 Actual IP'},
    {key:'s25_w',label:'W',align:'right',group:'25',tip:'2025 Actual Wins'},
    {key:'s25_so',label:'K',align:'right',group:'25',tip:'2025 Actual K'},
    {key:'s25_qs',label:'QS',align:'right',group:'25',tip:'2025 Actual QS'},
    {key:'s25_whip',label:'WHIP',align:'right',group:'25',tip:'2025 Actual WHIP'},
    {key:'s25_era',label:'ERA',align:'right',group:'25',tip:'2025 Actual ERA'},
    {key:'s25_hld',label:'HD',align:'right',group:'25',tip:'2025 Actual Holds'},
    {key:'s25_sv',label:'SV',align:'right',group:'25',tip:'2025 Actual Saves'},
    {key:'s25_hr',label:'HRA',align:'right',group:'25',tip:'2025 Actual Home Runs Allowed'},
    {key:'_pad25',label:'',align:'right',group:'25',pad:true},
    // 2026 Projected
    {key:'ip',label:'IP',align:'right',group:'26p',tip:'2026 Projected IP'},
    {key:'w',label:'W',align:'right',group:'26p',tip:'2026 Projected Wins'},
    {key:'so',label:'K',align:'right',group:'26p',tip:'2026 Projected K'},
    {key:'qs',label:'QS',align:'right',group:'26p',tip:'2026 Projected QS'},
    {key:'whip',label:'WHIP',align:'right',group:'26p',tip:'2026 Projected WHIP'},
    {key:'era',label:'ERA',align:'right',group:'26p',tip:'2026 Projected ERA'},
    {key:'hld',label:'HD',align:'right',group:'26p',tip:'2026 Projected Holds'},
    {key:'sv',label:'SV',align:'right',group:'26p',tip:'2026 Projected Saves'},
    {key:'hr',label:'HRA',align:'right',group:'26p',tip:'2026 Projected Home Runs Allowed'},
    {key:'_pad26p',label:'',align:'right',group:'26p',pad:true},
    // 2026 Actual
    {key:'s26_ip',label:'IP',align:'right',group:'26a',tip:'2026 Actual IP'},
    {key:'s26_w',label:'W',align:'right',group:'26a',tip:'2026 Actual Wins'},
    {key:'s26_so',label:'K',align:'right',group:'26a',tip:'2026 Actual K'},
    {key:'s26_qs',label:'QS',align:'right',group:'26a',tip:'2026 Actual QS'},
    {key:'s26_whip',label:'WHIP',align:'right',group:'26a',tip:'2026 Actual WHIP'},
    {key:'s26_era',label:'ERA',align:'right',group:'26a',tip:'2026 Actual ERA'},
    {key:'s26_hld',label:'HD',align:'right',group:'26a',tip:'2026 Actual Holds'},
    {key:'s26_sv',label:'SV',align:'right',group:'26a',tip:'2026 Actual Saves'},
    {key:'s26_hr',label:'HRA',align:'right',group:'26a',tip:'2026 Actual Home Runs Allowed'},
    {key:'_pad26a',label:'',align:'right',group:'26a',pad:true}
  ];

  // Filter stat columns by active stat sets
  const _activeSets = new Set((_ss || '25,26p,26a').split(','));
  function _filterStatCols(cols) {
    return cols.filter(c => !c.group || _activeSets.has(c.group));
  }
  const filteredBatStatCols = _filterStatCols(playerBatStatCols);
  const filteredPitStatCols = _filterStatCols(playerPitStatCols);

  // GM view columns (original)
  const rosterCols = [
    {key:null,label:'Slot',align:'left'},
    {key:'name',label:'Player',align:'left'},
    {key:'_cost2027',label:'Keeper',align:'center',tip:'Keeper round → 2027 cost'},
    {key:'team',label:'Team',align:'left'},
    {key:'pos',label:'Elig',align:'left'},
    {key:'lcv',label:'LCV',align:'right',tip:'League Category Value: sum of z-scores across 8 league categories'},
    {key:'aLCVPlus',label:'aLCV+',align:'right',tip:'aLCV+: 100 = pool average, 115 = +1sigma (wRC+ scale). From 2026 in-season stats.'},
    {key:'lcvDelta',label:'ΔLCV',align:'right',tip:'Actual LCV minus Projected LCV'},
    {key:'pnav',label:'PNAV',align:'right',tip:'Positional Need-Adjusted Value: LCV weighted by positional scarcity'},
    {key:'age',label:'Age',align:'right'},
    {key:'_yrsCtrl',label:'Yrs',align:'center',tip:'Years of control remaining'},
    {key:'_surplus',label:'Surp',align:'right',tip:'Current surplus value'},
    {key:'_mys',label:'MYS',align:'right',tip:'Multi-year surplus'},
    {key:'_tv',label:'TV',align:'right',tip:'Trade value: production + keeper premium (if surplus justifies slot) + prospect value'}
  ];

  const batSlotOrder = ['C','1B','2B','3B','SS','LF','CF','RF','DH'];
  // Shared colgroup for all roster tables (main + bench + IL + MiLB) — GM view
  const rosterColgroup = '<colgroup><col style="width:38px"><col style="width:140px"><col style="width:52px"><col style="width:40px"><col style="width:56px"><col style="width:44px"><col style="width:44px"><col style="width:44px"><col style="width:44px"><col style="width:32px"><col style="width:30px"><col style="width:38px"><col style="width:38px"><col style="width:42px"></colgroup>';
  // Player view colgroups: Slot(38) + Player(130) + Pos(36) + stat cols(36px each)
  // Dynamic based on how many stat columns are active
  const _filteredStatCount = filteredBatStatCols.filter(c => c.group).length;
  const playerBatColgroup = '<colgroup><col style="width:38px"><col style="width:130px"><col style="width:36px">' + '<col style="width:36px">'.repeat(_filteredStatCount) + '</colgroup>';

  // Choose columns based on view
  const activeCols = rosterView === 'player' ? filteredBatStatCols : rosterCols;
  const activeColsPit = rosterView === 'player' ? filteredPitStatCols : rosterCols;
  const numBatCols = activeCols.length;
  const numPitCols = activeColsPit.length;

  // Player view header builder with group headers
  // padToCols: if set, pad headers to this many total columns (for consistent widths)
  function buildPlayerStatHeader(cols, isPit, padToCols) {
    let hdr = '';
    // Group header row (2025 / 2026 Proj / 2026 Actual)
    const statCols = cols.filter(c => c.group);
    const g25 = statCols.filter(c => c.group === '25').length;
    const g26p = statCols.filter(c => c.group === '26p').length;
    const g26a = statCols.filter(c => c.group === '26a').length;
    const fixedCols = cols.length - statCols.length; // slot + name + pos
    const padExtra = padToCols ? padToCols - cols.length : 0;
    hdr += '<tr style="background:var(--surface2);font-size:9px;text-transform:uppercase;color:var(--text2);">';
    hdr += `<th colspan="${fixedCols}" style="padding:2px 4px;"></th>`;
    hdr += `<th colspan="${g25}" style="padding:2px 6px;text-align:center;border-left:2px solid var(--border);color:var(--text2);">2025 Actual</th>`;
    hdr += `<th colspan="${g26p}" style="padding:2px 6px;text-align:center;border-left:2px solid var(--border);color:var(--accent);">2026 Projected</th>`;
    hdr += `<th colspan="${g26a + padExtra}" style="padding:2px 6px;text-align:center;border-left:2px solid var(--border);color:var(--green);">2026 Actual</th>`;
    hdr += '</tr>';
    // Stat name header row
    hdr += '<tr style="background:var(--surface2);font-size:10px;text-transform:uppercase;color:var(--text2);">';
    let prevGroup = null;
    cols.forEach(c => {
      if (c.pad) { hdr += '<th style="padding:3px 4px;"></th>'; return; }
      const tipAttr = c.tip ? ` title="${c.tip}"` : '';
      const borderLeft = (c.group && c.group !== prevGroup) ? 'border-left:2px solid var(--border);' : '';
      prevGroup = c.group || prevGroup;
      hdr += `<th${tipAttr} style="text-align:${c.align};padding:3px 4px;${borderLeft}user-select:none;white-space:nowrap;">${c.label}</th>`;
    });
    // Pad extra header cells
    for (let i = 0; i < padExtra; i++) hdr += '<th style="padding:3px 4px;"></th>';
    hdr += '</tr>';
    return hdr;
  }

  // Build table header
  if (rosterView === 'player') {
    // Offense table
    html += '<table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:6px;table-layout:fixed;">';
    html += playerBatColgroup;
    html += '<thead>' + buildPlayerStatHeader(filteredBatStatCols, false) + '</thead>';
    html += '<tbody>';
  } else {
    html += '<table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:6px;table-layout:fixed;">';
    html += rosterColgroup;
    html += '<thead><tr style="background:var(--surface2);font-size:10px;text-transform:uppercase;color:var(--text2);">';
    rosterCols.forEach(c => {
      const arrow = (rsc && rsc === c.key) ? (rsd === 1 ? ' ▲' : ' ▼') : '';
      const cursor = c.key ? 'cursor:pointer;' : '';
      const tipAttr = c.tip ? ` title="${c.tip}"` : '';
      const w = c.label === '' ? 'width:30px;' : '';
      html += `<th class="roster-sort-th" data-col="${c.key||''}"${tipAttr} style="text-align:${c.align};padding:4px 6px;${cursor}${w}user-select:none;">${c.label}${arrow}</th>`;
    });
    html += '</tr></thead>';
    html += '<tbody>';
  }

  // Row builder helper: picks GM pRow or Player pRowStats based on view
  const rowFn = (p, slot, tag, isPit, padToCols) => rosterView === 'player' ? pRowStats(p, slot, tag, isPit, padToCols) : pRow(p, slot, tag);
  const colSpan = rosterView === 'player' ? numBatCols : 14;
  const colSpanPit = rosterView === 'player' ? numBatCols : 14;

  if (rsc && rosterView !== 'player') {
    // Flat sorted view (GM only) — all roster players sorted by chosen column
    const allRosterPlayers = [];
    for (const slot of [...batSlotOrder, 'SP', 'RP']) {
      (bySlot[slot]||[]).forEach(p => { if(p) allRosterPlayers.push({p, slot}); });
    }
    offBench.forEach(p => { allRosterPlayers.push({p, slot:'BN'}); });
    pitBench.forEach(p => { allRosterPlayers.push({p, slot:'BN'}); });
    ilPlayers.forEach(p => { allRosterPlayers.push({p, slot:'IL'}); });

    // Compute sort values
    allRosterPlayers.forEach(r => {
      const ki = getKeeperInfoCached(r.p.name);
      r._cost2027 = ki.keepable2027 ? ki.cost2027 : 99;
      r._yrsCtrl = ki.yearsLeft || 0;
      r._surplus = ki.surplusNow || 0;
      r._mys = Math.max(0, ki.multiYearSurplus || 0);
      const pr = findProspect(r.p.name);
      const pv = pr ? Math.max(0, ((pr.fv||0) - 40) * 0.15) : 0;
      // Trade Value: same formula as pRow display
      const plLcv = r.p.lcv || 0;
      if (!ki.keepable2027) {
        r._tv = plLcv * 0.8 + pv;
      } else {
        const effMYS = ki.multiYearSurplus > 1.0 ? ki.multiYearSurplus : (ki.multiYearSurplus || 0) * 0.3;
        r._tv = plLcv * 0.5 + Math.max(0, effMYS) * 1.0 + pv + (ki.yearsLeft >= 2 && ki.multiYearSurplus > 1.0 ? ki.yearsLeft * 0.3 : 0);
      }
    });

    allRosterPlayers.sort((a, b) => {
      let av, bv;
      if (rsc === 'name') return rsd * a.p.name.localeCompare(b.p.name);
      if (rsc === 'team') return rsd * (a.p.team||'').localeCompare(b.p.team||'');
      if (rsc === 'pos') return rsd * (a.p.pos||'').localeCompare(b.p.pos||'');
      if (['lcv','pnav','age','actualLcv','aLCVPlus','lcvDelta'].includes(rsc)) {
        av = a.p[rsc] != null ? a.p[rsc] : -Infinity;
        bv = b.p[rsc] != null ? b.p[rsc] : -Infinity;
      }
      else { av = a[rsc]||0; bv = b[rsc]||0; }
      return rsd * (av - bv);
    });

    allRosterPlayers.forEach(r => {
      html += pRow(r.p, r.slot, r.slot === 'IL' ? '<span style="color:var(--red);">IL</span>' : '');
    });
  } else {
    // Normal slot-based view (both Player and GM)
    html += `<tr><td colspan="${colSpan}" style="padding:6px 6px 2px;font-weight:700;font-size:11px;color:var(--accent);border-bottom:1px solid var(--border);">OFFENSE (9)</td></tr>`;
    for (const slot of batSlotOrder) {
      const count = ROSTER_SLOTS[slot] || 1;
      for (let i = 0; i < count; i++) {
        const p = bySlot[slot][i];
        const inner = rowFn(p, slot, '', false);
        html += `<tr class="roster-section" data-slot="${slot}">${inner.replace(/^<tr[^>]*>|<\/tr>$/g, '')}</tr>`;
      }
    }

    // Offensive Bench — right under offense starters
    if (!rsc || rosterView === 'player') {
      html += `<tr><td colspan="${colSpan}" style="padding:6px 6px 2px;font-weight:700;font-size:10px;color:var(--text2);border-bottom:1px solid var(--border);">OFFENSIVE BENCH (${offBench.length})</td></tr>`;
      offBench.forEach(p => {
        const inner = rowFn(p, 'BN', '', false);
        html += `<tr class="roster-section" data-slot="BN">${inner.replace(/^<tr[^>]*>|<\/tr>$/g, '')}</tr>`;
      });
      if (offBench.length === 0) html += `<tr><td colspan="${colSpan}" style="padding:4px 6px;color:var(--text2);font-size:11px;">No offensive bench players</td></tr>`;
    }

    // Close offense table in Player view, open pitching table with pit-specific headers
    if (rosterView === 'player') {
      html += '</tbody></table>';
      html += '<table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:8px;margin-bottom:6px;table-layout:fixed;">';
      html += playerBatColgroup;
      html += '<thead>' + buildPlayerStatHeader(filteredPitStatCols, true, filteredBatStatCols.length) + '</thead>';
      html += '<tbody>';
      html += `<tr><td colspan="${colSpanPit}" style="padding:6px 6px 2px;font-weight:700;font-size:11px;color:var(--green);border-bottom:1px solid var(--border);">PITCHING (${(bySlot['SP']||[]).length + (bySlot['RP']||[]).length})</td></tr>`;
    } else {
      html += `<tr><td colspan="${colSpan}" style="padding:8px 6px 2px;font-weight:700;font-size:11px;color:var(--green);border-bottom:1px solid var(--border);">PITCHING (${(bySlot['SP']||[]).length + (bySlot['RP']||[]).length})</td></tr>`;
    }

    for (const slot of ['SP','RP']) {
      const count = ROSTER_SLOTS[slot] || 5;
      for (let i = 0; i < count; i++) {
        const p = bySlot[slot][i];
        const inner = rowFn(p, slot, '', true, filteredBatStatCols.length);
        html += `<tr class="roster-section" data-slot="${slot}">${inner.replace(/^<tr[^>]*>|<\/tr>$/g, '')}</tr>`;
      }
    }

    // Pitcher's Bench — right under pitching starters
    if (!rsc || rosterView === 'player') {
      const pitBenchColSpan = rosterView === 'player' ? colSpanPit : colSpan;
      html += `<tr><td colspan="${pitBenchColSpan}" style="padding:6px 6px 2px;font-weight:700;font-size:10px;color:var(--text2);border-bottom:1px solid var(--border);">PITCHER'S BENCH (${pitBench.length})</td></tr>`;
      pitBench.forEach(p => {
        html += rowFn(p, 'BN', '', true, filteredBatStatCols.length);
      });
      if (pitBench.length === 0) html += `<tr><td colspan="${pitBenchColSpan}" style="padding:4px 6px;color:var(--text2);font-size:11px;">No pitcher bench players</td></tr>`;
    }
  }
  html += '</tbody></table>';

  if (!rsc || rosterView === 'player') {
    // IL
    html += `<div style="margin-top:8px;"><span style="font-weight:700;font-size:11px;color:var(--red);">IL (${ilPlayers.length}/4)</span></div>`;
    html += `<table style="width:100%;border-collapse:collapse;font-size:12px;${rosterView==='player'?'table-layout:fixed;':''}">`;
    html += rosterView === 'player' ? playerBatColgroup : rosterColgroup;
    html += '<tbody>';
    ilPlayers.forEach(p => {
      const isPit = p && ['SP','RP'].includes(p.primaryPos);
      html += rowFn(p, 'IL', '<span style="color:var(--red);">IL</span>', isPit, filteredBatStatCols.length);
    });
    if (ilPlayers.length === 0) html += `<tr><td colspan="${colSpan}" style="padding:4px 6px;color:var(--text2);font-size:11px;">No IL players</td></tr>`;
    html += '</tbody></table>';
  }

  // Minors (always show)
  html += `<div style="margin-top:8px;"><span style="font-weight:700;font-size:11px;color:var(--accent);">MINORS (${teamMilb.length}/4)</span></div>`;
  html += `<table style="width:100%;border-collapse:collapse;font-size:12px;${rosterView==='player'?'table-layout:fixed;':''}">`;
  html += rosterView === 'player' ? playerBatColgroup : rosterColgroup;
  html += '<tbody>';
  teamMilb.forEach(name => {
    const p = _plyrI(name);
    const isPit = p && ['SP','RP'].includes(p.primaryPos);
    if (p) {
      html += rowFn(p, 'MiLB', '<span style="color:var(--accent);">MiLB</span>', isPit, filteredBatStatCols.length);
    } else {
      // Show prospect info for MiLB keepers not in main player pool
      const pr = findProspect(name);
      const prPos = pr ? pr.pos : '';
      const prOrg = pr ? pr.team : '';
      const prFV = pr ? `FV${pr.fv}` : '';
      const prRank = pr && pr.avg_rank ? `#${Math.round(pr.avg_rank)}` : '';
      const prAge = pr && pr.age ? `${pr.age.toFixed(0)}y` : '';
      const prInfo = [prPos, prOrg, prFV, prRank, prAge].filter(Boolean).join(' · ');
      const colsUsed = rosterView === 'player' ? numBatCols : colSpan;
      html += `<tr><td style="padding:3px 6px;font-weight:600;font-size:11px;">MiLB</td><td colspan="${colsUsed-1}" style="padding:3px 6px;font-size:12px;">${name}${_injBadge(name)} <span style="color:var(--accent);font-size:10px;">${prInfo}</span></td></tr>`;
    }
  });
  if (teamMilb.length === 0) html += `<tr><td colspan="${colSpan}" style="padding:4px 6px;color:var(--text2);font-size:11px;">No minor leaguers</td></tr>`;
  html += '</tbody></table>';

  html += '</div>'; // end left column

  // ── RIGHT: Sidebar ──
  html += '<div style="flex:0 0 300px;">';

  // Compute needs data (used by both views and other-team view)
  const _myTeamObj = LEAGUE_TEAMS.find(t => t.mine);
  const needsTeamLabel = isMine ? (_myTeamObj ? _myTeamObj.owner : 'My') : (LEAGUE_TEAMS.find(t => t.name === selTeamName)?.owner || selTeamName);
  const myPl = teamPlayers.map(n => _plyrI(n)).filter(Boolean);
  const myAssigned = computeNeedsForTeam(myPl);
  const needs = [];
  for (const [pos, slots] of Object.entries(ROSTER_SLOTS)) {
    const top = myAssigned[pos] || [];
    const avgLcv = top.length > 0 ? top.reduce((s,p) => s + (p.lcv||0), 0) / top.length : 0;
    const leagueAvgs = [];
    LEAGUE_TEAMS.filter(t => !t.mine).forEach(t => {
      const tPl = (state.leagueTeams[t.name]||[]).map(n => _plyrI(n)).filter(Boolean);
      const tAssigned = computeNeedsForTeam(tPl);
      const tTop = tAssigned[pos] || [];
      if (tTop.length > 0) leagueAvgs.push(tTop.reduce((s,p)=>s+(p.lcv||0),0)/tTop.length);
    });
    const leagueAvg = leagueAvgs.length > 0 ? leagueAvgs.reduce((s,v)=>s+v,0)/leagueAvgs.length : 0;
    const diff = avgLcv - leagueAvg;
    needs.push({ pos, avgLcv, leagueAvg, diff, count: top.length });
  }
  needs.sort((a,b) => a.diff - b.diff);
  const _wwNeeds = {};
  needs.forEach(n => { _wwNeeds[n.pos] = n.diff; });

  // ── Player News helper (used in both Player View sidebar and GM View) ──
  const myTeamNames = new Set((state.myTeam || []).map(n => n.toLowerCase()));
  const relevantNews = (PLAYER_NEWS || []).filter(n => (n.name || n.player) && myTeamNames.has((n.name || n.player).toLowerCase()));
  if (relevantNews.length > 0) {
    relevantNews.sort((a, b) => {
      const [am, ad] = (a.date || '01/01').split('/').map(Number);
      const [bm, bd] = (b.date || '01/01').split('/').map(Number);
      const ay = am >= 8 ? 2025 : 2026;
      const by = bm >= 8 ? 2025 : 2026;
      return (by * 10000 + bm * 100 + bd) - (ay * 10000 + am * 100 + ad);
    });
  }
  function renderPlayerNewsPanel() {
    let h = '';
    if (relevantNews.length > 0) {
      h += '<div style="background:var(--surface2);border-radius:8px;padding:10px;margin-bottom:12px;">';
      h += '<h3 style="font-size:13px;margin-bottom:6px;">Player News</h3>';
      h += '<div style="font-size:10px;color:var(--text2);margin-bottom:6px;">Latest news for your rostered players from CBS.</div>';
      relevantNews.forEach(n => {
        const _nn = n.name || n.player || '?';
        const p = _plyrI(_nn);
        const pos = p ? p.primaryPos : '';
        const isRecent = (() => { const [m,d] = (n.date||'').split('/').map(Number); return m === 3 && d >= 10; })();
        const dateClr = isRecent ? 'color:var(--green);' : 'color:var(--text2);';
        h += `<div style="padding:4px 0;border-bottom:1px solid var(--border);font-size:11px;">`;
        h += `<div><span style="font-weight:600;">${_nn}</span> <span style="color:var(--text2);font-size:10px;">${pos}</span> <span style="font-size:9px;${dateClr}">${n.date}</span></div>`;
        h += `<div style="color:var(--text2);font-size:10px;margin-top:1px;">${n.headline}</div>`;
        h += `</div>`;
      });
      h += '</div>';
    } else {
      h += '<div style="background:var(--surface2);border-radius:8px;padding:10px;margin-bottom:12px;">';
      h += '<h3 style="font-size:13px;margin-bottom:6px;">Player News</h3>';
      h += '<div style="font-size:11px;color:var(--text2);">No recent news for your players.</div>';
      h += '</div>';
    }
    return h;
  }

  // ── Collapsible panel helper for GM sidebar ──
  // Reads/writes collapse state to localStorage
  function gmPanel(id, title, contentFn) {
    let collapsed = false;
    try { const s = localStorage.getItem('dpf_gm_' + id); if (s === '1') collapsed = true; } catch(e) {}
    let h = `<div class="gm-panel" data-panel-id="${id}" draggable="true" style="background:var(--surface2);border-radius:8px;padding:10px;margin-bottom:12px;cursor:grab;">`;
    const arrow = collapsed ? '▶' : '▼';
    h += `<div class="gm-panel-hdr" data-panel="${id}" style="cursor:pointer;display:flex;align-items:center;gap:6px;user-select:none;">`;
    h += `<span class="gm-arrow" style="font-size:10px;color:var(--accent);font-weight:600;width:12px;">${arrow}</span>`;
    h += `<h3 style="font-size:13px;margin:0;flex:1;">${title}</h3>`;
    h += '<span style="font-size:10px;color:var(--text2);cursor:grab;" title="Drag to reorder">☰</span>';
    h += '</div>';
    h += `<div class="gm-panel-body" data-panel="${id}" style="${collapsed ? 'display:none;' : ''}margin-top:8px;">`;
    h += contentFn();
    h += '</div></div>';
    return h;
  }

  if (rosterView === 'player') {
    // ── PLAYER VIEW Sidebar: Player News + (league standings for other teams) + Transaction Log ──
    html += renderPlayerNewsPanel();
    if (!isMyRosterTab) {
      // League LCV standings for other team views
      html += '<div style="background:var(--surface2);border-radius:8px;padding:10px;margin-top:12px;">';
      html += '<h3 style="font-size:13px;margin-bottom:6px;">League LCV Standings</h3>';
      html += '<table style="width:100%;font-size:11px;border-collapse:collapse;">';
      html += '<tr style="color:var(--text2);"><th style="text-align:left;padding:2px 4px;">#</th><th style="text-align:left;padding:2px 4px;">Team</th><th style="text-align:right;padding:2px 4px;">Start</th><th style="text-align:right;padding:2px 4px;">Total</th></tr>';
      const lcvStats2 = LEAGUE_TEAMS.map(t => {
        const pl = t.mine ? (state.myTeam || []) : (state.leagueTeams[t.name] || []);
        const ov = t.mine ? (state.rosterOverrides || {}) : (state.leagueRosterOverrides && state.leagueRosterOverrides[t.name] || {});
        const stats = calcRosterLCV(pl, ov);
        return { name: t.owner || t.name, mine: t.mine, ...stats };
      }).sort((a, b) => b.startingLCV - a.startingLCV);
      lcvStats2.forEach((t, rank) => {
        const sty = t.mine ? 'background:rgba(99,102,241,0.1);font-weight:600;' : '';
        html += `<tr style="${sty}"><td style="padding:2px 4px;">${rank+1}</td><td style="padding:2px 4px;">${t.name}${t.mine?' ★':''}</td><td style="text-align:right;padding:2px 4px;">${t.startingLCV.toFixed(1)}</td><td style="text-align:right;padding:2px 4px;">${t.totalLCV.toFixed(1)}</td></tr>`;
      });
      html += '</table></div>';
    }

  } else if (isMyRosterTab && rosterView === 'gm') {
    // ── GM VIEW Sidebar: Collapsible, draggable panels ──
    // Get panel order from localStorage
    const defaultOrder = ['roster-needs','trade-evaluator','trade-ideas','waiver-wire','most-droppable'];
    let panelOrder;
    try { const saved = localStorage.getItem('dpf_gm_order'); panelOrder = saved ? JSON.parse(saved) : defaultOrder; } catch(e) { panelOrder = defaultOrder; }
    // Ensure all panels exist in order
    defaultOrder.forEach(id => { if (!panelOrder.includes(id)) panelOrder.push(id); });
    panelOrder = panelOrder.filter(id => defaultOrder.includes(id));

    // Build panel content functions
    const panelRenderers = {
      'roster-needs': () => gmPanel('roster-needs', `${needsTeamLabel} Roster Needs`, () => {
        let h = '<table style="width:100%;font-size:11px;border-collapse:collapse;">';
        h += '<tr style="color:var(--text2);font-size:10px;"><th style="text-align:left;padding:2px 4px;">Pos</th><th style="text-align:right;padding:2px 4px;">My Avg</th><th style="text-align:right;padding:2px 4px;">Lg Avg</th><th style="text-align:right;padding:2px 4px;">Gap</th></tr>';
        needs.forEach(n => {
          const clr = n.diff >= 1 ? 'var(--green)' : n.diff >= -1 ? 'var(--text)' : 'var(--red)';
          const indicator = n.diff < -1 ? ' ⚠' : n.diff >= 2 ? ' ✓' : '';
          h += `<tr><td style="padding:2px 4px;font-weight:600;">${n.pos}</td><td style="text-align:right;padding:2px 4px;">${n.avgLcv.toFixed(1)}</td><td style="text-align:right;padding:2px 4px;">${n.leagueAvg.toFixed(1)}</td><td style="text-align:right;padding:2px 4px;color:${clr};font-weight:600;">${n.diff > 0 ? '+' : ''}${n.diff.toFixed(1)}${indicator}</td></tr>`;
        });
        h += '</table>';
        return h;
      }),

      'trade-evaluator': () => gmPanel('trade-evaluator', 'Trade Evaluator', () => {
        let h = '';
        h += '<div style="font-size:10px;color:var(--text2);margin-bottom:6px;">Includes keeper round cost, surplus value, and years of control. R1-4 players cannot be kept.</div>';
        h += '<div style="display:flex;gap:8px;">';
        h += '<div style="flex:1;">';
        h += '<div style="font-weight:600;font-size:11px;color:var(--red);margin-bottom:4px;">I Give</div>';
        h += '<input id="tradeGiveInput" type="text" placeholder="Search player..." style="width:100%;padding:4px 6px;font-size:11px;background:var(--bg);border:1px solid var(--border);border-radius:4px;color:var(--text);box-sizing:border-box;" autocomplete="off">';
        h += '<div id="tradeGiveAC" style="position:relative;"></div>';
        h += '<div id="tradeGiveList" style="margin-top:4px;"></div>';
        h += '<div style="margin-top:6px;display:flex;gap:4px;align-items:center;">';
        h += '<select id="tradeGivePickRound" style="padding:3px 4px;font-size:10px;background:var(--bg);border:1px solid var(--border);border-radius:4px;color:var(--text);"><option value="">+ 2027 Pick...</option>';
        for (let rd = 1; rd <= 31; rd++) { h += `<option value="${rd}">Round ${rd}</option>`; }
        h += '</select>';
        h += '<button id="tradeGivePickBtn" class="btn btn-secondary" style="padding:2px 8px;font-size:10px;">Add Pick</button>';
        h += '</div>';
        h += '<div id="tradeGivePickList" style="margin-top:4px;"></div>';
        h += '</div>';
        h += '<div style="flex:1;">';
        h += '<div style="font-weight:600;font-size:11px;color:var(--green);margin-bottom:4px;">I Get</div>';
        h += '<input id="tradeGetInput" type="text" placeholder="Search player..." style="width:100%;padding:4px 6px;font-size:11px;background:var(--bg);border:1px solid var(--border);border-radius:4px;color:var(--text);box-sizing:border-box;" autocomplete="off">';
        h += '<div id="tradeGetAC" style="position:relative;"></div>';
        h += '<div id="tradeGetList" style="margin-top:4px;"></div>';
        h += '<div style="margin-top:6px;display:flex;gap:4px;align-items:center;">';
        h += '<select id="tradeGetPickRound" style="padding:3px 4px;font-size:10px;background:var(--bg);border:1px solid var(--border);border-radius:4px;color:var(--text);"><option value="">+ 2027 Pick...</option>';
        for (let rd = 1; rd <= 31; rd++) { h += `<option value="${rd}">Round ${rd}</option>`; }
        h += '</select>';
        h += '<button id="tradeGetPickBtn" class="btn btn-secondary" style="padding:2px 8px;font-size:10px;">Add Pick</button>';
        h += '</div>';
        h += '<div id="tradeGetPickList" style="margin-top:4px;"></div>';
        h += '</div>';
        h += '</div>';
        h += '<div style="margin-top:8px;">';
        h += '<div id="tradeSuggestToggle" style="cursor:pointer;font-size:11px;color:var(--accent);font-weight:600;user-select:none;">▶ Suggested targets based on your needs</div>';
        h += '<div id="tradeSuggestPanel" style="display:none;margin-top:6px;padding:6px;background:var(--bg);border-radius:4px;max-height:220px;overflow-y:auto;"></div>';
        h += '</div>';
        h += '<div id="tradeSummary" style="margin-top:8px;padding:6px;background:var(--bg);border-radius:4px;font-size:11px;display:none;"></div>';
        return h;
      }),

      'trade-ideas': () => gmPanel('trade-ideas', 'Trade Ideas', () => {
        let h = '';
        h += '<div style="font-size:10px;color:var(--text2);margin-bottom:6px;">Tell me what you want to improve and I\'ll find trades to make it happen.</div>';
        // Upgrade goal selector: positions + stat categories
        const posGoals = ['C','1B','2B','3B','SS','LF','CF','RF','SP','RP'];
        const statGoals = [
          {key:'hr',label:'HRs'},{key:'sb',label:'SBs'},{key:'avg',label:'AVG/OBP'},
          {key:'rbi',label:'RBI/Runs'},{key:'so',label:'Ks (pitching)'},{key:'sv',label:'Saves/Holds'},
          {key:'era',label:'ERA/WHIP'},{key:'qs',label:'QS/Wins'}
        ];
        h += '<div style="margin-bottom:6px;">';
        h += '<div style="font-weight:600;font-size:11px;margin-bottom:4px;">Position upgrades:</div>';
        h += '<div style="display:flex;flex-wrap:wrap;gap:3px;">';
        posGoals.forEach(pos => {
          const active = (state._tradeGoals || []).includes('pos:' + pos);
          const bg = active ? 'background:var(--accent2);color:#fff;border-color:var(--accent2);' : '';
          h += `<button class="trade-goal-btn btn btn-secondary" data-goal="pos:${pos}" style="padding:2px 6px;font-size:10px;${bg}">${pos}</button>`;
        });
        h += '</div></div>';
        h += '<div style="margin-bottom:6px;">';
        h += '<div style="font-weight:600;font-size:11px;margin-bottom:4px;">Stat categories:</div>';
        h += '<div style="display:flex;flex-wrap:wrap;gap:3px;">';
        statGoals.forEach(sg => {
          const active = (state._tradeGoals || []).includes('stat:' + sg.key);
          const bg = active ? 'background:var(--accent2);color:#fff;border-color:var(--accent2);' : '';
          h += `<button class="trade-goal-btn btn btn-secondary" data-goal="stat:${sg.key}" style="padding:2px 6px;font-size:10px;${bg}">${sg.label}</button>`;
        });
        h += '</div></div>';
        h += '<button id="tradeGenBtn" class="btn btn-primary" style="padding:4px 12px;font-size:11px;margin-bottom:6px;">Find Trades</button>';
        h += '<div id="tradeGenPanel" style="margin-top:4px;"></div>';
        return h;
      }),

      'waiver-wire': () => {
        const _allOwned = new Set(state.myTeam || []);
        Object.values(state.leagueTeams || {}).forEach(arr => (arr||[]).forEach(n => _allOwned.add(n)));
        Object.keys(state.drafted || {}).forEach(n => _allOwned.add(n));
        Object.values(LEAGUE_ROOKIES || {}).forEach(arr => (arr||[]).forEach(n => _allOwned.add(n)));
        const wwTargets = ALL.filter(p => !_allOwned.has(p.name) && ((p.recScore != null && p.recScore >= 0.2) || (p.lcv||0) >= 1.5)).map(p => {
          const positions = (p.pos || p.primaryPos || '').split('/').filter(x => x);
          let bestNeed = 0, bestPos = '';
          positions.forEach(pos => { const gap = _wwNeeds[pos]; if (gap !== undefined && gap < 0 && -gap > bestNeed) { bestNeed = -gap; bestPos = pos; } });
          const ki = getKeeperInfoCached(p.name);
          const keepBonus = ki.keepable2027 ? ki.yearsLeft * 0.3 : 0;
          // Primary driver: recScore (60% aLCV + 15% posFlex + 15% age + 10% LCV).
          // Falls back to LCV for players without enough in-season sample.
          const rec = p.recScore != null ? p.recScore : Math.max(-2, Math.min(2, (p.lcv||0) / 6));
          return { p, score: bestNeed * 2.5 + rec * 2.0 + keepBonus, bestPos, bestNeed, ki, rec };
        }).filter(x => x.score > 1.0).sort((a,b) => b.score - a.score).slice(0, 8);
        return gmPanel('waiver-wire', 'Waiver Wire Targets', () => {
          let h = '';
          if (wwTargets.length > 0) {
            h += '<table style="width:100%;font-size:11px;border-collapse:collapse;">';
            h += '<tr style="color:var(--text2);font-size:10px;"><th style="text-align:left;padding:2px 4px;">Player</th><th style="padding:2px 4px;">Pos</th><th style="text-align:right;padding:2px 4px;" title="Rec+: blended recommendation on wRC+ scale. 100 = pool average, 115 = +1sigma. Blend = 60% aLCV + 15% posFlex + 15% age + 10% LCV.">Rec+</th><th style="text-align:right;padding:2px 4px;" title="aLCV+ on wRC+ scale: 100 = pool average, 115 = +1sigma">aLCV+</th><th style="text-align:right;padding:2px 4px;">LCV</th><th style="text-align:right;padding:2px 4px;">ΔLCV</th><th style="text-align:center;padding:2px 4px;">Keep</th><th style="text-align:left;padding:2px 4px;">Why</th></tr>';
            wwTargets.forEach(t => {
              const keepTag = t.ki.keepable2027 ? `<span style="color:var(--green);">R${t.ki.cost2027} (${t.ki.yearsLeft}yr)</span>` : '<span style="color:var(--text2);">—</span>';
              const tRecPlus = t.p.recScorePlus != null ? t.p.recScorePlus : null;
              const why = t.bestNeed > 0.5 ? `fills ${t.bestPos}`
                : tRecPlus != null && tRecPlus >= 118 ? 'elite score'
                : tRecPlus != null && tRecPlus >= 109 ? 'strong score'
                : t.ki.keepable2027 ? 'keeper value'
                : 'depth';
              const _wAlcv = t.p.aLCVPlus != null ? Math.round(t.p.aLCVPlus).toString() : '—';
              const _wAlcvClr = t.p.aLCVPlus != null ? (t.p.aLCVPlus >= 115 ? 'color:var(--green);font-weight:700;' : t.p.aLCVPlus >= 100 ? 'color:var(--green);' : t.p.aLCVPlus <= 85 ? 'color:var(--red);' : 'color:var(--text2);') : 'color:var(--text2);';
              const _wDlcv = t.p.lcvDelta != null ? ((t.p.lcvDelta > 0 ? '+' : '') + t.p.lcvDelta.toFixed(1)) : '—';
              const _wDlcvClr = t.p.lcvDelta != null ? (t.p.lcvDelta >= 0 ? 'color:var(--green);' : 'color:var(--red);') : 'color:var(--text2);';
              const _wRec = t.p.recScorePlus != null ? Math.round(t.p.recScorePlus).toString() : '—';
              const _wRecClr = t.p.recScorePlus != null ? (t.p.recScorePlus >= 109 ? 'color:var(--green);font-weight:700;' : t.p.recScorePlus >= 100 ? 'color:var(--green);' : t.p.recScorePlus <= 88 ? 'color:var(--red);' : 'color:var(--text2);') : 'color:var(--text2);';
              h += `<tr style="border-bottom:1px solid var(--border);"><td style="padding:3px 4px;font-weight:600;">${t.p.name}</td><td style="padding:3px 4px;text-align:center;">${t.p.primaryPos}</td><td style="text-align:right;padding:3px 4px;${_wRecClr}">${_wRec}</td><td style="text-align:right;padding:3px 4px;${_wAlcvClr}">${_wAlcv}</td><td style="text-align:right;padding:3px 4px;color:var(--text2);">${(t.p.lcv||0).toFixed(1)}</td><td style="text-align:right;padding:3px 4px;font-weight:600;${_wDlcvClr}">${_wDlcv}</td><td style="text-align:center;padding:3px 4px;font-size:10px;">${keepTag}</td><td style="padding:3px 4px;font-size:10px;color:var(--accent);">${why}</td></tr>`;
            });
            h += '</table>';
          } else { h += '<div style="font-size:11px;color:var(--text2);">No strong waiver targets found.</div>'; }
          return h;
        });
      },

      'most-droppable': () => {
        // Count players at each position (surplus = 3+, since 2 = starter + backup)
        const _posCounts = {};
        (state.myTeam || []).forEach(n => {
          const p = _plyrI(n); if (!p) return;
          const pos = p.primaryPos || 'UT';
          _posCounts[pos] = (_posCounts[pos] || 0) + 1;
        });
        const _dropPlayers = (state.myTeam || []).map(n => {
          const p = _plyrI(n); if (!p) return null;
          const ki = getKeeperInfoCached(n); const lcv = p.lcv || 0;
          const posCount = _posCounts[p.primaryPos] || 0;
          const hasSurplus = posCount >= 3; // 3+ means real surplus
          const isScarcity = posCount <= 1; // only 1 at position
          // Primary driver: negated recScore (low rec = high drop priority).
          // Falls back to LCV-based penalty for players without recScore.
          const rec = p.recScore != null ? p.recScore : Math.max(-2, Math.min(2, (lcv - 2.5) / 4));
          let dropScore = -rec * 2.2;
          if (!ki.keepable2027) dropScore += 1.5; else dropScore -= ki.yearsLeft * 0.5;
          if (hasSurplus) dropScore += (posCount - 2) * 0.8;
          if (isScarcity) dropScore -= 2.0;
          dropScore -= Math.max(0, ki.multiYearSurplus || 0) * 0.8;
          return { name: n, p, ki, lcv, rec, dropScore, posCount };
        }).filter(Boolean).sort((a,b) => b.dropScore - a.dropScore).slice(0, 5);
        return gmPanel('most-droppable', 'Most Droppable', () => {
          let h = '<div style="font-size:10px;color:var(--text2);margin-bottom:4px;">Players with the lowest combined production + keeper value.</div>';
          if (_dropPlayers.length > 0) {
            h += '<table style="width:100%;font-size:11px;border-collapse:collapse;">';
            h += '<tr style="color:var(--text2);font-size:10px;"><th style="text-align:left;padding:2px 4px;">Player</th><th style="padding:2px 4px;">Pos</th><th style="text-align:right;padding:2px 4px;" title="Rec+: blended recommendation on wRC+ scale. 100 = pool average, 115 = +1sigma. Blend = 60% aLCV + 15% posFlex + 15% age + 10% LCV.">Rec+</th><th style="text-align:right;padding:2px 4px;" title="aLCV+ on wRC+ scale: 100 = pool average, 115 = +1sigma">aLCV+</th><th style="text-align:right;padding:2px 4px;">LCV</th><th style="text-align:right;padding:2px 4px;">ΔLCV</th><th style="text-align:center;padding:2px 4px;">Keep</th><th style="text-align:left;padding:2px 4px;">Why</th></tr>';
            _dropPlayers.forEach(t => {
              const keepTag = t.ki.keepable2027 ? `<span style="color:var(--green);">R${t.ki.cost2027} (${t.ki.yearsLeft}yr)</span>` : '<span style="color:var(--red);">NK</span>';
              const reasons = [];
              const dRecPlus = t.p.recScorePlus != null ? t.p.recScorePlus : null;
              if (dRecPlus != null && dRecPlus <= 88) reasons.push('very poor rec');
              else if (dRecPlus != null && dRecPlus <= 96) reasons.push('weak rec');
              else if (t.p.aLCVPlus != null && t.p.aLCVPlus <= 85) reasons.push('underperforming');
              else if (t.lcv < 2) reasons.push('low production');
              if (!t.ki.keepable2027) reasons.push('not keepable');
              if (t.posCount >= 3) reasons.push(`${t.p.primaryPos} surplus (${t.posCount})`);
              const why = reasons.length > 0 ? reasons.slice(0,2).join(', ') : 'marginal value';
              const _dAlcv = t.p.aLCVPlus != null ? Math.round(t.p.aLCVPlus).toString() : '—';
              const _dAlcvClr = t.p.aLCVPlus != null ? (t.p.aLCVPlus >= 115 ? 'color:var(--green);font-weight:700;' : t.p.aLCVPlus >= 100 ? 'color:var(--green);' : t.p.aLCVPlus <= 85 ? 'color:var(--red);' : 'color:var(--text2);') : 'color:var(--text2);';
              const _dDlcv = t.p.lcvDelta != null ? ((t.p.lcvDelta > 0 ? '+' : '') + t.p.lcvDelta.toFixed(1)) : '—';
              const _dDlcvClr = t.p.lcvDelta != null ? (t.p.lcvDelta >= 0 ? 'color:var(--green);' : 'color:var(--red);') : 'color:var(--text2);';
              const _dRec = t.p.recScorePlus != null ? Math.round(t.p.recScorePlus).toString() : '—';
              const _dRecClr = t.p.recScorePlus != null ? (t.p.recScorePlus >= 109 ? 'color:var(--green);font-weight:700;' : t.p.recScorePlus >= 100 ? 'color:var(--green);' : t.p.recScorePlus <= 88 ? 'color:var(--red);' : 'color:var(--text2);') : 'color:var(--text2);';
              h += `<tr style="border-bottom:1px solid var(--border);"><td style="padding:3px 4px;font-weight:600;">${t.name}</td><td style="padding:3px 4px;text-align:center;">${t.p.primaryPos}</td><td style="text-align:right;padding:3px 4px;${_dRecClr}">${_dRec}</td><td style="text-align:right;padding:3px 4px;${_dAlcvClr}">${_dAlcv}</td><td style="text-align:right;padding:3px 4px;color:var(--text2);">${t.lcv.toFixed(1)}</td><td style="text-align:right;padding:3px 4px;font-weight:600;${_dDlcvClr}">${_dDlcv}</td><td style="text-align:center;padding:3px 4px;font-size:10px;">${keepTag}</td><td style="padding:3px 4px;font-size:10px;color:var(--red);">${why}</td></tr>`;
            });
            h += '</table>';
          }
          return h;
        });
      },

    };

    // Render panels in saved order
    panelOrder.forEach(id => { if (panelRenderers[id]) html += panelRenderers[id](); });

  } else {
    // ── GM View Sidebar for other teams: LCV standings + Roster Needs + Transaction Log ──
    // (My Roster GM view hits the branch above; this is for league team GM views)
    html += '<div style="background:var(--surface2);border-radius:8px;padding:10px;margin-bottom:12px;">';
    html += '<h3 style="font-size:13px;margin-bottom:6px;">League LCV Standings</h3>';
    html += '<table style="width:100%;font-size:11px;border-collapse:collapse;">';
    html += '<tr style="color:var(--text2);"><th style="text-align:left;padding:2px 4px;">#</th><th style="text-align:left;padding:2px 4px;">Team</th><th style="text-align:right;padding:2px 4px;">Start</th><th style="text-align:right;padding:2px 4px;">Total</th></tr>';
    const lcvStats = LEAGUE_TEAMS.map(t => {
      const pl = t.mine ? (state.myTeam || []) : (state.leagueTeams[t.name] || []);
      const ov = t.mine ? (state.rosterOverrides || {}) : (state.leagueRosterOverrides && state.leagueRosterOverrides[t.name] || {});
      const stats = calcRosterLCV(pl, ov);
      return { name: t.owner || t.name, mine: t.mine, ...stats };
    }).sort((a, b) => b.startingLCV - a.startingLCV);
    lcvStats.forEach((t, rank) => {
      const sty = t.mine ? 'background:rgba(99,102,241,0.1);font-weight:600;' : '';
      html += `<tr style="${sty}"><td style="padding:2px 4px;">${rank+1}</td><td style="padding:2px 4px;">${t.name}${t.mine?' ★':''}</td><td style="text-align:right;padding:2px 4px;">${t.startingLCV.toFixed(1)}</td><td style="text-align:right;padding:2px 4px;">${t.totalLCV.toFixed(1)}</td></tr>`;
    });
    html += '</table></div>';

    // Roster Needs
    html += '<div style="background:var(--surface2);border-radius:8px;padding:10px;">';
    html += `<h3 style="font-size:13px;margin-bottom:6px;">${needsTeamLabel} Roster Needs</h3>`;
    html += '<table style="width:100%;font-size:11px;border-collapse:collapse;">';
    html += '<tr style="color:var(--text2);font-size:10px;"><th style="text-align:left;padding:2px 4px;">Pos</th><th style="text-align:right;padding:2px 4px;">My Avg</th><th style="text-align:right;padding:2px 4px;">Lg Avg</th><th style="text-align:right;padding:2px 4px;">Gap</th></tr>';
    needs.forEach(n => {
      const clr = n.diff >= 1 ? 'var(--green)' : n.diff >= -1 ? 'var(--text)' : 'var(--red)';
      const indicator = n.diff < -1 ? ' ⚠' : n.diff >= 2 ? ' ✓' : '';
      html += `<tr><td style="padding:2px 4px;font-weight:600;">${n.pos}</td><td style="text-align:right;padding:2px 4px;">${n.avgLcv.toFixed(1)}</td><td style="text-align:right;padding:2px 4px;">${n.leagueAvg.toFixed(1)}</td><td style="text-align:right;padding:2px 4px;color:${clr};font-weight:600;">${n.diff > 0 ? '+' : ''}${n.diff.toFixed(1)}${indicator}</td></tr>`;
    });
    html += '</table></div>';
  }

  // ── Transaction Log (always visible) ──
  if (!state._txFilterMine) state._txFilterMine = false;
  const txFilterMine = isMyRosterTab ? state._txFilterMine : false;
  html += '<div style="background:var(--surface2);border-radius:8px;padding:10px;margin-top:12px;">';
  html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">';
  html += '<h3 style="font-size:13px;margin:0;">Transaction Log</h3>';
  if (isMyRosterTab) {
    const myTeamName = MY_TEAM ? MY_TEAM.name : '';
    const myNames = new Set(state.myTeam || []);
    html += '<span style="flex:1;"></span>';
    html += `<button class="txn-filter-btn btn btn-secondary" style="padding:2px 8px;font-size:10px;${txFilterMine ? 'background:var(--accent2);color:#fff;border-color:var(--accent2);' : ''}">My Team</button>`;
  }
  html += '</div>';
  const txnsRaw = (state.transactions || []).map((tx, i) => ({...tx, _idx: i}));
  let txnsSorted = txnsRaw.slice().sort((a,b) => {
    const pa = a.date ? a.date.replace(/(\d{1,2})\/(\d{1,2})\/(\d{2})/, (m,mo,dy,yr) => `20${yr}-${mo.padStart(2,'0')}-${dy.padStart(2,'0')}`) : '';
    const pb = b.date ? b.date.replace(/(\d{1,2})\/(\d{1,2})\/(\d{2})/, (m,mo,dy,yr) => `20${yr}-${mo.padStart(2,'0')}-${dy.padStart(2,'0')}`) : '';
    const dc = pb.localeCompare(pa);
    return dc !== 0 ? dc : b._idx - a._idx;
  });
  if (txFilterMine) {
    const myNames = new Set(state.myTeam || []);
    const myTeamName = MY_TEAM ? MY_TEAM.name : '';
    txnsSorted = txnsSorted.filter(tx => myNames.has(tx.player) || (tx.from && tx.from === myTeamName) || (tx.cbsAction && tx.cbsAction.includes(myTeamName)));
  }
  const txns = txnsSorted.slice(0, 25);
  if (txns.length === 0) {
    html += `<div style="font-size:11px;color:var(--text2);">${txFilterMine ? 'No transactions for your team.' : 'No transactions yet.'}</div>`;
  } else {
    html += '<div style="max-height:180px;overflow-y:auto;">';
    txns.forEach(tx => {
      const icon = tx.type === 'add' ? '<span style="color:var(--green);font-weight:700;">+</span>' : tx.type === 'drop' ? '<span style="color:var(--red);font-weight:700;">−</span>' : '<span style="color:var(--accent);font-weight:700;">↔</span>';
      const cbsBadge = tx.source === 'CBS' ? ' <span style="font-size:8px;background:var(--accent);color:#fff;padding:1px 3px;border-radius:2px;">CBS</span>' : '';
      const _txP = _plyrI(tx.player);
      let _txLcv = _txP ? ` <span style="color:var(--text2);font-size:9px;">(${(_txP.lcv||0).toFixed(1)}` : '';
      if (_txP && _txP.actualLcv != null) {
        const _txDClr = _txP.lcvDelta >= 0 ? 'var(--green)' : 'var(--red)';
        _txLcv += ` → <span style="color:${_txDClr};font-weight:600;">${_txP.actualLcv.toFixed(1)}</span>`;
      }
      if (_txP) _txLcv += ')</span>';
      const desc = tx.type === 'add' ? `Added ${tx.player}${_txLcv} from ${tx.from||'FA'}${cbsBadge}` : tx.type === 'drop' ? `Dropped ${tx.player}${_txLcv}${cbsBadge}` : `Traded ${tx.player}${_txLcv} → ${tx.from||'?'}${cbsBadge}`;
      html += `<div style="font-size:10px;padding:2px 0;border-bottom:1px solid var(--border);">${icon} <span style="color:var(--text2);">${tx.date||''}</span> ${desc}</div>`;
    });
    html += '</div>';
  }
  html += '</div>';

  html += '</div>'; // end right sidebar
  html += '</div>'; // end flex container

  section.innerHTML = html;
  section.style.display = '';
  document.getElementById('tableWrap').style.display = 'none';

  // ── Wire Player/GM view toggle ──
  section.querySelectorAll('.roster-view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state._rosterView = btn.dataset.view;
      renderRoster();
    });
  });

  // ── Wire Stat Set toggle ──
  section.querySelectorAll('.stat-set-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state._statSets = btn.dataset.sets;
      renderRoster();
    });
  });

  // ── Wire Time-Split toggle ──
  section.querySelectorAll('.split-toggle').forEach(sel => {
    sel.addEventListener('change', () => {
      state._splitWindow = sel.value;
      applySplitWindow(sel.value);
      save();
      renderRoster();
    });
  });

  // ── Wire Transaction Log filter ──
  section.querySelectorAll('.txn-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state._txFilterMine = !state._txFilterMine;
      renderRoster();
    });
  });

  // ── Wire GM panel collapse/expand ──
  section.querySelectorAll('.gm-panel-hdr').forEach(hdr => {
    hdr.addEventListener('click', (e) => {
      if (e.target.closest('.gm-panel[draggable]') && e.target.style.cursor === 'grab') return;
      const id = hdr.dataset.panel;
      const body = section.querySelector(`.gm-panel-body[data-panel="${id}"]`);
      const arrow = hdr.querySelector('.gm-arrow');
      if (!body) return;
      const isHidden = body.style.display === 'none';
      body.style.display = isHidden ? '' : 'none';
      if (arrow) arrow.textContent = isHidden ? '▼' : '▶';
      try { localStorage.setItem('dpf_gm_' + id, isHidden ? '0' : '1'); } catch(e) {}
    });
  });

  // ── Wire GM panel drag-to-reorder ──
  {
    let dragPanel = null;
    section.querySelectorAll('.gm-panel[draggable]').forEach(panel => {
      panel.addEventListener('dragstart', e => {
        dragPanel = panel;
        panel.style.opacity = '0.4';
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', panel.dataset.panelId);
      });
      panel.addEventListener('dragend', () => {
        if (dragPanel) dragPanel.style.opacity = '1';
        dragPanel = null;
        section.querySelectorAll('.gm-panel').forEach(p => p.style.borderTop = '');
      });
      panel.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        panel.style.borderTop = '2px solid var(--accent)';
      });
      panel.addEventListener('dragleave', e => {
        if (!panel.contains(e.relatedTarget)) panel.style.borderTop = '';
      });
      panel.addEventListener('drop', e => {
        e.preventDefault();
        panel.style.borderTop = '';
        if (!dragPanel || dragPanel === panel) return;
        const container = panel.parentElement;
        container.insertBefore(dragPanel, panel);
        // Save new order to localStorage
        const newOrder = [...container.querySelectorAll('.gm-panel')].map(p => p.dataset.panelId).filter(Boolean);
        try { localStorage.setItem('dpf_gm_order', JSON.stringify(newOrder)); } catch(e) {}
      });
    });
  }

  // ── Wire team selector ──
  section.querySelectorAll('.roster-team-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state._rosterTeam = decodeURIComponent(btn.dataset.team);
      renderRoster();
    });
  });

  // ── Wire roster sort headers ──
  section.querySelectorAll('.roster-sort-th').forEach(th => {
    const col = th.dataset.col;
    if (!col) return;
    th.style.cursor = 'pointer';
    th.addEventListener('click', () => {
      if (state._rSortCol === col) {
        if (state._rSortDir === -1) state._rSortDir = 1;
        else { state._rSortCol = null; state._rSortDir = -1; } // third click resets
      } else {
        state._rSortCol = col;
        state._rSortDir = -1;
      }
      renderRoster();
    });
  });

  // ── Optimize button ──
  const optBtn = document.getElementById('optimizeRosterBtn');
  if (optBtn) optBtn.addEventListener('click', () => {
    const allNames = [...new Set([...teamPlayers, ...teamMilb])];
    const players = allNames.map(n => _plyrI(n)).filter(Boolean);
    const batters = players.filter(p => !['SP','RP'].includes(p.primaryPos)).sort((a,b) => (b.lcv||0) - (a.lcv||0));
    const sps = players.filter(p => p.primaryPos === 'SP').sort((a,b) => (b.lcv||0) - (a.lcv||0));
    const rps = players.filter(p => p.primaryPos === 'RP').sort((a,b) => (b.lcv||0) - (a.lcv||0));
    const nOv = {};
    const used = new Set();
    const bs = ['C','1B','2B','3B','SS','LF','CF','RF','DH'];
    for (const s of bs) { if (s==='DH') continue; const b = batters.find(p=>p.primaryPos===s&&!used.has(p.name)); if(b){nOv[b.name]=s;used.add(b.name);} }
    for (const s of bs) { if (s==='DH'||Object.values(nOv).filter(v=>v===s).length>=(ROSTER_SLOTS[s]||1)) continue; const b=batters.find(p=>{if(used.has(p.name))return false; return (p.pos||p.primaryPos||'').split('/').includes(s);}); if(b){nOv[b.name]=s;used.add(b.name);} }
    const dh = batters.find(p => !used.has(p.name)); if(dh){nOv[dh.name]='DH';used.add(dh.name);}
    sps.slice(0,5).forEach(p=>{nOv[p.name]='SP';used.add(p.name);});
    rps.slice(0,5).forEach(p=>{nOv[p.name]='RP';used.add(p.name);});
    allNames.forEach(n=>{if(!used.has(n)&&!nOv[n])nOv[n]='reserve';});
    if (isMine) state.rosterOverrides = nOv;
    else state.leagueRosterOverrides[selTeamName] = nOv;
    save();
    renderRoster();
  });

  // ── Reset button ──
  const resetBtn = document.getElementById('resetRosterBtn');
  if (resetBtn) resetBtn.addEventListener('click', () => {
    if (isMine) state.rosterOverrides = {};
    else delete state.leagueRosterOverrides[selTeamName];
    save();
    renderRoster();
  });

  // ── Drag & Drop on table rows ──
  section.querySelectorAll('.roster-row[draggable]').forEach(row => {
    row.addEventListener('dragstart', e => {
      row.style.opacity = '0.4';
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', decodeURIComponent(row.dataset.player));
    });
    row.addEventListener('dragend', () => {
      row.style.opacity = '1';
      section.querySelectorAll('.roster-section.drag-over').forEach(s => s.classList.remove('drag-over'));
    });
  });
  section.querySelectorAll('.roster-section').forEach(zone => {
    zone.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect='move'; zone.style.background='rgba(99,102,241,0.08)'; });
    zone.addEventListener('dragleave', e => { if(!zone.contains(e.relatedTarget)) zone.style.background=''; });
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.style.background = '';
      const playerName = e.dataTransfer.getData('text/plain');
      if (!playerName) return;
      const targetSlot = zone.dataset.slot;
      const _p = _plyrI(playerName);
      const _isPit = _p && ['SP','RP'].includes(_p.primaryPos);
      const _isHitSlot = ['C','1B','2B','3B','SS','LF','CF','RF','DH'].includes(targetSlot);
      const _isPitSlot = ['SP','RP'].includes(targetSlot);
      if (_isPitSlot && !_isPit) return;
      if (_isHitSlot && _isPit) return;
      if (_p && _isHitSlot && targetSlot !== 'DH') {
        const positions = (_p.pos || _p.primaryPos || '').split('/');
        if (!positions.includes(targetSlot)) return;
      }
      if (ROSTER_SLOTS[targetSlot] !== undefined) {
        const curOv = isMine ? state.rosterOverrides : (state.leagueRosterOverrides[selTeamName]||{});
        let slotCount = 0;
        for (const [pn, sl] of Object.entries(curOv)) {
          if (sl === targetSlot && pn !== playerName && teamPlayers.includes(pn)) slotCount++;
        }
        teamPlayers.filter(n => n !== playerName && !curOv[n]).forEach(n => {
          const ap = _plyrI(n);
          if (ap && ap.primaryPos === targetSlot) slotCount++;
        });
        if (slotCount >= ROSTER_SLOTS[targetSlot]) return;
      }
      if (isMine) { state.rosterOverrides[playerName] = targetSlot; }
      else { if (!state.leagueRosterOverrides[selTeamName]) state.leagueRosterOverrides[selTeamName] = {}; state.leagueRosterOverrides[selTeamName][playerName] = targetSlot; }
      save();
      renderRoster();
    });
  });

  // ── Drop buttons (my team only) ──
  if (isMine) {
    section.querySelectorAll('.drop-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const nm = decodeURIComponent(btn.dataset.name);
        if (!confirm(`Drop ${nm} from your roster?`)) return;
        const idx = (state.myTeam||[]).indexOf(nm);
        if (idx >= 0) state.myTeam.splice(idx, 1);
        // Remove from overrides too
        if (state.rosterOverrides && state.rosterOverrides[nm]) delete state.rosterOverrides[nm];
        // Log transaction
        if (!state.transactions) state.transactions = [];
        state.transactions.push({ type: 'drop', player: nm, date: new Date().toISOString().slice(0,10) });
        save();
        renderRoster();
      });
    });
  }

  // ── Trade Evaluator wiring (Draft mode only) ──
  if (!state._tradeGive) state._tradeGive = [];
  if (!state._tradeGet) state._tradeGet = [];
  if (!state._tradeGivePicks) state._tradeGivePicks = [];
  if (!state._tradeGetPicks) state._tradeGetPicks = [];
  {

  function tradePlayerTag(n) {
    const p = _plyrI(n);
    const ki = getKeeperInfoCached(n);
    const lcvStr = p ? (p.lcv||0).toFixed(1) : '?';
    const rdStr = ki.draftRound ? `R${ki.draftRound}` : 'FA';
    const keeperBadge = ki.keepable2027
      ? `<span style="color:var(--green);font-size:10px;" title="2027 keeper cost R${ki.cost2027}, ${ki.yearsLeft}yr control">${rdStr}→R${ki.cost2027} (${ki.yearsLeft}yr)</span>`
      : `<span style="color:var(--red);font-size:10px;font-weight:600;" title="R1-4 players cannot be kept">${rdStr} NOT KEEPABLE</span>`;
    const clampedSurplus = Math.max(0, ki.multiYearSurplus);
    const surpStr = clampedSurplus > 0 ? `<span style="color:var(--text2);font-size:10px;">S:${clampedSurplus.toFixed(1)}</span>` : '';
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;font-size:11px;border-bottom:1px solid var(--border);">` +
      `<div><b>${n}</b></div>` +
      `<div style="display:flex;gap:6px;align-items:center;">` +
      `<span style="color:var(--text2);">LCV ${lcvStr}</span>` +
      keeperBadge +
      surpStr +
      `<span class="trade-remove" data-name="${encodeURIComponent(n)}" style="cursor:pointer;color:var(--red);font-weight:700;font-size:10px;margin-left:2px;">✕</span>` +
      `</div></div>`;
  }

  function tradePickTag(rd, side) {
    const val = Math.max(0, (32 - rd) * 0.20);
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;font-size:11px;border-bottom:1px solid var(--border);">` +
      `<div><b>2027 Round ${rd} Pick</b></div>` +
      `<div style="display:flex;gap:6px;align-items:center;">` +
      `<span style="color:var(--text2);">Value ${val.toFixed(1)}</span>` +
      `<span class="trade-pick-remove" data-round="${rd}" data-side="${side}" style="cursor:pointer;color:var(--red);font-weight:700;font-size:10px;margin-left:2px;">✕</span>` +
      `</div></div>`;
  }

  function wireTradeInput(inputId, acId, listId, arr) {
    const inp = document.getElementById(inputId);
    const acDiv = document.getElementById(acId);
    const listDiv = document.getElementById(listId);
    if (!inp) return;

    function renderList() {
      listDiv.innerHTML = arr.map(n => tradePlayerTag(n)).join('');
      listDiv.querySelectorAll('.trade-remove').forEach(btn => {
        btn.addEventListener('click', () => {
          const nm = decodeURIComponent(btn.dataset.name);
          const idx = arr.indexOf(nm); if (idx >= 0) arr.splice(idx, 1);
          renderList(); updateTradeSummary();
        });
      });
    }

    inp.addEventListener('input', () => {
      const q = inp.value.trim().toLowerCase();
      if (q.length < 2) { acDiv.innerHTML = ''; return; }
      const matches = ALL.filter(p => p.name.toLowerCase().includes(q)).slice(0, 8);
      acDiv.innerHTML = '<div style="position:absolute;z-index:100;background:var(--surface);border:1px solid var(--border);border-radius:4px;max-height:160px;overflow-y:auto;width:100%;">' +
        matches.map(p => {
          const ki = getKeeperInfoCached(p.name);
          const rdTag = ki.draftRound ? `R${ki.draftRound}` : 'FA';
          const costTag = ki.keepable2027 ? `→R${ki.cost2027}` : '';
          return `<div class="trade-ac-item" data-name="${encodeURIComponent(p.name)}" style="padding:4px 6px;font-size:11px;cursor:pointer;border-bottom:1px solid var(--border);">${p.name} <small style="color:var(--text2)">${p.primaryPos} LCV:${(p.lcv||0).toFixed(1)} ${rdTag}${costTag}</small></div>`;
        }).join('') + '</div>';
      acDiv.querySelectorAll('.trade-ac-item').forEach(item => {
        item.addEventListener('click', () => {
          const nm = decodeURIComponent(item.dataset.name);
          if (!arr.includes(nm)) arr.push(nm);
          inp.value = ''; acDiv.innerHTML = '';
          renderList(); updateTradeSummary();
        });
      });
    });
    inp.addEventListener('blur', () => { setTimeout(() => acDiv.innerHTML = '', 200); });
    renderList();
  }

  function renderPickList(listId, arr, side) {
    const listDiv = document.getElementById(listId);
    if (!listDiv) return;
    listDiv.innerHTML = arr.map(rd => tradePickTag(rd, side)).join('');
    listDiv.querySelectorAll('.trade-pick-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const rd = parseInt(btn.dataset.round);
        const s = btn.dataset.side;
        const a = s === 'give' ? state._tradeGivePicks : state._tradeGetPicks;
        const idx = a.indexOf(rd); if (idx >= 0) a.splice(idx, 1);
        renderPickList(listId, a, s); updateTradeSummary();
      });
    });
  }

  function updateTradeSummary() {
    const sumDiv = document.getElementById('tradeSummary');
    if (!sumDiv) return;
    const g = state._tradeGive || [];
    const r = state._tradeGet || [];
    const gPicks = state._tradeGivePicks || [];
    const getPicks = state._tradeGetPicks || [];
    if (g.length === 0 && r.length === 0 && gPicks.length === 0 && getPicks.length === 0) { sumDiv.style.display = 'none'; return; }
    sumDiv.style.display = 'block';

    // LCV totals (players only - picks don't produce stats this year)
    const giveLCV = g.reduce((s,n) => { const p=_plyrI(n); return s+(p?(p.lcv||0):0); }, 0);
    const getLCV = r.reduce((s,n) => { const p=_plyrI(n); return s+(p?(p.lcv||0):0); }, 0);
    const lcvDiff = getLCV - giveLCV;
    const lcvClr = lcvDiff >= 0 ? 'var(--green)' : 'var(--red)';

    // Draft pick value (round value approximation)
    const givePickVal = gPicks.reduce((s,rd) => s + Math.max(0, (32 - rd) * 0.20), 0);
    const getPickVal = getPicks.reduce((s,rd) => s + Math.max(0, (32 - rd) * 0.20), 0);
    const pickDiff = getPickVal - givePickVal;
    const pickClr = pickDiff >= 0 ? 'var(--green)' : 'var(--red)';

    // Years of control
    const giveYrs = g.reduce((s,n) => s + getKeeperInfoCached(n).yearsLeft, 0);
    const getYrs = r.reduce((s,n) => s + getKeeperInfoCached(n).yearsLeft, 0);
    const yrsDiff = getYrs - giveYrs;

    // Prospect value for rookies/MiLB players
    const giveProspectVal = g.reduce((s,n) => {
      const pr = findProspect(n);
      return s + (pr ? Math.max(0, ((pr.fv||0) - 40) * 0.15) : 0);
    }, 0);
    const getProspectVal = r.reduce((s,n) => {
      const pr = findProspect(n);
      return s + (pr ? Math.max(0, ((pr.fv||0) - 40) * 0.15) : 0);
    }, 0);

    // Keeper surplus totals (multi-year) + pick values + prospect values as future assets
    // Clamp surplus to 0 minimum: negative surplus means bad keeper deal, not negative trade value
    const giveSurplus = g.reduce((s,n) => s + Math.max(0, getKeeperInfoCached(n).multiYearSurplus), 0) + givePickVal + giveProspectVal;
    const getSurplus = r.reduce((s,n) => s + Math.max(0, getKeeperInfoCached(n).multiYearSurplus), 0) + getPickVal + getProspectVal;
    const surplusDiff = getSurplus - giveSurplus;
    const surpClr = surplusDiff >= 0 ? 'var(--green)' : 'var(--red)';

    // Unkepable player warnings
    const unkepableGive = g.filter(n => { const ki = getKeeperInfoCached(n); return ki.draftRound && ki.draftRound <= 4 && !ki.keepable2027; });
    const unkepableGet = r.filter(n => { const ki = getKeeperInfoCached(n); return ki.draftRound && ki.draftRound <= 4 && !ki.keepable2027; });

    // Simulate post-trade roster LCV
    const myNames = [...(state.myTeam || [])];
    g.forEach(n => { const idx = myNames.indexOf(n); if (idx >= 0) myNames.splice(idx, 1); });
    r.forEach(n => { if (!myNames.includes(n)) myNames.push(n); });
    const preLCV = calcRosterLCV(state.myTeam || [], state.rosterOverrides || {});
    const postLCV = calcOptimalLCV(myNames);
    const rosterDiff = postLCV.startingLCV - preLCV.startingLCV;
    const rClr = rosterDiff >= 0 ? 'var(--green)' : 'var(--red)';

    // Build summary HTML
    let sh = '<div style="font-weight:700;font-size:12px;margin-bottom:6px;">Trade Summary</div>';

    // Keeper warnings
    if (unkepableGive.length > 0 || unkepableGet.length > 0) {
      sh += '<div style="margin-bottom:6px;padding:4px 6px;background:rgba(234,179,8,0.15);border-radius:4px;font-size:10px;">';
      sh += '<b style="color:var(--text);">Keeper Warning:</b> ';
      const all = [...unkepableGive, ...unkepableGet];
      sh += all.map(n => { const ki = getKeeperInfoCached(n); return `${n} (R${ki.draftRound}) cannot be kept`; }).join(', ');
      sh += ' — R1-4 players are permanently ineligible.';
      sh += '</div>';
    }

    // Comparison table for each side
    sh += '<table style="width:100%;font-size:10px;border-collapse:collapse;margin-bottom:6px;">';
    sh += '<tr style="color:var(--text2);border-bottom:1px solid var(--border);"><th style="text-align:left;padding:2px;">Metric</th><th style="text-align:right;padding:2px;">I Give</th><th style="text-align:right;padding:2px;">I Get</th><th style="text-align:right;padding:2px;">Net</th></tr>';

    sh += `<tr><td style="padding:2px;">LCV (production)</td><td style="text-align:right;padding:2px;">${giveLCV.toFixed(1)}</td><td style="text-align:right;padding:2px;">${getLCV.toFixed(1)}</td><td style="text-align:right;padding:2px;color:${lcvClr};font-weight:700;">${lcvDiff>=0?'+':''}${lcvDiff.toFixed(1)}</td></tr>`;

    const prospectDiff = getProspectVal - giveProspectVal;
    const prospectClr = prospectDiff >= 0 ? 'var(--green)' : 'var(--red)';
    sh += `<tr><td style="padding:2px;">Prospect Upside</td><td style="text-align:right;padding:2px;">${giveProspectVal.toFixed(1)}</td><td style="text-align:right;padding:2px;">${getProspectVal.toFixed(1)}</td><td style="text-align:right;padding:2px;color:${prospectClr};font-weight:700;">${prospectDiff>=0?'+':''}${prospectDiff.toFixed(1)}</td></tr>`;

    if (gPicks.length > 0 || getPicks.length > 0) {
      sh += `<tr><td style="padding:2px;">2027 Draft Picks</td><td style="text-align:right;padding:2px;">${givePickVal.toFixed(1)} (${gPicks.map(r=>'R'+r).join(',')})</td><td style="text-align:right;padding:2px;">${getPickVal.toFixed(1)} (${getPicks.map(r=>'R'+r).join(',')})</td><td style="text-align:right;padding:2px;color:${pickClr};font-weight:700;">${pickDiff>=0?'+':''}${pickDiff.toFixed(1)}</td></tr>`;
    }

    sh += `<tr><td style="padding:2px;">Total Future Value (surplus+picks)</td><td style="text-align:right;padding:2px;">${giveSurplus.toFixed(1)}</td><td style="text-align:right;padding:2px;">${getSurplus.toFixed(1)}</td><td style="text-align:right;padding:2px;color:${surpClr};font-weight:700;">${surplusDiff>=0?'+':''}${surplusDiff.toFixed(1)}</td></tr>`;

    sh += `<tr><td style="padding:2px;">Years of Control</td><td style="text-align:right;padding:2px;">${giveYrs}</td><td style="text-align:right;padding:2px;">${getYrs}</td><td style="text-align:right;padding:2px;font-weight:600;">${yrsDiff>=0?'+':''}${yrsDiff}</td></tr>`;

    sh += `<tr style="border-top:1px solid var(--border);"><td style="padding:2px;font-weight:600;">Roster LCV impact</td><td colspan="2"></td><td style="text-align:right;padding:2px;color:${rClr};font-weight:700;">${rosterDiff>=0?'+':''}${rosterDiff.toFixed(1)}</td></tr>`;
    sh += '</table>';

    sh += `<div style="color:var(--text2);font-size:10px;">Post-trade starting LCV: ${postLCV.startingLCV.toFixed(1)} (current: ${preLCV.startingLCV.toFixed(1)})</div>`;

    // Verdict — balanced composite factoring in production, future value, and prospect upside
    const absLcv = Math.abs(lcvDiff);
    const absSurp = Math.abs(surplusDiff);

    // Weight roster impact most heavily — this is what actually matters for your team
    const composite = rosterDiff * 0.55 + surplusDiff * 0.25 + prospectDiff * 0.20;
    const grade = composite > 4 ? 'A+' : composite > 2.5 ? 'A' : composite > 1.5 ? 'B+' : composite > 0.5 ? 'B' : composite > -0.5 ? 'C+' : composite > -1.5 ? 'C' : composite > -3 ? 'D' : 'F';
    const gradeClr = composite > 2.5 ? 'var(--green)' : composite > 0.5 ? '#4a90e2' : composite > -0.5 ? 'var(--text)' : 'var(--red)';

    sh += `<div style="margin-top:4px;padding:5px 8px;background:${composite > 0.5 ? 'rgba(34,197,94,0.08)' : composite > -0.5 ? 'rgba(234,179,8,0.1)' : 'rgba(239,68,68,0.08)'};border-radius:4px;font-size:11px;">`;
    sh += `<span style="font-weight:700;font-size:13px;color:${gradeClr};margin-right:6px;">${grade}</span> `;

    // Describe the trade character
    const prodUp = rosterDiff > 1;
    const prodDown = rosterDiff < -1;
    const futureUp = surplusDiff + prospectDiff > 0.5;
    const futureDown = surplusDiff + prospectDiff < -0.5;

    if (prodUp && futureUp) sh += `<span>Clear win — better production (+${rosterDiff.toFixed(1)} roster LCV) and future value</span>`;
    else if (prodUp && futureDown) sh += `<span>Win-now trade — better production (+${rosterDiff.toFixed(1)} roster LCV) but less future value</span>`;
    else if (prodDown && futureUp) sh += `<span>Dynasty play — less production now but building future assets (${(surplusDiff+prospectDiff) > 2 ? 'significant' : 'moderate'} upside)</span>`;
    else if (prodDown && futureDown) sh += `<span>Unfavorable — losing both production and future value</span>`;
    else if (prodUp) sh += `<span>Favorable — better production (+${rosterDiff.toFixed(1)} roster LCV) with roughly equal future value</span>`;
    else if (prodDown) sh += `<span>Slight downgrade — marginally less production with similar future value</span>`;
    else sh += '<span>Roughly even trade — similar production and future value</span>';
    sh += '</div>';

    sumDiv.innerHTML = sh;
  }

  wireTradeInput('tradeGiveInput', 'tradeGiveAC', 'tradeGiveList', state._tradeGive);
  wireTradeInput('tradeGetInput', 'tradeGetAC', 'tradeGetList', state._tradeGet);

  // Wire draft pick buttons
  const givePickBtn = document.getElementById('tradeGivePickBtn');
  const getPickBtn = document.getElementById('tradeGetPickBtn');
  const givePickSel = document.getElementById('tradeGivePickRound');
  const getPickSel = document.getElementById('tradeGetPickRound');
  if (givePickBtn && givePickSel) {
    givePickBtn.addEventListener('click', () => {
      const rd = parseInt(givePickSel.value);
      if (!rd) return;
      state._tradeGivePicks.push(rd);
      givePickSel.value = '';
      renderPickList('tradeGivePickList', state._tradeGivePicks, 'give');
      updateTradeSummary();
    });
  }
  if (getPickBtn && getPickSel) {
    getPickBtn.addEventListener('click', () => {
      const rd = parseInt(getPickSel.value);
      if (!rd) return;
      state._tradeGetPicks.push(rd);
      getPickSel.value = '';
      renderPickList('tradeGetPickList', state._tradeGetPicks, 'get');
      updateTradeSummary();
    });
  }
  renderPickList('tradeGivePickList', state._tradeGivePicks, 'give');
  renderPickList('tradeGetPickList', state._tradeGetPicks, 'get');

  // ── Suggested Targets ──
  const sugToggle = document.getElementById('tradeSuggestToggle');
  const sugPanel = document.getElementById('tradeSuggestPanel');
  if (sugToggle && sugPanel) {
    sugToggle.addEventListener('click', () => {
      const open = sugPanel.style.display !== 'none';
      sugPanel.style.display = open ? 'none' : 'block';
      sugToggle.textContent = (open ? '▶' : '▼') + ' Suggested targets based on your needs';
      if (!open) renderSuggestions();
    });
  }

  function renderSuggestions() {
    if (!sugPanel) return;
    // Compute my positional needs
    const myPl2 = (state.myTeam || []).map(n => _plyrI(n)).filter(Boolean);
    const myAssigned2 = computeNeedsForTeam(myPl2);
    const myNeeds2 = {};
    for (const [pos, slots] of Object.entries(ROSTER_SLOTS)) {
      const top = myAssigned2[pos] || [];
      const avgLcv = top.length > 0 ? top.reduce((s,p) => s + (p.lcv||0), 0) / top.length : 0;
      const leagueAvgs = [];
      LEAGUE_TEAMS.filter(t => !t.mine).forEach(t => {
        const tPl = (state.leagueTeams[t.name]||[]).map(n => _plyrI(n)).filter(Boolean);
        const tA = computeNeedsForTeam(tPl);
        const tTop = tA[pos] || [];
        if (tTop.length > 0) leagueAvgs.push(tTop.reduce((s,p)=>s+(p.lcv||0),0)/tTop.length);
      });
      const leagueAvg = leagueAvgs.length > 0 ? leagueAvgs.reduce((s,v)=>s+v,0)/leagueAvgs.length : 0;
      myNeeds2[pos] = avgLcv - leagueAvg;
    }

    // Score all players on other teams
    const candidates = [];
    LEAGUE_TEAMS.filter(t => !t.mine).forEach(t => {
      const roster = state.leagueTeams[t.name] || [];
      roster.forEach(name => {
        const p = _plyrI(name);
        if (!p) return;
        // Skip players already in trade lists
        if ((state._tradeGet||[]).includes(name) || (state._tradeGive||[]).includes(name)) return;
        const positions = (p.pos || p.primaryPos || '').split('/');
        let bestNeed = 99;
        let needPos = '';
        positions.forEach(pos => {
          if (myNeeds2[pos] !== undefined && myNeeds2[pos] < bestNeed) {
            bestNeed = myNeeds2[pos]; needPos = pos;
          }
        });
        // DH fallback
        if (!['SP','RP'].includes(p.primaryPos) && myNeeds2['DH'] !== undefined && myNeeds2['DH'] < bestNeed) {
          bestNeed = myNeeds2['DH']; needPos = 'DH';
        }

        const ki = getKeeperInfoCached(name);
        const keeperScore = ki.keepable2027 ? Math.min(Math.max(0, ki.multiYearSurplus) * 0.3, 2.0) : 0;
        const needScore = Math.max(0, -bestNeed) * 1.2;
        // Primary driver: recScore (60% aLCV + 15% posFlex + 15% age + 10% LCV).
        // Fallback to LCV for players w/o in-season sample.
        const rec = p.recScore != null ? p.recScore : Math.max(-2, Math.min(2, (p.lcv||0) / 6));
        const recScoreContrib = Math.max(-0.5, Math.min(2.0, rec * 1.5));
        const fitScore = needScore + recScoreContrib + keeperScore;

        if (fitScore > 0.5) {
          candidates.push({ name, pos: needPos, gap: bestNeed, score: fitScore, lcv: p.lcv||0, rec, team: t.name, ki, primaryPos: p.primaryPos, p });
        }
      });
    });

    candidates.sort((a,b) => b.score - a.score);
    const top12 = candidates.slice(0, 12);

    if (top12.length === 0) {
      sugPanel.innerHTML = '<div style="font-size:10px;color:var(--text2);padding:4px;">No strong trade targets found based on your current roster needs.</div>';
      return;
    }

    let sh = '<div style="font-size:10px;color:var(--text2);margin-bottom:4px;">Click a player to add them to "I Get"</div>';
    sh += '<table style="width:100%;font-size:10px;border-collapse:collapse;">';
    sh += '<tr style="color:var(--text2);font-size:9px;"><th style="text-align:left;padding:2px 3px;">Player</th><th style="text-align:left;padding:2px 3px;">Team</th><th style="text-align:center;padding:2px 3px;">Fills</th><th style="text-align:right;padding:2px 3px;" title="Rec+: blended recommendation on wRC+ scale. 100 = pool average, 115 = +1sigma.">Rec+</th><th style="text-align:right;padding:2px 3px;" title="aLCV+ on wRC+ scale: 100 = pool average, 115 = +1sigma">aLCV+</th><th style="text-align:right;padding:2px 3px;">LCV</th><th style="text-align:center;padding:2px 3px;">Keeper</th><th style="text-align:right;padding:2px 3px;">Fit</th></tr>';
    top12.forEach(c => {
      const keepStr = c.ki.keepable2027 ? `R${c.ki.cost2027} (${c.ki.yearsLeft}yr)` : '<span style="color:var(--red);">N/A</span>';
      const gapStr = c.gap < -1 ? '<span style="color:var(--red);">⚠</span>' : '';
      const recStr = c.p && c.p.recScorePlus != null ? Math.round(c.p.recScorePlus).toString() : '—';
      const recClr = c.p && c.p.recScorePlus != null ? (c.p.recScorePlus >= 109 ? 'color:var(--green);font-weight:700;' : c.p.recScorePlus >= 100 ? 'color:var(--green);' : c.p.recScorePlus <= 88 ? 'color:var(--red);' : 'color:var(--text2);') : 'color:var(--text2);';
      const alcvStr = c.p && c.p.aLCVPlus != null ? Math.round(c.p.aLCVPlus).toString() : '—';
      const alcvClr = c.p && c.p.aLCVPlus != null ? (c.p.aLCVPlus >= 115 ? 'color:var(--green);font-weight:700;' : c.p.aLCVPlus >= 100 ? 'color:var(--green);' : c.p.aLCVPlus <= 85 ? 'color:var(--red);' : 'color:var(--text2);') : 'color:var(--text2);';
      sh += `<tr class="trade-suggest-row" data-name="${encodeURIComponent(c.name)}" style="cursor:pointer;border-bottom:1px solid var(--border);" onmouseover="this.style.background='rgba(234,179,8,0.1)'" onmouseout="this.style.background=''">`;
      sh += `<td style="padding:3px;font-weight:600;">${c.name}</td>`;
      sh += `<td style="padding:3px;color:var(--text2);">${c.team}</td>`;
      sh += `<td style="text-align:center;padding:3px;">${c.pos} ${gapStr}</td>`;
      sh += `<td style="text-align:right;padding:3px;${recClr}">${recStr}</td>`;
      sh += `<td style="text-align:right;padding:3px;${alcvClr}">${alcvStr}</td>`;
      sh += `<td style="text-align:right;padding:3px;color:var(--text2);">${c.lcv.toFixed(1)}</td>`;
      sh += `<td style="text-align:center;padding:3px;">${keepStr}</td>`;
      sh += `<td style="text-align:right;padding:3px;font-weight:600;color:var(--accent);">${c.score.toFixed(1)}</td>`;
      sh += '</tr>';
    });
    sh += '</table>';
    sugPanel.innerHTML = sh;

    // Wire click-to-add
    sugPanel.querySelectorAll('.trade-suggest-row').forEach(row => {
      row.addEventListener('click', () => {
        const nm = decodeURIComponent(row.dataset.name);
        if (!(state._tradeGet||[]).includes(nm)) {
          state._tradeGet.push(nm);
          // Re-render the "I Get" list
          const listDiv = document.getElementById('tradeGetList');
          if (listDiv) {
            listDiv.innerHTML = state._tradeGet.map(n => tradePlayerTag(n)).join('');
            listDiv.querySelectorAll('.trade-remove').forEach(btn => {
              btn.addEventListener('click', () => {
                const n2 = decodeURIComponent(btn.dataset.name);
                const idx = state._tradeGet.indexOf(n2); if (idx >= 0) state._tradeGet.splice(idx, 1);
                // Re-trigger full re-render by calling wireTradeInput pattern
                listDiv.innerHTML = state._tradeGet.map(n3 => tradePlayerTag(n3)).join('');
                updateTradeSummary();
              });
            });
          }
          updateTradeSummary();
          renderSuggestions(); // refresh to remove added player
        }
      });
    });
  }

  updateTradeSummary();

  // ── Trade Goals wiring ──
  if (!state._tradeGoals) state._tradeGoals = [];
  section.querySelectorAll('.trade-goal-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const goal = btn.dataset.goal;
      const idx = state._tradeGoals.indexOf(goal);
      if (idx >= 0) { state._tradeGoals.splice(idx, 1); btn.style.background = ''; btn.style.color = ''; btn.style.borderColor = ''; }
      else { state._tradeGoals.push(goal); btn.style.background = 'var(--accent2)'; btn.style.color = '#fff'; btn.style.borderColor = 'var(--accent2)'; }
    });
  });

  // ── Trade Generator wiring ──
  const tgPanel = document.getElementById('tradeGenPanel');
  const tgBtn = document.getElementById('tradeGenBtn');
  if (tgBtn && tgPanel) {
    tgBtn.addEventListener('click', () => {
      if ((state._tradeGoals || []).length === 0) {
        tgPanel.innerHTML = '<div style="font-size:11px;color:var(--red);padding:4px;">Select at least one position or stat category to find relevant trades.</div>';
        return;
      }
      tgPanel.innerHTML = '<div style="font-size:11px;color:var(--text2);padding:4px;">Generating trade ideas...</div>';
      setTimeout(() => generateTradeIdeas(tgPanel, state._tradeGoals), 50);
    });
  }

  function generateTradeIdeas(panel, goals) {
    // Parse goals into position targets and stat targets
    const goalPositions = new Set((goals || []).filter(g => g.startsWith('pos:')).map(g => g.slice(4)));
    const goalStats = new Set((goals || []).filter(g => g.startsWith('stat:')).map(g => g.slice(5)));
    // Map stat goals to relevant player positions/attributes
    const statPosMap = {
      'hr': ['1B','3B','RF','LF','CF'], 'sb': ['SS','2B','CF','LF','RF'],
      'avg': ['SS','2B','CF','RF','1B','LF','3B'], 'rbi': ['1B','3B','RF','LF'],
      'so': ['SP','RP'], 'sv': ['RP'], 'era': ['SP','RP'], 'qs': ['SP']
    };
    // Expand stat goals to relevant positions for scoring
    const expandedGoalPositions = new Set(goalPositions);
    goalStats.forEach(stat => { (statPosMap[stat] || []).forEach(p => expandedGoalPositions.add(p)); });

    // Scoring helper: how well does a player match goals?
    function goalFit(prof) {
      let fit = 0;
      // Position match
      if (goalPositions.has(prof.primaryPos)) fit += 3.0;
      prof.positions.forEach(pos => { if (goalPositions.has(pos)) fit += 1.5; });
      // Stat match
      goalStats.forEach(stat => {
        if (stat === 'hr' && !prof.isPit && (prof.p.hr || prof.p.s25_hr || 0) >= 15) fit += 2.0;
        if (stat === 'sb' && !prof.isPit && (prof.p.sb || prof.p.s25_sb || 0) >= 10) fit += 2.0;
        if (stat === 'avg' && !prof.isPit && (prof.p.avg || prof.p.s25_avg || 0) >= 0.275) fit += 1.5;
        if (stat === 'rbi' && !prof.isPit && (prof.p.rbi || prof.p.s25_rbi || 0) >= 60) fit += 1.5;
        if (stat === 'so' && prof.isPit && (prof.p.so || prof.p.s25_so || 0) >= 100) fit += 2.0;
        if (stat === 'sv' && prof.isPit && (prof.p.sv || prof.p.s25_sv || 0) >= 5) fit += 3.0;
        if (stat === 'era' && prof.isPit && (prof.p.era || prof.p.s25_era || 9) <= 3.80) fit += 1.5;
        if (stat === 'qs' && prof.primaryPos === 'SP' && (prof.p.qs || prof.p.s25_qs || 0) >= 10) fit += 2.0;
      });
      return fit;
    }
    // ── Untouchable players — franchise cornerstones, never trade ──
    const UNTOUCHABLE = new Set(__UNTOUCHABLE_JSON__);

    // ── 1. Build full player profiles for every rostered player ──
    function profile(name) {
      const p = _plyrI(name);
      if (!p) return null;
      const ki = getKeeperInfoCached(name);
      const pr = findProspect(name);
      const positions = (p.pos || p.primaryPos || '').split('/').filter(x => x);
      const isPit = ['SP','RP'].includes(p.primaryPos);
      return {
        name, p, ki, pr, positions, isPit,
        lcv: p.lcv || 0,
        pnav: p.pnav || 0,
        // aLCV / aLCVPlus: current-season actual value (raw + wRC+-scale).
        // recScore / recScorePlus: blended recommendation (raw + wRC+-scale).
        alcv: p.actualLcv,
        alcvPlus: p.aLCVPlus,
        recScore: p.recScore,
        recScorePlus: p.recScorePlus,
        primaryPos: p.primaryPos,
        keepable: ki.keepable2027,
        cost2027: ki.cost2027,
        yearsLeft: ki.yearsLeft || 0,
        surplusNow: ki.surplusNow || 0,
        multiYearSurplus: ki.multiYearSurplus || 0,
        prospectVal: pr ? Math.max(0, ((pr.fv||0) - 40) * 0.15) : 0,
      };
    }

    // Composite trade value: production-first, keeper premium only when surplus justifies the slot.
    // "thisYear" now blends projected LCV with actual in-season aLCV so hot/cold starts
    // move trade value appropriately rather than waiting for projections to stale-update.
    function tradeVal(prof) {
      const projLcv = prof.lcv;
      const alcv = (prof.alcv != null) ? prof.alcv : null;
      // Blend: 60% aLCV, 40% projected LCV when we have in-season data; otherwise pure projection.
      const thisYear = alcv != null ? (0.6 * alcv + 0.4 * projLcv) : projLcv;
      const prospVal = prof.prospectVal;
      // Non-keepable: rental value = current production (elite players still command big returns)
      if (!prof.keepable) return thisYear * 0.8 + prospVal;
      // Keepable: blend production + keeper premium
      // Only count MYS premium if surplus is meaningfully positive (prevents marginal keepers from inflating)
      const mys = prof.multiYearSurplus || 0;
      const effectiveMYS = mys > 1.0 ? mys : mys * 0.3;
      return thisYear * 0.5 + Math.max(0, effectiveMYS) * 1.0 + prospVal + (prof.yearsLeft >= 2 && mys > 1.0 ? prof.yearsLeft * 0.3 : 0);
    }

    // ── 2. Build roster profiles ──
    const myRoster = (state.myTeam || []).map(profile).filter(Boolean);
    const myAssign3 = computeNeedsForTeam(myRoster.map(x => x.p));

    // Position depth & assignments
    const myPosDepth = {};
    const myPlayerPos = {};
    for (const [pos, players] of Object.entries(myAssign3)) {
      myPosDepth[pos] = (players || []).length;
      (players || []).forEach(p => { myPlayerPos[p.name] = pos; });
    }

    // ── 3. Positional need scoring (vs league average) ──
    function posNeeds(roster, assign) {
      const needs = {};
      for (const [pos, slots] of Object.entries(ROSTER_SLOTS)) {
        const myTop = assign[pos] || [];
        const myAvg = myTop.length > 0 ? myTop.reduce((s,p) => s + (p.lcv||0), 0) / Math.max(myTop.length, slots) : 0;
        // Compare to league median at this position
        const leagueAvgs = [];
        LEAGUE_TEAMS.forEach(t => {
          const r = t.mine ? (state.myTeam||[]) : (state.leagueTeams[t.name]||[]);
          const pl = r.map(n => _plyrI(n)).filter(Boolean);
          const a = computeNeedsForTeam(pl);
          const top = a[pos] || [];
          if (top.length > 0) leagueAvgs.push(top.reduce((s,p)=>s+(p.lcv||0),0)/Math.max(top.length, slots));
        });
        leagueAvgs.sort((a,b) => a - b);
        const median = leagueAvgs.length > 0 ? leagueAvgs[Math.floor(leagueAvgs.length/2)] : 0;
        needs[pos] = myAvg - median; // negative = I'm below median = I need this
      }
      return needs;
    }

    const myNeeds = posNeeds(myRoster, myAssign3);

    // ── 4. Classify each of my players: tradeable or not ──
    function canTrade(prof) {
      if (UNTOUCHABLE.has(prof.name)) return false;
      if (prof.lcv < 0.5) return false; // not worth discussing
      // Can't trade if it empties a starting slot
      const assignedPos = myPlayerPos[prof.name];
      if (assignedPos) {
        const required = ROSTER_SLOTS[assignedPos] || 1;
        if (myPosDepth[assignedPos] <= required) return false;
      }
      return true;
    }

    // ── 5. For each other team, find mutually beneficial trades ──
    const trades = [];

    LEAGUE_TEAMS.filter(t => !t.mine).forEach(t => {
      const theirNames = state.leagueTeams[t.name] || [];
      if (theirNames.length < 3) return;
      const theirRoster = theirNames.map(profile).filter(Boolean);
      const theirAssign = computeNeedsForTeam(theirRoster.map(x => x.p));
      const theirNeeds = posNeeds(theirRoster, theirAssign);
      const ownerName = t.owner || t.name;

      // Their position depth for trade feasibility
      const theirPosDepth = {};
      const theirPlayerPos = {};
      for (const [pos, players] of Object.entries(theirAssign)) {
        theirPosDepth[pos] = (players || []).length;
        (players || []).forEach(p => { theirPlayerPos[p.name] = pos; });
      }

      // Score how much I WANT each of their players
      // Rank their entire roster by LCV — a team's top players are never realistically available.
      // In a 12-team keeper league, nobody trades their top ~5 guys. Target the mid-tier instead.
      const theirByLcv = [...theirRoster].sort((a,b) => (b.lcv||0) - (a.lcv||0));
      const theirTopNames = new Set(theirByLcv.slice(0, 5).map(p => p.name));

      // Max TV I can offer
      const myTradeableTV = myRoster.filter(canTrade).map(p => tradeVal(p)).sort((a,b) => b - a);
      const myBest1TV = myTradeableTV[0] || 0;

      const theirAvailable = theirRoster.filter(prof => {
        if (UNTOUCHABLE.has(prof.name)) return false;
        if (prof.lcv < 0.5) return false;
        // Their top 5 players by LCV are realistically untradeable
        if (theirTopNames.has(prof.name)) return false;
        // They can't trade if it empties a starting slot
        const ap = theirPlayerPos[prof.name];
        if (ap) {
          const required = ROSTER_SLOTS[ap] || 1;
          if (theirPosDepth[ap] <= required) return false;
        }
        // TV ceiling: target's TV shouldn't exceed my best single piece by too much
        // (realistic 1-for-1 or slight overpay territory only)
        const targetTV = tradeVal(prof);
        if (targetTV > myBest1TV + 2.5) return false;
        return true;
      }).map(prof => {
        // How much does this player help ME?
        let bestNeedHelp = 0;
        let bestNeedPos = '';
        prof.positions.forEach(pos => {
          if (pos === 'DH') return;
          const need = myNeeds[pos];
          if (need !== undefined && need < 0 && -need > bestNeedHelp) {
            bestNeedHelp = -need; bestNeedPos = pos;
          }
        });
        // Upgrade bonus: even if I'm above average at a position, this player might
        // upgrade my starter or bench at that position
        let upgradeBonus = 0;
        let upgradePos = '';
        prof.positions.forEach(pos => {
          if (pos === 'DH') return;
          const myAtPos = (myAssign3[pos] || []);
          if (myAtPos.length === 0) return;
          // Compare to my weakest player at this position (starter or bench)
          const myWorstLcv = Math.min(...myAtPos.map(p => p.lcv || 0));
          const uplift = prof.lcv - myWorstLcv;
          if (uplift > 0.5 && uplift > upgradeBonus) {
            upgradeBonus = uplift;
            upgradePos = pos;
          }
        });
        // If this player matches a goal position, boost the upgrade bonus
        const isGoalPos = prof.positions.some(p => goalPositions.has(p));
        if (isGoalPos) upgradeBonus *= 1.5;

        // Keeper upside bonus: if they're very keepable and I can benefit
        const keeperBonus = prof.keepable ? prof.yearsLeft * 0.4 + Math.max(0, prof.multiYearSurplus) * 0.3 : 0;
        const gf = goalFit(prof);
        // recScore boost: players with strong blended scores (60% aLCV) are more desirable,
        // even if they don't fill a strict positional need.
        const rec = prof.recScore != null ? prof.recScore : 0;
        const recBonus = Math.max(-0.3, Math.min(2.5, rec * 1.3));
        // wantScore driven by need fit + goals + recScore
        const wantScore = bestNeedHelp * 2.0 + upgradeBonus * 0.8 + keeperBonus + gf * 1.5 + recBonus;
        return { ...prof, wantScore, goalFit: gf, helpPos: bestNeedPos || upgradePos, needHelp: Math.max(bestNeedHelp, upgradeBonus * 0.5), tv: tradeVal(prof) };
      }).filter(x => {
        // When goals are specified, strongly prefer players that match at least one goal
        if (goalPositions.size > 0 || goalStats.size > 0) return x.goalFit > 0 || x.wantScore > 2.0;
        return x.wantScore > 0.1;
      }).sort((a,b) => b.wantScore - a.wantScore);

      // Score how much THEY want each of my players
      const myAvailable = myRoster.filter(canTrade).map(prof => {
        let bestNeedHelp = 0;
        let bestNeedPos = '';
        prof.positions.forEach(pos => {
          if (pos === 'DH') return;
          const need = theirNeeds[pos];
          if (need !== undefined && need < 0 && -need > bestNeedHelp) {
            bestNeedHelp = -need; bestNeedPos = pos;
          }
        });
        // Sell signal: if I can't keep this player but they can benefit from them
        const sellBonus = !prof.keepable ? prof.lcv * 0.3 : 0;
        // Surplus signal: position where I'm strong
        const surplusBonus = (myNeeds[myPlayerPos[prof.name]] || 0) > 0.2 ? 1.0 : 0;
        return { ...prof, theyWantScore: bestNeedHelp * 2.0 + sellBonus + surplusBonus + prof.lcv * 0.15, helpsThemPos: bestNeedPos, theirNeedHelp: bestNeedHelp, tv: tradeVal(prof) };
      }).filter(x => x.theyWantScore > 0.1).sort((a,b) => b.theyWantScore - a.theyWantScore);

      if (myAvailable.length === 0 || theirAvailable.length === 0) return;

      // ── 1-for-1 trades ──
      for (const give of myAvailable.slice(0, 12)) {
        for (const get of theirAvailable.slice(0, 12)) {
          if (give.name === get.name) continue;
          // Allow same-position swaps if the get player is a goal-matched upgrade
          if (give.primaryPos === get.primaryPos) {
            const isGoalPos = goalPositions.has(get.primaryPos) || get.positions.some(p => goalPositions.has(p));
            const isUpgrade = get.lcv > give.lcv;
            if (!isGoalPos || !isUpgrade) continue; // block lateral same-pos trades unless goal upgrade
          }

          const tvDiff = get.tv - give.tv;
          const lcvDiff = get.lcv - give.lcv;

          // Fairness gate: trade value should be roughly balanced (allow slight overpay to fill needs)
          if (tvDiff < -3.0 || tvDiff > 3.5) continue;
          if (lcvDiff < -4.0) continue; // don't take a massive current-year hit

          // Quality gate: at least one side should meaningfully help a need
          if (get.needHelp < 0.05 && give.theirNeedHelp < 0.05) continue;

          // Mutual benefit score
          const needFit = get.needHelp + give.theirNeedHelp;
          const valueFavor = Math.min(tvDiff, 3) * 0.5; // slight bonus if we win on value, capped

          // Keeper arbitrage bonus: giving non-keepable, getting keepable
          let keeperArb = 0;
          if (!give.keepable && get.keepable) keeperArb += 1.5;
          if (get.keepable && get.yearsLeft >= 2) keeperArb += 0.5;

          // Cross-group bonus (bat↔pit trades are more impactful)
          const crossGroup = give.isPit !== get.isPit ? 0.8 : 0;

          const getGoalBonus = (get.goalFit || 0) * 2.0;
          const score = needFit * 1.5 + Math.max(0, valueFavor) + keeperArb + crossGroup + getGoalBonus;

          // Skip trades that don't match goals when goals are specified
          if ((goalPositions.size > 0 || goalStats.size > 0) && (get.goalFit || 0) < 0.5) continue;

          // Build rationale context
          const giveNeedHelp = give.theirNeedHelp || 0;
          const getNeedHelp = get.needHelp || 0;
          trades.push({
            team: ownerName, teamName: t.name,
            give: [{ name: give.name, lcv: give.lcv, tv: give.tv, primaryPos: give.primaryPos, keepable: give.keepable, yearsLeft: give.yearsLeft, helpPos: give.helpsThemPos || give.primaryPos, theirNeedHelp: giveNeedHelp }],
            get: [{ name: get.name, lcv: get.lcv, tv: get.tv, primaryPos: get.primaryPos, keepable: get.keepable, yearsLeft: get.yearsLeft, helpPos: get.helpPos || get.primaryPos, myNeedHelp: getNeedHelp }],
            score, type: '1-for-1',
            reason: (get.goalFit || 0) > 0.5 ? 'matches goal' : getNeedHelp > 0.3 ? 'fills need' : keeperArb > 0 ? 'keeper arb' : 'value',
            _myNeeds: { ...myNeeds }, _theirNeeds: { ...theirNeeds },
          });
        }
      }

      // ── Helper to build a trade entry ──
      function mkEntry(prof, isGive) {
        return { name: prof.name, lcv: prof.lcv, tv: prof.tv, primaryPos: prof.primaryPos, keepable: prof.keepable, yearsLeft: prof.yearsLeft, helpPos: (isGive ? (prof.helpsThemPos || prof.primaryPos) : (prof.helpPos || prof.primaryPos)), theirNeedHelp: isGive ? (prof.theirNeedHelp||0) : 0, myNeedHelp: isGive ? 0 : (prof.needHelp||0) };
      }

      // ── Helper: check no two give players share an assigned position ──
      function giveOk(giveList) {
        const posSet = new Set();
        for (const g of giveList) {
          const ap = myPlayerPos[g.name];
          if (ap) { if (posSet.has(ap)) return false; posSet.add(ap); }
        }
        // Also no two same primaryPos
        const ppSet = new Set();
        for (const g of giveList) { if (ppSet.has(g.primaryPos)) return false; ppSet.add(g.primaryPos); }
        return true;
      }

      // ── Multi-player trade generator (handles 1-for-1 through 3-for-1, 2-for-2, etc.) ──
      // Generate give-side combos (1, 2, or 3 players)
      const giveCombos = [];
      const gSlice = myAvailable.slice(0, 10);
      // Singles
      gSlice.forEach(g => giveCombos.push([g]));
      // Pairs
      for (let i = 0; i < gSlice.length; i++)
        for (let j = i+1; j < gSlice.length; j++)
          if (giveOk([gSlice[i], gSlice[j]])) giveCombos.push([gSlice[i], gSlice[j]]);
      // Triples
      for (let i = 0; i < Math.min(gSlice.length, 6); i++)
        for (let j = i+1; j < Math.min(gSlice.length, 7); j++)
          for (let k = j+1; k < Math.min(gSlice.length, 8); k++)
            if (giveOk([gSlice[i], gSlice[j], gSlice[k]])) giveCombos.push([gSlice[i], gSlice[j], gSlice[k]]);

      // Generate get-side combos (1, 2, or 3 players)
      const getCombos = [];
      const rSlice = theirAvailable.slice(0, 10);
      rSlice.forEach(r => getCombos.push([r]));
      for (let i = 0; i < rSlice.length; i++)
        for (let j = i+1; j < rSlice.length; j++)
          if (rSlice[i].primaryPos !== rSlice[j].primaryPos) getCombos.push([rSlice[i], rSlice[j]]);
      for (let i = 0; i < Math.min(rSlice.length, 6); i++)
        for (let j = i+1; j < Math.min(rSlice.length, 7); j++)
          for (let k = j+1; k < Math.min(rSlice.length, 8); k++) {
            const pp = new Set([rSlice[i].primaryPos, rSlice[j].primaryPos, rSlice[k].primaryPos]);
            if (pp.size >= 2) getCombos.push([rSlice[i], rSlice[j], rSlice[k]]);
          }

      // Evaluate all give×get combos
      for (const gCombo of giveCombos) {
        for (const rCombo of getCombos) {
          // Total players in trade: 2-6 (skip 1-for-0 or 0-for-1)
          const total = gCombo.length + rCombo.length;
          if (total < 2 || total > 6) continue;
          // No overlapping names
          const gNames = new Set(gCombo.map(g => g.name));
          if (rCombo.some(r => gNames.has(r.name))) continue;

          const giveTv = gCombo.reduce((s,g) => s + g.tv, 0);
          const getTv = rCombo.reduce((s,r) => s + r.tv, 0);
          const giveLcv = gCombo.reduce((s,g) => s + g.lcv, 0);
          const getLcv = rCombo.reduce((s,r) => s + r.lcv, 0);
          const tvDiff = getTv - giveTv;
          const lcvDiff = getLcv - giveLcv;

          // Fairness: scale limits by trade size
          const maxNeg = -2.0 * Math.max(gCombo.length, rCombo.length);
          const maxPos = 4.0 * Math.max(gCombo.length, rCombo.length);
          if (tvDiff < maxNeg || tvDiff > maxPos) continue;
          if (lcvDiff < maxNeg * 2) continue;

          // For uneven trades (2-for-1, 3-for-1), the "1" side should be a clearly better player
          if (gCombo.length > rCombo.length) {
            // I'm giving more pieces for fewer better ones
            const bestGet = Math.max(...rCombo.map(r => r.lcv));
            const bestGive = Math.max(...gCombo.map(g => g.lcv));
            if (bestGet <= bestGive) continue; // no point giving more for less
          }
          if (rCombo.length > gCombo.length) {
            // I'm getting more pieces for fewer — I should be giving a star
            const bestGive = Math.max(...gCombo.map(g => g.lcv));
            const bestGet = Math.max(...rCombo.map(r => r.lcv));
            if (bestGive <= bestGet) continue;
          }

          const needFit = rCombo.reduce((s,r) => s + (r.needHelp||0), 0) + gCombo.reduce((s,g) => s + (g.theirNeedHelp||0), 0);
          if (needFit < 0.1 && total > 2) continue;

          const valueFavor = Math.min(tvDiff, 4) * 0.4;
          let keeperArb = 0;
          gCombo.forEach(g => { if (!g.keepable) keeperArb += 0.4; });
          rCombo.forEach(r => { if (r.keepable && r.yearsLeft >= 2) keeperArb += 0.4; });
          const isPitSet = new Set([...gCombo.map(g => g.isPit), ...rCombo.map(r => r.isPit)]);
          const crossGroup = isPitSet.size > 1 ? 0.6 : 0;

          // Slight penalty for larger trades (harder to pull off in practice)
          const sizePenalty = total > 3 ? (total - 3) * 0.3 : 0;

          // Goal-based scoring for multi-player trades
          const multiGoalBonus = rCombo.reduce((s,r) => s + (r.goalFit || 0), 0) * 1.5;
          // Skip multi-player trades that don't match goals when goals specified
          if ((goalPositions.size > 0 || goalStats.size > 0) && multiGoalBonus < 0.5) continue;

          const score = needFit * 1.3 + Math.max(0, valueFavor) + keeperArb + crossGroup - sizePenalty + multiGoalBonus;

          const label = `${gCombo.length}-for-${rCombo.length}`;
          const reason = multiGoalBonus > 1.0 ? 'matches goal' : rCombo.some(r => r.needHelp > 0.3) ? 'fills need' : keeperArb > 0.5 ? 'keeper arb' : gCombo.length !== rCombo.length ? 'consolidate' : 'value';

          trades.push({
            team: ownerName, teamName: t.name,
            give: gCombo.map(g => mkEntry(g, true)),
            get: rCombo.map(r => mkEntry(r, false)),
            score, type: label, reason,
            _myNeeds: { ...myNeeds }, _theirNeeds: { ...theirNeeds },
          });
        }
      }
    });

    // ── 6. Compute draft pick info ──
    const sim = simulateDraft();
    const myTeamObj = LEAGUE_TEAMS.find(t => t.mine);
    const myOpenRds = sim.teamOpenRds[myTeamObj.name] || 0;
    const myPickRds = (sim.teamResults[myTeamObj.name] || []).map(p => p.round).sort((a,b) => a - b);

    // ── 7. Rank, deduplicate, and display ──
    // Sort by complexity first (fewer total players = simpler), then by score within each tier
    trades.sort((a,b) => {
      const aSize = a.give.length + a.get.length;
      const bSize = b.give.length + b.get.length;
      if (aSize !== bSize) return aSize - bSize; // simpler first
      return b.score - a.score; // then best score
    });
    const seen = new Set();
    const unique = [];
    // Also limit to max 3 trades per partner to get variety
    const perTeam = {};
    for (const tr of trades) {
      const key = [...tr.give.map(g=>g.name), '|', ...tr.get.map(g=>g.name)].sort().join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      perTeam[tr.teamName] = (perTeam[tr.teamName]||0) + 1;
      if (perTeam[tr.teamName] > 3) continue;
      unique.push(tr);
      if (unique.length >= 20) break;
    }

    if (unique.length === 0) {
      panel.innerHTML = '<div style="font-size:11px;color:var(--text2);padding:4px;">No trade ideas found. This can happen if rosters are incomplete or positions are evenly matched.</div>';
      return;
    }

    let th = '<div style="max-height:500px;overflow-y:auto;">';
    th += '<div style="padding:6px 8px;background:var(--surface2);border-radius:4px;margin-bottom:8px;font-size:10px;color:var(--text2);">';
    th += `<b>Your open picks:</b> ${myPickRds.length > 0 ? myPickRds.map(r => 'Rd ' + r).join(', ') : 'None'}`;
    th += ' — consider including a pick as a sweetener if the value gap is close.';
    th += '</div>';

    let lastTier = 0;
    unique.forEach((tr, idx) => {
      // Tier header when complexity changes
      const tier = tr.give.length + tr.get.length;
      if (tier !== lastTier) {
        const tierLabel = tier === 2 ? 'Straight-Up Swaps (1-for-1)' : tier === 3 ? '2-for-1 Trades' : `Multi-Player Trades (${tier} players)`;
        th += `<div style="padding:6px 8px 3px;font-weight:700;font-size:11px;color:var(--text2);border-bottom:2px solid var(--border);margin-top:${lastTier ? '8px' : '0'};">${tierLabel}</div>`;
        lastTier = tier;
      }
      // Rich display with keeper info
      function playerTag(g, color) {
        const keepTag = g.keepable
          ? `<span style="color:var(--green);font-size:8px;margin-left:2px;" title="${g.yearsLeft}yr control">K${g.yearsLeft}</span>`
          : `<span style="color:var(--red);font-size:8px;margin-left:2px;" title="Not keepable">NK</span>`;
        return `<span style="color:${color};font-weight:600;">${g.name}</span> <span style="color:var(--text2);font-size:9px;">${g.primaryPos} ${g.lcv.toFixed(1)}</span>${keepTag}`;
      }

      const giveStr = tr.give.map(g => playerTag(g, 'var(--red)')).join(' + ');
      const getStr = tr.get.map(g => playerTag(g, 'var(--green)')).join(' + ');
      const giveTv = tr.give.reduce((s,g) => s + g.tv, 0);
      const getTv = tr.get.reduce((s,g) => s + g.tv, 0);
      const diff = getTv - giveTv;
      const diffClr = diff > 0 ? 'var(--green)' : diff < -0.5 ? 'var(--red)' : 'var(--text2)';
      const badge = tr.type !== '1-for-1' ? `<span style="background:var(--accent2);color:#fff;padding:0 4px;border-radius:3px;font-size:9px;margin-left:4px;">${tr.type}</span>` : '';

      // Draft pick sweetener suggestion
      const theirPickRds = (sim.teamResults[tr.teamName] || []).map(p => p.round).sort((a,b) => a - b);
      const theirOpenRds = sim.teamOpenRds[tr.teamName] || 0;
      let pickNote = '';
      if (diff < -0.3 && myPickRds.length > 0) {
        const sweetener = myPickRds.find(r => r >= 10) || myPickRds[myPickRds.length - 1];
        pickNote = `<span style="font-size:9px;color:var(--accent);"> + offer your Rd ${sweetener} pick</span>`;
      } else if (diff > 1.5 && theirPickRds.length > 0) {
        const askPick = theirPickRds.find(r => r >= 10) || theirPickRds[theirPickRds.length - 1];
        pickNote = `<span style="font-size:9px;color:var(--accent);"> + ask for their Rd ${askPick} pick</span>`;
      }

      // Reason tag
      const reasonTag = tr.reason === 'keeper arb' ? '<span style="font-size:8px;background:var(--green);color:#fff;padding:0 3px;border-radius:2px;margin-left:4px;">KEEPER ARB</span>'
        : tr.reason === 'fills need' ? '<span style="font-size:8px;background:var(--accent);color:#fff;padding:0 3px;border-radius:2px;margin-left:4px;">FILLS NEED</span>'
        : tr.reason === 'consolidate' ? '<span style="font-size:8px;background:var(--accent2);color:#fff;padding:0 3px;border-radius:2px;margin-left:4px;">CONSOLIDATE</span>'
        : tr.reason === 'matches goal' ? '<span style="font-size:8px;background:#e67e22;color:#fff;padding:0 3px;border-radius:2px;margin-left:4px;">MATCHES GOAL</span>' : '';

      // ── Generate rationale sentences ──
      // Why YOU should make this trade
      const myReasons = [];
      const getKeepable = tr.get.filter(g => g.keepable);
      const giveNonKeepable = tr.give.filter(g => !g.keepable);
      // Positional needs filled
      const getPositions = [...new Set(tr.get.map(g => g.helpPos).filter(p => p && tr._myNeeds && tr._myNeeds[p] < -0.1))];
      if (getPositions.length > 0) myReasons.push(`fills your need at ${getPositions.join('/')}`);
      // Keeper arbitrage
      if (giveNonKeepable.length > 0 && getKeepable.length > 0) {
        const bestKeep = getKeepable.sort((a,b) => b.yearsLeft - a.yearsLeft)[0];
        myReasons.push(`converts expiring asset${giveNonKeepable.length > 1 ? 's' : ''} into ${bestKeep.yearsLeft}yr keeper value`);
      } else if (getKeepable.length > 0 && getKeepable.some(g => g.yearsLeft >= 3)) {
        myReasons.push(`adds long-term keeper control (${getKeepable.map(g => g.yearsLeft + 'yr').join(', ')})`);
      }
      // LCV upgrade
      const getLcvTotal = tr.get.reduce((s,g) => s + g.lcv, 0);
      const giveLcvTotal = tr.give.reduce((s,g) => s + g.lcv, 0);
      if (getLcvTotal > giveLcvTotal + 1) myReasons.push(`net +${(getLcvTotal - giveLcvTotal).toFixed(1)} LCV this season`);
      // Cross-group
      const giveIsPit = tr.give.some(g => ['SP','RP'].includes(g.primaryPos));
      const getIsPit = tr.get.some(g => ['SP','RP'].includes(g.primaryPos));
      if (giveIsPit !== getIsPit) myReasons.push(getIsPit ? 'adds pitching depth' : 'adds hitting depth');
      // Consolidation
      if (tr.give.length > tr.get.length) myReasons.push(`consolidates ${tr.give.length} roster spots into ${tr.get.length}`);
      if (myReasons.length === 0) myReasons.push('improves overall roster value');
      const myRationale = myReasons.slice(0, 2).join(' and ');

      // Why THEY would accept
      const theirReasons = [];
      const giveKeepable = tr.give.filter(g => g.keepable);
      // Their positional needs filled
      const givePositions = [...new Set(tr.give.map(g => g.helpPos).filter(p => p && tr._theirNeeds && tr._theirNeeds[p] < -0.1))];
      if (givePositions.length > 0) theirReasons.push(`fills their gap at ${givePositions.join('/')}`);
      // They get more pieces
      if (tr.get.length > tr.give.length) theirReasons.push(`gets ${tr.get.length} pieces for ${tr.give.length} — adds roster depth`);
      // They get keeper value
      if (giveKeepable.length > 0) {
        const bestGive = giveKeepable.sort((a,b) => b.yearsLeft - a.yearsLeft)[0];
        if (bestGive.yearsLeft >= 2) theirReasons.push(`gains keeper-eligible player (${bestGive.yearsLeft}yr control)`);
      }
      // They get higher LCV in return
      if (giveLcvTotal > getLcvTotal + 1) theirReasons.push(`net +${(giveLcvTotal - getLcvTotal).toFixed(1)} LCV for their roster`);
      // Cross-group from their perspective
      if (giveIsPit !== getIsPit) theirReasons.push(giveIsPit ? 'gets pitching they need' : 'gets hitting they need');
      if (theirReasons.length === 0) theirReasons.push('balances their roster composition');
      const theirRationale = theirReasons.slice(0, 2).join(' and ');

      th += `<div style="padding:8px;border-bottom:1px solid var(--border);${idx === 0 ? 'background:rgba(74,107,255,0.04);' : ''}">`;
      th += `<div style="font-size:10px;color:var(--text2);margin-bottom:3px;">Trade with <b>${tr.team}</b> <span style="font-size:9px;">(${theirOpenRds} open picks)</span>${badge}${reasonTag}</div>`;
      th += `<div style="font-size:11px;margin-bottom:2px;">Give: ${giveStr}</div>`;
      th += `<div style="font-size:11px;margin-bottom:2px;">Get: ${getStr}${pickNote}</div>`;
      th += `<div style="font-size:10px;color:var(--text2);">TV: ${giveTv.toFixed(1)} → ${getTv.toFixed(1)} <span style="color:${diffClr};font-weight:600;">(${diff > 0 ? '+' : ''}${diff.toFixed(1)})</span></div>`;
      th += `<div style="font-size:10px;margin-top:3px;line-height:1.4;"><span style="color:var(--green);">You:</span> <span style="color:var(--text2);">${myRationale}.</span></div>`;
      th += `<div style="font-size:10px;line-height:1.4;"><span style="color:var(--accent);">${tr.team.split(' ')[0]}:</span> <span style="color:var(--text2);">${theirRationale}.</span></div>`;
      th += '</div>';
    });
    th += '</div>';
    panel.innerHTML = th;
  }
  }
}

// ── Draft log view ────────────────────────────────────────────────────────
function renderDraftLog() {
  const section = document.getElementById('rosterSection');
  const entries = Object.entries(state.drafted).sort((a,b) => a[1].time - b[1].time);
  let html = '<h2 style="margin-bottom:8px;">Draft Log</h2>';
  html += '<p style="font-size:12px;color:var(--text2);margin-bottom:12px;">Live record of all drafted players (keepers + draft picks). Use the draft bar above on any tab to mark players as drafted. Click <b>Undo</b> to remove a pick. The player tables, Draft Capital, and Mock Draft all update automatically.</p>';
  html += '<table><thead><tr><th style="width:40px">#</th><th>Player</th><th>Team</th><th>Pos</th><th>Rd</th><th>LCV</th><th>Pick</th><th>Mine</th><th></th></tr></thead><tbody>';
  entries.forEach(([name, info], i) => {
    const p = _plyrI(name);
    const rd = state.keeperRounds && state.keeperRounds[name];
    html += `<tr><td>${i+1}</td><td style="font-weight:600">${name}</td><td>${p?p.team:''}</td><td>${p?p.primaryPos:''}</td><td style="color:var(--accent)">${rd||''}</td><td>${p?(p.lcv).toFixed(2):''}</td><td>${p?(p.dp).toFixed(2):''}</td><td>${info.mine?'<span style="color:var(--green)">Yes</span>':''}</td><td><button class="btn btn-secondary undo-btn" style="padding:2px 8px;font-size:11px;" data-name="${encodeURIComponent(name)}">Undo</button></td></tr>`;
  });
  html += '</tbody></table>';
  section.innerHTML = html;
  section.querySelectorAll('.undo-btn').forEach(btn => {
    btn.addEventListener('click', () => undraftPlayer(decodeURIComponent(btn.dataset.name)));
  });
  section.style.display = '';
  document.getElementById('tableWrap').style.display = 'none';
}

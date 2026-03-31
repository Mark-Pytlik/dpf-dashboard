// ── League comparison view ────────────────────────────────────────────────
function calcOptimalLCV(playerNames) {
  // Given a list of player names, compute the best possible starting lineup LCV
  // by assigning players to roster slots optimally
  const players = playerNames.map(n => _plyrI(n)).filter(Boolean);
  const batters = players.filter(p => !['SP','RP'].includes(p.primaryPos));
  const sps = players.filter(p => p.primaryPos === 'SP');
  const rps = players.filter(p => p.primaryPos === 'RP');
  // Add dual-eligible players (e.g., Ohtani) to pitcher pool too
  players.forEach(p => {
    const dualPos = DUAL_ELIGIBLE[p.name];
    if (dualPos === 'SP' && !sps.includes(p)) sps.push(p);
    else if (dualPos === 'RP' && !rps.includes(p)) rps.push(p);
  });

  // Sort each pool by LCV descending
  batters.sort((a,b) => (b.lcv||0) - (a.lcv||0));
  sps.sort((a,b) => (b.lcv||0) - (a.lcv||0));
  rps.sort((a,b) => (b.lcv||0) - (a.lcv||0));

  // Greedy assignment for batting positions
  const batSlots = ['C','1B','2B','3B','SS','LF','CF','RF','DH'];
  const filled = {};
  const used = new Set();

  // Pass 1: assign best player to each position by primary pos
  for (const slot of batSlots) {
    if (slot === 'DH') continue; // fill DH last
    const best = batters.find(p => p.primaryPos === slot && !used.has(p.name));
    if (best) { filled[slot] = best; used.add(best.name); }
  }

  // Pass 2: try multi-position eligibility for empty slots
  for (const slot of batSlots) {
    if (slot === 'DH' || filled[slot]) continue;
    const best = batters.find(p => {
      if (used.has(p.name)) return false;
      const positions = (p.pos || p.primaryPos || '').split('/');
      return positions.includes(slot);
    });
    if (best) { filled[slot] = best; used.add(best.name); }
  }

  // Pass 3: DH = best unused batter
  if (!filled['DH']) {
    const best = batters.find(p => !used.has(p.name));
    if (best) { filled['DH'] = best; used.add(best.name); }
  }

  // Pitchers: top 5 SP, top 5 RP by LCV
  const startingSP = sps.slice(0, 5);
  const startingRP = rps.slice(0, 5);

  let startingLCV = 0, startingALCV = 0;
  for (const p of Object.values(filled)) { startingLCV += (p.lcv || 0); if (p.actualLcv != null) startingALCV += p.actualLcv; }
  for (const p of startingSP) { startingLCV += (p.lcv || 0); if (p.actualLcv != null) startingALCV += p.actualLcv; }
  for (const p of startingRP) { startingLCV += (p.lcv || 0); if (p.actualLcv != null) startingALCV += p.actualLcv; }

  let totalLCV = 0, totalALCV = 0;
  for (const p of players) { totalLCV += (p.lcv || 0); if (p.actualLcv != null) totalALCV += p.actualLcv; }

  return { startingLCV, totalLCV, startingALCV, totalALCV, count: players.length };
}

let leagueSortCol = 'startingLCV', leagueSortDir = -1; // default: Start LCV desc

function renderLeague() {
  const section = document.getElementById('rosterSection');

  // Build team data for all 12 teams
  const teamData = LEAGUE_TEAMS.map(t => {
    const players = t.mine ? (state.myTeam || []) : (state.leagueTeams[t.name] || []);
    const ov = t.mine ? (state.rosterOverrides || {}) : (state.leagueRosterOverrides && state.leagueRosterOverrides[t.name] || {});
    const stats = calcRosterLCV(players, ov);
    const owner = t.mine ? (t.owner || '') : (state.teamOwners[t.name] || '');
    const rookies = t.mine ? (state.milbKeepers || []) : (state.leagueMilbKeepers[t.name] || []);
    return { ...t, players, ...stats, owner, rookies, rookieCount: (t.mine ? (state.milbKeepers || []) : (state.leagueMilbKeepers[t.name] || [])).length };
  });

  // ── Draft Capital from simulation engine ──────────────────────────────
  const sim = simulateDraft();
  teamData.forEach(t => {
    t.draftCapital = sim.teamCapital[t.name] || 0;
    t.openRounds = sim.teamOpenRds[t.name] || 0;
    t.totalPower = Math.round((t.totalLCV + t.draftCapital) * 100) / 100;
  });

  // Sortable columns definition
  const isDraftMode = state._mode === 'draft';
  const leagueCols = [
    { key: 'pick', label: 'Pick', w: '25px', numeric: true },
    { key: 'name', label: 'Team', w: '', numeric: false },
    { key: 'owner', label: 'Owner', w: '100px', numeric: false },
    { key: 'count', label: 'Ct', w: '40px', numeric: true },
    { key: 'rookieCount', label: 'Rk', w: '35px', numeric: true, tip: 'Rookie/MiLB keepers', small: true },
    { key: 'startingLCV', label: 'Start LCV', w: '70px', numeric: true, bar: true, tip: 'Projected starting lineup LCV' },
    { key: 'totalLCV', label: 'Total LCV', w: '70px', numeric: true, bar: true, tip: 'Projected total roster LCV' },
    ...(!isDraftMode ? [
      { key: 'startingALCV', label: 'Start aLCV', w: '75px', numeric: true, bar: true, tip: 'Actual starting lineup LCV from 2026 in-season stats' },
      { key: 'totalALCV', label: 'Total aLCV', w: '75px', numeric: true, bar: true, tip: 'Actual total roster LCV from 2026 in-season stats' },
    ] : []),
    ...(isDraftMode ? [
      { key: 'openRounds', label: 'Open', w: '35px', numeric: true, small: true, tip: 'Open draft rounds (25 minus keeper count)' },
      { key: 'draftCapital', label: 'Draft Cap', w: '75px', numeric: true, bar: true, small: true, tip: 'Draft Capital — estimated total DP from remaining open picks (BPA simulation)' },
      { key: 'totalPower', label: 'Total Pwr', w: '75px', numeric: true, bar: true, small: true, tip: 'Total Power = Keeper LCV + Draft Capital' }
    ] : [])
  ];

  // Sort
  const sorted = [...teamData].sort((a, b) => {
    let av = a[leagueSortCol], bv = b[leagueSortCol];
    if (typeof av === 'string') return leagueSortDir * av.localeCompare(bv);
    return leagueSortDir * ((av || 0) - (bv || 0));
  });

  // Max values for bar scaling
  const maxVals = {};
  ['startingLCV', 'totalLCV', 'startingALCV', 'totalALCV', 'draftCapital', 'totalPower'].forEach(k => {
    maxVals[k] = Math.max(...teamData.map(t => t[k] || 0), 1);
  });

  // Sub-view toggle
  if (!state._leagueView || state._leagueView === 'kept') state._leagueView = 'comparison';
  if (state._leagueView === 'available') state._leagueView = 'rosters';

  let html = '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">';
  html += '<h2 style="margin:0;">League</h2>';
  html += '<div style="display:flex;gap:2px;background:var(--surface2);border-radius:6px;padding:2px;">';
  ['comparison','rosters','positional'].forEach(v => {
    const active = state._leagueView === v;
    const label = v === 'rosters' ? 'Rosters' : v === 'positional' ? 'Positional LCV' : 'Comparison';
    html += `<button class="league-view-btn" data-view="${v}" style="padding:4px 12px;font-size:11px;border:none;border-radius:4px;cursor:pointer;background:${active?'var(--accent)':'transparent'};color:${active?'#fff':'var(--text2)'};font-weight:${active?'600':'400'};">${label}</button>`;
  });
  html += renderSplitToggle('league-split-toggle');
  html += '</div></div>';

  // ── ROSTERS VIEW (all players with keeper status) ──
  if (state._leagueView === 'rosters') {
    html += '<p style="font-size:12px;color:var(--text2);margin-bottom:12px;">Full rosters for all 12 teams. Keepers shown with keeper round and cost. Click column headers to sort.</p>';
    if (!state._rosterSorts) state._rosterSorts = {};

    LEAGUE_TEAMS.forEach(t => {
      const isMine = t.mine;
      const teamPlayers = isMine ? (state.myTeam || []) : (state.leagueTeams[t.name] || []);
      const keepers = DEFAULT_LEAGUE_KEEPERS[t.name] || [];
      const keeperNames = new Set(keepers.map(k => k.name));
      const keeperRdMap = {};
      keepers.forEach(k => { keeperRdMap[k.name] = k.rd; });
      const milb = DEFAULT_LEAGUE_MILB_KEEPERS[t.name] || (t.mine ? (DEFAULT_MILB_KEEPERS || []) : []);
      const milbNames = new Set(milb);
      const allRostered = teamPlayers.filter(n => !milbNames.has(n));
      if (allRostered.length === 0 && milb.length === 0) return;

      const borderClr = isMine ? 'var(--accent)' : 'var(--border)';
      const bgClr = isMine ? 'rgba(74,107,255,0.04)' : '';
      const ownerName = t.mine ? t.owner : (state.teamOwners[t.name] || t.owner || '');

      html += `<div style="border:1px solid ${borderClr};border-radius:8px;padding:10px 12px;margin-bottom:8px;background:${bgClr};">`;
      html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">`;
      html += `<div><b style="font-size:13px;">#${t.pick} ${t.name}</b>${isMine?' <span style="color:var(--accent);font-size:11px;">(you)</span>':''} <span style="font-size:11px;color:var(--text2);">(${allRostered.length} players)</span></div>`;
      html += `<div style="font-size:11px;color:var(--text2);">${ownerName}</div>`;
      html += `</div>`;

      // Per-team sort state
      const tSort = state._rosterSorts[t.name] || { col: 'lcv', dir: -1 };
      const sortCols = [
        { key: 'name', label: 'Player', align: 'left', w: '28%' },
        { key: 'pos', label: 'Pos', align: 'center', w: '6%' },
        { key: 'keeper', label: 'Kpr', align: 'right', w: '8%' },
        { key: 'cost', label: 'Cost', align: 'right', w: '8%' },
        { key: 'yrs', label: 'Yrs', align: 'right', w: '6%' },
        { key: 'lcv', label: 'LCV', align: 'right', w: '10%' },
        { key: 'alcv', label: 'aLCV', align: 'right', w: '10%', tip: 'Actual LCV from 2026 stats' },
        { key: 'dlcv', label: 'ΔLCV', align: 'right', w: '10%', tip: 'Actual minus Projected LCV' },
        { key: 'pnav', label: 'PNAV', align: 'right', w: '10%' }
      ];

      html += `<table style="width:100%;border-collapse:collapse;font-size:11px;table-layout:fixed;">`;
      html += `<colgroup>${sortCols.map(c => `<col style="width:${c.w}">`).join('')}</colgroup>`;
      html += `<tr style="color:var(--text2);font-size:10px;">`;
      sortCols.forEach(c => {
        const arrow = tSort.col === c.key ? (tSort.dir === 1 ? ' ▲' : ' ▼') : '';
        const activeClr = tSort.col === c.key ? 'color:var(--accent);' : '';
        html += `<th class="roster-sort-hdr" data-team="${t.name}" data-col="${c.key}" style="text-align:${c.align};padding:3px 4px;cursor:pointer;user-select:none;white-space:nowrap;${activeClr}">${c.label}${arrow}</th>`;
      });
      html += `</tr>`;

      // Build row data
      const rows = allRostered.map(n => {
        const p = _plyrI(n);
        const ki = getKeeperInfoCached(n);
        const keeperRd = keeperRdMap[n];
        return {
          name: n, p, ki, isKeeper: keeperNames.has(n),
          lcvVal: p ? (p.lcv||0) : -99,
          alcvVal: p && p.actualLcv != null ? p.actualLcv : -99,
          dlcvVal: p && p.lcvDelta != null ? p.lcvDelta : -99,
          pnavVal: p ? (p.pnav||0) : -99,
          pos: p ? p.primaryPos : '?',
          keeperRd: keeperRd || 0,
          costVal: ki.keepable2027 ? ki.cost2027 : 99,
          yrsVal: ki.yearsLeft || 0
        };
      });

      // Sort rows
      rows.sort((a,b) => {
        const col = tSort.col, dir = tSort.dir;
        if (col === 'name') return dir * a.name.localeCompare(b.name);
        if (col === 'pos') return dir * a.pos.localeCompare(b.pos);
        if (col === 'keeper') return dir * (a.keeperRd - b.keeperRd);
        if (col === 'cost') return dir * (a.costVal - b.costVal);
        if (col === 'yrs') return dir * (a.yrsVal - b.yrsVal);
        if (col === 'pnav') return dir * (a.pnavVal - b.pnavVal);
        if (col === 'alcv') return dir * (a.alcvVal - b.alcvVal);
        if (col === 'dlcv') return dir * (a.dlcvVal - b.dlcvVal);
        return dir * (a.lcvVal - b.lcvVal); // default: lcv
      });

      rows.forEach(row => {
        const p = row.p;
        const ki = row.ki;
        const lcv = p ? (p.lcv||0).toFixed(1) : '?';
        const pnav = p ? (p.pnav||0).toFixed(1) : '?';
        const keeperStr = row.keeperRd ? `<span style="color:var(--accent);font-weight:600;">R${row.keeperRd}</span>` : '<span style="color:var(--text2);">—</span>';
        const costStr = ki.keepable2027 ? `R${ki.cost2027}` : '✕';
        const costClr = ki.keepable2027 ? '' : 'color:var(--red);';
        const rowBg = row.isKeeper ? 'background:rgba(74,107,255,0.04);' : '';
        html += `<tr style="${rowBg}">`;
        html += `<td style="padding:3px 4px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${row.name}${_injBadge(row.name)}</td>`;
        html += `<td style="padding:3px 4px;text-align:center;"><span class="pos-badge pos-${row.pos}" style="padding:1px 4px;font-size:9px;">${row.pos}</span></td>`;
        html += `<td style="text-align:right;padding:3px 4px;">${keeperStr}</td>`;
        html += `<td style="text-align:right;padding:3px 4px;${costClr}">${costStr}</td>`;
        html += `<td style="text-align:right;padding:3px 4px;">${ki.yearsLeft}</td>`;
        const alcv = p && p.actualLcv != null ? p.actualLcv.toFixed(1) : '—';
        const dlcv = p && p.lcvDelta != null ? ((p.lcvDelta > 0 ? '+' : '') + p.lcvDelta.toFixed(1)) : '—';
        const dlcvClr = p && p.lcvDelta != null ? (p.lcvDelta >= 0 ? 'color:var(--green);' : 'color:var(--red);') : '';
        html += `<td style="text-align:right;padding:3px 4px;font-weight:600;">${lcv}</td>`;
        html += `<td style="text-align:right;padding:3px 4px;">${alcv}</td>`;
        html += `<td style="text-align:right;padding:3px 4px;font-weight:600;${dlcvClr}">${dlcv}</td>`;
        html += `<td style="text-align:right;padding:3px 4px;">${pnav}</td>`;
        html += `</tr>`;
      });
      html += '</table>';
      if (milb.length > 0) {
        html += '<div style="font-size:10px;color:var(--text2);margin-top:4px;">MiLB: ' + milb.join(', ') + '</div>';
      }
      // IL list: rostered players with Out/IL status
      const ilPlayers = allRostered.filter(n => {
        const inj = INJURY_MAP.get(n);
        return inj && (inj.status === 'O' || inj.status === 'IL');
      }).map(n => {
        const inj = INJURY_MAP.get(n);
        return `${n} <span style="color:var(--red);font-size:9px;">(${inj.injury}${inj.return ? ' · ' + inj.return : ''})</span>`;
      });
      if (ilPlayers.length > 0) {
        html += `<div style="font-size:10px;color:var(--text2);margin-top:4px;"><span style="color:var(--red);font-weight:600;">IL:</span> ${ilPlayers.join(', ')}</div>`;
      }
      html += '</div>';
    });
  }

  // ── POSITIONAL LCV VIEW ──
  else if (state._leagueView === 'positional') {
    html += '<p style="font-size:12px;color:var(--text2);margin-bottom:12px;">Average LCV at each position for every team. Cells colored from red (weak) to green (strong). Click a column to sort.</p>';

    const posOrder = ['C','1B','2B','3B','SS','LF','CF','RF','DH','SP','RP'];

    // Compute positional LCV for every team
    const posData = LEAGUE_TEAMS.map(t => {
      const players = t.mine ? (state.myTeam || []) : (state.leagueTeams[t.name] || []);
      const plObj = players.map(n => _plyrI(n)).filter(Boolean);
      const assign = computeNeedsForTeam(plObj);
      const posLcvs = {};
      let totalStart = 0;
      posOrder.forEach(pos => {
        const top = assign[pos] || [];
        const avg = top.length > 0 ? top.reduce((s,p) => s + (p.lcv||0), 0) / top.length : 0;
        posLcvs[pos] = avg;
        totalStart += top.reduce((s,p) => s + (p.lcv||0), 0);
      });
      posLcvs._total = totalStart;
      return { name: t.owner || t.name, mine: t.mine, posLcvs };
    });

    // Compute league averages and min/max per position for color scaling
    const posStats = {};
    posOrder.forEach(pos => {
      const vals = posData.map(d => d.posLcvs[pos]);
      posStats[pos] = { min: Math.min(...vals), max: Math.max(...vals), avg: vals.reduce((s,v)=>s+v,0)/vals.length };
    });

    // Sort state for positional view
    if (!state._posLcvSort) state._posLcvSort = '_total';
    if (!state._posLcvDir) state._posLcvDir = -1;
    const pSortKey = state._posLcvSort;
    const pSortDir = state._posLcvDir;

    const sortedPos = [...posData].sort((a,b) => {
      if (pSortKey === 'name') return pSortDir * a.name.localeCompare(b.name);
      const av = pSortKey === '_total' ? a.posLcvs._total : (a.posLcvs[pSortKey]||0);
      const bv = pSortKey === '_total' ? b.posLcvs._total : (b.posLcvs[pSortKey]||0);
      return pSortDir * (av - bv);
    });

    html += '<div style="overflow-x:auto;">';
    html += '<table style="width:100%;border-collapse:collapse;font-size:11px;">';
    html += '<thead><tr style="background:var(--surface2);">';
    // Team header
    const nameArrow = pSortKey === 'name' ? (pSortDir === 1 ? ' ▲' : ' ▼') : '';
    html += `<th class="pos-lcv-sort" data-col="name" style="text-align:left;padding:6px 8px;cursor:pointer;user-select:none;white-space:nowrap;min-width:80px;">Team${nameArrow}</th>`;
    posOrder.forEach(pos => {
      const arrow = pSortKey === pos ? (pSortDir === 1 ? ' ▲' : ' ▼') : '';
      html += `<th class="pos-lcv-sort" data-col="${pos}" style="text-align:center;padding:6px 4px;cursor:pointer;user-select:none;min-width:42px;">${pos}${arrow}</th>`;
    });
    const totArrow = pSortKey === '_total' ? (pSortDir === 1 ? ' ▲' : ' ▼') : '';
    html += `<th class="pos-lcv-sort" data-col="_total" style="text-align:right;padding:6px 8px;cursor:pointer;user-select:none;font-weight:700;">Total${totArrow}</th>`;
    html += '</tr></thead><tbody>';

    sortedPos.forEach((row, idx) => {
      const rowBg = row.mine ? 'background:rgba(99,102,241,0.08);' : (idx % 2 === 0 ? '' : 'background:var(--surface2);opacity:0.7;');
      const nameWt = row.mine ? 'font-weight:700;' : '';
      html += `<tr style="${rowBg}">`;
      html += `<td style="padding:4px 8px;${nameWt}white-space:nowrap;">${row.name}${row.mine ? ' ★' : ''}</td>`;
      posOrder.forEach(pos => {
        const val = row.posLcvs[pos];
        const st = posStats[pos];
        const range = st.max - st.min || 1;
        const pct = (val - st.min) / range;
        // Color: red(0) -> yellow(0.5) -> green(1)
        const r = pct < 0.5 ? 220 : Math.round(220 - (pct - 0.5) * 2 * 180);
        const g = pct < 0.5 ? Math.round(60 + pct * 2 * 160) : 220;
        const bg = `rgba(${r},${g},60,0.18)`;
        const clr = pct > 0.7 ? 'var(--green)' : pct < 0.3 ? 'var(--red)' : 'var(--text)';
        // Rank within this position (1 = best)
        const rank = posData.filter(d => d.posLcvs[pos] > val).length + 1;
        html += `<td style="text-align:center;padding:4px;background:${bg};color:${clr};font-weight:${rank <= 3 ? '700' : '400'};" title="${pos}: ${val.toFixed(2)} (rank #${rank})">${val.toFixed(1)}</td>`;
      });
      const total = row.posLcvs._total;
      html += `<td style="text-align:right;padding:4px 8px;font-weight:700;">${total.toFixed(1)}</td>`;
      html += '</tr>';
    });

    // League average row
    html += '<tr style="border-top:2px solid var(--border);font-style:italic;color:var(--text2);">';
    html += '<td style="padding:4px 8px;">League Avg</td>';
    posOrder.forEach(pos => {
      html += `<td style="text-align:center;padding:4px;">${posStats[pos].avg.toFixed(1)}</td>`;
    });
    const totalAvg = posData.reduce((s,d) => s + d.posLcvs._total, 0) / posData.length;
    html += `<td style="text-align:right;padding:4px 8px;">${totalAvg.toFixed(1)}</td>`;
    html += '</tr>';

    html += '</tbody></table></div>';
  }

  // ── COMPARISON VIEW (original league table) ──
  else {
  html += isDraftMode
    ? '<p style="font-size:12px;color:var(--text2);margin-bottom:16px;">Click any column header to sort. <b>Draft Cap</b> = estimated DP from open picks (BPA sim, updates as you draft). <b>Total Pwr</b> = Keeper LCV + Draft Cap.</p>'
    : '<p style="font-size:12px;color:var(--text2);margin-bottom:16px;">Click any column header to sort.</p>';

  // Table header
  html += '<table style="width:100%"><thead><tr>';
  html += '<th style="width:25px">#</th>';
  leagueCols.forEach(col => {
    const isActive = leagueSortCol === col.key;
    const arrow = isActive ? (leagueSortDir === -1 ? ' ▼' : ' ▲') : '';
    const cursor = 'cursor:pointer;user-select:none;';
    const fontSize = col.small ? 'font-size:11px;' : '';
    const tip = col.tip ? ` title="${col.tip}"` : '';
    const width = col.w ? `width:${col.w};` : '';
    const activeStyle = isActive ? 'color:var(--accent);' : '';
    html += `<th class="league-sort-th" data-col="${col.key}" style="${width}${cursor}${fontSize}${activeStyle}"${tip}>${col.label}${arrow}</th>`;
    if (col.bar) html += `<th style="width:${col.key === 'startingLCV' || col.key === 'totalLCV' ? '140px' : '100px'}"></th>`;
  });
  html += '</tr></thead><tbody>';

  sorted.forEach((t, i) => {
    const rowStyle = t.mine ? 'background:rgba(99,102,241,0.08);' : '';
    const nameWeight = t.mine ? 'font-weight:700;' : '';
    const youTag = t.mine ? ' <small style="color:var(--accent)">(you)</small>' : '';

    html += `<tr class="league-row" data-team="${encodeURIComponent(t.name)}" style="${rowStyle}cursor:pointer;" title="Click to edit">
      <td>${i+1}</td>
      <td style="text-align:center;color:var(--text2);font-size:12px;">${t.pick}</td>
      <td style="${nameWeight}">${t.name}${youTag}</td>
      <td><input class="owner-input" data-team="${encodeURIComponent(t.name)}" value="${t.owner.replace(/"/g, '&quot;')}" placeholder="Owner" style="width:90px;padding:2px 6px;font-size:11px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:3px;"></td>
      <td style="text-align:center">${t.count}</td>
      <td style="text-align:center;font-size:11px;color:var(--text2);" title="${(t.rookies||[]).join(', ')}">${t.rookieCount}</td>`;

    // Render each bar-metric column
    const barKeys = isDraftMode ? ['startingLCV', 'totalLCV', 'openRounds', 'draftCapital', 'totalPower'] : ['startingLCV', 'totalLCV'];
    barKeys.forEach(key => {
      const val = t[key] || 0;
      if (key === 'openRounds') {
        html += `<td style="text-align:center;font-size:12px;color:var(--text2);">${val}</td>`;
        return;
      }
      const pct = val / maxVals[key] * 100;
      const hue = Math.round((pct / 100) * 120);
      const clr = `hsl(${hue}, 70%, 38%)`;
      html += `<td style="text-align:right;font-weight:700;color:${clr}">${val.toFixed(1)}</td>`;
      html += `<td><div style="position:relative;height:18px;background:var(--surface2);border-radius:4px;overflow:hidden;">
        <div style="height:100%;width:${pct.toFixed(0)}%;background:${clr};opacity:0.3;"></div>
      </div></td>`;
    });

    html += '</tr>';
  });
  html += '</tbody></table>';

  // Team roster editor (draft mode only)
  if (isDraftMode) {
  html += `<div style="margin-top:24px;padding:16px;background:var(--surface2);border-radius:8px;">`;
  html += `<h3 style="margin:0 0 12px;font-size:14px;">Edit Team Roster</h3>`;
  html += `<div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap;">`;
  html += `<select id="leagueTeamSelect" style="flex:0 0 300px;padding:6px 10px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:4px;font-size:13px;">`;
  LEAGUE_TEAMS.forEach(t => {
    if (t.mine) return; // edit your own team via the main draft tools
    const cnt = (state.leagueTeams[t.name] || []).length;
    html += `<option value="${encodeURIComponent(t.name)}">#${t.pick} ${t.name} (${cnt} players)</option>`;
  });
  html += `</select>`;
  html += `<button id="leagueTeamSave" class="btn" style="padding:6px 16px;font-size:13px;">Save Roster</button>`;
  html += `<button id="leagueTeamClear" class="btn btn-secondary" style="padding:6px 16px;font-size:13px;">Clear</button>`;
  html += `</div>`;
  html += `<textarea id="leagueTeamPlayers" rows="6" placeholder="Enter player names, one per line or comma-separated.${String.fromCharCode(10)}Players will be fuzzy-matched to projections." style="width:100%;padding:8px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:4px;font-size:12px;font-family:monospace;resize:vertical;"></textarea>`;
  html += `<div id="leagueTeamResult" style="margin-top:8px;font-size:12px;color:var(--text2);"></div>`;
  html += `</div>`;

  // Summary
  const teamsWithPlayers = LEAGUE_TEAMS.filter(t => {
    const pl = t.mine ? (state.myTeam||[]) : (state.leagueTeams[t.name]||[]);
    return pl.length > 0;
  }).length;
  html += `<div style="margin-top:12px;font-size:12px;color:var(--text2);">Teams with rosters entered: ${teamsWithPlayers}/12</div>`;

  // ── Mock Draft section ────────────────────────────────────────────────
  html += `<div style="margin-top:24px;padding:16px;background:var(--surface2);border-radius:8px;">`;
  html += `<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">`;
  html += `<h3 style="margin:0;font-size:14px;">Mock Draft (BPA Simulation)</h3>`;
  html += `<button id="mockDraftToggle" class="btn btn-primary" style="padding:4px 16px;font-size:12px;">Show Mock Draft</button>`;
  html += `</div>`;
  html += `<p style="font-size:11px;color:var(--text2);margin:0 0 8px;">Simulates the entire draft using Best Player Available logic with snake positions. Excludes all kept and already-drafted players. Updates live as you draft.</p>`;
  html += `<div id="mockDraftResults" style="display:none;"></div>`;
  html += `</div>`;
  } // end isDraftMode (edit roster + mock draft)
  } // end comparison view

  section.innerHTML = html;

  // Wire league view toggle buttons
  section.querySelectorAll('.league-view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state._leagueView = btn.dataset.view;
      save();
      renderLeague();
    });
  });

  // Wire time-split toggle
  section.querySelectorAll('.split-toggle').forEach(sel => {
    sel.addEventListener('change', () => {
      state._splitWindow = sel.value;
      applySplitWindow(sel.value);
      save();
      renderLeague();
    });
  });

  // Sortable column headers for positional LCV view
  section.querySelectorAll('.pos-lcv-sort').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (state._posLcvSort === col) { state._posLcvDir = (state._posLcvDir || -1) * -1; }
      else { state._posLcvSort = col; state._posLcvDir = -1; }
      renderLeague();
    });
  });

  // Sortable column headers for roster view (per-team)
  section.querySelectorAll('.roster-sort-hdr').forEach(th => {
    th.addEventListener('click', () => {
      const team = th.dataset.team;
      const col = th.dataset.col;
      if (!state._rosterSorts) state._rosterSorts = {};
      const cur = state._rosterSorts[team] || { col: 'lcv', dir: -1 };
      if (cur.col === col) { cur.dir *= -1; }
      else { cur.col = col; cur.dir = col === 'name' || col === 'pos' ? 1 : -1; }
      state._rosterSorts[team] = cur;
      renderLeague();
    });
  });

  // Sortable column headers (only in comparison view)
  section.querySelectorAll('.league-sort-th').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (leagueSortCol === col) { leagueSortDir *= -1; }
      else { leagueSortCol = col; leagueSortDir = -1; }
      renderLeague();
    });
  });

  // Mock draft toggle + rendering
  const _mockToggle = document.getElementById('mockDraftToggle');
  if (_mockToggle) _mockToggle.addEventListener('click', function() {
    const resultsEl = document.getElementById('mockDraftResults');
    if (resultsEl.style.display === 'none') {
      this.textContent = 'Hide Mock Draft';
      resultsEl.style.display = '';
      renderMockDraft(resultsEl, sim);
    } else {
      this.textContent = 'Show Mock Draft';
      resultsEl.style.display = 'none';
    }
  });

  function renderMockDraft(el, simData) {
    // Show my team's mock picks first, then full round-by-round
    const myTeam = LEAGUE_TEAMS.find(t => t.mine);
    const myPicks = simData.teamResults[myTeam.name] || [];

    let mhtml = '<h4 style="margin:12px 0 8px;color:var(--accent);font-size:13px;">Your Projected Picks (BPA)</h4>';
    if (myPicks.length === 0) {
      mhtml += '<p style="font-size:12px;color:var(--text2);">No open picks remaining.</p>';
    } else {
      mhtml += '<table style="width:100%;margin-bottom:16px;"><thead><tr><th style="width:45px">Rd</th><th style="width:55px">Overall</th><th>Player</th><th style="width:50px">Pos</th><th style="width:45px">Team</th><th style="width:55px">LCV</th><th style="width:55px">Pick</th></tr></thead><tbody>';
      myPicks.forEach(p => {
        mhtml += `<tr style="background:rgba(99,102,241,0.06);">
          <td style="font-weight:700">${p.round}</td>
          <td style="color:var(--text2)">#${p.overall}</td>
          <td style="font-weight:600">${p.name}</td>
          <td>${p.pos}</td>
          <td style="font-size:11px">${p.team}</td>
          <td>${p.lcv.toFixed(1)}</td>
          <td style="font-weight:700;color:var(--accent)">${p.dp.toFixed(1)}</td>
        </tr>`;
      });
      mhtml += '</tbody></table>';
    }

    // Full draft — collapsible per team
    mhtml += '<h4 style="margin:12px 0 8px;font-size:13px;">All Teams Mock Results</h4>';
    // Sort teams by total power descending
    const teamOrder = LEAGUE_TEAMS.slice().sort((a,b) => {
      const aCap = simData.teamCapital[a.name] || 0;
      const bCap = simData.teamCapital[b.name] || 0;
      return bCap - aCap;
    });

    teamOrder.forEach(t => {
      const picks = simData.teamResults[t.name] || [];
      if (picks.length === 0) return;
      const cap = (simData.teamCapital[t.name] || 0).toFixed(1);
      const isMine = t.mine;
      const highlight = isMine ? 'color:var(--accent);' : '';
      const youTag = isMine ? ' (you)' : '';
      mhtml += `<details style="margin-bottom:4px;"><summary style="cursor:pointer;padding:4px 8px;font-size:12px;border-radius:4px;background:var(--bg);${highlight}"><b>#${t.pick} ${t.name}${youTag}</b> — ${picks.length} picks, Draft Cap: ${cap}</summary>`;
      mhtml += '<table style="width:100%;margin:4px 0 8px;"><thead><tr><th style="width:40px">Rd</th><th style="width:50px">#</th><th>Player</th><th style="width:45px">Pos</th><th style="width:50px">DP</th></tr></thead><tbody>';
      picks.forEach(p => {
        mhtml += `<tr><td>${p.round}</td><td style="color:var(--text2)">${p.overall}</td><td style="font-weight:600">${p.name}</td><td>${p.pos}</td><td>${p.dp.toFixed(1)}</td></tr>`;
      });
      mhtml += '</tbody></table></details>';
    });

    el.innerHTML = mhtml;
  }
  section.style.display = '';
  document.getElementById('tableWrap').style.display = 'none';

  // Load selected team's players into textarea
  function loadTeamIntoEditor(teamName) {
    const sel = document.getElementById('leagueTeamSelect');
    if (!sel) return;
    sel.value = encodeURIComponent(teamName);
    const players = state.leagueTeams[teamName] || [];
    document.getElementById('leagueTeamPlayers').value = players.join('\n');
  }

  // Click row to select team (draft mode only — editor present)
  section.querySelectorAll('.league-row').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.classList.contains('owner-input')) return;
      const tn = decodeURIComponent(row.dataset.team);
      const lt = LEAGUE_TEAMS.find(t => t.name === tn);
      if (lt && !lt.mine) loadTeamIntoEditor(tn);
    });
  });

  // Save roster
  const _saveBtn = document.getElementById('leagueTeamSave');
  if (_saveBtn) _saveBtn.addEventListener('click', () => {
    const teamName = decodeURIComponent(document.getElementById('leagueTeamSelect').value);
    const text = document.getElementById('leagueTeamPlayers').value.trim();
    const resultEl = document.getElementById('leagueTeamResult');

    const lines = text ? text.split(/[\n,]+/).map(s => s.trim()).filter(Boolean) : [];
    let matched = 0, unmatched = [];
    const players = [];
    lines.forEach(line => {
      const { name, rd } = parseNameAndRound(line);
      const match = fuzzyFind(name);
      if (match) {
        players.push(match.name);
        if (!state.drafted[match.name]) state.drafted[match.name] = { time: Date.now(), mine: false };
        if (rd) { if (!state.keeperRounds) state.keeperRounds = {}; state.keeperRounds[match.name] = rd; }
        matched++;
      } else {
        unmatched.push(name);
      }
    });

    state.leagueTeams[teamName] = players;
    save();

    let msg = `<span style="color:var(--green)">Saved ${matched} players to ${teamName}</span>`;
    if (unmatched.length) msg += `<br><span style="color:var(--orange)">Not found: ${unmatched.join(', ')}</span>`;
    resultEl.innerHTML = msg;
    setTimeout(() => renderLeague(), 500);
  });

  // Clear
  const _clearBtn = document.getElementById('leagueTeamClear');
  if (_clearBtn) _clearBtn.addEventListener('click', () => {
    document.getElementById('leagueTeamPlayers').value = '';
    document.getElementById('leagueTeamResult').innerHTML = '';
  });

  // Owner name inputs — save on change
  section.querySelectorAll('.owner-input').forEach(inp => {
    inp.addEventListener('change', () => {
      const tn = decodeURIComponent(inp.dataset.team);
      state.teamOwners[tn] = inp.value.trim();
      save();
    });
    // Prevent row click when clicking in input
    inp.addEventListener('click', e => e.stopPropagation());
  });

  // Load first non-mine team into editor (comparison view only)
  if (state._leagueView === 'comparison') {
    const firstOther = LEAGUE_TEAMS.find(t => !t.mine);
    if (firstOther) loadTeamIntoEditor(firstOther.name);
  }
}

// (renderLeagueRosters removed — combined into renderRoster)

// (renderFreeAgents removed — use All/Drafted/Available filter on main player tables instead)

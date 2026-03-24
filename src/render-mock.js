// ── Interactive Mock Draft ─────────────────────────────────────────────────
let mockState = null; // {picks:[], currentPick:0, userTeamIdx:1, available:[], paused:false, speed:'normal', draftOrder:[]}

function initMockDraft() {
  const TOTAL_ROUNDS = 31;
  const NTEAMS = 12;

  // Keepers: gather all kept player names and their rounds
  const keptNames = new Set();
  const keeperSlots = {}; // teamIdx -> Set of rounds used by keepers
  LEAGUE_TEAMS.forEach((t, idx) => {
    const pl = t.mine ? (state.keepers || []) : (state.leagueTeams[t.name] || []);
    keeperSlots[idx] = new Set();
    pl.forEach(n => {
      keptNames.add(n);
      const rd = state.keeperRounds[n];
      if (rd) keeperSlots[idx].add(rd);
    });
  });

  // Build available pool sorted by DP
  const available = ALL.filter(p => !keptNames.has(p.name))
    .map(p => ({ name:p.name, pos:p.primaryPos||'?', team:p.team||'', dp:p.dp||0, lcv:p.lcv||0, pnav:p.pnav||0, trend:p.trend, type:p.type }))
    .sort((a,b) => b.dp - a.dp);

  // Build snake draft order: list of {round, overall, teamIdx, teamName}
  const draftOrder = [];
  for (let rd = 1; rd <= TOTAL_ROUNDS; rd++) {
    for (let slot = 1; slot <= NTEAMS; slot++) {
      const teamPick = rd % 2 === 1 ? slot : (NTEAMS - slot + 1);
      const teamIdx = LEAGUE_TEAMS.findIndex(t => t.pick === teamPick);
      if (keeperSlots[teamIdx] && keeperSlots[teamIdx].has(rd)) continue; // keeper in this slot
      draftOrder.push({ round: rd, overall: draftOrder.length + 1, teamIdx, teamName: LEAGUE_TEAMS[teamIdx].name });
    }
  }

  const userTeamIdx = LEAGUE_TEAMS.findIndex(t => t.mine);

  // Build team rosters starting with keepers
  const teamRosters = {};
  LEAGUE_TEAMS.forEach((t, idx) => {
    const pl = t.mine ? (state.keepers || []) : (state.leagueTeams[t.name] || []);
    teamRosters[idx] = [...pl];
  });

  mockState = {
    picks: [],        // [{name, pos, team, dp, lcv, pnav, teamIdx, teamName, round, overall, isUser}]
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
  };
}

function mockPickBPA() {
  if (!mockState || mockState.currentPick >= mockState.draftOrder.length) return null;
  const slot = mockState.draftOrder[mockState.currentPick];
  if (slot.teamIdx === mockState.userTeamIdx) return null; // user's turn
  const pick = mockState.available.shift();
  if (!pick) return null;
  const entry = { ...pick, teamIdx: slot.teamIdx, teamName: slot.teamName, round: slot.round, overall: slot.overall, isUser: false };
  mockState.picks.push(entry);
  mockState.teamRosters[slot.teamIdx].push(pick.name);
  mockState.currentPick++;
  // ── Realtime sync: mark other team's pick as drafted on main board ──
  if (!state.drafted[pick.name]) {
    state.drafted[pick.name] = { time: Date.now(), mine: false };
    save();
  }
  return entry;
}

function mockPickUser(playerName) {
  if (!mockState) return;
  const slot = mockState.draftOrder[mockState.currentPick];
  if (slot.teamIdx !== mockState.userTeamIdx) return;
  const idx = mockState.available.findIndex(p => p.name === playerName);
  if (idx === -1) return;
  const pick = mockState.available.splice(idx, 1)[0];
  const entry = { ...pick, teamIdx: slot.teamIdx, teamName: slot.teamName, round: slot.round, overall: slot.overall, isUser: true };
  mockState.picks.push(entry);
  mockState.teamRosters[slot.teamIdx].push(pick.name);
  mockState.currentPick++;
  // ── Realtime sync: apply pick to main draft board immediately ──
  if (!state.drafted[playerName]) {
    state.drafted[playerName] = { time: Date.now(), mine: true };
    if (!state.myTeam.includes(playerName)) state.myTeam.push(playerName);
    save();
  }
}

function runMockUntilUserTurn(cb) {
  if (!mockState) return;
  function step() {
    if (mockState.currentPick >= mockState.draftOrder.length) { cb(); return; }
    const slot = mockState.draftOrder[mockState.currentPick];
    if (slot.teamIdx === mockState.userTeamIdx) { cb(); return; }
    mockPickBPA();
    if (mockState.speed === 'instant') { step(); }
    else {
      const delay = mockState.speed === 'slow' ? 300 : 80;
      mockState.timer = setTimeout(() => { renderMockDraftUI(); step(); }, delay);
    }
  }
  step();
}

function renderMockDraft() {
  const section = document.getElementById('rosterSection');

  // If no mock in progress, show start screen
  if (!mockState) {
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
    const myKeepers = (state.keepers || []).map(n => {
      const p = _plyrI(n);
      const rd = state.keeperRounds[n] || '?';
      return `<span style="font-size:12px;"><b>${n}</b> (Rd ${rd}, ${p?p.primaryPos:'?'})</span>`;
    });
    html += myKeepers.join(' &middot; ') || '<span style="color:var(--text2);font-size:12px;">None set</span>';
    html += '</div>';
    section.innerHTML = html;
    document.getElementById('mockStartBtn').addEventListener('click', () => {
      const speed = document.getElementById('mockSpeed').value;
      initMockDraft();
      mockState.speed = speed;
      renderMockDraftUI();
      runMockUntilUserTurn(() => renderMockDraftUI());
    });
    return;
  }

  renderMockDraftUI();
}

function renderMockDraftUI() {
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
  if (isDone) {
    html += '<div style="background:var(--green);color:#000;padding:8px 12px;border-radius:6px;margin-bottom:8px;font-weight:600;">Draft Complete!</div>';
  } else if (isUserTurn) {
    html += `<div style="background:var(--accent);color:#fff;padding:8px 12px;border-radius:6px;margin-bottom:8px;font-weight:600;animation:pulse 1.5s infinite;">Your Pick! Round ${currentSlot.round} (Overall #${ms.currentPick + 1})</div>`;
  } else {
    const team = LEAGUE_TEAMS[currentSlot.teamIdx];
    html += `<div style="background:var(--surface2);padding:8px 12px;border-radius:6px;margin-bottom:8px;font-size:12px;">Picking: <b>${team.owner || team.name}</b> — Rd ${currentSlot.round}</div>`;
  }

  // My Roster — keepers + mock draft picks in slot layout
  const myRoster = ms.teamRosters[ms.userTeamIdx] || [];
  const myKeepNames = new Set((state.keepers || []));
  const rosterSlotOrder = ['C','1B','2B','3B','SS','LF','CF','RF','DH','SP','SP','SP','SP','SP','RP','RP','RP','RP','RP'];
  const rosterPlayers = myRoster.map(n => _plyrI(n)).filter(Boolean);
  // Assign to slots
  const slotFilled = {};
  const slotCounts = {C:1,'1B':1,'2B':1,'3B':1,SS:1,LF:1,CF:1,RF:1,DH:1,SP:5,RP:5};
  const slotAssign = {};
  for (const pos of Object.keys(slotCounts)) slotAssign[pos] = [];
  const rPending = [];
  rosterPlayers.forEach(p => {
    const pos = p.primaryPos;
    if (slotAssign[pos] && slotAssign[pos].length < slotCounts[pos]) slotAssign[pos].push(p);
    else rPending.push(p);
  });
  rPending.forEach(p => {
    const positions = (p.pos || p.primaryPos || '').split('/');
    let placed = false;
    for (const pos of positions) {
      if (pos !== p.primaryPos && slotAssign[pos] && slotAssign[pos].length < slotCounts[pos]) {
        slotAssign[pos].push(p);
        placed = true; break;
      }
    }
    if (!placed && !['SP','RP'].includes(p.primaryPos) && slotAssign['DH'].length < slotCounts['DH']) {
      slotAssign['DH'].push(p);
    }
  });

  const myRosterLCV = calcOptimalLCV(myRoster);
  html += '<div style="background:var(--surface2);border-radius:8px;padding:10px;margin-bottom:10px;">';
  html += `<h3 style="font-size:13px;margin-bottom:6px;color:var(--accent);">My Roster (${myRoster.length} players, LCV: ${myRosterLCV.startingLCV.toFixed(1)})</h3>`;
  html += '<div style="display:flex;flex-wrap:wrap;gap:3px;">';
  for (const [pos, players] of Object.entries(slotAssign)) {
    const count = slotCounts[pos];
    for (let i = 0; i < count; i++) {
      const p = players[i];
      if (p) {
        const isKeeper = myKeepNames.has(p.name);
        const bg = isKeeper ? 'rgba(99,102,241,0.15)' : 'rgba(16,185,129,0.15)';
        const border = isKeeper ? 'var(--accent)' : 'var(--green)';
        html += `<div style="background:${bg};border:1px solid ${border};border-radius:4px;padding:2px 6px;font-size:10px;white-space:nowrap;">`;
        const enoTag = p.eno_rank ? ` <span class="eno-rank" style="font-size:8px;" title="Eno 150 Best Pitchers #${p.eno_rank}">P${p.eno_rank}</span>` : '';
        html += `<span style="color:var(--text2);font-weight:600;">${pos}</span> ${p.name}${_injBadge(p.name)}${enoTag} <small style="opacity:0.6">${(p.lcv||0).toFixed(1)}</small>`;
        if (isKeeper) html += ' <small style="color:var(--accent);">K</small>';
        html += '</div>';
      } else {
        html += `<div style="background:var(--bg);border:1px dashed var(--border);border-radius:4px;padding:2px 6px;font-size:10px;color:var(--text2);">`;
        html += `<span style="font-weight:600;">${pos}</span> —</div>`;
      }
    }
  }
  html += '</div></div>';

  // Live League Standings
  html += '<div style="background:var(--surface2);border-radius:8px;padding:10px;margin-bottom:10px;">';
  html += '<h3 style="font-size:13px;margin-bottom:6px;">Live League LCV</h3>';
  html += '<table style="width:100%;font-size:11px;border-collapse:collapse;">';
  html += '<tr style="color:var(--text2);"><th style="text-align:left;padding:2px 4px;">#</th><th style="text-align:left;padding:2px 4px;">Team</th><th style="text-align:right;padding:2px 4px;">Start</th><th style="text-align:right;padding:2px 4px;">Total</th></tr>';
  const leagueStats = LEAGUE_TEAMS.map((t, idx) => {
    const roster = ms.teamRosters[idx] || [];
    const stats = calcOptimalLCV(roster);
    return { name: t.owner || t.name, mine: t.mine, ...stats };
  }).sort((a, b) => b.startingLCV - a.startingLCV);
  leagueStats.forEach((t, rank) => {
    const style = t.mine ? 'background:rgba(99,102,241,0.1);font-weight:600;' : '';
    html += `<tr style="${style}"><td style="padding:2px 4px;">${rank+1}</td><td style="padding:2px 4px;">${t.name}${t.mine?' ★':''}</td><td style="text-align:right;padding:2px 4px;">${t.startingLCV.toFixed(1)}</td><td style="text-align:right;padding:2px 4px;">${t.totalLCV.toFixed(1)}</td></tr>`;
  });
  html += '</table></div>';

  // Recent picks log (last 10)
  const recentPicks = ms.picks.slice(-10).reverse();
  html += '<div style="background:var(--surface2);border-radius:8px;padding:10px;margin-bottom:10px;">';
  html += `<h3 style="font-size:13px;margin-bottom:6px;">Recent Picks</h3>`;
  html += '<table style="width:100%;font-size:11px;border-collapse:collapse;">';
  recentPicks.forEach(p => {
    const isMine = p.isUser;
    const teamLabel = isMine ? '<b style="color:var(--accent)">YOU</b>' : (LEAGUE_TEAMS[p.teamIdx].owner || p.teamName).split(' ')[0];
    const pickPlayer = _plyrI(p.name);
    const pickEno = pickPlayer && pickPlayer.eno_rank ? ` <span class="eno-rank" style="font-size:8px;">P${pickPlayer.eno_rank}</span>` : '';
    html += `<tr style="${isMine?'background:rgba(99,102,241,0.1);':''}"><td style="padding:2px 4px;font-size:10px;color:var(--text2);">${p.round}.${p.overall}</td><td style="padding:2px 4px;">${teamLabel}</td><td style="padding:2px 4px;font-weight:${isMine?'700':'400'};">${p.name}${pickEno}</td><td style="padding:2px 4px;">${p.pos}</td></tr>`;
  });
  html += '</table></div>';

  // Reset button
  html += '<div style="margin-top:8px;">';
  html += '<button id="mockResetBtn" class="btn btn-secondary" style="padding:4px 16px;font-size:11px;">Reset Draft</button>';
  if (isDone) {
    html += ' <button id="mockApplyBtn" class="btn btn-primary" style="padding:4px 16px;font-size:11px;">Apply My Picks to Draft Board</button>';
  }
  html += '</div>';

  html += '</div>'; // end left panel

  // ── Right panel: Available players (for user to pick from) ──────────────
  html += '<div style="flex:1;min-width:400px;max-height:calc(100vh - 140px);overflow-y:auto;">';

  if (isUserTurn) {
    // Search box
    html += '<div style="margin-bottom:8px;display:flex;gap:8px;align-items:center;">';
    html += '<input type="text" id="mockSearch" placeholder="Search available players..." style="flex:1;padding:6px 10px;font-size:12px;background:var(--surface2);color:var(--text);border:1px solid var(--border);border-radius:4px;">';
    html += '<select id="mockPosFilter" style="padding:6px 8px;font-size:12px;background:var(--surface2);color:var(--text);border:1px solid var(--border);border-radius:4px;">';
    html += '<option value="all">All Pos</option>';
    ['C','1B','2B','3B','SS','LF','CF','RF','DH','SP','RP'].forEach(pos => {
      html += `<option value="${pos}">${pos}</option>`;
    });
    html += '</select>';
    html += '</div>';

    // Player table — sortable columns
    const mockCols = [
      {key:'dp',label:'DP',align:'left'}, {key:'name',label:'Player',align:'left'},
      {key:'pos',label:'Pos',align:'left'}, {key:'team',label:'Team',align:'left'},
      {key:'lcv',label:'LCV',align:'right'}, {key:'pnav',label:'PNAV',align:'right'},
      {key:'trend',label:'Trend',align:'right'}
    ];
    html += '<table style="width:100%;font-size:11px;border-collapse:collapse;" id="mockPlayerTable">';
    html += '<thead><tr style="background:var(--surface2);position:sticky;top:0;z-index:1;">';
    mockCols.forEach(mc => {
      const arrow = ms.sortCol === mc.key ? (ms.sortDir === -1 ? ' ▼' : ' ▲') : '';
      html += `<th class="mock-sort-th" data-sort="${mc.key}" style="text-align:${mc.align};padding:4px 6px;cursor:pointer;user-select:none;white-space:nowrap;">${mc.label}${arrow}</th>`;
    });
    html += '<th style="text-align:center;padding:4px 6px;">Pick</th>';
    html += '</tr></thead><tbody>';

    // Sort available for display (don't mutate actual order — BPA still uses original dp order)
    const sortedAvail = ms.available.slice().sort((a,b) => {
      let av = a[ms.sortCol], bv = b[ms.sortCol];
      if (typeof av === 'string') return ms.sortDir * av.localeCompare(bv);
      av = av || 0; bv = bv || 0;
      return ms.sortDir * (av - bv);
    });
    const top100 = sortedAvail.slice(0, 100);
    top100.forEach((p, i) => {
      const trendVal = (p.trend !== '' && p.trend !== undefined && p.trend !== null) ? parseFloat(p.trend) : null;
      const trendStr = trendVal !== null ? trendVal.toFixed(1) : '—';
      const trendColor = trendVal !== null ? (trendVal >= 0 ? 'var(--green)' : 'var(--red)') : 'var(--text2)';
      const tag = state.tags[p.name];
      const tagDot = tag === 'want' ? '<span style="color:var(--green);">●</span> ' : tag === 'avoid' ? '<span style="color:var(--red);">●</span> ' : tag === 'sleeper' ? '<span style="color:var(--yellow);">●</span> ' : tag === 'injured' ? '<span style="color:#a855f7;">●</span> ' : '';
      html += `<tr class="mock-player-row" style="border-bottom:1px solid var(--border);cursor:pointer;" data-name="${encodeURIComponent(p.name)}" data-pos="${p.pos}" data-type="${p.type}">`;
      html += `<td style="padding:4px 6px;font-weight:600;">${p.dp.toFixed(1)}</td>`;
      const enoB = p.eno_rank ? `<span class="eno-rank" title="Eno 150 Best Pitchers #${p.eno_rank}">P${p.eno_rank}</span> ` : '';
      html += `<td style="padding:4px 6px;">${tagDot}${p.name} ${enoB}</td>`;
      html += `<td style="padding:4px 6px;">${p.pos}</td>`;
      html += `<td style="padding:4px 6px;">${p.team}</td>`;
      html += `<td style="text-align:right;padding:4px 6px;">${p.lcv.toFixed(1)}</td>`;
      html += `<td style="text-align:right;padding:4px 6px;">${p.pnav.toFixed(1)}</td>`;
      html += `<td style="text-align:right;padding:4px 6px;color:${trendColor};">${trendStr}</td>`;
      html += `<td style="text-align:center;padding:4px 6px;"><button class="btn btn-primary mock-pick-btn" style="padding:2px 10px;font-size:10px;" data-name="${encodeURIComponent(p.name)}">Draft</button></td>`;
      html += '</tr>';
    });
    html += '</tbody></table>';
  } else if (isDone) {
    // Show final summary: all teams
    html += '<h3 style="font-size:14px;margin-bottom:8px;">Full Draft Results</h3>';
    LEAGUE_TEAMS.forEach((t, idx) => {
      const teamPicks = ms.picks.filter(p => p.teamIdx === idx);
      const isMine = t.mine;
      html += `<div style="background:var(--surface2);border-radius:6px;padding:8px;margin-bottom:8px;${isMine?'border:2px solid var(--accent);':''}">`;
      html += `<h4 style="font-size:12px;margin-bottom:4px;">${t.owner || t.name}${isMine?' <span style="color:var(--accent);">(YOU)</span>':''}</h4>`;
      html += '<div style="font-size:11px;display:flex;flex-wrap:wrap;gap:4px;">';
      teamPicks.forEach(p => {
        const rpPlayer = _plyrI(p.name);
        const rpEno = rpPlayer && rpPlayer.eno_rank ? ` <span class="eno-rank" style="font-size:8px;">P${rpPlayer.eno_rank}</span>` : '';
        html += `<span style="background:var(--bg);padding:2px 6px;border-radius:3px;">Rd${p.round} ${p.name}${rpEno} <small style="opacity:0.6">(${p.pos})</small></span>`;
      });
      html += '</div></div>';
    });
  } else {
    html += '<div style="padding:20px;text-align:center;color:var(--text2);font-size:13px;">Other teams are picking...</div>';
  }

  html += '</div>'; // end right panel
  html += '</div>'; // end flex container

  section.innerHTML = html;

  // Wire up events
  document.getElementById('mockResetBtn')?.addEventListener('click', () => {
    if (ms.timer) clearTimeout(ms.timer);
    mockState = null;
    renderMockDraft();
  });

  document.getElementById('mockApplyBtn')?.addEventListener('click', () => {
    const myPicks = ms.picks.filter(p => p.isUser);
    myPicks.forEach(p => {
      if (!state.drafted[p.name]) {
        state.drafted[p.name] = { time: Date.now(), mine: true };
        if (!state.myTeam.includes(p.name)) state.myTeam.push(p.name);
      }
    });
    save();
    mockState = null;
    currentTab = 'roster';
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'roster'));
    render();
  });

  // Search + filter for available players
  const searchEl = document.getElementById('mockSearch');
  const posFilter = document.getElementById('mockPosFilter');
  function filterMockPlayers() {
    const q = (searchEl?.value || '').toLowerCase();
    const pos = posFilter?.value || 'all';
    document.querySelectorAll('.mock-player-row').forEach(row => {
      const name = decodeURIComponent(row.dataset.name).toLowerCase();
      const rpos = row.dataset.pos;
      const rtype = row.dataset.type;
      let show = true;
      if (q && !name.includes(q)) show = false;
      if (pos !== 'all') {
        if (['SP','RP'].includes(pos)) {
          if (rpos !== pos) show = false;
        } else {
          if (rtype !== 'BAT' || rpos !== pos) show = false;
        }
      }
      row.style.display = show ? '' : 'none';
    });
  }
  searchEl?.addEventListener('input', filterMockPlayers);
  posFilter?.addEventListener('change', filterMockPlayers);

  // Sort column headers
  document.querySelectorAll('.mock-sort-th').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      if (ms.sortCol === col) ms.sortDir *= -1;
      else { ms.sortCol = col; ms.sortDir = -1; }
      renderMockDraftUI();
    });
  });

  // Draft buttons
  document.querySelectorAll('.mock-pick-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const name = decodeURIComponent(btn.dataset.name);
      mockPickUser(name);
      renderMockDraftUI();
      runMockUntilUserTurn(() => renderMockDraftUI());
    });
  });
}



// ══════════════════════════════════════════════════════════════════════════
// ██ ANALYTICS TAB
// ══════════════════════════════════════════════════════════════════════════
function renderAnalytics() {
  const section = document.getElementById('analyticsSection');
  document.getElementById('tableWrap').style.display = 'none';
  document.getElementById('rosterSection').style.display = 'none';
  document.getElementById('txnsSection').style.display = 'none';
  section.style.display = '';
  try { _renderAnalyticsInner(section); } catch(e) { section.innerHTML = '<div style="padding:20px;color:var(--red);"><b>Analytics Error:</b> ' + e.message + '<br><pre style="font-size:10px;margin-top:8px;">' + (e.stack||'').replace(/</g,'&lt;') + '</pre></div>'; console.error('Analytics render error:', e); }
}
function _renderAnalyticsInner(section) {

  // ── Shared helpers ──
  const myTeam = state.myTeam || [];
  const myProfiles = myTeam.map(n => {
    const p = _plyrI(n); if (!p) return null;
    const ki = getKeeperInfoCached(n);
    const pr = findProspect(n);
    return { name: n, p, ki, pr, lcv: p.lcv||0, primaryPos: p.primaryPos, isPit: ['SP','RP'].includes(p.primaryPos) };
  }).filter(Boolean);
  const myBat = myProfiles.filter(x => !x.isPit);
  const myPit = myProfiles.filter(x => x.isPit);

  // ── Shared category helpers ──
  const _batCats = ['avg','hr','r','rbi','sb','obp'];
  const _pitCats = ['era','whip','so','w','sv','qs'];
  // Compute projected season totals for ROSTERED (starting lineup) players only.
  function teamCatTotals(teamPlayers) {
    const allPlayers = teamPlayers.map(n => _plyrI(n)).filter(Boolean);
    const allBats = allPlayers.filter(p => !['SP','RP'].includes(p.primaryPos)).sort((a,b) => (b.lcv||0) - (a.lcv||0));
    const allSP = allPlayers.filter(p => p.primaryPos === 'SP').sort((a,b) => (b.lcv||0) - (a.lcv||0));
    const allRP = allPlayers.filter(p => p.primaryPos === 'RP').sort((a,b) => (b.lcv||0) - (a.lcv||0));
    const used = new Set();
    const bats = [];
    for (const pos of ['C','1B','2B','3B','SS','LF','CF','RF']) {
      const c = allBats.find(p => !used.has(p.name) && (p.primaryPos === pos || (p.pos||'').split('/').includes(pos)));
      if (c) { bats.push(c); used.add(c.name); }
    }
    const dh = allBats.find(p => !used.has(p.name));
    if (dh) { bats.push(dh); used.add(dh.name); }
    const pits = [...allSP.slice(0, 5), ...allRP.slice(0, 5)];
    const startNames = new Set([...bats.map(p=>p.name), ...pits.map(p=>p.name)]);
    const benchBats = allBats.filter(p => !startNames.has(p.name));
    const benchPits = [...allSP.slice(5), ...allRP.slice(5)];
    const benchLcv = [...benchBats, ...benchPits].reduce((s,p) => s + (p.lcv||0), 0);
    const bt = {};
    _batCats.forEach(cat => {
      if (cat === 'avg' || cat === 'obp') { let tp=0,w=0; bats.forEach(p=>{const pa=p.pa||500;w+=(p[cat]||0)*pa;tp+=pa;}); bt[cat]=tp>0?w/tp:0; }
      else bt[cat] = bats.reduce((s,p)=>s+(p[cat]||0),0);
    });
    const pt = {};
    _pitCats.forEach(cat => {
      if (cat === 'era' || cat === 'whip') { let ti=0,w=0; pits.forEach(p=>{const ip=p.ip||100;w+=(p[cat]||0)*ip;ti+=ip;}); pt[cat]=ti>0?w/ti:0; }
      else pt[cat] = pits.reduce((s,p)=>s+(p[cat]||0),0);
    });
    return { bat: bt, pit: pt, benchBats: benchBats.length, benchPits: benchPits.length, benchLcv: Math.round(benchLcv * 10) / 10 };
  }

  // Collapsible analytics panel helper (with localStorage persistence)
  function aPanel(id, title, icon, contentFn) {
    let collapsed = false;
    try { const s = localStorage.getItem('dpf_a_' + id); if (s === '1') collapsed = true; } catch(e) {}
    const arrow = collapsed ? '▸' : '▾';
    const bodyStyle = collapsed ? 'display:none;' : '';
    let h = `<div class="a-panel" style="background:var(--surface);border:1px solid var(--border);border-radius:10px;margin-bottom:16px;overflow:hidden;">`;
    h += `<div class="a-panel-hdr" data-panel="${id}" style="display:flex;align-items:center;gap:8px;padding:12px 16px;cursor:pointer;user-select:none;background:var(--surface2);">`;
    h += `<span class="a-arrow" style="font-size:12px;color:var(--text2);width:12px;">${arrow}</span>`;
    h += `<span style="font-size:16px;">${icon}</span>`;
    h += `<span style="font-weight:700;font-size:14px;">${title}</span>`;
    h += `</div>`;
    h += `<div class="a-panel-body" data-panel="${id}" style="padding:16px;${bodyStyle}">`;
    h += contentFn();
    h += `</div></div>`;
    return h;
  }

  let html = '<h2 style="font-size:22px;font-weight:800;margin-bottom:16px;">Analytics</h2>';
  html += '<div style="font-size:12px;color:var(--text2);margin-bottom:20px;">Advanced tools for managing your roster, evaluating trades, and tracking your season.</div>';

  // ═══════════════════════════════════════════════
  // 1. KEEPER PLANNER
  // ═══════════════════════════════════════════════
  html += aPanel('keeper-planner', 'Keeper Planner', '🔮', () => {
    let h = '<div style="font-size:11px;color:var(--text2);margin-bottom:10px;">Toggle players in/out of your 2027 keeper set. See total cost, rounds lost, and projected roster value.</div>';

    // Get all keepable players
    const keepable = myProfiles.filter(x => x.ki.keepable2027).sort((a,b) => b.ki.multiYearSurplus - a.ki.multiYearSurplus);
    const notKeepable = myProfiles.filter(x => !x.ki.keepable2027);

    // Initialize keeper plan state
    if (!state._keeperPlan) {
      // Default: keep the top N by multi-year surplus (up to the current keeper count)
      state._keeperPlan = {};
      keepable.slice(0, 5).forEach(x => { state._keeperPlan[x.name] = true; });
    }

    const plannedKeepers = keepable.filter(x => state._keeperPlan[x.name]);
    const totalCost = plannedKeepers.reduce((s,x) => s + (x.ki.cost2027 || 0), 0);
    const totalSurplus = plannedKeepers.reduce((s,x) => s + x.ki.surplus2027, 0);
    const roundsUsed = new Set(plannedKeepers.map(x => x.ki.cost2027));
    const keptLCV = plannedKeepers.reduce((s,x) => s + x.lcv, 0);

    // Summary bar
    h += '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px;">';
    h += `<div style="background:var(--surface2);border-radius:6px;padding:8px 12px;flex:1;min-width:100px;"><div style="font-size:10px;color:var(--text2);">Keepers</div><div style="font-size:20px;font-weight:800;color:var(--accent);">${plannedKeepers.length}</div></div>`;
    h += `<div style="background:var(--surface2);border-radius:6px;padding:8px 12px;flex:1;min-width:100px;"><div style="font-size:10px;color:var(--text2);">Rounds Used</div><div style="font-size:20px;font-weight:800;">${roundsUsed.size}</div></div>`;
    h += `<div style="background:var(--surface2);border-radius:6px;padding:8px 12px;flex:1;min-width:100px;"><div style="font-size:10px;color:var(--text2);">Keeper LCV</div><div style="font-size:20px;font-weight:800;color:var(--green);">${keptLCV.toFixed(1)}</div></div>`;
    h += `<div style="background:var(--surface2);border-radius:6px;padding:8px 12px;flex:1;min-width:100px;"><div style="font-size:10px;color:var(--text2);">Total Surplus</div><div style="font-size:20px;font-weight:800;color:${totalSurplus>=0?'var(--green)':'var(--red)'};">${totalSurplus.toFixed(1)}</div></div>`;
    h += '</div>';

    // Rounds visualization (which rounds are consumed by keepers)
    h += '<div style="margin-bottom:12px;"><div style="font-size:10px;color:var(--text2);margin-bottom:4px;">Draft Rounds (kept rounds highlighted)</div>';
    h += '<div style="display:flex;gap:2px;flex-wrap:wrap;">';
    for (let rd = 1; rd <= 31; rd++) {
      const kept = plannedKeepers.find(x => x.ki.cost2027 === rd);
      const bg = kept ? 'var(--accent)' : 'var(--surface2)';
      const fg = kept ? '#fff' : 'var(--text2)';
      const tip = kept ? `${kept.name} (R${rd})` : `Round ${rd} — open`;
      h += `<div title="${tip}" style="width:22px;height:22px;display:flex;align-items:center;justify-content:center;border-radius:3px;background:${bg};color:${fg};font-size:9px;font-weight:600;">${rd}</div>`;
    }
    h += '</div></div>';

    // Keepable players table with toggle checkboxes
    h += '<table style="width:100%;border-collapse:collapse;font-size:11px;">';
    h += '<thead><tr style="background:var(--surface2);font-size:10px;color:var(--text2);text-transform:uppercase;"><th style="padding:4px 6px;text-align:center;width:30px;">Keep</th><th style="padding:4px 6px;text-align:left;">Player</th><th style="padding:4px 6px;text-align:center;">Pos</th><th style="padding:4px 6px;text-align:right;">LCV</th><th style="padding:4px 6px;text-align:center;">2027 Rd</th><th style="padding:4px 6px;text-align:right;">Yrs Left</th><th style="padding:4px 6px;text-align:right;">Surplus</th><th style="padding:4px 6px;text-align:right;">MYS</th></tr></thead>';
    h += '<tbody>';
    keepable.forEach(x => {
      const checked = state._keeperPlan[x.name] ? 'checked' : '';
      const bg = state._keeperPlan[x.name] ? 'background:rgba(99,102,241,0.06);' : '';
      h += `<tr style="border-bottom:1px solid var(--border);${bg}">`;
      h += `<td style="padding:4px 6px;text-align:center;"><input type="checkbox" class="keeper-plan-cb" data-name="${encodeURIComponent(x.name)}" ${checked} style="cursor:pointer;"></td>`;
      h += `<td style="padding:4px 6px;font-weight:600;">${x.name}${_injBadge(x.name)}</td>`;
      h += `<td style="padding:4px 6px;text-align:center;"><span class="pos-badge pos-${x.primaryPos}">${x.primaryPos}</span></td>`;
      h += `<td style="padding:4px 6px;text-align:right;">${x.lcv.toFixed(1)}</td>`;
      h += `<td style="padding:4px 6px;text-align:center;font-weight:700;">R${x.ki.cost2027}</td>`;
      h += `<td style="padding:4px 6px;text-align:right;">${x.ki.yearsLeft}</td>`;
      h += `<td style="padding:4px 6px;text-align:right;color:${x.ki.surplus2027>=0?'var(--green)':'var(--red)'};">${x.ki.surplus2027.toFixed(1)}</td>`;
      h += `<td style="padding:4px 6px;text-align:right;color:${x.ki.multiYearSurplus>=0?'var(--green)':'var(--red)'};">${x.ki.multiYearSurplus.toFixed(1)}</td>`;
      h += '</tr>';
    });
    // Non-keepable section
    if (notKeepable.length > 0) {
      h += `<tr><td colspan="8" style="padding:8px 6px 4px;font-weight:700;font-size:10px;color:var(--text2);border-top:2px solid var(--border);">NOT KEEPABLE (${notKeepable.length})</td></tr>`;
      notKeepable.sort((a,b) => b.lcv - a.lcv).forEach(x => {
        h += `<tr style="opacity:0.5;border-bottom:1px solid var(--border);"><td style="padding:4px 6px;text-align:center;">—</td><td style="padding:4px 6px;">${x.name}</td><td style="padding:4px 6px;text-align:center;">${x.primaryPos}</td><td style="padding:4px 6px;text-align:right;">${x.lcv.toFixed(1)}</td><td colspan="4" style="padding:4px 6px;color:var(--red);font-size:10px;">Cannot keep — R${x.ki.effectiveRound} → cost below floor</td></tr>`;
      });
    }
    h += '</tbody></table>';

    // Compare to league
    h += '<div style="margin-top:12px;font-size:10px;color:var(--text2);">';
    const otherKeeperCounts = LEAGUE_TEAMS.filter(t => !t.mine).map(t => {
      const keepers = (state.keepers || []).length; // approximate
      return keepers;
    });
    h += `Tip: You have ${plannedKeepers.length} keepable players selected. Toggle players to explore different keeper configurations and see which rounds open up for the draft.`;
    h += '</div>';
    return h;
  });

  // ═══════════════════════════════════════════════
  // 2. TRADE HISTORY & REGRET TRACKER
  // ═══════════════════════════════════════════════
  html += aPanel('trade-history', 'Trade History & Regret Tracker', '📊', () => {
    let h = '<div style="font-size:11px;color:var(--text2);margin-bottom:10px;">Track completed trades and how player values have changed since.</div>';

    // Find all trade transactions involving my team
    const myTrades = [];
    const myTeamName = LEAGUE_TEAMS.find(t => t.mine)?.name || '';
    (state.transactions || []).filter(tx => tx.type === 'trade').forEach(tx => {
      // Resolve old team name in "Traded from X" to current league name
      const srcRaw = tx.cbsAction ? tx.cbsAction.replace('Traded from ', '') : '';
      const srcResolved = CBS_NAME_TO_LEAGUE[srcRaw] || srcRaw;

      // tx.from = the RECEIVING team. srcResolved = the SOURCE team.
      const iReceived = (tx.from === myTeamName);           // I'm the receiving team
      const iSent = (srcResolved === myTeamName);            // I'm the source team
      if (!iReceived && !iSent) return;

      const direction = iReceived ? 'received' : 'sent';
      const otherTeam = iReceived ? srcResolved : tx.from;
      myTrades.push({ ...tx, direction, otherTeam });
    });

    // Group trades by date
    const tradesByDate = {};
    myTrades.forEach(tx => {
      const d = tx.date || 'Unknown';
      if (!tradesByDate[d]) tradesByDate[d] = { received: [], sent: [], otherTeam: tx.otherTeam };
      tradesByDate[d][tx.direction].push(tx);
    });

    const tradeDates = Object.keys(tradesByDate).sort().reverse();

    if (tradeDates.length === 0) {
      h += '<div style="padding:20px;text-align:center;color:var(--text2);">No completed trades yet this season. Trades will appear here once they happen.</div>';
    } else {
      tradeDates.forEach(date => {
        const trade = tradesByDate[date];
        h += '<div style="background:var(--surface2);border-radius:8px;padding:10px;margin-bottom:8px;">';
        h += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;"><span style="font-weight:700;font-size:12px;">Trade with ${trade.otherTeam}</span><span style="font-size:10px;color:var(--text2);">${date}</span></div>`;

        // Sent vs Received
        h += '<div style="display:flex;gap:12px;">';

        // Sent
        h += '<div style="flex:1;"><div style="font-size:10px;color:var(--red);font-weight:700;margin-bottom:4px;">SENT →</div>';
        trade.sent.forEach(tx => {
          const p = _plyrI(tx.player);
          const lcv = p ? (p.lcv||0).toFixed(1) : '?';
          h += `<div style="font-size:11px;padding:2px 0;">${tx.player} <span style="color:var(--text2);">(${lcv} LCV)</span></div>`;
        });
        if (trade.sent.length === 0) h += '<div style="font-size:11px;color:var(--text2);">—</div>';
        h += '</div>';

        // Received
        h += '<div style="flex:1;"><div style="font-size:10px;color:var(--green);font-weight:700;margin-bottom:4px;">← RECEIVED</div>';
        trade.received.forEach(tx => {
          const p = _plyrI(tx.player);
          const lcv = p ? (p.lcv||0).toFixed(1) : '?';
          h += `<div style="font-size:11px;padding:2px 0;">${tx.player} <span style="color:var(--text2);">(${lcv} LCV)</span></div>`;
        });
        if (trade.received.length === 0) h += '<div style="font-size:11px;color:var(--text2);">—</div>';
        h += '</div>';
        h += '</div>';

        // Net value
        const sentLCV = trade.sent.reduce((s,tx) => { const p = _plyrI(tx.player); return s + (p ? (p.lcv||0) : 0); }, 0);
        const recvLCV = trade.received.reduce((s,tx) => { const p = _plyrI(tx.player); return s + (p ? (p.lcv||0) : 0); }, 0);
        const netLCV = recvLCV - sentLCV;
        const netClr = netLCV >= 0 ? 'var(--green)' : 'var(--red)';
        h += `<div style="margin-top:6px;padding-top:6px;border-top:1px solid var(--border);font-size:10px;text-align:right;">Net LCV: <span style="font-weight:700;color:${netClr};">${netLCV>=0?'+':''}${netLCV.toFixed(1)}</span> (current values)</div>`;
        h += '</div>';
      });
    }

    h += '<div style="margin-top:8px;font-size:10px;color:var(--text2);">Values shown reflect current projections. As the season progresses, check back to see how your trades played out.</div>';
    return h;
  });

  // ═══════════════════════════════════════════════
  // 3. INJURY REPLACEMENT VALUE
  // ═══════════════════════════════════════════════
  html += aPanel('injury-replacement', 'Injury Replacement Value', '🏥', () => {
    let h = '<div style="font-size:11px;color:var(--text2);margin-bottom:10px;">When a player hits the IL, see who on your bench or the waiver wire best replaces their production.</div>';

    // Find injured players on my roster
    const injuredMine = myProfiles.filter(x => {
      const inj = INJURY_MAP.get(x.name);
      return inj && (inj.status === 'IL' || inj.status === 'IL10' || inj.status === 'IL60' || inj.status === 'DTD');
    });

    if (injuredMine.length === 0) {
      h += '<div style="padding:16px;text-align:center;color:var(--green);font-weight:600;">No injured players on your roster! 🎉</div>';
    } else {
      injuredMine.sort((a,b) => b.lcv - a.lcv).forEach(inj => {
        const injInfo = INJURY_MAP.get(inj.name);
        const statusClr = injInfo.status === 'DTD' ? 'var(--orange)' : 'var(--red)';

        h += `<div style="background:var(--surface2);border-radius:8px;padding:10px;margin-bottom:8px;">`;
        h += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">`;
        h += `<span style="font-weight:700;font-size:12px;">${inj.name}</span>`;
        h += `<span style="font-size:9px;background:${statusClr};color:#fff;padding:1px 4px;border-radius:3px;">${injInfo.status}</span>`;
        h += `<span style="font-size:10px;color:var(--text2);">${inj.primaryPos} · ${inj.lcv.toFixed(1)} LCV</span>`;
        if (injInfo.injury) h += `<span style="font-size:10px;color:var(--text2);">— ${injInfo.injury}</span>`;
        if (injInfo.return) h += `<span style="font-size:10px;color:var(--accent);">ETA: ${injInfo.return}</span>`;
        h += '</div>';

        // Find replacements: bench players + FA at same position
        const replacements = [];
        // Bench: same position players on my roster with lower LCV (they'd replace this guy)
        myProfiles.forEach(x => {
          if (x.name === inj.name) return;
          const elig = (x.p.pos || x.primaryPos || '').split('/');
          if (elig.includes(inj.primaryPos) || (inj.isPit && x.isPit)) {
            const alsoInjured = INJURY_MAP.has(x.name);
            replacements.push({ name: x.name, lcv: x.lcv, pos: x.primaryPos, source: 'roster', injured: alsoInjured });
          }
        });

        // FA: top available players at same position
        const pool = inj.isPit ? PITCHERS : BATTERS;
        const drafted = new Set(Object.keys(state.drafted || {}));
        pool.filter(p => {
          if (drafted.has(p.name)) return false;
          const elig = (p.pos || p.primaryPos || '').split('/');
          return elig.includes(inj.primaryPos) || (inj.isPit && ['SP','RP'].includes(p.primaryPos) && ['SP','RP'].includes(inj.primaryPos));
        }).sort((a,b) => (b.lcv||0) - (a.lcv||0)).slice(0, 5).forEach(p => {
          replacements.push({ name: p.name, lcv: p.lcv||0, pos: p.primaryPos, source: 'FA' });
        });

        replacements.sort((a,b) => b.lcv - a.lcv);
        const topRepl = replacements.slice(0, 5);

        if (topRepl.length > 0) {
          h += '<table style="width:100%;font-size:11px;border-collapse:collapse;">';
          h += '<tr style="font-size:9px;color:var(--text2);text-transform:uppercase;"><th style="text-align:left;padding:2px 4px;">Replacement</th><th style="padding:2px 4px;">Pos</th><th style="text-align:right;padding:2px 4px;">LCV</th><th style="text-align:right;padding:2px 4px;">vs Injured</th><th style="text-align:center;padding:2px 4px;">Source</th></tr>';
          topRepl.forEach(r => {
            const diff = r.lcv - inj.lcv;
            const diffClr = diff >= 0 ? 'var(--green)' : 'var(--red)';
            const srcBadge = r.source === 'roster' ? '<span style="font-size:8px;background:var(--accent);color:#fff;padding:1px 3px;border-radius:2px;">ROSTER</span>' : '<span style="font-size:8px;background:var(--green);color:#fff;padding:1px 3px;border-radius:2px;">FA</span>';
            const injTag = r.injured ? ' <span style="color:var(--red);font-size:9px;">⚠ also hurt</span>' : '';
            h += `<tr style="border-bottom:1px solid var(--border);"><td style="padding:3px 4px;font-weight:600;">${r.name}${injTag}</td><td style="padding:3px 4px;text-align:center;">${r.pos}</td><td style="text-align:right;padding:3px 4px;">${r.lcv.toFixed(1)}</td><td style="text-align:right;padding:3px 4px;color:${diffClr};font-weight:600;">${diff>=0?'+':''}${diff.toFixed(1)}</td><td style="text-align:center;padding:3px 4px;">${srcBadge}</td></tr>`;
          });
          h += '</table>';
        } else {
          h += '<div style="font-size:10px;color:var(--text2);">No direct replacements found.</div>';
        }
        h += '</div>';
      });
    }

    return h;
  });

  // ═══════════════════════════════════════════════
  // 4. CATEGORY PACE TRACKER
  // ═══════════════════════════════════════════════
  html += aPanel('category-pace', 'Category Pace Tracker', '📈', () => {
    let h = '<div style="font-size:11px;color:var(--text2);margin-bottom:10px;">Project your end-of-season category totals and see where you rank. Identifies which categories have the best improvement ROI.</div>';

    const batCats = _batCats;
    const batLabels = {avg:'AVG',hr:'HR',r:'R',rbi:'RBI',sb:'SB',obp:'OBP'};
    const pitCats = _pitCats;
    const pitLabels = {era:'ERA',whip:'WHIP',so:'K',w:'W',sv:'SV',qs:'QS'};

    // Build data for all teams
    const teamCats = LEAGUE_TEAMS.map(t => {
      const pl = t.mine ? myTeam : (state.leagueTeams[t.name] || []);
      const totals = teamCatTotals(pl);
      return { name: t.owner || t.name, mine: t.mine, ...totals };
    });

    // Rank in each category
    function rankIn(cat, type, lowerIsBetter) {
      const vals = teamCats.map(t => ({ name: t.name, mine: t.mine, val: type === 'bat' ? t.bat[cat] : t.pit[cat] }));
      vals.sort((a,b) => lowerIsBetter ? (a.val - b.val) : (b.val - a.val));
      const myRank = vals.findIndex(v => v.mine) + 1;
      const myVal = vals.find(v => v.mine)?.val || 0;
      // Points in roto: rank 1 = 12 pts, rank 12 = 1 pt
      const pts = LEAGUE_TEAMS.length + 1 - myRank;
      return { rank: myRank, val: myVal, pts, all: vals };
    }

    // Batting categories table
    h += '<div style="margin-bottom:16px;">';
    h += '<div style="font-weight:700;font-size:12px;margin-bottom:6px;">Batting Categories (Projected)</div>';
    h += '<table style="width:100%;border-collapse:collapse;font-size:11px;">';
    h += '<thead><tr style="background:var(--surface2);font-size:10px;color:var(--text2);text-transform:uppercase;"><th style="padding:4px 6px;text-align:left;">Cat</th><th style="padding:4px 6px;text-align:right;">Your Total</th><th style="padding:4px 6px;text-align:center;">Rank</th><th style="padding:4px 6px;text-align:center;">Roto Pts</th><th style="padding:4px 6px;text-align:right;">1st Place</th><th style="padding:4px 6px;text-align:right;">Gap to Next</th></tr></thead>';
    h += '<tbody>';
    let totalBatPts = 0;
    batCats.forEach(cat => {
      const r = rankIn(cat, 'bat', false);
      totalBatPts += r.pts;
      const isRate = (cat === 'avg' || cat === 'obp');
      const fmt = v => isRate ? v.toFixed(3).replace(/^0\./,'.') : Math.round(v);
      const leader = r.all[0];
      // Gap to the rank above me (to improve 1 spot)
      const nextUp = r.rank > 1 ? r.all[r.rank - 2] : null;
      const gap = nextUp ? (isRate ? (nextUp.val - r.val).toFixed(3) : Math.round(nextUp.val - r.val)) : '—';
      const rankClr = r.rank <= 3 ? 'var(--green)' : r.rank >= 10 ? 'var(--red)' : 'var(--text)';
      h += `<tr style="border-bottom:1px solid var(--border);"><td style="padding:4px 6px;font-weight:700;">${batLabels[cat]}</td><td style="padding:4px 6px;text-align:right;">${fmt(r.val)}</td><td style="padding:4px 6px;text-align:center;font-weight:700;color:${rankClr};">${r.rank}/${LEAGUE_TEAMS.length}</td><td style="padding:4px 6px;text-align:center;">${r.pts}</td><td style="padding:4px 6px;text-align:right;color:var(--text2);">${fmt(leader.val)}</td><td style="padding:4px 6px;text-align:right;color:var(--accent);">${gap !== '—' ? '+' + gap : gap}</td></tr>`;
    });
    h += '</tbody></table></div>';

    // Pitching categories table
    h += '<div style="margin-bottom:16px;">';
    h += '<div style="font-weight:700;font-size:12px;margin-bottom:6px;">Pitching Categories (Projected)</div>';
    h += '<table style="width:100%;border-collapse:collapse;font-size:11px;">';
    h += '<thead><tr style="background:var(--surface2);font-size:10px;color:var(--text2);text-transform:uppercase;"><th style="padding:4px 6px;text-align:left;">Cat</th><th style="padding:4px 6px;text-align:right;">Your Total</th><th style="padding:4px 6px;text-align:center;">Rank</th><th style="padding:4px 6px;text-align:center;">Roto Pts</th><th style="padding:4px 6px;text-align:right;">1st Place</th><th style="padding:4px 6px;text-align:right;">Gap to Next</th></tr></thead>';
    h += '<tbody>';
    let totalPitPts = 0;
    pitCats.forEach(cat => {
      const lowerBetter = (cat === 'era' || cat === 'whip');
      const r = rankIn(cat, 'pit', lowerBetter);
      totalPitPts += r.pts;
      const isRate = (cat === 'era' || cat === 'whip');
      const fmt = v => isRate ? v.toFixed(2) : Math.round(v);
      const leader = r.all[0];
      const nextUp = r.rank > 1 ? r.all[r.rank - 2] : null;
      const gap = nextUp ? (isRate ? Math.abs(nextUp.val - r.val).toFixed(2) : Math.abs(Math.round(nextUp.val - r.val))) : '—';
      const rankClr = r.rank <= 3 ? 'var(--green)' : r.rank >= 10 ? 'var(--red)' : 'var(--text)';
      h += `<tr style="border-bottom:1px solid var(--border);"><td style="padding:4px 6px;font-weight:700;">${pitLabels[cat]}</td><td style="padding:4px 6px;text-align:right;">${fmt(r.val)}</td><td style="padding:4px 6px;text-align:center;font-weight:700;color:${rankClr};">${r.rank}/${LEAGUE_TEAMS.length}</td><td style="padding:4px 6px;text-align:center;">${r.pts}</td><td style="padding:4px 6px;text-align:right;color:var(--text2);">${fmt(leader.val)}</td><td style="padding:4px 6px;text-align:right;color:var(--accent);">${gap !== '—' ? (lowerBetter ? '-' : '+') + gap : gap}</td></tr>`;
    });
    h += '</tbody></table></div>';

    // Total projected roto points
    const totalPts = totalBatPts + totalPitPts;
    const maxPts = LEAGUE_TEAMS.length * (batCats.length + pitCats.length);
    h += '<div style="display:flex;gap:12px;flex-wrap:wrap;">';
    h += `<div style="background:var(--surface2);border-radius:6px;padding:8px 12px;flex:1;min-width:120px;"><div style="font-size:10px;color:var(--text2);">Total Roto Points</div><div style="font-size:24px;font-weight:800;color:var(--accent);">${totalPts} <span style="font-size:12px;color:var(--text2);">/ ${maxPts}</span></div></div>`;
    h += `<div style="background:var(--surface2);border-radius:6px;padding:8px 12px;flex:1;min-width:120px;"><div style="font-size:10px;color:var(--text2);">Batting Points</div><div style="font-size:20px;font-weight:800;">${totalBatPts}</div></div>`;
    h += `<div style="background:var(--surface2);border-radius:6px;padding:8px 12px;flex:1;min-width:120px;"><div style="font-size:10px;color:var(--text2);">Pitching Points</div><div style="font-size:20px;font-weight:800;">${totalPitPts}</div></div>`;
    h += '</div>';

    // ── Bench Depth Comparison ────────────────────────────────────
    h += '<div style="margin-top:16px;margin-bottom:8px;">';
    h += '<div style="font-weight:700;font-size:12px;margin-bottom:6px;">Bench Depth</div>';
    h += '<table style="width:100%;border-collapse:collapse;font-size:11px;">';
    h += '<thead><tr style="background:var(--surface2);font-size:10px;color:var(--text2);text-transform:uppercase;"><th style="padding:4px 6px;text-align:left;">Team</th><th style="padding:4px 6px;text-align:center;">Bat</th><th style="padding:4px 6px;text-align:center;">Pit</th><th style="padding:4px 6px;text-align:right;">Bench LCV</th><th style="padding:4px 6px;text-align:center;">Rank</th></tr></thead>';
    h += '<tbody>';
    // Rank teams by bench LCV
    const benchRanked = [...teamCats].sort((a,b) => b.benchLcv - a.benchLcv);
    benchRanked.forEach((t, i) => {
      const rank = i + 1;
      const isMine = t.mine;
      const bg = isMine ? 'rgba(74,107,255,0.08)' : (i % 2 === 0 ? 'transparent' : 'var(--surface)');
      const nameWt = isMine ? 'font-weight:700;' : '';
      const rankClr = rank <= 3 ? 'var(--green)' : rank >= 10 ? 'var(--red)' : 'var(--text)';
      h += `<tr style="background:${bg};border-bottom:1px solid var(--border);">`;
      h += `<td style="padding:4px 6px;${nameWt}">${isMine ? '★ ' : ''}${t.name}</td>`;
      h += `<td style="padding:4px 6px;text-align:center;">${t.benchBats}</td>`;
      h += `<td style="padding:4px 6px;text-align:center;">${t.benchPits}</td>`;
      h += `<td style="padding:4px 6px;text-align:right;font-weight:600;">${t.benchLcv.toFixed(1)}</td>`;
      h += `<td style="padding:4px 6px;text-align:center;font-weight:700;color:${rankClr};">${rank}</td>`;
      h += '</tr>';
    });
    h += '</tbody></table></div>';

    h += '<div style="margin-top:10px;font-size:10px;color:var(--text2);">Based on projected 2026 stats. Bench depth = total LCV of non-starting rostered players. Updates with CBS transactions.</div>';
    return h;
  });

  // ═══════════════════════════════════════════════
  // 5. PROSPECT CALL-UP WATCH
  // ═══════════════════════════════════════════════
  html += aPanel('prospect-watch', 'Prospect Call-Up Watch', '🔭', () => {
    let h = '<div style="font-size:11px;color:var(--text2);margin-bottom:10px;">Track top prospects rostered across the league. High-FV players nearing MLB readiness are flagged.</div>';

    // Collect all MiLB keepers across the league
    const allMilb = [];
    LEAGUE_TEAMS.forEach(t => {
      const milbList = t.mine ? (state.milbKeepers || []) : (DEFAULT_LEAGUE_MILB_KEEPERS[t.name] || []);
      const owner = t.owner || t.name;
      milbList.forEach(name => {
        const pr = findProspect(name);
        const p = _plyrI(name);
        const inj = INJURY_MAP.get(name);
        allMilb.push({ name, owner, mine: t.mine, pr, p, inj, fv: pr ? (pr.fv||0) : 0, rank: pr ? (pr.avg_rank||999) : 999, age: pr && pr.age != null ? pr.age : 99, pos: pr ? (pr.pos||'?') : (p ? p.primaryPos : '?'), team: pr ? (pr.team||'') : '' });
      });
    });

    // Sort by prospect rank
    allMilb.sort((a,b) => a.rank - b.rank);

    // Flag "ready" prospects: FV 55+, age 22+, or already in main player pool
    const readyThreshold = p => (p.fv >= 55 && p.age >= 21) || p.p;

    h += '<table style="width:100%;border-collapse:collapse;font-size:11px;">';
    h += '<thead><tr style="background:var(--surface2);font-size:10px;color:var(--text2);text-transform:uppercase;"><th style="padding:4px 6px;text-align:left;">Prospect</th><th style="padding:4px 6px;text-align:center;">Pos</th><th style="padding:4px 6px;text-align:center;">Org</th><th style="padding:4px 6px;text-align:center;">FV</th><th style="padding:4px 6px;text-align:center;">Rank</th><th style="padding:4px 6px;text-align:center;">Age</th><th style="padding:4px 6px;text-align:left;">Owner</th><th style="padding:4px 6px;text-align:center;">Status</th></tr></thead>';
    h += '<tbody>';
    allMilb.forEach(m => {
      const isMine = m.mine;
      const bg = isMine ? 'background:rgba(99,102,241,0.06);' : '';
      const ready = readyThreshold(m);
      const statusBadge = m.p ? '<span style="font-size:8px;background:var(--green);color:#fff;padding:1px 4px;border-radius:2px;">MLB READY</span>'
        : ready ? '<span style="font-size:8px;background:var(--orange);color:#fff;padding:1px 4px;border-radius:2px;">WATCH</span>'
        : '<span style="font-size:8px;background:var(--surface2);color:var(--text2);padding:1px 4px;border-radius:2px;">DEV</span>';
      const injBadge = m.inj ? ` <span style="color:var(--red);font-size:9px;">⚠</span>` : '';
      const fvClr = m.fv >= 65 ? 'var(--green)' : m.fv >= 55 ? 'var(--accent)' : 'var(--text)';
      h += `<tr style="border-bottom:1px solid var(--border);${bg}"><td style="padding:3px 6px;font-weight:${isMine?'700':'500'};">${m.name}${injBadge}${isMine?' ★':''}</td><td style="padding:3px 6px;text-align:center;"><span class="pos-badge pos-${m.pos}">${m.pos}</span></td><td style="padding:3px 6px;text-align:center;font-size:10px;">${m.team}</td><td style="padding:3px 6px;text-align:center;font-weight:700;color:${fvClr};">${m.fv || '—'}</td><td style="padding:3px 6px;text-align:center;">${m.rank < 900 ? '#'+Math.round(m.rank) : '—'}</td><td style="padding:3px 6px;text-align:center;">${m.age != null && m.age < 90 ? Number(m.age).toFixed(0) : '—'}</td><td style="padding:3px 6px;font-size:10px;">${m.owner}</td><td style="padding:3px 6px;text-align:center;">${statusBadge}</td></tr>`;
    });
    h += '</tbody></table>';

    // Summary counts
    const myReady = allMilb.filter(m => m.mine && readyThreshold(m));
    const leagueReady = allMilb.filter(m => readyThreshold(m));
    h += `<div style="margin-top:8px;font-size:10px;color:var(--text2);">${leagueReady.length} prospect(s) flagged as near-ready across the league, ${myReady.length} on your roster. "MLB READY" = already in the player pool. "WATCH" = FV 55+ and age 21+.</div>`;
    return h;
  });

  // ═══════════════════════════════════════════════
  // 6. START/SIT OPTIMIZER
  // ═══════════════════════════════════════════════
  html += aPanel('start-sit', 'Start/Sit Optimizer', '⚡', () => {
    let h = '<div style="font-size:11px;color:var(--text2);margin-bottom:10px;">Optimize your starting lineup based on projected performance. Identifies suboptimal lineup decisions.</div>';

    // Compute optimal starting lineup vs current
    const myPl = myTeam.map(n => _plyrI(n)).filter(Boolean);
    const overrides = state.rosterOverrides || {};
    const optimal = computeNeedsForTeam(myPl);
    const current = calcRosterLCV(myTeam, overrides);

    // Find players who should be starting but aren't
    const starters = new Set();
    for (const [pos, players] of Object.entries(optimal)) {
      players.forEach(p => starters.add(p.name));
    }

    const benchedStars = []; // Players on bench who should start
    const weakStarters = []; // Starters who could be upgraded from bench

    myProfiles.forEach(prof => {
      const isOptimalStarter = starters.has(prof.name);
      const isCurrentlyBenched = overrides[prof.name] === 'reserve' || overrides[prof.name] === 'il';

      if (isOptimalStarter && isCurrentlyBenched) {
        benchedStars.push(prof);
      }
    });

    // Compare starting LCV to optimal LCV
    const optimalLCV = calcRosterLCV(myTeam, {});
    const currentLCV = current;
    const lcvGap = optimalLCV.startingLCV - currentLCV.startingLCV;

    h += '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px;">';
    h += `<div style="background:var(--surface2);border-radius:6px;padding:8px 12px;flex:1;min-width:120px;"><div style="font-size:10px;color:var(--text2);">Current Starting LCV</div><div style="font-size:20px;font-weight:800;">${currentLCV.startingLCV.toFixed(1)}</div></div>`;
    h += `<div style="background:var(--surface2);border-radius:6px;padding:8px 12px;flex:1;min-width:120px;"><div style="font-size:10px;color:var(--text2);">Optimal Starting LCV</div><div style="font-size:20px;font-weight:800;color:var(--green);">${optimalLCV.startingLCV.toFixed(1)}</div></div>`;
    h += `<div style="background:var(--surface2);border-radius:6px;padding:8px 12px;flex:1;min-width:120px;"><div style="font-size:10px;color:var(--text2);">Optimization Gap</div><div style="font-size:20px;font-weight:800;color:${lcvGap > 0.5 ? 'var(--red)' : 'var(--green)'};">${lcvGap > 0.1 ? '+' + lcvGap.toFixed(1) + ' LCV on table' : 'Optimized ✓'}</div></div>`;
    h += '</div>';

    // Position-by-position comparison
    h += '<div style="font-weight:700;font-size:12px;margin-bottom:6px;">Position Breakdown</div>';
    h += '<table style="width:100%;border-collapse:collapse;font-size:11px;">';
    h += '<thead><tr style="background:var(--surface2);font-size:10px;color:var(--text2);text-transform:uppercase;"><th style="padding:4px 6px;text-align:left;">Pos</th><th style="padding:4px 6px;text-align:left;">Optimal Starter</th><th style="padding:4px 6px;text-align:right;">LCV</th><th style="padding:4px 6px;text-align:left;">Bench Alt</th><th style="padding:4px 6px;text-align:right;">Alt LCV</th><th style="padding:4px 6px;text-align:right;">Uplift</th></tr></thead>';
    h += '<tbody>';

    for (const [pos, slots] of Object.entries(ROSTER_SLOTS)) {
      const optPlayers = optimal[pos] || [];
      const slotsN = slots;
      for (let i = 0; i < slotsN; i++) {
        const starter = optPlayers[i];
        if (!starter) {
          h += `<tr style="border-bottom:1px solid var(--border);"><td style="padding:3px 6px;font-weight:600;">${pos}</td><td colspan="5" style="padding:3px 6px;color:var(--red);font-size:10px;">Empty slot</td></tr>`;
          continue;
        }
        // Find best bench alternative at this position
        const benchAlts = myProfiles.filter(p => {
          if (p.name === starter.name) return false;
          if (starters.has(p.name)) return false;
          const elig = (p.p.pos || p.primaryPos || '').split('/');
          return elig.includes(pos) || pos === 'DH';
        }).sort((a,b) => b.lcv - a.lcv);

        const bestAlt = benchAlts[0];
        const starterLcv = starter.lcv || 0;
        const altLcv = bestAlt ? bestAlt.lcv : 0;
        const uplift = altLcv - starterLcv;

        h += `<tr style="border-bottom:1px solid var(--border);">`;
        h += `<td style="padding:3px 6px;font-weight:600;">${pos}${i > 0 ? (i+1) : ''}</td>`;
        h += `<td style="padding:3px 6px;">${starter.name}${_injBadge(starter.name)}</td>`;
        h += `<td style="padding:3px 6px;text-align:right;">${starterLcv.toFixed(1)}</td>`;
        h += `<td style="padding:3px 6px;color:var(--text2);">${bestAlt ? bestAlt.name : '—'}</td>`;
        h += `<td style="padding:3px 6px;text-align:right;color:var(--text2);">${bestAlt ? altLcv.toFixed(1) : '—'}</td>`;
        h += `<td style="padding:3px 6px;text-align:right;color:${uplift > 0.5 ? 'var(--green)' : 'var(--text2)'};">${bestAlt && uplift > 0 ? '+'+uplift.toFixed(1) : '—'}</td>`;
        h += '</tr>';
      }
    }
    h += '</tbody></table>';

    h += '<div style="margin-top:8px;font-size:10px;color:var(--text2);">During the season, this will incorporate daily matchup data and recent hot/cold streaks for more specific start/sit advice.</div>';
    return h;
  });

  // ═══════════════════════════════════════════════
  // 7. MATCHUP PLANNER
  // ═══════════════════════════════════════════════
  html += aPanel('matchup-planner', 'Matchup Planner', '🎯', () => {
    let h = '<div style="font-size:11px;color:var(--text2);margin-bottom:10px;">Compare your projected category totals against any opponent to find strengths, weaknesses, and streaming opportunities.</div>';

    // Team selector
    if (!state._matchupOpponent) state._matchupOpponent = LEAGUE_TEAMS.find(t => !t.mine)?.name || '';
    const selOpp = state._matchupOpponent;

    h += '<div style="margin-bottom:12px;display:flex;align-items:center;gap:8px;">';
    h += '<span style="font-size:11px;font-weight:600;">Compare vs:</span>';
    h += '<select id="matchupOppSelect" style="padding:4px 8px;border-radius:6px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-size:12px;">';
    LEAGUE_TEAMS.filter(t => !t.mine).forEach(t => {
      const sel = t.name === selOpp ? ' selected' : '';
      h += `<option value="${t.name}"${sel}>${t.owner || t.name}</option>`;
    });
    h += '</select></div>';

    // Get opponent data — reuse teamCatTotals (starters only) from pace tracker
    const oppTeam = LEAGUE_TEAMS.find(t => t.name === selOpp);
    const oppPlayers = state.leagueTeams[selOpp] || [];
    const myTotals = teamCatTotals(myTeam);
    const oppTotals = teamCatTotals(oppPlayers);

    const oppName = oppTeam ? (oppTeam.owner || oppTeam.name) : selOpp;

    // Head-to-head comparison
    h += '<div style="display:flex;gap:16px;flex-wrap:wrap;">';

    // Batting
    h += '<div style="flex:1;min-width:280px;">';
    h += '<div style="font-weight:700;font-size:12px;margin-bottom:6px;">Batting</div>';
    h += '<table style="width:100%;border-collapse:collapse;font-size:11px;">';
    h += `<thead><tr style="background:var(--surface2);font-size:10px;color:var(--text2);text-transform:uppercase;"><th style="padding:4px 6px;text-align:left;">Cat</th><th style="padding:4px 6px;text-align:right;">You</th><th style="padding:4px 6px;text-align:right;">${oppName.slice(0,12)}</th><th style="padding:4px 6px;text-align:center;">Edge</th></tr></thead>`;
    h += '<tbody>';
    let myBatWins = 0, oppBatWins = 0;
    ['avg','hr','r','rbi','sb','obp'].forEach(cat => {
      const my = myTotals.bat[cat] || 0;
      const opp = oppTotals.bat[cat] || 0;
      const isRate = (cat === 'avg' || cat === 'obp');
      const fmt = v => isRate ? v.toFixed(3).replace(/^0\./,'.') : Math.round(v);
      const tied = isRate ? Math.abs(my - opp) < 0.0005 : Math.round(my) === Math.round(opp);
      const iWin = !tied && my > opp;
      const oppWin = !tied && opp > my;
      if (tied) { myBatWins += 0.5; oppBatWins += 0.5; }
      else if (iWin) myBatWins++; else oppBatWins++;
      const edgeIcon = tied ? '<span style="color:var(--text2);">½-½</span>' : iWin ? '<span style="color:var(--green);font-weight:700;">✓ You</span>' : `<span style="color:var(--red);">✗ ${oppName.slice(0,8)}</span>`;
      h += `<tr style="border-bottom:1px solid var(--border);"><td style="padding:3px 6px;font-weight:700;">${cat.toUpperCase()}</td><td style="padding:3px 6px;text-align:right;${iWin?'color:var(--green);font-weight:700;':''}">${fmt(my)}</td><td style="padding:3px 6px;text-align:right;${oppWin?'color:var(--green);font-weight:700;':''}">${fmt(opp)}</td><td style="padding:3px 6px;text-align:center;">${edgeIcon}</td></tr>`;
    });
    h += '</tbody></table>';
    const batFmt = v => v % 1 === 0 ? v : v.toFixed(1);
    h += `<div style="margin-top:4px;font-size:11px;font-weight:700;text-align:center;">Batting: <span style="color:var(--green);">${batFmt(myBatWins)}</span> - <span style="color:var(--red);">${batFmt(oppBatWins)}</span></div>`;
    h += '</div>';

    // Pitching
    h += '<div style="flex:1;min-width:280px;">';
    h += '<div style="font-weight:700;font-size:12px;margin-bottom:6px;">Pitching</div>';
    h += '<table style="width:100%;border-collapse:collapse;font-size:11px;">';
    h += `<thead><tr style="background:var(--surface2);font-size:10px;color:var(--text2);text-transform:uppercase;"><th style="padding:4px 6px;text-align:left;">Cat</th><th style="padding:4px 6px;text-align:right;">You</th><th style="padding:4px 6px;text-align:right;">${oppName.slice(0,12)}</th><th style="padding:4px 6px;text-align:center;">Edge</th></tr></thead>`;
    h += '<tbody>';
    let myPitWins = 0, oppPitWins = 0;
    ['era','whip','so','w','sv','qs'].forEach(cat => {
      const my = myTotals.pit[cat] || 0;
      const opp = oppTotals.pit[cat] || 0;
      const isRate = (cat === 'era' || cat === 'whip');
      const fmt = v => isRate ? v.toFixed(2) : Math.round(v);
      const lowerBetter = (cat === 'era' || cat === 'whip');
      const tied = isRate ? Math.abs(my - opp) < 0.005 : Math.round(my) === Math.round(opp);
      const iWin = !tied && (lowerBetter ? (my < opp) : (my > opp));
      const oppWin = !tied && (lowerBetter ? (opp < my) : (opp > my));
      if (tied) { myPitWins += 0.5; oppPitWins += 0.5; }
      else if (iWin) myPitWins++; else oppPitWins++;
      const edgeIcon = tied ? '<span style="color:var(--text2);">½-½</span>' : iWin ? '<span style="color:var(--green);font-weight:700;">✓ You</span>' : `<span style="color:var(--red);">✗ ${oppName.slice(0,8)}</span>`;
      h += `<tr style="border-bottom:1px solid var(--border);"><td style="padding:3px 6px;font-weight:700;">${cat === 'so' ? 'K' : cat.toUpperCase()}</td><td style="padding:3px 6px;text-align:right;${iWin?'color:var(--green);font-weight:700;':''}">${fmt(my)}</td><td style="padding:3px 6px;text-align:right;${oppWin?'color:var(--green);font-weight:700;':''}">${fmt(opp)}</td><td style="padding:3px 6px;text-align:center;">${edgeIcon}</td></tr>`;
    });
    h += '</tbody></table>';
    const pitFmt = v => v % 1 === 0 ? v : v.toFixed(1);
    h += `<div style="margin-top:4px;font-size:11px;font-weight:700;text-align:center;">Pitching: <span style="color:var(--green);">${pitFmt(myPitWins)}</span> - <span style="color:var(--red);">${pitFmt(oppPitWins)}</span></div>`;
    h += '</div>';
    h += '</div>';

    // Overall
    const totalWins = myBatWins + myPitWins;
    const totalLosses = oppBatWins + oppPitWins;
    const fmtH = v => v % 1 === 0 ? v : v.toFixed(1);
    h += `<div style="margin-top:12px;padding:10px;background:var(--surface2);border-radius:8px;text-align:center;"><span style="font-size:16px;font-weight:800;">Overall: <span style="color:var(--green);">${fmtH(totalWins)}</span> - <span style="color:var(--red);">${fmtH(totalLosses)}</span></span></div>`;

    h += '<div style="margin-top:8px;font-size:10px;color:var(--text2);">Based on projected 2026 season totals. During the season, this will show weekly matchup-specific data.</div>';
    return h;
  });

  section.innerHTML = html;

  // ── Wire panel collapse/expand ──
  section.querySelectorAll('.a-panel-hdr').forEach(hdr => {
    hdr.addEventListener('click', () => {
      const id = hdr.dataset.panel;
      const body = section.querySelector(`.a-panel-body[data-panel="${id}"]`);
      const arrow = hdr.querySelector('.a-arrow');
      if (!body) return;
      const isHidden = body.style.display === 'none';
      body.style.display = isHidden ? '' : 'none';
      if (arrow) arrow.textContent = isHidden ? '▾' : '▸';
      try { localStorage.setItem('dpf_a_' + id, isHidden ? '0' : '1'); } catch(e) {}
    });
  });

  // ── Wire Keeper Planner checkboxes ──
  section.querySelectorAll('.keeper-plan-cb').forEach(cb => {
    cb.addEventListener('change', () => {
      const name = decodeURIComponent(cb.dataset.name);
      if (!state._keeperPlan) state._keeperPlan = {};
      state._keeperPlan[name] = cb.checked;
      save();
      renderAnalytics();
    });
  });

  // ── Wire Matchup opponent selector ──
  const oppSelect = document.getElementById('matchupOppSelect');
  if (oppSelect) {
    oppSelect.addEventListener('change', () => {
      state._matchupOpponent = oppSelect.value;
      save();
      renderAnalytics();
    });
  }
}

// ── Help / Fantasy Advice ─────────────────────────────────────────────────
const CBS_ARTICLES = [
  {id:'37745473',title:'Deep sleepers, the best 40'},
  {id:'37746644',title:"Frank's Breakouts 2.0"},
  {id:'37745453',title:'Starting Pitcher Tiers 3.0'},
  {id:'37745454',title:'Relief Pitcher Tiers 3.0'},
  {id:'37746835',title:'2026 Fantasy baseball cheat sheet'},
  {id:'37744841',title:'Chances these one-hit wonders repeat'},
  {id:'37745665',title:'Favorite targets in every round'},
  {id:'37745451',title:'Outfield Tiers 3.0'},
  {id:'37745450',title:'Shortstop Tiers 3.0'},
  {id:'37744268',title:'Third Base Tiers 3.0'},
  {id:'37744267',title:'Second Base Tiers 3.0'},
  {id:'37744405',title:"Chris' Busts 2.0"},
  {id:'37743189',title:'What to know at every position'},
  {id:'37741912',title:"Scott's Sleepers 2.0"},
  {id:'37742126',title:'2026 spring storylines to know'},
  {id:'37739428',title:"Frank's Sleepers 2.0"},
  {id:'37738639',title:'H2H points mock: Go big!'},
  {id:'37738971',title:'Format specialists for points and Roto'},
  {id:'37738944',title:'2026 starting pitcher preview'},
  {id:'37738080',title:'Introducing the 2026 All-Rookie Team'},
  {id:'37738095',title:"Fallout: Green's elbow injury"},
  {id:'37737058',title:"Towers' Breakouts 2.0"},
  {id:'37736884',title:"Scott White's Tout Wars team"},
  {id:'37735788',title:'H2H points salary cap draft'},
  {id:'37735936',title:'February ADP risers and fallers'},
  {id:'37734856',title:"Scott's Busts 2.0"},
  {id:'37731069',title:'AL-only Roto salary cap draft'},
  {id:'37735000',title:'Important Spring Training updates'},
  {id:'37734083',title:'NL-only Roto salary cap draft'},
  {id:'37734956',title:'Spencer Strider 2026 outlook'},
  {id:'37732139',title:'Relief Pitcher Tiers 2.0'},
  {id:'37732138',title:'Starting Pitcher Tiers 2.0'},
  {id:'37732153',title:'Relief pitcher strategies for 2026'},
  {id:'37731841',title:"Frank's Busts 2.0"},
  {id:'37731693',title:'2026 outfield preview'},
  {id:'37731105',title:'Shortstop Tiers 2.0'},
  {id:'37731106',title:'Outfield Tiers 2.0'},
  {id:'37731055',title:'H2H categories mock draft'},
  {id:'37730006',title:'Third Base Tiers 2.0'},
  {id:'37730005',title:'Second Base Tiers 2.0'},
  {id:'37728988',title:'2026 starting pitcher strategies'},
  {id:'37730034',title:"Chris' Sleepers 2.0"},
  {id:'37729104',title:'Catcher Tiers 2.0'},
  {id:'37729168',title:'Believe It or Not: Spring buzz'},
  {id:'37729103',title:'First Base Tiers 2.0'},
  {id:'37729142',title:'2026 Week 1 Spring Training updates'},
  {id:'37728291',title:"Scott's Breakouts 2.0"},
  {id:'37728280',title:'2026 Shortstop Preview'},
  {id:'37726017',title:'Top 25 position battles for Fantasy'},
  {id:'37726171',title:'Biggest questions for AL teams'},
  {id:'37724370',title:'Outfield strategies for 2026'},
  {id:'37725376',title:'Biggest questions for NL teams'},
  {id:'37724739',title:'2026 Third Base Preview'},
  {id:'37724837',title:'Spring Training: 5 things to know'},
  {id:'37721622',title:'Shortstop strategies for 2026'},
  {id:'37723398',title:'2026 Second Base Preview'}
];

function renderHelp() {
  const section = document.getElementById('rosterSection');
  document.getElementById('tableWrap').style.display = 'none';
  document.getElementById('playerControls').style.display = 'none';
  section.style.display = '';

  // Categorize articles
  const cats = {
    'Tiers':        a => /tiers/i.test(a.title),
    'Sleepers':     a => /sleeper/i.test(a.title) || /deep sleep/i.test(a.title),
    'Busts':        a => /bust/i.test(a.title),
    'Breakouts':    a => /breakout/i.test(a.title),
    'Previews':     a => /preview/i.test(a.title) || /what to know/i.test(a.title) || /cheat sheet/i.test(a.title),
    'Strategy':     a => /strateg/i.test(a.title) || /format specialist/i.test(a.title) || /target/i.test(a.title),
    'Mock Drafts':  a => /mock|salary cap/i.test(a.title),
    'News & Notes': a => true
  };
  const used = new Set();
  const grouped = {};
  for (const [cat, fn] of Object.entries(cats)) {
    grouped[cat] = CBS_ARTICLES.filter(a => !used.has(a.id) && fn(a));
    grouped[cat].forEach(a => used.add(a.id));
  }

  const baseUrl = 'https://dpf.baseball.cbssports.com/news/';

  let html = '<div style="padding:20px;max-width:900px;">';
  html += '<h2 style="margin-bottom:4px;">Fantasy Advice</h2>';
  html += '<p style="font-size:13px;color:var(--text2);margin-bottom:20px;">' + CBS_ARTICLES.length + ' articles from CBS Fantasy. Click any article to open it in a new tab.</p>';

  for (const [cat, articles] of Object.entries(grouped)) {
    if (!articles.length) continue;
    html += `<div style="margin-bottom:20px;">`;
    html += `<h3 style="font-size:15px;color:var(--accent);margin-bottom:8px;border-bottom:1px solid var(--border);padding-bottom:4px;">${cat}</h3>`;
    html += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:8px;">`;
    articles.forEach(a => {
      html += `<a href="${baseUrl}${a.id}" target="_blank" rel="noopener" style="display:block;padding:10px 14px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);text-decoration:none;font-size:13px;transition:border-color .15s;" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">${a.title}</a>`;
    });
    html += `</div></div>`;
  }

  html += '</div>';
  section.innerHTML = html;
}


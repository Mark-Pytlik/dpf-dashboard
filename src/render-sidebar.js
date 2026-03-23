// ── Live Sidebar (roster + league LCV on main draft board) ──────────────
function renderLiveSidebar() {
  const sidebar = document.getElementById('liveSidebar');
  if (!sidebar) return;
  const myTeam = state.myTeam || [];
  const myKeepNames = new Set(state.keepers || []);
  const rosterSlots = {C:1,'1B':1,'2B':1,'3B':1,SS:1,LF:1,CF:1,RF:1,DH:1,SP:5,RP:5};
  const rosterPlayers = myTeam.map(n => _plyrI(n)).filter(Boolean);
  const slotAssign = {};
  for (const pos of Object.keys(rosterSlots)) slotAssign[pos] = [];
  const pending = [];
  rosterPlayers.forEach(p => {
    const pos = p.primaryPos;
    if (slotAssign[pos] && slotAssign[pos].length < rosterSlots[pos]) slotAssign[pos].push(p);
    else pending.push(p);
  });
  pending.forEach(p => {
    const positions = (p.pos || p.primaryPos || '').split('/');
    let placed = false;
    for (const pos of positions) {
      if (pos !== p.primaryPos && slotAssign[pos] && slotAssign[pos].length < rosterSlots[pos]) {
        slotAssign[pos].push(p); placed = true; break;
      }
    }
    if (!placed && !['SP','RP'].includes(p.primaryPos) && slotAssign['DH'].length < rosterSlots['DH']) {
      slotAssign['DH'].push(p);
    }
  });
  const myLCV = calcRosterLCV(myTeam, state.rosterOverrides || {});
  let html = '<div style="background:var(--surface2);border-radius:8px;padding:10px;margin-bottom:10px;">';
  html += `<h3 style="font-size:13px;margin-bottom:6px;color:var(--accent);">My Roster (${myTeam.length} players, LCV: ${myLCV.startingLCV.toFixed(1)})</h3>`;
  html += '<div style="display:flex;flex-wrap:wrap;gap:3px;">';
  for (const [pos, players] of Object.entries(slotAssign)) {
    const count = rosterSlots[pos];
    for (let i = 0; i < count; i++) {
      const p = players[i];
      if (p) {
        const isKeeper = myKeepNames.has(p.name);
        const bg = isKeeper ? 'rgba(99,102,241,0.15)' : 'rgba(16,185,129,0.15)';
        const border = isKeeper ? 'var(--accent)' : 'var(--green)';
        const enoTag = p.eno_rank ? ` <span class="eno-rank" style="font-size:8px;" title="Eno 150 Best Pitchers #${p.eno_rank}">P${p.eno_rank}</span>` : '';
        html += `<div style="background:${bg};border:1px solid ${border};border-radius:4px;padding:2px 6px;font-size:10px;white-space:nowrap;">`;
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

  // Live League LCV
  html += '<div style="background:var(--surface2);border-radius:8px;padding:10px;margin-bottom:10px;">';
  html += '<h3 style="font-size:13px;margin-bottom:6px;">Live League LCV</h3>';
  html += '<table style="width:100%;font-size:11px;border-collapse:collapse;">';
  html += '<tr style="color:var(--text2);"><th style="text-align:left;padding:2px 4px;">#</th><th style="text-align:left;padding:2px 4px;">Team</th><th style="text-align:right;padding:2px 4px;">Start</th><th style="text-align:right;padding:2px 4px;">Total</th></tr>';
  const leagueStats = LEAGUE_TEAMS.map(t => {
    const players = t.mine ? (state.myTeam || []) : (state.leagueTeams[t.name] || []);
    const ov = t.mine ? (state.rosterOverrides || {}) : (state.leagueRosterOverrides && state.leagueRosterOverrides[t.name] || {});
    const stats = calcRosterLCV(players, ov);
    return { name: t.owner || t.name, mine: t.mine, ...stats };
  }).sort((a, b) => b.startingLCV - a.startingLCV);
  leagueStats.forEach((t, rank) => {
    const style = t.mine ? 'background:rgba(99,102,241,0.1);font-weight:600;' : '';
    html += `<tr style="${style}"><td style="padding:2px 4px;">${rank+1}</td><td style="padding:2px 4px;">${t.name}${t.mine?' ★':''}</td><td style="text-align:right;padding:2px 4px;">${t.startingLCV.toFixed(1)}</td><td style="text-align:right;padding:2px 4px;">${t.totalLCV.toFixed(1)}</td></tr>`;
  });
  html += '</table></div>';
  sidebar.innerHTML = html;
}


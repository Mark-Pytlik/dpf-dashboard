// ── Draft Board view ──────────────────────────────────────────────────────
function renderDraftBoard() {
  const section = document.getElementById('rosterSection');
  const TOTAL_ROUNDS = 31;

  // Build keeper map: round -> [{name, pos, team, mine, teamPick}]
  // Assign each keeper to the specific pick slot of the team that owns them
  const keeperGrid = {};  // round -> pickSlot(1-12) -> keeper info
  for (let r = 1; r <= TOTAL_ROUNDS; r++) keeperGrid[r] = {};

  // Place keepers directly from DEFAULT_LEAGUE_KEEPERS (authoritative source)
  for (const [teamName, keepers] of Object.entries(DEFAULT_LEAGUE_KEEPERS)) {
    const team = LEAGUE_TEAMS.find(t => t.name === teamName);
    if (!team) continue;
    keepers.forEach(k => {
      const rd = k.rd;
      if (rd && rd >= 1 && rd <= TOTAL_ROUNDS) {
        const p = _plyrI(k.name);
        const nm = p ? p.name : k.name;
        keeperGrid[rd][team.pick] = {
          name: nm, pos: p ? p.primaryPos : '?', team: p ? p.team : '',
          mine: team.mine, ownerTeam: teamName, ownerPick: team.pick
        };
      }
    });
  }

  const myKeeperRds = new Set((state.keepers || []).map(k => state.keeperRounds && state.keeperRounds[k]).filter(Boolean));

  // ── Mock draft simulation for empty slots ──────────────────────────────
  const sim = simulateDraft();
  // Build a lookup: teamName+round -> simulated player
  const mockLookup = {};
  for (const [teamName, picks] of Object.entries(sim.teamResults)) {
    picks.forEach(pk => {
      mockLookup[teamName + '|' + pk.round] = pk;
    });
  }

  // State for mock visibility
  const showMock = state._boardShowMock || false;

  let html = '<h2 style="margin-bottom:8px;">Draft Board</h2>';
  html += `<p style="font-size:12px;color:var(--text2);margin-bottom:8px;">Snake draft, pick <b>#${DRAFT_POS}</b>. Each cell = one pick. <span style="color:var(--accent)">Purple</span> = your keepers. Gray = other teams' keepers. Empty cells = open picks.</p>`;

  html += `<div style="margin-bottom:12px;display:flex;gap:8px;align-items:center;">`;
  html += `<button id="boardMockToggle" class="btn ${showMock ? 'btn-primary' : 'btn-secondary'}" style="padding:4px 14px;font-size:12px;">${showMock ? 'Hide Mock Draft' : 'Show Mock Draft'}</button>`;
  html += `<span style="font-size:11px;color:var(--text2);">${showMock ? 'BPA simulation fills empty slots. Your projected picks highlighted.' : 'Toggle to preview BPA picks in empty slots.'}</span>`;
  html += `</div>`;

  // ── Grid: columns = pick slots 1-12, rows = rounds ──────────────────
  html += `<div style="overflow-x:auto;"><table class="board-grid" style="width:100%;border-collapse:collapse;font-size:11px;">`;
  html += '<thead><tr><th style="width:50px;padding:4px;">Rd</th>';
  for (let slot = 1; slot <= TEAMS; slot++) {
    // Which team picks at slot 1 in odd rounds? That's team with pick=slot
    // But in even rounds, slot 1 = team with pick 12. We just label by slot number.
    const team = LEAGUE_TEAMS.find(t => t.pick === slot);
    const isMe = team && team.mine;
    const bg = isMe ? 'background:rgba(99,102,241,0.1);' : '';
    html += `<th style="padding:4px;text-align:center;${bg}font-size:10px;" title="${team ? team.name : ''}">${isMe ? '<b style="color:var(--accent)">YOU</b>' : '#' + slot}</th>`;
  }
  html += '<th style="width:50px;padding:4px;text-align:center;">Open</th>';
  html += '</tr></thead><tbody>';

  let myDraftPicks = 0, myKeeperPicks = 0;

  for (let r = 1; r <= TOTAL_ROUNDS; r++) {
    const isEven = r % 2 === 0;
    const mySlot = isEven ? (TEAMS - DRAFT_POS + 1) : DRAFT_POS;
    const isMyKeeperRd = myKeeperRds.has(r);
    if (isMyKeeperRd) myKeeperPicks++; else myDraftPicks++;

    let openCount = 0;
    html += `<tr>`;
    html += `<td style="font-weight:700;padding:4px;text-align:center;background:var(--surface2);">Rd ${r}</td>`;

    for (let col = 1; col <= TEAMS; col++) {
      // col = team pick position (fixed column per team)
      const team = LEAGUE_TEAMS.find(t => t.pick === col);
      const isMe = team && team.mine;
      const keeper = keeperGrid[r][col];

      let cellBg = '', cellContent = '', cellTitle = '';

      // Compute overall pick number: in odd rounds team picks at slot=col, in even rounds slot=TEAMS-col+1
      const slot = isEven ? (TEAMS - col + 1) : col;
      const overallPick = (r - 1) * TEAMS + slot;
      const livePick = LIVE_PICK_ORDER[overallPick];

      if (keeper) {
        // Keeper slot
        if (keeper.mine) {
          cellBg = 'background:rgba(99,102,241,0.15);outline:2px solid #3b82f6;outline-offset:-2px;';
          cellContent = `<span style="color:var(--accent);font-weight:700;">${keeper.name}</span><br><small style="opacity:0.6">${keeper.pos} K</small>`;
        } else {
          cellBg = 'background:var(--surface2);outline:2px solid #3b82f6;outline-offset:-2px;';
          cellContent = `<span style="font-weight:600;opacity:0.7;">${keeper.name}</span><br><small style="opacity:0.5">${keeper.pos} K</small>`;
        }
        cellTitle = `${keeper.name} (${keeper.pos}) — kept by ${keeper.ownerTeam}`;
      } else if (livePick) {
        // Live draft pick from CBS
        const lp = _plyrI(livePick.name);
        const pos = lp ? lp.primaryPos : '';
        const lcv = lp ? (lp.lcv||0).toFixed(1) : '';
        const enoR = lp && lp.eno_rank ? ' P' + lp.eno_rank : '';
        if (livePick.mine) {
          cellBg = 'background:rgba(34,197,94,0.15);border:2px solid rgba(34,197,94,0.4);';
          cellContent = `<span style="color:#22c55e;font-weight:700;">${livePick.name}</span><br><small style="opacity:0.7">${pos} ${lcv}${enoR}</small>`;
        } else {
          cellBg = 'background:rgba(239,68,68,0.08);';
          cellContent = `<span style="font-weight:600;opacity:0.85;">${livePick.name}</span><br><small style="opacity:0.5">${pos} ${lcv}${enoR}</small>`;
        }
        cellTitle = `Pick #${overallPick}: ${livePick.name} (${pos}) LCV=${lcv}`;
      } else {
        // Empty/open slot
        openCount++;
        if (showMock && team) {
          const mockPick = mockLookup[team.name + '|' + r];
          if (mockPick) {
            if (isMe) {
              cellBg = 'background:rgba(99,102,241,0.08);border:2px dashed var(--accent);';
              cellContent = `<span style="color:var(--accent);font-weight:600;">${mockPick.name}</span><br><small style="opacity:0.6">${mockPick.pos} ${mockPick.dp.toFixed(1)}</small>`;
            } else {
              cellBg = 'background:rgba(255,255,255,0.02);border:1px dashed var(--border);';
              cellContent = `<span style="opacity:0.5;">${mockPick.name}</span><br><small style="opacity:0.35">${mockPick.pos}</small>`;
            }
            cellTitle = `Mock: ${mockPick.name} (${mockPick.pos}) DP=${mockPick.dp.toFixed(1)}`;
          } else {
            cellBg = isMe ? 'background:rgba(99,102,241,0.04);border:1px dashed var(--border);' : 'border:1px dashed var(--border);opacity:0.3;';
            cellContent = '—';
          }
        } else {
          cellBg = isMe ? 'background:rgba(99,102,241,0.04);' : '';
          cellContent = `<span style="opacity:0.15;">—</span>`;
        }
      }

      html += `<td style="padding:3px 4px;text-align:center;vertical-align:top;min-width:70px;${cellBg}" title="${cellTitle}">${cellContent}</td>`;
    }

    // Open count for this round
    const openClr = openCount >= 8 ? 'var(--green)' : openCount >= 4 ? 'var(--yellow)' : openCount > 0 ? 'var(--orange)' : 'var(--red)';
    html += `<td style="padding:4px;text-align:center;font-weight:700;color:${openClr};background:var(--surface2);">${openCount}</td>`;
    html += '</tr>';
  }
  // ── MiLB Keeper rows below draft grid ──
  // One row per MiLB slot (up to 4), columns aligned to teams
  const maxMilb = 4;
  for (let mi = 0; mi < maxMilb; mi++) {
    html += `<tr>`;
    html += `<td style="font-weight:700;padding:4px;text-align:center;background:var(--surface2);font-size:10px;">${mi === 0 ? 'MiLB' : ''}</td>`;
    for (let col = 1; col <= TEAMS; col++) {
      const team = LEAGUE_TEAMS.find(t => t.pick === col);
      const isMe = team && team.mine;
      const milbList = isMe ? (state.milbKeepers || []) : (DEFAULT_LEAGUE_MILB_KEEPERS[team.name] || []);
      const rk = milbList[mi];
      if (rk) {
        const p = _plyrI(rk);
        const pr = findProspect(rk);
        const pos = p ? p.primaryPos : (pr ? pr.pos : '?');
        const pnav = p ? (p.pnav||0).toFixed(1) : '';
        const prFV = pr ? `FV${pr.fv}` : '';
        const prRank = pr && pr.avg_rank ? `#${Math.round(pr.avg_rank)}` : '';
        const detail = p ? `${pos} ${pnav}` : [pos, prFV, prRank].filter(Boolean).join(' ');
        const bg = isMe ? 'background:rgba(99,102,241,0.12);' : 'background:rgba(245,158,11,0.08);';
        const clr = isMe ? 'color:var(--accent);' : 'color:var(--orange);';
        html += `<td style="padding:3px 4px;text-align:center;vertical-align:top;min-width:70px;${bg}" title="${rk} (${pos}) MiLB keeper"><span style="font-weight:600;font-size:10px;${clr}">${rk}</span><br><small style="opacity:0.5;font-size:9px;">${detail}</small></td>`;
      } else {
        html += `<td style="padding:3px 4px;text-align:center;opacity:0.15;">—</td>`;
      }
    }
    html += `<td style="background:var(--surface2);"></td>`;
    html += '</tr>';
  }

  html += '</tbody></table></div>';

  // Summary stats
  const totalKept = Object.keys(state.keeperRounds || {}).length;
  const myKept = (state.keepers || []).length;
  html += `<div style="margin-top:16px;padding:12px;background:var(--surface2);border-radius:8px;font-size:13px;line-height:1.8;">`;
  html += `<b>Your draft position:</b> #${DRAFT_POS} overall (snake) &nbsp;|&nbsp; `;
  html += `<b>Odd rounds:</b> pick ${DRAFT_POS} &nbsp;|&nbsp; <b>Even rounds:</b> pick ${TEAMS - DRAFT_POS + 1}<br>`;
  html += `<b>Total keepers:</b> ${totalKept} (yours: ${myKept}, other teams: ${totalKept - myKept}) &nbsp;|&nbsp; `;
  html += `<b>Your picks:</b> ${myKeeperPicks} keepers + ${myDraftPicks} open = ${TOTAL_ROUNDS} rounds`;
  html += `</div>`;

  // ── My Roster + Live League LCV panels ──────────────────────────────
  html += '<div style="display:flex;gap:16px;margin-top:16px;">';

  // My Roster panel
  const myTeam = state.myTeam || [];
  const myKeepNamesB = new Set(state.keepers || []);
  const rSlots = {C:1,'1B':1,'2B':1,'3B':1,SS:1,LF:1,CF:1,RF:1,DH:1,SP:5,RP:5};
  const rPlayers = myTeam.map(n => _plyrI(n)).filter(Boolean);
  const sAssign = {};
  for (const pos of Object.keys(rSlots)) sAssign[pos] = [];
  const pend = [];
  rPlayers.forEach(p => {
    const pos = p.primaryPos;
    if (sAssign[pos] && sAssign[pos].length < rSlots[pos]) sAssign[pos].push(p);
    else pend.push(p);
  });
  pend.forEach(p => {
    const positions = (p.pos || p.primaryPos || '').split('/');
    let placed = false;
    for (const pos of positions) {
      if (pos !== p.primaryPos && sAssign[pos] && sAssign[pos].length < rSlots[pos]) {
        sAssign[pos].push(p); placed = true; break;
      }
    }
    if (!placed && !['SP','RP'].includes(p.primaryPos) && sAssign['DH'].length < rSlots['DH']) {
      sAssign['DH'].push(p);
    }
  });
  const boardLCV = calcRosterLCV(myTeam, state.rosterOverrides || {});
  html += '<div style="flex:1;background:var(--surface2);border-radius:8px;padding:12px;">';
  html += `<h3 style="font-size:14px;margin-bottom:8px;color:var(--accent);">My Roster (${myTeam.length} players, LCV: ${boardLCV.startingLCV.toFixed(1)})</h3>`;
  html += '<div style="display:flex;flex-wrap:wrap;gap:4px;">';
  for (const [pos, players] of Object.entries(sAssign)) {
    const count = rSlots[pos];
    for (let i = 0; i < count; i++) {
      const p = players[i];
      if (p) {
        const isK = myKeepNamesB.has(p.name);
        const bg = isK ? 'rgba(99,102,241,0.15)' : 'rgba(16,185,129,0.15)';
        const brd = isK ? 'var(--accent)' : 'var(--green)';
        const eTag = p.eno_rank ? ` <span class="eno-rank" style="font-size:8px;">P${p.eno_rank}</span>` : '';
        html += `<div style="background:${bg};border:1px solid ${brd};border-radius:4px;padding:3px 8px;font-size:11px;white-space:nowrap;">`;
        html += `<b style="color:var(--text2);">${pos}</b> ${p.name}${_injBadge(p.name)}${eTag} <small style="opacity:0.6">${(p.lcv||0).toFixed(1)}</small>`;
        if (isK) html += ' <small style="color:var(--accent);">K</small>';
        html += '</div>';
      } else {
        html += `<div style="background:var(--bg);border:1px dashed var(--border);border-radius:4px;padding:3px 8px;font-size:11px;color:var(--text2);">`;
        html += `<b>${pos}</b> —</div>`;
      }
    }
  }
  html += '</div></div>';

  // Live League LCV panel
  html += '<div style="flex:0 0 320px;background:var(--surface2);border-radius:8px;padding:12px;">';
  html += '<h3 style="font-size:14px;margin-bottom:8px;">Live League LCV</h3>';
  html += '<table style="width:100%;font-size:12px;border-collapse:collapse;">';
  html += '<tr style="color:var(--text2);"><th style="text-align:left;padding:3px 6px;">#</th><th style="text-align:left;padding:3px 6px;">Team</th><th style="text-align:right;padding:3px 6px;">Start</th><th style="text-align:right;padding:3px 6px;">Total</th></tr>';
  const bLeagueStats = LEAGUE_TEAMS.map(t => {
    const pl = t.mine ? (state.myTeam || []) : (state.leagueTeams[t.name] || []);
    const ov = t.mine ? (state.rosterOverrides || {}) : (state.leagueRosterOverrides && state.leagueRosterOverrides[t.name] || {});
    const stats = calcRosterLCV(pl, ov);
    return { name: t.owner || t.name, mine: t.mine, ...stats };
  }).sort((a, b) => b.startingLCV - a.startingLCV);
  bLeagueStats.forEach((t, rank) => {
    const sty = t.mine ? 'background:rgba(99,102,241,0.1);font-weight:600;' : '';
    html += `<tr style="${sty}"><td style="padding:3px 6px;">${rank+1}</td><td style="padding:3px 6px;">${t.name}${t.mine?' ★':''}</td><td style="text-align:right;padding:3px 6px;">${t.startingLCV.toFixed(1)}</td><td style="text-align:right;padding:3px 6px;">${t.totalLCV.toFixed(1)}</td></tr>`;
  });
  html += '</table></div>';
  html += '</div>'; // end flex container

  section.innerHTML = html;

  // Mock draft toggle
  document.getElementById('boardMockToggle').addEventListener('click', () => {
    state._boardShowMock = !state._boardShowMock;
    renderDraftBoard();
  });

  // Undo buttons in the picks list
  section.querySelectorAll('.board-undo-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      undraftPlayer(decodeURIComponent(btn.dataset.name));
    });
  });

  section.style.display = '';
  document.getElementById('tableWrap').style.display = 'none';
}


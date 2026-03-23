// ── Draft position (snake draft) ─────────────────────────────────────────
const DRAFT_POS = 2;  // 2nd overall pick
const TEAMS = 12;
function myPickInRound(rd) {
  // Snake: odd rounds pick from top, even rounds pick from bottom
  return rd % 2 === 1 ? DRAFT_POS : (TEAMS - DRAFT_POS + 1);
}
function overallPick(rd) {
  return (rd - 1) * TEAMS + myPickInRound(rd);
}

// ── Position needs config (updated for LF/CF/RF) ─────────────────────────
const BASE_MULT = {C:1.0,'1B':0.4,'2B':1.2,'3B':1.2,SS:0.7,LF:1.0,CF:1.0,RF:1.0,DH:0.4,SP:1.0,RP:1.0};
const SCARCITY = {C:1.25,'1B':0.85,'2B':1.0,'3B':1.0,SS:1.0,LF:0.9,CF:0.95,RF:0.85,DH:0.75,SP:1.0,RP:1.15};
const ROSTER_SLOTS = {C:1,'1B':1,'2B':1,'3B':1,SS:1,LF:1,CF:1,RF:1,DH:1,SP:5,RP:5};

function getPosMult() {
  const counts = {};
  state.myTeam.forEach(n => {
    const p = _plyrI(n);
    if (p) { const pos = p.primaryPos; counts[pos] = (counts[pos]||0) + 1; }
  });
  const mult = {};
  for (const [pos, base] of Object.entries(BASE_MULT)) {
    const have = counts[pos] || 0;
    const need = ROSTER_SLOTS[pos] || 1;
    if (have >= need) mult[pos] = Math.max(0.2, base * 0.3);
    else if (have >= need * 0.5) mult[pos] = base * 0.7;
    else mult[pos] = base;
  }
  return mult;
}

function recalcPNAV() {
  const mult = getPosMult();
  ALL.forEach(p => {
    // For hitters, PNAV = best value across all eligible positions INCLUDING DH
    if (p.type === 'bat') {
      const positions = (p.pos || p.primaryPos || 'DH').split('/');
      if (!positions.includes('DH')) positions.push('DH');
      let best = 0;
      positions.forEach(pos => {
        const pm = mult[pos] || 1;
        const sc = SCARCITY[pos] || 1;
        const v = p.lcv * pm * sc;
        if (v > best) best = v;
      });
      p.pnav = Math.round(best * 100) / 100;
    } else {
      const pm = mult[p.primaryPos] || 1;
      const sc = SCARCITY[p.primaryPos] || 1;
      p.pnav = Math.round(p.lcv * pm * sc * 100) / 100;
    }
    p.upside = Math.round(p.lcv * p.ageFactor * 100) / 100;
    p.dp = Math.round((0.4 * p.lcv + 0.6 * p.pnav) * 100) / 100;
  });
}


function simulateDraft() {
  const TOTAL_ROUNDS = 31;

  // All kept player names across every team (keepers only, not mid-draft picks)
  const allKeptNames = new Set();
  LEAGUE_TEAMS.forEach(t => {
    const pl = t.mine ? (state.myTeam || []) : (state.leagueTeams[t.name] || []);
    pl.forEach(n => allKeptNames.add(n));
  });

  // Also exclude any player already drafted in the live draft (non-keeper picks)
  const allDraftedNames = new Set(Object.keys(state.drafted));

  // Available pool = not kept AND not already drafted in live draft, sorted by DP desc
  const available = ALL.filter(p => !allKeptNames.has(p.name) && !allDraftedNames.has(p.name))
    .sort((a, b) => (b.dp || 0) - (a.dp || 0));

  // Snake helper
  function pickInRound(rd, pos) {
    return rd % 2 === 1 ? pos : (TEAMS - pos + 1);
  }

  // For each team, find keeper rounds (from keeperRounds state) and live-drafted rounds
  const teamMeta = {};
  LEAGUE_TEAMS.forEach(t => {
    const keeperRds = new Set();
    const pl = t.mine ? (state.myTeam || []) : (state.leagueTeams[t.name] || []);
    pl.forEach(name => {
      const rd = state.keeperRounds[name];
      if (rd) keeperRds.add(rd);
    });
    teamMeta[t.name] = { pick: t.pick, keeperRds };
  });

  // Collect all open picks across all 12 teams
  const allOpenPicks = [];
  LEAGUE_TEAMS.forEach(t => {
    const meta = teamMeta[t.name];
    for (let rd = 1; rd <= TOTAL_ROUNDS; rd++) {
      if (!meta.keeperRds.has(rd)) {
        const overall = (rd - 1) * TEAMS + pickInRound(rd, meta.pick);
        allOpenPicks.push({ teamName: t.name, round: rd, overall });
      }
    }
  });

  // Sort by overall pick (draft order)
  allOpenPicks.sort((a, b) => a.overall - b.overall);

  // Assign BPA to each pick
  const teamResults = {};
  const teamCapital = {};
  const teamOpenRds = {};
  LEAGUE_TEAMS.forEach(t => {
    teamResults[t.name] = [];
    teamCapital[t.name] = 0;
    const meta = teamMeta[t.name];
    teamOpenRds[t.name] = TOTAL_ROUNDS - meta.keeperRds.size;
  });

  allOpenPicks.forEach((pick, i) => {
    if (i < available.length) {
      const player = available[i];
      teamResults[pick.teamName].push({
        name: player.name, dp: player.dp || 0, lcv: player.lcv || 0,
        pos: player.primaryPos || '?', team: player.team || '',
        round: pick.round, overall: pick.overall
      });
      teamCapital[pick.teamName] += player.dp || 0;
    }
  });

  // Round values
  for (const tn of Object.keys(teamCapital)) {
    teamCapital[tn] = Math.round(teamCapital[tn] * 100) / 100;
  }

  return { teamResults, teamCapital, teamOpenRds };
}

// ── Draft mechanics ───────────────────────────────────────────────────────
function draftPlayer(name, toMyTeam) {
  state.drafted[name] = { time: Date.now(), mine: toMyTeam };
  if (toMyTeam) state.myTeam.push(name);
  save();
  render();
}

function undraftPlayer(name) {
  delete state.drafted[name];
  state.myTeam = state.myTeam.filter(n => n !== name);
  save();
  render();
}

function clearAllDrafted() {
  if (!confirm('Clear all drafted players?')) return;
  state.drafted = {};
  state.myTeam = state.keepers.slice();
  save();
  render();
}

function calcRosterLCV(playerNames, overrides) {
  // Like calcOptimalLCV but respects manual roster overrides.
  // Players overridden to 'il' or 'reserve' are excluded from starting LCV.
  // Players overridden to a position slot are locked there first.
  if (!overrides || Object.keys(overrides).length === 0) {
    return calcOptimalLCV(playerNames);
  }

  const players = playerNames.map(n => _plyrI(n)).filter(Boolean);
  const used = new Set();
  const filledBat = {};
  const filledSP = [];
  const filledRP = [];

  // First: place all overridden players into their assigned slots
  players.forEach(p => {
    const ov = overrides[p.name];
    if (!ov) return;
    if (ov === 'il' || ov === 'reserve') { used.add(p.name); return; }
    if (ov === 'SP') { filledSP.push(p); used.add(p.name); return; }
    if (ov === 'RP') { filledRP.push(p); used.add(p.name); return; }
    // Batting slot override
    if (['C','1B','2B','3B','SS','LF','CF','RF','DH'].includes(ov)) {
      if (!filledBat[ov]) filledBat[ov] = [];
      filledBat[ov].push(p);
      used.add(p.name);
    }
  });

  // Remaining unassigned players get optimally placed in empty slots
  const remaining = players.filter(p => !used.has(p.name));
  const batters = remaining.filter(p => !['SP','RP'].includes(p.primaryPos)).sort((a,b) => (b.lcv||0) - (a.lcv||0));
  const sps = remaining.filter(p => p.primaryPos === 'SP').sort((a,b) => (b.lcv||0) - (a.lcv||0));
  const rps = remaining.filter(p => p.primaryPos === 'RP').sort((a,b) => (b.lcv||0) - (a.lcv||0));

  const batSlots = ['C','1B','2B','3B','SS','LF','CF','RF','DH'];
  for (const slot of batSlots) {
    if (slot === 'DH') continue;
    const have = (filledBat[slot] || []).length;
    if (have >= (ROSTER_SLOTS[slot] || 1)) continue;
    const best = batters.find(p => p.primaryPos === slot && !used.has(p.name));
    if (best) {
      if (!filledBat[slot]) filledBat[slot] = [];
      filledBat[slot].push(best); used.add(best.name);
    }
  }
  for (const slot of batSlots) {
    if (slot === 'DH') continue;
    const have = (filledBat[slot] || []).length;
    if (have >= (ROSTER_SLOTS[slot] || 1)) continue;
    const best = batters.find(p => {
      if (used.has(p.name)) return false;
      return (p.pos || p.primaryPos || '').split('/').includes(slot);
    });
    if (best) {
      if (!filledBat[slot]) filledBat[slot] = [];
      filledBat[slot].push(best); used.add(best.name);
    }
  }
  if (!(filledBat['DH'] || []).length || (filledBat['DH'] || []).length < (ROSTER_SLOTS['DH'] || 1)) {
    const best = batters.find(p => !used.has(p.name));
    if (best) {
      if (!filledBat['DH']) filledBat['DH'] = [];
      filledBat['DH'].push(best); used.add(best.name);
    }
  }

  // Fill remaining SP/RP slots
  while (filledSP.length < 5 && sps.length) {
    const sp = sps.shift();
    if (!used.has(sp.name)) { filledSP.push(sp); used.add(sp.name); }
  }
  while (filledRP.length < 5 && rps.length) {
    const rp = rps.shift();
    if (!used.has(rp.name)) { filledRP.push(rp); used.add(rp.name); }
  }

  let startingLCV = 0;
  for (const arr of Object.values(filledBat)) {
    for (const p of arr) startingLCV += (p.lcv || 0);
  }
  for (const p of filledSP.slice(0, 5)) startingLCV += (p.lcv || 0);
  for (const p of filledRP.slice(0, 5)) startingLCV += (p.lcv || 0);

  let totalLCV = 0;
  for (const p of players) totalLCV += (p.lcv || 0);

  return { startingLCV, totalLCV, count: players.length };
}

// ── Interactive Mock Draft ─────────────────────────────────────────────────

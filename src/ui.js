// ── Draft simulation engine ───────────────────────────────────────────────
// Simulates a BPA (best player available) draft for all open picks.
// Returns { teamResults: Map<teamName, [{name,dp,round,overall}]>, teamCapital: Map<teamName, number>, teamOpenRds: Map<teamName, number> }


// ── Autocomplete ──────────────────────────────────────────────────────────
const draftInput = document.getElementById('draftInput');
const draftAC = document.getElementById('draftAC');
let acIndex = -1, acMatches = [];

draftInput.addEventListener('input', () => {
  const q = draftInput.value.toLowerCase();
  if (q.length < 2) { draftAC.style.display = 'none'; return; }
  acMatches = ALL.filter(p => !state.drafted[p.name] && p.name.toLowerCase().includes(q)).slice(0,10);
  acIndex = -1;
  draftAC.innerHTML = acMatches.map((p,i) =>
    `<div data-i="${i}">${p.name} <small>${p.team} ${p.pos}</small></div>`
  ).join('');
  draftAC.style.display = acMatches.length ? 'block' : 'none';
  draftAC.querySelectorAll('div').forEach(d => {
    d.addEventListener('click', () => {
      draftInput.value = acMatches[parseInt(d.dataset.i)].name;
      draftAC.style.display = 'none';
    });
  });
});

draftInput.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown') { acIndex = Math.min(acIndex+1, acMatches.length-1); updateACHL(); e.preventDefault(); }
  else if (e.key === 'ArrowUp') { acIndex = Math.max(acIndex-1, 0); updateACHL(); e.preventDefault(); }
  else if (e.key === 'Enter') {
    if (acIndex >= 0 && acMatches[acIndex]) draftInput.value = acMatches[acIndex].name;
    draftAC.style.display = 'none';
    document.getElementById('draftBtn').click();
  }
  else if (e.key === 'Escape') draftAC.style.display = 'none';
});

function updateACHL() {
  draftAC.querySelectorAll('div').forEach((d,i) => d.classList.toggle('selected', i === acIndex));
}

document.getElementById('draftBtn').addEventListener('click', () => {
  const name = draftInput.value.trim();
  const match = _plyrI(name);
  if (match && !state.drafted[match.name]) {
    draftPlayer(match.name, document.getElementById('draftToMyTeam').checked);
    draftInput.value = '';
    draftAC.style.display = 'none';
  }
});

// ── Bulk import ───────────────────────────────────────────────────────────
function openBulkModal() { document.getElementById('bulkModal').classList.add('show'); }
function closeBulkModal() { document.getElementById('bulkModal').classList.remove('show'); }
function parseNameAndRound(line) {
  // Try formats: "Name, 1" or "Name Rd1" or "Name Rd 1" or "Name, Rd 1"
  let rd = null, name = line;
  // "Name, 1" or "Name, Rd 1" or "Name, Rd1"
  const commaMatch = name.match(/^(.+?),\s*(?:Rd\.?\s*)?(\d+)\s*$/i);
  if (commaMatch) { name = commaMatch[1].trim(); rd = parseInt(commaMatch[2]); }
  else {
    // "Name Rd1" or "Name Rd 1"
    const rdMatch = name.match(/^(.+?)\s+Rd\.?\s*(\d+)\s*$/i);
    if (rdMatch) { name = rdMatch[1].trim(); rd = parseInt(rdMatch[2]); }
  }
  return { name, rd };
}

function fuzzyFind(name) {
  let match = _plyrI(name);
  if (match) return match;
  // Try last name
  const parts = name.split(/\s+/);
  const last = parts[parts.length - 1].toLowerCase();
  const candidates = ALL.filter(p => p.name.toLowerCase().includes(last));
  if (candidates.length === 1) return candidates[0];
  if (parts.length >= 2) {
    const first = parts[0].toLowerCase();
    return candidates.find(p => p.name.toLowerCase().startsWith(first)) || null;
  }
  return null;
}

function processBulk() {
  const lines = document.getElementById('bulkArea').value.split('\n').map(l => l.trim()).filter(Boolean);
  let matched = 0, unmatched = [];
  if (!state.keeperRounds) state.keeperRounds = {};
  lines.forEach(line => {
    const { name, rd } = parseNameAndRound(line);
    const match = fuzzyFind(name);
    if (match && !state.drafted[match.name]) {
      state.drafted[match.name] = { time: Date.now(), mine: false, round: rd };
      if (rd) state.keeperRounds[match.name] = rd;
      matched++;
    } else if (!match) {
      unmatched.push(name);
    }
  });
  save();
  closeBulkModal();
  render();
  let msg = `Imported ${matched} of ${lines.length} players.`;
  if (unmatched.length) msg += `\nUnmatched: ${unmatched.join(', ')}`;
  alert(msg);
}

// ── CBS Team Name Mapping ─────────────────────────────────────────────────
function toggleCbsMap() {
  const panel = document.getElementById('cbsMapPanel');
  panel.style.display = panel.style.display === 'none' ? '' : 'none';
  if (panel.style.display !== 'none') renderCbsMapRows();
}

function renderCbsMapRows() {
  const container = document.getElementById('cbsMapRows');
  const entries = Object.entries(state.cbsTeamMap);
  if (entries.length === 0) {
    container.innerHTML = '<p style="font-size:11px;color:var(--text2);">No mappings yet. Paste your CBS draft log and click "Auto-detect from paste", or add manually.</p>';
    return;
  }
  let html = '<table style="width:100%;font-size:11px;border-collapse:collapse;">';
  html += '<tr style="color:var(--text2);"><th style="text-align:left;padding:2px 4px;">CBS Name</th><th style="text-align:left;padding:2px 4px;">→ League Team</th><th></th></tr>';
  entries.forEach(([cbsName, leagueName]) => {
    const team = LEAGUE_TEAMS.find(t => t.name === leagueName);
    const isMine = team && team.mine;
    html += `<tr>`;
    html += `<td style="padding:3px 4px;"><input type="text" class="cbs-map-cbs" value="${cbsName.replace(/"/g, '&quot;')}" style="width:100%;padding:2px 4px;font-size:11px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:3px;"></td>`;
    html += `<td style="padding:3px 4px;"><select class="cbs-map-league" style="width:100%;padding:2px 4px;font-size:11px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:3px;">`;
    html += `<option value="">-- select --</option>`;
    LEAGUE_TEAMS.forEach(t => {
      const label = (t.owner || t.name) + (t.mine ? ' (you)' : '');
      html += `<option value="${t.name}"${t.name === leagueName ? ' selected' : ''}>${label}</option>`;
    });
    html += `</select></td>`;
    html += `<td style="padding:3px 2px;"><button class="btn btn-secondary cbs-map-del" data-cbs="${encodeURIComponent(cbsName)}" style="padding:1px 6px;font-size:10px;">✕</button></td>`;
    html += `</tr>`;
  });
  html += '</table>';
  container.innerHTML = html;

  // Wire delete buttons
  container.querySelectorAll('.cbs-map-del').forEach(btn => {
    btn.addEventListener('click', () => {
      delete state.cbsTeamMap[decodeURIComponent(btn.dataset.cbs)];
      save();
      renderCbsMapRows();
    });
  });
}

function addCbsMapRow() {
  state.cbsTeamMap[''] = '';
  renderCbsMapRows();
}

function saveCbsMap() {
  const rows = document.querySelectorAll('#cbsMapRows tr');
  const newMap = {};
  rows.forEach(row => {
    const cbsInput = row.querySelector('.cbs-map-cbs');
    const leagueSelect = row.querySelector('.cbs-map-league');
    if (cbsInput && leagueSelect) {
      const cbsName = cbsInput.value.trim();
      const leagueName = leagueSelect.value;
      if (cbsName && leagueName) newMap[cbsName] = leagueName;
    }
  });
  state.cbsTeamMap = newMap;
  save();
  renderCbsMapRows();
  document.getElementById('pasteStatus').textContent = `Saved ${Object.keys(newMap).length} team mapping(s).`;
}

function autoDetectCbsTeams() {
  const text = document.getElementById('livePasteBox').value;
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const cbsNames = new Set();
  lines.forEach(line => {
    const m = line.match(/^\*?\s*Pick:\s*\d+\s*-\s*Team\s+(.+?)\s+selects\s+/i);
    if (m) cbsNames.add(m[1].trim());
  });
  if (cbsNames.size === 0) {
    document.getElementById('pasteStatus').textContent = 'No CBS pick lines found in paste. Paste the draft log first.';
    return;
  }
  // For each detected name, try to auto-match or add as unmapped
  cbsNames.forEach(cbsName => {
    if (state.cbsTeamMap[cbsName]) return; // already mapped
    // Try fuzzy match to league teams
    const lower = cbsName.toLowerCase();
    let found = LEAGUE_TEAMS.find(t => t.name.toLowerCase() === lower);
    if (!found) found = LEAGUE_TEAMS.find(t => {
      const ownerFirst = (t.owner || '').split(' ')[0].toLowerCase();
      return ownerFirst.length > 2 && lower.includes(ownerFirst);
    });
    if (!found) found = LEAGUE_TEAMS.find(t => {
      const parts = (t.owner || '').split(' ');
      const ownerLast = parts.length > 1 ? parts[parts.length-1].toLowerCase() : '';
      return ownerLast.length > 2 && lower.includes(ownerLast);
    });
    state.cbsTeamMap[cbsName] = found ? found.name : '';
  });
  save();
  renderCbsMapRows();
  document.getElementById('pasteStatus').textContent = `Detected ${cbsNames.size} CBS team name(s). Review and save mappings.`;
}

// ── Live Paste Panel ──────────────────────────────────────────────────────
function togglePastePanel() {
  const panel = document.getElementById('pastePanel');
  panel.classList.toggle('show');
}

function processLivePaste() {
  const text = document.getElementById('livePasteBox').value;
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  let matched = 0, unmatched = [];
  if (!state.keeperRounds) state.keeperRounds = {};

  // Build CBS team name -> league team mapping for CBS draft log format
  // Maps the CBS team name in draft log to our LEAGUE_TEAMS by matching owner names or team names
  function findLeagueTeam(cbsTeamName) {
    const lower = cbsTeamName.toLowerCase().trim();
    // Check saved CBS team map first
    const mapped = state.cbsTeamMap[cbsTeamName] || state.cbsTeamMap[cbsTeamName.trim()];
    if (mapped) {
      const t = LEAGUE_TEAMS.find(t => t.name === mapped);
      if (t) return t;
    }
    // Also check case-insensitive map keys
    for (const [k, v] of Object.entries(state.cbsTeamMap)) {
      if (k.toLowerCase().trim() === lower && v) {
        const t = LEAGUE_TEAMS.find(t => t.name === v);
        if (t) return t;
      }
    }
    // Direct match on team name
    let found = LEAGUE_TEAMS.find(t => t.name.toLowerCase() === lower);
    if (found) return found;
    // Partial match on team name
    found = LEAGUE_TEAMS.find(t => lower.includes(t.name.toLowerCase().substring(0, 10)) || t.name.toLowerCase().includes(lower.substring(0, 10)));
    if (found) return found;
    // Match on owner first name
    found = LEAGUE_TEAMS.find(t => {
      const ownerFirst = (t.owner || '').split(' ')[0].toLowerCase();
      return ownerFirst && lower.includes(ownerFirst);
    });
    if (found) return found;
    // Match on owner last name
    found = LEAGUE_TEAMS.find(t => {
      const parts = (t.owner || '').split(' ');
      const ownerLast = parts.length > 1 ? parts[parts.length-1].toLowerCase() : '';
      return ownerLast && lower.includes(ownerLast);
    });
    if (found) return found;
    // Check stored team owners too
    for (const [teamName, owner] of Object.entries(state.teamOwners)) {
      const ownerLower = owner.toLowerCase();
      if (lower.includes(ownerLower.split(' ')[0])) {
        return LEAGUE_TEAMS.find(t => t.name === teamName);
      }
    }
    return null;
  }

  lines.forEach(line => {
    // CBS draft room format: "Pick: X - Team [TeamName] selects [Last], [First]"
    const cbsMatch = line.match(/^\*?\s*Pick:\s*(\d+)\s*-\s*Team\s+(.+?)\s+selects\s+(.+?)\s*\*?$/i);
    if (cbsMatch) {
      const pickNum = parseInt(cbsMatch[1]);
      const cbsTeam = cbsMatch[2].trim();
      const rawName = cbsMatch[3].trim();
      // CBS uses "Last, First" format — flip to "First Last"
      let playerName = rawName;
      if (rawName.includes(',')) {
        const [last, first] = rawName.split(',').map(s => s.trim());
        playerName = first + ' ' + last;
      }
      const round = Math.ceil(pickNum / TEAMS);
      const leagueTeam = findLeagueTeam(cbsTeam);
      const isMine = leagueTeam && leagueTeam.mine;

      const match = fuzzyFind(playerName);
      if (match && !state.drafted[match.name]) {
        state.drafted[match.name] = { time: Date.now(), mine: !!isMine, round };
        state.keeperRounds[match.name] = round;
        if (isMine && !state.myTeam.includes(match.name)) state.myTeam.push(match.name);
        matched++;
      } else if (!match) {
        unmatched.push(playerName);
      }
      return; // Skip the generic parsing below
    }

    // Skip "joined" lines
    if (/joined$/i.test(line.replace(/\*/g, '').trim())) return;

    // Generic format parsing (existing logic)
    let cleaned = line;
    // Extract round from "Round X Pick Y:" format
    let extractedRd = null;
    const rdPick = cleaned.match(/^Round\s*(\d+)\s*Pick\s*\d+\s*[:.]?\s*/i);
    if (rdPick) { extractedRd = parseInt(rdPick[1]); cleaned = cleaned.replace(rdPick[0], ''); }
    // "X.YY Name" format (round.pick)
    const dotFmt = cleaned.match(/^(\d+)\.\d+\s+/);
    if (dotFmt) { extractedRd = parseInt(dotFmt[1]); cleaned = cleaned.replace(dotFmt[0], ''); }
    // Remove team in parens or after dash
    cleaned = cleaned.replace(/\s*\(.*?\)\s*$/, '');
    cleaned = cleaned.replace(/\s*-\s*[A-Z]{2,3}\s*$/, '');
    // Remove position tags
    cleaned = cleaned.replace(/\s+(SP|RP|C|1B|2B|3B|SS|LF|CF|RF|DH|OF)\s*$/i, '');
    // Remove dollar amounts
    cleaned = cleaned.replace(/\s*\$\d+\s*$/, '');

    // Now try parseNameAndRound for "Name, Rd X" or "Name Rd X" formats
    const { name, rd } = parseNameAndRound(cleaned.trim());
    const finalRd = rd || extractedRd;

    if (!name) return;

    const match = fuzzyFind(name);
    if (match && !state.drafted[match.name]) {
      state.drafted[match.name] = { time: Date.now(), mine: false, round: finalRd };
      if (finalRd) state.keeperRounds[match.name] = finalRd;
      matched++;
    } else if (!match) {
      unmatched.push(name);
    }
  });

  save();
  render();
  let status = `Processed ${matched} players.`;
  if (unmatched.length) status += ` Unmatched: ${unmatched.join(', ')}`;
  document.getElementById('pasteStatus').textContent = status;
  document.getElementById('livePasteBox').value = '';
}

// ── My Team Chips ─────────────────────────────────────────────────────────
function renderMyTeamChips() {
  const container = document.getElementById('myTeamChips');
  container.innerHTML = state.myTeam.map(name => {
    const p = _plyrI(name);
    const pos = p ? p.primaryPos : '?';
    const kpRd = state.keeperRounds && state.keeperRounds[name];
    const rdTag = kpRd ? ` <small style="color:var(--accent)">Rd${kpRd}</small>` : '';
    return `<div class="team-chip"><span class="pos-badge pos-${pos}" style="padding:1px 4px;font-size:10px;">${pos}</span>${name}${rdTag}<span class="remove" data-remove="${encodeURIComponent(name)}">&times;</span></div>`;
  }).join('');
  container.querySelectorAll('.remove').forEach(el => {
    el.addEventListener('click', () => removeFromTeam(decodeURIComponent(el.dataset.remove)));
  });

  // Show needs
  const counts = {};
  state.myTeam.forEach(n => {
    const p = _plyrI(n);
    if (p) counts[p.primaryPos] = (counts[p.primaryPos]||0) + 1;
  });
  const needs = [];
  for (const [pos, slots] of Object.entries(ROSTER_SLOTS)) {
    const have = counts[pos] || 0;
    const cls = have >= slots ? 'need-low' : have >= slots*0.5 ? 'need-med' : 'need-high';
    needs.push(`<span class="need-indicator ${cls}"></span>${pos} ${have}/${slots}`);
  }
  document.getElementById('teamNeeds').innerHTML = needs.join(' &nbsp; ');
}

function removeFromTeam(name) {
  state.myTeam = state.myTeam.filter(n => n !== name);
  if (state.drafted[name] && state.drafted[name].mine) state.drafted[name].mine = false;
  save();
  render();
}

// DUAL_ELIGIBLE moved to draft-engine.js (loaded earlier for render-roster dependency)


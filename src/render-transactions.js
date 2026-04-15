// ── Transactions Tab ──────────────────────────────────────────────────────
function renderTransactions() {
  const section = document.getElementById('txnsSection');
  document.getElementById('tableWrap').style.display = 'none';
  document.getElementById('rosterSection').style.display = 'none';
  try { _renderTransactionsInner(section); } catch(e) {
    section.innerHTML = '<div style="padding:20px;color:var(--red);"><b>Transactions Error:</b> ' + e.message + '<br><pre style="font-size:10px;margin-top:8px;">' + (e.stack||'').replace(/</g,'&lt;') + '</pre></div>';
    console.error('Transactions render error:', e);
  }
}
function _renderTransactionsInner(section) {

  // Combine CBS transactions + local user transactions
  const allTxns = [];

  // CBS transactions (scraped from league page)
  // Skip IL/activation moves — only show waiver adds, drops, and trades
  const SKIP_ACTIONS = /^(activated|placed on il|il|recalled|promoted|optioned)/i;
  CBS_TRANSACTIONS.forEach(txn => {
    txn.players.forEach(p => {
      const action = (p.action || '').replace(/^Added off Waivers$/i, 'Added');
      if (SKIP_ACTIONS.test(action)) return;
      allTxns.push({
        date: txn.date,
        team: txn.team,
        teamId: txn.teamId,
        player: p.name,
        pos: p.pos,
        mlbTeam: p.mlbTeam,
        action,
        effective: txn.effective,
        source: 'CBS'
      });
    });
  });

  // Local user transactions (exclude CBS-sourced to avoid duplicates with CBS_TRANSACTIONS above)
  (state.transactions || []).filter(tx => tx.source !== 'CBS').forEach(tx => {
    allTxns.push({
      date: tx.date || '',
      team: tx.from || 'You',
      teamId: 0,
      player: tx.player,
      pos: '',
      mlbTeam: '',
      action: tx.type === 'add' ? 'Added' : tx.type === 'drop' ? 'Dropped' : 'Trade',
      effective: '',
      source: tx.source || 'Local'
    });
  });

  let html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">';
  html += '<h2 style="font-size:18px;font-weight:700;">League Transactions</h2>';
  html += '<div style="display:flex;gap:8px;align-items:center;">';
  html += `<span style="font-size:10px;color:var(--text2);">Scraped: ${TXN_BUILD_TIME} · v__VERSION__</span>`;
  html += '<button id="checkCbsBtn" class="btn btn-secondary" style="padding:4px 10px;font-size:11px;display:inline-flex;align-items:center;gap:4px;cursor:pointer;">↻ Check for updates</button>';
  html += '</div></div>';

  // Filter controls
  html += '<div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center;">';
  html += '<select id="txnTeamFilter" style="padding:6px 10px;border-radius:6px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-size:12px;">';
  html += '<option value="all">All Teams</option>';
  const teamsSeen = new Set();
  CBS_TRANSACTIONS.forEach(t => teamsSeen.add(t.team));
  [...teamsSeen].sort().forEach(t => {
    html += `<option value="${t}">${t}</option>`;
  });
  html += '</select>';
  html += '<select id="txnTypeFilter" style="padding:6px 10px;border-radius:6px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-size:12px;">';
  html += '<option value="all">All Types</option><option value="Added">Adds</option><option value="Dropped">Drops</option><option value="Traded">Trades</option></select>';
  html += renderSplitToggle('txn-split-toggle');
  html += `<span style="margin-left:auto;font-size:11px;color:var(--text2);">${allTxns.length} moves</span>`;
  html += '</div>';

  // Transaction table
  html += '<div style="background:var(--surface);border-radius:10px;border:1px solid var(--border);overflow-x:auto;">';
  html += '<table style="width:100%;border-collapse:collapse;" id="txnTable">';
  html += '<thead><tr>';
  html += '<th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:var(--text2);background:var(--surface2);border-bottom:2px solid var(--border);">Date</th>';
  html += '<th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:var(--text2);background:var(--surface2);border-bottom:2px solid var(--border);">Team</th>';
  html += '<th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:var(--text2);background:var(--surface2);border-bottom:2px solid var(--border);">Action</th>';
  html += '<th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:var(--text2);background:var(--surface2);border-bottom:2px solid var(--border);">Player</th>';
  html += '<th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:var(--text2);background:var(--surface2);border-bottom:2px solid var(--border);">Pos</th>';
  html += '<th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:var(--text2);background:var(--surface2);border-bottom:2px solid var(--border);">MLB</th>';
  html += '<th style="padding:10px 12px;text-align:right;font-size:11px;text-transform:uppercase;color:var(--text2);background:var(--surface2);border-bottom:2px solid var(--border);">LCV</th>';
  html += '<th style="padding:10px 12px;text-align:right;font-size:11px;text-transform:uppercase;color:var(--text2);background:var(--surface2);border-bottom:2px solid var(--border);" title="Actual LCV from 2026 in-season stats">aLCV</th>';
  html += '<th style="padding:10px 12px;text-align:right;font-size:11px;text-transform:uppercase;color:var(--text2);background:var(--surface2);border-bottom:2px solid var(--border);" title="Actual minus Projected LCV">ΔLCV</th>';
  html += '<th style="padding:10px 12px;text-align:right;font-size:11px;text-transform:uppercase;color:var(--text2);background:var(--surface2);border-bottom:2px solid var(--border);">TV</th>';
  html += '<th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:var(--text2);background:var(--surface2);border-bottom:2px solid var(--border);">Effective</th>';
  html += '</tr></thead><tbody>';

  // Sort by date descending (most recent first)
  // Dates are like "3/16/26 12:55 PM ET" — fix 2-digit year and strip timezone for reliable parsing
  function parseTxDate(s) {
    if (!s) return new Date(0);
    let d = s.replace(/\s*ET\s*$/, '').trim();
    // Fix 2-digit year: "3/16/26" → "3/16/2026"
    d = d.replace(/^(\d{1,2})\/(\d{1,2})\/(\d{2})\b/, (m,mo,dy,yr) => `${mo}/${dy}/20${yr}`);
    return new Date(d);
  }
  allTxns.sort((a, b) => parseTxDate(b.date) - parseTxDate(a.date));

  allTxns.forEach((tx, idx) => {
    const isTrade = (tx.action || '').startsWith('Traded');
    const actionColor = tx.action === 'Added' ? 'var(--green)' : tx.action === 'Dropped' ? 'var(--red)' : 'var(--accent)';
    const actionIcon = tx.action === 'Added' ? '+' : tx.action === 'Dropped' ? '−' : '↔';
    let player = _plyrI(tx.player);
    // Cross-check MLB team to avoid name collisions (e.g. Cade Smith NYY vs CLE)
    // Normalize CBS↔FanGraphs abbreviations before comparing
    const _cbsFg = {KC:'KCR',SF:'SFG',TB:'TBR',WAS:'WSN',AZ:'ARI',CWS:'CHW',SD:'SDP'};
    const _nt = t => _cbsFg[t] || t;
    if (player && tx.mlbTeam && player.team && _nt(player.team) !== _nt(tx.mlbTeam)) player = null;
    const lcv = player ? (player.lcv||0).toFixed(1) : '—';
    let tvVal = '—';
    if (player) {
      const ki = getKeeperInfoCached(tx.player);
      const pr = findProspect(tx.player);
      const pv = pr ? Math.max(0, ((pr.fv||0) - 40) * 0.15) : 0;
      const plLcv = player.lcv || 0;
      if (!ki.keepable2027) { tvVal = (plLcv * 0.8 + pv).toFixed(1); }
      else { const eMYS = ki.multiYearSurplus > 1.0 ? ki.multiYearSurplus : (ki.multiYearSurplus||0) * 0.3; tvVal = (plLcv * 0.5 + Math.max(0, eMYS) * 1.0 + pv + (ki.yearsLeft >= 2 && ki.multiYearSurplus > 1.0 ? ki.yearsLeft * 0.3 : 0)).toFixed(1); }
    }
    const _myName = LEAGUE_TEAMS.find(t => t.mine)?.name || 'Okamotomami';
    const isMine = (tx.teamId === 4) || tx.team === _myName || tx.team === 'Father Jhon Kensy' || tx.team === 'Okamotomami' || (tx.action && (tx.action.includes(_myName) || tx.action.includes('Father Jhon Kensy') || tx.action.includes('Okamotomami')));
    const rowBg = isMine ? 'rgba(74,107,255,0.06)' : (idx % 2 === 0 ? 'transparent' : 'var(--surface)');
    const filterAction = isTrade ? 'Traded' : tx.action;
    html += `<tr class="txn-row" data-team="${tx.team}" data-action="${filterAction}" style="background:${rowBg};">`;
    html += `<td style="padding:8px 12px;font-size:12px;color:var(--text2);white-space:nowrap;">${tx.date}</td>`;
    html += `<td style="padding:8px 12px;font-size:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${tx.team}">${tx.team}</td>`;
    html += `<td style="padding:8px 12px;font-size:13px;font-weight:700;color:${actionColor};max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${tx.action}">${actionIcon} ${tx.action}</td>`;
    html += `<td style="padding:8px 12px;font-size:13px;font-weight:600;">${tx.player}</td>`;
    html += `<td style="padding:8px 12px;"><span class="pos-badge pos-${(tx.pos||'').split(',')[0]}">${tx.pos}</span></td>`;
    html += `<td style="padding:8px 12px;font-size:12px;color:var(--text2);">${tx.mlbTeam}</td>`;
    const aLcv = player && player.actualLcv != null ? player.actualLcv.toFixed(1) : '—';
    const dLcv = player && player.lcvDelta != null ? ((player.lcvDelta > 0 ? '+' : '') + player.lcvDelta.toFixed(1)) : '—';
    const dLcvClr = player && player.lcvDelta != null ? (player.lcvDelta >= 0 ? 'color:var(--green);' : 'color:var(--red);') : '';
    html += `<td style="padding:8px 12px;text-align:right;font-size:12px;font-variant-numeric:tabular-nums;">${lcv}</td>`;
    html += `<td style="padding:8px 12px;text-align:right;font-size:12px;font-variant-numeric:tabular-nums;">${aLcv}</td>`;
    html += `<td style="padding:8px 12px;text-align:right;font-size:12px;font-variant-numeric:tabular-nums;font-weight:600;${dLcvClr}">${dLcv}</td>`;
    html += `<td style="padding:8px 12px;text-align:right;font-size:12px;font-variant-numeric:tabular-nums;">${tvVal}</td>`;
    html += `<td style="padding:8px 12px;font-size:12px;color:var(--text2);">${tx.effective}</td>`;
    html += '</tr>';
  });

  if (allTxns.length === 0) {
    html += '<tr><td colspan="11" style="padding:40px;text-align:center;color:var(--text2);font-size:13px;">No transactions yet. Transactions will appear here once the scheduled task runs.</td></tr>';
  }

  html += '</tbody></table></div>';

  // Last updated note
  if (CBS_TRANSACTIONS.length > 0) {
    html += `<div style="margin-top:12px;font-size:11px;color:var(--text2);text-align:right;">Last scraped: ${CBS_TRANSACTIONS[0].date} · Source: CBS Fantasy</div>`;
  }

  section.innerHTML = html;

  // Wire filters
  const teamFilter = document.getElementById('txnTeamFilter');
  const typeFilter = document.getElementById('txnTypeFilter');
  const applyFilters = () => {
    const tVal = teamFilter.value;
    const aVal = typeFilter.value;
    document.querySelectorAll('#txnTable .txn-row').forEach(row => {
      const matchTeam = tVal === 'all' || row.dataset.team === tVal;
      const matchAction = aVal === 'all' || row.dataset.action === aVal;
      row.style.display = (matchTeam && matchAction) ? '' : 'none';
    });
  };
  if (teamFilter) teamFilter.addEventListener('change', applyFilters);
  if (typeFilter) typeFilter.addEventListener('change', applyFilters);

  // Wire time-split toggle
  section.querySelectorAll('.split-toggle').forEach(sel => {
    sel.addEventListener('change', () => {
      state._splitWindow = sel.value;
      applySplitWindow(sel.value);
      save();
      renderTransactions();
    });
  });

  // Wire Check CBS button — compare VERSION file on server vs baked-in version
  // If server has a newer build, hard-reload to get the latest dashboard
  // Falls back to hard-reload if fetching VERSION fails (e.g. file:// protocol)
  const checkBtn = document.getElementById('checkCbsBtn');
  if (checkBtn) checkBtn.addEventListener('click', async () => {
    checkBtn.disabled = true;
    checkBtn.textContent = '↻ Checking...';
    const currentVersion = '__VERSION__';
    try {
      // If opened as a local file, fetch won't work — skip straight to reload
      if (location.protocol === 'file:') throw new Error('local file');
      const resp = await fetch('./VERSION?v=' + Date.now(), {cache: 'no-store'});
      if (!resp.ok) throw new Error('Fetch failed: ' + resp.status);
      const serverVersion = (await resp.text()).trim();
      if (serverVersion !== currentVersion) {
        checkBtn.textContent = '↻ Updating to v' + serverVersion + '...';
        setTimeout(() => location.reload(true), 500);
      } else {
        checkBtn.textContent = '✓ Up to date (v' + currentVersion + ')';
        setTimeout(() => { checkBtn.textContent = '↻ Check for updates'; checkBtn.disabled = false; }, 3000);
      }
    } catch (err) {
      // Fetch failed (local file, network error, etc.) — hard-reload the page
      console.log('VERSION fetch unavailable, reloading page:', err.message);
      checkBtn.textContent = '↻ Reloading...';
      setTimeout(() => location.reload(true), 300);
    }
  });

}


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

  // Persisted sort state (column-header sorting)
  state._txnSort = state._txnSort || { key: 'date', dir: 'desc' };
  const tsort = state._txnSort;

  // Combine CBS transactions + local user transactions
  const allTxns = [];

  // CBS transactions (scraped from league page)
  // Skip IL/activation moves — only show waiver adds, drops, and trades
  const SKIP_ACTIONS = /^(activated|placed on il|il|recalled|promoted|optioned)/i;
  CBS_TRANSACTIONS.forEach(txn => {
    // Hide synthetic roster-reconciliation entries — they're internal state
    // corrections that populate state.drafted, not real league moves.
    if (txn.synthetic) return;
    const txTeam = txn.teamName || txn.team;
    txn.players.forEach(p => {
      if (p.synthetic) return;
      const action = (p.action || '').replace(/^Added off Waivers$/i, 'Added');
      if (SKIP_ACTIONS.test(action)) return;
      allTxns.push({
        date: txn.date,
        team: txTeam,
        teamId: txn.teamId,
        player: p.name,
        pos: p.pos,
        mlbTeam: p.mlbTeam,
        action,
        effective: txn.effective,
        synthetic: !!(txn.synthetic || p.synthetic),
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
  CBS_TRANSACTIONS.forEach(t => teamsSeen.add(t.teamName || t.team));
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
  //           [key, label, align]
  const txnCols = [
    ['date',      'Date',      'left'],
    ['team',      'Team',      'left'],
    ['action',    'Action',    'left'],
    ['player',    'Player',    'left'],
    ['pos',       'Pos',       'left'],
    ['mlbTeam',   'MLB',       'left'],
    ['lcvVal',    'LCV',       'right'],
    ['aLcvVal',   'aLCV+',     'right', 'aLCV+ on wRC+ scale: 100 = pool average (batter/SP/RP), 115 = +1sigma. From 2026 in-season stats.'],
    ['dLcvVal',   'ΔLCV',      'right', 'Actual minus Projected LCV'],
    ['tvVal',     'TV',        'right'],
    ['effective', 'Effective', 'left'],
  ];
  txnCols.forEach(([k, label, align, tip]) => {
    const isActive = tsort.key === k;
    const arrow = isActive ? (tsort.dir === 'asc' ? ' ▲' : ' ▼') : '';
    const activeColor = isActive ? 'color:var(--accent);' : 'color:var(--text2);';
    const titleAttr = tip ? ` title="${tip}"` : '';
    html += `<th data-txn-sort="${k}"${titleAttr} style="padding:10px 12px;text-align:${align};font-size:11px;text-transform:uppercase;${activeColor};background:var(--surface2);border-bottom:2px solid var(--border);cursor:pointer;user-select:none;">${label}${arrow}</th>`;
  });
  html += '</tr></thead><tbody>';

  // Parse dates up front for sorting ("3/16/26 12:55 PM ET" → Date object)
  function parseTxDate(s) {
    if (!s) return new Date(0);
    let d = s.replace(/\s*ET\s*$/, '').trim();
    d = d.replace(/^(\d{1,2})\/(\d{1,2})\/(\d{2})\b/, (m,mo,dy,yr) => `${mo}/${dy}/20${yr}`);
    return new Date(d);
  }

  // Enrich each row with numeric/canonical fields used for sorting.
  const _cbsFg = {KC:'KCR',SF:'SFG',TB:'TBR',WAS:'WSN',AZ:'ARI',CWS:'CHW',SD:'SDP'};
  const _nt = t => _cbsFg[t] || t;
  allTxns.forEach(tx => {
    tx._dateTs = parseTxDate(tx.date).getTime();
    let player = _plyrI(tx.player);
    if (player && tx.mlbTeam && player.team && _nt(player.team) !== _nt(tx.mlbTeam)) player = null;
    tx._player = player;
    tx.lcvVal = player ? (player.lcv || 0) : null;
    tx.aLcvVal = player && player.aLCVPlus != null ? player.aLCVPlus : null;
    tx.dLcvVal = player && player.lcvDelta != null ? player.lcvDelta : null;
    let tvNum = null;
    if (player) {
      const ki = getKeeperInfoCached(tx.player);
      const pr = findProspect(tx.player);
      const pv = pr ? Math.max(0, ((pr.fv||0) - 40) * 0.15) : 0;
      const plLcv = player.lcv || 0;
      if (!ki.keepable2027) { tvNum = plLcv * 0.8 + pv; }
      else { const eMYS = ki.multiYearSurplus > 1.0 ? ki.multiYearSurplus : (ki.multiYearSurplus||0) * 0.3; tvNum = plLcv * 0.5 + Math.max(0, eMYS) * 1.0 + pv + (ki.yearsLeft >= 2 && ki.multiYearSurplus > 1.0 ? ki.yearsLeft * 0.3 : 0); }
    }
    tx.tvVal = tvNum;
  });

  // Apply current sort
  const _NUM_KEYS = new Set(['lcvVal', 'aLcvVal', 'dLcvVal', 'tvVal']);
  const _d = tsort.dir === 'asc' ? 1 : -1;
  allTxns.sort((a, b) => {
    if (tsort.key === 'date') return (a._dateTs - b._dateTs) * _d;
    if (_NUM_KEYS.has(tsort.key)) {
      const av = a[tsort.key], bv = b[tsort.key];
      // Nulls always sink to the bottom regardless of direction
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return (av - bv) * _d;
    }
    const av = (a[tsort.key] || '').toString();
    const bv = (b[tsort.key] || '').toString();
    return av.localeCompare(bv) * _d;
  });

  allTxns.forEach((tx, idx) => {
    const isTrade = (tx.action || '').startsWith('Traded');
    const actionColor = tx.action === 'Added' ? 'var(--green)' : tx.action === 'Dropped' ? 'var(--red)' : 'var(--accent)';
    const actionIcon = tx.action === 'Added' ? '+' : tx.action === 'Dropped' ? '−' : '↔';
    const player = tx._player;
    const lcv = tx.lcvVal != null ? tx.lcvVal.toFixed(1) : '—';
    const tvVal = tx.tvVal != null ? tx.tvVal.toFixed(1) : '—';
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
    const aLcv = tx.aLcvVal != null ? Math.round(tx.aLcvVal).toString() : '—';
    const aLcvClr = tx.aLcvVal != null ? (tx.aLcvVal >= 115 ? 'color:var(--green);font-weight:700;' : tx.aLcvVal >= 100 ? 'color:var(--green);' : tx.aLcvVal <= 85 ? 'color:var(--red);' : '') : '';
    const dLcv = tx.dLcvVal != null ? ((tx.dLcvVal > 0 ? '+' : '') + tx.dLcvVal.toFixed(1)) : '—';
    const dLcvClr = tx.dLcvVal != null ? (tx.dLcvVal >= 0 ? 'color:var(--green);' : 'color:var(--red);') : '';
    html += `<td style="padding:8px 12px;text-align:right;font-size:12px;font-variant-numeric:tabular-nums;">${lcv}</td>`;
    html += `<td style="padding:8px 12px;text-align:right;font-size:12px;font-variant-numeric:tabular-nums;${aLcvClr}">${aLcv}</td>`;
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

  // Column-header sorting — toggle direction on active column, or switch to a
  // new column using its default direction (asc for strings, desc for numbers/date)
  const _TXN_STR_KEYS = new Set(['team', 'action', 'player', 'pos', 'mlbTeam', 'effective']);
  section.querySelectorAll('[data-txn-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.getAttribute('data-txn-sort');
      if (state._txnSort.key === key) {
        state._txnSort.dir = state._txnSort.dir === 'desc' ? 'asc' : 'desc';
      } else {
        state._txnSort.key = key;
        state._txnSort.dir = _TXN_STR_KEYS.has(key) ? 'asc' : 'desc';
      }
      save();
      renderTransactions();
    });
  });

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


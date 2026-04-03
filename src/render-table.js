// ── Render ─────────────────────────────────────────────────────────────────
function render() {
  const isPlayerTab = (DPF.ui.currentTab === 'all');
  document.getElementById('playerControls').style.display = isPlayerTab ? 'flex' : 'none';
  document.getElementById('draftPanel').classList.toggle('show', DPF.ui.currentTab === 'all' && state._mode === 'draft');
  document.getElementById('tableWrap').style.display = isPlayerTab ? '' : 'none';
  document.getElementById('liveSidebar').style.display = 'none';
  document.getElementById('rosterSection').style.display = ['myRoster','roster','board','mock','league','futures'].includes(DPF.ui.currentTab) ? '' : 'none';
  document.getElementById('txnsSection').style.display = DPF.ui.currentTab === 'txns' ? '' : 'none';
  document.getElementById('analyticsSection').style.display = DPF.ui.currentTab === 'analytics' ? '' : 'none';

  if (DPF.ui.currentTab === 'analytics') { renderAnalytics(); return; }
  if (DPF.ui.currentTab === 'txns') { renderTransactions(); return; }
  if (DPF.ui.currentTab === 'myRoster') { state._rosterTeam = '__mine__'; renderRoster(); return; }
  if (DPF.ui.currentTab === 'roster') { renderRoster(); return; }
  if (DPF.ui.currentTab === 'board') { renderDraftBoard(); return; }
  if (DPF.ui.currentTab === 'mock') { renderMockDraft(); return; }
  if (DPF.ui.currentTab === 'league') { renderLeague(); return; }
  if (DPF.ui.currentTab === 'futures') { renderFutures(); return; }

  // Show time-split toggle for 2026 Actual views
  const _splitEl = document.getElementById('tableSplitToggle');
  if (_splitEl) {
    _splitEl.innerHTML = (DPF.ui.currentView === 's26' || DPF.ui.currentView === 'avp') ? renderSplitToggle('table-split') : '';
    _splitEl.querySelectorAll('.split-toggle').forEach(sel => {
      sel.addEventListener('change', () => {
        state._splitWindow = sel.value;
        applySplitWindow(sel.value);
        save();
        render();
      });
    });
  }

  buildPosFilters();
  // Cache PNAV: only recalculate if roster state changes (checked via length)
  const _rosterHash = (state.myTeam || []).length;
  if (!window._lastRosterHash || window._lastRosterHash !== _rosterHash) {
    recalcPNAV();
    window._lastRosterHash = _rosterHash;
  }
  // renderMyTeamChips(); // chips removed

  let data;
  if (DPF.ui.filterType === 'bat') data = BATTERS;
  else if (DPF.ui.filterType === 'pit') data = PITCHERS;
  else data = ALL;

  const q = document.getElementById('searchBox').value.toLowerCase();
  const draftFilter = document.getElementById('draftFilter').value;
  const tagFilter = document.getElementById('tagFilter').value;
  const teamFilter = document.getElementById('teamFilter')?.value || 'all';

  let filtered = data.filter(p => {
    if (q && !p.name.toLowerCase().includes(q) && !(p.team||'').toLowerCase().includes(q)) return false;
    if (DPF.table.filterPos !== 'ALL' && p.primaryPos !== DPF.table.filterPos && !p.pos.includes(DPF.table.filterPos)) return false;
    if (teamFilter !== 'all') {
      const tObj = LEAGUE_TEAMS.find(t => t.name === teamFilter);
      const onTeam = tObj && tObj.mine ? (state.myTeam||[]).includes(p.name) : (state.leagueTeams[teamFilter]||[]).includes(p.name);
      if (!onTeam) return false;
    }
    if (draftFilter === 'available' && state.drafted[p.name]) return false;
    if (draftFilter === 'drafted' && !state.drafted[p.name]) return false;
    if (tagFilter === 'want' && state.tags[p.name] !== 'want') return false;
    if (tagFilter === 'avoid' && state.tags[p.name] !== 'avoid') return false;
    if (tagFilter === 'sleeper' && state.tags[p.name] !== 'sleeper') return false;
    if (tagFilter === 'bust' && state.tags[p.name] !== 'bust') return false;
    if (tagFilter === 'injured' && state.tags[p.name] !== 'injured') return false;
    if (tagFilter === 'any-tag' && !state.tags[p.name]) return false;
    if (tagFilter === 'untagged' && state.tags[p.name]) return false;
    // Analysis badge filters
    if (tagFilter === 'buy' && p._buySell !== 'buy') return false;
    if (tagFilter === 'sell' && p._buySell !== 'sell') return false;
    if (tagFilter === 'sb-breakout' && !p._sbBreakout) return false;
    if (tagFilter === 'low-k' && !(p.type === 'BAT' && p.zSo !== undefined && p.zSo <= -1.0)) return false;
    if (tagFilter === 'high-k' && !(p.type === 'BAT' && p.zSo !== undefined && p.zSo >= 1.5)) return false;
    if (tagFilter === 'park-plus' && !(p.parkHR && p.parkHR >= 1.10)) return false;
    if (tagFilter === 'park-minus' && !(p.parkHR && p.parkHR <= 0.90)) return false;
    if (tagFilter === 'closer' && p.bpRole !== 'CL') return false;
    if (tagFilter === 'setup' && p.bpRole !== 'SU') return false;
    if (tagFilter === 'handcuff' && p.bpRole !== 'HC') return false;
    if (tagFilter === 'stuff-up' && !(p.type === 'PIT' && p.stuffTrend >= 8)) return false;
    if (tagFilter === 'stuff-down' && !(p.type === 'PIT' && p.stuffTrend <= -8)) return false;
    // For s26/avp views, only show players with actual 2026 data
    if ((DPF.ui.currentView === 's26' || DPF.ui.currentView === 'avp') && !p.s26_pa && !p.s26_ip) return false;
    return true;
  });

  // Compute trade value, prospect value, and analytics badges for ALL views
  filtered.forEach(p => {
    const ki = getKeeperInfoCached(p.name);
    const pr = findProspect(p.name);
    // Prospect value: quadratic FV scaling (70 FV worth much more than 50 FV)
    // Old: linear (fv-40)*0.15. New: (fv-40)^2 * 0.01 for better separation of elite prospects
    p._prospectValue = pr ? Math.max(0, Math.pow((pr.fv||0) - 40, 2) * 0.01) : 0;
    // Trade value: production-first, keeper premium only when surplus justifies the slot
    const pLcv = p.lcv || 0;
    if (!ki.keepable2027) {
      p._tradeValue = pLcv * 0.8 + p._prospectValue;
    } else {
      const effMYS = (ki.multiYearSurplus || 0) > 1.0 ? (ki.multiYearSurplus || 0) : (ki.multiYearSurplus || 0) * 0.3;
      p._tradeValue = pLcv * 0.5 + Math.max(0, effMYS) * 1.0 + p._prospectValue + (ki.yearsLeft >= 2 && (ki.multiYearSurplus || 0) > 1.0 ? ki.yearsLeft * 0.3 : 0);
    }
    // Analytics badges (computed once, cached on the record for this render pass)
    p._buySell = getBuySellTag(p);
    p._sbBreakout = getSbBreakoutTag(p);
    p._kAdj = getKadjBadge(p);
    p._parkBadge = parkBadge(p);
    p._closerBadge = closerBadge(p);
    p._stuffTrend = stuffTrendBadge(p);
    p._luckBadge = luckBadge(p);
    // Compute additional GM values only when in GM view
    if (DPF.ui.currentView === 'gm') {
      p._keeperRound = ki.draftRound || 99;
      p._keeperCost2027 = ki.keepable2027 ? ki.cost2027 : 99;
      p._yearsControl = ki.yearsLeft || 0;
      p._surplusNow = ki.surplusNow || 0;
      p._multiYearSurplus = Math.max(0, ki.multiYearSurplus || 0);
    }
  });

  // Map GM sort keys to computed property names
  const gmSortMap = {keeperRound:'_keeperRound',keeperCost2027:'_keeperCost2027',yearsControl:'_yearsControl',surplusNow:'_surplusNow',multiYearSurplus:'_multiYearSurplus',prospectValue:'_prospectValue',tradeValue:'_tradeValue'};

  filtered.sort((a,b) => {
    const sc = gmSortMap[DPF.table.sortCol] || DPF.table.sortCol;
    let av = a[sc], bv = b[sc];
    if (typeof av === 'string') return DPF.table.sortDir * av.localeCompare(bv);
    return DPF.table.sortDir * ((av||0) - (bv||0));
  });

  const cols = getCols();

  function buildHeaderHtml(colSet) {
    return '<tr>' + colSet.map(c => {
      let cls = (DPF.table.sortCol === c.key ? (DPF.table.sortDir === 1 ? 'sorted-asc' : 'sorted-desc') : '');
      let inner = c.label;
      if (c.tip) {
        inner = `<span class="tooltip">${c.label}<span class="tt-text">${c.tip}</span></span>`;
      }
      return `<th class="${cls}" data-col="${c.key}" style="min-width:${c.w}px">${inner}</th>`;
    }).join('') + '</tr>';
  }

  const thead = document.getElementById('thead');
  thead.innerHTML = buildHeaderHtml(cols);

  thead.querySelectorAll('th').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (DPF.table.sortCol === col) DPF.table.sortDir *= -1;
      else { DPF.table.sortCol = col; DPF.table.sortDir = -1; }
      render();
    });
  });

  function buildRowHtml(p, rowCols) {
    const isDrafted = state.drafted[p.name];
    const isKeeper = state.keepers.includes(p.name);
    const rowCls = (isDrafted ? 'drafted ' : '') + (isKeeper ? 'keeper' : '');
    return `<tr class="${rowCls}" data-name="${p.name}">${rowCols.map(c => {
      let val = p[c.key];
      let cls = c.cls || '';
      if (c.key === 'keeperRound') {
        const ki = getKeeperInfoCached(p.name);
        const rd = ki.draftRound;
        return `<td style="text-align:center">${rd ? 'R' + rd : 'FA'}</td>`;
      }
      if (c.key === 'keeperCost2027') {
        const ki = getKeeperInfoCached(p.name);
        if (!ki.keepable2027) return `<td style="text-align:center;color:var(--red);font-size:10px;">Not keepable</td>`;
        return `<td style="text-align:center;color:var(--green);">R${ki.cost2027}</td>`;
      }
      if (c.key === 'yearsControl') {
        const ki = getKeeperInfoCached(p.name);
        const yrs = ki.yearsLeft;
        const clr = yrs >= 3 ? 'var(--green)' : yrs >= 1 ? 'var(--yellow)' : 'var(--red)';
        return `<td style="text-align:center;color:${clr};font-weight:600;">${yrs}</td>`;
      }
      if (c.key === 'surplusNow') {
        const ki = getKeeperInfoCached(p.name);
        const v = ki.surplusNow;
        const clr = v >= 0 ? 'var(--green)' : 'var(--red)';
        return `<td style="text-align:right;color:${clr};">${v.toFixed(1)}</td>`;
      }
      if (c.key === 'multiYearSurplus') {
        const ki = getKeeperInfoCached(p.name);
        const v = Math.max(0, ki.multiYearSurplus);
        return `<td style="text-align:right;color:${v > 0 ? 'var(--green)' : 'var(--text2)'};">${v.toFixed(1)}</td>`;
      }
      if (c.key === 'prospectValue') {
        const pr = findProspect(p.name);
        if (!pr) return `<td style="text-align:center;color:var(--text2);">—</td>`;
        const v = Math.max(0, ((pr.fv||0) - 40) * 0.15);
        return `<td style="text-align:right;color:var(--green);">${v.toFixed(1)}</td>`;
      }
      if (c.key === 'tradeValue') {
        const tv = p._tradeValue || 0;
        const clr = tv > 3 ? 'var(--green)' : tv > 0 ? 'var(--text)' : 'var(--text2)';
        return `<td style="text-align:right;color:${clr};font-weight:600;">${tv.toFixed(1)}</td>`;
      }
      if (c.key === 'pos') {
        const positions = (p.pos || p.primaryPos || '').split('/');
        const badges = positions.map(pos => `<span class="pos-badge pos-${pos}" style="margin-right:1px;font-size:10px;padding:1px 4px;">${pos}</span>`).join('');
        return `<td style="white-space:nowrap;">${badges}</td>`;
      }
      // Handle empty 2025 stats (player not in 2025 data)
      if (val === '' || val === undefined || val === null) return `<td class="no-data">—</td>`;
      // 2026 projected vs 2025 actual comparison coloring
      if (DPF.ui.currentView === 'p26' && !c.key.startsWith('s25_')) {
        const s25map = {pa:'s25_pa',avg:'s25_avg',obp:'s25_obp',slg:'s25_slg',hr:'s25_hr',r:'s25_r',rbi:'s25_rbi',sb:'s25_sb',so:'s25_so',
                         ip:'s25_ip',era:'s25_era',whip:'s25_whip',w:'s25_w',sv:'s25_sv',hld:'s25_hld',qs:'s25_qs'};
        const s25k = s25map[c.key];
        if (s25k) {
          const prev = p[s25k];
          if (prev !== '' && prev !== undefined && prev !== null) {
            const cur = parseFloat(val), prv = parseFloat(prev);
            // For ERA, WHIP, SO(batters): lower is better
            const lowerBetter = (c.key === 'era' || c.key === 'whip' || (c.key === 'so' && p.type === 'BAT'));
            const diff = cur - prv;
            if (diff !== 0) {
              const better = lowerBetter ? diff < 0 : diff > 0;
              cls += better ? ' val-pos' : ' val-neg';
            }
          }
        }
      }
      // AVP view: color actual stats relative to projected
      if (DPF.ui.currentView === 'avp' && c.key.startsWith('s26_')) {
        const projMap = {s26_avg:'avg',s26_obp:'obp',s26_slg:'slg',s26_hr:'hr',s26_r:'r',s26_rbi:'rbi',s26_sb:'sb',s26_so:'so',s26_pa:'pa',
                          s26_ip:'ip',s26_era:'era',s26_whip:'whip',s26_w:'w',s26_sv:'sv',s26_hld:'hld',s26_qs:'qs'};
        const projK = projMap[c.key];
        if (projK) {
          const proj = p[projK];
          if (proj !== '' && proj !== undefined && proj !== null) {
            const act = parseFloat(val), prj = parseFloat(proj);
            const lowerBetter = (projK === 'era' || projK === 'whip' || (projK === 'so' && p.type === 'BAT'));
            const diff = act - prj;
            if (diff !== 0) {
              const better = lowerBetter ? diff < 0 : diff > 0;
              cls += better ? ' val-pos' : ' val-neg';
            }
          }
        }
      }
      // Format s26 columns
      if (c.key === 's26_avg' || c.key === 's26_obp' || c.key === 's26_slg') val = parseFloat(val).toFixed(3);
      else if (c.key === 's26_era') val = parseFloat(val).toFixed(2);
      else if (c.key === 's26_whip') val = parseFloat(val).toFixed(3);
      else if (c.key === 's26_ip') val = parseFloat(val).toFixed(1);
      else if (c.key === 'avg' || c.key === 'obp' || c.key === 'slg' || c.key === 's25_avg' || c.key === 's25_obp' || c.key === 's25_slg') val = parseFloat(val).toFixed(3);
      else if (c.key === 'era' || c.key === 's25_era') val = parseFloat(val).toFixed(2);
      else if (c.key === 'whip' || c.key === 's25_whip') val = parseFloat(val).toFixed(3);
      else if (c.key === 'ip' || c.key === 's25_ip') val = parseFloat(val).toFixed(1);
      else if (c.key === 's25_woba' || c.key === 's25_xwoba') val = parseFloat(val).toFixed(3);
      else if (c.key === 's25_barrel' || c.key === 's25_hardhit') val = parseFloat(val).toFixed(1) + '%';
      else if (c.key === 's25_delta') {
        const v = parseFloat(val);
        cls += v > 0 ? ' val-pos' : v < 0 ? ' val-neg' : '';
        val = (v > 0 ? '+' : '') + v.toFixed(3);
      }
      else if (c.key === 's25_stuff' || c.key === 's25_loc' || c.key === 's25_pitching') {
        const v = parseInt(val);
        cls += v >= 110 ? ' val-pos' : v <= 90 ? ' val-neg' : '';
      }
      else if (c.key === 'war') val = val.toFixed(1);
      else if (c.key === 'lcv' || c.key === 'pnav' || c.key === 'dp' || c.key === 'upside' || c.key === 'trend' || c.key === 'actualLcv') {
        const v = parseFloat(val);
        cls += v >= 0 ? ' val-pos' : ' val-neg';
        val = v.toFixed(2);
        // Add confidence indicator for actualLcv in time-split windows
        if (c.key === 'actualLcv' && p._splitConfidence) {
          const confColors = { 'low': '#e88a0a', 'med': '#2563eb', 'high': '#16a34a' };
          const confTips = { 'low': 'Low sample size', 'med': 'Medium sample size', 'high': 'High sample size' };
          const dot = `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${confColors[p._splitConfidence]};margin-right:4px;vertical-align:middle;" title="${confTips[p._splitConfidence]}"></span>`;
          return `<td class="${cls}">${dot}${val}</td>`;
        }
      }
      else if (c.key === 'lcvDelta') {
        const v = parseFloat(val);
        cls += v >= 0 ? ' val-pos' : ' val-neg';
        val = (v > 0 ? '+' : '') + v.toFixed(2);
      }
      else if (c.key === 'dBarrel' || c.key === 'dHardhit') {
        const v = parseFloat(val);
        cls += v > 0 ? ' val-pos' : v < 0 ? ' val-neg' : '';
        val = (v > 0 ? '+' : '') + v.toFixed(1);
      }
      else if (c.key === 'dWoba' || c.key === 'dXwoba') {
        const v = parseFloat(val);
        cls += v > 0 ? ' val-pos' : v < 0 ? ' val-neg' : '';
        val = (v > 0 ? '+' : '') + v.toFixed(3);
      }
      else if (c.key === 'dStuff' || c.key === 'dLoc' || c.key === 'dPitching') {
        const v = parseInt(val);
        cls += v > 0 ? ' val-pos' : v < 0 ? ' val-neg' : '';
        val = (v > 0 ? '+' : '') + v;
      }
      else if (c.key === 's26_stuff' || c.key === 's26_loc' || c.key === 's26_pitching') {
        const v = parseInt(val);
        cls += v >= 110 ? ' val-pos' : v <= 90 ? ' val-neg' : '';
      }
      else if (c.key === 's26_woba' || c.key === 's26_xwoba') val = parseFloat(val).toFixed(3);
      else if (c.key === 's26_barrel' || c.key === 's26_hardhit') val = parseFloat(val).toFixed(1) + '%';
      else if (c.key === 's26_xwDelta') {
        const v = parseFloat(val);
        cls += v > 0 ? ' val-pos' : v < 0 ? ' val-neg' : '';
        val = (v > 0 ? '+' : '') + v.toFixed(3);
      }
      if (c.key === 'name') {
        // Owner badge for drafted players
        let ownerBadge = '';
        if (isDrafted) {
          const dInfo = state.drafted[p.name] || {};
          let ownerLabel = '';
          if (dInfo.mine) {
            const myT = LEAGUE_TEAMS.find(t => t.mine);
            ownerLabel = myT ? myT.owner : 'My Team';
          } else {
            // Find which team owns this player via roster data or draft picks
            const ownerTeam = LEAGUE_TEAMS.find(t => {
              const pl = t.mine ? (state.myTeam || []) : (state.leagueTeams[t.name] || []);
              return pl.includes(p.name);
            });
            if (ownerTeam) {
              ownerLabel = ownerTeam.owner || ownerTeam.name;
            } else {
              // Fallback to draft pick data
              const dp = PICK_BY_NAME[p.name];
              if (dp && dp.team) {
                const dpTeam = LEAGUE_TEAMS.find(t => t.name === dp.team);
                ownerLabel = dpTeam ? (dpTeam.owner || dpTeam.name) : dp.team;
              } else {
                ownerLabel = 'Owned';
              }
            }
          }
          const rdInfo = dInfo.round ? ' R' + dInfo.round : '';
          const _oParts = ownerLabel.split(' ');
          const shortOwner = _oParts.length > 1 ? _oParts[_oParts.length - 1] : _oParts[0]; // Last name only
          if (!dInfo.mine) {
            const tc = TEAM_COLORS[ownerLabel] || { bg:'rgba(100,100,100,0.1)', text:'var(--text2)' };
            ownerBadge = ` <span class="owner-badge" title="${ownerLabel}" style="background:${tc.bg};color:${tc.text};border:1px solid ${tc.text}22;">${shortOwner}${rdInfo}</span>`;
          } else {
            ownerBadge = ` <span class="owner-badge mine" title="${ownerLabel}">${shortOwner}${rdInfo}</span>`;
          }
        }
        const kpRd = state.keeperRounds && state.keeperRounds[p.name];
        const kp = isKeeper ? ` <small style="color:var(--accent)">[K${kpRd ? ' Rd'+kpRd : ''}]</small>` : '';
        // Tags: want / avoid / sleeper / bust
        const tag = state.tags[p.name];
        const tagMap = {
          want:    { cls: 'tag-want',    label: 'W', title: 'Want' },
          avoid:   { cls: 'tag-avoid',   label: 'A', title: 'Avoid' },
          sleeper: { cls: 'tag-sleeper', label: 'S', title: 'Sleeper' },
          bust:    { cls: 'tag-bust',    label: 'B', title: 'Bust' },
          injured: { cls: 'tag-injured', label: 'IL', title: 'Injured' }
        };
        let tagHtml = '';
        if (tag && tagMap[tag]) tagHtml = ` <span class="tag-badge ${tagMap[tag].cls}" title="${tagMap[tag].title}">${tagMap[tag].label}</span>`;
        // Tag buttons: W=want, A=avoid, IL=injured (sleeper/bust auto-set from BUZZ articles only)
        const tagBtns = `<span class="tag-btns" style="margin-left:4px;"><button class="tag-btn tag-w" data-player="${encodeURIComponent(p.name)}" data-tag="want" title="Want"${tag==='want'?' style="opacity:1"':''}>W</button><button class="tag-btn tag-a" data-player="${encodeURIComponent(p.name)}" data-tag="avoid" title="Avoid"${tag==='avoid'?' style="opacity:1"':''}>A</button><button class="tag-btn tag-i" data-player="${encodeURIComponent(p.name)}" data-tag="injured" title="Injured"${tag==='injured'?' style="opacity:1"':''}>IL</button></span>`;
        // Buzz arrows from expert articles (draft view only)
        let buzz = '';
        if (state._mode === 'draft') {
          const buzzItems = BUZZ[p.name] || [];
          const buzzHtml = buzzItems.map(b => {
            if (b.type === 'up') return `<a href="${b.url}" target="_blank" title="Sleeper — ${b.src}" style="text-decoration:none;cursor:pointer;font-size:13px;">&#x25B2;<small style="font-size:9px;opacity:0.7">${b.src}</small></a>`;
            return `<a href="${b.url}" target="_blank" title="Avoid — ${b.src}" style="text-decoration:none;cursor:pointer;font-size:13px;">&#x25BC;<small style="font-size:9px;opacity:0.7">${b.src}</small></a>`;
          }).join(' ');
          buzz = buzzHtml ? ` ${buzzHtml}` : '';
        }
        const enoR = p.eno_rank ? ` <span class="eno-rank" title="Eno 150 Best Pitchers #${p.eno_rank}">P${p.eno_rank}</span>` : '';
        // Analytics badges (v5.0) — inline after name, never wrap
        let aBadges = '';
        if (p._buySell === 'buy') aBadges += ' <span class="pbadge" title="Buy-low: xwOBA ' + ((p.s25_delta||0)*1000).toFixed(0) + ' pts above wOBA" style="background:#16a34a;color:#fff;">BUY</span>';
        if (p._buySell === 'sell') aBadges += ' <span class="pbadge" title="Sell-high: xwOBA ' + (Math.abs(p.s25_delta||0)*1000).toFixed(0) + ' pts below wOBA" style="background:#dc2626;color:#fff;">SELL</span>';
        if (p._sbBreakout) aBadges += ' <span class="pbadge" title="SB breakout: ' + (p.sprintSpeed||'?') + ' ft/s speed, only ' + (p.sb||0) + ' proj SB" style="background:#7c3aed;color:#fff;">SB</span>';
        aBadges += (p._kAdj || '') + (p._parkBadge || '') + (p._closerBadge || '') + (p._stuffTrend || '') + (p._luckBadge || '');
        return `<td style="font-weight:600;white-space:nowrap;">${val}${_injBadge(p.name)}${enoR}${aBadges}${tagHtml}${kp}${ownerBadge}${tagBtns}</td>`;
      }
      return `<td class="${cls}">${val}</td>`;
    }).join('')}</tr>`;
  }

  const tbody = document.getElementById('tbody');
  const rows = filtered.slice(0, 500);
  tbody.innerHTML = rows.map(p => buildRowHtml(p, cols)).join('');

  // Right-click to draft, double-click to draft to my team
  tbody.querySelectorAll('tr').forEach(tr => {
    tr.addEventListener('contextmenu', e => {
      e.preventDefault();
      const name = tr.dataset.name;
      if (!state.drafted[name]) { draftPlayer(name, false); }
    });
    tr.addEventListener('dblclick', () => {
      const name = tr.dataset.name;
      if (!state.drafted[name]) { draftPlayer(name, true); }
    });
  });

  // Tag buttons (want / avoid)
  tbody.querySelectorAll('.tag-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const name = decodeURIComponent(btn.dataset.player);
      const tag = btn.dataset.tag;
      if (state.tags[name] === tag) { delete state.tags[name]; }
      else { state.tags[name] = tag; }
      save();
      render();
    });
  });

  document.getElementById('showCount').textContent = filtered.length;
  document.getElementById('draftedCount').textContent = Object.keys(state.drafted).length;
  const tagVals = Object.values(state.tags);
  document.getElementById('wantCount').textContent = tagVals.filter(t => t === 'want').length;
  document.getElementById('avoidCount').textContent = tagVals.filter(t => t === 'avoid').length;
  document.getElementById('sleeperCount').textContent = tagVals.filter(t => t === 'sleeper').length;
  document.getElementById('bustCount').textContent = tagVals.filter(t => t === 'bust').length;
  document.getElementById('injuredCount').textContent = tagVals.filter(t => t === 'injured').length;
}


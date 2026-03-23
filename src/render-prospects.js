// ── Prospect lookup ────────────────────────────────────────────────────────
const PROSPECT_BY_NAME = {};
PROSPECTS.forEach(pr => {
  PROSPECT_BY_NAME[pr.name] = pr;
  // Also index by accent-stripped name
  const normalized = pr.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (normalized !== pr.name) PROSPECT_BY_NAME[normalized] = pr;
  // Also index by last name for fuzzy matching
  const parts = pr.name.split(' ');
  if (parts.length >= 2) {
    const lastName = parts[parts.length - 1];
    // Only store last-name key if it's not already taken (avoid collisions)
    if (!PROSPECT_BY_NAME['_last_' + lastName]) PROSPECT_BY_NAME['_last_' + lastName] = pr;
  }
});
function findProspect(name) {
  if (PROSPECT_BY_NAME[name]) return PROSPECT_BY_NAME[name];
  // Try accent-stripped
  const norm = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (PROSPECT_BY_NAME[norm]) return PROSPECT_BY_NAME[norm];
  // Try last-name key (for single-name entries like "Doyle")
  if (PROSPECT_BY_NAME['_last_' + name]) return PROSPECT_BY_NAME['_last_' + name];
  // Try case-insensitive
  const lower = name.toLowerCase();
  for (const key in PROSPECT_BY_NAME) {
    if (key.toLowerCase() === lower) return PROSPECT_BY_NAME[key];
  }
  return null;
}

// ── Prospect call-up alert system ─────────────────────────────────────────
// Flag high-FV prospects who might be called up soon based on:
// 1. High FV grade (55+)
// 2. Injury to a starter at the same position on their MLB team
// 3. Not already in the player pool (i.e., not yet called up)
function getProspectAlerts() {
  const alerts = [];
  (PROSPECTS || []).forEach(pr => {
    if (!pr || !pr.name || (pr.fv || 0) < 50) return;
    // Skip if already in player pool
    if (_plyrICached(pr.name)) return;
    // Check for injured starters at same position on same team
    let injuredStarter = null;
    const prTeam = pr.team || '';
    const prPos = (pr.pos || '').split(',')[0];
    INJURY_MAP.forEach((inj, injName) => {
      if (inj.status === 'IL' || inj.status === 'O') {
        const injPlayer = _plyrICached(injName);
        if (injPlayer && injPlayer.team === prTeam) {
          const injPositions = (injPlayer.pos || '').split('/');
          if (injPositions.some(p => p === prPos || (prPos === 'OF' && ['LF','CF','RF'].includes(p)))) {
            injuredStarter = injName;
          }
        }
      }
    });
    const alert = {
      name: pr.name,
      fv: pr.fv || 0,
      team: prTeam,
      pos: pr.pos || '',
      reason: injuredStarter ? `${injuredStarter} on IL` : (pr.fv >= 60 ? 'Elite prospect' : 'Top prospect'),
      priority: (pr.fv || 0) + (injuredStarter ? 20 : 0)
    };
    if (injuredStarter || (pr.fv || 0) >= 55) alerts.push(alert);
  });
  return alerts.sort((a, b) => b.priority - a.priority);
}

// ── Futures tab rendering ──────────────────────────────────────────────────
function renderFutures() {
  const section = document.getElementById('rosterSection');
  section.innerHTML = '';

  let subView = state._futuresView || 'rankings';

  // Header and view toggle buttons
  let html = `
    <div style="padding:12px 20px;background:var(--surface);border-bottom:1px solid var(--border);">
      <h2 style="font-size:16px;font-weight:700;margin-bottom:8px;">Prospect Rankings</h2>
      <p style="font-size:12px;color:var(--text2);margin-bottom:12px;">MiLB prospects ranked by potential fantasy impact</p>
      <div style="display:flex;gap:4px;">
        <button class="futures-view-btn" data-view="rankings" style="padding:6px 14px;font-size:12px;font-weight:600;border:1px solid var(--border);background:${subView==='rankings'?'var(--accent2)':'var(--surface2)'};color:${subView==='rankings'?'#fff':'var(--text)'};border-radius:4px;cursor:pointer;">Rankings</button>
        <button class="futures-view-btn" data-view="rookies" style="padding:6px 14px;font-size:12px;font-weight:600;border:1px solid var(--border);background:${subView==='rookies'?'var(--accent2)':'var(--surface2)'};color:${subView==='rookies'?'#fff':'var(--text)'};border-radius:4px;cursor:pointer;">League Rookies</button>
      </div>
    </div>
  `;

  if (subView === 'rankings') {
    // Rankings sub-view with sortable columns
    const fCols = [
      {key:'avg_rank',label:'Rank',align:'left'},
      {key:'name',label:'Player',align:'left'},
      {key:'team',label:'Team',align:'left'},
      {key:'pos',label:'Pos',align:'center'},
      {key:'level',label:'Level',align:'center'},
      {key:'age',label:'Age',align:'center'},
      {key:'fv',label:'FV',align:'center',tip:'Future Value grade (20-80 scouting scale)'},
      {key:'g_hit',label:'Hit',align:'center',tip:'Future hit tool (20-80)'},
      {key:'g_power',label:'Pwr',align:'center',tip:'Future game power (20-80)'},
      {key:'g_speed',label:'Spd',align:'center',tip:'Future speed/run tool (20-80)'},
      {key:'g_field',label:'Fld',align:'center',tip:'Future fielding tool (20-80)'},
      {key:'g_fb',label:'FB',align:'center',tip:'Future fastball grade (pitchers)'},
      {key:'g_secondary',label:'2nd',align:'center',tip:'Best future secondary pitch'},
      {key:'g_command',label:'Cmd',align:'center',tip:'Future command grade (pitchers)'},
      {key:'fg_rank',label:'FG',align:'center',tip:'FanGraphs prospect ranking'},
      {key:'jb_rank',label:'JB',align:'center',tip:'JustBaseball prospect ranking'},
      {key:'bp_rank',label:'BP',align:'center',tip:'Baseball Prospectus ranking'},
      {key:'avg_rank_val',label:'Avg',align:'center',tip:'Average rank across all sources'},
      {key:'trend',label:'Trend',align:'center',tip:'Ranking trend vs. previous lists'}
    ];

    // Sort state for Futures
    if (!state._fSortCol) state._fSortCol = 'avg_rank';
    if (!state._fSortDir) state._fSortDir = 1;

    html += '<div style="padding:12px 20px;">';
    html += '<div style="display:flex;gap:12px;align-items:center;margin-bottom:12px;">';
    html += '<input type="text" id="prospectSearch" class="search-box" placeholder="Search prospects..." style="width:300px;">';
    html += '<select id="prospectAvailFilter" style="padding:4px 8px;font-size:12px;background:var(--surface2);color:var(--text);border:1px solid var(--border);border-radius:4px;">';
    html += `<option value="all"${(state._prospectAvail||'all')==='all'?' selected':''}>All Prospects</option>`;
    html += `<option value="available"${state._prospectAvail==='available'?' selected':''}>Available Only</option>`;
    html += '</select>';
    html += '</div>';

    html += `<div style="overflow:auto;max-height:calc(100vh-250px);">
      <table id="prospectsTable" style="width:100%;border-collapse:collapse;">
        <thead id="prospectsThead" style="position:sticky;top:0;z-index:10;background:var(--surface2);"></thead>
        <tbody id="prospectsBody"></tbody>
      </table>
    </div>`;
    html += '</div>';

    section.innerHTML = html;

    const prospectsBody = document.getElementById('prospectsBody');
    const prospectsThead = document.getElementById('prospectsThead');

    const getLevel = (age) => {
      if (!age || age < 19) return 'DSL/Complex';
      if (age < 21) return 'A/A+';
      if (age < 23) return 'AA';
      return 'AAA';
    };

    const levelOrder = {'DSL/Complex':0,'A/A+':1,'AA':2,'AAA':3};

    const buildFuturesTable = () => {
      const q = document.getElementById('prospectSearch')?.value.toLowerCase() || '';
      const availFilter = document.getElementById('prospectAvailFilter')?.value || 'all';
      state._prospectAvail = availFilter;
      // Build set of rostered prospect names (drafted + on any league team + my MiLB + league rookies)
      const rosteredNames = new Set();
      Object.keys(state.drafted || {}).forEach(n => rosteredNames.add(n));
      (state.milbKeepers || []).forEach(n => rosteredNames.add(n));
      (state.myTeam || []).forEach(n => rosteredNames.add(n));
      Object.values(state.leagueTeams || {}).forEach(arr => (arr||[]).forEach(n => rosteredNames.add(n)));
      // Also include LEAGUE_ROOKIES — resolve short/partial names via findProspect
      for (const tkey in LEAGUE_ROOKIES) {
        (LEAGUE_ROOKIES[tkey] || []).forEach(rn => {
          rosteredNames.add(rn);
          const pr = findProspect(rn);
          if (pr) rosteredNames.add(pr.name);
        });
      }
      let prospects = [...PROSPECTS].filter(p => {
        if (!p.name.toLowerCase().includes(q)) return false;
        if (availFilter === 'available' && rosteredNames.has(p.name)) return false;
        return true;
      });

      // Sort
      const sc = state._fSortCol;
      const sd = state._fSortDir;
      prospects.sort((a, b) => {
        let av, bv;
        if (sc === 'avg_rank' || sc === 'avg_rank_val') { av = a.avg_rank; bv = b.avg_rank; }
        else if (sc === 'name' || sc === 'team' || sc === 'pos') { av = (a[sc]||'').toLowerCase(); bv = (b[sc]||'').toLowerCase(); return sd * av.localeCompare(bv); }
        else if (sc === 'level') { av = levelOrder[getLevel(a.age||0)]||0; bv = levelOrder[getLevel(b.age||0)]||0; }
        else if (sc === 'trend') { av = a.trend||0; bv = b.trend||0; }
        else if (sc.startsWith('g_')) { av = a[sc]||0; bv = b[sc]||0; }
        else { av = a[sc]||999; bv = b[sc]||999; }
        return sd * ((av||0) - (bv||0));
      });

      // Build header
      prospectsThead.innerHTML = '<tr>' + fCols.map(c => {
        const arrow = state._fSortCol === c.key ? (state._fSortDir === 1 ? ' ▲' : ' ▼') : '';
        const tipAttr = c.tip ? ` title="${c.tip}"` : '';
        return `<th data-col="${c.key}"${tipAttr} style="padding:8px 6px;text-align:${c.align};font-weight:600;font-size:11px;text-transform:uppercase;border-bottom:2px solid var(--border);cursor:pointer;user-select:none;">${c.label}${arrow}</th>`;
      }).join('') + '</tr>';

      // Wire header clicks
      prospectsThead.querySelectorAll('th').forEach(th => {
        th.addEventListener('click', () => {
          const col = th.dataset.col;
          if (state._fSortCol === col) state._fSortDir *= -1;
          else { state._fSortCol = col; state._fSortDir = 1; }
          buildFuturesTable();
        });
      });

      // Build rows
      prospectsBody.innerHTML = prospects.map((p, idx) => {
        const fv = p.fv || 0;
        const age = p.age || 0;
        const fvColor = fv >= 70 ? '#daa520' : fv >= 60 ? 'var(--green)' : fv >= 55 ? '#4a90e2' : fv >= 50 ? 'var(--text)' : 'var(--text2)';
        const fvBg = fv >= 70 ? 'rgba(218,165,32,0.1)' : fv >= 60 ? 'rgba(22,163,74,0.1)' : fv >= 55 ? 'rgba(74,144,226,0.1)' : 'transparent';
        const level = getLevel(age);

        let ownerBadge = '';
        let rookieOwner = '';
        for (let tkey in LEAGUE_ROOKIES) {
          const found = LEAGUE_ROOKIES[tkey].some(rn => {
            const rpr = findProspect(rn);
            return rn === p.name || (rpr && rpr.name === p.name);
          });
          if (found) { rookieOwner = tkey; break; }
        }
        if (!rookieOwner) {
          if (state.myTeam && state.myTeam.includes(p.name)) rookieOwner = 'Pytlik';
          else {
            for (let tkey in state.leagueTeams) {
              if (state.leagueTeams[tkey].includes(p.name)) { rookieOwner = tkey; break; }
            }
          }
        }
        if (rookieOwner) {
          const isMe = rookieOwner === 'Pytlik';
          ownerBadge = `<span class="owner-badge${isMe?' mine':''}">${rookieOwner}</span>`;
        }

        let heliumIcon = '';
        if (p.helium >= 2) heliumIcon = '🔥';
        let trendArrow = '';
        if (p.trend < -3) trendArrow = '<span style="color:var(--green);font-weight:700;">↑</span>';
        else if (p.trend > 3) trendArrow = '<span style="color:var(--red);font-weight:700;">↓</span>';

        // Grade coloring helper
        const gc = (v) => {
          if (!v) return 'color:var(--text2);';
          if (v >= 70) return 'color:#daa520;font-weight:700;';
          if (v >= 60) return 'color:var(--green);font-weight:600;';
          if (v >= 55) return 'color:#4a90e2;';
          if (v >= 50) return 'color:var(--text);';
          if (v >= 45) return 'color:var(--text2);';
          return 'color:var(--red);';
        };
        const gv = (v) => v || '—';

        return `<tr style="border-bottom:1px solid var(--border);">
          <td style="padding:6px 10px;font-size:12px;">${idx+1}</td>
          <td style="padding:6px 10px;font-size:12px;">${p.name}${ownerBadge}</td>
          <td style="padding:6px 10px;font-size:12px;">${p.team}</td>
          <td style="padding:6px 10px;text-align:center;font-size:12px;">${p.pos}</td>
          <td style="padding:6px 10px;text-align:center;font-size:11px;color:var(--text2);">${level}</td>
          <td style="padding:6px 10px;text-align:center;font-size:12px;">${age ? age.toFixed(1) : '—'}</td>
          <td style="padding:6px 10px;text-align:center;font-size:12px;background:${fvBg};color:${fvColor};font-weight:600;">${fv || '—'}</td>
          <td style="padding:4px 6px;text-align:center;font-size:11px;${gc(p.g_hit)}">${gv(p.g_hit)}</td>
          <td style="padding:4px 6px;text-align:center;font-size:11px;${gc(p.g_power)}">${gv(p.g_power)}</td>
          <td style="padding:4px 6px;text-align:center;font-size:11px;${gc(p.g_speed)}">${gv(p.g_speed)}</td>
          <td style="padding:4px 6px;text-align:center;font-size:11px;${gc(p.g_field)}">${gv(p.g_field)}</td>
          <td style="padding:4px 6px;text-align:center;font-size:11px;${gc(p.g_fb)}">${gv(p.g_fb)}</td>
          <td style="padding:4px 6px;text-align:center;font-size:11px;${gc(p.g_secondary)}">${gv(p.g_secondary)}</td>
          <td style="padding:4px 6px;text-align:center;font-size:11px;${gc(p.g_command)}">${gv(p.g_command)}</td>
          <td style="padding:6px 10px;text-align:center;font-size:12px;">${p.fg_rank || '—'}</td>
          <td style="padding:6px 10px;text-align:center;font-size:12px;">${p.jb_rank || '—'}</td>
          <td style="padding:6px 10px;text-align:center;font-size:12px;">${p.bp_rank || '—'}</td>
          <td style="padding:6px 10px;text-align:center;font-size:12px;font-weight:600;">${p.avg_rank.toFixed(1)}</td>
          <td style="padding:6px 10px;text-align:center;font-size:12px;">${heliumIcon}${trendArrow}</td>
        </tr>`;
      }).join('');
    };

    buildFuturesTable();

    // Wire search and availability filter
    document.getElementById('prospectSearch')?.addEventListener('input', () => buildFuturesTable());
    document.getElementById('prospectAvailFilter')?.addEventListener('change', () => buildFuturesTable());

  } else {
    // League Rookies sub-view — uses LEAGUE_ROOKIES from DPF spreadsheet
    html += '<div style="padding:12px 20px;">';
    html += '<p style="font-size:12px;color:var(--text2);margin-bottom:16px;">Rookie/prospect keepers for all 12 teams. Prospect data matched from FanGraphs, JustBaseball, and Baseball Prospectus rankings.</p>';

    // Build enriched rookie data per team, sorted by prospect rank
    const teamNames = Object.keys(LEAGUE_ROOKIES).sort();
    let totalRookieValue = {};

    teamNames.forEach(tkey => {
      const rookies = LEAGUE_ROOKIES[tkey].map(rname => {
        const pr = findProspect(rname);
        const pl = _plyrI(rname) || (pr ? _plyrI(pr.name) : null);
        return { name: pr ? pr.name : rname, prospect: pr, player: pl };
      }).sort((a, b) => {
        const ra = a.prospect ? a.prospect.avg_rank : 999;
        const rb = b.prospect ? b.prospect.avg_rank : 999;
        return ra - rb;
      });

      // Total prospect value for this team
      const teamProspectVal = rookies.reduce((s, r) => {
        if (!r.prospect) return s;
        return s + Math.max(0, ((r.prospect.fv || 0) - 40) * 0.15);
      }, 0);
      totalRookieValue[tkey] = teamProspectVal;

      const isMyTeam = tkey === 'Pytlik';
      const teamBorder = isMyTeam ? 'var(--accent)' : 'var(--accent2)';
      const teamBg = isMyTeam ? 'rgba(74,107,255,0.05)' : 'transparent';

      html += `<div style="margin-bottom:20px;background:${teamBg};border-radius:8px;padding:${isMyTeam ? '12px' : '0'};">`;
      html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">`;
      html += `<h3 style="font-size:14px;font-weight:700;">${tkey}${isMyTeam ? ' ★' : ''}</h3>`;
      html += `<span style="font-size:11px;color:var(--text2);">Prospect Value: <b style="color:var(--text);">${teamProspectVal.toFixed(1)}</b></span>`;
      html += `</div>`;

      html += `<table style="width:100%;border-collapse:collapse;font-size:12px;table-layout:fixed;">`;
      html += `<colgroup><col style="width:44%"><col style="width:8%"><col style="width:8%"><col style="width:14%"><col style="width:12%"><col style="width:14%"></colgroup>`;
      html += `<thead><tr style="font-size:10px;text-transform:uppercase;color:var(--text2);border-bottom:1px solid var(--border);">`;
      html += `<th style="text-align:left;padding:4px 6px;">Rookie</th>`;
      html += `<th style="text-align:center;padding:4px 6px;">Pos</th>`;
      html += `<th style="text-align:center;padding:4px 6px;">FV</th>`;
      html += `<th style="text-align:center;padding:4px 6px;">Avg Rank</th>`;
      html += `<th style="text-align:center;padding:4px 6px;">Helium</th>`;
      html += `<th style="text-align:right;padding:4px 6px;">LCV</th>`;
      html += `</tr></thead><tbody>`;

      rookies.forEach(r => {
        const pr = r.prospect;
        const fv = pr ? (pr.fv || 0) : 0;
        const fvColor = fv >= 70 ? '#daa520' : fv >= 60 ? 'var(--green)' : fv >= 55 ? '#4a90e2' : fv >= 50 ? 'var(--text)' : 'var(--text2)';
        const avgRank = pr && pr.avg_rank ? pr.avg_rank.toFixed(1) : '—';
        const pos = pr ? (pr.pos || '?') : '?';
        const lcv = r.player && r.player.lcv ? r.player.lcv.toFixed(1) : '—';

        let heliumStr = '';
        if (pr) {
          if (pr.helium >= 2) heliumStr += '🔥';
          if (pr.trend < -3) heliumStr += '<span style="color:var(--green);font-weight:700;">↑</span>';
          else if (pr.trend > 3) heliumStr += '<span style="color:var(--red);font-weight:700;">↓</span>';
        }

        const notRanked = !pr;
        const rowStyle = notRanked ? 'opacity:0.5;' : '';
        // Roster eligible = has MLB stats in FanGraphs data
        const rosterElig = r.player && r.player.lcv > 0;
        const eligBadge = rosterElig ? ' <span style="font-size:8px;background:var(--green);color:#fff;padding:1px 3px;border-radius:2px;font-weight:400;">MLB</span>' : '';

        html += `<tr style="border-bottom:1px solid var(--border);${rowStyle}">`;
        html += `<td style="padding:5px 6px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.name}${eligBadge}${notRanked ? ' <span style="font-size:10px;color:var(--text2);font-weight:400;">(unranked)</span>' : ''}</td>`;
        html += `<td style="text-align:center;padding:5px 6px;">${pos}</td>`;
        html += `<td style="text-align:center;padding:5px 6px;color:${fvColor};font-weight:600;">${fv || '—'}</td>`;
        html += `<td style="text-align:center;padding:5px 6px;">${avgRank}</td>`;
        html += `<td style="text-align:center;padding:5px 6px;">${heliumStr || '—'}</td>`;
        html += `<td style="text-align:right;padding:5px 6px;">${lcv}</td>`;
        html += `</tr>`;
      });

      html += `</tbody></table></div>`;
    });

    html += '</div>';
    section.innerHTML = html;
  }

  // Wire view toggle buttons
  document.querySelectorAll('.futures-view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state._futuresView = btn.dataset.view;
      renderFutures();
    });
  });
}


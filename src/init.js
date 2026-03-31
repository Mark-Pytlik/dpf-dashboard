// ── View toggle listener ──────────────────────────────────────────────────
document.querySelectorAll('.view-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentView = btn.dataset.view;
    render();
  });
});

// ── Search & filter listeners ─────────────────────────────────────────────
document.getElementById('searchBox').addEventListener('input', render);
document.getElementById('draftFilter').addEventListener('change', render);
document.getElementById('tagFilter').addEventListener('change', render);
// Populate team filter dropdown with fantasy league teams
(() => {
  const tf = document.getElementById('teamFilter');
  // Add my team first
  const myT = LEAGUE_TEAMS.find(t => t.mine);
  if (myT) { const o = document.createElement('option'); o.value = myT.name; o.textContent = myT.owner + ' (me)'; tf.appendChild(o); }
  // Then other teams sorted by owner name
  LEAGUE_TEAMS.filter(t => !t.mine).sort((a,b) => a.owner.localeCompare(b.owner)).forEach(t => {
    const o = document.createElement('option'); o.value = t.name; o.textContent = t.owner; tf.appendChild(o);
  });
  tf.addEventListener('change', render);
})();
document.addEventListener('click', e => {
  if (!e.target.closest('.autocomplete') && !e.target.closest('.draft-input')) draftAC.style.display = 'none';
});

// ── Column Resize + Reorder ──────────────────────────────────────────────
function initColumnResize(container) {
  const tables = (container || document).querySelectorAll('table');
  tables.forEach(tbl => {
    const ths = tbl.querySelectorAll('thead tr:last-child th');
    if (ths.length < 2) return;
    if (tbl.dataset.colResize) return;
    // Skip Player View roster tables — they use a shared colgroup for alignment
    // and resizing individual tables would break cross-table column alignment
    if (tbl.closest('#rosterSection') && tbl.querySelector('colgroup') && ths.length > 20) return;
    tbl.dataset.colResize = '1';
    // Snapshot computed widths so drag has a baseline
    ths.forEach(th => {
      th.style.width = th.offsetWidth + 'px';
      th.style.minWidth = '20px';
      // Resize handle (right edge)
      const handle = document.createElement('div');
      handle.className = 'col-resize';
      th.appendChild(handle);
    });
    // Enable column reorder via drag on the header text (not the resize handle)
    ths.forEach(th => {
      th.setAttribute('draggable', 'true');
      th.addEventListener('dragstart', e => {
        if (e.target.classList.contains('col-resize')) { e.preventDefault(); return; }
        const idx = [...th.parentElement.children].indexOf(th);
        e.dataTransfer.setData('text/plain', idx);
        e.dataTransfer.effectAllowed = 'move';
        th.style.opacity = '0.4';
        tbl._dragColIdx = idx;
      });
      th.addEventListener('dragend', () => { th.style.opacity = ''; });
      th.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; th.classList.add('col-drag-over'); });
      th.addEventListener('dragleave', () => { th.classList.remove('col-drag-over'); });
      th.addEventListener('drop', e => {
        th.classList.remove('col-drag-over');
        e.preventDefault();
        const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
        const toIdx = [...th.parentElement.children].indexOf(th);
        if (isNaN(fromIdx) || fromIdx === toIdx) return;
        // Reorder all rows (thead + tbody)
        tbl.querySelectorAll('tr').forEach(row => {
          const cells = [...row.children];
          if (fromIdx >= cells.length || toIdx >= cells.length) return;
          const moving = cells[fromIdx];
          if (fromIdx < toIdx) row.insertBefore(moving, cells[toIdx].nextSibling);
          else row.insertBefore(moving, cells[toIdx]);
        });
      });
    });
  });
}
// Global resize drag state
let _resizeCol = null, _resizeStartX = 0, _resizeStartW = 0;
document.addEventListener('mousedown', e => {
  if (!e.target.classList.contains('col-resize')) return;
  e.preventDefault();
  e.stopPropagation();
  const th = e.target.parentElement;
  _resizeCol = th;
  _resizeStartX = e.pageX;
  _resizeStartW = th.offsetWidth;
  e.target.classList.add('active');
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
});
document.addEventListener('mousemove', e => {
  if (!_resizeCol) return;
  const diff = e.pageX - _resizeStartX;
  const newW = Math.max(24, _resizeStartW + diff);
  _resizeCol.style.width = newW + 'px';
  _resizeCol.style.minWidth = newW + 'px';
});
document.addEventListener('mouseup', () => {
  if (!_resizeCol) return;
  const handle = _resizeCol.querySelector('.col-resize');
  if (handle) handle.classList.remove('active');
  _resizeCol = null;
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
});
// Re-init after each render
const _origRender = render;
render = function() { _origRender.apply(this, arguments); requestAnimationFrame(() => initColumnResize()); };

// ── Init ──────────────────────────────────────────────────────────────────
// Ensure keepers are on team (but skip any that were traded away via CBS transactions)
const _tradedAway = new Set();
CBS_TRANSACTIONS.forEach(txn => {
  if (txn.teamId && CBS_TEAM_MAP[txn.teamId]) {
    const destTeam = CBS_TEAM_MAP[txn.teamId];
    const isMine = LEAGUE_TEAMS.find(t => t.name === destTeam && t.mine);
    if (!isMine) {
      // This transaction's destination is NOT my team
      txn.players.forEach(p => {
        if (p.action && p.action.startsWith('Traded from')) {
          const found = _plyrI(p.name);
          _tradedAway.add(found ? found.name : p.name);
        }
      });
    }
  }
});
state.keepers.forEach(k => {
  if (_tradedAway.has(k)) return; // Don't re-add traded keepers
  if (!state.myTeam.includes(k)) state.myTeam.push(k);
  const kRd = state.keeperRounds[k] || null;
  if (!state.drafted[k]) state.drafted[k] = { time: Date.now(), mine: true, round: kRd };
});
save();
// Initialize original LCV values for time-split restoration
_initOriginalLcvValues();
// Apply saved split window if any
if (state._splitWindow && state._splitWindow !== 'full') {
  applySplitWindow(state._splitWindow);
}
render();

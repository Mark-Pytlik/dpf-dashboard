// ── Global State Namespace ────────────────────────────────────────────────
const DPF = { ui: {}, table: {}, league: {}, mock: {} };

// ── Tab management ────────────────────────────────────────────────────────
DPF.ui.currentTab = state._currentTab || 'league';
const tabs = document.querySelectorAll('.tab');
// Restore active tab highlight from saved state
tabs.forEach(t => {
  t.classList.toggle('active', t.dataset.tab === DPF.ui.currentTab);
});
tabs.forEach(t => t.addEventListener('click', () => {
  tabs.forEach(x => x.classList.remove('active'));
  t.classList.add('active');
  DPF.ui.currentTab = t.dataset.tab;
  state._currentTab = DPF.ui.currentTab;
  save();
  // Sync filterType from tab
  if (DPF.ui.currentTab === 'all') { DPF.ui.filterType = 'all'; }
  render();
}));

// Rename "My Roster" tab to owner name
const _myTeam = LEAGUE_TEAMS.find(t => t.mine);
if (_myTeam) {
  const myTab = document.querySelector('.tab[data-tab="myRoster"]');
  if (myTab) myTab.textContent = 'My Roster';
}

// ── Mode toggle (Draft vs Season) ─────────────────────────────────────────
state._mode = 'season';
const DRAFT_TABS = ['all','myRoster','roster','board','mock','league','futures','txns','analytics'];
const SEASON_TABS = ['all','myRoster','roster','league','futures','waiver','txns','analytics'];

// If the persisted tab isn't valid for the current (season) mode, fall back
// to the default. Keeps "open on last page" behaviour safe across mode force.
if (!SEASON_TABS.includes(DPF.ui.currentTab)) {
  DPF.ui.currentTab = 'league';
  state._currentTab = 'league';
  tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === 'league'));
}

function updateModeUI() {
  const isDraft = state._mode === 'draft';
  const draftBtn = document.getElementById('modeDraft');
  const seasonBtn = document.getElementById('modeSeason');
  if (draftBtn) {
    draftBtn.style.background = isDraft ? 'var(--accent)' : 'var(--surface2)';
    draftBtn.style.color = isDraft ? '#fff' : 'var(--text)';
    draftBtn.style.border = isDraft ? '1px solid transparent' : '1px solid var(--border)';
  }
  if (seasonBtn) {
    seasonBtn.style.background = !isDraft ? 'var(--accent)' : 'var(--surface2)';
    seasonBtn.style.color = !isDraft ? '#fff' : 'var(--text)';
    seasonBtn.style.border = !isDraft ? '1px solid transparent' : '1px solid var(--border)';
  }
  // Hide draft panel in season mode
  const dp = document.getElementById('draftPanel');
  if (dp && !isDraft) dp.classList.remove('show');
  // Show tag filter in both modes (badges are useful in season too)
  const tagFilt = document.getElementById('tagFilter');
  if (tagFilt) tagFilt.style.display = '';
  // Show/hide tabs based on mode
  document.querySelectorAll('.tab').forEach(t => {
    const tab = t.dataset.tab;
    const activeTabs = isDraft ? DRAFT_TABS : SEASON_TABS;
    t.style.display = activeTabs.includes(tab) ? '' : 'none';
    // In season mode, reorder visually by adjusting flex order
    t.style.order = activeTabs.indexOf(tab);
  });
}
document.getElementById('modeDraft').addEventListener('click', () => {
  state._mode = 'draft'; save(); updateModeUI();
  // If current tab is hidden, switch to default
  if (!DRAFT_TABS.includes(DPF.ui.currentTab)) {
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    DPF.ui.currentTab = 'all';
    const allTab = document.querySelector('.tab[data-tab="all"]');
    if (allTab) allTab.classList.add('active');
  }
  render();
});
document.getElementById('modeSeason').addEventListener('click', () => {
  state._mode = 'season'; save(); updateModeUI();
  if (!SEASON_TABS.includes(DPF.ui.currentTab)) {
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    DPF.ui.currentTab = 'league'; // Default to League tab in season mode
    const lTab = document.querySelector('.tab[data-tab="league"]');
    if (lTab) lTab.classList.add('active');
  }
  render();
});
updateModeUI();

// ── Sorting ───────────────────────────────────────────────────────────────
DPF.table.sortCol = 'dp';
DPF.table.sortDir = -1;

// ── Filters ───────────────────────────────────────────────────────────────
// Restore filter state from localStorage
try {
  const savedFilters = JSON.parse(localStorage.getItem('dpf_filters') || '{}');
  DPF.table.filterPos = savedFilters.filterPos || 'ALL';
  DPF.ui.filterType = savedFilters.filterType || 'all';
  DPF.ui.currentView = savedFilters.currentView || 's26';
  DPF.table.filterMinPA = savedFilters.filterMinPA || 0;
  DPF.table.filterMinIP = savedFilters.filterMinIP || 0;
} catch(e) {
  DPF.table.filterPos = 'ALL';
  DPF.ui.filterType = 'all';
  DPF.ui.currentView = 's26';
  DPF.table.filterMinPA = 0;
  DPF.table.filterMinIP = 0;
}
const posGroups = { all: ['ALL','C','1B','2B','3B','SS','LF','CF','RF','DH','SP','RP'],
                    bat: ['ALL','C','1B','2B','3B','SS','LF','CF','RF','DH'],
                    pit: ['ALL','SP','RP'] };

function syncNavTabs() {
  // Highlight the Players tab when switching filter types
  document.querySelectorAll('.tab').forEach(t => {
    if (t.dataset.tab === 'all') {
      t.classList.toggle('active', DPF.ui.currentTab === 'all');
    }
  });
}

function buildTypeFilters() {
  const container = document.getElementById('typeFilters');
  container.innerHTML = '';
  ['all','bat','pit'].forEach(t => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn' + (t === DPF.ui.filterType ? ' active' : '');
    btn.textContent = t === 'all' ? 'All' : t === 'bat' ? 'Hitters' : 'Pitchers';
    btn.onclick = () => {
      DPF.ui.filterType = t;
      DPF.table.filterPos = 'ALL';
      _saveFilters();
      syncNavTabs();
      render();
    };
    container.appendChild(btn);
  });
}

function buildPosFilters() {
  buildTypeFilters();
  const container = document.getElementById('posFilters');
  container.innerHTML = '';
  const group = DPF.ui.filterType === 'pit' ? 'pit' : DPF.ui.filterType === 'bat' ? 'bat' : 'all';
  posGroups[group].forEach(pos => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn' + (pos === DPF.table.filterPos ? ' active' : '');
    btn.textContent = pos;
    btn.onclick = () => {
      DPF.table.filterPos = pos;
      _saveFilters();
      render();
    };
    container.appendChild(btn);
  });
}

// Helper to save filter state
function _saveFilters() {
  try {
    localStorage.setItem('dpf_filters', JSON.stringify({
      filterPos: DPF.table.filterPos,
      filterType: DPF.ui.filterType,
      currentView: DPF.ui.currentView,
      filterMinPA: DPF.table.filterMinPA,
      filterMinIP: DPF.table.filterMinIP
    }));
  } catch(e) {}
}

// ── View toggle ──────────────────────────────────────────────────────────
DPF.ui.currentView = 's26'; // 'main', 's25', 'p26', 's26', 'avp'


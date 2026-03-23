// ── Tab management ────────────────────────────────────────────────────────
let currentTab = state._currentTab || 'league';
const tabs = document.querySelectorAll('.tab');
// Restore active tab highlight from saved state
tabs.forEach(t => {
  t.classList.toggle('active', t.dataset.tab === currentTab);
});
tabs.forEach(t => t.addEventListener('click', () => {
  tabs.forEach(x => x.classList.remove('active'));
  t.classList.add('active');
  currentTab = t.dataset.tab;
  state._currentTab = currentTab;
  save();
  // Sync filterType from tab
  if (currentTab === 'all') { filterType = 'all'; }
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
const SEASON_TABS = ['all','myRoster','roster','league','futures','txns','analytics'];

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
  if (!DRAFT_TABS.includes(currentTab)) {
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    currentTab = 'all';
    const allTab = document.querySelector('.tab[data-tab="all"]');
    if (allTab) allTab.classList.add('active');
  }
  render();
});
document.getElementById('modeSeason').addEventListener('click', () => {
  state._mode = 'season'; save(); updateModeUI();
  if (!SEASON_TABS.includes(currentTab)) {
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    currentTab = 'roster';
    const rTab = document.querySelector('.tab[data-tab="roster"]');
    if (rTab) rTab.classList.add('active');
  }
  render();
});
updateModeUI();

// ── Sorting ───────────────────────────────────────────────────────────────
let sortCol = 'dp', sortDir = -1;

// ── Filters ───────────────────────────────────────────────────────────────
let filterPos = 'ALL';
let filterType = 'all'; // 'all', 'bat', 'pit'
const posGroups = { all: ['ALL','C','1B','2B','3B','SS','LF','CF','RF','DH','SP','RP'],
                    bat: ['ALL','C','1B','2B','3B','SS','LF','CF','RF','DH'],
                    pit: ['ALL','SP','RP'] };

function syncNavTabs() {
  // Highlight the Players tab when switching filter types
  document.querySelectorAll('.tab').forEach(t => {
    if (t.dataset.tab === 'all') {
      t.classList.toggle('active', currentTab === 'all');
    }
  });
}

function buildTypeFilters() {
  const container = document.getElementById('typeFilters');
  container.innerHTML = '';
  ['all','bat','pit'].forEach(t => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn' + (t === filterType ? ' active' : '');
    btn.textContent = t === 'all' ? 'All' : t === 'bat' ? 'Hitters' : 'Pitchers';
    btn.onclick = () => { filterType = t; filterPos = 'ALL'; syncNavTabs(); render(); };
    container.appendChild(btn);
  });
}

function buildPosFilters() {
  buildTypeFilters();
  const container = document.getElementById('posFilters');
  container.innerHTML = '';
  const group = filterType === 'pit' ? 'pit' : filterType === 'bat' ? 'bat' : 'all';
  posGroups[group].forEach(pos => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn' + (pos === filterPos ? ' active' : '');
    btn.textContent = pos;
    btn.onclick = () => { filterPos = pos; render(); };
    container.appendChild(btn);
  });
}

// ── View toggle ──────────────────────────────────────────────────────────
let currentView = 'main'; // 'main', 's25', 'p26', 's26', 'avp'


// ── State ─────────────────────────────────────────────────────────────────
// STATE_VERSION bumped to 30 to force a full roster reset for clients carrying
// the pre-fix state with Nick Kurtz (and any other traded-away keeper) stuck
// on Mark's team. The pre-fix code unconditionally force-added DEFAULT_KEEPERS
// into state.myTeam on every load, so a migration alone won't clear it —
// we need the full-reset path in the _buildChanged branch.
const STATE_VERSION = 30;
// Build hash injected at build time by build_dashboard.py — a 12-char SHA256
// of the fully-assembled HTML. If the stored hash doesn't match the baked-in
// hash, localStorage is automatically flushed so the user always sees correct
// data after a deploy without hard-refreshing. IMPORTANT: this placeholder
// MUST be substituted at build time. If it isn't (i.e. the literal string
// '__BUILD_HASH__' is shipped), the flush never fires and stale state
// survives across deploys — that was the root cause of the persistent
// "Kurtz on my team" bug before the 2026-04-18 fix.
const BUILD_HASH = '__BUILD_HASH__';

// ── Keepers: read from league_config.json via build-time JSON injection ──
// This is the SINGLE SOURCE OF TRUTH for who starts the season on each team.
// When a keeper is traded, dropped, or otherwise no longer on their team,
// update data/league_config.json and rebuild. The old pattern of hardcoding
// constants here caused persistent state pollution because the code kept
// re-adding them to state.keepers/state.myTeam on every page load.
const LEAGUE_KEEPERS = __LEAGUE_KEEPERS_JSON__;         // { teamName: [{name,round}] }
const LEAGUE_MILB_KEEPERS = __LEAGUE_MILB_KEEPERS_JSON__; // { teamName: [name] }

// Draft order (pick 1 → pick 12) = reverse of last year's standings
const LEAGUE_TEAMS = __LEAGUE_TEAMS_JSON__;

// Derive my-team keepers from the config (no more DEFAULT_KEEPERS constant)
const _MY_TEAM_NAME_BOOT = (LEAGUE_TEAMS.find(t => t.mine) || {}).name;
const MY_KEEPERS = (LEAGUE_KEEPERS[_MY_TEAM_NAME_BOOT] || []).map(k => k.name);
const MY_KEEPER_ROUNDS = {};
(LEAGUE_KEEPERS[_MY_TEAM_NAME_BOOT] || []).forEach(k => { MY_KEEPER_ROUNDS[k.name] = k.round; });
const MY_MILB_KEEPERS = (LEAGUE_MILB_KEEPERS[_MY_TEAM_NAME_BOOT] || []).slice();

const TEAM_COLORS = {};
const teamColorPalette = [
  'rgba(239,68,68,0.15)', 'rgba(249,115,22,0.15)', 'rgba(234,179,8,0.15)',
  'rgba(34,197,94,0.15)', 'rgba(6,182,212,0.15)', 'rgba(59,130,246,0.15)',
  'rgba(139,92,246,0.15)', 'rgba(236,72,153,0.15)', 'rgba(168,85,247,0.15)',
  'rgba(20,184,166,0.15)', 'rgba(251,146,60,0.15)', 'rgba(163,230,53,0.15)'
];
const teamTextPalette = [
  '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#2563eb',
  '#7c3aed', '#db2777', '#a855f7', '#0d9488', '#ea580c', '#65a30d'
];
LEAGUE_TEAMS.forEach((t,i) => {
  TEAM_COLORS[t.owner || t.name] = { bg: teamColorPalette[i % 12], text: teamTextPalette[i % 12] };
});

let _saved = JSON.parse(localStorage.getItem('dpf2026') || 'null');
// Fresh-boot defaults. Keepers start as the config-defined set; runtime
// mutations (e.g. user drops a keeper, a trade removes one) update state.keepers
// and are persisted. We NEVER force-add config keepers back on later loads —
// that was the root cause of the Kurtz bug.
const _defaults = {
  _v: STATE_VERSION, _buildHash: BUILD_HASH, drafted: {}, myTeam: [],
  keepers: MY_KEEPERS.slice(),
  keeperRounds: Object.assign({}, MY_KEEPER_ROUNDS),
  milbKeepers: MY_MILB_KEEPERS.slice(),
  leagueTeams: {},
  teamOwners: {},
  tags: {},
  cbsTeamMap: {},
  leagueMilbKeepers: {}
};
let state;
if (_saved) {
  // ── Auto-flush on new deploy ──────────────────────────────────────────
  // If the build hash changed, the source files were updated. Do a full
  // roster reset so rosters rebuild from the latest keepers + draft +
  // transactions. User-specific UI prefs (tags, roster overrides, stat
  // set selection, comparison players) are preserved.
  //
  // Additionally force a reset if _v < 30 — that version introduced the
  // keepers-from-config refactor and the old localStorage state contains
  // stale keeper entries (e.g. Nick Kurtz) that were force-pushed by the
  // pre-fix code. A simple migration wouldn't know which entries were
  // user-added vs. force-added, so we do a clean rebuild.
  const _buildChanged = _saved._buildHash !== BUILD_HASH;
  const _versionForcesReset = !_saved._v || _saved._v < 30;
  if (_buildChanged || _versionForcesReset) {
    const _reason = _versionForcesReset
      ? `state version ${_saved._v || 'none'} → ${STATE_VERSION}`
      : `build hash ${_saved._buildHash || 'none'} → ${BUILD_HASH}`;
    console.log(`Flushing roster state (${_reason})`);
    // Preserve user UI preferences across the flush
    const _keepUiKeys = ['tags', 'rosterOverrides', 'leagueRosterOverrides',
      '_statSets', '_rosterTeam', '_cmpPlayers', '_rosterView', '_splitWindow'];
    const _preserved = {};
    _keepUiKeys.forEach(k => { if (_saved[k] !== undefined) _preserved[k] = _saved[k]; });
    state = Object.assign({}, _defaults, _preserved);
  } else {
    // Merge defaults for any missing keys, but preserve all existing data
    state = Object.assign({}, _defaults, _saved);
  }
  state._v = STATE_VERSION;
  state._buildHash = BUILD_HASH;
} else {
  state = _defaults;
}
// Ensure keeperRounds has the config rounds available as defaults, but do NOT
// override runtime values. This is read-only augmentation.
if (!state.keeperRounds) state.keeperRounds = {};
for (const [k, rd] of Object.entries(MY_KEEPER_ROUNDS)) {
  if (!(k in state.keeperRounds)) state.keeperRounds[k] = rd;
}
// keepers/milbKeepers: only bootstrap on empty state. DO NOT force-add config
// entries on later loads — user/trade mutations must be respected. This is
// the specific line that used to read:
//   DEFAULT_KEEPERS.forEach(k => { if (!state.keepers.includes(k)) state.keepers.push(k); });
// That pattern re-added traded-away keepers to my team on every page load.
if (!state.keepers || state.keepers.length === 0) state.keepers = MY_KEEPERS.slice();
if (!state.milbKeepers) state.milbKeepers = MY_MILB_KEEPERS.slice();
// leagueMilbKeepers: bootstrap if empty; do not force-add entries
if (!state.leagueMilbKeepers) state.leagueMilbKeepers = {};
for (const [teamName, rookies] of Object.entries(LEAGUE_MILB_KEEPERS)) {
  if (!state.leagueMilbKeepers[teamName] || state.leagueMilbKeepers[teamName].length === 0) {
    state.leagueMilbKeepers[teamName] = rookies.slice();
  }
}
// Ensure league teams + owners
if (!state.leagueTeams) state.leagueTeams = {};
if (!state.teamOwners) state.teamOwners = {};
// Pre-populate leagueTeams entries for all 12 teams (empty arrays if new)
LEAGUE_TEAMS.forEach(t => {
  if (!t.mine && !state.leagueTeams[t.name]) state.leagueTeams[t.name] = [];
  if (t.owner && !state.teamOwners[t.name]) state.teamOwners[t.name] = t.owner;
});
// Pre-populate league keepers (fuzzy-match names to player pool)
// Skip the "mine" team — its keepers are handled via state.keepers / state.myTeam
const _myTeamName = LEAGUE_TEAMS.find(t => t.mine)?.name;
for (const [teamName, keepers] of Object.entries(DEFAULT_LEAGUE_KEEPERS)) {
  if (teamName === _myTeamName) continue; // mine team keepers handled separately
  if (!state.leagueTeams[teamName] || state.leagueTeams[teamName].length === 0) {
    const matched = [];
    keepers.forEach(k => {
      const found = _plyrI(k.name);
      if (found) {
        matched.push(found.name);
        if (!state.drafted[found.name]) state.drafted[found.name] = { time: Date.now(), mine: false, round: k.rd };
        if (!state.keeperRounds) state.keeperRounds = {};
        state.keeperRounds[found.name] = k.rd;
      }
    });
    state.leagueTeams[teamName] = matched;
  }
}
const save = () => localStorage.setItem('dpf2026', JSON.stringify(state));
const MY_TEAM = LEAGUE_TEAMS.find(t => t.mine);

// ── Apply CBS Transactions to rosters ───────────────────────────────────
// CBS team names (which change frequently) → LEAGUE_TEAMS name mapping
// CBS teamId is stable; CBS team display names may differ from LEAGUE_TEAMS names
const CBS_ID_TO_LEAGUE = {};
// Map CBS team names to league team names by matching known CBS team IDs to LEAGUE_TEAMS
// CBS IDs verified from CBS transaction data:
// 1=Kaskie (pick 1), 2=Rescan (pick 7, no txns), 3=Roth (pick 3), 4=Pytlik (pick 2),
// 1=Roth, 3=Kaskie (was "choured in the usa."), 4=Pytlik (was "Father Jhon Kensy")
// 5=Devinney (pick 5), 6=Wolfe (pick 6), 7=Gaerig (pick 4, no txns),
// 8=Azar (pick 8, no txns), 9=Murphy (pick 9), 10=Brundrett (pick 10),
// 11=Sarris (pick 11, no txns), 12=Dennewitz (pick 12)
// CBS team IDs → team names (verified from CBS transactions page dropdown)
// NOTE: CBS IDs do NOT correspond to draft pick numbers!
const CBS_TEAM_MAP = {
  1: 'Weird Fishes / Arrighetti',          // Chris Kaskie (renamed from "Dennis Santana...")
  2: 'Dinosaur Jr Caminero',               // Anthony Rescan
  3: "Colonel Corbin's Ascent",             // David Roth
  4: 'Okamotomami',                         // Mark Pytlik (mine)
  5: 'Buddy Buddy Buddy All On Base',       // Fran Devinney
  6: 'A Pete Crow-Armstrong Looked at Me',  // Ian Wolfe
  7: "Whoop Whoop that's the sound of Dylan Cease", // Andrew Gaerig
  8: 'Ballesteros, Let the Rhythm Take You Over',   // Mark Azar
  9: 'Yesavage Garden',                     // Blake Murphy
  10: 'Blame it on the Rainiel',            // Trei Brundrett
  11: 'Before and After Shohei',            // Eno Sarris (renamed)
  12: "Popped A Mahle I'm Sweating"          // Matt Dennewitz
};
// Also build reverse lookup: CBS display team name → league team name
const CBS_NAME_TO_LEAGUE = {};
for (const [id, name] of Object.entries(CBS_TEAM_MAP)) CBS_NAME_TO_LEAGUE[name] = name;
// Map known CBS display names that differ from LEAGUE_TEAMS names
// Also infer team name changes: if CBS shows a different name for a known teamId,
// update LEAGUE_TEAMS to use the new name so the UI stays current
CBS_TRANSACTIONS.forEach(txn => {
  // CBS records the team name in `teamName`; older exports used `team`. Fall back so
  // a schema drift can't silently wipe CBS_TEAM_MAP with `undefined`.
  const txTeam = txn.teamName || txn.team;
  if (!txTeam) return;
  if (txn.teamId && CBS_TEAM_MAP[txn.teamId]) {
    const leagueName = CBS_TEAM_MAP[txn.teamId];
    CBS_NAME_TO_LEAGUE[txTeam] = leagueName;
    // If the CBS name differs, update the team's display name
    if (txTeam !== leagueName) {
      const team = LEAGUE_TEAMS.find(t => t.name === leagueName);
      if (team) {
        const oldName = team.name;
        team.name = txTeam;
        CBS_TEAM_MAP[txn.teamId] = txTeam;
        CBS_NAME_TO_LEAGUE[txTeam] = txTeam;
        // Migrate roster data to new name
        if (state.leagueTeams[oldName]) {
          state.leagueTeams[txTeam] = state.leagueTeams[oldName];
          delete state.leagueTeams[oldName];
        }
      }
    }
  }
});

// Known old CBS team names → CBS team ID. CBS records trades using the team name
// at the time of the trade, but teams rename frequently. This table lets us resolve
// "Traded from <old name>" actions correctly, even in multi-team trades.
const CBS_OLD_NAMES = {
  'choured in the usa.': 1,   // Kaskie's old-old name (CBS ID 1)
  'Dennis Santana - Smooth ft. Rob Thomas': 1, // Kaskie's previous name (CBS ID 1)
  'Father Jhon Kensy': 4,     // Pytlik (now Okamotomami)
  'Are we not men? We are Devers!': 11, // Sarris's previous name (CBS ID 11)
};
for (const [oldName, cbsId] of Object.entries(CBS_OLD_NAMES)) {
  if (CBS_TEAM_MAP[cbsId] && !CBS_NAME_TO_LEAGUE[oldName]) {
    CBS_NAME_TO_LEAGUE[oldName] = CBS_TEAM_MAP[cbsId];
    console.log('Old name alias: "' + oldName + '" → "' + CBS_NAME_TO_LEAGUE[oldName] + '"');
  }
}

function resolveCbsTeam(txn) {
  const txTeam = txn.teamName || txn.team;
  if (txn.teamId && CBS_TEAM_MAP[txn.teamId]) return CBS_TEAM_MAP[txn.teamId];
  if (txTeam && CBS_NAME_TO_LEAGUE[txTeam]) return CBS_NAME_TO_LEAGUE[txTeam];
  return txTeam;
}

function addToRoster(playerName, teamName) {
  const isMine = LEAGUE_TEAMS.find(t => t.name === teamName && t.mine);
  if (isMine) {
    if (!state.myTeam.includes(playerName)) state.myTeam.push(playerName);
  } else {
    if (!state.leagueTeams[teamName]) state.leagueTeams[teamName] = [];
    if (!state.leagueTeams[teamName].includes(playerName)) state.leagueTeams[teamName].push(playerName);
  }
  if (!state.drafted[playerName]) state.drafted[playerName] = { time: Date.now(), mine: !!isMine };
}

function removeFromRoster(playerName, teamName) {
  const isMine = LEAGUE_TEAMS.find(t => t.name === teamName && t.mine);
  if (isMine) {
    state.myTeam = state.myTeam.filter(n => n !== playerName);
  } else if (state.leagueTeams[teamName]) {
    state.leagueTeams[teamName] = state.leagueTeams[teamName].filter(n => n !== playerName);
  }
}

function removeFromAllRosters(playerName) {
  state.myTeam = state.myTeam.filter(n => n !== playerName);
  for (const tkey of Object.keys(state.leagueTeams)) {
    state.leagueTeams[tkey] = state.leagueTeams[tkey].filter(n => n !== playerName);
  }
}

// Parse CBS date strings reliably for comparison
function parseCbsDate(s) {
  if (!s) return 0;
  let d = s.replace(/\s*ET\s*$/, '').trim();
  d = d.replace(/^(\d{1,2})\/(\d{1,2})\/(\d{2})\b/, (m,mo,dy,yr) => `${mo}/${dy}/20${yr}`);
  return new Date(d).getTime() || 0;
}


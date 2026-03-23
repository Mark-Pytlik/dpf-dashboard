// ── State ─────────────────────────────────────────────────────────────────
const STATE_VERSION = 18;
const DEFAULT_KEEPERS = ['James Wood', 'MacKenzie Gore', 'Zach Neto', 'Nick Kurtz', 'Jo Adell'];
const DEFAULT_KEEPER_ROUNDS = {'James Wood':12, 'MacKenzie Gore':13, 'Jo Adell':10, 'Zach Neto':14, 'Nick Kurtz':11};

// All league keepers from 2026 keeper sheet (clamped rounds)
const DEFAULT_LEAGUE_KEEPERS = {
  'Dennis Santana - Smooth ft. Rob Thomas': [
    {name:'Corbin Carroll',rd:6}, {name:'Jackson Chourio',rd:10}, {name:'Wyatt Langford',rd:12}, {name:'Ben Rice',rd:15}, {name:'Tyler Soderstrom',rd:25}
  ],
  'Okamotomami': [
    {name:'Jo Adell',rd:10}, {name:'Nick Kurtz',rd:11}, {name:'James Wood',rd:12}, {name:'MacKenzie Gore',rd:13}, {name:'Zach Neto',rd:14}
  ],
  "Colonel Corbin's Ascent": [
    {name:'Jose Ramirez',rd:1}, {name:'Trea Turner',rd:4}, {name:'Devin Williams',rd:7}, {name:'Brandon Woodruff',rd:10}, {name:'Dylan Crews',rd:15}
  ],
  "Whoop Whoop that\'s the sound of Dylan Cease": [
    {name:'Juan Soto',rd:4}, {name:'Bo Bichette',rd:5}, {name:'Geraldo Perdomo',rd:15}, {name:'Gerrit Cole',rd:26}, {name:'Spencer Torkelson',rd:27}
  ],
  'Blame it on the Rainiel': [
    {name:'Manny Machado',rd:1}, {name:'Spencer Strider',rd:6}, {name:'Colson Montgomery',rd:14}, {name:'Cameron Schlittler',rd:15}, {name:'Ceddanne Rafaela',rd:22}
  ],
  'A Pete Crow-Armstrong Looked at Me': [
    {name:'Mookie Betts',rd:2}, {name:'Bryce Harper',rd:5}, {name:'Elly De La Cruz',rd:6}, {name:'Pete Crow-Armstrong',rd:11}, {name:'Hunter Goodman',rd:15}
  ],
  'Dinosaur Jr Caminero': [
    {name:'Fernando Tatis Jr.',rd:4}, {name:'Julio Rodriguez',rd:5}, {name:'Gunnar Henderson',rd:6}, {name:'Junior Caminero',rd:12}, {name:'Jackson Holliday',rd:16}
  ],
  "Ballesteros, Let the Rhythm Take You Over": [
    {name:'Ketel Marte',rd:1}, {name:'Oneil Cruz',rd:8}, {name:'Aroldis Chapman',rd:11}, {name:'Roman Anthony',rd:15}, {name:'Shea Langeliers',rd:16}
  ],
  'Yesavage Garden': [
    {name:'CJ Abrams',rd:8}, {name:'Jeremy Pena',rd:15}, {name:'Brent Rooker',rd:17}, {name:'Max Muncy',rd:21}, {name:'Eury Perez',rd:24}
  ],
  'Buddy Buddy Buddy All On Base': [
    {name:'Ronald Acuna Jr.',rd:4}, {name:'Cal Raleigh',rd:7}, {name:'Kyle Bradish',rd:11}, {name:'Nico Hoerner',rd:12}, {name:'Jesus Luzardo',rd:14}
  ],
  'Are we not men? We are Devers!': [
    {name:'Shohei Ohtani',rd:1}, {name:'Francisco Lindor',rd:3}, {name:'Jackson Merrill',rd:10}, {name:'Tarik Skubal',rd:11}, {name:'Maikel Garcia',rd:15}
  ],
  "Popped A Mahle I'm Sweating": [
    {name:'Kyle Tucker',rd:2}, {name:'Aaron Judge',rd:3}, {name:'Bobby Witt Jr.',rd:4}, {name:'Paul Skenes',rd:10}, {name:'Garrett Crochet',rd:11}
  ],
};
const DEFAULT_MILB_KEEPERS = ['Charlie Condon', 'Max Clark', 'Ethan Holliday', 'Eli Willits'];

// All league rookie/MiLB keepers from 2026 keeper sheet
const DEFAULT_LEAGUE_MILB_KEEPERS = {
  'Dennis Santana - Smooth ft. Rob Thomas': ['JJ Wetherholt', 'Carson Williams', 'George Lombard'],
  "Colonel Corbin's Ascent": ['Nolan McLean', 'Carson Benge', 'Bryce Eldridge', 'Jonah Tong'],
  "Whoop Whoop that's the sound of Dylan Cease": ['Konnor Griffin', 'Kevin McGonigle', 'Walker Jenkins', 'Luis Pena'],
  'Blame it on the Rainiel': ['Travis Bazzana', 'Justin Crawford', 'Josue De Paula', 'Andrew Painter'],
  'A Pete Crow-Armstrong Looked at Me': ['Sal Stewart', 'Jesus Made', 'Colt Emerson', 'Sebastian Wolcott'],
  'Dinosaur Jr Caminero': ['Leo De Vries', 'Aidan Miller', 'Samuel Basallo', 'Bubba Chandler'],
  "Ballesteros, Let the Rhythm Take You Over": ['Liam Doyle', 'Chase Burns', 'Hagen Smith', 'Jordan Lawlar'],
  'Yesavage Garden': ['Trey Yesavage', 'Jett Williams', 'Kade Anderson', 'Edward Florentino'],
  'Buddy Buddy Buddy All On Base': ['Jacob Reimer', 'Caleb Bonemer', 'Quinn Mathews', 'Robby Snelling'],
  'Are we not men? We are Devers!': ['Connolly Early', 'Tommy Troy', 'Chase deLauter', 'Spencer Jones'],
  "Popped A Mahle I'm Sweating": ['Ralphy Velazquez', 'Zyhir Hope', 'Emmanuel Rodriguez']
};

// Draft order (pick 1 → pick 12) = reverse of last year's standings
const LEAGUE_TEAMS = __LEAGUE_TEAMS_JSON__;

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
// Never wipe saved state on version change — migrate instead
const _defaults = {
  _v: STATE_VERSION, drafted: {}, myTeam: [],
  keepers: DEFAULT_KEEPERS.slice(),
  keeperRounds: Object.assign({}, DEFAULT_KEEPER_ROUNDS),
  milbKeepers: DEFAULT_MILB_KEEPERS.slice(),
  leagueTeams: {},
  teamOwners: {},
  tags: {},
  cbsTeamMap: {},
  leagueMilbKeepers: {}
};
let state;
if (_saved) {
  // Merge defaults for any missing keys, but preserve all existing data
  state = Object.assign({}, _defaults, _saved);
  // v17 migration: CBS_TEAM_MAP was wrong in v16, corrupting leagueTeams rosters.
  // Reset leagueTeams so they rebuild cleanly from keepers + CBS transactions.
  if (!_saved._v || _saved._v < 18) {
    console.log('v18 migration: resetting leagueTeams (trade alias fix)');
    state.leagueTeams = {};
    state.leagueMilbKeepers = {};
    // Also clean stale team names from teamOwners
    const validNames = new Set(LEAGUE_TEAMS.map(t => t.name));
    for (const k of Object.keys(state.teamOwners)) {
      if (!validNames.has(k)) delete state.teamOwners[k];
    }
  }
  state._v = STATE_VERSION;
} else {
  state = _defaults;
}
// Ensure keeperRounds always exists and has defaults merged in
if (!state.keeperRounds) state.keeperRounds = {};
for (const [k, rd] of Object.entries(DEFAULT_KEEPER_ROUNDS)) {
  if (!(k in state.keeperRounds)) state.keeperRounds[k] = rd;
}
// Ensure keepers array has defaults
if (!state.keepers || state.keepers.length === 0) state.keepers = DEFAULT_KEEPERS.slice();
DEFAULT_KEEPERS.forEach(k => { if (!state.keepers.includes(k)) state.keepers.push(k); });
// Ensure MiLB keepers
if (!state.milbKeepers) state.milbKeepers = DEFAULT_MILB_KEEPERS.slice();
DEFAULT_MILB_KEEPERS.forEach(k => { if (!state.milbKeepers.includes(k)) state.milbKeepers.push(k); });
// Ensure league MiLB keepers
if (!state.leagueMilbKeepers) state.leagueMilbKeepers = {};
for (const [teamName, rookies] of Object.entries(DEFAULT_LEAGUE_MILB_KEEPERS)) {
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
for (const [teamName, keepers] of Object.entries(DEFAULT_LEAGUE_KEEPERS)) {
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
// 5=Devinney (pick 5), 6=Wolfe (pick 6), 7=Gaerig (pick 4, no txns),
// 8=Azar (pick 8, no txns), 9=Murphy (pick 9), 10=Brundrett (pick 10),
// 11=Sarris (pick 11, no txns), 12=Dennewitz (pick 12)
const CBS_TEAM_MAP = {
  1: LEAGUE_TEAMS.find(t => t.owner === 'Chris Kaskie')?.name || 'Dennis Santana - Smooth ft. Rob Thomas',
  2: LEAGUE_TEAMS.find(t => t.owner === 'Anthony Rescan')?.name || 'Dinosaur Jr Caminero',
  3: LEAGUE_TEAMS.find(t => t.owner === 'David Roth')?.name || "Colonel Corbin's Ascent",
  4: LEAGUE_TEAMS.find(t => t.mine)?.name || 'Okamotomami',
  5: LEAGUE_TEAMS.find(t => t.owner === 'Fran Devinney')?.name || 'Buddy Buddy Buddy All On Base',
  6: LEAGUE_TEAMS.find(t => t.owner === 'Ian Wolfe')?.name || 'A Pete Crow-Armstrong Looked at Me',
  7: LEAGUE_TEAMS.find(t => t.owner === 'Andrew Gaerig')?.name || "Whoop Whoop that's the sound of Dylan Cease",
  8: LEAGUE_TEAMS.find(t => t.owner === 'Mark Azar')?.name || "Ballesteros, Let the Rhythm Take You Over",
  9: LEAGUE_TEAMS.find(t => t.owner === 'Blake Murphy')?.name || 'Yesavage Garden',
  10: LEAGUE_TEAMS.find(t => t.owner === 'Trei Brundrett')?.name || 'Blame it on the Rainiel',
  11: LEAGUE_TEAMS.find(t => t.owner === 'Eno Sarris')?.name || 'Are we not men? We are Devers!',
  12: LEAGUE_TEAMS.find(t => t.owner === 'Matt Dennewitz')?.name || "Popped A Mahle I'm Sweating"
};
// Also build reverse lookup: CBS display team name → league team name
const CBS_NAME_TO_LEAGUE = {};
for (const [id, name] of Object.entries(CBS_TEAM_MAP)) CBS_NAME_TO_LEAGUE[name] = name;
// Map known CBS display names that differ from LEAGUE_TEAMS names
// Also infer team name changes: if CBS shows a different name for a known teamId,
// update LEAGUE_TEAMS to use the new name so the UI stays current
CBS_TRANSACTIONS.forEach(txn => {
  if (txn.teamId && CBS_TEAM_MAP[txn.teamId]) {
    const leagueName = CBS_TEAM_MAP[txn.teamId];
    CBS_NAME_TO_LEAGUE[txn.team] = leagueName;
    // If the CBS name differs, update the team's display name
    if (txn.team !== leagueName) {
      const team = LEAGUE_TEAMS.find(t => t.name === leagueName);
      if (team) {
        const oldName = team.name;
        team.name = txn.team;
        CBS_TEAM_MAP[txn.teamId] = txn.team;
        CBS_NAME_TO_LEAGUE[txn.team] = txn.team;
        // Migrate roster data to new name
        if (state.leagueTeams[oldName]) {
          state.leagueTeams[txn.team] = state.leagueTeams[oldName];
          delete state.leagueTeams[oldName];
        }
      }
    }
  }
});

// Resolve old team names found in "Traded from X" trade actions.
// CBS records trades using the team name at the time of the trade, but teams rename.
// For 2-team trades (same timestamp), we can infer: the "Traded from X" source is
// the OTHER team in the trade pair.
(function resolveTradeAliases() {
  const byTime = {};
  CBS_TRANSACTIONS.forEach(txn => {
    txn.players.forEach(p => {
      if ((p.action || '').startsWith('Traded from ')) {
        const src = p.action.replace('Traded from ', '');
        if (!byTime[txn.date]) byTime[txn.date] = [];
        byTime[txn.date].push({ txn, src });
      }
    });
  });
  for (const entries of Object.values(byTime)) {
    // Unique teams involved in this trade timestamp
    const teams = [...new Map(entries.map(e => [e.txn.teamId, e.txn])).values()];
    // Unique unresolved source names
    const srcNames = [...new Set(entries.map(e => e.src))].filter(s => !CBS_NAME_TO_LEAGUE[s]);
    if (srcNames.length === 0) return;
    if (teams.length === 2) {
      // 2-team trade: each source name is the other team's old name
      srcNames.forEach(sn => {
        // Find which team RECEIVED from this source
        const receiver = entries.find(e => e.src === sn);
        if (!receiver) return;
        const other = teams.find(t => t.teamId !== receiver.txn.teamId);
        if (other) {
          const resolved = (other.teamId && CBS_TEAM_MAP[other.teamId]) ? CBS_TEAM_MAP[other.teamId] : other.team;
          CBS_NAME_TO_LEAGUE[sn] = resolved;
          console.log('Trade alias: "' + sn + '" → "' + resolved + '"');
        }
      });
    } else {
      // Multi-team trade: try matching source names to teams by teamId from other entries
      srcNames.forEach(sn => {
        // See if any team in this trade group has this as a known old name
        teams.forEach(t => {
          if (t.team === sn || (t.teamId && CBS_TEAM_MAP[t.teamId] === sn)) {
            CBS_NAME_TO_LEAGUE[sn] = CBS_TEAM_MAP[t.teamId] || t.team;
          }
        });
      });
    }
  }
})();

function resolveCbsTeam(txn) {
  if (txn.teamId && CBS_TEAM_MAP[txn.teamId]) return CBS_TEAM_MAP[txn.teamId];
  if (CBS_NAME_TO_LEAGUE[txn.team]) return CBS_NAME_TO_LEAGUE[txn.team];
  return txn.team;
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


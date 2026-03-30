// ── State ─────────────────────────────────────────────────────────────────
const STATE_VERSION = 26;
const DEFAULT_KEEPERS = ['James Wood', 'MacKenzie Gore', 'Zach Neto', 'Nick Kurtz', 'Jo Adell'];
const DEFAULT_KEEPER_ROUNDS = {'James Wood':12, 'MacKenzie Gore':13, 'Jo Adell':10, 'Zach Neto':14, 'Nick Kurtz':11};

// All league keepers from 2026 keeper sheet (clamped rounds)
const DEFAULT_LEAGUE_KEEPERS = {
  'Weird Fishes / Arrighetti': [
    {name:'Jose Ramirez',rd:1}, {name:'Trea Turner',rd:4}, {name:'Devin Williams',rd:7}, {name:'Brandon Woodruff',rd:10}, {name:'Dylan Crews',rd:15}
  ],
  'Okamotomami': [
    {name:'Jo Adell',rd:10}, {name:'Nick Kurtz',rd:11}, {name:'James Wood',rd:12}, {name:'MacKenzie Gore',rd:13}, {name:'Zach Neto',rd:14}
  ],
  "Colonel Corbin's Ascent": [
    {name:'Corbin Carroll',rd:6}, {name:'Jackson Chourio',rd:10}, {name:'Wyatt Langford',rd:12}, {name:'Ben Rice',rd:15}, {name:'Tyler Soderstrom',rd:25}
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
  'Before and After Shohei': [
    {name:'Shohei Ohtani',rd:1}, {name:'Francisco Lindor',rd:3}, {name:'Jackson Merrill',rd:10}, {name:'Tarik Skubal',rd:11}, {name:'Maikel Garcia',rd:15}
  ],
  "Popped A Mahle I'm Sweating": [
    {name:'Kyle Tucker',rd:2}, {name:'Aaron Judge',rd:3}, {name:'Bobby Witt Jr.',rd:4}, {name:'Paul Skenes',rd:10}, {name:'Garrett Crochet',rd:11}
  ],
};
const DEFAULT_MILB_KEEPERS = ['Charlie Condon', 'Max Clark', 'Ethan Holliday', 'Eli Willits'];

// All league rookie/MiLB keepers from 2026 keeper sheet
const DEFAULT_LEAGUE_MILB_KEEPERS = {
  'Weird Fishes / Arrighetti': ['Nolan McLean', 'Carson Benge', 'Bryce Eldridge', 'Jonah Tong'],
  "Colonel Corbin's Ascent": ['JJ Wetherholt', 'Carson Williams', 'George Lombard'],
  "Whoop Whoop that's the sound of Dylan Cease": ['Konnor Griffin', 'Kevin McGonigle', 'Walker Jenkins', 'Luis Pena'],
  'Blame it on the Rainiel': ['Travis Bazzana', 'Justin Crawford', 'Josue De Paula', 'Andrew Painter'],
  'A Pete Crow-Armstrong Looked at Me': ['Sal Stewart', 'Jesus Made', 'Colt Emerson', 'Sebastian Wolcott'],
  'Dinosaur Jr Caminero': ['Leo De Vries', 'Aidan Miller', 'Samuel Basallo', 'Bubba Chandler'],
  "Ballesteros, Let the Rhythm Take You Over": ['Liam Doyle', 'Chase Burns', 'Hagen Smith', 'Jordan Lawlar'],
  'Yesavage Garden': ['Trey Yesavage', 'Jett Williams', 'Kade Anderson', 'Edward Florentino'],
  'Buddy Buddy Buddy All On Base': ['Jacob Reimer', 'Caleb Bonemer', 'Quinn Mathews', 'Robby Snelling'],
  'Before and After Shohei': ['Connolly Early', 'Tommy Troy', 'Chase deLauter', 'Spencer Jones'],
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
  if (!_saved._v || _saved._v < 26) {
    console.log('v26 migration: full roster reset — fixed CBS↔FanGraphs MLB team abbreviation mismatch');
    state.leagueTeams = {};
    state.leagueMilbKeepers = {};
    state.drafted = {};
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


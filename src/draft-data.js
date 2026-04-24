// ── LIVE DRAFT PICKS (injected from CBS draft room) ─────────────────────
// t: team pick position: 1=Kaskie, 2=Pytlik(mine), 3=Roth, 4=Gaerig, 5=Devinney, 6=Wolfe, 7=Rescan, 8=Azar, 9=Murphy, 10=Brundrett, 11=Sarris, 12=Dennewitz
const _TEAM_MAP = Object.fromEntries(LEAGUE_TEAMS.map(t => [t.pick, t.name]));
const LIVE_PICKS = [
  // Rd1: picks 1-12
  {n:'Vladimir Guerrero Jr.',t:1},{n:'Yoshinobu Yamamoto',t:2},{n:'Jose Ramirez',t:3},{n:'Jazz Chisholm Jr.',t:4},
  {n:'Manny Machado',t:5},{n:'Bryan Woo',t:6},{n:'Cristopher Sanchez',t:7},{n:'Ketel Marte',t:8},
  {n:'Pete Alonso',t:9},{n:'Chris Sale',t:10},{n:'Shohei Ohtani',t:11},{n:'Logan Webb',t:12},
  // Rd2: picks 13-24 (snake)
  {n:'Kyle Tucker',t:12},{n:'Matt Olson',t:11},{n:'Yordan Alvarez',t:10},{n:'Hunter Brown',t:9},
  {n:'Logan Gilbert',t:8},{n:'Max Fried',t:7},{n:'Mookie Betts',t:6},{n:'Kyle Schwarber',t:5},
  {n:'Cody Bellinger',t:4},{n:'Rafael Devers',t:3},{n:'Jhoan Duran',t:2},{n:'Cole Ragans',t:1},
  // Rd3: picks 25-36
  {n:'Freddy Peralta',t:1},{n:'Mason Miller',t:2},{n:'Framber Valdez',t:3},{n:'George Kirby',t:4},
  {n:'Freddie Freeman',t:5},{n:'Edwin Diaz',t:6},{n:'Jacob deGrom',t:7},{n:'Corey Seager',t:8},
  {n:'Riley Greene',t:9},{n:'Josh Naylor',t:10},{n:'Francisco Lindor',t:11},{n:'Aaron Judge',t:12},
  // Rd4: picks 37-48 (snake)
  {n:'Bobby Witt Jr.',t:12},{n:'Andres Munoz',t:11},{n:'Ronald Acuna Jr.',t:10},{n:'Joe Ryan',t:9},
  {n:'Sandy Alcantara',t:8},{n:'Fernando Tatis Jr.',t:7},{n:'Alex Bregman',t:6},{n:'Dylan Cease',t:5},
  {n:'Juan Soto',t:4},{n:'Trea Turner',t:3},{n:'Austin Riley',t:2},{n:'Brice Turang',t:1},
  // Rd5: picks 49-60
  {n:'Jacob Misiorowski',t:1},{n:'Nick Lodolo',t:2},{n:'Byron Buxton',t:3},{n:'Bo Bichette',t:4},
  {n:'Cade Smith',t:5},{n:'Bryce Harper',t:6},{n:'Julio Rodriguez',t:7},{n:'Jarren Duran',t:8},
  {n:'William Contreras',t:9},{n:'Jacob Wilson',t:10},{n:'Emmet Sheehan',t:11},{n:'Vinnie Pasquantino',t:12},
  // Rd6: picks 61-72 (snake)
  {n:'Will Smith',t:12},{n:'David Bednar',t:11},{n:'Michael Harris II',t:10},{n:'Jose Altuve',t:9},
  {n:'Kevin Gausman',t:8},{n:'Gunnar Henderson',t:7},{n:'Elly De La Cruz',t:6},{n:'Spencer Strider',t:5},
  {n:'Nick Pivetta',t:4},{n:'Tatsuya Imai',t:3},{n:'Drake Baldwin',t:2},{n:'Corbin Carroll',t:1},
  // Rd7: picks 73-84
  {n:'Tyler Glasnow',t:1},{n:'Griffin Jax',t:2},{n:'Devin Williams',t:3},{n:'Raisel Iglesias',t:4},
  {n:'Trevor Rogers',t:5},{n:'Matthew Boyd',t:6},{n:'Yandy Diaz',t:7},{n:'Ryan Helsley',t:8},
  {n:'Drew Rasmussen',t:9},{n:'Cal Raleigh',t:10},{n:'Seiya Suzuki',t:11},{n:'Steven Kwan',t:12},
  // Rd8: picks 85-96 (snake)
  {n:'Daniel Palencia',t:12},{n:'Alejandro Kirk',t:11},{n:'Michael King',t:10},{n:'CJ Abrams',t:9},
  {n:'Oneil Cruz',t:8},{n:'Josh Hader',t:7},{n:'Trevor Megill',t:6},{n:'Adley Rutschman',t:5},
  {n:'Agustin Ramirez',t:4},{n:'Christian Yelich',t:3},{n:'George Springer',t:2},{n:'Sonny Gray',t:1},
  // Rd9: picks 97-108
  {n:'Isaac Paredes',t:1},{n:'Shane McClanahan',t:2},{n:'Gavin Williams',t:3},{n:'Kyle Stowers',t:4},
  {n:'Luke Keaschall',t:5},{n:'Noah Cameron',t:6},{n:'Zack Wheeler',t:7},{n:'Michael Busch',t:8},
  {n:'Daulton Varsho',t:9},{n:'Bryan Abreu',t:10},{n:'Ozzie Albies',t:11},{n:'Eugenio Suarez',t:12},
  // Rd10: picks 109-120 (snake)
  {n:'Paul Skenes',t:12},{n:'Jackson Merrill',t:11},{n:'Abner Uribe',t:10},{n:'Jeff Hoffman',t:9},
  {n:'Nathan Eovaldi',t:8},{n:'Taylor Ward',t:7},{n:'Bryan Reynolds',t:6},{n:'Emilio Pagan',t:5},
  {n:'Salvador Perez',t:4},{n:'Brandon Woodruff',t:3},{n:'Jo Adell',t:2},{n:'Jackson Chourio',t:1},
  // Rd11: picks 121-132
  {n:'Carlos Estevez',t:1},{n:'Nick Kurtz',t:2},{n:'Brandon Lowe',t:3},{n:'Ryan Pepiot',t:4},
  {n:'Teoscar Hernandez',t:5},{n:'Pete Crow-Armstrong',t:6},{n:'Grant Taylor',t:7},{n:'Aroldis Chapman',t:8},
  {n:'Pete Fairbanks',t:9},{n:'Kyle Bradish',t:10},{n:'Tarik Skubal',t:11},{n:'Garrett Crochet',t:12},
  // Rd12: picks 133-144 (snake)
  {n:'Matt McLain',t:12},{n:'Andy Pages',t:11},{n:'Nico Hoerner',t:10},{n:'Jeremiah Estrada',t:9},
  {n:'Ivan Herrera',t:8},{n:'Junior Caminero',t:7},{n:'Brendan Donovan',t:6},{n:'Dennis Santana',t:5},
  {n:'Kris Bubic',t:4},{n:'Randy Arozarena',t:3},{n:'James Wood',t:2},{n:'Wyatt Langford',t:1},
  // Rd13: picks 145-156
  {n:'Jac Caglianone',t:1},{n:'MacKenzie Gore',t:2},{n:'Shota Imanaga',t:3},{n:'Kenley Jansen',t:4},
  {n:'Trevor Story',t:5},{n:'Luis Castillo',t:6},{n:'Ranger Suarez',t:7},{n:'Ryan Walker',t:8},
  {n:'Robert Suarez',t:9},{n:'Alec Burleson',t:10},{n:'Cade Horton',t:11},{n:'Matt Svanson',t:12},
  // Rd14: picks 157-168 (snake)
  {n:'Zac Gallen',t:12},{n:'Edward Cabrera',t:11},{n:'Jesus Luzardo',t:10},{n:'Matt Chapman',t:9},
  {n:'Jack Flaherty',t:8},{n:'Garrett Whitlock',t:7},{n:'Kerry Carpenter',t:6},{n:'Colson Montgomery',t:5},
  {n:'Xavier Edwards',t:4},{n:'Kevin Ginkel',t:3},{n:'Zach Neto',t:2},{n:'Kazuma Okamoto',t:1},
  // Rd15: picks 169-180
  {n:'Ben Rice',t:1},{n:'Gleyber Torres',t:2},{n:'Dylan Crews',t:3},{n:'Geraldo Perdomo',t:4},
  {n:'Cameron Schlittler',t:5},{n:'Hunter Goodman',t:6},{n:'Willson Contreras',t:7},{n:'Roman Anthony',t:8},
  {n:'Jeremy Pena',t:9},{n:'Garrett Cleavinger',t:10},{n:'Maikel Garcia',t:11},{n:'Jose A. Ferrer',t:12},
  // Rd16: picks 181-192 (snake)
  {n:'Carter Jensen',t:12},{n:'Adrian Morejon',t:11},{n:'Robert Garcia',t:10},{n:'Seranthony Dominguez',t:9},
  {n:'Shea Langeliers',t:8},{n:'Jackson Holliday',t:7},{n:'Blake Snell',t:6},{n:'Trent Grisham',t:5},
  {n:'Ryan Weathers',t:4},{n:'Francisco Alvarez',t:3},{n:'Tyler Rogers',t:2},{n:'Riley O\'Brien',t:1},
  // Rd17: picks 193-204
  {n:'Robbie Ray',t:1},{n:'JoJo Romero',t:2},{n:'Sal Frelick',t:3},{n:'Justin Sterner',t:4},
  {n:'Chandler Simpson',t:5},{n:'Andrew Abbott',t:6},{n:'Kyle Teel',t:7},{n:'Carlos Correa',t:8},
  {n:'Brent Rooker',t:9},{n:'Matt Brash',t:10},{n:'Shane Baz',t:11},{n:'Brenton Doyle',t:12},
  // Rd18: picks 205-216 (snake)
  {n:'Dylan Beavers',t:12},{n:'Spencer Schwellenbach',t:11},{n:'Addison Barger',t:10},{n:'Grayson Rodriguez',t:9},
  {n:'Ryan Waldschmidt',t:8},{n:'Munetaka Murakami',t:7},{n:'Daylen Lile',t:6},{n:'Braxton Ashcraft',t:5},
  {n:'Cody Ponce',t:4},{n:'Luke Weaver',t:3},{n:'Tanner Bibee',t:2},{n:'Jordan Westburg',t:1},
  // Rd19: picks 217-228
  {n:'Luis Robert',t:1},{n:'Jose Soriano',t:2},{n:'Noelvi Marte',t:3},{n:'Payton Tolle',t:4},
  {n:'Mike Trout',t:5},{n:'Lucas Erceg',t:6},{n:'Tyler Holton',t:7},{n:'Rainiel Rodriguez',t:8},
  {n:'Carlos Rodon',t:9},{n:'Reynaldo Lopez',t:10},{n:'Ezequiel Tovar',t:11},{n:'Michael Burrows',t:12},
  // Rd20: picks 229-240 (snake)
  {n:'Kodai Senga',t:12},{n:'Hunter Greene',t:11},{n:'Wilyer Abreu',t:10},{n:'Lawrence Butler',t:9},
  {n:'Bennett Sousa',t:8},{n:'Alex Vesia',t:7},{n:'Shane Bieber',t:6},{n:'Aaron Nola',t:5},
  {n:'Andrew Vaughn',t:4},{n:'Tony Santillan',t:3},{n:'Jakob Marsee',t:2},{n:'Will Vest',t:1},
  // Rd21: picks 241-252
  {n:'Tanner Scott',t:1},{n:'Matthew Liberatore',t:2},{n:'Ramon Laureano',t:3},{n:'Willy Adames',t:4},
  {n:'Sean Manaea',t:5},{n:'Hunter Gaddis',t:6},{n:'Brandon Nimmo',t:7},{n:'Kyle Manzardo',t:8},
  {n:'Max Muncy',t:9},{n:'David Peterson',t:10},{n:'Joe Musgrove',t:11},{n:'Edwin Uceta',t:12},
  // Rd22: picks 253-264 (snake)
  {n:'Thomas White',t:12},{n:'Cam Smith',t:11},{n:'Casey Mize',t:10},{n:'Clay Holmes',t:9},
  {n:'Merrill Kelly',t:8},{n:'Josuar De Jesus Gonzalez',t:7},{n:'Max Meyer',t:6},{n:'Ceddanne Rafaela',t:5},
  {n:'Zebby Matthews',t:4},{n:'Jonathan Aranda',t:3},{n:'Joey Cantillo',t:2},{n:'Eduardo Quintero',t:1},
  // Rd23: picks 265-276
  {n:'Bryce Rainer',t:1},{n:'Ernie Clement',t:2},{n:'Kirby Yates',t:3},{n:'Carson Whisenhunt',t:4},
  {n:'Matt Strahm',t:5},{n:'Shane Smith',t:6},{n:'Taylor Rogers',t:7},{n:'Bryce Miller',t:8},
  {n:'Gage Jump',t:9},{n:'Ian Happ',t:10},{n:'Louis Varland',t:11},{n:'Clayton Beeter',t:12},
  // Rd24: picks 277-288 (snake)
  {n:'Justin Steele',t:12},{n:'Hunter Barco',t:11},{n:'Jared Jones',t:10},{n:'Eury Perez',t:9},
  {n:'Dustin May',t:8},{n:'Brody Hopkins',t:7},{n:'Mickey Moniak',t:6},{n:'Parker Messick',t:5},
  {n:'Josh Jung',t:4},{n:'Quinn Priester',t:3},{n:'Gabriel Moreno',t:2},{n:'Roki Sasaki',t:1},
  // Rd25: picks 289-300
  {n:'Tyler Soderstrom',t:1},{n:'Jeff McNeil',t:2},{n:'Jordan Beck',t:3},{n:'Brandon Sproat',t:4},
  {n:'Gabe Speier',t:5},{n:'Hunter Harvey',t:6},{n:'Slade Cecconi',t:7},{n:'Colton Cowser',t:8},
  {n:'Reid Detmers',t:9},{n:'Willi Castro',t:10},{n:'Josh H. Smith',t:11},{n:'Moises Ballesteros',t:12},
  // Rd26: picks 301-312 (snake)
  {n:'Ryne Nelson',t:12},{n:'Gregory Soto',t:11},{n:'Braxton Garrett',t:10},{n:'Jack Leiter',t:9},
  {n:'Brad Keller',t:8},{n:'Kyle Harrison',t:7},{n:'Corbin Burnes',t:6},{n:'Ryan O\'Hearn',t:5},
  {n:'Gerrit Cole',t:4},{n:'Jorge Polanco',t:3},{n:'Royce Lewis',t:2},{n:'Logan Henderson',t:1},
  // Rd27: picks 313-324
  {n:'Shawn Armstrong',t:1},{n:'Luis Arraez',t:2},{n:'Cristian Javier',t:3},{n:'Spencer Torkelson',t:4},
  {n:'Yainer Diaz',t:5},{n:'Rhett Lowder',t:6},{n:'Michael Wacha',t:7},{n:'Alec Bohm',t:8},
  {n:'Marcus Semien',t:9},{n:'Jung Hoo Lee',t:10},{n:'Jacob Latz',t:11},{n:'Marcelo Mayer',t:12},
  // Rd28: picks 325-336 (snake)
  {n:'Evan Carter',t:12},{n:'Jack Dreyer',t:11},{n:'Xander Bogaerts',t:10},{n:'Jose Caballero',t:9},
  {n:'Eduardo Rodriguez',t:8},{n:'Orion Kerkering',t:7},{n:'Edwin Arroyo',t:6},{n:'Caleb Durbin',t:5},
  {n:'Javier Assad',t:4},{n:'Brooks Raley',t:3},{n:'Mick Abel',t:2},{n:'Camilo Doval',t:1},
  // Rd29: picks 337-348
  {n:'Colt Keith',t:1},{n:'Heliot Ramos',t:2},{n:'A.J. Ewing',t:3},{n:'Jose Butto',t:4},
  {n:'Otto Lopez',t:5},{n:'Spencer Arrighetti',t:6},{n:'Chris Bassitt',t:7},{n:'Jameson Taillon',t:8},
  {n:'Anthony Volpe',t:9},{n:'Fernando Cruz',t:10},{n:'Cade Cavalli',t:11},{n:'Brett Baty',t:12},
  // Rd30: picks 349-360 (snake)
  {n:'Coby Mayo',t:12},{n:'Landen Roupp',t:11},{n:'Brady Singer',t:10},{n:'Jackson Jobe',t:9},
  {n:'Adolis Garcia',t:8},{n:'Brayan Bello',t:7},{n:'Giancarlo Stanton',t:6},{n:'Nolan Schanuel',t:5},
  {n:'Cade Smith (NYY)',t:4},{n:'TJ Rumfield',t:3},{n:'Graham Ashcraft',t:2},{n:'Hogan Harris',t:1},
  // Rd31: picks 361-372
  {n:'Jasson Dominguez',t:1},{n:'Yusei Kikuchi',t:2},{n:'Alfredo Duno',t:3},{n:'Josue Briceno',t:4},
  {n:'Lars Nootbaar',t:5},{n:'Tyler Stephenson',t:6},{n:'Shane Drohan',t:7},{n:'Dansby Swanson',t:8},
  {n:'Ha-seong Kim',t:9},{n:'Jason Adam',t:10},{n:'Johan Oviedo',t:11},{n:'Elmer Rodriguez-Cruz',t:12},
];
if (!state.drafted) state.drafted = {};
const _norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
// Build keeper→team lookup so LIVE_PICKS doesn't double-roster keepers
const _keeperTeamMap = new Map(); // playerName → teamName they were kept on
for (const [teamName, keepers] of Object.entries(LEAGUE_KEEPERS)) {
  keepers.forEach(k => {
    const f = _plyrI(k.name);
    if (f) _keeperTeamMap.set(f.name, teamName);
  });
}
LIVE_PICKS.forEach(p => {
  const found = _plyrI(p.n);
  const nm = found ? found.name : p.n;
  const isMine = p.t === 2;
  state.drafted[nm] = { time: Date.now(), mine: isMine };
  // If this player is a keeper, they're already on the correct team from state.js
  // initialization. Skip adding them again to avoid double-rostering.
  if (_keeperTeamMap.has(nm)) return;
  if (isMine && !state.myTeam.includes(nm)) state.myTeam.push(nm);
  // Assign to team roster for LCV calculations
  const teamName = _TEAM_MAP[p.t];
  if (teamName && !isMine) {
    if (!state.leagueTeams[teamName]) state.leagueTeams[teamName] = [];
    if (!state.leagueTeams[teamName].includes(nm)) state.leagueTeams[teamName].push(nm);
  }
});
// Collect all keeper names to skip in live pick grid
const _allKeeperNames = new Set();
(state.keepers || []).forEach(k => _allKeeperNames.add(k));
Object.values(state.leagueTeams || {}).forEach(arr => (arr||[]).forEach(k => {
  if (state.keeperRounds && state.keeperRounds[k]) _allKeeperNames.add(k);
}));
for (const keepers of Object.values(LEAGUE_KEEPERS)) {
  keepers.forEach(k => _allKeeperNames.add(k.name));
}
const LIVE_PICK_ORDER = {};
LIVE_PICKS.forEach((p, i) => {
  const found = _plyrI(p.n);
  const nm = found ? found.name : p.n;
  // Skip keepers — they're already shown by the keeperGrid
  if (_allKeeperNames.has(nm) || _allKeeperNames.has(p.n)) return;
  LIVE_PICK_ORDER[i + 1] = { name: nm, mine: p.t === 2 };
});
// Mark all league keepers (including MiLB) as drafted
for (const keepers of Object.values(LEAGUE_KEEPERS)) {
  keepers.forEach(k => {
    const found = _plyrI(k.name);
    const nm = found ? found.name : k.name;
    if (!state.drafted[nm]) state.drafted[nm] = { time: Date.now(), mine: false };
  });
}
for (const [teamName, rookies] of Object.entries(LEAGUE_MILB_KEEPERS)) {
  rookies.forEach(rk => {
    const found = _plyrI(rk);
    const nm = found ? found.name : rk;
    if (!state.drafted[nm]) state.drafted[nm] = { time: Date.now(), mine: false };
  });
}
save();

// ── Apply CBS Transactions AFTER LIVE_PICKS ──────────────────────────────
// LIVE_PICKS above unconditionally re-adds all drafted players to rosters.
// We must apply CBS transactions (trades, adds, drops) AFTER that so trades
// properly remove players from their original teams.
// CRITICAL: Only apply POST-DRAFT transactions. Pre-draft roster moves (drops
// before the draft) are already reflected in LIVE_PICKS. Applying them after
// would incorrectly remove drafted players from rosters.
const DRAFT_DATE = parseCbsDate('3/15/26 12:00 PM ET');

if (CBS_TRANSACTIONS.length > 0) {
  const sorted = [...CBS_TRANSACTIONS].sort((a,b) => parseCbsDate(a.date) - parseCbsDate(b.date));
  const postDraft = sorted.filter(txn => parseCbsDate(txn.date) > DRAFT_DATE);
  const preDraft = sorted.filter(txn => parseCbsDate(txn.date) <= DRAFT_DATE);
  if (preDraft.length > 0) console.log(`Skipping ${preDraft.length} pre-draft CBS transaction(s)`);

  postDraft.forEach(txn => {
    const teamName = resolveCbsTeam(txn);
    txn.players.forEach(p => {
      const found = _plyrI(p.name);
      // Cross-check MLB team to avoid name collisions (e.g. Cade Smith CLE vs
      // a fringe Cade Smith NYY who never makes our pool). Two cases trigger:
      //   1) Pool has MULTIPLE players with this name and the txn's mlbTeam
      //      doesn't match our pool's team for `found`. → genuine collision.
      //      Skip — without the team disambiguator we'd guess wrong.
      //   2) Pool has ONE player and the txn's mlbTeam doesn't match. Could be
      //      either: (a) a real-life mid-season trade (Snell SF→LAD, etc.) —
      //      our pool's team is stale and we must apply the txn, OR (b) the
      //      txn references a DIFFERENT player not in our pool (fringe MLB
      //      callup with the same name). Discriminator: for a real-life
      //      trade, the player should currently be on the txn's team's roster;
      //      for a different-player collision, they won't be. Skip drops where
      //      the player isn't on the dropping team — that's the case where
      //      blindly applying would corrupt our state.drafted map and surface
      //      the player as available when they're actually rostered.
      const _cbsToFg = {KC:'KCR',SF:'SFG',TB:'TBR',WAS:'WSN',AZ:'ARI',CWS:'CHW',SD:'SDP'};
      const _normTeam = t => _cbsToFg[t] || t;
      if (found && p.mlbTeam && found.team && _normTeam(found.team) !== _normTeam(p.mlbTeam)) {
        const _lcName = p.name.toLowerCase();
        const _sameNameCount = ALL.filter(pl => pl.name.toLowerCase() === _lcName).length;
        if (_sameNameCount > 1) {
          console.log(`Skipping transaction for ${p.name} (${p.mlbTeam}) — genuine name collision with ${found.team} player`);
          return;
        }
        // ONE player in pool, mlbTeam mismatch. If this is a Drop and the
        // player isn't on the dropping team's current roster, the txn is
        // about a different (out-of-pool) player. Skip rather than corrupt
        // state.drafted.
        const _txnTeamForCollisionCheck = (typeof resolveCbsTeam === 'function') ? resolveCbsTeam(txn) : (txn.teamName || txn.team || '');
        const _onDroppingTeam = (() => {
          const myT = LEAGUE_TEAMS.find(t => t.mine);
          if (myT && myT.name === _txnTeamForCollisionCheck) return (state.myTeam || []).includes(found.name);
          const r = state.leagueTeams[_txnTeamForCollisionCheck];
          return Array.isArray(r) && r.includes(found.name);
        })();
        if ((p.action || '') === 'Dropped' && !_onDroppingTeam) {
          console.log(`Skipping Drop for ${p.name} (txn mlbTeam=${p.mlbTeam}, pool=${found.team}) — not on ${_txnTeamForCollisionCheck}'s roster, so the txn is about a different out-of-pool player.`);
          return;
        }
        // else: single player, real-life trade — fall through and apply
      }
      const playerName = found ? found.name : p.name;
      const action = p.action || '';

      if (action === 'Added' || action === 'Added off Waivers') {
        // Remove from any existing team first (waiver claims move a player)
        removeFromAllRosters(playerName);
        addToRoster(playerName, teamName);
      } else if (action === 'Dropped') {
        removeFromRoster(playerName, teamName);
        delete state.drafted[playerName];
      } else if (action.startsWith('Traded from')) {
        // Use removeFromAllRosters to ensure player is fully removed from
        // all teams (handles edge cases with renamed teams, mine vs leagueTeams, etc.)
        removeFromAllRosters(playerName);
        addToRoster(playerName, teamName);
      } else if (action === 'Activated' || action === 'Moved to IR') {
        // Activated: coming off IL → still on this team's roster.
        // Moved to IR: going to IL → still on this team's roster (NOT a drop).
        // Either way, the player belongs to this team — reconcile in case we
        // missed their original add/drop because of CBS's ~30-row cap.
        removeFromAllRosters(playerName);
        addToRoster(playerName, teamName);
      }
    });
  });

  // Rebuild transaction log from CBS data (post-draft only).
  // Defensive dedup: collapse byte-identical duplicates AND same-player-on-
  // same-date-and-team duplicates that slip through the scraper-side cleaner.
  state.transactions = [];
  const _txnSeen = new Set();
  postDraft.forEach(txn => {
    const teamName = resolveCbsTeam(txn);
    txn.players.forEach(p => {
      // Skip name-collision transactions (same logic as roster processing above):
      // only skip when the pool has MULTIPLE players with this name.
      const _txFound = _plyrI(p.name);
      const _cbsToFg2 = {KC:'KCR',SF:'SFG',TB:'TBR',WAS:'WSN',AZ:'ARI',CWS:'CHW',SD:'SDP'};
      const _normTeam2 = t => _cbsToFg2[t] || t;
      if (_txFound && p.mlbTeam && _txFound.team && _normTeam2(_txFound.team) !== _normTeam2(p.mlbTeam)) {
        const _lcName2 = p.name.toLowerCase();
        if (ALL.filter(pl => pl.name.toLowerCase() === _lcName2).length > 1) return;
        // Same out-of-pool collision discriminator as the roster pass — skip
        // Drops where the player isn't on the dropping team's current roster.
        const _txnTeamForFeed = (typeof resolveCbsTeam === 'function') ? resolveCbsTeam(txn) : (txn.teamName || txn.team || '');
        const _onDroppingTeamFeed = (() => {
          const myT = LEAGUE_TEAMS.find(t => t.mine);
          if (myT && myT.name === _txnTeamForFeed) return (state.myTeam || []).includes(_txFound.name);
          const r = state.leagueTeams[_txnTeamForFeed];
          return Array.isArray(r) && r.includes(_txFound.name);
        })();
        if ((p.action || '') === 'Dropped' && !_onDroppingTeamFeed) return;
      }
      const action = p.action || '';
      let txType = 'add';
      if (action === 'Dropped') txType = 'drop';
      else if (action.startsWith('Traded from')) txType = 'trade';
      else if (action === 'Activated') txType = 'activate';
      else if (action === 'Moved to IR') txType = 'ir';
      const dateKey = (txn.date || '').split(' ')[0];
      // Normalize the "from" key too — mojibake copies of the same team name
      // would otherwise evade dedup.
      const fromKey = (teamName || '').replace(/\u2019/g, "'").toLowerCase().trim();
      const sig = [txType, p.name.toLowerCase(), dateKey, fromKey, (p.mlbTeam || '').toUpperCase()].join('|');
      if (_txnSeen.has(sig)) return;
      _txnSeen.add(sig);
      state.transactions.push({ type: txType, player: p.name, date: dateKey, from: teamName, cbsAction: action, source: 'CBS', mlbTeam: p.mlbTeam || '' });
    });
  });

  // ── Reconcile against CBS rosters (ground truth) ────────────────────
  // After all txns apply, force state.myTeam / state.leagueTeams to match
  // LEAGUE_ROSTERS exactly. CBS rosters are the authoritative current state;
  // any txn parsing bug (empty actions, name collisions, weird timestamps,
  // mojibake team names, etc.) gets corrected here. Without this pass, e.g.
  // Mick Abel's empty-action 4/10 'add' txn never re-rostered him, so the
  // dashboard kept showing him as available. Belt-and-suspenders.
  if (typeof LEAGUE_ROSTERS === 'object' && LEAGUE_ROSTERS && Object.keys(LEAGUE_ROSTERS).length > 0) {
    const _rosterTeamMap = {}; // canonical playerName → teamName per CBS
    // IMPORTANT: normalize CBS roster names through _plyrI so aliases (Louie↔Louis,
    // Jake↔Jakob, Cam↔Cameron, etc.) map to the canonical pool name used in state.
    // Otherwise exact-string compare below won't find the player on their team,
    // the reconciler will dupe-add them under the alias, then drop the canonical
    // name — surfacing the player as "available" even though CBS has them rostered.
    for (const [teamName, plyrs] of Object.entries(LEAGUE_ROSTERS)) {
      (plyrs || []).forEach(n => {
        const f = _plyrI(n);
        const canon = f ? f.name : n;
        _rosterTeamMap[canon] = teamName;
      });
    }
    let _added = 0, _moved = 0;
    for (const [playerName, cbsTeamName] of Object.entries(_rosterTeamMap)) {
      // Resolve CBS team name → league team name (handles renames like
      // "Whoop Whoop..." → "Everythings McGonigle Green").
      const resolvedTeam = (typeof CBS_NAME_TO_LEAGUE !== 'undefined' && CBS_NAME_TO_LEAGUE[cbsTeamName])
        ? CBS_NAME_TO_LEAGUE[cbsTeamName] : cbsTeamName;
      const myT = LEAGUE_TEAMS.find(t => t.mine);
      const isMineTeam = !!(myT && myT.name === resolvedTeam);

      // Where does state currently think this player is?
      let currentTeam = null;
      if ((state.myTeam || []).includes(playerName)) currentTeam = myT ? myT.name : null;
      else {
        for (const t of Object.keys(state.leagueTeams || {})) {
          if (state.leagueTeams[t].includes(playerName)) { currentTeam = t; break; }
        }
      }
      if (currentTeam === resolvedTeam) continue;  // already correct

      removeFromAllRosters(playerName);
      addToRoster(playerName, resolvedTeam);
      // Make sure state.drafted reflects mine-status correctly so UI doesn't
      // show traded-in / waivered players as "available".
      if (!state.drafted) state.drafted = {};
      state.drafted[playerName] = { time: Date.now(), mine: isMineTeam };
      if (currentTeam) _moved++; else _added++;
    }
    // Conversely: any player in state but NOT in any CBS roster should be
    // dropped (they're free agents per CBS).
    let _dropped = 0;
    const _allCbs = new Set(Object.keys(_rosterTeamMap));
    const allInState = new Set([...(state.myTeam || [])]);
    for (const t of Object.values(state.leagueTeams || {})) for (const n of t) allInState.add(n);
    for (const n of allInState) {
      if (!_allCbs.has(n)) {
        removeFromAllRosters(n);
        if (state.drafted && state.drafted[n]) delete state.drafted[n];
        _dropped++;
      }
    }
    console.log(`Reconciled rosters vs CBS: ${_added} added, ${_moved} moved, ${_dropped} dropped`);
  }

  save();
  console.log(`Applied ${postDraft.length} post-draft CBS transaction(s)`);
}

// ── Sleepers & Busts buzz from expert articles ───────────────────────────
const BUZZ = {
  // ── SLEEPERS (up arrows) ──────────────────────────────────────────────
  'Brandon Lowe':       [{type:'up', src:'CBS', url:'https://www.cbssports.com/fantasy/baseball/news/2026-fantasy-baseball-draft-prep-sleepers-2-0-for-scott-white/'}],
  'Jonathan Aranda':    [{type:'up', src:'CBS', url:'https://www.cbssports.com/fantasy/baseball/news/2026-fantasy-baseball-rankings-sleepers-busts-breakouts-from-model-that-nailed-cal-raleighs-massive-season/'}],
  'Emmet Sheehan':      [{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}],
  'Jackson Holliday':   [{type:'up', src:'FPros', url:'https://www.fantasypros.com/2026/03/14-consensus-sleepers-busts-2026-fantasy-baseball/'}],
  'Sal Stewart':        [{type:'up', src:'CBS', url:'https://www.cbssports.com/fantasy/baseball/news/2026-fantasy-baseball-draft-prep-sleepers-1-0-for-scott-white-featuring-sal-stewart-and-kazuma-okamoto/'}],
  'Jordan Lawlar':      [{type:'up', src:'SI', url:'https://www.si.com/onsi/fantasy/mlb/2026-fantasy-baseball-30-mlb-teams-30-sleepers-featuring-jordan-lawlar'}, {type:'up', src:'TJStats', url:'https://newsletter.tjstats.ca/p/a-breakout-pick-for-each-mlb-team-b01'}],
  'Jac Caglianone':     [{type:'up', src:'CBS', url:'https://www.cbssports.com/fantasy/baseball/news/2026-fantasy-baseball-draft-prep-sleepers-2-0-for-scott-white/'}, {type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}, {type:'up', src:'ESPN', url:'https://www.espn.com/mlb/story/_/id/48154579/mlb-2026-breakout-stars-every-team-mcgonigle-caglianone-oviedo-weathers'}],
  'Bryce Eldridge':     [{type:'up', src:'CBS', url:'https://www.cbssports.com/fantasy/baseball/news/2026-fantasy-baseball-draft-prep-sleepers-2-0-for-scott-white/'}],
  'Ceddanne Rafaela':   [{type:'up', src:'FPros', url:'https://www.fantasypros.com/2026/03/14-consensus-sleepers-busts-2026-fantasy-baseball/'}],
  'Logan Henderson':    [{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}],
  'Luke Keaschall':     [{type:'up', src:'Yahoo', url:'https://sports.yahoo.com/fantasy/article/2026-fantasy-baseball-adp-risers-3-key-players-moving-the-needle-through-spring-training-174823504.html'}],
  'Daylen Lile':        [{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}, {type:'up', src:'TJStats', url:'https://newsletter.tjstats.ca/p/a-breakout-pick-for-each-mlb-team-b01'}],
  'Jasson Dominguez':   [{type:'up', src:'SI', url:'https://www.si.com/onsi/fantasy/mlb/2026-fantasy-baseball-30-mlb-teams-30-sleepers-featuring-jordan-lawlar'}, {type:'up', src:'TJStats', url:'https://newsletter.tjstats.ca/p/a-breakout-pick-for-each-mlb-team-b01'}],
  'Jacob Wilson':       [{type:'up', src:'CBS', url:'https://www.cbssports.com/fantasy/baseball/news/fantasy-baseball-rankings-2026-breakouts-from-model-that-called-jacob-wilsons-strong-season/'}],
  // Athletic — Bat Speed Breakout Hitters (Eno Sarris)
  'Garrett Mitchell':   [{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}, {type:'up', src:'TJStats', url:'https://newsletter.tjstats.ca/p/a-breakout-pick-for-each-mlb-team-b01'}],
  'Owen Caissie':       [{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}],
  'Jordan Walker':      [{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}, {type:'up', src:'TJStats', url:'https://newsletter.tjstats.ca/p/a-breakout-pick-for-each-mlb-team-b01'}],
  'James Outman':       [{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}],
  'Caleb Durbin':       [{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}],
  // Athletic — Pitcher Breakouts (Eno Sarris)
  'Eury Pérez':         [{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}],
  'Bubba Chandler':     [{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}, {type:'up', src:'SI', url:'https://www.si.com/onsi/fantasy/mlb/2026-fantasy-baseball-30-mlb-teams-30-sleepers-featuring-jordan-lawlar'}],
  'Shane Baz':          [{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}],
  'Joey Cantillo':      [{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}, {type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}, {type:'up', src:'FPros', url:'https://www.fantasypros.com/2026/03/14-consensus-sleepers-busts-2026-fantasy-baseball/'}, {type:'up', src:'Eno', url:'https://theathletic.com/fantasy/baseball/'}, {type:'up', src:'TJStats', url:'https://newsletter.tjstats.ca/p/a-breakout-pick-for-each-mlb-team-b01'}],
  'Cade Cavalli':       [{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}, {type:'up', src:'TJStats', url:'https://newsletter.tjstats.ca/p/a-breakout-pick-for-each-mlb-team-b01'}],
  'Zebby Matthews':     [{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}, {type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}, {type:'down', src:'Eno', url:'https://theathletic.com/fantasy/baseball/'}, {type:'up', src:'TJStats', url:'https://newsletter.tjstats.ca/p/a-breakout-pick-for-each-mlb-team-b01'}],
  'Troy Melton':        [{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}],
  // Athletic — Bounce-Back Candidates (Al Melchior)
  'Marcus Semien':      [{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}],
  'Gleyber Torres':     [{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}],
  'Bryan Reynolds':     [{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}],
  'Yainer Diaz':        [{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}],
  'Aaron Nola':         [{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}],
  'Sandy Alcantara':    [{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}, {type:'down', src:'Eno', url:'https://theathletic.com/fantasy/baseball/'}],
  'Dylan Cease':        [{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}],
  // FantasyPros / CBS Stampfl / ESPN / SI — additional sleepers
  'JJ Wetherholt':      [{type:'up', src:'FPros', url:'https://www.fantasypros.com/2026/03/14-consensus-sleepers-busts-2026-fantasy-baseball/'}],
  'Masyn Winn':         [{type:'up', src:'FPros', url:'https://www.fantasypros.com/2026/03/14-consensus-sleepers-busts-2026-fantasy-baseball/'}],
  'Andrew Vaughn':      [{type:'up', src:'CBS', url:'https://www.cbssports.com/fantasy/baseball/news/2026-fantasy-baseball-draft-prep-target-trevor-rogers-andrew-vaughn-in-frank-stampfls-sleepers-2-0/'}],
  'Trevor Rogers':      [{type:'up', src:'CBS', url:'https://www.cbssports.com/fantasy/baseball/news/2026-fantasy-baseball-draft-prep-target-trevor-rogers-andrew-vaughn-in-frank-stampfls-sleepers-2-0/'}],
  'Jackson Chourio':    [{type:'up', src:'ESPN', url:'https://www.espn.com/mlb/story/_/id/48154579/mlb-2026-breakout-stars-every-team-mcgonigle-caglianone-oviedo-weathers'}],
  'Samuel Basallo':     [{type:'up', src:'SI', url:'https://www.si.com/onsi/fantasy/mlb/2026-fantasy-baseball-30-mlb-teams-30-sleepers-featuring-jordan-lawlar'}],
  'Johan Oviedo':       [{type:'up', src:'ESPN', url:'https://www.espn.com/mlb/story/_/id/48154579/mlb-2026-breakout-stars-every-team-mcgonigle-caglianone-oviedo-weathers'}, {type:'up', src:'TJStats', url:'https://newsletter.tjstats.ca/p/a-breakout-pick-for-each-mlb-team-b01'}],
  // Athletic — SP Sleepers (staff picks)
  'Braxton Ashcraft':   [{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}, {type:'up', src:'TJStats', url:'https://newsletter.tjstats.ca/p/a-breakout-pick-for-each-mlb-team-b01'}],
  'Max Meyer':          [{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}],
  'Ryan Weathers':      [{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}, {type:'up', src:'TJStats', url:'https://newsletter.tjstats.ca/p/a-breakout-pick-for-each-mlb-team-b01'}],
  'Sean Manaea':        [{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}, {type:'up', src:'Eno', url:'https://theathletic.com/fantasy/baseball/'}],
  'Cody Ponce':         [{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}, {type:'up', src:'TJStats', url:'https://newsletter.tjstats.ca/p/a-breakout-pick-for-each-mlb-team-b01'}],
  'Quinn Priester':     [{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}],
  'Grayson Rodriguez':  [{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}],
  // Athletic — OF Sleepers (Jake Ciely + staff)
  'Wilyer Abreu':       [{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}],
  'Cam Smith':          [{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}, {type:'up', src:'TJStats', url:'https://newsletter.tjstats.ca/p/a-breakout-pick-for-each-mlb-team-b01'}],
  'Adolis Garcia':      [{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}],
  'Heliot Ramos':       [{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}],
  'Jakob Marsee':       [{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}],
  'Trent Grisham':      [{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}],
  // Athletic — RP Sleepers (Greg Jewett)
  'Zach Agnos':         [{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}],
  'Matt Svanson':       [{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}],
  'Tyler Wells':        [{type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}],

  // ── TJStats — Breakout Pick for Each MLB Team (Thomas Nestico) ──────
  'Reid Detmers':       [{type:'up', src:'TJStats', url:'https://newsletter.tjstats.ca/p/a-breakout-pick-for-each-mlb-team-b01'}],
  'Miguel Vargas':      [{type:'up', src:'TJStats', url:'https://newsletter.tjstats.ca/p/a-breakout-pick-for-each-mlb-team-b01'}],
  'Noelvi Marte':       [{type:'up', src:'TJStats', url:'https://newsletter.tjstats.ca/p/a-breakout-pick-for-each-mlb-team-b01'}],
  'Nolan Schanuel':     [{type:'up', src:'TJStats', url:'https://newsletter.tjstats.ca/p/a-breakout-pick-for-each-mlb-team-b01'}],
  'Evan Carter':        [{type:'up', src:'TJStats', url:'https://newsletter.tjstats.ca/p/a-breakout-pick-for-each-mlb-team-b01'}],
  'Coby Mayo':          [{type:'up', src:'TJStats', url:'https://newsletter.tjstats.ca/p/a-breakout-pick-for-each-mlb-team-b01'}],
  'Marcelo Mayer':      [{type:'up', src:'TJStats', url:'https://newsletter.tjstats.ca/p/a-breakout-pick-for-each-mlb-team-b01'}],
  'Kyle Manzardo':      [{type:'up', src:'TJStats', url:'https://newsletter.tjstats.ca/p/a-breakout-pick-for-each-mlb-team-b01'}],
  'Dominic Canzone':    [{type:'up', src:'TJStats', url:'https://newsletter.tjstats.ca/p/a-breakout-pick-for-each-mlb-team-b01'}],
  'Kazuma Okamoto':     [{type:'up', src:'TJStats', url:'https://newsletter.tjstats.ca/p/a-breakout-pick-for-each-mlb-team-b01'}],
  'Jacob Melton':       [{type:'up', src:'TJStats', url:'https://newsletter.tjstats.ca/p/a-breakout-pick-for-each-mlb-team-b01'}],
  'Griffin Conine':     [{type:'up', src:'TJStats', url:'https://newsletter.tjstats.ca/p/a-breakout-pick-for-each-mlb-team-b01'}],

  // ── Eno Sarris Stuff+ model refresh — gains (sleepers) ──────────────
  'Chris Sale':           [{type:'up', src:'Eno', url:'https://theathletic.com/fantasy/baseball/'}],
  'José Soriano':         [{type:'up', src:'Eno', url:'https://theathletic.com/fantasy/baseball/'}],
  'Logan Gilbert':        [{type:'up', src:'Eno', url:'https://theathletic.com/fantasy/baseball/'}],
  'Tarik Skubal':         [{type:'up', src:'Eno', url:'https://theathletic.com/fantasy/baseball/'}],
  'Blake Snell':          [{type:'up', src:'Eno', url:'https://theathletic.com/fantasy/baseball/'}],
  'Matthew Boyd':         [{type:'up', src:'Eno', url:'https://theathletic.com/fantasy/baseball/'}],
  'Jacob Lopez':          [{type:'up', src:'Eno', url:'https://theathletic.com/fantasy/baseball/'}],
  // ── Eno Sarris Stuff+ model refresh — drops (busts) ───────────────
  'Aaron Civale':         [{type:'down', src:'Eno', url:'https://theathletic.com/fantasy/baseball/'}],
  'Luis Severino':        [{type:'down', src:'Eno', url:'https://theathletic.com/fantasy/baseball/'}],
  'Frankie Montas':       [{type:'down', src:'Eno', url:'https://theathletic.com/fantasy/baseball/'}],
  'Lance McCullers Jr.':  [{type:'down', src:'Eno', url:'https://theathletic.com/fantasy/baseball/'}],
  'Tomoyuki Sugano':      [{type:'down', src:'Eno', url:'https://theathletic.com/fantasy/baseball/'}],
  'Clay Holmes':          [{type:'down', src:'Eno', url:'https://theathletic.com/fantasy/baseball/'}],
  'Drew Rasmussen':       [{type:'down', src:'Eno', url:'https://theathletic.com/fantasy/baseball/'}],
  // ── BUSTS (down arrows) ───────────────────────────────────────────────
  'Mookie Betts':       [{type:'down', src:'CBS', url:'https://www.cbssports.com/fantasy/baseball/news/fantasy-baseball-rankings-2026-busts-by-proven-mlb-model-that-called-spencer-striders-disappointing-year/'}, {type:'down', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}],
  'Pete Alonso':        [{type:'down', src:'CBS', url:'https://www.cbssports.com/fantasy/baseball/news/fantasy-baseball-rankings-2026-busts-by-proven-mlb-model-that-called-spencer-striders-disappointing-year/'}],
  'Luis Robert Jr.':    [{type:'down', src:'FPros', url:'https://www.fantasypros.com/2026/03/14-consensus-sleepers-busts-2026-fantasy-baseball/'}],
  'Spencer Strider':    [{type:'down', src:'CBS', url:'https://www.cbssports.com/fantasy/baseball/news/2026-fantasy-baseball-draft-prep-busts-2-0-for-scott-white-adds-james-wood-spencer-strider-to-the-mix/'}],
  'Alex Bregman':       [{type:'down', src:'CBS', url:'https://www.cbssports.com/fantasy/baseball/news/2026-fantasy-baseball-draft-prep-busts-2-0-for-scott-white-adds-james-wood-spencer-strider-to-the-mix/'}],
  'Jarren Duran':       [{type:'down', src:'CBS', url:'https://www.cbssports.com/fantasy/baseball/news/2026-fantasy-baseball-draft-prep-fade-nick-kurtz-jarren-duran-in-frank-stampfls-busts-2-0/'}],
  'Sonny Gray':         [{type:'down', src:'CBS', url:'https://www.cbssports.com/fantasy/baseball/news/2026-fantasy-baseball-draft-prep-fade-nick-kurtz-jarren-duran-in-frank-stampfls-busts-2-0/'}, {type:'up', src:'Eno', url:'https://theathletic.com/fantasy/baseball/'}],
  'Bryce Harper':       [{type:'down', src:'Yahoo', url:'https://sports.yahoo.com/articles/top-5-fantasy-baseball-first-204652569.html'}],
  'Josh Naylor':        [{type:'down', src:'Yahoo', url:'https://sports.yahoo.com/articles/top-5-fantasy-baseball-first-204652569.html'}],
  'Francisco Lindor':   [{type:'down', src:'Yahoo', url:'https://sports.yahoo.com/articles/top-5-fantasy-baseball-shortstop-044912384.html'}],
  'Trea Turner':        [{type:'down', src:'Yahoo', url:'https://sports.yahoo.com/articles/top-5-fantasy-baseball-shortstop-044912384.html'}],
  'Teoscar Hernandez':  [{type:'down', src:'Yahoo', url:'https://sports.yahoo.com/articles/top-5-fantasy-baseball-outfielder-182716680.html'}],
  'Christian Yelich':   [{type:'down', src:'Yahoo', url:'https://sports.yahoo.com/articles/top-5-fantasy-baseball-outfielder-182716680.html'}],
  'Mark Vientos':       [{type:'down', src:'Yahoo', url:'https://sports.yahoo.com/articles/top-5-fantasy-baseball-third-161534983.html'}],
  'Alec Bohm':          [{type:'down', src:'Yahoo', url:'https://sports.yahoo.com/articles/top-5-fantasy-baseball-third-161534983.html'}],
  'Royce Lewis':        [{type:'down', src:'Yahoo', url:'https://sports.yahoo.com/articles/top-5-fantasy-baseball-third-161534983.html'}],
  'Cole Ragans':        [{type:'down', src:'Yahoo', url:'https://sports.yahoo.com/articles/top-5-fantasy-baseball-starting-175712493.html'}, {type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}],
  'Nick Kurtz':         [{type:'down', src:'CBS', url:'https://www.cbssports.com/fantasy/baseball/news/2026-fantasy-baseball-draft-prep-fade-nick-kurtz-jarren-duran-in-frank-stampfls-busts-2-0/'}],
  'James Wood':         [{type:'down', src:'CBS', url:'https://www.cbssports.com/fantasy/baseball/news/2026-fantasy-baseball-draft-prep-busts-2-0-for-scott-white-adds-james-wood-spencer-strider-to-the-mix/'}, {type:'up', src:'Athletic', url:'https://theathletic.com/fantasy/baseball/'}],
  'Jose Altuve':        [{type:'down', src:'FPros', url:'https://www.fantasypros.com/2026/03/14-consensus-sleepers-busts-2026-fantasy-baseball/'}],
  'Oneil Cruz':         [{type:'down', src:'FPros', url:'https://www.fantasypros.com/2026/03/14-consensus-sleepers-busts-2026-fantasy-baseball/'}]
};

// Auto-tag from BUZZ: sleeper (up) / bust (down) — only if user hasn't manually tagged
for (const [name, items] of Object.entries(BUZZ)) {
  if (state.tags[name]) continue; // user already tagged — respect their choice
  const hasUp = items.some(b => b.type === 'up');
  const hasDown = items.some(b => b.type === 'down');
  // If has both up and down, don't auto-tag (conflicting signals)
  if (hasUp && !hasDown) state.tags[name] = 'sleeper';
  else if (hasDown && !hasUp) state.tags[name] = 'bust';
}

// Auto-tag major injuries as IL — only if user hasn't manually tagged
const IL_PLAYERS = [
  'Anthony Santander', 'Francisco Lindor', 'Anthony Volpe', 'Jordan Westburg',
  'Hunter Greene', 'Spencer Schwellenbach', 'Gerrit Cole', 'Joe Musgrove',
  'Jared Jones', 'Josh Hader', 'Justin Steele', 'Carlos Rodón',
  'Bryce Miller', 'Bryan Hoeing', 'Corbin Burnes', 'Bowden Francis',
  'Clarke Schmidt', 'Shane Bieber'
];
IL_PLAYERS.forEach(name => {
  if (!state.tags[name]) state.tags[name] = 'injured';
});


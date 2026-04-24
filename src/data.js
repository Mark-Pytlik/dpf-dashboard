// ── Password Authentication ────────────────────────────────────────────────
const PASSWORD_HASH = '2b7051fbf461c99ef6ddd81b4dfd12f59555da74d37ba9d4221421fb67026a1e';

async function hashPassword(pwd) {
  const encoder = new TextEncoder();
  const data = encoder.encode(pwd);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function checkAuth() {
  const mc = document.getElementById('mainContent');
  const authTs = localStorage.getItem('dpf_auth_ts');
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  if (authTs && (Date.now() - parseInt(authTs, 10)) < thirtyDays) {
    document.getElementById('authGate').classList.add('hidden');
    if (mc) mc.style.display = '';
    return true;
  }
  localStorage.removeItem('dpf_auth_ts');
  document.getElementById('authGate').classList.remove('hidden');
  if (mc) mc.style.display = 'none';
  return false;
}

async function submitPassword() {
  const input = document.getElementById('authInput');
  const pwd = input.value.trim();
  if (!pwd) {
    document.getElementById('authError').textContent = 'Enter a password';
    return;
  }
  const hash = await hashPassword(pwd);
  if (hash === PASSWORD_HASH) {
    localStorage.setItem('dpf_auth_ts', Date.now().toString());
    document.getElementById('authError').textContent = '';
    input.value = '';
    checkAuth();
    if (typeof render === 'function') render();
  } else {
    document.getElementById('authError').textContent = 'Incorrect password';
  }
}

document.getElementById('authBtn').addEventListener('click', submitPassword);
document.getElementById('authInput').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') submitPassword();
});

checkAuth();

// ── Data ──────────────────────────────────────────────────────────────────
const BATTERS = __BAT_JSON__;
const PITCHERS = __PIT_JSON__;
const ALL = [...BATTERS, ...PITCHERS];
ALL.forEach((p,i) => p._id = i);
// O(1) player lookups by name (exact, case-insensitive, and accent-stripped)
const PLAYER_MAP = new Map(ALL.map(p => [p.name, p]));
const PLAYER_MAP_LC = new Map(ALL.map(p => [p.name.toLowerCase(), p]));
const _stripAccents = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const PLAYER_MAP_NORM = new Map(ALL.map(p => [_stripAccents(p.name).toLowerCase(), p]));
// Aggressive normalization: strip accents, lowercase, remove punctuation
// (spaces, periods, apostrophes, hyphens), drop generational suffixes
// (Jr/Sr/II/III/IV). This lets us match common CBS↔pool drift:
//   • "Bobby Witt" ↔ "Bobby Witt Jr."
//   • "C.J. Abrams" ↔ "CJ Abrams"
//   • "Mark Leiter" ↔ "Mark Leiter Jr."
//   • "Jose Ramirez" ↔ "José Ramírez" (accent)
const _normAggressive = s => _stripAccents(s).toLowerCase()
  .replace(/[\.\s'`\-]+/g, '')
  .replace(/(jr|sr|iii|iv|ii)$/g, '');
const PLAYER_MAP_AGGRESSIVE = new Map(ALL.map(p => [_normAggressive(p.name), p]));
// Name aliases: alternative names → canonical name in player pool. Use for
// nickname variants that normalization can't catch (Mike↔Michael, Louie↔Louis,
// Alex↔Alexander, etc.) and for anything else that needs to collapse.
const NAME_ALIASES = {
  'Cameron Schlittler': 'Cam Schlittler',
  'Luis Robert': 'Luis Robert Jr.',
  'Jazz Chisholm': 'Jazz Chisholm Jr.',
  // Nickname variants (CBS uses casual form; pool uses formal)
  'Mike Soroka': 'Michael Soroka',
  'Louie Varland': 'Louis Varland',
  'Jake Junis': 'Jakob Junis',
};
// Register aliases in all maps
Object.entries(NAME_ALIASES).forEach(([alias, canonical]) => {
  const p = PLAYER_MAP.get(canonical) || PLAYER_MAP_LC.get(canonical.toLowerCase())
    || PLAYER_MAP_NORM.get(_stripAccents(canonical).toLowerCase())
    || PLAYER_MAP_AGGRESSIVE.get(_normAggressive(canonical));
  if (p) {
    PLAYER_MAP.set(alias, p);
    PLAYER_MAP_LC.set(alias.toLowerCase(), p);
    PLAYER_MAP_NORM.set(_stripAccents(alias).toLowerCase(), p);
    PLAYER_MAP_AGGRESSIVE.set(_normAggressive(alias), p);
  }
});
function _plyr(name) { return PLAYER_MAP.get(name); }
function _plyrI(name) {
  if (!name) return undefined;
  return PLAYER_MAP.get(name)
    || PLAYER_MAP_LC.get(name.toLowerCase())
    || PLAYER_MAP_NORM.get(_stripAccents(name).toLowerCase())
    || PLAYER_MAP_AGGRESSIVE.get(_normAggressive(name));
}

// ── Performance cache for hot-path lookups ────────────────────────────────
const _keeperCache = new Map();
const _plyrICache = new Map();
function _plyrICached(name) {
  if (!name) return undefined;
  if (_plyrICache.has(name)) return _plyrICache.get(name);
  const r = _plyrI(name);
  _plyrICache.set(name, r);
  return r;
}
function getKeeperInfoCached(name) {
  if (_keeperCache.has(name)) return _keeperCache.get(name);
  const r = getKeeperInfo(name);
  _keeperCache.set(name, r);
  return r;
}
function invalidateCaches() { _keeperCache.clear(); _plyrICache.clear(); }

// ── CBS League Transactions (scraped daily) ─────────────────────────────
const CBS_TRANSACTIONS = __CBS_TXNS_JSON__;
const TXN_BUILD_TIME = '__BUILD_TIME__';
const PLAYER_NEWS = __PLAYER_NEWS_JSON__;
const INJURIES = __INJURIES_JSON__;
// Build injury lookup: name -> { status, injury, return }
// Handle both flat array format and wrapped {scraped, count, injuries:[]} format
const INJURY_LIST = Array.isArray(INJURIES) ? INJURIES : (INJURIES && INJURIES.injuries || []);
const INJURY_MAP = new Map();
INJURY_LIST.forEach(inj => INJURY_MAP.set(inj.name, inj));
function _injBadge(name) {
  const inj = INJURY_MAP.get(name);
  if (!inj) return '';
  const s = inj.status;
  const clr = s === 'O' || s === 'IL' ? 'var(--red)' : s === 'DTD' ? '#e88a0a' : '#c49000';
  const label = s === 'IL' ? 'IL' : s === 'O' ? 'OUT' : s === 'DTD' ? 'DTD' : 'Q';
  // Extract short return date from "Expected to be out until at least Apr 10" → "Apr 10"
  const rd = inj.returnDate || '';
  const dateMatch = rd.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d+/);
  const shortReturn = dateMatch ? dateMatch[0] : '';
  const tip = `${inj.injury}${rd ? ' · ' + rd : ''}`;
  let html = ` <span class="pbadge" title="${tip}" style="background:${clr};color:#fff;">${label}</span>`;
  if (shortReturn && (s === 'O' || s === 'IL')) {
    html += `<span style="font-size:8px;color:${clr};margin-left:2px;cursor:help;" title="${rd}">~${shortReturn}</span>`;
  }
  return html;
}

// ── New analytics data (v5.0) ────────────────────────────────────────────
const PARK_FACTORS = __PARK_FACTORS_JSON__;
const SPRINT_SPEEDS = __SPRINT_SPEED_JSON__;
const BULLPEN_ROLES = __BULLPEN_ROLES_JSON__;
const SEASON_STATUS = __SEASON_STATUS_JSON__;

// Sprint speed lookup by name
const SPEED_MAP = new Map();
(SPRINT_SPEEDS || []).forEach(s => SPEED_MAP.set(s.name, s));

// Bullpen role lookups: closer → team, handcuff → team
const BP_CLOSER_MAP = new Map();   // team abbr → closer name
const BP_HANDCUFF_MAP = new Map(); // team abbr → handcuff name
const BP_ROLE_NOTES = new Map();   // team abbr → notes
(BULLPEN_ROLES || []).forEach(bp => {
  BP_CLOSER_MAP.set(bp.team, bp.closer);
  BP_HANDCUFF_MAP.set(bp.team, bp.handcuff);
  BP_ROLE_NOTES.set(bp.team, bp.notes);
});

// ── Buy-low / sell-high detection (xwOBA - wOBA gap) ─────────────────────
// Batter: positive delta (xwOBA > wOBA) = buy-low candidate (unlucky)
//         negative delta (xwOBA < wOBA) = sell-high candidate (lucky)
// Prefer 2026 in-season data when available; fall back to 2025 full-season.
function getBuySellTag(player) {
  if (!player || player.type !== 'BAT') return '';
  let delta;
  if (player.s26_xwoba && player.s26_woba) {
    delta = parseFloat(player.s26_xwoba) - parseFloat(player.s26_woba);
  } else {
    delta = player.s25_delta;
  }
  if (delta === '' || delta === undefined || delta === null || isNaN(delta)) return '';
  if (delta >= 0.020) return 'buy';   // xwOBA 20+ pts above wOBA = significantly unlucky
  if (delta <= -0.020) return 'sell';  // xwOBA 20+ pts below wOBA = significantly lucky
  return '';
}

// ── SB breakout detection (high speed + low SB projection) ──────────────
function getSbBreakoutTag(player) {
  if (!player || player.type !== 'BAT') return '';
  const speed = player.sprintSpeed;
  if (!speed || speed < 27) return '';
  const projSB = player.sb || 0;
  // Elite speed (29+) with < 15 projected SB = strong breakout signal
  if (speed >= 29 && projSB < 15) return 'sb-breakout';
  // Above-avg speed (27-29) with < 8 projected SB = moderate signal
  if (speed >= 27 && projSB < 8) return 'sb-breakout';
  return '';
}

// ── Park factor adjustment badge ────────────────────────────────────────
function parkBadge(player) {
  if (!player) return '';
  const hr = player.parkHR;
  if (!hr || hr === 1.0) return '';
  if (hr >= 1.10) return '<span class="pbadge" title="Hitter-friendly park (HR×' + hr.toFixed(2) + ')" style="background:#16a34a;color:#fff;">PF+</span>';
  if (hr <= 0.90) return '<span class="pbadge" title="Pitcher-friendly park (HR×' + hr.toFixed(2) + ')" style="background:#dc2626;color:#fff;">PF-</span>';
  return '';
}

// ── Closer handcuff badge ───────────────────────────────────────────────
function closerBadge(player) {
  if (!player || player.type !== 'PIT') return '';
  const role = player.bpRole;
  if (!role) return '';
  const colors = {CL: '#16a34a', SU: '#2563eb', HC: '#ca8a04'};
  const labels = {CL: 'CL', SU: 'SU', HC: 'HC'};
  const tips = {CL: 'Primary closer', SU: 'Setup man', HC: 'Closer handcuff — next in line'};
  const note = BP_ROLE_NOTES.get(player.team) || '';
  return ` <span class="pbadge" title="${tips[role]}${note ? ' · ' + note : ''}" style="background:${colors[role]};color:#fff;">${labels[role]}</span>`;
}

// ── K-adjusted value (this league penalizes Ks) ────────────────────────
// Standard leagues don't have -K. The gap between standard value and our LCV
// shows which players are over/undervalued by standard rankings.
// K-adj = how much the -K category changes this player's value vs standard
function getKadjBadge(player) {
  if (!player || player.type !== 'BAT') return '';
  const zSo = player.zSo;
  if (zSo === '' || zSo === undefined) return '';
  // zSo is the z-score of strikeouts — high zSo means lots of Ks
  // In our league, -K means this player loses value vs standard leagues
  // Positive zSo = high K player = LOSES value in our league (standard rankings overvalue them)
  // Negative zSo = low K player = GAINS value in our league (standard rankings undervalue them)
  if (zSo <= -1.0) return '<span class="pbadge" title="Low-K hitter: gains value in -K league (zK=' + zSo.toFixed(1) + ')" style="background:#16a34a;color:#fff;">LK</span>';
  if (zSo >= 1.5) return '<span class="pbadge" title="High-K hitter: loses value in -K league (zK=' + zSo.toFixed(1) + ')" style="background:#dc2626;color:#fff;">HK</span>';
  return '';
}

// ── Stuff+ year-over-year trend badge ───────────────────────────────────
function stuffTrendBadge(player) {
  if (!player || player.type !== 'PIT') return '';
  const delta = player.stuffTrend;
  if (delta === '' || delta === undefined || delta === null) return '';
  if (delta >= 8) return '<span class="pbadge" title="Stuff+ improved +' + delta + ' vs 2024 (' + (player.s24_stuff||'?') + '→' + (player.s25_stuff||'?') + ')" style="background:#16a34a;color:#fff;">STF↑</span>';
  if (delta <= -8) return '<span class="pbadge" title="Stuff+ declined ' + delta + ' vs 2024 (' + (player.s24_stuff||'?') + '→' + (player.s25_stuff||'?') + ')" style="background:#dc2626;color:#fff;">STF↓</span>';
  return '';
}

// ── 2026 Regression analysis badges ──────────────────────────────────────
// Batters are covered by getBuySellTag (BUY/SELL). luckBadge handles pitchers only.
function luckBadge(player) {
  if (!player) return '';

  // Pitcher luck: ERA vs FIP (when both available); also Stuff+ trend
  if (player.type === 'PIT') {
    // Stuff+ improvement badge (already covered by stuffTrendBadge, but check for dStuff)
    if (player.dStuff !== undefined && player.dStuff !== null && player.dStuff > 5) {
      return '<span class="pbadge" title="Stuff+ improved +' + player.dStuff + ' in 2026" style="background:#16a34a;color:#fff;">STUFF↑</span>';
    }
    // ERA vs FIP: if ERA significantly worse than FIP, pitcher is unlucky
    const era = parseFloat(player.s26_era);
    const fip = parseFloat(player.s26_fip);
    if (era && fip && !isNaN(era) && !isNaN(fip)) {
      const delta = era - fip;
      if (delta > 1.0) {
        return '<span class="pbadge" title="2026 ERA ' + delta.toFixed(2) + ' worse than FIP (unlucky)" style="background:#16a34a;color:#fff;">UNLUCKY</span>';
      }
    }
  }

  return '';
}

// ── Age-curve keeper decay ──────────────────────────────────────────────
// Adjusts keeper surplus for age-related decline
function ageDecayFactor(age, yearsOut) {
  // Players 30+ decline ~5% per year; younger players hold value
  if (age + yearsOut < 30) return 1.0;
  const declineYears = (age + yearsOut) - 29;
  return Math.max(0.5, Math.pow(0.95, declineYears));
}

// ── Prospects data ───────────────────────────────────────────────────────
const PROSPECTS = __PROSPECTS_JSON__;

// ── League Rookie Rosters (from DPF 2026 spreadsheet) ───────────────────
const LEAGUE_ROOKIES = __LEAGUE_ROOKIES_JSON__;


// ── Draft Picks & Keeper Cost Model ──────────────────────────────────────
const DRAFT_PICKS = __DRAFT_PICKS_JSON__;
const KEEPER_ADVANCE = 4;  // rounds per year
const KEEPER_FLOOR = 4;    // rounds 1-4 = permanently ineligible
const UNDRAFTED_KEEPER_START = 15;  // FA pickups start keeper life at R15

// Build lookup: player name → { round, pick, team, keeper }
const PICK_BY_NAME = {};
DRAFT_PICKS.forEach(dp => {
  PICK_BY_NAME[dp.n] = { round: dp.r, pick: dp.p, team: dp.t, keeper: dp.k };
});

// Keeper cost calculation
function getKeeperInfo(playerName) {
  const dp = PICK_BY_NAME[playerName];
  const draftRound = dp ? dp.round : null;
  const wasKeeper2026 = dp ? dp.keeper : false;

  // If not in draft, they're a potential FA pickup → R15 start
  const effectiveRound = draftRound || UNDRAFTED_KEEPER_START;

  // 2027 keeper cost = this year's round - 4
  const cost2027 = effectiveRound - KEEPER_ADVANCE;

  // Can this player be kept in 2027?
  const keepable2027 = cost2027 > KEEPER_FLOOR;

  // How many more years keepable? (including 2027)
  let yearsLeft = 0;
  let r = effectiveRound;
  while (r - KEEPER_ADVANCE > KEEPER_FLOOR) {
    yearsLeft++;
    r -= KEEPER_ADVANCE;
  }

  // Surplus value: player's LCV minus the "replacement value" at their keeper cost round
  // A round-4 player is essentially a 4th-round talent (~top 48 pick)
  // We normalize: round 1 pick is worth ~6.2 LCV, round 31 pick ~0 LCV
  // In a 12-team keeper league (~60 keepers), draft picks are less valuable
  // Linear approximation: roundValue = max(0, (32 - round) * 0.20)
  const roundValue = Math.max(0, (32 - effectiveRound) * 0.20);
  const costValue2027 = keepable2027 ? Math.max(0, (32 - cost2027) * 0.20) : 0;
  const p = _plyrI(playerName);
  const playerLCV = p ? (p.lcv || 0) : 0;
  // Surplus = production above what you'd expect from that draft slot
  // For keeper purposes: how much better is this player than what their keeper round implies?
  const surplusNow = playerLCV - roundValue;
  const surplus2027 = keepable2027 ? (playerLCV - costValue2027) : 0;

  // Multi-year surplus (discounted): sum of future surplus values
  // Now includes age-curve decay: older players' LCV projected to decline
  const playerAge = p ? (p.age || 28) : 28;
  let multiYearSurplus = 0;
  r = effectiveRound;
  let yr = 0;
  while (r - KEEPER_ADVANCE > KEEPER_FLOOR) {
    r -= KEEPER_ADVANCE;
    yr++;
    const futureSlotVal = Math.max(0, (32 - r) * 0.20);
    const ageDec = ageDecayFactor(playerAge, yr);
    multiYearSurplus += (playerLCV * ageDec - futureSlotVal) * Math.pow(0.85, yr); // 15% annual discount + age decay
  }

  return {
    draftRound: draftRound,
    wasKeeper: wasKeeper2026,
    effectiveRound: effectiveRound,
    cost2027: keepable2027 ? cost2027 : null,
    keepable2027: keepable2027,
    yearsLeft: yearsLeft,
    surplusNow: surplusNow,
    surplus2027: surplus2027,
    multiYearSurplus: multiYearSurplus,
    roundValue: roundValue
  };
}


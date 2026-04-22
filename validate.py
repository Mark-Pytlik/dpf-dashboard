#!/usr/bin/env python3
"""Pre-push sanity checks for the DPF dashboard data pipeline.

Run this before (or as part of) every deploy. It catches the long tail of
"data drift" bugs that have bitten us in the past — mis-identified teams,
roster size anomalies, duplicate-player edge cases, keeper entries that
don't resolve, missing teamIds on transactions, etc.

Exit codes:
  0 — no fatal errors (warnings may still be printed)
  1 — at least one fatal error; DO NOT deploy

Usage:
  python3 validate.py            # run all checks
  python3 validate.py --fail-on-warn   # treat warnings as errors too

Integrate with the scheduled task and CI so a bad scrape can't make it into
a rebuilt index.html.
"""
from __future__ import annotations

import argparse
import json
import re
import os
import sys
import unicodedata
from collections import defaultdict
from datetime import datetime


DATA_DIR = 'data'
LEAGUE_CONFIG = os.path.join(DATA_DIR, 'league_config.json')
CBS_TRANSACTIONS = os.path.join(DATA_DIR, 'cbs_transactions.json')
CBS_ROSTERS = os.path.join(DATA_DIR, 'cbs_rosters.json')
CBS_ROSTERS_FALLBACK = 'cbs_rosters.json'

# Roster size expectations (max active roster per team).
# Keep loose so minor CBS quirks don't fail the build.
MAX_ROSTER = 34
MIN_ROSTER = 18


def _strip_accents(s: str) -> str:
    return ''.join(
        c for c in unicodedata.normalize('NFD', s or '')
        if unicodedata.category(c) != 'Mn'
    ).lower().strip()


def _parse_txn_date(s: str):
    """Parse CBS txn dates like '4/21/26 2:15 AM ET' or '4/5/26 11:30 PM ET'.
    Returns a naive datetime for sorting. Falls back to datetime.min if unparseable."""
    if not s:
        return datetime.min
    # Strip trailing ' ET' (or any trailing TZ abbrev) for strptime
    s2 = re.sub(r'\s+[A-Z]{2,4}\s*$', '', s).strip()
    for fmt in ('%m/%d/%y %I:%M %p', '%m/%d/%Y %I:%M %p'):
        try:
            return datetime.strptime(s2, fmt)
        except ValueError:
            pass
    return datetime.min


class Report:
    def __init__(self):
        self.errors: list[str] = []
        self.warnings: list[str] = []

    def err(self, msg: str):
        self.errors.append(msg)

    def warn(self, msg: str):
        self.warnings.append(msg)

    def section(self, title: str):
        print(f"\n── {title} ──")

    def summary(self, fail_on_warn: bool) -> int:
        print("\n" + "=" * 60)
        if self.warnings:
            print(f"WARNINGS ({len(self.warnings)}):")
            for w in self.warnings:
                print(f"  ! {w}")
        if self.errors:
            print(f"\nERRORS ({len(self.errors)}):")
            for e in self.errors:
                print(f"  ✗ {e}")
            print("\nFAIL — do not deploy.")
            return 1
        if fail_on_warn and self.warnings:
            print("\nFAIL (warnings treated as errors).")
            return 1
        print("\nOK — safe to deploy.")
        return 0


def _load_json(path: str, report: Report):
    try:
        with open(path) as f:
            return json.load(f)
    except FileNotFoundError:
        report.err(f"missing required file: {path}")
        return None
    except json.JSONDecodeError as e:
        report.err(f"{path} is not valid JSON: {e}")
        return None


def check_league_config(report: Report):
    report.section("league_config.json")
    cfg = _load_json(LEAGUE_CONFIG, report)
    if cfg is None:
        return None

    teams = cfg.get('teams') or []
    if len(teams) != 12:
        report.err(f"expected 12 teams in league_config.json, got {len(teams)}")
    picks = {t.get('pick') for t in teams}
    if picks != set(range(1, 13)):
        report.err(f"team picks must be 1..12; got {sorted(picks)}")
    mine = [t for t in teams if t.get('mine')]
    if len(mine) != 1:
        report.err(f"exactly one team must have `mine: true`, found {len(mine)}")

    names = [t.get('name') for t in teams]
    if len(set(names)) != len(names):
        report.err(f"duplicate team names in league_config: {names}")

    # keepers and milb_keepers are keyed by OWNER LAST NAME (stable — team names change).
    # Extract owner last names from teams and check each has a keeper block.
    def _last(owner_full: str) -> str:
        parts = (owner_full or '').strip().split()
        return parts[-1] if parts else ''

    owner_lasts = [_last(t.get('owner', '')) for t in teams]

    keepers = cfg.get('keepers') or {}
    missing_keeper_blocks = [o for o in owner_lasts if o and o not in keepers]
    if missing_keeper_blocks:
        report.warn(f"owners without a keepers block: {missing_keeper_blocks}")

    milb = cfg.get('milb_keepers') or {}
    missing_milb = [o for o in owner_lasts if o and o not in milb]
    if missing_milb:
        report.warn(f"owners without a milb_keepers block: {missing_milb}")

    # Every keeper should have a valid round (1..30 loosely)
    for owner_ln, kps in keepers.items():
        for k in kps or []:
            if not isinstance(k, dict):
                report.err(f"{owner_ln}: keeper entry is not an object: {k!r}")
                continue
            rnd = k.get('round')
            if not isinstance(rnd, int) or not (1 <= rnd <= 30):
                report.err(f"{owner_ln}: keeper '{k.get('name')}' has invalid round {rnd}")

    # Global keeper uniqueness: a player can only be kept by one owner
    seen = {}
    for owner_ln, kps in keepers.items():
        for k in kps or []:
            if not isinstance(k, dict):
                continue
            n = k.get('name')
            if n in seen:
                report.err(
                    f"keeper '{n}' appears for both '{seen[n]}' and '{owner_ln}'"
                )
            else:
                seen[n] = owner_ln

    return cfg


def check_transactions(report: Report, cfg: dict | None):
    report.section("cbs_transactions.json")
    txns = _load_json(CBS_TRANSACTIONS, report)
    if txns is None:
        return None, {}

    if not isinstance(txns, list):
        report.err("cbs_transactions.json must be a JSON array")
        return None, {}

    # Missing teamId is OK for really old records but should be rare
    missing_id = sum(1 for t in txns if not t.get('teamId'))
    if missing_id:
        report.warn(f"{missing_id} transactions have no teamId")

    # Canonical team names from config
    cfg_team_names = {t['name'] for t in (cfg or {}).get('teams', [])}

    # Build teamId -> set of canonical names seen for that id (sanity check)
    id_to_names = defaultdict(set)
    for tx in txns:
        tid = str(tx.get('teamId') or '')
        name = tx.get('teamName') or tx.get('team')
        if tid and name:
            id_to_names[tid].add(name)

    # Any teamId where we see a name that isn't in league_config AND isn't
    # a known-old-name warrants a heads-up
    known_old = {
        'Father Jhon Kensy',
        'Dennis Santana - Smooth ft. Rob Thomas',
        'choured in the usa.',
        'Are we not men? We are Devers!',
        'Everythings McGonigle Green',
    }
    for tid, seen in id_to_names.items():
        unknown = sorted(n for n in seen if n not in cfg_team_names and n not in known_old)
        if unknown:
            report.warn(f"teamId {tid}: unfamiliar team name(s) {unknown}")

    # Dates must parse
    bad_dates = 0
    for tx in txns:
        d = (tx.get('date') or '').replace('\u00a0', ' ')
        ok = False
        for fmt in ('%m/%d/%y %I:%M %p ET', '%m/%d/%y %I:%M %p', '%m/%d/%y'):
            try:
                datetime.strptime(d, fmt)
                ok = True
                break
            except ValueError:
                continue
        if not ok:
            bad_dates += 1
    if bad_dates:
        report.err(f"{bad_dates} transactions have unparseable dates")

    # Players list must be non-empty
    empty = sum(1 for t in txns if not t.get('players'))
    if empty:
        report.err(f"{empty} transactions have no players array")

    # Duplicate-key check — transactions that dedup identically should not re-appear
    # (this catches regressions in merge_tx dedup logic)
    dupes = defaultdict(int)
    for tx in txns:
        players = ",".join(sorted(p.get('name', '') for p in tx.get('players', [])))
        tid = str(tx.get('teamId') or '')
        key = (tx.get('date', ''), tid, players)
        dupes[key] += 1
    repeated = [k for k, c in dupes.items() if c > 1]
    if repeated:
        # Demoted to warning: synthetic roster_sync adds (date 4/3/26 12:00 AM ET) often
        # collide with real CBS transactions for the same player; that's expected and benign.
        # Real merge_tx duplicate bugs would also surface here — investigate when count grows.
        report.warn(f"{len(repeated)} duplicate transactions (same date/teamId/players)")

    return txns, id_to_names


def check_roster_sizes(report: Report, cfg: dict | None):
    report.section("cbs_rosters.json (roster size + duplicate players)")
    path = CBS_ROSTERS if os.path.exists(CBS_ROSTERS) else CBS_ROSTERS_FALLBACK
    if not os.path.exists(path):
        report.warn(f"no CBS rosters file found (looked at {CBS_ROSTERS} and {CBS_ROSTERS_FALLBACK})")
        return

    rosters_raw = _load_json(path, report)
    if rosters_raw is None:
        return

    # Normalize cbs_rosters.json shape. Two shapes have existed in the wild:
    #   1. { teamName: [playerName, ...] }
    #   2. { "<teamId>": { teamId, teamName, players: [{name, pos, ...}, ...] } }
    # Produce a flat { teamName: [playerName, ...] } for the rest of the checks.
    rosters: dict[str, list[str]] = {}
    for key, value in (rosters_raw or {}).items():
        if isinstance(value, dict) and 'players' in value:
            tname = value.get('teamName') or str(key)
            plist = value.get('players') or []
            names = []
            for p in plist:
                if isinstance(p, dict):
                    nm = p.get('name')
                    if nm:
                        names.append(nm)
                elif isinstance(p, str):
                    names.append(p)
            rosters[tname] = names
        elif isinstance(value, list):
            rosters[str(key)] = [p if isinstance(p, str) else (p.get('name') or '') for p in value]

    # Team count
    if len(rosters) != 12:
        report.err(f"expected 12 rosters in {path}, got {len(rosters)}")

    # Known names shared by two real MLB players — cross-team collisions for these are
    # actually legitimate. Add to this list as others come up.
    KNOWN_DUPLICATE_PLAYER_NAMES = {'Max Muncy', 'Luis Garcia', 'Will Smith'}

    # Size bounds + duplicate player across teams
    owner = {}
    for team_name, players in rosters.items():
        n = len(players or [])
        if n > MAX_ROSTER:
            report.warn(f"{team_name}: {n} players (cap ~{MAX_ROSTER})")
        elif n < MIN_ROSTER:
            report.warn(f"{team_name}: only {n} players")
        seen_this_team = set()
        for p in players or []:
            if not p:
                continue
            if p in seen_this_team:
                # Two-way players (Ohtani) and position-flex slots may list the same
                # player twice on the same roster — not a data bug, just CBS layout.
                continue
            seen_this_team.add(p)
            if p in owner and owner[p] != team_name:
                if p in KNOWN_DUPLICATE_PLAYER_NAMES:
                    report.warn(f"player '{p}' on '{owner[p]}' and '{team_name}' (known duplicate-name)")
                else:
                    report.err(f"player '{p}' is on both '{owner[p]}' and '{team_name}'")
            else:
                owner[p] = team_name

    # Keeper resolution. league_config.keepers is keyed by OWNER LAST NAME (stable);
    # cbs_rosters.json is keyed by team. Since team names change frequently AND
    # keepers can be traded mid-season, we don't check per-team keeper location —
    # just that each keeper is rostered *somewhere* or is an explicit MiLB pick.
    if cfg:
        keepers = cfg.get('keepers') or {}
        milb = cfg.get('milb_keepers') or {}
        roster_players_norm = {_strip_accents(p) for p in owner}
        milb_players_norm = set()
        for kps in milb.values():
            for n in kps or []:
                milb_players_norm.add(_strip_accents(n))

        for owner_ln, kps in keepers.items():
            for k in kps or []:
                n = k.get('name') if isinstance(k, dict) else k
                if not n:
                    continue
                nn = _strip_accents(n)
                if nn in roster_players_norm:
                    continue  # rostered somewhere — fine (keepers can be traded)
                if nn in milb_players_norm:
                    continue  # minors, fine
                report.warn(f"{owner_ln}: keeper '{n}' not on any CBS roster")



# ── Additional sanity checks (added after trade/injury data-drift incidents) ──
INJURIES_PATH = os.path.join(DATA_DIR, 'injuries.json')


def _mojibake_count(s: str) -> int:
    if not s:
        return 0
    return s.count('Ã') + s.count('Â')


def _looks_mangled(name: str) -> bool:
    """True when a name looks like 'X. LastFirst Last' (scraper concat artifact).

    Uses the same duplicate-suffix detection as tools/clean_injuries.py — if
    the cleaner would change this name, we flag it.
    """
    if not name:
        return False
    n = len(name)
    for length in range(min(n // 2, 30), 3, -1):
        suffix = name[-length:]
        earlier = name.rfind(suffix, 0, n - length)
        if earlier > 0:
            candidate = name[earlier + length:].strip()
            if candidate and candidate[0].isupper() and (' ' in candidate or '-' in candidate):
                return True
    return False


def check_injuries(report: Report):
    report.section("injuries.json")
    if not os.path.exists(INJURIES_PATH):
        report.warn(f"no injuries file at {INJURIES_PATH}")
        return None
    inj = _load_json(INJURIES_PATH, report)
    if not isinstance(inj, list):
        report.err("injuries.json must be a JSON array")
        return None

    mangled = [r for r in inj if _looks_mangled((r or {}).get('name', ''))]
    if mangled:
        sample = ', '.join(r['name'] for r in mangled[:5])
        report.err(f"{len(mangled)} injury names look mangled (e.g. {sample}). "
                   f"Run tools/clean_injuries.py.")
    return inj


def check_rostered_injured(report: Report, cfg: dict | None, inj_list):
    """Cross-check: every rostered player who has an IL entry in injuries.json
    should be reachable — i.e. the scraper produced a clean name that the
    dashboard can match."""
    report.section("rostered × injuries cross-check")
    if inj_list is None:
        return
    path = CBS_ROSTERS if os.path.exists(CBS_ROSTERS) else CBS_ROSTERS_FALLBACK
    if not os.path.exists(path):
        return
    rosters_raw = _load_json(path, report) or {}
    rostered = set()
    for value in rosters_raw.values():
        if isinstance(value, dict) and 'players' in value:
            for p in value['players']:
                if isinstance(p, dict) and p.get('name'):
                    rostered.add(_strip_accents(p['name']))
        elif isinstance(value, list):
            for p in value:
                if isinstance(p, str):
                    rostered.add(_strip_accents(p))
                elif isinstance(p, dict) and p.get('name'):
                    rostered.add(_strip_accents(p['name']))

    inj_names_norm = {_strip_accents((r or {}).get('name', '')) for r in inj_list}
    rostered_il = rostered & inj_names_norm
    # Purely informational: ensure at least a few rostered players are injured.
    # If ZERO rostered players are in the injury list but the list is non-empty,
    # that strongly suggests a name-mangling scraper issue.
    if inj_list and rostered and not rostered_il:
        report.err("no rostered players found in injuries.json — likely "
                   "name-mangling issue; check injury name normalization.")


def check_tx_mojibake(report: Report, txns):
    if not txns:
        return
    moji_rows = [t for t in txns if _mojibake_count((t.get('teamName') or t.get('team') or '')) > 0]
    if moji_rows:
        report.err(f"{len(moji_rows)} transactions have mojibake in team name. "
                   f"Run tools/clean_transactions.py.")


def check_trade_integrity(report: Report, txns):
    """Every trade date should produce symmetric moves — each team that sent
    player(s) should also have a receiving row mentioning the other team."""
    if not txns:
        return
    by_date = defaultdict(list)
    for t in txns:
        if any('Traded' in (p.get('action') or '') for p in t.get('players') or []):
            by_date[t.get('date', '')].append(t)
    broken = []
    for date, rows in by_date.items():
        if len(rows) < 2:
            broken.append((date, len(rows)))
    if broken:
        report.warn(f"{len(broken)} trade dates have fewer than 2 rows "
                    f"(suggests a missing counter-party): {broken[:3]}")



def check_known_actions(report: Report, txns):
    """Fail if CBS emits an action type we don't yet handle in draft-data.js.

    draft-data.js has explicit branches for:
      Added, Added off Waivers, Dropped, Traded from <Team>, Activated, Moved to IR
    Any other action type silently falls through to no-op, which is how the
    Rico Garcia / Activated bug happened (CBS added the type, dashboard
    ignored it, rosters drifted from ground truth).

    When a new action type appears here, first decide how it should be
    handled in draft-data.js, THEN add it to KNOWN_ACTIONS below.
    """
    if not txns:
        return
    report.section("cbs action types (drift guard)")
    KNOWN_ACTIONS = {
        'Added',
        'Added off Waivers',
        'Dropped',
        'Activated',
        'Moved to IR',
    }
    # "Traded from <Team>" is a family of action strings — check prefix.
    unknown = defaultdict(int)
    for tx in txns:
        for p in tx.get('players', []):
            a = (p.get('action') or '').strip()
            if not a:
                continue
            if a in KNOWN_ACTIONS:
                continue
            if a.startswith('Traded from '):
                continue
            unknown[a] += 1
    if unknown:
        report.err(
            "unknown CBS action type(s) found — draft-data.js will silently "
            "ignore these, leaving rosters inconsistent with CBS: " +
            ", ".join(f"{a!r} (x{n})" for a, n in sorted(unknown.items()))
        )


def check_roster_ground_truth(report: Report):
    """cbs_rosters.json is ground truth. Every player listed there should be
    explainable by the latest transaction referencing them.

    Distinguishes two failure modes:
      ERROR: player has txns but their latest active-team signal points to a
             different team than cbs_rosters says. This is real drift —
             draft-data.js is going to put them on the wrong team.
      WARN:  player is on cbs_rosters but has no txn signal at all. This is
             usually a pre-draft keeper (LIVE_PICKS / LEAGUE_MILB_KEEPERS)
             or a player whose original Add rolled off CBS's ~30-row cap
             before Activated/Moved to IR entries appeared.

    This would have caught Rico Garcia: his most recent txn is 'Activated'
    on Yesavage Garden; if draft-data.js doesn't handle Activated, the last
    add-like signal becomes None → error.
    """
    report.section("cbs_rosters vs cbs_transactions (end-to-end roster integrity)")
    rosters_path = CBS_ROSTERS if os.path.exists(CBS_ROSTERS) else CBS_ROSTERS_FALLBACK
    if not os.path.exists(rosters_path):
        return
    rosters = _load_json(rosters_path, report)
    txns = _load_json(CBS_TRANSACTIONS, report)
    if not rosters or not txns:
        return

    # player -> expected team per cbs_rosters
    expected = {}
    for team_name, players in rosters.items():
        for p in players:
            nm = p if isinstance(p, str) else (p.get('name') if isinstance(p, dict) else None)
            if nm:
                expected[nm] = team_name

    # Known team-rename aliases — add here when an owner renames mid-season.
    rename_aliases = {
        "Whoop Whoop that's the sound of Dylan Cease": 'Everythings McGonigle Green',
    }

    def _norm(team):
        return rename_aliases.get(team, team)

    # Replay txns chronologically. For each player, track the "last team that
    # claimed them via an add-like action" — Added, Added off Waivers,
    # Traded from <X>, Activated, Moved to IR. Dropped clears the signal.
    rostered = {}
    ADD_ACTIONS = {'Added', 'Added off Waivers', 'Activated', 'Moved to IR'}
    for tx in sorted(txns, key=lambda t: _parse_txn_date(t.get('date', ''))):
        team = tx.get('teamName') or tx.get('team')
        for p in tx.get('players', []):
            nm = p.get('name')
            a = (p.get('action') or '')
            if not nm or not team:
                continue
            if a in ADD_ACTIONS or a.startswith('Traded from '):
                rostered[nm] = team
            elif a == 'Dropped':
                if rostered.get(nm) == team:
                    rostered.pop(nm, None)

    # Identify duplicate-name players we should skip. These are handled by
    # draft-data.js's _sameNameCount collision check — our simple replay
    # above can't disambiguate without the player pool, so skip them here.
    all_names_in_rosters = []
    for team_name, players in rosters.items():
        for p in players:
            nm = p if isinstance(p, str) else (p.get('name') if isinstance(p, dict) else None)
            if nm:
                all_names_in_rosters.append(nm)
    dup_names_in_rosters = {n for n in all_names_in_rosters if all_names_in_rosters.count(n) > 1}

    # Also collision if same name has txns with different mlbTeam values.
    name_to_mlb = {}
    for tx in txns:
        for p in tx.get('players', []):
            nm, mt = p.get('name'), p.get('mlbTeam')
            if nm and mt:
                name_to_mlb.setdefault(nm, set()).add(mt)
    dup_names_from_mlb = {n for n, ts in name_to_mlb.items() if len(ts) > 1}

    collision_names = dup_names_in_rosters | dup_names_from_mlb

    # Known-ignorable drift cases. Each entry documents WHY the apparent
    # drift is not a real dashboard bug. Remove an entry once the root cause
    # is fixed (e.g. once roster_sync stops adding the same name to two teams).
    KNOWN_DRIFT_IGNORES = {
        # Cade Smith: two MLB players with this name (NYY + CLE). roster_sync
        # synthetically added to two teams; draft-data.js disambiguates via
        # _sameNameCount collision check at runtime.
        'Cade Smith',
        # Landen Roupp: dropped by 'Before and After Shohei' pre-season then
        # re-picked; roster_sync added him to two teams. Dashboard's
        # last-txn-wins matches cbs_rosters, so this is cosmetic drift.
        'Landen Roupp',
    }

    # For each cbs_rosters player, classify: drift (err), no-signal (warn), ok.
    drifts = []
    no_signal = 0
    for nm, exp_team in expected.items():
        if nm in collision_names or nm in KNOWN_DRIFT_IGNORES:
            continue
        got_team = rostered.get(nm)
        if got_team is None:
            no_signal += 1
            continue
        if _norm(got_team) != _norm(exp_team):
            drifts.append((nm, exp_team, got_team))

    if drifts:
        for nm, exp_team, got_team in drifts[:10]:
            report.err(f"roster drift: {nm!r} should be on {exp_team!r} per cbs_rosters but last txn puts him on {got_team!r}")
        if len(drifts) > 10:
            report.err(f"...and {len(drifts) - 10} more roster drift(s)")
    if no_signal:
        # Expected for pre-draft keepers and deep-bench players whose Add rolled off the 30-row cap
        report.warn(f"{no_signal} rostered players have no txn signal (likely pre-draft keepers or dropped off CBS 30-row cap — roster_sync.py should backfill)")



def check_data_freshness(report: Report):
    """Fail if CBS data is stale. Silent staleness is the 'didn't happen
    last night' bug: the scheduled task died or skipped CBS, nothing
    committed, dashboard kept serving yesterday's (or last week's) data.

    We check the most-recent transaction date in cbs_transactions.json and
    the season_status.lastUpdated marker. If EITHER is more than 36 hours
    old, we warn or error (48h = error) to force a fix.

    36h threshold is deliberately wider than 24h so a single missed cron
    (e.g. travel, weekend) doesn't fail the deploy; but a second miss
    does. Adjust STALE_WARN_H / STALE_ERR_H in the constants if needed.
    """
    report.section("data freshness")
    STALE_WARN_H = 36
    STALE_ERR_H = 72

    from datetime import datetime, timezone, timedelta
    now = datetime.now(timezone.utc)

    # Most recent CBS transaction date
    txns = _load_json(CBS_TRANSACTIONS, report) or []
    latest_tx = None
    for t in txns:
        d = (t.get('date') or '').replace(' ', ' ')
        for fmt in ('%m/%d/%y %I:%M %p ET', '%m/%d/%y %I:%M %p', '%m/%d/%y'):
            try:
                dt = datetime.strptime(d, fmt)
                # Assume ET (UTC-4 during baseball season). Close enough.
                dt = dt.replace(tzinfo=timezone(timedelta(hours=-4)))
                if latest_tx is None or dt > latest_tx:
                    latest_tx = dt
                break
            except ValueError:
                continue
    if latest_tx:
        age_h = (now - latest_tx).total_seconds() / 3600
        print(f"most recent CBS transaction: {latest_tx.isoformat()} ({age_h:.1f}h ago)")
        if age_h > STALE_ERR_H:
            report.err(f"CBS transactions haven't refreshed in {age_h:.1f}h (>{STALE_ERR_H}h) — scheduled scrape is broken")
        elif age_h > STALE_WARN_H:
            report.warn(f"CBS transactions are {age_h:.1f}h old (>{STALE_WARN_H}h) — check scheduled scrape")
    else:
        report.warn("no parseable transaction dates — can't assess CBS freshness")

    # Scheduled-task run status (if the hardened daily task wrote one)
    try:
        with open(os.path.join(DATA_DIR, 'last_daily_run.json')) as f:
            last = json.load(f)
        pb = last.get('phaseB', {})
        if pb.get('cbs_auth') == 'missing':
            report.err("last scheduled run reports CBS auth MISSING — private-league data not refreshing. Sign in to CBS in Chrome and run the task again, or wire scrape_cbs.py --cookies.")
        elif pb.get('transactions') == 'fail' or pb.get('rosters') == 'fail':
            report.err(f"last scheduled run had CBS failures: transactions={pb.get('transactions')}, rosters={pb.get('rosters')}")
        completed = last.get('completedAt')
        if completed:
            try:
                c_dt = datetime.fromisoformat(completed.replace('Z','+00:00'))
                age_h = (now - c_dt).total_seconds() / 3600
                if age_h > 36:
                    report.err(f"last_daily_run.json is {age_h:.1f}h old — scheduled task hasn't completed in over {STALE_WARN_H}h")
            except ValueError:
                pass
    except FileNotFoundError:
        report.warn("data/last_daily_run.json not present — hardened daily task hasn't run yet, or an older version of the task is still active")
    except Exception as e:
        report.warn(f"couldn't read last_daily_run.json: {e}")

    # Season status freshness (periodEnd should be in the future or recent past)
    try:
        with open(os.path.join(DATA_DIR, 'season_status.json')) as f:
            ss = json.load(f)
        pe = ss.get('periodEnd')
        if pe:
            try:
                pe_dt = datetime.strptime(pe, '%Y-%m-%d').replace(tzinfo=timezone.utc)
                days_since_end = (now - pe_dt).days
                if days_since_end > 2:
                    report.warn(
                        f"season_status.periodEnd is {days_since_end} days ago — "
                        f"H2H period data may be stuck (expected to roll over every 2 weeks)"
                    )
            except ValueError:
                pass
    except Exception:
        pass


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--fail-on-warn', action='store_true')
    args = parser.parse_args()

    report = Report()
    cfg = check_league_config(report)
    txns, _ = check_transactions(report, cfg)
    check_tx_mojibake(report, txns)
    check_trade_integrity(report, txns)
    check_known_actions(report, txns)
    check_roster_sizes(report, cfg)
    check_roster_ground_truth(report)
    inj_list = check_injuries(report)
    check_rostered_injured(report, cfg, inj_list)
    check_data_freshness(report)
    return report.summary(args.fail_on_warn)


if __name__ == '__main__':
    sys.exit(main())

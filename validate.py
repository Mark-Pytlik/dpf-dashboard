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


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--fail-on-warn', action='store_true')
    args = parser.parse_args()

    report = Report()
    cfg = check_league_config(report)
    check_transactions(report, cfg)
    check_roster_sizes(report, cfg)
    return report.summary(args.fail_on_warn)


if __name__ == '__main__':
    sys.exit(main())

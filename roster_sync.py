#!/usr/bin/env python3
"""Compare CBS rosters with cbs_transactions.json and generate synthetic corrections.

CBS per-team transaction pages cap at ~30 entries, so older adds/drops get truncated.
This script reconciles the *effective* roster derived from transactions against the
*actual* CBS roster, and emits synthetic `Added`/`Dropped` transactions for any drift.

Synthetic transactions:
  * stamped with the current date (so they sort to the top of the log)
  * marked with `synthetic: true` at both the transaction and player level
  * include a short `note` so humans can see why they exist

Usage: python3 roster_sync.py
Reads: data/cbs_rosters.json (falls back to ./cbs_rosters.json), data/cbs_transactions.json
Writes: data/cbs_transactions.json with new synthetic entries appended and resorted.
"""
import json
import os
import sys
from datetime import datetime

# Canonical CBS team name → teamId. Older/renamed team names live here too so a
# stale scrape doesn't get dropped on the floor.
CBS_TEAM_IDS = {
    'Weird Fishes / Arrighetti': '1',
    'Dinosaur Jr Caminero': '2',
    "Colonel Corbin's Ascent": '3',
    'Okamotomami': '4',
    'Buddy Buddy Buddy All On Base': '5',
    'A Pete Crow-Armstrong Looked at Me': '6',
    "Whoop Whoop that's the sound of Dylan Cease": '7',
    "Everythings McGonigle Green": '7',
    'Everythings McGonigle Green': '7',  # legacy
    'Ballesteros, Let the Rhythm Take You Over': '8',
    'Yesavage Garden': '9',
    'Blame it on the Rainiel': '10',
    'Before and After Shohei': '11',
    "Popped A Mahle I'm Sweating": '12',
}

ROSTERS_CANDIDATES = ['data/cbs_rosters.json', 'cbs_rosters.json']
TXNS_PATH = 'data/cbs_transactions.json'


def _find_rosters_path():
    for p in ROSTERS_CANDIDATES:
        if os.path.exists(p):
            return p
    return None


def _now_cbs_stamp():
    """Timestamp in the same shape CBS emits (e.g. '4/18/26 12:00 AM ET')."""
    now = datetime.now()
    # Use midnight to avoid per-minute jitter between runs on the same day.
    return now.strftime('%-m/%-d/%y 12:00 AM ET')


def parse_date(s):
    s = (s or '').replace('\u00a0', ' ').replace(' ET', '').strip()
    for fmt in ('%m/%d/%y %I:%M %p', '%m/%d/%y'):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            pass
    return datetime.min


def main():
    rosters_path = _find_rosters_path()
    if not rosters_path:
        print(f"ERROR: could not find cbs_rosters.json in {ROSTERS_CANDIDATES}")
        return 1
    with open(rosters_path) as f:
        cbs_rosters = json.load(f)
    with open(TXNS_PATH) as f:
        txns = json.load(f)

    stamp = _now_cbs_stamp()
    txns_sorted = sorted(txns, key=lambda t: parse_date(t.get('date', '')))

    # Derive current roster state from transactions (last-write-wins by player).
    # player -> (last_action, last_team_id, last_date)
    player_last_action = {}
    for txn in txns_sorted:
        team_id = str(txn.get('teamId') or '')
        for p in txn.get('players', []):
            name = p.get('name', '')
            if not name:
                continue
            action = p.get('action', '')
            player_last_action[name] = (action, team_id, txn.get('date', ''))

    # Derive the canonical CBS roster as a set of (team_id, player) pairs.
    cbs_pairs = set()
    for team_name, players in cbs_rosters.items():
        team_id = CBS_TEAM_IDS.get(team_name, '')
        if not team_id:
            print(f"  WARN: unknown team '{team_name}' in cbs_rosters.json — skipping")
            continue
        for player_name in players:
            cbs_pairs.add((team_id, player_name))

    new_txns = []

    # Pass 1: players who are on a CBS roster but not reflected as Added there.
    for team_name, players in cbs_rosters.items():
        team_id = CBS_TEAM_IDS.get(team_name, '')
        if not team_id:
            continue
        for player_name in players:
            last = player_last_action.get(player_name)
            if last is None:
                new_txns.append({
                    'date': stamp,
                    'teamId': team_id,
                    'team': team_name,
                    'teamName': team_name,
                    'synthetic': True,
                    'note': 'roster_sync: no prior transaction',
                    'players': [{
                        'name': player_name,
                        'action': 'Added',
                        'synthetic': True,
                    }],
                })
                print(f"  NEW ADD:     {player_name} → {team_name}")
                continue
            action, last_team, last_date = last
            if action == 'Dropped':
                new_txns.append({
                    'date': stamp,
                    'teamId': team_id,
                    'team': team_name,
                    'teamName': team_name,
                    'synthetic': True,
                    'note': f'roster_sync: was Dropped on {last_date}',
                    'players': [{
                        'name': player_name,
                        'action': 'Added',
                        'synthetic': True,
                    }],
                })
                print(f"  MISSING ADD: {player_name} → {team_name} (was Dropped on {last_date})")
            elif action in ('Added', 'Added off Waivers') and str(last_team) != str(team_id):
                new_txns.append({
                    'date': stamp,
                    'teamId': team_id,
                    'team': team_name,
                    'teamName': team_name,
                    'synthetic': True,
                    'note': f'roster_sync: was on team {last_team}',
                    'players': [{
                        'name': player_name,
                        'action': 'Added',
                        'synthetic': True,
                    }],
                })
                print(f"  WRONG TEAM:  {player_name} → {team_name} (was on team {last_team})")

    # Pass 2: players whose last action is "Added" to team X, but CBS says they
    # aren't on team X (and aren't on any CBS roster at all). Emit a synthetic
    # Dropped so they stop cluttering their former team — this kills ghost
    # players like Nick Kurtz who were traded before CBS's transaction window.
    cbs_player_set = {p for (_tid, p) in cbs_pairs}
    for name, (action, last_team, last_date) in player_last_action.items():
        if action not in ('Added', 'Added off Waivers'):
            continue
        if not last_team:
            continue
        if (last_team, name) in cbs_pairs:
            continue  # still there — nothing to do
        if name in cbs_player_set:
            continue  # they're on a different team, pass 1 will add them there
        # Player disappeared entirely. Drop them from their last team.
        last_team_name = next(
            (tn for tn, tid in CBS_TEAM_IDS.items() if tid == last_team),
            last_team,
        )
        new_txns.append({
            'date': stamp,
            'teamId': last_team,
            'team': last_team_name,
            'teamName': last_team_name,
            'synthetic': True,
            'note': 'roster_sync: not on any CBS roster',
            'players': [{
                'name': name,
                'action': 'Dropped',
                'synthetic': True,
            }],
        })
        print(f"  GHOST DROP:  {name} off {last_team_name} (last action {action} on {last_date})")

    if new_txns:
        # Dedup against existing synthetics from the same day so repeated runs
        # don't pile up copies.
        def _syn_key(t):
            p = t.get('players', [{}])[0]
            return (
                t.get('date', ''),
                str(t.get('teamId', '')),
                p.get('name', ''),
                p.get('action', ''),
            )
        existing_syn = {_syn_key(t) for t in txns if t.get('synthetic')}
        fresh = [t for t in new_txns if _syn_key(t) not in existing_syn]
        txns.extend(fresh)
        txns.sort(key=lambda t: parse_date(t.get('date', '')), reverse=True)
        with open(TXNS_PATH, 'w') as f:
            json.dump(txns, f, indent=2)
        print(f"\nAdded {len(fresh)} synthetic transactions (skipped {len(new_txns) - len(fresh)} dupes). Total: {len(txns)}")
    else:
        print("No roster drift detected.")
    return 0


if __name__ == '__main__':
    sys.exit(main())

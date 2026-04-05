#!/usr/bin/env python3
"""Compare CBS rosters with cbs_transactions.json and generate missing Add transactions.

Usage: python3 roster_sync.py
Reads: cbs_rosters.json, data/cbs_transactions.json
Writes: Updated data/cbs_transactions.json with synthetic "Added" transactions
"""
import json, sys

CBS_TEAM_IDS = {
    'Weird Fishes / Arrighetti': '1',
    'Dinosaur Jr Caminero': '2',
    "Colonel Corbin's Ascent": '3',
    'Okamotomami': '4',
    'Buddy Buddy Buddy All On Base': '5',
    'A Pete Crow-Armstrong Looked at Me': '6',
    "Whoop Whoop that's the sound of Dylan Cease": '7',
    'Everythings McGonigle Green': '7',
    'Ballesteros, Let the Rhythm Take You Over': '8',
    'Yesavage Garden': '9',
    'Blame it on the Rainiel': '10',
    'Before and After Shohei': '11',
    "Popped A Mahle I'm Sweating": '12',
}

cbs_rosters = json.load(open('cbs_rosters.json'))
txns = json.load(open('data/cbs_transactions.json'))

# Build current state: for each player, find the LAST action affecting them
# (sorted by date). If the last action was "Dropped", they're a free agent.
# If the last action was "Added"/"Added off Waivers"/"Traded from...", they're on a team.
from datetime import datetime
import re

def parse_date(s):
    """Parse CBS date string like '3/21/26 10:18 PM ET' to datetime."""
    s = s.replace(' ET', '').strip()
    try:
        return datetime.strptime(s, '%m/%d/%y %I:%M %p')
    except:
        return datetime.min

# Sort transactions by date
txns_sorted = sorted(txns, key=lambda t: parse_date(t['date']))

# Track last action per player
player_last_action = {}  # name -> (action, teamId, date)
for txn in txns_sorted:
    team_id = txn.get('teamId', '')
    for p in txn.get('players', []):
        name = p.get('name', '')
        action = p.get('action', '')
        player_last_action[name] = (action, team_id, txn['date'])

# Now check each CBS roster player
new_txns = []
for team_name, players in cbs_rosters.items():
    team_id = CBS_TEAM_IDS.get(team_name, '')
    for player_name in players:
        last = player_last_action.get(player_name)
        if last:
            action, last_team, last_date = last
            if action == 'Dropped':
                # Player was dropped but is now on a CBS roster — missing re-add
                new_txns.append({
                    'date': '4/3/26 12:00 AM ET',
                    'teamId': team_id,
                    'teamName': team_name,
                    'players': [{
                        'name': player_name,
                        'action': 'Added',
                        'synthetic': True
                    }]
                })
                print(f"  MISSING ADD: {player_name} → {team_name} (was Dropped on {last_date})")
            elif action in ('Added', 'Added off Waivers') and last_team != team_id:
                # Player was added to a different team than their CBS roster
                new_txns.append({
                    'date': '4/3/26 12:00 AM ET',
                    'teamId': team_id,
                    'teamName': team_name,
                    'players': [{
                        'name': player_name,
                        'action': 'Added',
                        'synthetic': True
                    }]
                })
                print(f"  WRONG TEAM: {player_name} → {team_name} (was on team {last_team})")

if new_txns:
    txns.extend(new_txns)
    # Sort by date
    txns.sort(key=lambda t: parse_date(t['date']))
    json.dump(txns, open('data/cbs_transactions.json', 'w'), indent=2)
    print(f"\nAdded {len(new_txns)} synthetic transactions. Total: {len(txns)}")
else:
    print("No missing transactions found!")

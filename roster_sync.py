#!/usr/bin/env python3
"""Compare CBS rosters with cbs_transactions.json and generate missing Add/Drop transactions.

Usage: python3 roster_sync.py
Reads: cbs_rosters.json, data/cbs_transactions.json
Writes: Updated data/cbs_transactions.json with synthetic transactions
"""
import json, sys
from datetime import datetime

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

# Reverse map: team_id -> team_name (first match)
TEAM_ID_TO_NAME = {}
for name, tid in CBS_TEAM_IDS.items():
    if tid not in TEAM_ID_TO_NAME:
        TEAM_ID_TO_NAME[tid] = name

cbs_rosters = json.load(open('cbs_rosters.json'))
txns = json.load(open('data/cbs_transactions.json'))

def parse_date(s):
    s = s.replace('\u00a0', ' ').replace(' ET', '').strip()
    for fmt in ('%m/%d/%y %I:%M %p', '%m/%d/%y'):
        try:
            return datetime.strptime(s, fmt)
        except:
            pass
    return datetime.min

# Sort transactions by date
txns_sorted = sorted(txns, key=lambda t: parse_date(t['date']))

# Track last action per player
player_last_action = {}  # name -> (action, teamId, date)
for txn in txns_sorted:
    team_id = str(txn.get('teamId', ''))
    for p in txn.get('players', []):
        name = p.get('name', '')
        if not name:
            continue
        action = p.get('action', '')
        player_last_action[name] = (action, team_id, txn['date'])

# Build set of all players currently on CBS rosters
rostered_players = set()
roster_team = {}  # player_name -> team_name
for team_name, players in cbs_rosters.items():
    for player_name in players:
        rostered_players.add(player_name)
        roster_team[player_name] = team_name

from datetime import date as dt_date
TODAY = dt_date.today().strftime('%-m/%-d/%y') + ' 12:00 AM ET'
SYNTHETIC_ADD_DATE = '4/3/26 12:00 AM ET'

new_txns = []

# --- MISSING ADDS: player is on CBS roster but last transaction says Dropped ---
for team_name, players in cbs_rosters.items():
    team_id = CBS_TEAM_IDS.get(team_name, '')
    for player_name in players:
        last = player_last_action.get(player_name)
        if last:
            action, last_team, last_date = last
            if action == 'Dropped':
                new_txns.append({
                    'date': SYNTHETIC_ADD_DATE,
                    'teamId': team_id,
                    'team': team_name,
                    'players': [{'name': player_name, 'action': 'Added', 'synthetic': True}]
                })
                print(f"  MISSING ADD: {player_name} → {team_name} (was Dropped on {last_date})")
            elif action in ('Added', 'Added off Waivers') and str(last_team) != str(team_id):
                new_txns.append({
                    'date': SYNTHETIC_ADD_DATE,
                    'teamId': team_id,
                    'team': team_name,
                    'players': [{'name': player_name, 'action': 'Added', 'synthetic': True}]
                })
                print(f"  WRONG TEAM: {player_name} → {team_name} (was on team {last_team})")

# --- MISSING DROPS: player's last action was Add but they're not on any CBS roster ---
ADD_ACTIONS = {'added', 'added off waivers', 'activated'}
for player_name, (action, team_id, last_date) in player_last_action.items():
    if action.lower() in ADD_ACTIONS and player_name not in rostered_players:
        team_name = TEAM_ID_TO_NAME.get(str(team_id), f'Team {team_id}')
        new_txns.append({
            'date': TODAY,
            'teamId': team_id,
            'team': team_name,
            'players': [{'name': player_name, 'action': 'Dropped', 'synthetic': True}]
        })
        print(f"  MISSING DROP: {player_name} from {team_name} (last seen: {action} on {last_date})")

if new_txns:
    txns.extend(new_txns)
    txns.sort(key=lambda t: parse_date(t['date']), reverse=True)
    json.dump(txns, open('data/cbs_transactions.json', 'w'), indent=2)
    print(f"\nAdded {len(new_txns)} synthetic transactions. Total: {len(txns)}")
else:
    print("No missing transactions found!")

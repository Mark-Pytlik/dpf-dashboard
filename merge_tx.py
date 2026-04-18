#!/usr/bin/env python3
"""Merge new CBS transactions into data/cbs_transactions.json without losing history.

Usage:
  python3 merge_tx.py new_transactions.json          # merge from file
  echo '[...]' | python3 merge_tx.py -                # merge from stdin

The script deduplicates by (date, teamId, player names) and sorts by date ascending.
Team names are unstable in CBS (users rename their teams mid-season), so the stable
team identifier is teamId. If a record lacks teamId, we fall back to a normalized
team-name key so legacy exports still dedup correctly.
It NEVER overwrites — it only adds transactions that don't already exist.
"""
import json, sys
from datetime import datetime

# CBS team ID mapping (verified from CBS dropdown April 2026)
TEAM_IDS = {
    "Weird Fishes / Arrighetti": 1,
    "Dinosaur Jr Caminero": 2,
    "Colonel Corbin's Ascent": 3,
    "Okamotomami": 4,
    "Buddy Buddy Buddy All On Base": 5,
    "A Pete Crow-Armstrong Looked at Me": 6,
    "Whoop Whoop that's the sound of Dylan Cease": 7,
    "Ballesteros, Let the Rhythm Take You Over": 8,
    "Yesavage Garden": 9,
    "Blame it on the Rainiel": 10,
    "Before and After Shohei": 11,
    "Popped A Mahle I'm Sweating": 12,
}

def normalize_date(d):
    """Normalize date string by replacing non-breaking spaces with regular spaces."""
    return d.replace('\u00a0', ' ').replace('\xa0', ' ').strip() if d else ''

def tx_key(tx):
    """Unique key for deduplication.

    Prefer teamId because CBS team names are unstable (owners rename frequently).
    If teamId is missing (older exports), fall back to a lowercased team-name hash
    so the key still dedups cleanly across the two formats.
    """
    players = ",".join(sorted(p["name"] for p in tx.get("players", [])))
    date = normalize_date(tx.get("date", ""))
    team_id = str(tx.get("teamId") or "").strip()
    if team_id:
        team_key = f"id:{team_id}"
    else:
        team_name = (tx.get("teamName") or tx.get("team") or "").strip().lower()
        team_key = f"name:{team_name}"
    return (date, team_key, players)

def parse_date(d):
    try:
        return datetime.strptime(d.replace(" ET", ""), "%m/%d/%y %I:%M %p")
    except Exception:
        return datetime.min

def merge(new_txs, filepath="data/cbs_transactions.json"):
    # Load existing
    try:
        with open(filepath) as f:
            existing = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        existing = []

    existing_keys = set(tx_key(tx) for tx in existing)

    # Add teamId if missing, then merge
    added = 0
    for tx in new_txs:
        if "teamId" not in tx:
            candidate = tx.get("team") or tx.get("teamName")
            if candidate in TEAM_IDS:
                tx["teamId"] = str(TEAM_IDS[candidate])
        k = tx_key(tx)
        if k not in existing_keys:
            existing.append(tx)
            existing_keys.add(k)
            added += 1

    # Sort by date ascending
    existing.sort(key=lambda x: parse_date(x.get("date", "")))

    with open(filepath, "w") as f:
        json.dump(existing, f, indent=2)

    print(f"Merged: {added} new, {len(existing)} total")
    return added, len(existing)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 merge_tx.py <new_transactions.json | ->")
        sys.exit(1)

    src = sys.argv[1]
    if src == "-":
        new_txs = json.load(sys.stdin)
    else:
        with open(src) as f:
            new_txs = json.load(f)

    merge(new_txs)

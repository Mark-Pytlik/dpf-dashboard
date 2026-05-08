#!/usr/bin/env python3
"""Merge new CBS transactions into data/cbs_transactions.json without losing history.

Usage:
  python3 merge_tx.py new_transactions.json          # merge from file
  echo '[...]' | python3 merge_tx.py -                # merge from stdin

After the raw append+dedup pass, this runs tools/clean_transactions.py to
collapse partial/duplicate scraper rows into canonical per-transaction
entries. That keeps the file safe to consume by the dashboard even when the
scraper emits inconsistent rows (mojibake team names, partial player lists,
int-vs-str teamId, multiple passes of the same trade, etc).
"""
import json
import os
import subprocess
import sys
from datetime import datetime

TEAM_IDS = {
    "Weird Fishes / Arrighetti": 1,
    "Dinosaur Jr Caminero": 2,
    "Colonel Corbin's Ascent": 3,
    "Okamotomami": 4,
    "Buddy Buddy Buddy All On Base": 5,
    "A Pete Crow-Armstrong Looked at Me": 6,
    "Whoop Whoop that's the sound of Dylan Cease": 7,
    "Everythings McGonigle Green": 7,
    "Ballesteros, Let the Rhythm Take You Over": 8,
    "Yesavage Garden": 9,
    "Blame it on the Rainiel": 10,
    "Before and After Shohei": 11,
    "Popped A Mahle I'm Sweating": 12,
}


def normalize_date(d):
    return d.replace('\u00a0', ' ').replace('\xa0', ' ').strip() if d else ''


def tx_key(tx):
    """Best-effort dedup key applied before the heavy consolidation pass.

    Uses teamId when available (normalized to string) and a sorted player-name
    tuple. This catches byte-identical duplicates cheaply; the full cleaner
    handles the semantic (partial-row / mojibake / mis-attributed) cases.
    """
    players = ",".join(sorted((p.get("name") or "").strip() for p in tx.get("players", [])))
    date = normalize_date(tx.get("date", ""))
    raw_id = tx.get("teamId")
    if raw_id not in (None, "", 0, "0"):
        team_key = f"id:{str(raw_id)}"
    else:
        team_name = (tx.get("teamName") or tx.get("team") or "").strip().lower()
        team_key = f"name:{team_name}"
    return (date, team_key, players)


def parse_date(d):
    try:
        return datetime.strptime(d.replace(" ET", ""), "%m/%d/%y %I:%M %p")
    except Exception:
        return datetime.min


def run_cleaner():
    """Run the heavy consolidation pass to collapse scraper duplicates."""
    cleaner = os.path.join(os.path.dirname(__file__), "tools", "clean_transactions.py")
    if not os.path.exists(cleaner):
        print(f"Skipping consolidation pass (missing {cleaner})")
        return
    subprocess.check_call([sys.executable, cleaner])


def merge(new_txs, filepath="data/cbs_transactions.json"):
    try:
        with open(filepath) as f:
            existing = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        existing = []

    existing_keys = set(tx_key(tx) for tx in existing)

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

    existing.sort(key=lambda x: parse_date(x.get("date", "")))

    with open(filepath, "w") as f:
        json.dump(existing, f, indent=2)

    print(f"Merged: {added} new, {len(existing)} total (pre-clean)")

    # Run the deep consolidation pass — collapses scraper-duplicated rows
    # (partial player sets, mojibake team names, int-vs-str teamId, etc.)
    run_cleaner()
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

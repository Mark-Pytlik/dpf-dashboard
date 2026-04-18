#!/usr/bin/env python3
"""Scrape CBS Sports fantasy league pages.

This is the *skeleton* for an end-to-end CBS scraper. The previous workflow
relied on the Claude-in-Chrome MCP doing the scraping interactively at 6am
and 9am — when that pipeline broke (auth, rendered-JS pages, etc.) the
scheduled task silently produced nothing useful. This script consolidates the
three things we currently scrape (transactions, rosters, picks) behind one
CLI so we can run them headlessly OR with a logged-in browser session passed
in via cookie file.

NOTE: CBS pages are rendered server-side enough that requests + BeautifulSoup
can do most of this — but the league is private, so authentication is
mandatory. This script supports two auth modes:
  * --cookies path/to/cookies.json   (Chrome / Firefox export format)
  * --session-token <token>          (raw `pid_session` cookie value)
You must populate one of those before this script will return useful data.

Usage examples:
  python3 scrape_cbs.py transactions --cookies cookies.json
  python3 scrape_cbs.py rosters --cookies cookies.json
  python3 scrape_cbs.py picks --cookies cookies.json
  python3 scrape_cbs.py all --cookies cookies.json   # writes everything

Outputs (under data/):
  cbs_transactions.json   (merged via merge_tx.py)
  cbs_rosters.json        (overwrites)
  cbs_picks_full.json     (overwrites)

The actual HTML parsing is left as TODO in each scraper function — the URL
patterns, team-id list, and orchestration are wired up for you. Follow the
TODOs to plug in real selectors after you've confirmed an authenticated
fetch works.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import time
from typing import Iterable

try:
    import requests  # type: ignore
except ImportError:
    print("requests is required: pip install requests", file=sys.stderr)
    sys.exit(2)

try:
    from bs4 import BeautifulSoup  # type: ignore
except ImportError:
    BeautifulSoup = None  # type: ignore  # we'll fail loudly below if you actually need it


# ── Constants ───────────────────────────────────────────────────────────────
LEAGUE_HOST = "dpf2026.baseball.cbssports.com"
LEAGUE_BASE = f"https://{LEAGUE_HOST}"

# 12 league teams. `id` is CBS's stable team identifier and is the source of
# truth — `name` is whatever each team is currently called on CBS, included
# only for human-readable logging.
TEAMS = [
    {"id": 1,  "name": "Weird Fishes / Arrighetti"},
    {"id": 2,  "name": "Dinosaur Jr Caminero"},
    {"id": 3,  "name": "Colonel Corbin's Ascent"},
    {"id": 4,  "name": "Okamotomami"},
    {"id": 5,  "name": "Buddy Buddy Buddy All On Base"},
    {"id": 6,  "name": "A Pete Crow-Armstrong Looked at Me"},
    {"id": 7,  "name": "Whoop Whoop that's the sound of Dylan Cease"},
    {"id": 8,  "name": "Ballesteros, Let the Rhythm Take You Over"},
    {"id": 9,  "name": "Yesavage Garden"},
    {"id": 10, "name": "Blame it on the Rainiel"},
    {"id": 11, "name": "Before and After Shohei"},
    {"id": 12, "name": "Popped A Mahle I'm Sweating"},
]

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) "
    "Version/17.4 Safari/605.1.15"
)

DATA_DIR = "data"


# ── Auth helpers ────────────────────────────────────────────────────────────
def load_cookies(path: str | None, session_token: str | None) -> dict:
    """Build a cookie jar from either a JSON cookies export or a raw token."""
    if session_token:
        return {"pid_session": session_token}

    if path:
        with open(path) as f:
            raw = json.load(f)
        if isinstance(raw, dict):
            return raw
        # Browser extension exports usually return [{name, value, domain, ...}]
        out = {}
        for c in raw:
            if isinstance(c, dict) and c.get("name") and c.get("value"):
                out[c["name"]] = c["value"]
        return out

    return {}


def make_session(cookies: dict) -> requests.Session:
    s = requests.Session()
    s.headers["User-Agent"] = USER_AGENT
    for k, v in cookies.items():
        s.cookies.set(k, v, domain=LEAGUE_HOST)
    return s


def _check_authed(s: requests.Session) -> bool:
    """A logged-in user gets the league dashboard; an anon user gets a login redirect."""
    r = s.get(f"{LEAGUE_BASE}/", timeout=15, allow_redirects=False)
    if r.status_code in (301, 302, 303, 307, 308):
        loc = r.headers.get("Location", "")
        if "login" in loc.lower():
            return False
    return r.status_code == 200


# ── Scrapers ────────────────────────────────────────────────────────────────
def scrape_transactions(s: requests.Session, teams: Iterable[dict]) -> list[dict]:
    """Hit each team's per-team transaction page and parse rows.

    URL pattern: /transactions/{teamId}/all_but_lineup/
    Per-team pages cap at ~30 rows, so we also fetch the league trades page.
    """
    rows: list[dict] = []
    for t in teams:
        url = f"{LEAGUE_BASE}/transactions/{t['id']}/all_but_lineup/"
        print(f"  GET {url}")
        r = s.get(url, timeout=20)
        if r.status_code != 200:
            print(f"    ! HTTP {r.status_code} for team {t['id']}")
            continue
        # TODO: parse r.text into transaction dicts of shape:
        # {
        #   "date": "4/18/26 6:00 AM ET",
        #   "teamId": t["id"],
        #   "teamName": t["name"],
        #   "players": [{"name": ..., "pos": ..., "mlbTeam": ..., "action": "Added"}],
        #   "effective": "..."
        # }
        # See data/cbs_transactions.json for the exact shape we want to write.
        rows.extend(_parse_transactions_page(r.text, t))
        time.sleep(0.5)  # be polite

    # League trades page (catches multi-team trades the per-team pages drop)
    trades_url = f"{LEAGUE_BASE}/trades/recent"
    print(f"  GET {trades_url}")
    r = s.get(trades_url, timeout=20)
    if r.status_code == 200:
        rows.extend(_parse_trades_page(r.text))
    return rows


def scrape_rosters(s: requests.Session, teams: Iterable[dict]) -> dict[str, list[str]]:
    """Hit each team's roster page and return {team_name: [player_name, ...]}."""
    out: dict[str, list[str]] = {}
    for t in teams:
        url = f"{LEAGUE_BASE}/teams/{t['id']}"
        print(f"  GET {url}")
        r = s.get(url, timeout=20)
        if r.status_code != 200:
            print(f"    ! HTTP {r.status_code} for team {t['id']}")
            continue
        # TODO: parse r.text into a list[str] of player full names.
        out[t["name"]] = _parse_roster_page(r.text, t)
        time.sleep(0.5)
    return out


def scrape_picks(s: requests.Session) -> list[dict]:
    """Pull the league draft results page."""
    url = f"{LEAGUE_BASE}/draft/results"
    print(f"  GET {url}")
    r = s.get(url, timeout=20)
    if r.status_code != 200:
        print(f"  ! HTTP {r.status_code}")
        return []
    # TODO: parse into [{round, pick, overall, teamId, teamName, player, pos, mlbTeam}]
    return _parse_picks_page(r.text)


# ── Parsers (placeholders) ──────────────────────────────────────────────────
def _need_bs4():
    if BeautifulSoup is None:
        print("BeautifulSoup is required for HTML parsing: pip install beautifulsoup4",
              file=sys.stderr)
        sys.exit(2)


def _parse_transactions_page(html: str, team: dict) -> list[dict]:
    _need_bs4()
    # TODO: implement using BeautifulSoup. The Claude-in-Chrome scraper used to
    # walk the table rows on the transactions page; that DOM should be stable
    # in non-JS HTML too. Reference the existing data/cbs_transactions.json
    # to mirror the shape exactly.
    return []


def _parse_trades_page(html: str) -> list[dict]:
    _need_bs4()
    # TODO
    return []


def _parse_roster_page(html: str, team: dict) -> list[str]:
    _need_bs4()
    # TODO
    return []


def _parse_picks_page(html: str) -> list[dict]:
    _need_bs4()
    # TODO
    return []


# ── Outputs ─────────────────────────────────────────────────────────────────
def write_transactions(new_rows: list[dict]):
    """Hand off to merge_tx.py so we don't lose history."""
    if not new_rows:
        print("No new transactions scraped — nothing to merge.")
        return
    tmp = "_scrape_tx_tmp.json"
    with open(tmp, "w") as f:
        json.dump(new_rows, f, indent=2)
    try:
        subprocess.check_call([sys.executable, "merge_tx.py", tmp])
    finally:
        os.remove(tmp)


def write_rosters(rosters: dict[str, list[str]]):
    if not rosters:
        print("No rosters scraped — refusing to overwrite cbs_rosters.json.")
        return
    path = os.path.join(DATA_DIR, "cbs_rosters.json")
    with open(path, "w") as f:
        json.dump(rosters, f, indent=2)
    print(f"Wrote {sum(len(v) for v in rosters.values())} players across {len(rosters)} rosters → {path}")
    # Then reconcile via roster_sync.py for synthetic adds/drops
    subprocess.check_call([sys.executable, "roster_sync.py"])


def write_picks(picks: list[dict]):
    if not picks:
        print("No picks scraped — nothing to write.")
        return
    path = os.path.join(DATA_DIR, "cbs_picks_full.json")
    with open(path, "w") as f:
        json.dump(picks, f, indent=2)
    print(f"Wrote {len(picks)} picks → {path}")


# ── CLI ─────────────────────────────────────────────────────────────────────
def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=["transactions", "rosters", "picks", "all", "check-auth"])
    parser.add_argument("--cookies", help="path to JSON cookies export")
    parser.add_argument("--session-token", help="raw pid_session cookie value")
    parser.add_argument("--skip-merge", action="store_true",
                        help="skip merge_tx + roster_sync after scraping")
    args = parser.parse_args()

    cookies = load_cookies(args.cookies, args.session_token)
    if not cookies:
        print("ERROR: pass --cookies or --session-token (private league requires auth)",
              file=sys.stderr)
        return 2
    s = make_session(cookies)

    if not _check_authed(s):
        print("ERROR: cookies do not look authenticated (got login redirect).",
              file=sys.stderr)
        return 2

    if args.mode == "check-auth":
        print("OK — session is authenticated.")
        return 0

    if args.mode in ("transactions", "all"):
        rows = scrape_transactions(s, TEAMS)
        if not args.skip_merge:
            write_transactions(rows)
    if args.mode in ("rosters", "all"):
        rosters = scrape_rosters(s, TEAMS)
        if not args.skip_merge:
            write_rosters(rosters)
    if args.mode in ("picks", "all"):
        picks = scrape_picks(s)
        if not args.skip_merge:
            write_picks(picks)

    print("\nDone. Now run:  python3 validate.py && python3 build_dashboard.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())

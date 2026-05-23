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
LEAGUE_HOST = "dpf.baseball.cbssports.com"  # was dpf2026, fixed 2026-04-25
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
    """Pull the league-wide transactions page (all teams, all rows).

    The per-team /transactions/{teamId}/all_but_lineup pages are CBS-truncated
    to ~30 rows. The league-wide /transactions?print_rows=9999 returns the
    full log uncapped — use it and REPLACE cbs_transactions.json rather than
    merging with stale data.
    """
    # Include both canonical names and historical aliases from merge_tx.TEAM_IDS
    # (team 7 has been renamed "Everythings McGonigle Green" → "Whoop Whoop..." etc).
    teamid_by_name: dict[str, int] = {t["name"]: t["id"] for t in teams}
    try:
        from merge_tx import TEAM_IDS as _MERGE_IDS  # type: ignore
        for name, tid in _MERGE_IDS.items():
            teamid_by_name.setdefault(name, tid)
    except Exception:
        pass
    url = f"{LEAGUE_BASE}/transactions?print_rows=9999"
    print(f"  GET {url}")
    r = s.get(url, timeout=30)
    if r.status_code != 200:
        print(f"    ! HTTP {r.status_code}")
        return []
    return _parse_transactions_page(r.text, teamid_by_name)


def scrape_rosters(s: requests.Session, teams: Iterable[dict]) -> dict[str, list[str]]:
    """Hit each team's roster page and return {canonical_team_name: [player_name, ...]}."""
    out: dict[str, list[str]] = {}
    for t in teams:
        url = f"{LEAGUE_BASE}/teams/{t['id']}"
        print(f"  GET {url}")
        r = s.get(url, timeout=20)
        if r.status_code != 200:
            print(f"    ! HTTP {r.status_code} for team {t['id']}")
            continue
        canonical, players = _parse_roster_page(r.text, t)
        out[canonical] = players
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


_MOJIBAKE_APOSTROPHE = "â"

def _normalize_text(s: str) -> str:
    if not s:
        return ""
    s = s.replace(_MOJIBAKE_APOSTROPHE, "'").replace("’", "'")
    return re.sub(r"\s+", " ", s).strip()


def _parse_transactions_page(html: str, teamid_by_name: dict[str, int]) -> list[dict]:
    """Parse the league-wide /transactions?print_rows=9999 page.

    Row shape mirrors data/cbs_transactions.json:
        {date, team, teamName, teamId, players:[{name, pos, mlbTeam, action}], effective}
    Rows with class="label" are header dividers and skipped.
    """
    _need_bs4()
    soup = BeautifulSoup(html, "html.parser")
    table = soup.select_one("table.data")
    if table is None:
        return []
    out: list[dict] = []
    # CBS's raw HTML omits explicit <tbody>, so iterate <tr> directly. The
    # header row is class="label" and is filtered below.
    for tr in table.select("tr"):
        if "label" in (tr.get("class") or []):
            continue
        cells = tr.find_all("td", recursive=False)
        if len(cells) < 4:
            continue
        date = _normalize_text(cells[0].get_text(" "))
        team_name = _normalize_text(cells[1].get_text(" "))
        players_cell = cells[2]
        effective = _normalize_text(cells[3].get_text(" "))

        # Split by <br> — BeautifulSoup gives us the html string to slice
        html_chunk = players_cell.decode_contents()
        blocks = re.split(r"<br\s*/?>", html_chunk, flags=re.IGNORECASE)

        players: list[dict] = []
        for blk in blocks:
            piece = BeautifulSoup(blk, "html.parser")
            name_a = piece.select_one("a.playerLink")
            if name_a is None:
                continue
            name = _normalize_text(name_a.get_text(" "))
            pos_span = piece.select_one("span.playerPositionAndTeam")
            pos = mlb_team = ""
            if pos_span is not None:
                parts = [p.strip() for p in _normalize_text(pos_span.get_text(" ")).split("•")]
                pos = parts[0] if parts else ""
                mlb_team = parts[1] if len(parts) > 1 else ""
            text = _normalize_text(piece.get_text(" "))
            # Action follows the last " - " separator (e.g. "Ha-seong Kim SS • ATL - Dropped")
            action = ""
            sep = " - "
            idx = text.rfind(sep) if mlb_team else -1
            if idx > -1:
                action = _normalize_text(text[idx + len(sep):])
            else:
                m = re.search(r"-\s*(.+)$", text)
                if m:
                    action = _normalize_text(m.group(1))
            players.append({"name": name, "pos": pos, "mlbTeam": mlb_team, "action": action})

        team_id = teamid_by_name.get(team_name)
        row = {
            "date": date,
            "team": team_name,
            "teamName": team_name,
            "players": players,
            "effective": effective,
        }
        if team_id is not None:
            row["teamId"] = str(team_id)
        out.append(row)
    return out


def _parse_trades_page(html: str) -> list[dict]:
    # The league-wide print-all transactions page already includes trade rows,
    # so we no longer scrape a separate trades feed. Kept for backwards-compat.
    return []


def _parse_roster_page(html: str, team: dict) -> tuple[str, list[str]]:
    """Return (canonical_team_name, [player_name, ...]) from /teams/{id}.

    The roster page has a single table.data; players are anchors with
    class="playerLink". Canonical team name comes from the team-picker
    <select>'s matching option (text is "<Team Name> (<Owner>)").
    """
    _need_bs4()
    soup = BeautifulSoup(html, "html.parser")

    # Canonical team name from the team-picker dropdown
    canonical = team["name"]
    target_value = f"/teams/{team['id']}"
    for opt in soup.select("select option"):
        if (opt.get("value") or "").rstrip("/") == target_value.rstrip("/"):
            txt = _normalize_text(opt.get_text(" "))
            canonical = re.sub(r"\s*\([^)]*\)\s*$", "", txt).strip() or canonical
            break

    seen: set[str] = set()
    players: list[str] = []
    table = soup.select_one("table.data")
    if table is not None:
        for a in table.select("a.playerLink"):
            n = _normalize_text(a.get_text(" "))
            if n and n not in seen:
                seen.add(n)
                players.append(n)
    return canonical, players


def _parse_picks_page(html: str) -> list[dict]:
    # Picks rarely change after the draft completes, and the existing
    # data/cbs_picks_full.json uses a draft-slot teamId that doesn't match
    # the CBS team-id mapping. Leave this as a no-op — the daily refresh
    # doesn't need draft picks, and the freshness gate only checks
    # transactions + last_daily_run.
    return []


# ── Outputs ─────────────────────────────────────────────────────────────────
def write_transactions(new_rows: list[dict]):
    """REPLACE data/cbs_transactions.json, then invoke merge_tx cleaner-only pass.

    The league-wide print-all URL returns the full uncapped log, so we
    overwrite instead of merging — that avoids the phantom-row bug where
    stale per-team scrapes leak through merge_tx forever.
    """
    if not new_rows:
        print("No transactions scraped — refusing to overwrite cbs_transactions.json.")
        return
    path = os.path.join(DATA_DIR, "cbs_transactions.json")
    with open(path, "w") as f:
        json.dump(new_rows, f, indent=2, ensure_ascii=False)
    print(f"Wrote {len(new_rows)} transactions → {path}")
    # Cleaner-only pass via merge_tx (consumes empty stdin → no merge, just clean)
    subprocess.run(
        [sys.executable, "merge_tx.py", "-"],
        input=b"[]",
        check=True,
    )


def write_rosters(rosters: dict[str, list[str]]):
    if not rosters:
        print("No rosters scraped — refusing to overwrite cbs_rosters.json.")
        return
    path = os.path.join(DATA_DIR, "cbs_rosters.json")
    with open(path, "w") as f:
        json.dump(rosters, f, indent=2, ensure_ascii=False)
    print(f"Wrote {sum(len(v) for v in rosters.values())} players across {len(rosters)} rosters → {path}")
    # roster_sync.py is intentionally skipped — it existed to backfill synthetic
    # adds for the per-team page's 30-row cap. The print-all transactions URL
    # is uncapped, so the synthetic adds are no longer needed and they create
    # phantom-add bugs.


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

    # Write status marker so validate.py's freshness gate stays happy
    _write_run_marker()

    print("\nDone. Now run:  python3 validate.py && python3 build_dashboard.py")
    return 0


def _write_run_marker():
    import datetime as _dt
    marker = {
        "completedAt": _dt.datetime.now(_dt.timezone.utc).isoformat().replace("+00:00", "Z"),
        "phaseA": {"stats": "skipped", "injuries": "skipped", "news": "skipped"},
        "phaseB": {"cbs_auth": "ok", "transactions": "ok", "rosters": "ok", "matchup": "skipped"},
        "notes": ["scrape_cbs.py headless run (cookies-based)"],
    }
    path = os.path.join(DATA_DIR, "last_daily_run.json")
    with open(path, "w") as f:
        json.dump(marker, f, indent=2)
    print(f"Wrote run marker → {path}")


if __name__ == "__main__":
    sys.exit(main())

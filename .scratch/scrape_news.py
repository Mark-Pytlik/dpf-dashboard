#!/usr/bin/env python3
"""Scrape CBS fantasy baseball player news pages 1-5 -> data/player_news.json"""
import json, re, sys, urllib.request
from pathlib import Path
from bs4 import BeautifulSoup

REPO_DIR = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", errors="replace")

def strip_ads(soup_node):
    for sel in ["[data-shortcode]", "[data-mtech-prt-component]", "script", "style"]:
        for el in soup_node.select(sel):
            el.decompose()

def parse_item(li):
    desc = li.select_one("div.player-news-desc")
    if not desc:
        return None
    eyebrow = desc.select_one("time.eyebrow") or desc.select_one(".eyebrow")
    time_text = eyebrow.get_text(" ", strip=True) if eyebrow else ""
    h4a = desc.select_one("h4 a")
    headline = h4a.get_text(" ", strip=True) if h4a else ""
    url = h4a.get("href", "") if h4a else ""
    if url and url.startswith("/"):
        url = "https://www.cbssports.com" + url

    # players-annotated is sibling in the same <li>, not inside .player-news-desc
    pa_block = li.select_one(".players-annotated")
    player = ""
    pos_team = ""
    if pa_block:
        a = pa_block.select_one("p > a")
        if a:
            player = a.get_text(" ", strip=True)
        span = pa_block.select_one("p > span")
        if span:
            pos_team = span.get_text(" ", strip=True)

    pos = ""
    team = ""
    if pos_team:
        parts = [p.strip() for p in re.split(r"[|•]", pos_team) if p.strip()]
        if len(parts) >= 2:
            pos, team = parts[0], parts[1]
        elif len(parts) == 1:
            pos = parts[0]

    body_block = desc.select_one(".latest-updates") or desc
    # Operate on a clone so we don't mutate the live DOM
    body_clone = BeautifulSoup(str(body_block), "lxml")
    strip_ads(body_clone)
    paragraphs = [p.get_text(" ", strip=True) for p in body_clone.select("p")]
    paragraphs = [p for p in paragraphs if p and not p.startswith("Advertisement")]
    body = "\n\n".join(paragraphs)

    return {
        "time": time_text,
        "headline": headline,
        "url": url,
        "player": player,
        "pos": pos,
        "team": team,
        "body": body,
    }

def main():
    all_items = []
    seen = set()
    for n in range(1, 6):
        url = f"https://www.cbssports.com/fantasy/baseball/players/news/all/both/{n}/"
        try:
            html = fetch(url)
        except Exception as e:
            print(f"Page {n} fetch error: {e}", file=sys.stderr)
            continue
        soup = BeautifulSoup(html, "lxml")
        page_items = 0
        for li in soup.select("li"):
            if not li.select_one("div.player-news-desc"):
                continue
            item = parse_item(li)
            if not item or not item.get("headline"):
                continue
            key = (item.get("headline"), item.get("time"), item.get("player"))
            if key in seen:
                continue
            seen.add(key)
            all_items.append(item)
            page_items += 1
        print(f"Page {n}: {page_items} items")
    out = REPO_DIR / "data" / "player_news.json"
    out.write_text(json.dumps(all_items, indent=2) + "\n")
    print(f"Wrote {len(all_items)} news items to {out}")

if __name__ == "__main__":
    main()

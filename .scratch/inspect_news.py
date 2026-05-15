#!/usr/bin/env python3
import urllib.request
from bs4 import BeautifulSoup
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
req = urllib.request.Request("https://www.cbssports.com/fantasy/baseball/players/news/all/both/1/", headers={"User-Agent": UA})
html = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", errors="replace")
soup = BeautifulSoup(html, "lxml")
items = soup.select("li")
for li in items:
    desc = li.select_one("div.player-news-desc")
    if not desc:
        continue
    print("---ITEM---")
    print(str(desc)[:2000])
    print()
    break

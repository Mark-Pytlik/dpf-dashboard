import json, sys

# Team ID mapping
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

# New scraped transactions (page 1 from CBS)
new_txs = [
    {"date":"3/29/26 11:29 PM ET","team":"Buddy Buddy Buddy All On Base","effective":"3/30/26","players":[{"name":"Royce Lewis","pos":"3B","action":"Added","mlbTeam":"MIN"}]},
    {"date":"3/29/26 10:21 PM ET","team":"Before and After Shohei","effective":"3/30/26","players":[{"name":"Emerson Hancock","pos":"SP","action":"Added","mlbTeam":"SEA"},{"name":"Jacob Latz","pos":"SP,RP","action":"Dropped","mlbTeam":"TEX"}]},
    {"date":"3/28/26 10:59 PM ET","team":"Colonel Corbin's Ascent","effective":"3/29/26","players":[{"name":"Erik Sabrowski","pos":"RP","action":"Added","mlbTeam":"CLE"},{"name":"Carlos Estevez","pos":"RP","action":"Dropped","mlbTeam":"KC"}]},
    {"date":"3/27/26 3:15 PM ET","team":"Before and After Shohei","effective":"3/27/26","players":[{"name":"George Lombard","pos":"SS","action":"Added","mlbTeam":"NYY"}]},
    {"date":"3/27/26 3:12 PM ET","team":"Before and After Shohei","effective":"3/27/26","players":[{"name":"Tanner McDougal","pos":"SP","action":"Added","mlbTeam":"CHW"}]},
    {"date":"3/27/26 3:10 PM ET","team":"Before and After Shohei","effective":"3/27/26","players":[{"name":"Jordan Romano","pos":"RP","action":"Added","mlbTeam":"LAA"},{"name":"Louie Varland","pos":"RP","action":"Dropped","mlbTeam":"TOR"}]},
    {"date":"3/27/26 9:34 AM ET","team":"Whoop Whoop that's the sound of Dylan Cease","effective":"3/27/26","players":[{"name":"Javier Assad","pos":"SP","action":"Dropped","mlbTeam":"CHC"}]},
    {"date":"3/27/26 2:43 AM ET","team":"Whoop Whoop that's the sound of Dylan Cease","effective":"3/27/26","players":[{"name":"Javier Assad","pos":"SP","action":"Added off Waivers","mlbTeam":"CHC"}]},
    {"date":"3/26/26 11:24 AM ET","team":"Colonel Corbin's Ascent","effective":"3/26/26","players":[{"name":"A.J. Minter","pos":"RP","action":"Dropped","mlbTeam":"NYM"}]},
    {"date":"3/26/26 7:32 AM ET","team":"A Pete Crow-Armstrong Looked at Me","effective":"3/26/26","players":[{"name":"Tyler Mahle","pos":"SP","action":"Added","mlbTeam":"SF"}]},
    {"date":"3/25/26 10:46 PM ET","team":"Popped A Mahle I'm Sweating","effective":"3/26/26","players":[{"name":"Carson Williams","pos":"SS","action":"Added","mlbTeam":"TB"}]},
    {"date":"3/25/26 2:58 PM ET","team":"Weird Fishes / Arrighetti","effective":"3/25/26","players":[{"name":"Jose Alvarado","pos":"RP","action":"Added","mlbTeam":"PHI"},{"name":"Gabe Speier","pos":"RP","action":"Dropped","mlbTeam":"SEA"}]},
    {"date":"3/25/26 2:55 PM ET","team":"Colonel Corbin's Ascent","effective":"3/25/26","players":[{"name":"A.J. Minter","pos":"RP","action":"Added","mlbTeam":"NYM"}]},
    {"date":"3/25/26 2:55 PM ET","team":"Colonel Corbin's Ascent","effective":"3/25/26","players":[{"name":"Andrew Kittredge","pos":"RP","action":"Added","mlbTeam":"BAL"}]},
    {"date":"3/25/26 2:52 PM ET","team":"Whoop Whoop that's the sound of Dylan Cease","effective":"3/25/26","players":[{"name":"Ryan Zeferjahn","pos":"RP","action":"Added","mlbTeam":"LAA"}]},
    {"date":"3/25/26 2:52 PM ET","team":"Dinosaur Jr Caminero","effective":"3/25/26","players":[{"name":"Jorge Polanco","pos":"2B","action":"Added","mlbTeam":"NYM"},{"name":"Brayan Bello","pos":"SP","action":"Dropped","mlbTeam":"BOS"}]},
    {"date":"3/25/26 2:51 PM ET","team":"Whoop Whoop that's the sound of Dylan Cease","effective":"3/25/26","players":[{"name":"Yusei Kikuchi","pos":"SP","action":"Added","mlbTeam":"LAA"}]},
    {"date":"3/25/26 2:51 PM ET","team":"Dinosaur Jr Caminero","effective":"3/25/26","players":[{"name":"Orion Kerkering","pos":"RP","action":"Dropped","mlbTeam":"PHI"}]},
    {"date":"3/25/26 2:50 PM ET","team":"Before and After Shohei","effective":"3/25/26","players":[{"name":"Jack Dreyer","pos":"SP,RP","action":"Dropped","mlbTeam":"LAD"}]},
    {"date":"3/25/26 2:48 PM ET","team":"Whoop Whoop that's the sound of Dylan Cease","effective":"3/25/26","players":[{"name":"Mike Soroka","pos":"SP","action":"Added","mlbTeam":"ARI"}]},
    {"date":"3/25/26 2:24 PM ET","team":"Yesavage Garden","effective":"3/25/26","players":[{"name":"Dylan Lee","pos":"RP","action":"Dropped","mlbTeam":"ATL"}]},
    {"date":"3/25/26 1:37 PM ET","team":"Popped A Mahle I'm Sweating","effective":"3/25/26","players":[{"name":"Chris Martin","pos":"RP","action":"Added","mlbTeam":"TEX"}]},
    {"date":"3/25/26 9:20 AM ET","team":"Whoop Whoop that's the sound of Dylan Cease","effective":"3/25/26","players":[{"name":"Trent Grisham","pos":"CF","action":"Added","mlbTeam":"NYY"},{"name":"Andrew Benintendi","pos":"LF","action":"Dropped","mlbTeam":"CHW"}]},
    {"date":"3/25/26 9:18 AM ET","team":"Whoop Whoop that's the sound of Dylan Cease","effective":"3/25/26","players":[{"name":"Andrew Benintendi","pos":"LF","action":"Added","mlbTeam":"CHW"},{"name":"Andrew Vaughn","pos":"1B","action":"Dropped","mlbTeam":"MIL"}]},
    {"date":"3/25/26 9:04 AM ET","team":"Yesavage Garden","effective":"3/25/26","players":[{"name":"Ha-seong Kim","pos":"SS","action":"Dropped","mlbTeam":"ATL"}]},
    {"date":"3/24/26 12:56 PM ET","team":"Before and After Shohei","effective":"3/25/26","players":[{"name":"Hunter Barco","pos":"RP","action":"Dropped","mlbTeam":"PIT"}]},
    {"date":"3/24/26 12:54 PM ET","team":"Ballesteros, Let the Rhythm Take You Over","effective":"3/25/26","players":[{"name":"Marcelo Mayer","pos":"3B","action":"Dropped","mlbTeam":"BOS"}]},
    {"date":"3/24/26 12:47 PM ET","team":"Ballesteros, Let the Rhythm Take You Over","effective":"3/25/26","players":[{"name":"Jared Koenig","pos":"RP","action":"Added","mlbTeam":"MIL"},{"name":"Jose Ferrer","pos":"RP","action":"Dropped","mlbTeam":"SEA"}]},
    {"date":"3/24/26 12:45 PM ET","team":"Ballesteros, Let the Rhythm Take You Over","effective":"3/25/26","players":[{"name":"Matt Strahm","pos":"RP","action":"Added","mlbTeam":"KC"},{"name":"Edwin Uceta","pos":"RP","action":"Dropped","mlbTeam":"TB"}]},
    {"date":"3/24/26 12:34 PM ET","team":"A Pete Crow-Armstrong Looked at Me","effective":"3/25/26","players":[{"name":"Bryan King","pos":"RP","action":"Added","mlbTeam":"HOU"}]},
]

# Add teamId to each
for tx in new_txs:
    tx["teamId"] = TEAM_IDS.get(tx["team"], 0)

# Load existing
with open("data/cbs_transactions.json") as f:
    existing = json.load(f)

# Create a dedup key for each transaction
def tx_key(tx):
    return (tx["date"], tx["team"], ",".join(p["name"] for p in tx["players"]))

existing_keys = set(tx_key(tx) for tx in existing)

# Find truly new transactions
added = 0
for tx in new_txs:
    k = tx_key(tx)
    if k not in existing_keys:
        existing.insert(0, tx)
        existing_keys.add(k)
        added += 1

# Sort by date descending (most recent first)
from datetime import datetime
def parse_date(d):
    try:
        return datetime.strptime(d.replace(" ET",""), "%m/%d/%y %I:%M %p")
    except:
        return datetime.min

existing.sort(key=lambda x: parse_date(x["date"]), reverse=True)

with open("data/cbs_transactions.json", "w") as f:
    json.dump(existing, f, indent=2)

print(f"Added {added} new transactions. Total: {len(existing)}")

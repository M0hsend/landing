#!/usr/bin/env python3
"""Extract the co-author network from public/data/papers.json for the
coauthor-network widget. Writes public/data/coauthors.json.

    python3 scripts/build_coauthor_graph.py
"""
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "public", "data")
import json, re
from collections import defaultdict

with open(os.path.join(DATA, "papers.json")) as f:
    papers = json.load(f)

# Normalize author names.
# Keys are the *normalized* form (output of normalize() before this map is applied);
# values are the canonical display name. Used to merge initial-only / variant spellings
# of the same person so they don't appear as separate, sometimes disconnected, nodes.
MERGE_MAP = {
    "M Danaie": "Mohsen Danaie",
    "M. Danaie": "Mohsen Danaie",
    "Gianluigi Botton": "Gianluigi A. Botton",
    "G Botton": "Gianluigi A. Botton",
    "GA Botton": "Gianluigi A. Botton",
    "D Mitlin": "David Mitlin",
    "C Ophus": "Colin Ophus",
    "Beniamin Zahiri": "Babak Zahiri",
    "Babak Shalchi Amirkhiz": "Babak Shalchi-Amirkhiz",
    "B. Shalchi Amirkhiz": "Babak Shalchi-Amirkhiz",
    "BS Amirkhiz": "Babak Shalchi-Amirkhiz",
    "Peter Kalisvaart": "W. Peter Kalisvaart",
    "P Kalisvaart": "W. Peter Kalisvaart",
    "WP Kalisvaart": "W. Peter Kalisvaart",
    "Xuehai Tan": "Xuehai Tan",
    "XH Tan": "Xuehai Tan",
    "X Tan": "Xuehai Tan",
    "Christopher Allen": "Christopher S. Allen",
    "Chris Allen": "Christopher S. Allen",
    "CS Allen": "Christopher S. Allen",
    "Angus Kirkland": "Angus I. Kirkland",
    "AI Kirkland": "Angus I. Kirkland",
    "Duncan Johnstone": "Duncan N. Johnstone",
    "DN Johnstone": "Duncan N. Johnstone",
    "Sergio Lozano-Perez": "Sergio Lozano-Perez",
    "Paul Bagot": "Paul A. J. Bagot",
    "PAJ Bagot": "Paul A. J. Bagot",
    "J Huot": "Jacques Huot",
    "H Fritzsche": "Helmut Fritzsche",
    "Keith Butler": "Keith T. Butler",
    "K Butler": "Keith T. Butler",
    "KT Butler": "Keith T. Butler",
    "Bill David": "William I. F. David",
    "WIF David": "William I. F. David",
    "R Matthew Asmussen": "R. Matthew Asmussen",
    "Matthew Asmussen": "R. Matthew Asmussen",
    "RM Asmussen": "R. Matthew Asmussen",
    "David Shoesmith": "David W. Shoesmith",
    "DW Shoesmith": "David W. Shoesmith",
    "JR Kish": "Joseph R. Kish",
    "Joseph Kish": "Joseph R. Kish",
    "JR McDermid": "Joseph R. McDermid",
    "Joseph McDermid": "Joseph R. McDermid",
    "Ushula Tefashe": "Ushula M. Tefashe",
    "UM Tefashe": "Ushula M. Tefashe",
    "Philippe Dauphin-Ducharme": "Philippe Dauphin-Ducharme",
    "PD Ducharme": "Philippe Dauphin-Ducharme",
    "Zachary Cano": "Zachary P. Cano",
    "ZP Cano": "Zachary P. Cano",
    "Susannah Speller": "Susannah C. Speller",
    "SC Speller": "Susannah C. Speller",
    "Chris Grovenor": "Chris R. M. Grovenor",
    "CRM Grovenor": "Chris R. M. Grovenor",
    "Abigail Ackerman": "Abigail K. Ackerman",
    "AK Ackerman": "Abigail K. Ackerman",
    "Benjamin Savitzky": "Benjamin H. Savitzky",
    "BH Savitzky": "Benjamin H. Savitzky",
    "David Hopkinson": "David G. Hopkinson",
    "DG Hopkinson": "David G. Hopkinson",
    "Tiarnan Doherty": "Tiarnan A. S. Doherty",
    "TAS Doherty": "Tiarnan A. S. Doherty",
    "Samuel Stranks": "Samuel D. Stranks",
    "Paul Midgley": "Paul A. Midgley",
    "Phil Bagot": "Paul A. J. Bagot",
    "Robert Matthew Asmussen": "R. Matthew Asmussen",
    "W Peter Kalisvaart": "Peter Kalisvaart",
    "W.P. Kalisvaart": "Peter Kalisvaart",
    "W. Peter Kalisvaart": "Peter Kalisvaart",
    "XueHai Tan": "Xuehai Tan",
    "Ushula Mengesha Tefashe": "Ushula M. Tefashe",
    "Chris R.M. Grovenor": "Chris R. M. Grovenor",
    "C.R.M. Grovenor": "Chris R. M. Grovenor",
    "Mathew Young": "Matthew Young",
    "Ling‐Dong Sun": "Ling-Dong Sun",
    "Ling-dong Sun": "Ling-Dong Sun",
    "Christopher Lin": "Christopher C. H. Lin",
    "Steven Kuznicki": "Steven M. Kuznicki",
    "Michael Moody": "Michael P. Moody",
    "M.P. Moody": "Michael P. Moody",
    "Andy Bridger": "Andrew Bridger",
    "Stephen Donnelly": "Stephen E. Donnelly",
    "William Iliffe": "William R. Iliffe",
}

def normalize(name):
    name = name.strip()
    # Remove trailing periods from initials: "V." -> "V"
    parts = name.split()
    # "T.P." -> "TP", "V." -> "V": initials tokens lose their dots
    parts = [p.replace('.', '') if re.fullmatch(r"(?:[A-Z]\.){1,3}|[A-Z]{1,3}\.?", p) else p for p in parts]
    # Remove single-letter middle initials
    if len(parts) >= 3:
        parts = [p for i, p in enumerate(parts) if i == 0 or i == len(parts)-1 or len(p) > 1]
    result = " ".join(parts)
    # Apply explicit merges
    return MERGE_MAP.get(result, result)

# Automatic merge of initials-only variants ("A.K. Ackerman", "C Allen") into
# the single full-name variant with the same surname and first initial.
import re as _re
def _is_initials(first):
    return bool(_re.fullmatch(r"(?:[A-Z]\.?){1,3}", first))
_all = {}
for _p in papers:
    for _a in _p.get("authors", []):
        _n = normalize(_a)
        _all[_n] = _all.get(_n, 0) + 1
_full_by_key = defaultdict(set)
for _n in _all:
    _parts = _n.split()
    if len(_parts) >= 2 and not _is_initials(_parts[0]):
        _full_by_key[(_parts[0][0].upper(), _parts[-1].lower())].add(_n)
AUTO_MERGE = {}
for _n in _all:
    _parts = _n.split()
    if len(_parts) >= 2 and _is_initials(_parts[0]):
        _c = _full_by_key.get((_parts[0][0].upper(), _parts[-1].lower()), set())
        if len(_c) == 1:
            AUTO_MERGE[_n] = next(iter(_c))
_normalize_base = normalize
def normalize(name):
    _n = _normalize_base(name)
    return AUTO_MERGE.get(_n, _n)
print(f"auto-merged {len(AUTO_MERGE)} initials-only names")

# Count co-authorships
pair_counts = defaultdict(int)  # (a, b) -> count
author_papers = defaultdict(int)  # author -> paper count
pi_coauthors = defaultdict(int)  # coauthor -> count with Colin

PI = "Mohsen Danaie"

for paper in papers:
    authors = paper.get("authors", [])
    if not authors:
        continue

    # Normalize
    normed = list(dict.fromkeys(normalize(a) for a in authors))  # dedup preserving order

    for a in normed:
        author_papers[a] += 1

    # Check if the PI is on this paper
    has_pi = any("danaie" in a.lower() for a in normed)

    if has_pi:
        for a in normed:
            if "danaie" not in a.lower():
                pi_coauthors[normalize(a)] += 1

    # Count all pairs
    for i in range(len(normed)):
        for j in range(i+1, len(normed)):
            a, b = normed[i], normed[j]
            key = tuple(sorted([a, b]))
            pair_counts[key] += 1

# Build node list: PI + top N co-authors
MIN_PAPERS = 1  # minimum papers with the PI to be included
top_coauthors = sorted(
    [(name, count) for name, count in pi_coauthors.items() if count >= MIN_PAPERS],
    key=lambda x: -x[1]
)

# Include up to 80 co-authors for readability
MAX_NODES = 500
top_coauthors = top_coauthors[:MAX_NODES-1]

# Build node list
nodes = [{"name": PI, "papers": author_papers.get(PI, len(papers)), "piPapers": len(papers)}]
name_to_id = {PI: 0}

for name, count in top_coauthors:
    nid = len(nodes)
    name_to_id[name] = nid
    nodes.append({
        "name": name,
        "papers": author_papers[name],
        "piPapers": count,
    })

# Build edge list
edges = []
included_names = set(name_to_id.keys())
for (a, b), count in pair_counts.items():
    if a in included_names and b in included_names:
        edges.append({
            "source": name_to_id[a],
            "target": name_to_id[b],
            "weight": count,
        })

# Sort edges by weight for rendering (thin first, thick on top)
edges.sort(key=lambda e: e["weight"])

graph = {"nodes": nodes, "edges": edges}

with open(os.path.join(DATA, "coauthors.json"), "w") as f:
    json.dump(graph, f, indent=2, ensure_ascii=False)

print(f"Nodes: {len(nodes)}")
print(f"Edges: {len(edges)}")
print(f"\nTop 20 co-authors:")
for name, count in top_coauthors[:20]:
    print(f"  {name}: {count} papers")
print(f"\nEdge weight range: {min(e['weight'] for e in edges)} - {max(e['weight'] for e in edges)}")

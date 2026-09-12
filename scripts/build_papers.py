#!/usr/bin/env python3
"""Build public/data/papers.json from a Google Scholar profile paste.

Input: scripts/scholar_raw.txt, the text copied from the Scholar profile page
(title / authors / venue / "Paperpile" / "cites<TAB>year" blocks). Each entry
is looked up on Crossref to recover the DOI, the full author list, and the
journal name; arXiv entries are linked directly. Conference abstracts,
software releases, patents, datasets, and untitled entries are written to
public/data/papers_excluded.json instead of the main list.

    python3 scripts/build_papers.py

Then rebuild the derived files:

    python3 scripts/build_coauthor_graph.py
    python3 scripts/build_papers_hover.py
"""
import difflib, json, os, re, sys, time, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "scripts", "scholar_raw.txt")
OUT = os.path.join(ROOT, "public", "data", "papers.json")
OUT_EXCL = os.path.join(ROOT, "public", "data", "papers_excluded.json")
CACHE = os.path.join(ROOT, "scripts", ".crossref_cache.json")
MAILTO = "cophus@gmail.com"

# Titles Crossref's search does not match well; looked up by hand.
DOI_OVERRIDES = {
    "Characterization of Ordering in A-Site Deficient Perovskite Ca1–xLa2x/3TiO3 Using STEM/EELS":
        "10.1021/acs.inorgchem.6b02087",
    "Atomic-resolution imaging of gold species at organic liquid-solid interfaces":
        "10.1126/science.adw2469",
}

# ---------------------------------------------------------------- parse
def parse(text):
    lines = text.split("\n")
    entries, buf, i = [], [], 0
    while i < len(lines):
        ln = lines[i]
        if ln.strip() == "Paperpile":
            head = [l for l in buf if l.strip()]
            buf = []
            cites = year = None
            if i + 1 < len(lines) and re.fullmatch(r"(\d+\t)?\d{4}", lines[i + 1].strip()):
                parts = lines[i + 1].strip().split("\t")
                year = int(parts[-1])
                cites = int(parts[0]) if len(parts) == 2 else 0
                i += 1
            if head:
                entries.append({
                    "title": head[0].strip(),
                    "authors_short": head[1].strip() if len(head) > 1 else "",
                    "venue": head[2].strip() if len(head) > 2 else "",
                    "cites": cites, "year": year,
                })
        else:
            buf.append(ln)
        i += 1
    return entries

# ------------------------------------------------------------ classify
ABSTRACT_VENUES = [
    "Microsc. Microanal", "Meteoritical Society", "BOOK OF ABSTRACTS",
    "Proceedings", "ABSTRACTS OF PAPERS", "Colloque", "Congress",
    "Acta Crystallographica Section A", "Minerals, Metals and Materials Society",
    "METEORITICS & PLANETARY SCIENCE 60",
]
def classify(e):
    v, t = e["venue"], e["title"]
    if v.startswith("Zenodo") or t.startswith("pyxem/"):
        return "software"
    if "Patent" in v:
        return "patent"
    if t.startswith("Research data supporting") or t.startswith("Cover Feature"):
        return "other"
    if re.match(r"^C\d{3} Journal", t):
        return "other"
    if e["year"] is None:
        return "no-year"
    if v == "" and e["authors_short"] == "M Danaie":
        return "thesis"
    if v == "":
        return "abstract"
    if "Microscopy and Microanalysis" in v and re.search(r"\(S\d\)|, \d{3,4}$|\d{4}-\d{4}$", v):
        # M&M supplement issues are meeting abstracts; the 2017 vol 23(2) paper is not
        if "(S" in v or v.endswith(", 1335") or v.endswith(", 278"):
            return "abstract"
    for key in ABSTRACT_VENUES:
        if key in v:
            return "abstract"
    if v.startswith("arXiv"):
        return "preprint"
    return "journal"

# -------------------------------------------------------------- tags
TAG_RULES = [
    ("Hydrogen Storage", r"hydrogen storage|hydride|hydrogenation|sorption|deuterium|MgH|hydrogen cycling|hydrogen diffusion"),
    ("Corrosion", r"corro|cathodic|breakdown|filament|electrochemical microscopy|scanning electrochemical"),
    ("Magnesium", r"\bMg\b|magnesium|AM50|AZ31"),
    ("Perovskites", r"perovskite|FAPbI|CsPbBr|halide|La2x/3TiO3|La 2X/3"),
    ("4D-STEM", r"4D.?STEM|nanobeam|scanning electron diffraction|electron nanobeam|domain mapping|ACOM"),
    ("Ptychography", r"ptychograph"),
    ("Catalysis", r"cataly|hydrodeoxygenation|CO activation|single site|active.site|hydrogen production|oxidation of ethylene"),
    ("Nanoparticles", r"nanopart|nanocluster|nanoplatelet|nanocrystal|carbon dots|single-layer metal cluster"),
    ("Superconductors", r"superconduct|YBa2Cu3|Yttrium Barium"),
    ("Irradiation", r"irradiation|radiation damage|neutron|beam damage|beam effects"),
    ("Metals & Alloys", r"superalloy|steel|titanium alloy|alpha formation|nanoscale alpha|grain boundary|carbide|Pt3Sc|Au–Cu|roll-bonding|multilayer|thin film|Al–Mn"),
    ("Energy Materials", r"batter|anode|cathode|capacitor|Li-ion|LNMO|photovoltaic|NbWO"),
    ("Spectroscopy", r"EELS|energy-loss|EDX|X-ray absorption|spectroscopy"),
    ("Atom Probe", r"atom probe|atomic scale characterisation|correlative"),
    ("In Situ", r"in.situ|dynamics|dehydration|annealing"),
    ("Machine Learning", r"autoencoder|clustering|machine learning|ML algorithms|Bayesian|data science|automated|multivariate"),
    ("Low Dose", r"low.dose|beam.sensitive|pharmaceutical|theophylline|hydrate"),
    ("Planetary Science", r"chondrite|serpentine|meteorit"),
    ("Quantum", r"quantum circuit|quantum"),
    ("Porous Materials", r"zeolite|chabazite|metal.organic framework|MOF|ETS-10|layered double"),
    ("Crystallography", r"twin|ordering|cation ordering|crystallographic|lattice distortion|structure"),
]
def tags_for(title, journal):
    hay = title + " " + journal
    out = [t for t, rx in TAG_RULES if re.search(rx, hay, re.I)]
    return out[:4] or ["Electron Microscopy"]

# ---------------------------------------------------------- crossref
cache = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
def norm(s):
    s = re.sub(r"[‐‑–—\-]", " ", s.lower())
    return re.sub(r"[^a-z0-9 ]", "", s)
def fetch_doi(doi):
    """One Crossref record by DOI."""
    try:
        req = urllib.request.Request(
            "https://api.crossref.org/works/" + urllib.parse.quote(doi),
            headers={"User-Agent": "mohsen-site-builder (mailto:%s)" % MAILTO})
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode())["message"]
    except Exception as ex:
        print("  crossref doi error:", ex, file=sys.stderr)
        return None


def crossref(e):
    key = e["title"]
    if key in cache and cache[key]:
        return cache[key]
    if key in DOI_OVERRIDES:
        url = "https://api.crossref.org/works/" + urllib.parse.quote(DOI_OVERRIDES[key])
    else:
        q = urllib.parse.urlencode({"query.bibliographic": e["title"], "rows": 10, "mailto": MAILTO})
        url = "https://api.crossref.org/works?" + q
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "mohsen-site-builder (mailto:%s)" % MAILTO})
        with urllib.request.urlopen(req, timeout=30) as r:
            msg = json.loads(r.read().decode())["message"]
            items = msg["items"] if "items" in msg else [msg]
    except Exception as ex:
        print("  crossref error:", ex, file=sys.stderr)
        return None
    best, best_r, si_doi = None, 0, None
    for it in items:
        # ACS and others register supporting information under the article's own
        # title as a "component" DOI with no author list. Never match those, but
        # remember one: stripping its suffix gives the article's own DOI, which
        # the title search sometimes ranks below its own supplements.
        if it.get("type") == "component" or re.search(r"\.s\d+$", it.get("DOI", "")):
            m = re.match(r"(.+)\.s\d+$", it.get("DOI", ""))
            if m and si_doi is None:
                si_doi = m.group(1)
            continue
        t = (it.get("title") or [""])[0]
        r_ = difflib.SequenceMatcher(None, norm(e["title"]), norm(t)).ratio()
        yr = None
        for k in ("published-print", "published-online", "issued", "created"):
            dp = (it.get(k) or {}).get("date-parts")
            if dp and dp[0] and dp[0][0]:
                yr = dp[0][0]; break
        if e["year"] and yr and abs(yr - e["year"]) > 2:
            r_ -= 0.15
        if it.get("type") in ("posted-content",):
            r_ -= 0.05
        if r_ > best_r:
            best, best_r = it, r_
    if best_r < 0.85 and si_doi:
        parent = fetch_doi(si_doi)
        if parent:
            t = (parent.get("title") or [""])[0]
            r_ = difflib.SequenceMatcher(None, norm(e["title"]), norm(t)).ratio()
            if r_ > best_r:
                best, best_r = parent, r_
    res = None
    if key in DOI_OVERRIDES and items:
        best, best_r = items[0], 1.0
    if best and best_r >= 0.85:
        authors = []
        for a in best.get("author", []):
            nm = (a.get("given", "") + " " + a.get("family", "")).strip() or a.get("name", "")
            if nm:
                authors.append(nm)
        yr = None
        for k in ("published-print", "published-online", "issued"):
            dp = (best.get(k) or {}).get("date-parts")
            if dp and dp[0] and dp[0][0]:
                yr = dp[0][0]; break
        res = {
            "doi": best["DOI"],
            "title": (best.get("title") or [e["title"]])[0],
            "journal": (best.get("container-title") or [""])[0],
            "authors": authors,
            "year": yr,
            "type": best.get("type"),
            "score": round(best_r, 3),
        }
    cache[key] = res
    json.dump(cache, open(CACHE, "w"), ensure_ascii=False, indent=1)
    time.sleep(0.25)
    return res

def arxiv_authors(arxiv_id):
    """Full author list for an arXiv preprint (Scholar truncates it)."""
    key = "arxiv:" + arxiv_id
    if key in cache:
        return cache[key]
    # OpenAlex indexes arXiv's DataCite DOIs; the arXiv API itself rate-limits hard.
    url = ("https://api.openalex.org/works/doi:10.48550/arXiv." + arxiv_id
           + "?mailto=" + MAILTO)
    names = []
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "mohsen-site-builder"})
        with urllib.request.urlopen(req, timeout=30) as r:
            d = json.loads(r.read().decode())
        names = [a["author"]["display_name"] for a in d.get("authorships", [])]
    except Exception as ex:
        print(f"  openalex error ({arxiv_id}):", ex, file=sys.stderr)
    if not names:
        return []          # not cached, so the next run retries
    cache[key] = names
    json.dump(cache, open(CACHE, "w"), ensure_ascii=False, indent=1)
    time.sleep(1.0)
    return names

# ------------------------------------------------------------------ main
def short_authors(s):
    return [a.strip() for a in s.replace(", ...", "").split(",") if a.strip()]

def venue_journal(v):
    return re.sub(r"\s+\d.*$", "", v).strip()

entries = parse(open(RAW).read())
print(f"parsed {len(entries)} entries")
papers, excluded = [], []
for e in entries:
    kind = classify(e)
    if kind not in ("journal", "preprint"):
        excluded.append({**e, "kind": kind})
        continue
    p = {"title": e["title"], "authors": short_authors(e["authors_short"]),
         "journal": venue_journal(e["venue"]), "year": e["year"], "url": "",
         "cites": e["cites"] or 0, "tags": []}
    if kind == "preprint":
        m = re.search(r"arXiv:(\d{4}\.\d{4,5})", e["venue"])
        p["journal"] = "arXiv"
        p["url"] = f"https://arxiv.org/abs/{m.group(1)}" if m else ""
        if m:
            full = arxiv_authors(m.group(1))
            if full:
                p["authors"] = full
        p["tags"] = tags_for(p["title"], "")
        papers.append(p)
        print(f"  preprint  {p['title'][:60]}")
        continue
    cr = crossref(e)
    if cr:
        p["url"] = "https://doi.org/" + cr["doi"]
        if cr["authors"]:
            p["authors"] = cr["authors"]
        if cr["journal"]:
            p["journal"] = cr["journal"]
        if cr["year"]:
            p["year"] = cr["year"]
        print(f"  ok {cr['score']:.2f}  {p['title'][:60]}")
    else:
        # no DOI found: link to a Scholar search for the title instead
        p["url"] = "https://scholar.google.com/scholar?q=" + urllib.parse.quote(p["title"])
        print(f"  NO DOI      {p['title'][:60]}")
    p["tags"] = tags_for(p["title"], p["journal"])
    papers.append(p)

papers.sort(key=lambda p: (-p["year"], -p["cites"]))
json.dump(papers, open(OUT, "w"), ensure_ascii=False, indent=2)
json.dump(excluded, open(OUT_EXCL, "w"), ensure_ascii=False, indent=2)
print(f"\nwrote {OUT}: {len(papers)} papers ({sum(1 for p in papers if p['url'])} with links)")
print(f"wrote {OUT_EXCL}: {len(excluded)} excluded")
from collections import Counter
print("excluded kinds:", Counter(x['kind'] for x in excluded))

# Mohsen Danaie research website

Research website for Mohsen Danaie (ePSIC, Diamond Light Source), built with
[MyST Markdown](https://mystmd.org/) and the book-theme template.

Sections: landing (`index.md`), people, research, publications, github, gallery.
Navigation is the top bar only; the left sidebar is hidden (`hide_toc`).

## Build

```
myst build --html
python3 scripts/patch_theme.py   # flat top-bar search, no dialog
myst build --html                # rebuild with the patched theme
```

For local preview, run `myst start` and run the patch script once the theme
has been downloaded into `_build/templates`.

## Search bar

The stock theme opens search in a modal dialog. `scripts/patch_theme.py`
patches the downloaded theme bundle in `_build/templates` to replace it with
a flat input in the top bar. Re-run it whenever `_build` is cleared. The
deploy workflow runs it between a warm-up build and the real build.

## Publications data

`public/data/` holds the JSON read by the publications page:

- `papers.json`: one entry per paper (`title`, `authors`, `journal`, `year`,
  `url`, `cites`, `tags`).
- `papers_excluded.json`: conference abstracts, software releases, the patent,
  the thesis, and untitled Scholar entries, kept for reference.
- `coauthors.json`: the co-author graph for the network widget.
- `papers_hover.json`: abstracts (and a few figures) for the hover cards,
  keyed by DOI.

To rebuild after editing `scripts/scholar_raw.txt` (a paste of the Google
Scholar profile page) or adding a DOI to `DOI_OVERRIDES` in `build_papers.py`:

```
python3 scripts/build_papers.py          # Crossref + OpenAlex lookups, cached
python3 scripts/build_coauthor_graph.py
python3 scripts/build_papers_hover.py
```

MyST only serves files that are linked from a page, so `publications.md`
links the three JSON files inside a hidden `.msc-data-links` block. MyST
copies them to its static server under hashed names, and the widgets find
those links in the page to resolve their `data_url`.

## Widgets

`widgets/` holds reusable anywidget modules: `person-card.js` (people page),
`paper-list.js` and `coauthor-network.js` (publications page), `gallery.js`
(photo albums), and `section-nav.js` (floating on-this-page navigation).

# Mohsen Danaie research website

Research group website for Mohsen Danaie, built with
[MyST Markdown](https://mystmd.org/) and the book-theme template.

Sections: landing (`index.md`), people, research, publications, github, gallery.

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

## Widgets

`widgets/` holds reusable anywidget modules: `person-card.js` (people page),
`paper-list.js` (publications, reads `data/papers.json`), `gallery.js`
(photo albums from `images/gallery/`), and `section-nav.js` (floating
on-this-page navigation).

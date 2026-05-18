# Ghostline Rush Website

Landing page + playable **Marathon** browser demo for [ghostlinerush.com](https://ghostlinerush.com).

## Local preview

Open `index.html` in a browser, or:

```bash
cd website
python -m http.server 8080
```

Visit http://localhost:8080

## Deploy (GitHub Pages)

Push this folder to [GhostlineRush_website](https://github.com/Yogesh1031/GhostlineRush_website) — `CNAME` points to `ghostlinerush.com`.

## Ads

**Appodeal** is Android/iOS only. The site uses **Google AdSense** (`ca-pub-5372990157898133`) — one ad unit loads **only when a Marathon run ends** (game-over overlay). No banner ads elsewhere.

## Regenerate Android launcher icons (game repo)

```bash
py -3 tools/gen_android_icons.py
```

## Links

- [Google Play](https://play.google.com/store/apps/details?id=com.yogeshgoyal.ghostlinerush)
- [Instagram](https://www.instagram.com/ghostlinerush/)
- [YouTube](https://www.youtube.com/@GhostlineRush)

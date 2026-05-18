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

**Appodeal** runs in the Android app only. For the website:

1. **Google AdSense** (recommended): uncomment the AdSense script in `index.html` and set in `index.html` before `ads.js`:

```html
<script>
  window.GHOSTLINE_ADS = { adsenseClient: 'ca-pub-YOUR_ID' };
</script>
```

2. Or inject your **Appodeal Web** / other network script into `.ad-slot` elements via `js/ads.js`.

## Regenerate Android launcher icons (game repo)

```bash
py -3 tools/gen_android_icons.py
```

## Links

- [Google Play](https://play.google.com/store/apps/details?id=com.yogeshgoyal.ghostlinerush)
- [Instagram](https://www.instagram.com/ghostlinerush/)
- [YouTube](https://www.youtube.com/@GhostlineRush)

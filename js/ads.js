/**
 * Web ad slots for ghostlinerush.com
 *
 * Appodeal SDK is for Android/iOS only — it does not run on static GitHub Pages.
 * Options:
 * 1. Google AdSense (set client id below)
 * 2. Appodeal Web / other network — inject script in index.html ad slots
 *
 * Configure before deploy:
 *   window.GHOSTLINE_ADS = { adsenseClient: 'ca-pub-XXXXXXXX' };
 */
(function () {
  const cfg = window.GHOSTLINE_ADS || {};
  let interstitialShown = false;

  function injectAdsense(slotEl) {
    const client = cfg.adsenseClient;
    if (!client || !slotEl) return;
    slotEl.innerHTML = "";
    const ins = document.createElement("ins");
    ins.className = "adsbygoogle";
    ins.style.display = "block";
    ins.setAttribute("data-ad-client", client);
    ins.setAttribute("data-ad-slot", slotEl.dataset.adSlot || "");
    ins.setAttribute("data-ad-format", slotEl.dataset.adFormat || "auto");
    ins.setAttribute("data-full-width-responsive", "true");
    slotEl.appendChild(ins);
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (_) {}
  }

  function initBanners() {
    document.querySelectorAll(".ad-slot[data-ad-slot]").forEach((el) => {
      if (cfg.adsenseClient) {
        injectAdsense(el);
      } else if (!el.dataset.filled) {
        el.dataset.filled = "1";
        el.innerHTML =
          '<span style="opacity:0.5;font-size:12px">Ad space · Configure GHOSTLINE_ADS.adsenseClient or Appodeal web tag</span>';
      }
    });
  }

  function showInterstitial() {
    if (interstitialShown && !cfg.allowRepeatInterstitial) return;
    interstitialShown = true;
    const el = document.getElementById("ad-interstitial");
    if (!el) return;
    el.classList.add("visible");
    el.style.display = "";
    const close = el.querySelector(".ad-interstitial-close");
    close?.addEventListener("click", () => {
      el.classList.remove("visible");
      el.style.display = "none";
    }, { once: true });
  }

  window.GhostlineAds = {
    init: initBanners,
    showInterstitial,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initBanners);
  } else {
    initBanners();
  }
})();

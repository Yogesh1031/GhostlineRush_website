/**
 * AdSense — shown only when a Marathon run ends (game-over overlay).
 */
(function () {
  const CLIENT = "ca-pub-5372990157898133";
  let loaded = false;

  function showGameOverAd() {
    const slot = document.getElementById("ad-game-over");
    if (!slot || loaded) return;
    loaded = true;
    slot.innerHTML = "";
    const ins = document.createElement("ins");
    ins.className = "adsbygoogle";
    ins.style.display = "block";
    ins.setAttribute("data-ad-client", CLIENT);
    ins.setAttribute("data-ad-slot", "");
    ins.setAttribute("data-ad-format", "auto");
    ins.setAttribute("data-full-width-responsive", "true");
    slot.appendChild(ins);
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (_) {}
  }

  window.GhostlineAds = { showGameOverAd };
})();

/**
 * Ghostline Rush — Marathon web demo
 */
(function () {
  const canvas = document.getElementById("marathon-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const hudOrbs = document.getElementById("hud-orbs");
  const hudTime = document.getElementById("hud-time");
  const hudGhosts = document.getElementById("hud-ghosts");
  const overlay = document.getElementById("game-overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const overlayMsg = document.getElementById("overlay-msg");
  const btnRestart = document.getElementById("btn-restart");
  const btnPlayAgain = document.getElementById("btn-play-again");
  const btnClose = document.getElementById("btn-close-overlay");
  const btnCloseBottom = document.getElementById("btn-close-bottom");
  const touchPad = document.getElementById("touch-pad");

  const SEGMENT_SEC = 8;
  const MAX_GHOSTS = 12;
  const SHIP_SPEED = 105;
  const SHIP_R = 12;
  const GHOST_R = 11;
  const ORB_R = 9;

  let W = 360;
  let H = 360;
  let dpr = 1;

  let pillars = [];
  let state = "ready";
  let ship = { x: 180, y: 180 };
  let dir = { x: 0, y: -1 };
  let orbs = 0;
  let time = 0;
  let segmentT = 0;
  let record = [];
  let ghosts = [];
  let orbList = [];
  let stars = [];
  const keys = {};
  let touchDir = null;
  let ghostWarn = false;

  const BLOCK_KEYS = new Set([
    "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
    "w", "a", "s", "d", "W", "A", "S", "D", " ",
  ]);

  function layoutPillars() {
    pillars = [
      { x: W * 0.32, y: H * 0.48, r: W * 0.06 },
      { x: W * 0.68, y: H * 0.52, r: W * 0.06 },
    ];
  }

  function resize() {
    const panel = canvas.parentElement;
    const max = Math.min(panel ? panel.clientWidth - 8 : 360, 420, window.innerWidth - 24);
    const size = Math.max(280, Math.floor(max));
    W = size;
    H = size;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    layoutPillars();
    if (state === "playing") {
      ship.x = Math.min(ship.x, W - 20);
      ship.y = Math.min(ship.y, H - 20);
    }
  }

  function wrap(v, max) {
    if (v < 0) return v + max;
    if (v >= max) return v - max;
    return v;
  }

  function wrapPos(p) {
    p.x = wrap(p.x, W);
    p.y = wrap(p.y, H);
  }

  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function closeOverlay() {
    hideOverlay();
    state = "ready";
    draw();
  }

  function hideOverlay() {
    if (overlay) {
      overlay.hidden = true;
      overlay.classList.remove("visible");
    }
  }

  function reset() {
    hideOverlay();
    state = "playing";
    ship = { x: W / 2, y: H / 2 };
    dir = { x: 0, y: -1 };
    orbs = 0;
    time = 0;
    segmentT = 0;
    record = [];
    ghosts = [];
    orbList = [];
    ghostWarn = false;
    fillOrbs();
    updateHud();
    canvas.focus({ preventScroll: true });
  }

  function pillarHit(p) {
    for (const col of pillars) {
      if (dist(p, col) < col.r + SHIP_R) return true;
    }
    return false;
  }

  function spawnOrb() {
    for (let i = 0; i < 40; i++) {
      const p = { x: rand(ORB_R + 8, W - ORB_R - 8), y: rand(ORB_R + 8, H - ORB_R - 8) };
      if (pillarHit(p) || dist(p, ship) < 36) continue;
      let ok = true;
      for (const o of orbList) {
        if (dist(p, o) < 24) {
          ok = false;
          break;
        }
      }
      if (ok) {
        orbList.push({ x: p.x, y: p.y, pulse: Math.random() * 6.28 });
        return;
      }
    }
  }

  function fillOrbs() {
    while (orbList.length < 5) spawnOrb();
  }

  function updateHud() {
    if (hudOrbs) hudOrbs.textContent = `ORBS: ${orbs}`;
    if (hudTime) hudTime.textContent = `TIME: ${time.toFixed(1)} s`;
    if (hudGhosts) hudGhosts.textContent = `ECHOES: ${ghosts.length} / ${MAX_GHOSTS}`;
  }

  function gameOver(reason) {
    state = "over";
    if (overlay) {
      overlay.hidden = false;
      overlay.classList.add("visible");
    }
    if (overlayTitle) overlayTitle.textContent = "RUN ENDED";
    if (overlayMsg) {
      overlayMsg.textContent = `${reason} You collected ${orbs} orbs in ${time.toFixed(1)}s.`;
    }
    window.GhostlineAds?.showGameOverAd?.();
  }

  function finalizeSegment() {
    if (record.length < 8) return;
    ghosts.push({
      path: record.map((p) => ({ x: p.x, y: p.y })),
      t: 0,
      duration: SEGMENT_SEC,
    });
    if (ghosts.length > MAX_GHOSTS) ghosts.shift();
    record = [];
    segmentT = 0;
    ghostWarn = false;
  }

  function ghostState(g) {
    const n = g.path.length;
    if (n < 2) return { x: g.path[0]?.x ?? 0, y: g.path[0]?.y ?? 0, angle: 0 };
    const u = (g.t % g.duration) / g.duration;
    const idx = u * (n - 1);
    const i = Math.min(Math.floor(idx), n - 2);
    const f = idx - i;
    const a = g.path[i];
    const b = g.path[i + 1];
    const x = a.x + (b.x - a.x) * f;
    const y = a.y + (b.y - a.y) * f;
    const angle = Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2;
    return { x, y, angle };
  }

  function applyInput() {
    let nd = null;
    if (keys.ArrowRight || keys.d || keys.D) nd = { x: 1, y: 0 };
    else if (keys.ArrowLeft || keys.a || keys.A) nd = { x: -1, y: 0 };
    else if (keys.ArrowDown || keys.s || keys.S) nd = { x: 0, y: 1 };
    else if (keys.ArrowUp || keys.w || keys.W) nd = { x: 0, y: -1 };
    else if (touchDir) nd = touchDir;
    if (nd) dir = nd;
  }

  function update(dt) {
    if (state !== "playing") return;

    time += dt;
    segmentT += dt;
    applyInput();

    ship.x += dir.x * SHIP_SPEED * dt;
    ship.y += dir.y * SHIP_SPEED * dt;
    wrapPos(ship);

    record.push({ x: ship.x, y: ship.y });
    if (record.length > 600) record.shift();

    if (!ghostWarn && segmentT >= SEGMENT_SEC - 2) ghostWarn = true;
    if (segmentT >= SEGMENT_SEC) finalizeSegment();

    for (const g of ghosts) g.t += dt;

    for (let i = orbList.length - 1; i >= 0; i--) {
      const o = orbList[i];
      o.pulse += dt * 4;
      if (dist(ship, o) < ORB_R + SHIP_R) {
        orbs++;
        orbList.splice(i, 1);
        spawnOrb();
      }
    }
    fillOrbs();

    if (pillarHit(ship)) {
      gameOver("You hit a pillar.");
      return;
    }
    for (const g of ghosts) {
      const gs = ghostState(g);
      if (dist(ship, gs) < SHIP_R + GHOST_R) {
        gameOver("You were caught by your own echo.");
        return;
      }
    }

    updateHud();
  }

  function drawShip(x, y, angle, alpha, isPlayer) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(angle);
    if (isPlayer) {
      ctx.shadowColor = "#06b6d4";
      ctx.shadowBlur = 12;
      ctx.fillStyle = "#67e8f9";
    } else {
      ctx.shadowColor = "rgba(100, 150, 255, 0.6)";
      ctx.shadowBlur = 8;
      ctx.fillStyle = "rgba(100, 150, 255, 0.55)";
      ctx.strokeStyle = "rgba(150, 200, 255, 0.7)";
      ctx.lineWidth = 1.5;
    }
    ctx.beginPath();
    ctx.moveTo(0, -13);
    ctx.lineTo(9, 9);
    ctx.lineTo(0, 4);
    ctx.lineTo(-9, 9);
    ctx.closePath();
    ctx.fill();
    if (!isPlayer) ctx.stroke();
    ctx.restore();
  }

  function drawPillar(c) {
    const g = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, c.r);
    g.addColorStop(0, "#9333ea");
    g.addColorStop(0.6, "#6b21a8");
    g.addColorStop(1, "rgba(6, 182, 212, 0.15)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(103, 232, 249, 0.4)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function draw() {
    ctx.fillStyle = "#0f0f1a";
    ctx.fillRect(0, 0, W, H);

    if (stars.length < 50) {
      stars.length = 0;
      for (let i = 0; i < 50; i++) {
        stars.push({ x: Math.random() * W, y: Math.random() * H, s: Math.random() * 1.5 });
      }
    }
    for (const s of stars) {
      ctx.fillStyle = `rgba(200, 220, 255, ${0.12 + s.s * 0.08})`;
      ctx.fillRect(s.x, s.y, s.s, s.s);
    }

    ctx.strokeStyle = "rgba(103, 232, 249, 0.15)";
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

    for (const c of pillars) drawPillar(c);

    for (const o of orbList) {
      const pulse = 0.65 + 0.35 * Math.sin(o.pulse);
      const grd = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, ORB_R);
      grd.addColorStop(0, `rgba(252, 211, 77, ${pulse})`);
      grd.addColorStop(1, "rgba(245, 158, 11, 0)");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(o.x, o.y, ORB_R, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const g of ghosts) {
      const gs = ghostState(g);
      drawShip(gs.x, gs.y, gs.angle, 0.75, false);
    }

    if (state === "playing" || state === "ready") {
      const shipAngle = Math.atan2(dir.y, dir.x) + Math.PI / 2;
      drawShip(ship.x, ship.y, shipAngle, 1, true);
    }

    if (ghostWarn && state === "playing") {
      ctx.fillStyle = "rgba(245, 158, 11, 0.95)";
      ctx.font = `600 ${Math.max(10, W * 0.03)}px Orbitron, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("ECHO INCOMING…", W / 2, W * 0.05 + 12);
    }

    if (state === "ready") {
      ctx.fillStyle = "rgba(15, 15, 26, 0.85)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#f1f5f9";
      ctx.font = `600 ${Math.max(12, W * 0.038)}px Orbitron, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("TAP ● OR SPACE", W / 2, H / 2 - 8);
      ctx.font = `${Math.max(11, W * 0.03)}px Inter, sans-serif`;
      ctx.fillStyle = "#94a3b8";
      ctx.fillText("WASD / arrows / touch pad", W / 2, H / 2 + 14);
    }
  }

  let last = performance.now();
  function loop(now) {
    update(Math.min((now - last) / 1000, 0.05));
    last = now;
    draw();
    requestAnimationFrame(loop);
  }

  function onKeyDown(e) {
    if (BLOCK_KEYS.has(e.key)) e.preventDefault();
    keys[e.key] = true;
    if ((e.key === " " || e.key === "Enter") && (state === "ready" || state === "over")) {
      e.preventDefault();
      reset();
    }
    if (e.key === "Escape" && state === "over") closeOverlay();
  }

  function onKeyUp(e) {
    keys[e.key] = false;
  }

  function setTouchFromBtn(dirName) {
    if (dirName === "none") {
      if (state === "ready" || state === "over") reset();
      return;
    }
    const map = {
      up: { x: 0, y: -1 },
      down: { x: 0, y: 1 },
      left: { x: -1, y: 0 },
      right: { x: 1, y: 0 },
    };
    touchDir = map[dirName] || null;
  }

  if (touchPad) {
    touchPad.querySelectorAll(".touch-btn").forEach((btn) => {
      const dirName = btn.dataset.dir;
      const start = (e) => {
        e.preventDefault();
        if (dirName !== "none") btn.classList.add("active");
        setTouchFromBtn(dirName);
      };
      const end = (e) => {
        e.preventDefault();
        btn.classList.remove("active");
        if (dirName !== "none") touchDir = null;
      };
      btn.addEventListener("pointerdown", start);
      btn.addEventListener("pointerup", end);
      btn.addEventListener("pointercancel", end);
      btn.addEventListener("pointerleave", end);
    });
  }

  canvas.addEventListener("pointerdown", (e) => {
    canvas.focus({ preventScroll: true });
    if (state === "ready" || state === "over") {
      reset();
    }
  });

  document.addEventListener("keydown", onKeyDown, { passive: false });
  document.addEventListener("keyup", onKeyUp);

  btnRestart?.addEventListener("click", reset);
  btnPlayAgain?.addEventListener("click", reset);
  btnClose?.addEventListener("click", closeOverlay);
  btnCloseBottom?.addEventListener("click", closeOverlay);
  overlay?.addEventListener("click", (e) => {
    if (e.target === overlay) closeOverlay();
  });

  window.addEventListener("resize", resize);
  resize();
  requestAnimationFrame(loop);
})();

/**
 * Ghostline Rush — Marathon web demo (matches app: swipe mobile, 1 orb, 8s ghosts)
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

  const ARENA_W = 24.8;
  const ARENA_H = 14.0;
  const SEGMENT_SEC = 8;
  const MAX_GHOSTS = 12;
  const SHIP_SPEED = 105;
  const SHIP_R = 12;
  const GHOST_R = 11;
  const ORB_R = 10;
  const SWIPE_DRAG_MIN = 3.5;
  const SWIPE_RELEASE_MIN = 28;

  const isTouch =
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    window.matchMedia("(hover: none) and (pointer: coarse)").matches;

  let W = 480;
  let H = 270;
  let dpr = 1;

  let pillars = [];
  let state = "ready";
  let ship = { x: 240, y: 135 };
  let dir = { x: 0, y: -1 };
  let swipeDir = null;
  let orbs = 0;
  let time = 0;
  let segmentT = 0;
  let record = [];
  let ghosts = [];
  let currentOrb = null;
  let stars = [];
  const keys = {};
  let ghostWarn = false;
  let pointerId = null;
  let swipeLast = null;
  let swipeStart = null;

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
    const pad = 16;
    const maxW = Math.min(
      panel ? panel.clientWidth - pad : 720,
      720,
      window.innerWidth - pad
    );
    const maxH = Math.min(window.innerHeight * 0.58, 520);
    const aspect = ARENA_H / ARENA_W;
    let w = Math.max(320, Math.floor(maxW));
    let h = Math.floor(w * aspect);
    if (h > maxH) {
      h = Math.floor(maxH);
      w = Math.floor(h / aspect);
    }
    W = w;
    H = h;
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
    swipeDir = null;
    orbs = 0;
    time = 0;
    segmentT = 0;
    record = [];
    ghosts = [];
    currentOrb = null;
    ghostWarn = false;
    ensureOrb();
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
    for (let i = 0; i < 50; i++) {
      const p = { x: rand(ORB_R + 10, W - ORB_R - 10), y: rand(ORB_R + 10, H - ORB_R - 10) };
      if (pillarHit(p) || dist(p, ship) < 40) continue;
      if (currentOrb && dist(p, currentOrb) < 32) continue;
      currentOrb = { x: p.x, y: p.y, pulse: Math.random() * 6.28 };
      return;
    }
  }

  function ensureOrb() {
    if (!currentOrb) spawnOrb();
  }

  function updateHud() {
    if (hudOrbs) hudOrbs.textContent = `ORBS: ${orbs}`;
    if (hudTime) hudTime.textContent = `TIME: ${time.toFixed(1)} s`;
    if (hudGhosts) hudGhosts.textContent = `GHOST: ${ghosts.length} / ${MAX_GHOSTS}`;
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

  function applySwipeDelta(dx, dy) {
    if (Math.abs(dx) > Math.abs(dy)) {
      if (Math.abs(dx) > SWIPE_DRAG_MIN) swipeDir = { x: dx > 0 ? 1 : -1, y: 0 };
    } else if (Math.abs(dy) > SWIPE_DRAG_MIN) {
      swipeDir = { x: 0, y: dy > 0 ? 1 : -1 };
    }
    if (swipeDir) dir = swipeDir;
  }

  function applySwipeRelease(dx, dy) {
    if (Math.abs(dx) < SWIPE_RELEASE_MIN && Math.abs(dy) < SWIPE_RELEASE_MIN) return;
    applySwipeDelta(dx, dy);
  }

  function applyInput() {
    let nd = null;
    if (keys.ArrowRight || keys.d || keys.D) nd = { x: 1, y: 0 };
    else if (keys.ArrowLeft || keys.a || keys.A) nd = { x: -1, y: 0 };
    else if (keys.ArrowDown || keys.s || keys.S) nd = { x: 0, y: 1 };
    else if (keys.ArrowUp || keys.w || keys.W) nd = { x: 0, y: -1 };
    else if (swipeDir) nd = swipeDir;
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

    if (currentOrb) {
      currentOrb.pulse += dt * 4;
      if (dist(ship, currentOrb) < ORB_R + SHIP_R) {
        orbs++;
        currentOrb = null;
        spawnOrb();
      }
    }
    ensureOrb();

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

    if (stars.length < 60) {
      stars.length = 0;
      for (let i = 0; i < 60; i++) {
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

    if (currentOrb) {
      const pulse = 0.65 + 0.35 * Math.sin(currentOrb.pulse);
      const grd = ctx.createRadialGradient(
        currentOrb.x, currentOrb.y, 0,
        currentOrb.x, currentOrb.y, ORB_R * 1.4
      );
      grd.addColorStop(0, `rgba(252, 211, 77, ${pulse})`);
      grd.addColorStop(0.5, `rgba(245, 158, 11, ${pulse * 0.7})`);
      grd.addColorStop(1, "rgba(245, 158, 11, 0)");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(currentOrb.x, currentOrb.y, ORB_R, 0, Math.PI * 2);
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
      ctx.font = `600 ${Math.max(10, W * 0.028)}px Orbitron, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("GHOST INCOMING…", W / 2, 18);
    }

    if (state === "ready") {
      ctx.fillStyle = "rgba(15, 15, 26, 0.85)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#f1f5f9";
      ctx.font = `600 ${Math.max(12, W * 0.032)}px Orbitron, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(isTouch ? "TAP TO START" : "TAP OR SPACE", W / 2, H / 2 - 8);
      ctx.font = `${Math.max(11, W * 0.026)}px Inter, sans-serif`;
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(
        isTouch ? "Swipe to steer" : "WASD or arrow keys",
        W / 2,
        H / 2 + 14
      );
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

  function tryStart(e) {
    if (state === "ready") {
      e.preventDefault();
      reset();
      return true;
    }
    return false;
  }

  canvas.addEventListener(
    "pointerdown",
    (e) => {
      canvas.setPointerCapture(e.pointerId);
      canvas.focus({ preventScroll: true });
      pointerId = e.pointerId;
      swipeStart = { x: e.clientX, y: e.clientY };
      swipeLast = swipeStart;
      if (tryStart(e)) return;
    },
    { passive: false }
  );

  canvas.addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerId !== pointerId || state !== "playing" || !swipeLast) return;
      const dx = e.clientX - swipeLast.x;
      const dy = e.clientY - swipeLast.y;
      swipeLast = { x: e.clientX, y: e.clientY };
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) applySwipeDelta(dx, dy);
      e.preventDefault();
    },
    { passive: false }
  );

  canvas.addEventListener(
    "pointerup",
    (e) => {
      if (e.pointerId !== pointerId) return;
      if (swipeStart && state === "playing") {
        applySwipeRelease(e.clientX - swipeStart.x, e.clientY - swipeStart.y);
      }
      pointerId = null;
      swipeLast = null;
      swipeStart = null;
      e.preventDefault();
    },
    { passive: false }
  );

  canvas.addEventListener("pointercancel", () => {
    pointerId = null;
    swipeLast = null;
    swipeStart = null;
  });

  document.addEventListener("keydown", onKeyDown, { passive: false });
  document.addEventListener("keyup", onKeyUp);

  btnRestart?.addEventListener("click", reset);
  btnPlayAgain?.addEventListener("click", reset);
  btnClose?.addEventListener("click", closeOverlay);
  overlay?.addEventListener("click", (e) => {
    if (e.target === overlay) closeOverlay();
  });

  window.addEventListener("resize", resize);
  resize();
  requestAnimationFrame(loop);
})();

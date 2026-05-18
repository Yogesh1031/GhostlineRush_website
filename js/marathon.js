/**
 * Ghostline Rush — Marathon web demo (top-down, matches core loop).
 * Constant movement · 4-way steer · screen wrap · ghost echo every 8s · 2 pillars · max 12 echoes.
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

  const W = 360;
  const H = 360;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  canvas.style.aspectRatio = "1 / 1";
  ctx.scale(DPR, DPR);

  const SEGMENT_SEC = 8;
  const MAX_GHOSTS = 12;
  const SHIP_SPEED = 105;
  const SHIP_R = 12;
  const GHOST_R = 11;
  const ORB_R = 9;

  const PILLARS = [
    { x: W * 0.32, y: H * 0.48, r: 22 },
    { x: W * 0.68, y: H * 0.52, r: 22 },
  ];

  let state = "ready";
  let ship = { x: W / 2, y: H / 2 };
  let dir = { x: 0, y: -1 };
  let orbs = 0;
  let time = 0;
  let segmentT = 0;
  let record = [];
  let ghosts = [];
  let orbList = [];
  let stars = [];
  let keys = {};
  let touchDir = null;
  let ghostWarn = false;

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

  function reset() {
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
    if (overlay) {
      overlay.classList.remove("visible");
      overlay.hidden = true;
    }
    fillOrbs();
    updateHud();
  }

  function pillarHit(p) {
    for (const col of PILLARS) {
      if (dist(p, col) < col.r + SHIP_R) return true;
    }
    return false;
  }

  function spawnOrb() {
    for (let i = 0; i < 40; i++) {
      const p = { x: rand(ORB_R, W - ORB_R), y: rand(ORB_R, H - ORB_R) };
      if (pillarHit(p) || dist(p, ship) < 40) continue;
      let ok = true;
      for (const o of orbList) {
        if (dist(p, o) < 28) {
          ok = false;
          break;
        }
      }
      if (ok) {
        orbList.push({ ...p, pulse: Math.random() * 6.28 });
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
      overlayMsg.textContent = `${reason} You collected ${orbs} orbs in ${time.toFixed(1)}s. Bank orbs in the app (2× on Sunday).`;
    }
    window.GhostlineAds?.showGameOverAd?.();
  }

  function finalizeSegment() {
    if (record.length < 4) return;
    const path = record.map((p) => ({ x: p.x, y: p.y }));
    ghosts.push({
      path,
      t: 0,
      duration: SEGMENT_SEC,
    });
    if (ghosts.length > MAX_GHOSTS) ghosts.shift();
    record = [];
    segmentT = 0;
    ghostWarn = false;
  }

  function ghostShipPos(g) {
    const n = g.path.length;
    if (n < 2) return g.path[0] || { x: 0, y: 0 };
    const u = (g.t % g.duration) / g.duration;
    const idx = u * (n - 1);
    const i = Math.floor(idx);
    const f = idx - i;
    const a = g.path[i];
    const b = g.path[Math.min(i + 1, n - 1)];
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
  }

  function applyInput() {
    let nd = null;
    if (keys.ArrowRight || keys.d) nd = { x: 1, y: 0 };
    else if (keys.ArrowLeft || keys.a) nd = { x: -1, y: 0 };
    else if (keys.ArrowDown || keys.s) nd = { x: 0, y: 1 };
    else if (keys.ArrowUp || keys.w) nd = { x: 0, y: -1 };
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
    if (record.length > 500) record.shift();

    if (!ghostWarn && segmentT >= SEGMENT_SEC - 2) ghostWarn = true;
    if (segmentT >= SEGMENT_SEC) finalizeSegment();

    for (const g of ghosts) g.t += dt;

    for (const o of orbList) {
      o.pulse += dt * 4;
      if (dist(ship, o) < ORB_R + SHIP_R) {
        orbs++;
        orbList = orbList.filter((x) => x !== o);
        spawnOrb();
      }
    }
    fillOrbs();

    if (pillarHit(ship)) {
      gameOver("You hit a pillar.");
      return;
    }
    for (const g of ghosts) {
      if (dist(ship, ghostShipPos(g)) < SHIP_R + GHOST_R) {
        gameOver("You were caught by your own echo.");
        return;
      }
    }

    updateHud();
  }

  function drawPillar(c) {
    const g = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, c.r);
    g.addColorStop(0, "#9333ea");
    g.addColorStop(0.6, "#6b21a8");
    g.addColorStop(1, "rgba(6, 182, 212, 0.2)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(103, 232, 249, 0.45)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawShip(p, angle, alpha, glow) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, p.y);
    ctx.rotate(angle);
    ctx.fillStyle = glow ? "#67e8f9" : "rgba(100, 150, 255, 0.85)";
    ctx.shadowColor = glow ? "#06b6d4" : "transparent";
    ctx.shadowBlur = glow ? 14 : 0;
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(10, 10);
    ctx.lineTo(0, 5);
    ctx.lineTo(-10, 10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawGhostTrail(g) {
    if (g.path.length < 2) return;
    ctx.strokeStyle = "rgba(100, 150, 255, 0.25)";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(g.path[0].x, g.path[0].y);
    for (let i = 1; i < g.path.length; i++) ctx.lineTo(g.path[i].x, g.path[i].y);
    ctx.stroke();
    const gp = ghostShipPos(g);
    const angle = Math.atan2(
      g.path[Math.min(1, g.path.length - 1)].y - g.path[0].y,
      g.path[Math.min(1, g.path.length - 1)].x - g.path[0].x
    );
    drawShip(gp, angle - Math.PI / 2, 0.7, false);
  }

  function draw() {
    ctx.fillStyle = "#0f0f1a";
    ctx.fillRect(0, 0, W, H);

    if (stars.length < 60) {
      for (let i = 0; i < 60; i++) {
        stars.push({ x: Math.random() * W, y: Math.random() * H, s: Math.random() * 1.5 });
      }
    }
    for (const s of stars) {
      ctx.fillStyle = `rgba(200, 220, 255, ${0.15 + s.s * 0.1})`;
      ctx.fillRect(s.x, s.y, s.s, s.s);
    }

    ctx.strokeStyle = "rgba(103, 232, 249, 0.12)";
    ctx.lineWidth = 1;
    ctx.strokeRect(1, 1, W - 2, H - 2);

    for (const c of PILLARS) drawPillar(c);

    for (const g of ghosts) drawGhostTrail(g);

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

    const shipAngle = Math.atan2(dir.y, dir.x) + Math.PI / 2;
    drawShip(ship, shipAngle, 1, true);

    if (ghostWarn && state === "playing") {
      ctx.fillStyle = "rgba(245, 158, 11, 0.9)";
      ctx.font = "600 11px Orbitron, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("ECHO INCOMING…", W / 2, 18);
    }

    if (state === "ready") {
      ctx.fillStyle = "rgba(15, 15, 26, 0.82)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#f1f5f9";
      ctx.font = "600 14px Orbitron, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("PRESS SPACE TO START", W / 2, H / 2 - 10);
      ctx.font = "12px Inter, sans-serif";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText("Arrows / WASD — ship never stops", W / 2, H / 2 + 12);
    }
  }

  let last = performance.now();
  function loop(now) {
    update(Math.min((now - last) / 1000, 0.05));
    last = now;
    draw();
    requestAnimationFrame(loop);
  }

  window.addEventListener("keydown", (e) => {
    keys[e.key] = true;
    if ((e.key === " " || e.key === "Enter") && (state === "ready" || state === "over")) reset();
  });
  window.addEventListener("keyup", (e) => {
    keys[e.key] = false;
  });

  canvas.addEventListener("pointerdown", (e) => {
    if (state === "ready" || state === "over") {
      reset();
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const y = ((e.clientY - rect.top) / rect.height) * H;
    const dx = x - ship.x;
    const dy = y - ship.y;
    if (Math.abs(dx) > Math.abs(dy)) touchDir = { x: dx > 0 ? 1 : -1, y: 0 };
    else touchDir = { x: 0, y: dy > 0 ? 1 : -1 };
  });
  canvas.addEventListener("pointerup", () => {
    touchDir = null;
  });

  btnRestart?.addEventListener("click", reset);
  btnPlayAgain?.addEventListener("click", reset);

  requestAnimationFrame(loop);
})();

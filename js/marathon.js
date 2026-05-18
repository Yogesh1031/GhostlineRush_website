/**
 * Ghostline Rush — web Marathon demo (simplified endless run).
 * Mirrors app mode: 2 pillars, ghost echoes from your path, orb collection.
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
  const H = 520;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  canvas.style.aspectRatio = `${W} / ${H}`;
  ctx.scale(DPR, DPR);

  const PILLAR_X = [W * 0.28, W * 0.72];
  const PILLAR_W = 36;
  const GHOST_INTERVAL = 5;
  const MAX_GHOSTS = 12;
  const GHOST_POINT_EVERY = 8;

  let state = "ready";
  let shipX = W / 2;
  let shipY = H - 72;
  let velX = 0;
  let scroll = 0;
  let orbs = 0;
  let time = 0;
  let ghosts = [];
  let pathPoints = [];
  let pathTimer = 0;
  let ghostSpawnTimer = 0;
  let orbSprites = [];
  let stars = [];
  let keys = {};
  let touchDir = 0;

  function reset() {
    state = "playing";
    shipX = W / 2;
    shipY = H - 72;
    velX = 0;
    scroll = 0;
    orbs = 0;
    time = 0;
    ghosts = [];
    pathPoints = [];
    pathTimer = 0;
    ghostSpawnTimer = 0;
    orbSprites = [];
    overlay?.classList.remove("visible");
    spawnOrbs();
    updateHud();
  }

  function spawnOrbs() {
    while (orbSprites.length < 6) {
      const leftGap = PILLAR_X[0] - PILLAR_W / 2;
      const rightGap = PILLAR_X[1] + PILLAR_W / 2;
      const x = Math.random() < 0.5
        ? rand(24, leftGap - 20)
        : rand(rightGap + 20, W - 24);
      orbSprites.push({
        x,
        y: -rand(40, H),
        r: 10,
        pulse: Math.random() * Math.PI * 2,
      });
    }
  }

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function updateHud() {
    if (hudOrbs) hudOrbs.textContent = `ORBS: ${orbs}`;
    if (hudTime) hudTime.textContent = `TIME: ${time.toFixed(1)} s`;
    if (hudGhosts) hudGhosts.textContent = `GHOST: ${ghosts.length} / ${MAX_GHOSTS}`;
  }

  function gameOver(reason) {
    state = "over";
    if (overlay) {
      overlay.classList.add("visible");
      if (overlayTitle) overlayTitle.textContent = "RUN ENDED";
      if (overlayMsg) {
        overlayMsg.textContent = `${reason} You collected ${orbs} orbs in ${time.toFixed(1)}s. Download the app for wallet rewards & Sunday 2× bonus.`;
      }
    }
    window.GhostlineAds?.showInterstitial?.();
  }

  function dist(ax, ay, bx, by) {
    return Math.hypot(ax - bx, ay - by);
  }

  function hitPillars(x, y) {
    for (const px of PILLAR_X) {
      if (x > px - PILLAR_W / 2 - 14 && x < px + PILLAR_W / 2 + 14) return true;
    }
    return false;
  }

  function hitGhosts(x, y) {
    for (const g of ghosts) {
      for (let i = 1; i < g.points.length; i++) {
        const a = g.points[i - 1];
        const b = g.points[i];
        const d = pointSegDist(x, y, a.x, a.y + g.offset, b.x, b.y + g.offset);
        if (d < 16) return true;
      }
    }
    return false;
  }

  function pointSegDist(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy + 1e-6)));
    return dist(px, py, x1 + t * dx, y1 + t * dy);
  }

  function update(dt) {
    if (state !== "playing") return;

    time += dt;
    scroll += dt * 90;
    pathTimer += dt;
    ghostSpawnTimer += dt;

    const steer = (keys.ArrowLeft || keys.a ? -1 : 0) + (keys.ArrowRight || keys.d ? 1 : 0) + touchDir;
    velX += steer * 420 * dt;
    velX *= 0.88;
    shipX += velX * dt;
    shipX = Math.max(22, Math.min(W - 22, shipX));

    if (pathTimer > GHOST_POINT_EVERY / 60) {
      pathTimer = 0;
      pathPoints.push({ x: shipX, y: shipY });
      if (pathPoints.length > 80) pathPoints.shift();
    }

    if (ghostSpawnTimer >= GHOST_INTERVAL) {
      ghostSpawnTimer = 0;
      if (ghosts.length < MAX_GHOSTS && pathPoints.length > 4) {
        ghosts.push({
          points: pathPoints.map((p) => ({ x: p.x, y: p.y })),
          offset: -scroll,
          phase: 0,
        });
      }
    }

    for (const g of ghosts) {
      g.offset += dt * 90;
      g.phase += dt * 3;
    }

    for (const o of orbSprites) {
      o.y += dt * 90;
      o.pulse += dt * 5;
      if (dist(shipX, shipY, o.x, o.y) < o.r + 18) {
        orbs++;
        o.y = H + 50;
      }
    }
    orbSprites = orbSprites.filter((o) => o.y < H + 40);
    spawnOrbs();

    if (hitPillars(shipX, shipY) || hitGhosts(shipX, shipY)) {
      gameOver(hitPillars(shipX, shipY) ? "Crashed into a pillar." : "Hit your own ghost trail.");
    }

    updateHud();
  }

  function draw() {
    ctx.fillStyle = "#050508";
    ctx.fillRect(0, 0, W, H);

    // Starfield
    if (stars.length < 80) {
      for (let i = 0; i < 80; i++) {
        stars.push({ x: Math.random() * W, y: Math.random() * H, s: Math.random() * 2, sp: 0.2 + Math.random() * 0.8 });
      }
    }
    for (const s of stars) {
      s.y = (s.y + s.sp) % H;
      ctx.fillStyle = `rgba(200,220,255,${0.2 + s.s * 0.15})`;
      ctx.fillRect(s.x, s.y, s.s, s.s);
    }

    // Pillars
    for (const px of PILLAR_X) {
      const grd = ctx.createLinearGradient(px - PILLAR_W / 2, 0, px + PILLAR_W / 2, H);
      grd.addColorStop(0, "#252540");
      grd.addColorStop(0.5, "#6b21a8");
      grd.addColorStop(1, "#06b6d4");
      ctx.fillStyle = grd;
      ctx.fillRect(px - PILLAR_W / 2, 0, PILLAR_W, H);
      ctx.strokeStyle = "rgba(103,232,249,0.4)";
      ctx.lineWidth = 2;
      ctx.strokeRect(px - PILLAR_W / 2, 0, PILLAR_W, H);
    }

    // Ghost trails
    for (const g of ghosts) {
      ctx.beginPath();
      ctx.strokeStyle = `rgba(100, 150, 255, ${0.35 + 0.15 * Math.sin(g.phase)})`;
      ctx.lineWidth = 10;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (let i = 0; i < g.points.length; i++) {
        const p = g.points[i];
        const y = p.y + g.offset;
        if (i === 0) ctx.moveTo(p.x, y);
        else ctx.lineTo(p.x, y);
      }
      ctx.stroke();
    }

    // Orbs
    for (const o of orbSprites) {
      const glow = 0.6 + 0.4 * Math.sin(o.pulse);
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
      const og = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
      og.addColorStop(0, `rgba(252, 211, 77, ${glow})`);
      og.addColorStop(1, "rgba(245, 158, 11, 0)");
      ctx.fillStyle = og;
      ctx.fill();
    }

    // Ship
    ctx.save();
    ctx.translate(shipX, shipY);
    ctx.rotate(velX * 0.002);
    ctx.fillStyle = "#67e8f9";
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo(16, 14);
    ctx.lineTo(0, 8);
    ctx.lineTo(-16, 14);
    ctx.closePath();
    ctx.fill();
    ctx.shadowColor = "#06b6d4";
    ctx.shadowBlur = 16;
    ctx.fill();
    ctx.restore();

    if (state === "ready") {
      ctx.fillStyle = "rgba(15,15,26,0.75)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#f1f5f9";
      ctx.font = "600 16px Orbitron, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("TAP OR PRESS START", W / 2, H / 2 - 8);
      ctx.font = "13px Inter, sans-serif";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText("← → or A D to steer", W / 2, H / 2 + 16);
    }
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  window.addEventListener("keydown", (e) => {
    keys[e.key] = true;
    if (e.key === " " || e.key === "Enter") {
      if (state === "ready" || state === "over") reset();
    }
  });
  window.addEventListener("keyup", (e) => {
    keys[e.key] = false;
  });

  canvas.addEventListener("pointerdown", (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    touchDir = x < shipX ? -1 : 1;
    if (state === "ready" || state === "over") reset();
  });
  canvas.addEventListener("pointerup", () => {
    touchDir = 0;
  });
  canvas.addEventListener("pointerleave", () => {
    touchDir = 0;
  });

  btnRestart?.addEventListener("click", reset);
  btnPlayAgain?.addEventListener("click", reset);

  requestAnimationFrame(loop);
})();

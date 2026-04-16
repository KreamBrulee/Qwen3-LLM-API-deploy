/* ═══════════════════════════════════════════════════════════════
   RETRO OVERLAY — background game + pixel character loader
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ── Inject retro HUD badge ──
  const hud = document.createElement('div');
  hud.className = 'retro-hud';
  hud.innerHTML = '<span class="blink">●</span> STACKMIND ARCADE — INSERT COIN';
  document.body.appendChild(hud);

  // ═══════════════════════════════════════════════════════════════
  // BACKGROUND GAME — autonomous Space-Invaders-ish
  // ═══════════════════════════════════════════════════════════════
  const cvs = document.createElement('canvas');
  cvs.id = 'retroBgGame';
  document.body.insertBefore(cvs, document.body.firstChild);
  const ctx = cvs.getContext('2d');

  let W = 0, H = 0, DPR = Math.min(window.devicePixelRatio || 1, 2);
  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    cvs.width = W * DPR;
    cvs.height = H * DPR;
    cvs.style.width = W + 'px';
    cvs.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }
  resize();
  window.addEventListener('resize', resize);

  // Pixel-art helpers: draw from 2D arrays of hex chars
  // Colors palette index 1..9
  const PAL = {
    '1': '#ffb347', // amber
    '2': '#ff4d8f', // pink
    '3': '#4dd0e1', // cyan
    '4': '#7fff7f', // green
    '5': '#ffe74c', // yellow
    '6': '#9b59ff', // purple
    '7': '#ff4d4d', // red
    '8': '#ffffff', // white
    '9': '#000000', // black
  };
  function drawSprite(grid, x, y, scale) {
    for (let r = 0; r < grid.length; r++) {
      const row = grid[r];
      for (let c = 0; c < row.length; c++) {
        const ch = row[c];
        if (ch === '.' || ch === ' ') continue;
        ctx.fillStyle = PAL[ch] || '#fff';
        ctx.fillRect(x + c * scale, y + r * scale, scale, scale);
      }
    }
  }

  // Sprites
  const SHIP = [
    '....1....',
    '....1....',
    '...111...',
    '..11111..',
    '.1111111.',
    '111.1.111',
    '1.......1',
  ];
  const ENEMY_A = [
    '..3...3..',
    '.3.3.3.3.',
    '.3333333.',
    '33.333.33',
    '3333333333',
    '.3.3.3.3.',
    '3.......3',
  ];
  const ENEMY_B = [
    '..2222..',
    '.222222.',
    '22.22.22',
    '22222222',
    '.2.22.2.',
    '2.2..2.2',
  ];
  const ENEMY_C = [
    '....5....',
    '...555...',
    '..55555..',
    '.5555555.',
    '55.555.55',
    '.5.5.5.5.',
  ];

  // Game state
  const S = 2; // pixel scale
  const ship = { x: W / 2, y: H - 70, vx: 0, dir: 1 };
  const bullets = [];
  const enemyBullets = [];
  const enemies = [];
  const stars = [];
  const explosions = [];

  // Stars
  for (let i = 0; i < 80; i++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * H,
      s: Math.random() * 2 + 0.5,
      c: ['#fff', '#ffe74c', '#4dd0e1', '#9b59ff'][Math.floor(Math.random() * 4)],
    });
  }

  function spawnWave() {
    enemies.length = 0;
    const cols = Math.max(6, Math.floor(W / 110));
    const rows = 3;
    const startX = (W - cols * 80) / 2;
    const types = [ENEMY_C, ENEMY_A, ENEMY_B];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        enemies.push({
          x: startX + c * 80,
          y: 60 + r * 50,
          type: types[r % types.length],
          alive: true,
          wobble: Math.random() * Math.PI * 2,
        });
      }
    }
  }
  spawnWave();

  let enemyDir = 1;
  let enemySpeed = 0.3;
  let fireCooldown = 0;
  let enemyFireCooldown = 120;
  let waveShift = 0;

  function update() {
    // Stars
    for (const s of stars) {
      s.y += s.s * 0.4;
      if (s.y > H) { s.y = -2; s.x = Math.random() * W; }
    }

    // Ship AI: track nearest enemy column above
    let targetX = W / 2;
    let nearest = null, minD = Infinity;
    for (const e of enemies) {
      if (!e.alive) continue;
      const d = Math.abs(e.x - ship.x);
      if (d < minD) { minD = d; nearest = e; }
    }
    if (nearest) targetX = nearest.x;
    const dx = targetX - ship.x;
    ship.x += Math.sign(dx) * Math.min(Math.abs(dx), 2.2);

    // Auto-fire
    fireCooldown--;
    if (fireCooldown <= 0 && nearest) {
      bullets.push({ x: ship.x, y: ship.y - 8, vy: -6, c: '#7fff7f' });
      fireCooldown = 22 + Math.random() * 15;
    }

    // Bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.y += b.vy;
      if (b.y < -10) { bullets.splice(i, 1); continue; }
      // collide
      for (const e of enemies) {
        if (!e.alive) continue;
        if (b.x > e.x - 12 && b.x < e.x + 12 && b.y > e.y - 14 && b.y < e.y + 14) {
          e.alive = false;
          bullets.splice(i, 1);
          spawnExplosion(e.x, e.y, '#ff4d8f');
          break;
        }
      }
    }

    // Enemy bullets
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const b = enemyBullets[i];
      b.y += b.vy;
      if (b.y > H + 10) enemyBullets.splice(i, 1);
    }

    // Enemy movement
    let anyAlive = false, minX = Infinity, maxX = -Infinity;
    for (const e of enemies) {
      if (!e.alive) continue;
      anyAlive = true;
      e.wobble += 0.05;
      e.x += enemyDir * enemySpeed;
      e.y += Math.sin(e.wobble) * 0.15;
      if (e.x < minX) minX = e.x;
      if (e.x > maxX) maxX = e.x;
    }
    if (!anyAlive) { spawnWave(); enemySpeed = Math.min(enemySpeed + 0.1, 1.2); }
    if (minX < 40 || maxX > W - 40) {
      enemyDir *= -1;
      for (const e of enemies) e.y += 6;
    }

    // Enemy fires
    enemyFireCooldown--;
    if (enemyFireCooldown <= 0) {
      const alive = enemies.filter((e) => e.alive);
      if (alive.length) {
        const shooter = alive[Math.floor(Math.random() * alive.length)];
        enemyBullets.push({ x: shooter.x, y: shooter.y + 10, vy: 3.5 });
      }
      enemyFireCooldown = 80 + Math.random() * 80;
    }

    // Explosions
    for (let i = explosions.length - 1; i >= 0; i--) {
      const e = explosions[i];
      e.t--;
      if (e.t <= 0) explosions.splice(i, 1);
    }
  }

  function spawnExplosion(x, y, color) {
    for (let i = 0; i < 12; i++) {
      const ang = (Math.PI * 2 * i) / 12;
      explosions.push({
        x, y,
        vx: Math.cos(ang) * 2,
        vy: Math.sin(ang) * 2,
        t: 20,
        c: color,
      });
    }
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    // Stars
    for (const s of stars) {
      ctx.fillStyle = s.c;
      ctx.fillRect(s.x, s.y, s.s, s.s);
    }
    // Enemies
    for (const e of enemies) {
      if (!e.alive) continue;
      const w = e.type[0].length * S;
      drawSprite(e.type, Math.round(e.x - w / 2), Math.round(e.y - e.type.length * S / 2), S);
    }
    // Ship
    drawSprite(SHIP, Math.round(ship.x - (SHIP[0].length * S) / 2), Math.round(ship.y), S);
    // Bullets
    for (const b of bullets) {
      ctx.fillStyle = b.c;
      ctx.fillRect(b.x - 1, b.y - 4, 2, 8);
    }
    for (const b of enemyBullets) {
      ctx.fillStyle = '#ff4d4d';
      ctx.fillRect(b.x - 1, b.y - 4, 2, 8);
    }
    // Explosions
    for (const e of explosions) {
      e.x += e.vx; e.y += e.vy;
      ctx.fillStyle = e.c;
      const sz = Math.max(2, e.t / 5);
      ctx.fillRect(e.x, e.y, sz, sz);
    }
  }

  let running = true;
  function loop() {
    if (running) { update(); render(); }
    requestAnimationFrame(loop);
  }
  loop();

  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
  });

  // ═══════════════════════════════════════════════════════════════
  // PIXEL CHARACTER LOADER — injects into welcome-splash
  // ═══════════════════════════════════════════════════════════════
  function buildPixelChar() {
    // Clean minimal pixel guy: orange hair, skin face, black shirt, blue pants
    return `
      <svg class="pixel-char-sprite" viewBox="0 0 10 14" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
        <!-- hair -->
        <rect x="2" y="0" width="6" height="2" fill="#ff9a3c"/>
        <rect x="1" y="1" width="8" height="2" fill="#ff9a3c"/>
        <!-- face -->
        <rect x="2" y="3" width="6" height="3" fill="#f9c89b"/>
        <!-- eyes -->
        <rect x="3" y="4" width="1" height="1" fill="#000"/>
        <rect x="6" y="4" width="1" height="1" fill="#000"/>
        <!-- mouth -->
        <rect x="4" y="5" width="2" height="1" fill="#000"/>
        <!-- shirt -->
        <rect x="1" y="6" width="8" height="4" fill="#111"/>
        <!-- pants -->
        <rect x="2" y="10" width="3" height="3" fill="#2a56c6"/>
        <rect x="5" y="10" width="3" height="3" fill="#2a56c6"/>
        <!-- shoes -->
        <rect x="2" y="13" width="3" height="1" fill="#000"/>
        <rect x="5" y="13" width="3" height="1" fill="#000"/>
      </svg>`;
  }

  function installPixelLoader() {
    const splash = document.getElementById('welcomeSplash');
    if (!splash || splash.querySelector('.retro-loader-wrap')) return;

    const wrap = document.createElement('div');
    wrap.className = 'retro-loader-wrap';
    wrap.innerHTML = `
      <div class="pixel-char">${buildPixelChar()}</div>
      <div class="pixel-progress"><div class="pixel-progress-fill" id="pixelProgFill"></div></div>
      <div class="pixel-progress-pct" id="pixelProgPct">0%</div>
      <div class="retro-loader-label">Preparing workspace...</div>
    `;
    splash.appendChild(wrap);

    const fill = wrap.querySelector('#pixelProgFill');
    const pct = wrap.querySelector('#pixelProgPct');
    let start = null;
    function tick(t) {
      if (splash.style.display === 'none') {
        start = null;
        fill.style.width = '0%';
        pct.textContent = '0%';
        requestAnimationFrame(tick);
        return;
      }
      if (start === null) start = t;
      const p = Math.min(100, ((t - start) / 2200) * 100);
      fill.style.width = p + '%';
      pct.textContent = Math.floor(p) + '%';
      if (p >= 100) start = t - 2200;
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installPixelLoader);
  } else {
    installPixelLoader();
  }
})();

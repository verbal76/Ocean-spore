(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const state = {
    running: false,
    w: 0,
    h: 0,
    dpr: 1,
    last: 0,
    scrap: 0,
    player: null,
    bullets: [],
    enemies: [],
    pickups: [],
    particles: [],
    spawnTimer: 0,
    input: { dx: 0, dy: 0, fire: false },
  };

  function resize() {
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);
    state.w = window.innerWidth;
    state.h = window.innerHeight;
    canvas.width = Math.floor(state.w * state.dpr);
    canvas.height = Math.floor(state.h * state.dpr);
    canvas.style.width = state.w + 'px';
    canvas.style.height = state.h + 'px';
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  function createPlayer() {
    return {
      x: state.w / 2,
      y: state.h / 2,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2,
      speed: 180,
      size: 18,
      hull: 100,
      maxHull: 100,
      fireCooldown: 0,
    };
  }

  function spawnEnemy() {
    const edge = Math.floor(Math.random() * 4);
    let x, y;
    if (edge === 0) { x = -30; y = Math.random() * state.h; }
    else if (edge === 1) { x = state.w + 30; y = Math.random() * state.h; }
    else if (edge === 2) { x = Math.random() * state.w; y = -30; }
    else { x = Math.random() * state.w; y = state.h + 30; }

    state.enemies.push({
      x, y,
      size: 14 + Math.random() * 8,
      hp: 2,
      speed: 40 + Math.random() * 30,
      angle: 0,
    });
  }

  function spawnPickup(x, y) {
    state.pickups.push({
      x, y,
      size: 6,
      life: 12,
      bob: Math.random() * Math.PI * 2,
    });
  }

  function burst(x, y, color, count = 8) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 60 + Math.random() * 120;
      state.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.5 + Math.random() * 0.3,
        max: 0.8,
        color,
      });
    }
  }

  function fire() {
    const p = state.player;
    if (p.fireCooldown > 0) return;
    p.fireCooldown = 0.22;
    const speed = 480;
    state.bullets.push({
      x: p.x + Math.cos(p.angle) * p.size,
      y: p.y + Math.sin(p.angle) * p.size,
      vx: Math.cos(p.angle) * speed,
      vy: Math.sin(p.angle) * speed,
      life: 1.4,
    });
  }

  function update(dt) {
    const p = state.player;

    const ix = state.input.dx;
    const iy = state.input.dy;
    const mag = Math.hypot(ix, iy);
    if (mag > 0.05) {
      p.angle = Math.atan2(iy, ix);
      p.vx = ix * p.speed;
      p.vy = iy * p.speed;
    } else {
      p.vx *= 0.85;
      p.vy *= 0.85;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.x = Math.max(p.size, Math.min(state.w - p.size, p.x));
    p.y = Math.max(p.size, Math.min(state.h - p.size, p.y));

    p.fireCooldown -= dt;
    if (state.input.fire) fire();

    for (let i = state.bullets.length - 1; i >= 0; i--) {
      const b = state.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -20 || b.x > state.w + 20 || b.y < -20 || b.y > state.h + 20) {
        state.bullets.splice(i, 1);
      }
    }

    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      spawnEnemy();
      state.spawnTimer = 1.6 + Math.random() * 1.2;
    }

    for (let i = state.enemies.length - 1; i >= 0; i--) {
      const e = state.enemies[i];
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      e.angle = Math.atan2(dy, dx);
      e.x += (dx / d) * e.speed * dt;
      e.y += (dy / d) * e.speed * dt;

      for (let j = state.bullets.length - 1; j >= 0; j--) {
        const b = state.bullets[j];
        if (Math.hypot(b.x - e.x, b.y - e.y) < e.size + 4) {
          e.hp -= 1;
          state.bullets.splice(j, 1);
          burst(b.x, b.y, '#fbbf24', 4);
          if (e.hp <= 0) {
            burst(e.x, e.y, '#f87171', 12);
            spawnPickup(e.x, e.y);
            state.enemies.splice(i, 1);
          }
          break;
        }
      }

      if (state.enemies[i] && Math.hypot(p.x - e.x, p.y - e.y) < p.size + e.size - 2) {
        p.hull -= 12;
        burst(e.x, e.y, '#f87171', 10);
        state.enemies.splice(i, 1);
        if (p.hull <= 0) gameOver();
      }
    }

    for (let i = state.pickups.length - 1; i >= 0; i--) {
      const pk = state.pickups[i];
      pk.life -= dt;
      pk.bob += dt * 4;
      const dx = p.x - pk.x;
      const dy = p.y - pk.y;
      const d = Math.hypot(dx, dy);
      if (d < 60) {
        pk.x += (dx / d) * 160 * dt;
        pk.y += (dy / d) * 160 * dt;
      }
      if (d < p.size + pk.size) {
        state.scrap += 1;
        document.getElementById('scrap').textContent = state.scrap;
        burst(pk.x, pk.y, '#22d3ee', 6);
        state.pickups.splice(i, 1);
        continue;
      }
      if (pk.life <= 0) state.pickups.splice(i, 1);
    }

    for (let i = state.particles.length - 1; i >= 0; i--) {
      const pt = state.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.92;
      pt.vy *= 0.92;
      pt.life -= dt;
      if (pt.life <= 0) state.particles.splice(i, 1);
    }

    document.getElementById('hull-fill').style.width = Math.max(0, (p.hull / p.maxHull) * 100) + '%';
  }

  function drawWater(t) {
    ctx.fillStyle = '#062238';
    ctx.fillRect(0, 0, state.w, state.h);

    ctx.strokeStyle = 'rgba(135,206,250,0.08)';
    ctx.lineWidth = 1;
    const spacing = 40;
    const offset = (t * 12) % spacing;
    for (let y = -spacing + offset; y < state.h; y += spacing) {
      ctx.beginPath();
      for (let x = 0; x <= state.w; x += 20) {
        const yy = y + Math.sin((x + t * 60) * 0.02) * 3;
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
  }

  function drawBoat(x, y, angle, size, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(-size * 0.7, -size * 0.6);
    ctx.lineTo(-size * 0.4, 0);
    ctx.lineTo(-size * 0.7, size * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(-size * 0.2, -size * 0.25, size * 0.5, size * 0.5);
    ctx.restore();
  }

  function drawEnemy(e) {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(e.angle);
    ctx.fillStyle = '#7f1d1d';
    ctx.beginPath();
    ctx.moveTo(e.size, 0);
    ctx.lineTo(-e.size, -e.size * 0.7);
    ctx.lineTo(-e.size * 0.5, 0);
    ctx.lineTo(-e.size, e.size * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fca5a5';
    ctx.beginPath();
    ctx.arc(0, 0, e.size * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function render(t) {
    drawWater(t);

    for (const pk of state.pickups) {
      const flash = pk.life < 3 ? (Math.sin(pk.life * 14) > 0 ? 1 : 0.4) : 1;
      ctx.fillStyle = `rgba(34,211,238,${flash})`;
      ctx.beginPath();
      ctx.arc(pk.x, pk.y + Math.sin(pk.bob) * 2, pk.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    for (const e of state.enemies) drawEnemy(e);

    if (state.player) {
      drawBoat(state.player.x, state.player.y, state.player.angle, state.player.size, '#cbd5e1');
    }

    ctx.fillStyle = '#fde68a';
    for (const b of state.bullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const pt of state.particles) {
      const a = Math.max(0, pt.life / pt.max);
      ctx.globalAlpha = a;
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;
  }

  function loop(ts) {
    if (!state.running) return;
    const t = ts / 1000;
    const dt = Math.min(0.05, t - state.last || 0);
    state.last = t;
    update(dt);
    render(t);
    requestAnimationFrame(loop);
  }

  function startGame() {
    state.scrap = 0;
    state.bullets = [];
    state.enemies = [];
    state.pickups = [];
    state.particles = [];
    state.spawnTimer = 1;
    state.player = createPlayer();
    state.running = true;
    state.last = performance.now() / 1000;
    document.getElementById('scrap').textContent = '0';
    document.getElementById('hull-fill').style.width = '100%';
    document.getElementById('start-screen').classList.add('hidden');
    requestAnimationFrame(loop);
  }

  function gameOver() {
    state.running = false;
    const screen = document.getElementById('start-screen');
    screen.querySelector('h1').innerHTML = 'WRECKED';
    screen.querySelector('p').textContent = `Scrap salvaged: ${state.scrap}`;
    const btn = document.getElementById('start-btn');
    btn.textContent = 'TRY AGAIN';
    screen.classList.remove('hidden');
  }

  document.getElementById('start-btn').addEventListener('click', startGame);

  const joystick = document.getElementById('joystick');
  const knob = document.getElementById('joystick-knob');
  let joyTouchId = null;
  let joyCenter = { x: 0, y: 0 };
  const joyRadius = 50;

  function joyStart(e) {
    const t = e.changedTouches ? e.changedTouches[0] : e;
    const rect = joystick.getBoundingClientRect();
    joyCenter.x = rect.left + rect.width / 2;
    joyCenter.y = rect.top + rect.height / 2;
    joyTouchId = e.changedTouches ? t.identifier : 'mouse';
    joyMove(e);
  }

  function joyMove(e) {
    let t;
    if (e.changedTouches) {
      for (const tc of e.touches) {
        if (tc.identifier === joyTouchId) { t = tc; break; }
      }
      if (!t) return;
    } else {
      t = e;
    }
    const dx = t.clientX - joyCenter.x;
    const dy = t.clientY - joyCenter.y;
    const d = Math.hypot(dx, dy);
    const clamped = Math.min(d, joyRadius);
    const nx = d > 0 ? dx / d : 0;
    const ny = d > 0 ? dy / d : 0;
    knob.style.transform = `translate(${nx * clamped}px, ${ny * clamped}px)`;
    const norm = clamped / joyRadius;
    state.input.dx = nx * norm;
    state.input.dy = ny * norm;
  }

  function joyEnd(e) {
    if (e.changedTouches) {
      for (const tc of e.changedTouches) {
        if (tc.identifier === joyTouchId) {
          joyTouchId = null;
          break;
        }
      }
      if (joyTouchId !== null) return;
    } else {
      joyTouchId = null;
    }
    knob.style.transform = '';
    state.input.dx = 0;
    state.input.dy = 0;
  }

  joystick.addEventListener('touchstart', (e) => { e.preventDefault(); joyStart(e); }, { passive: false });
  joystick.addEventListener('touchmove', (e) => { e.preventDefault(); joyMove(e); }, { passive: false });
  joystick.addEventListener('touchend', (e) => { e.preventDefault(); joyEnd(e); }, { passive: false });
  joystick.addEventListener('touchcancel', (e) => { e.preventDefault(); joyEnd(e); }, { passive: false });

  const fireBtn = document.getElementById('fire-btn');
  fireBtn.addEventListener('touchstart', (e) => { e.preventDefault(); state.input.fire = true; }, { passive: false });
  fireBtn.addEventListener('touchend', (e) => { e.preventDefault(); state.input.fire = false; }, { passive: false });
  fireBtn.addEventListener('touchcancel', (e) => { e.preventDefault(); state.input.fire = false; }, { passive: false });
  fireBtn.addEventListener('mousedown', () => { state.input.fire = true; });
  fireBtn.addEventListener('mouseup', () => { state.input.fire = false; });

  const keys = {};
  window.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    if (e.key === ' ') state.input.fire = true;
    updateKeyInput();
  });
  window.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
    if (e.key === ' ') state.input.fire = false;
    updateKeyInput();
  });
  function updateKeyInput() {
    let dx = 0, dy = 0;
    if (keys['arrowleft'] || keys['a']) dx -= 1;
    if (keys['arrowright'] || keys['d']) dx += 1;
    if (keys['arrowup'] || keys['w']) dy -= 1;
    if (keys['arrowdown'] || keys['s']) dy += 1;
    const m = Math.hypot(dx, dy);
    if (m > 0) { dx /= m; dy /= m; }
    if (joyTouchId === null) {
      state.input.dx = dx;
      state.input.dy = dy;
    }
  }
})();

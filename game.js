(() => {
  const $ = id => document.getElementById(id);
  const cv = $('game'), ctx = cv.getContext('2d');
  const dark = document.createElement('canvas'), dctx = dark.getContext('2d');
  const MAX_LIGHT = 240, DEAD_LIGHT = 30, PULSE_COST = 35, PULSE_CD = 2.5;
  let W, H, DPR;
 
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = dark.width = W * DPR;
    cv.height = dark.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    dctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  addEventListener('resize', resize); resize();
 
  // ---------- состояние ----------
  const rnd = (a, b) => a + Math.random() * (b - a);
  let best = 0;
  try { best = +localStorage.getItem('lantern-best') || 0; } catch (e) {}
  const motes = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), r: rnd(.6, 2), s: rnd(2, 8) }));
 
  let mode = 'menu', S;
  const keys = {};
  const pointer = { x: 0, y: 0, on: false };
 
  function newGame() {
    S = {
      t: 0, score: 0, combo: 1, comboT: 0, light: MAX_LIGHT, shake: 0, cd: 0,
      p: { x: W / 2, y: H / 2, vx: 0, vy: 0 },
      flies: [], shades: [], parts: [], pulse: null, spawn: 2
    };
    for (let i = 0; i < 6; i++) addFly();
    pointer.on = false;
  }
  function addFly() {
    const a = Math.random() * 6.283, d = rnd(120, Math.min(W, H) * .5);
    S.flies.push({
      x: Math.min(W - 20, Math.max(20, S.p.x + Math.cos(a) * d)),
      y: Math.min(H - 20, Math.max(20, S.p.y + Math.sin(a) * d)),
      a: Math.random() * 6.283, ph: Math.random() * 6.283
    });
  }
  function addShade() {
    const side = Math.floor(Math.random() * 4), m = 40;
    const x = side === 0 ? -m : side === 1 ? W + m : rnd(0, W);
    const y = side === 2 ? -m : side === 3 ? H + m : rnd(0, H);
    S.shades.push({ x, y, ph: Math.random() * 6.283 });
  }
  function burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, v = rnd(40, 200);
      S.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, color });
    }
  }
  function doPulse() {
    if (mode !== 'play' || S.cd > 0 || S.light < PULSE_COST + DEAD_LIGHT) return;
    S.light -= PULSE_COST; S.cd = PULSE_CD;
    S.pulse = { r: 10 };
  }
 
  // ---------- ввод ----------
  addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'Space') { e.preventDefault(); doPulse(); }
  });
  addEventListener('keyup', e => keys[e.code] = false);
  const setPtr = e => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.on = true; };
  cv.addEventListener('pointermove', setPtr);
  cv.addEventListener('pointerdown', setPtr);
  cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') pointer.on = false; });
  $('pulse').addEventListener('pointerdown', e => { e.stopPropagation(); doPulse(); });
  $('start').addEventListener('click', start);
 
  function start() {
    newGame(); mode = 'play';
    $('screen').hidden = true;
    ['hud', 'lightbar', 'pulse'].forEach(i => $(i).hidden = false);
    $('best').textContent = best;
  }
  function gameOver() {
    mode = 'over';
    const newBest = S.score > best;
    if (newBest) { best = S.score; try { localStorage.setItem('lantern-best', best); } catch (e) {} }
    $('title').textContent = 'Фонарь погас';
    $('text').textContent = `Вы собрали ${S.score} очков за ${Math.round(S.t)} с. ` +
      (newBest ? 'Это новый рекорд!' : `Рекорд: ${best}.`);
    $('start').textContent = 'Зажечь снова';
    $('screen').hidden = false;
    ['pulse'].forEach(i => $(i).hidden = true);
  }
 
  // ---------- логика ----------
  function update(dt) {
    S.t += dt;
    const p = S.p;
 
    // движение
    let tx = 0, ty = 0, kb = false;
    if (keys.KeyA || keys.ArrowLeft) { tx -= 1; kb = true; }
    if (keys.KeyD || keys.ArrowRight) { tx += 1; kb = true; }
    if (keys.KeyW || keys.ArrowUp) { ty -= 1; kb = true; }
    if (keys.KeyS || keys.ArrowDown) { ty += 1; kb = true; }
    if (kb) { const l = Math.hypot(tx, ty) || 1; tx = tx / l * 280; ty = ty / l * 280; }
    else if (pointer.on) {
      const dx = pointer.x - p.x, dy = pointer.y - p.y, d = Math.hypot(dx, dy);
      if (d > 8) { const sp = Math.min(300, d * 5); tx = dx / d * sp; ty = dy / d * sp; }
    }
    p.vx += (tx - p.vx) * Math.min(1, dt * 9);
    p.vy += (ty - p.vy) * Math.min(1, dt * 9);
    p.x = Math.max(10, Math.min(W - 10, p.x + p.vx * dt));
    p.y = Math.max(10, Math.min(H - 10, p.y + p.vy * dt));
 
    // свет угасает всё быстрее
    S.light -= (12 + Math.min(18, S.t * .25)) * dt;
    S.cd = Math.max(0, S.cd - dt);
    S.shake = Math.max(0, S.shake - dt * 30);
    if (S.comboT > 0 && (S.comboT -= dt) <= 0) S.combo = 1;
 
    // светлячки
    for (const f of S.flies) {
      f.a += rnd(-3, 3) * dt; f.ph += dt * 4;
      f.x += Math.cos(f.a) * 28 * dt; f.y += Math.sin(f.a) * 28 * dt;
      if (f.x < 15 || f.x > W - 15) { f.a = Math.PI - f.a; f.x = Math.max(15, Math.min(W - 15, f.x)); }
      if (f.y < 15 || f.y > H - 15) { f.a = -f.a; f.y = Math.max(15, Math.min(H - 15, f.y)); }
    }
    S.flies = S.flies.filter(f => {
      if (Math.hypot(f.x - p.x, f.y - p.y) < 22) {
        S.light = Math.min(MAX_LIGHT, S.light + 42);
        S.score += 10 * S.combo;
        S.combo = Math.min(5, S.combo + 1); S.comboT = 2.5;
        burst(f.x, f.y, '#9ef0d0', 14);
        return false;
      }
      return true;
    });
    while (S.flies.length < 6) addFly();
 
    // тени
    S.spawn -= dt;
    if (S.spawn <= 0) { addShade(); S.spawn = Math.max(.9, 3.6 - S.t / 25); }
    const sp = Math.min(135, 55 + S.t * 1.1);
    for (const s of S.shades) {
      const dx = p.x - s.x, dy = p.y - s.y, d = Math.hypot(dx, dy) || 1;
      s.x += dx / d * sp * dt; s.y += dy / d * sp * dt; s.ph += dt * 5;
    }
    S.shades = S.shades.filter(s => {
      if (Math.hypot(s.x - p.x, s.y - p.y) < 28) {
        S.light -= 55; S.shake = 14; S.combo = 1;
        burst(s.x, s.y, '#8a4fd0', 18);
        return false;
      }
      return true;
    });
 
    // вспышка
    if (S.pulse) {
      S.pulse.r += 620 * dt;
      S.shades = S.shades.filter(s => {
        if (Math.hypot(s.x - p.x, s.y - p.y) < S.pulse.r) {
          S.score += 5; burst(s.x, s.y, '#ffc857', 12); return false;
        }
        return true;
      });
      if (S.pulse.r > 300) S.pulse = null;
    }
 
    for (const q of S.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt * 1.8; }
    S.parts = S.parts.filter(q => q.life > 0);
 
    if (S.light <= DEAD_LIGHT) gameOver();
 
    // HUD
    $('score').textContent = S.score;
    $('combo').textContent = '×' + S.combo;
    const k = Math.max(0, (S.light - DEAD_LIGHT) / (MAX_LIGHT - DEAD_LIGHT));
    $('lightfill').style.width = (k * 100) + '%';
    $('lightbar').classList.toggle('low', k < .25);
    $('pulse').classList.toggle('cool', S.cd > 0 || S.light < PULSE_COST + DEAD_LIGHT);
  }
 
  // ---------- рисование ----------
  function glow(c, x, y, r, color, a) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color.replace('A', a)); g.addColorStop(1, color.replace('A', 0));
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 6.283); c.fill();
  }
 
  function draw(time) {
    const t = time / 1000;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#241a4a'); bg.addColorStop(1, '#150f2e');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
 
    ctx.fillStyle = 'rgba(243,233,210,.35)';
    for (const m of motes) {
      const x = (m.x * W + Math.sin(t / m.s * 3 + m.y * 9) * 20) % W;
      const y = (m.y * H - t * m.s * 2 % H + H) % H;
      ctx.beginPath(); ctx.arc(x, y, m.r, 0, 6.283); ctx.fill();
    }
    if (!S) return;
 
    ctx.save();
    if (S.shake > 0) ctx.translate(rnd(-S.shake, S.shake) / 2, rnd(-S.shake, S.shake) / 2);
    const p = S.p;
 
    // тени (видны только на свету)
    for (const s of S.shades) {
      ctx.fillStyle = '#7a3fc0';
      for (let i = 0; i < 5; i++) {
        const a = i * 1.257 + s.ph * .4, w = Math.sin(s.ph + i) * 4;
        ctx.beginPath(); ctx.arc(s.x + Math.cos(a) * (10 + w), s.y + Math.sin(a) * (10 + w), 13, 0, 6.283); ctx.fill();
      }
    }
    // светлячки
    for (const f of S.flies) {
      const a = .7 + Math.sin(f.ph) * .3;
      glow(ctx, f.x, f.y, 26, 'rgba(158,240,208,A)', a);
      ctx.fillStyle = '#e8fff6'; ctx.beginPath(); ctx.arc(f.x, f.y, 3.5, 0, 6.283); ctx.fill();
    }
    // частицы
    for (const q of S.parts) {
      ctx.globalAlpha = q.life; ctx.fillStyle = q.color;
      ctx.beginPath(); ctx.arc(q.x, q.y, 3, 0, 6.283); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // вспышка
    if (S.pulse) {
      ctx.strokeStyle = `rgba(255,200,87,${1 - S.pulse.r / 300})`; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(p.x, p.y, S.pulse.r, 0, 6.283); ctx.stroke();
    }
 
    // тьма с «дырой» света
    dctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    dctx.globalCompositeOperation = 'source-over';
    dctx.clearRect(0, 0, W, H);
    dctx.fillStyle = 'rgba(6,4,20,.97)'; dctx.fillRect(0, 0, W, H);
    dctx.globalCompositeOperation = 'destination-out';
    const R = S.light * (1 + Math.sin(t * 9) * .02);
    const g = dctx.createRadialGradient(p.x, p.y, R * .15, p.x, p.y, R);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    dctx.fillStyle = g; dctx.beginPath(); dctx.arc(p.x, p.y, R, 0, 6.283); dctx.fill();
    for (const f of S.flies) {
      const g2 = dctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 55);
      g2.addColorStop(0, 'rgba(0,0,0,.8)'); g2.addColorStop(1, 'rgba(0,0,0,0)');
      dctx.fillStyle = g2; dctx.beginPath(); dctx.arc(f.x, f.y, 55, 0, 6.283); dctx.fill();
    }
    ctx.drawImage(dark, 0, 0, W, H);
 
    // поверх тьмы: глаза теней и тусклые светлячки
    ctx.fillStyle = '#ff5d73';
    for (const s of S.shades) {
      const ex = Math.sign(p.x - s.x) * 2;
      ctx.beginPath(); ctx.arc(s.x - 5 + ex, s.y - 2, 2.2, 0, 6.283); ctx.arc(s.x + 5 + ex, s.y - 2, 2.2, 0, 6.283); ctx.fill();
    }
    ctx.fillStyle = 'rgba(158,240,208,.5)';
    for (const f of S.flies) { ctx.beginPath(); ctx.arc(f.x, f.y, 2.5, 0, 6.283); ctx.fill(); }
 
    // фонарь
    glow(ctx, p.x, p.y, 34, 'rgba(255,200,87,A)', .9);
    ctx.fillStyle = '#fff3c9'; ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, 6.283); ctx.fill();
    ctx.restore();
  }
 
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (mode === 'play') update(dt);
    else if (S && mode === 'over') { S.parts.forEach(q => { q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt * 1.8; }); S.parts = S.parts.filter(q => q.life > 0); }
    draw(now);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
/* ═══════════════════════════════════════════════════════════════════════
   SPARSH PATEL — QUANT PORTFOLIO
   main.js
   ═══════════════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  initBgChart();         // background stock chart — first so it's behind everything
  initVolSurface();      // hero 3D + particles
  initBootSequence();
  initNavScroll();
  initScrollReveal();
  initScrollProgress();
  initAlphaCounters();
  initHudPanel();
  initExpMini();
  initDeckDeal();
  initMiniCharts();   // null-safe if canvases absent
  initMonteCarlo();
  initContactForm();
});

/* ════════════════════════════════════ BACKGROUND STOCK CHART ════ */
function initBgChart() {
  const canvas = document.getElementById('bg-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  // 700 price points — upward bias increases over time (career narrative)
  const TOTAL = 700;
  const prices = [100];
  for (let i = 1; i < TOTAL; i++) {
    const bias  = 0.04 + (i / TOTAL) * 0.09;
    const noise = (Math.random() - 0.5 + bias) * 6.5;  // more volatile
    prices.push(Math.max(20, Math.min(320, prices[i - 1] + noise)));
  }
  const smooth = prices.map((_, i) => {
    const w = prices.slice(Math.max(0, i - 4), i + 5);
    return w.reduce((a, b) => a + b, 0) / w.length;
  });
  const MA = smooth.map((_, i) => {
    const w = smooth.slice(Math.max(0, i - 20), i + 1);
    return w.reduce((a, b) => a + b, 0) / w.length;
  });

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const scrollPct = window.scrollY / Math.max(1, document.documentElement.scrollHeight - H);
    const WIN   = 180;
    const start = Math.floor(scrollPct * (TOTAL - WIN));
    const end   = Math.min(start + WIN, TOTAL);
    const visible = smooth.slice(start, end);
    const visMA   = MA.slice(start, end);
    if (visible.length < 2) return;

    const chartH   = H * 0.38;
    const chartTop = H * 0.54;
    const minP = Math.min(...visible) - 4;
    const maxP = Math.max(...visible) + 4;
    const range = maxP - minP;
    const toY = p => chartTop + chartH - ((p - minP) / range) * chartH;
    const toX = i => (i / (visible.length - 1)) * W;

    // grid
    ctx.setLineDash([4, 8]);
    for (let i = 0; i <= 4; i++) {
      const y = chartTop + (i / 4) * chartH;
      ctx.strokeStyle = 'rgba(0,212,255,0.04)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    for (let i = 1; i < 6; i++) {
      ctx.strokeStyle = 'rgba(0,212,255,0.025)';
      ctx.beginPath(); ctx.moveTo((i/6)*W, chartTop); ctx.lineTo((i/6)*W, chartTop+chartH); ctx.stroke();
    }
    ctx.setLineDash([]);

    const isUp   = visible[visible.length - 1] >= visible[0];
    const lineRGB = isUp ? '0,255,136' : '255,68,68';

    // area fill
    ctx.beginPath();
    visible.forEach((p, i) => i === 0 ? ctx.moveTo(toX(i), toY(p)) : ctx.lineTo(toX(i), toY(p)));
    ctx.lineTo(W, chartTop + chartH); ctx.lineTo(0, chartTop + chartH); ctx.closePath();
    const grad = ctx.createLinearGradient(0, chartTop, 0, chartTop + chartH);
    grad.addColorStop(0,   `rgba(${lineRGB},0.13)`);
    grad.addColorStop(1,   `rgba(${lineRGB},0)`);
    ctx.fillStyle = grad; ctx.fill();

    // price line
    ctx.beginPath();
    visible.forEach((p, i) => i === 0 ? ctx.moveTo(toX(i), toY(p)) : ctx.lineTo(toX(i), toY(p)));
    ctx.strokeStyle = `rgba(${lineRGB},0.48)`; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();

    // MA line
    ctx.beginPath();
    visMA.forEach((p, i) => i === 0 ? ctx.moveTo(toX(i), toY(p)) : ctx.lineTo(toX(i), toY(p)));
    ctx.strokeStyle = 'rgba(0,212,255,0.15)'; ctx.lineWidth = 1; ctx.setLineDash([6,4]); ctx.stroke();
    ctx.setLineDash([]);

    // current price cursor
    const lastP = visible[visible.length - 1];
    const dotY  = toY(lastP);
    ctx.strokeStyle = `rgba(${lineRGB},0.18)`; ctx.lineWidth = 1; ctx.setLineDash([4,6]);
    ctx.beginPath(); ctx.moveTo(0, dotY); ctx.lineTo(W, dotY); ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur = 12; ctx.shadowColor = `rgba(${lineRGB},0.8)`;
    ctx.beginPath(); ctx.arc(W - 8, dotY, 4, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${lineRGB},0.9)`; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.fillStyle = `rgba(${lineRGB},0.55)`;
    ctx.textAlign = 'right';
    ctx.fillText(`${isUp ? '▲' : '▼'} ${lastP.toFixed(2)}`, W - 16, dotY - 10);
    ctx.textAlign = 'left';
  }

  // gentle continuous redraw (+ scroll)
  (function tick() { draw(); requestAnimationFrame(tick); })();
  window.addEventListener('scroll', draw, { passive: true });
}

/* ══════════════════════════════════════════ THREE.JS — VOL SURFACE ════ */
function initVolSurface() {
  const canvas = document.getElementById('vol-surface-canvas');
  if (!canvas || typeof THREE === 'undefined') return;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (e) {
    // WebGL unavailable (some Safari configs) — silently skip
    console.warn('WebGL not available, skipping vol surface');
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.offsetWidth, canvas.offsetHeight);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x050810, 0.055);

  const camera = new THREE.PerspectiveCamera(52, canvas.offsetWidth / canvas.offsetHeight, 0.1, 100);
  camera.position.set(0, 3.6, 9.5);
  camera.lookAt(0, 0.9, 0);

  const N = 40;
  const positions = new Float32Array((N + 1) * (N + 1) * 3);
  const colors    = new Float32Array((N + 1) * (N + 1) * 3);

  function volHeight(ix, iy, t = 0) {
    const x = (ix / N - 0.5) * 4;   // moneyness axis
    const y = (iy / N) * 3;          // expiry axis
    const mono   = x / 2;
    const expiry = y / 3;
    const atm    = 0.28;
    const skew   = -0.09 * mono;
    const smile  = 0.14 * mono * mono;
    const term   = 0.10 * Math.exp(-expiry * 3) + 0.04;
    const wave   = 0.04 * Math.sin(t * 0.8 + ix * 0.25 + iy * 0.18);
    return (atm + skew + smile + term + wave) * 2.6;
  }

  // build geometry
  const geometry = new THREE.BufferGeometry();
  const indices  = [];

  for (let j = 0; j <= N; j++) {
    for (let i = 0; i <= N; i++) {
      const idx = j * (N + 1) + i;
      const x   = (i / N - 0.5) * 4;
      const z   = (j / N) * 3 - 1.5;
      const h   = volHeight(i, j, 0);

      positions[idx * 3]     = x;
      positions[idx * 3 + 1] = h;
      positions[idx * 3 + 2] = z;

      // colour: cyan (low vol) → green (mid) → gold (high vol)
      const t = Math.min(Math.max((h - 0.5) / 1.2, 0), 1);
      colors[idx * 3]     = t * 1.0;
      colors[idx * 3 + 1] = 0.85 - t * 0.1;
      colors[idx * 3 + 2] = 1.0  - t * 0.9;
    }
  }

  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const a = j * (N + 1) + i;
      const b = a + 1;
      const c = a + (N + 1);
      const d = c + 1;
      indices.push(a, b,  b, d,  d, c,  c, a);
    }
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color',    new THREE.BufferAttribute(colors,    3));
  geometry.setIndex(indices);

  const material = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.72,
  });
  const mesh = new THREE.LineSegments(geometry, material);
  mesh.rotation.x = -0.18;
  mesh.scale.set(1.45, 1.0, 1.45);   // wider & deeper for emphasis
  scene.add(mesh);

  // mouse parallax
  let mx = 0, my = 0;
  document.addEventListener('mousemove', e => {
    mx = (e.clientX / window.innerWidth  - 0.5) * 2;
    my = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  // ── Interactive data-field grid — reacts to mouse cursor ──
  const GW = 48, GH = 20;                   // grid dimensions
  const GCOUNT = GW * GH;
  const gCur  = new Float32Array(GCOUNT * 3); // current positions
  const gBase = new Float32Array(GCOUNT * 3); // rest positions
  const gCol  = new Float32Array(GCOUNT * 3); // per-point colour

  for (let j = 0; j < GH; j++) {
    for (let i = 0; i < GW; i++) {
      const k = j * GW + i;
      const x = (i / (GW - 1) - 0.5) * 10.5;
      const y = 2.05 + (j / (GH - 1)) * 1.6;
      const z = (j / (GH - 1) - 0.5) * 5.5;
      gBase[k*3] = gCur[k*3] = x;
      gBase[k*3+1] = gCur[k*3+1] = y;
      gBase[k*3+2] = gCur[k*3+2] = z;
      // rest colour: dim cyan
      gCol[k*3] = 0; gCol[k*3+1] = 0.35; gCol[k*3+2] = 0.55;
    }
  }

  const gGeo = new THREE.BufferGeometry();
  gGeo.setAttribute('position', new THREE.BufferAttribute(gCur,  3));
  gGeo.setAttribute('color',    new THREE.BufferAttribute(gCol,  3));
  const gMat = new THREE.PointsMaterial({
    size: 0.05, vertexColors: true,
    transparent: true, opacity: 0.85, sizeAttenuation: true,
  });
  scene.add(new THREE.Points(gGeo, gMat));

  let t = 0;
  const pos = geometry.attributes.position;
  const gp  = gGeo.attributes.position;
  const gc  = gGeo.attributes.color;

  function animate() {
    requestAnimationFrame(animate);
    t += 0.016;

    // vol surface update
    for (let j = 0; j <= N; j++) {
      for (let i = 0; i <= N; i++) {
        const idx = j * (N + 1) + i;
        pos.setY(idx, volHeight(i, j, t));
      }
    }
    pos.needsUpdate = true;
    geometry.computeBoundingSphere();

    // data-field: mouse repulsion + wave + spring-back
    // approximate world-space mouse using camera drift target
    const mwx = mx * 4.2;
    const mwy = 3.0 - my * 1.4;
    const RADIUS = 2.4;

    for (let k = 0; k < GCOUNT; k++) {
      const bx = gBase[k*3], by = gBase[k*3+1], bz = gBase[k*3+2];

      // gentle ambient wave (always alive, even without mouse)
      const wave = Math.sin(t * 0.6 + bx * 0.55 + bz * 0.4) * 0.09;
      const targetY = by + wave;

      // mouse force
      const dx   = gCur[k*3]   - mwx;
      const dy   = gCur[k*3+1] - mwy;
      const dist = Math.sqrt(dx*dx + dy*dy);
      let pushX = 0, pushY = 0;
      if (dist < RADIUS) {
        const strength = Math.pow(1 - dist / RADIUS, 2) * 1.1;
        pushX = (dx / (dist + 0.01)) * strength;
        pushY = (dy / (dist + 0.01)) * strength;
      }

      // spring back toward rest + wave
      gCur[k*3]   += (bx + pushX - gCur[k*3])   * 0.12;
      gCur[k*3+1] += (targetY + pushY - gCur[k*3+1]) * 0.12;

      // colour: dim cyan → bright green as displacement grows
      const disp = Math.max(0, Math.sqrt(pushX*pushX + pushY*pushY));
      const heat = Math.min(disp * 1.2, 1);
      gc.setXYZ(k,
        heat * 0.0,
        0.32 + heat * 0.68,
        0.55 - heat * 0.55
      );
    }
    gp.needsUpdate = true;
    gc.needsUpdate = true;

    // gentle camera drift — kept tight so surface stays centred at rest
    camera.position.x += (mx * 0.55 - camera.position.x) * 0.04;
    camera.position.y += (3.6 - my * 0.3 - camera.position.y) * 0.04;
    camera.lookAt(0, 0.9, 0);

    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', () => {
    const w = canvas.offsetWidth, h = canvas.offsetHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });
}

/* ══════════════════════════════════════════ LIVE GREEKS ════ */
function initGreeks() {
  const els = {
    delta: document.getElementById('g-delta'),
    gamma: document.getElementById('g-gamma'),
    theta: document.getElementById('g-theta'),
    vega:  document.getElementById('g-vega'),
    rho:   document.getElementById('g-rho'),
  };
  const dirs = {
    delta: document.getElementById('gd-delta'),
    gamma: document.getElementById('gd-gamma'),
    theta: document.getElementById('gd-theta'),
    vega:  document.getElementById('gd-vega'),
    rho:   document.getElementById('gd-rho'),
  };

  // Previous values for direction arrows
  const prev = { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 };

  // Each Greek oscillates around a realistic ATM call option baseline
  // using independent sine waves to simulate live fluctuation
  const params = {
    delta: { base: 0.5,   amp: 0.09,  freq: 0.41,  phase: 0.0  },
    gamma: { base: 0.042, amp: 0.012, freq: 0.67,  phase: 1.2  },
    theta: { base:-0.038, amp: 0.010, freq: 0.53,  phase: 2.1  },
    vega:  { base: 0.185, amp: 0.030, freq: 0.38,  phase: 0.8  },
    rho:   { base: 0.092, amp: 0.015, freq: 0.29,  phase: 3.4  },
  };

  let t = 0;
  setInterval(() => {
    t += 0.07;
    Object.entries(params).forEach(([key, p]) => {
      const val = p.base + p.amp * Math.sin(t * p.freq + p.phase)
                         + (p.amp * 0.4) * Math.cos(t * p.freq * 1.7 + p.phase);
      const el  = els[key];
      const dir = dirs[key];
      if (!el) return;

      const isNeg = key === 'theta';
      const display = isNeg
        ? val.toFixed(4)
        : (val >= 0 ? '+' : '') + val.toFixed(4);

      el.textContent = display;

      // colour: theta always red (time decay), others green/red by direction
      if (isNeg) {
        el.style.color = 'var(--red)';
      } else if (val > prev[key]) {
        el.style.color = 'var(--green)';
      } else {
        el.style.color = 'var(--red)';
      }

      if (dir) {
        dir.textContent = val > prev[key] ? '▲' : '▼';
        dir.style.color = val > prev[key] ? 'var(--green)' : 'var(--red)';
      }

      prev[key] = val;
    });
  }, 600);
}

/* ═══════════════════════════════════════ ALPHA COUNTERS ════ */
function initAlphaCounters() {
  const cards = document.querySelectorAll('.alpha-card[data-val]');
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const card = entry.target;
      const target = parseInt(card.dataset.val);
      const numEl  = card.querySelector('.alpha-num');
      if (!numEl) return;
      let current = 0;
      const duration = 1200;
      const steps = 40;
      const increment = target / steps;
      const interval = duration / steps;
      const timer = setInterval(() => {
        current = Math.min(current + increment, target);
        numEl.textContent = Math.round(current);
        if (current >= target) clearInterval(timer);
      }, interval);
      io.unobserve(card);
    });
  }, { threshold: 0.4 });
  cards.forEach(c => io.observe(c));
}

/* ══════════════════════════════════════ SCROLL PROGRESS ════ */
function initScrollProgress() {
  const dots    = document.querySelectorAll('.sp-dot');
  const sections = [...dots].map(d => document.getElementById(d.dataset.section)).filter(Boolean);

  // click to navigate
  dots.forEach((dot, i) => {
    dot.addEventListener('click', () => sections[i]?.scrollIntoView({ behavior: 'smooth' }));
  });

  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const id = entry.target.id;
      dots.forEach(d => d.classList.toggle('active', d.dataset.section === id));
    });
  }, { rootMargin: '-40% 0px -55% 0px' });

  sections.forEach(s => io.observe(s));
}

/* (removed — particles now live in initVolSurface hero scene) */
function initParticleField() {
  const canvas = document.getElementById('particle-canvas');
  if (!canvas || typeof THREE === 'undefined') return;

  const W = canvas.parentElement.clientWidth;
  const H = canvas.parentElement.clientHeight;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(W, H);

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 200);
  camera.position.z = 40;

  const COUNT = 420;
  const positions  = new Float32Array(COUNT * 3);
  const colors     = new Float32Array(COUNT * 3);
  const velocities = [];
  const origins    = new Float32Array(COUNT * 3);

  const palette = [
    [0, 1, 0.53],   // green
    [0, 0.83, 1],   // cyan
    [1, 0.84, 0],   // gold
    [0.4, 0.6, 1],  // blue-ish
  ];

  for (let i = 0; i < COUNT; i++) {
    const x = (Math.random() - 0.5) * 80;
    const y = (Math.random() - 0.5) * 30;
    const z = (Math.random() - 0.5) * 40;
    positions[i*3]   = origins[i*3]   = x;
    positions[i*3+1] = origins[i*3+1] = y;
    positions[i*3+2] = origins[i*3+2] = z;
    velocities.push({ x: 0, y: 0, z: 0 });

    const c = palette[Math.floor(Math.random() * palette.length)];
    const dim = 0.3 + Math.random() * 0.7;
    colors[i*3]   = c[0] * dim;
    colors[i*3+1] = c[1] * dim;
    colors[i*3+2] = c[2] * dim;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    size: 0.55,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    sizeAttenuation: true,
  });

  const points = new THREE.Points(geo, mat);
  scene.add(points);

  // mouse repulsion
  let mx = 0, my = 0;
  const section = document.getElementById('particle-section');
  section.addEventListener('mousemove', e => {
    const rect = section.getBoundingClientRect();
    mx = ((e.clientX - rect.left) / rect.width  - 0.5) * 80;
    my = -((e.clientY - rect.top) / rect.height - 0.5) * 30;
  });
  section.addEventListener('mouseleave', () => { mx = 9999; my = 9999; });

  let t = 0;
  const pos = geo.attributes.position;

  function animate() {
    requestAnimationFrame(animate);
    t += 0.012;

    for (let i = 0; i < COUNT; i++) {
      const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);

      // gentle drift
      const drift = 0.004;
      pos.setX(i, px + Math.sin(t * 0.3 + i * 0.17) * drift);
      pos.setY(i, py + Math.cos(t * 0.25 + i * 0.13) * drift);

      // mouse repulsion
      const dx = px - mx, dy = py - my;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < 12) {
        const force = (12 - dist) / 12 * 0.18;
        velocities[i].x += (dx / dist) * force;
        velocities[i].y += (dy / dist) * force;
      }

      // spring back to origin
      velocities[i].x += (origins[i*3]   - px) * 0.015;
      velocities[i].y += (origins[i*3+1] - py) * 0.015;
      velocities[i].x *= 0.88;
      velocities[i].y *= 0.88;

      pos.setX(i, pos.getX(i) + velocities[i].x);
      pos.setY(i, pos.getY(i) + velocities[i].y);
    }
    pos.needsUpdate = true;

    points.rotation.y = Math.sin(t * 0.05) * 0.08;
    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', () => {
    const nW = canvas.parentElement.clientWidth;
    const nH = canvas.parentElement.clientHeight;
    renderer.setSize(nW, nH);
    camera.aspect = nW / nH;
    camera.updateProjectionMatrix();
  });
}

/* ═══════════════════════════════════════════════ BOOT SEQUENCE ════ */
function initBootSequence() {
  const lines = [
    '> INITIALIZING PORTFOLIO.EXE...',
    '> LOADING BLACK-SCHOLES ENGINE...',
    '> COMPILING QUANT MODULES... [OK]',
    '> SYSTEM READY. WELCOME.',
  ];
  const ids = ['bl-1', 'bl-2', 'bl-3', 'bl-4'];

  ids.forEach((id, i) => {
    setTimeout(() => {
      const el = document.getElementById(id);
      if (!el) return;
      typeText(el, lines[i], 28);
      el.classList.add('show');
    }, i * 700);
  });

  // show name + tagline after boot
  setTimeout(() => {
    const name = document.getElementById('hero-name');
    if (name) name.classList.add('show');
  }, lines.length * 700 + 200);

  setTimeout(() => {
    initTaglineTyper();
  }, lines.length * 700 + 800);
}

function typeText(el, text, speed = 30) {
  // kept for legacy callers — unused by tagline
  el.textContent = '';
  let i = 0;
  const iv = setInterval(() => { el.textContent += text[i++]; if (i >= text.length) clearInterval(iv); }, speed);
}

function initTaglineTyper() {
  const el = document.getElementById('hero-tagline');
  if (!el) return;

  const GLYPHS = 'αβγδεζηθλμνξπρστφψωΩΣΔΨΦΞΛ∂∇≈≠∞∑∫∏√⟨⟩|{}[]01#$%';
  const phrases = [
    'MS Financial Engineering @ NYU Tandon',
    'Quant Developer & Researcher',
    'Stochastic Modelling | ML in Finance',
    'Turning math into alpha.',
  ];
  let pi = 0;

  // Scramble-reveal: random glyphs → resolve left-to-right over `dur` ms
  function scrambleIn(target, dur, onDone) {
    const len = target.length;
    const start = performance.now();
    function frame(now) {
      const pct      = Math.min((now - start) / dur, 1);
      const resolved = Math.floor(pct * len);
      let out = '';
      for (let i = 0; i < len; i++) {
        if (target[i] === ' ') { out += ' '; continue; }
        out += i < resolved
          ? target[i]
          : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      }
      el.textContent = out;
      if (pct < 1) requestAnimationFrame(frame);
      else { el.textContent = target; onDone && onDone(); }
    }
    requestAnimationFrame(frame);
  }

  function cycle() {
    const phrase = phrases[pi];
    scrambleIn(phrase, 820, () => {
      // hold, then scramble directly into next phrase — no deletion
      setTimeout(() => {
        pi = (pi + 1) % phrases.length;
        cycle();
      }, 3000);
    });
  }
  cycle();
}

/* ════════════════════════════════════════════════ NAV SCROLL ════ */
function initNavScroll() {
  const sections  = document.querySelectorAll('section[id]');
  const navLinks  = document.querySelectorAll('.nav-link');
  const navbar    = document.getElementById('navbar');

  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute('id');
        navLinks.forEach(l => {
          l.classList.toggle('active', l.getAttribute('href') === `#${id}`);
        });
      }
    });
  }, { rootMargin: '-40% 0px -55% 0px' });

  sections.forEach(s => io.observe(s));

  // smooth background change on scroll
  window.addEventListener('scroll', () => {
    navbar.style.background = window.scrollY > 60
      ? 'rgba(5,8,16,0.97)'
      : 'rgba(10,14,26,0.92)';
  }, { passive: true });

  // Hamburger menu toggle
  const hamburger = document.getElementById('nav-hamburger');
  const navLinksUl = document.getElementById('nav-links');
  if (hamburger && navLinksUl) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('open');
      navLinksUl.classList.toggle('open');
    });
    // Close menu when a link is tapped
    navLinksUl.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('open');
        navLinksUl.classList.remove('open');
      });
    });
  }
}

/* ══════════════════════════════════════════ SCROLL REVEAL ════ */
function initScrollReveal() {
  const els = document.querySelectorAll('.section-reveal');
  const io  = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });
  els.forEach(el => io.observe(el));
}

/* ══════════════════════════════════════ EXP-MINI ACCORDION ════ */
function initExpMini() {
  // Greek / math scramble characters
  const SCRAMBLE_CHARS = 'αβγδεζηθλμνξπρστφψωΩΣΔΨΦ∂∇≈≠∞∑∫01()[]{}|#$%';

  function scrambleText(el, targetText, duration) {
    const steps = Math.ceil(duration / 30);
    let step = 0;
    const interval = setInterval(() => {
      const progress = step / steps;
      // number of characters resolved so far (left-to-right reveal)
      const resolved = Math.floor(progress * targetText.length);
      let output = '';
      for (let i = 0; i < targetText.length; i++) {
        if (targetText[i] === ' ') { output += ' '; continue; }
        if (i < resolved) {
          output += targetText[i];
        } else {
          output += SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
        }
      }
      el.textContent = output;
      step++;
      if (step > steps) {
        clearInterval(interval);
        el.textContent = targetText;
      }
    }, 30);
  }

  function openItem(item) {
    item.classList.add('is-open');
    const btn = item.querySelector('.emi-toggle');
    if (btn) btn.textContent = '+';   // rotation via CSS handles visual

    // scramble each bullet point
    item.querySelectorAll('.emi-points li').forEach((li, idx) => {
      const target = li.dataset.text || li.textContent;
      li.textContent = '';
      // stagger start: match the CSS transition-delay
      setTimeout(() => scrambleText(li, target, 520), 250 + idx * 110);
    });
  }

  function closeItem(item) {
    item.classList.remove('is-open');
    // reset bullet text to empty (will scramble in again on next open)
    item.querySelectorAll('.emi-points li').forEach(li => {
      li.textContent = '';
    });
  }

  document.querySelectorAll('.exp-mini-item').forEach(item => {
    const header = item.querySelector('.emi-header');
    if (!header) return;

    // Store original data-text if not yet set (first paint)
    item.querySelectorAll('.emi-points li').forEach(li => {
      if (!li.dataset.text && li.textContent.trim()) {
        li.dataset.text = li.textContent.trim();
      }
      li.textContent = '';
    });

    header.addEventListener('click', () => {
      const isOpen = item.classList.contains('is-open');
      // close all first
      document.querySelectorAll('.exp-mini-item.is-open').forEach(other => {
        if (other !== item) closeItem(other);
      });
      if (isOpen) {
        closeItem(item);
      } else {
        openItem(item);
      }
    });
  });
}

/* ══════════════════════════════════════════ MONTE CARLO ════ */
function initMonteCarlo() {
  const canvas = document.getElementById('mc-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { willReadFrequently: false });
  const btn    = document.getElementById('mc-run');
  const nEl    = document.getElementById('mc-n');
  const stEl   = document.getElementById('mc-status');
  const panel  = document.getElementById('work-info');

  const STEPS = 252;

  // ── Real data: each path = an internship or project. Sorted newest → oldest.
  //   label = short chart label (role for internship, project name for project)
  const DATA = [
    {
      label: 'Unspanned Factor Premia',
      kind: 'PROJECT', kindColor: 'var(--cyan)', kindRgba: '0,212,255',
      rgba: [0,212,255], mu: 0.26, sigma: 0.22,
      title: 'Unspanned Factor Premia in Sovereign Bond Markets',
      sub: 'NYU Tandon School of Engineering',
      date: 'Feb 2026 — Mar 2026',
      bullets: [
        'Built a cross-country long-short strategy for 10Y sovereign bond futures across 6 developed markets using Carry, Value, Momentum & Economic Surprise signals — monthly rebalancing on Bloomberg data (2004–2025)',
        'Showed equity-style factors explain 49% of cross-sectional bond return variation vs. 0.2% for yield-curve PCs — extending Brooks–Moskowitz (2017) with a novel CESI factor',
        'Regime-conditional analysis: Sharpe 0.62 in high-yield, 0.84 in flat-curve regimes; alpha regressions with robust SE validate orthogonality to curve shape'
      ],
      tags: ['#Carry','#Value','#Momentum','#CESI','#Bloomberg','#Sharpe','#BondFutures'],
      metric: { lbl: 'SHARPE', val: '0.84' }
    },
    {
      label: 'Cross-Currency Stablecoin',
      kind: 'PROJECT', kindColor: 'var(--green)', kindRgba: '0,255,136',
      rgba: [0,255,136], mu: 0.19, sigma: 0.28,
      title: 'Cross-Currency Dynamics of Stablecoin Risk & Market Dislocation',
      sub: 'NYU Tandon School of Engineering',
      date: 'Jan 2026 — Feb 2026',
      bullets: [
        'Analyzed BTC/USD, BTC/USDT & BTC/USDC high-frequency data during the 2023 SVB crisis to model stablecoin de-pegging and systemic liquidity bottlenecks',
        'Decomposed market spreads into funding risk and exchange friction — volatility surged from 3.0 bps to 42.3 bps during the crisis regime',
        'Backtested arbitrage vs. 40-bps and 92-bps cost hurdles — proved legacy banking-hour latency blocks retail participants from exploiting market inefficiencies'
      ],
      tags: ['#Stablecoin','#HFT','#BasisTrading','#Liquidity','#SVB','#Arbitrage'],
      metric: { lbl: 'VOL JUMP', val: '14×' }
    },
    {
      label: 'Compound Option Pricing',
      kind: 'PROJECT', kindColor: 'var(--cyan)', kindRgba: '0,212,255',
      rgba: [0,212,255], mu: 0.20, sigma: 0.26,
      title: 'Compound Option Pricing & Sensitivity Analysis',
      sub: 'NYU Tandon · Finance & Risk Engineering',
      date: '11/25 — 12/25',
      bullets: [
        'Priced nested compound options using GBM + Monte Carlo simulation',
        'Derived Greeks via finite-difference methods for risk management',
        'Sensitivity analysis across strike, vol & maturity surfaces'
      ],
      tags: ['#GBM','#MonteCarlo','#Greeks','#FiniteDiff'],
      metric: { lbl: 'PATHS', val: '10⁵' }
    },
    {
      label: 'ML Equity Return Prediction',
      kind: 'PROJECT', kindColor: 'var(--green)', kindRgba: '0,255,136',
      rgba: [0,255,136], mu: 0.24, sigma: 0.21,
      title: 'Machine Learning for Equity Return Prediction & Portfolio Optimization',
      sub: 'NYU Tandon School of Engineering',
      date: 'Oct 2025 — Dec 2025',
      bullets: [
        'Developed multi-factor return prediction framework with XGBoost and LSTM on 10+ years of S&P 500 constituents — technical indicators, macro variables & NLP-derived sentiment from earnings calls',
        'Engineered a mean-variance portfolio optimization layer on top of ML return forecasts with Sharpe maximization under L1/L2 regularization',
        '+14% improvement in risk-adjusted returns vs. benchmark in walk-forward backtesting'
      ],
      tags: ['#XGBoost','#LSTM','#NLP','#MeanVariance','#SharpeMax','#WalkForward'],
      metric: { lbl: 'RISK-ADJ', val: '+14%' }
    },
    {
      label: 'Quant Trading Analyst',
      kind: 'INTERNSHIP', kindColor: 'var(--green)', kindRgba: '0,255,136',
      rgba: [0,255,136], mu: 0.22, sigma: 0.19,
      title: 'Quant Trading Analyst Intern',
      sub: 'Shah Investors Home Ltd · Ahmedabad',
      date: '01/25 — 05/25',
      bullets: [
        'Built option selling strategies using Black-Scholes, Monte Carlo & Greeks — avoided 2 major loss events',
        '+4% revenue uplift via Power BI brokerage trend analysis',
        '−40% messaging costs via platform optimisation',
        'Bull-bear algo trading strategy in Python (AceEquity)'
      ],
      tags: ['#BlackScholes','#MonteCarlo','#Greeks','#Python','#PowerBI'],
      metric: { lbl: 'ALPHA', val: '+4%' }
    },
    {
      label: 'Stochastic Rate Modelling',
      kind: 'PROJECT', kindColor: 'var(--cyan)', kindRgba: '0,212,255',
      rgba: [0,212,255], mu: 0.13, sigma: 0.18,
      title: 'Stochastic Interest Rate Modelling',
      sub: 'Independent Research · Ahmedabad',
      date: '02/25 — 03/25',
      bullets: [
        'Calibrated Vasicek & CIR models via Maximum Likelihood Estimation',
        'Mean reversion analysis on historical treasury yield curves',
        'Simulated short-rate paths for bond pricing'
      ],
      tags: ['#Vasicek','#CIR','#MLE','#MeanReversion'],
      metric: { lbl: 'MODELS', val: '2' }
    },
    {
      label: 'Quant Analyst',
      kind: 'INTERNSHIP', kindColor: 'var(--cyan)', kindRgba: '0,212,255',
      rgba: [0,212,255], mu: 0.15, sigma: 0.24,
      title: 'Quant Analyst Intern',
      sub: 'CRM Messaging · Delaware (Remote)',
      date: '07/24 — 08/24',
      bullets: [
        'NLP feature extraction on customer chat data + quant engagement metrics',
        '+9% targeting reach through ML-driven message optimisation',
        '+6% organic traffic via statistical bottleneck analysis'
      ],
      tags: ['#NLP','#FeatureExtraction','#Stats'],
      metric: { lbl: 'REACH', val: '+9%' }
    },
    {
      label: 'Quant Developer',
      kind: 'INTERNSHIP', kindColor: 'var(--green)', kindRgba: '0,255,136',
      rgba: [0,255,136], mu: 0.17, sigma: 0.21,
      title: 'Quant Developer Intern',
      sub: 'Genesis AI Pvt. Ltd · Ahmedabad',
      date: '01/24 — 03/24',
      bullets: [
        'Statistical classification methods to structure financial datasets',
        'Automated ITR document classification via Python + AWS',
        '+40% parse-rate improvement on financial document pipeline'
      ],
      tags: ['#Python','#AWS','#Classification','#FinData'],
      metric: { lbl: 'PARSE', val: '+40%' }
    },
    {
      label: 'Medical Decision GPT ★',
      kind: 'PROJECT ★', kindColor: 'var(--gold)', kindRgba: '255,215,0',
      rgba: [255,215,0], mu: 0.28, sigma: 0.22,
      title: 'Enhancing Medical Decision Support Using GPT',
      sub: 'SRM IST · Dept. of Computing Technologies',
      date: '07/23 — 12/23',
      bullets: [
        'Fine-tuned GPT with LoRA adapters for clinical decision support',
        'HuggingFace transformer pipeline + parameter-efficient training',
        '★ BEST PAPER Award — FCOM-Fintech 2024'
      ],
      tags: ['#LoRA','#Transformers','#FineTuning','#HuggingFace'],
      metric: { lbl: 'AWARD', val: '★ BEST' }
    },
    {
      label: 'Technical Intern',
      kind: 'INTERNSHIP', kindColor: 'var(--cyan)', kindRgba: '0,212,255',
      rgba: [0,212,255], mu: 0.12, sigma: 0.17,
      title: 'Technical Intern',
      sub: 'TriState Technology LLP · Ahmedabad (Hybrid)',
      date: 'Jun 2023 — Nov 2023',
      bullets: [
        'Managed and cleaned 100,000+ rows of structured and unstructured data for business-intelligence applications',
        'Contributed to 10+ dashboards and reports, enhancing data-driven decision-making across key operational teams'
      ],
      tags: ['#DataCleaning','#BI','#Dashboards','#SQL','#ETL'],
      metric: { lbl: 'ROWS', val: '100K+' }
    },
    {
      label: 'Bellabeat Case Study',
      kind: 'PROJECT', kindColor: 'var(--green)', kindRgba: '0,255,136',
      rgba: [0,255,136], mu: 0.10, sigma: 0.20,
      title: 'Bellabeat Case Study',
      sub: 'Google Data Analytics Capstone',
      date: '2023',
      bullets: [
        'Developed an end-to-end data processing workflow: cleaning, visualization & insights extraction',
        'Used R, BigQuery, Tableau & Python to analyze smart-device fitness tracker data',
        'Delivered actionable marketing recommendations from behavioural segmentation'
      ],
      tags: ['#R','#BigQuery','#Tableau','#Python','#EDA'],
      metric: { lbl: 'TOOLS', val: '4' }
    },
    {
      label: 'Virtual Hand Cursor',
      kind: 'PROJECT', kindColor: 'var(--cyan)', kindRgba: '0,212,255',
      rgba: [0,212,255], mu: 0.08, sigma: 0.23,
      title: 'Virtual Hand Cursor Control',
      sub: 'Computer Vision · OpenCV',
      date: '2022',
      bullets: [
        'Built a gesture-based cursor control system using computer vision — no external hardware required',
        'Implemented hand-tracking algorithms to detect and map hand movements to screen coordinates',
        'Enhanced human-computer interaction and accessibility through natural gesture input'
      ],
      tags: ['#OpenCV','#ComputerVision','#HandTracking','#Python','#A11y'],
      metric: { lbl: 'HW', val: 'NONE' }
    }
  ];

  // Canvas state
  let W = 0, H = 0;
  // Safari on iOS can report DPR 3 — cap at 2 for canvas perf / memory
  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  const resize = () => {
    const r = canvas.getBoundingClientRect();
    canvas.width  = Math.round(r.width  * DPR);
    canvas.height = Math.round(r.height * DPR);
    canvas.style.width  = r.width  + 'px';
    canvas.style.height = r.height + 'px';
    ctx.setTransform(1,0,0,1,0,0);
    ctx.scale(DPR, DPR);
    W = r.width;
    H = r.height;
    draw();
  };

  // Simulation state
  let paths = [];  // { data, pts, progress, nodeX, nodeY }
  let bounds = { min: 95, max: 105 };
  let running = false;
  let frame = 0;
  let activeIdx = -1;
  let done = false;

  // Box-Muller normal
  const randn = () => {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  const generatePath = (mu, sigma) => {
    const pts = [100];
    const dt  = 1 / 252;
    for (let i = 1; i < STEPS; i++) {
      const z = randn();
      const prev = pts[i - 1];
      pts.push(prev * Math.exp((mu - sigma * sigma / 2) * dt + sigma * Math.sqrt(dt) * z));
    }
    return pts;
  };

  // Force endpoint separation so labels are readable.
  // Paths are ranked strictly by DATA order: index 0 (most recent) ends at top,
  // last index ends at bottom. Interior path shapes stay random.
  const spreadEndpoints = () => {
    const n = paths.length;
    if (n < 2) return;

    // Natural span of current endpoints → gives us a reasonable price scale
    let lo =  Infinity, hi = -Infinity;
    paths.forEach(p => {
      const v = p.pts[STEPS - 1];
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    });
    const mean = (lo + hi) / 2;
    const MIN_SPAN = Math.max(hi - lo, mean * 0.75); // elongated vertical range
    const half = MIN_SPAN / 2;
    const base = mean - half;
    const step = MIN_SPAN / (n - 1);

    const BLEND = 110; // longer blend so re-routing looks organic
    paths.forEach((p, i) => {
      // Index 0 (newest) → top (highest value). Last index → bottom.
      const rank = (n - 1) - i;
      const target = base + rank * step;
      const diff   = target - p.pts[STEPS - 1];
      for (let k = 0; k < BLEND; k++) {
        const t = k / (BLEND - 1);
        const ease = t * t * (3 - 2 * t); // smoothstep
        p.pts[STEPS - BLEND + k] += diff * ease;
      }
    });
  };

  const padL = 60, padR = 200, padT = 14, padB = 28;
  const chartRect = () => ({ x: padL, y: padT, w: W - padL - padR, h: H - padT - padB });

  const toPx = (i, v) => {
    const c = chartRect();
    const x = c.x + (i / (STEPS - 1)) * c.w;
    const y = c.y + c.h - ((v - bounds.min) / (bounds.max - bounds.min)) * c.h;
    return { x, y };
  };

  const drawAxes = () => {
    const c = chartRect();
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(138,154,179,.5)';
    ctx.strokeStyle = 'rgba(42,48,61,.6)';
    ctx.lineWidth = 1;

    // y grid + labels (5 lines)
    for (let k = 0; k <= 4; k++) {
      const v = bounds.min + (bounds.max - bounds.min) * (k / 4);
      const y = c.y + c.h - (k / 4) * c.h;
      ctx.beginPath();
      ctx.moveTo(c.x, y);
      ctx.lineTo(c.x + c.w, y);
      ctx.stroke();
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(v.toFixed(0), c.x - 8, y);
    }

    // x axis
    ctx.strokeStyle = 'rgba(42,48,61,.9)';
    ctx.beginPath();
    ctx.moveTo(c.x, c.y + c.h);
    ctx.lineTo(c.x + c.w, c.y + c.h);
    ctx.stroke();

    // x labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ['t=0','t=½','t=1'].forEach((lbl, i) => {
      const x = c.x + (i / 2) * c.w;
      ctx.fillText(lbl, x, c.y + c.h + 8);
    });

    // chart title
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(0,212,255,.7)';
    const titleSize = W < 500 ? 7 : 9;
    ctx.font = `${titleSize}px "JetBrains Mono", monospace`;
    ctx.fillText('GBM PRICE PATHS · S₀=100', c.x, 2);
  };

  const drawPath = (p, idx) => {
    const prog = p.progress | 0;
    if (prog < 2) return;
    const dim = activeIdx !== -1 && activeIdx !== idx;
    const alpha = dim ? 0.18 : 0.85;
    const lw    = activeIdx === idx ? 2.3 : 1.5;

    ctx.beginPath();
    for (let i = 0; i < prog; i++) {
      const { x, y } = toPx(i, p.pts[i]);
      if (i === 0) ctx.moveTo(x, y);
      else         ctx.lineTo(x, y);
    }
    ctx.lineWidth = lw;
    ctx.strokeStyle = `rgba(${p.data.rgba.join(',')},${alpha})`;
    ctx.shadowBlur = activeIdx === idx ? 14 : (dim ? 0 : 6);
    ctx.shadowColor = `rgba(${p.data.rgba.join(',')},0.7)`;
    ctx.stroke();
    ctx.shadowBlur = 0;
  };

  const drawNode = (p, idx) => {
    const lastI = (p.progress | 0) - 1;
    if (lastI < STEPS - 1) return;
    const { x, y } = toPx(STEPS - 1, p.pts[STEPS - 1]);
    p.nodeX = x;
    p.nodeY = y;

    const dim = activeIdx !== -1 && activeIdx !== idx;

    // outer pulse ring
    ctx.beginPath();
    ctx.arc(x, y, activeIdx === idx ? 10 : 7, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${p.data.rgba.join(',')},${dim ? 0.15 : 0.45})`;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // core dot
    ctx.beginPath();
    ctx.arc(x, y, activeIdx === idx ? 5 : 4, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${p.data.rgba.join(',')},${dim ? 0.35 : 1})`;
    ctx.shadowColor = `rgba(${p.data.rgba.join(',')},0.9)`;
    ctx.shadowBlur = dim ? 0 : 12;
    ctx.fill();
    ctx.shadowBlur = 0;

    // label
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = `rgba(${p.data.rgba.join(',')},${dim ? 0.35 : 0.95})`;
    ctx.fillText(p.data.label, x + 8, y);
  };

  const draw = () => {
    if (!W || !H) return;
    ctx.clearRect(0, 0, W, H);
    drawAxes();
    paths.forEach((p, i) => drawPath(p, i));
    paths.forEach((p, i) => drawNode(p, i));
  };

  const computeBounds = () => {
    let lo = Infinity, hi = -Infinity;
    paths.forEach(p => {
      p.pts.forEach(v => { if (v < lo) lo = v; if (v > hi) hi = v; });
    });
    const pad = (hi - lo) * 0.08;
    bounds.min = lo - pad;
    bounds.max = hi + pad;
  };

  const animate = () => {
    if (!running) return;
    frame++;
    let allDone = true;
    let doneCount = 0;
    paths.forEach((p, i) => {
      const startFrame = i * 14;
      const target = Math.max(0, Math.min(STEPS, (frame - startFrame) * 2.2));
      p.progress = target;
      if (target < STEPS) allDone = false;
      else doneCount++;
    });
    nEl.textContent = `${doneCount} / ${paths.length}`;
    draw();
    if (!allDone) requestAnimationFrame(animate);
    else {
      running = false;
      done = true;
      stEl.textContent = 'COMPLETE';
      btn.disabled = false;
    }
  };

  const runSim = () => {
    if (running) return;
    paths = DATA.map(d => ({ data: d, pts: generatePath(d.mu, d.sigma), progress: 0, nodeX: 0, nodeY: 0 }));
    spreadEndpoints();
    computeBounds();
    frame = 0;
    running = true;
    done = false;
    activeIdx = -1;
    btn.disabled = true;
    stEl.textContent = 'RUNNING…';
    nEl.textContent = `0 / ${paths.length}`;
    resetPanel();
    requestAnimationFrame(animate);
  };

  const resetPanel = () => {
    panel.innerHTML = `<div class="wi-placeholder"><span class="wi-prompt">&gt;_</span> Simulation complete.<br>Hover a terminal node to inspect path details.</div>`;
  };

  // Greek / math scramble chars
  const MC_GLYPHS = 'αβγδεζηθλμνξπρστφψωΩΣΔΨΦΞΛ∂∇≈≠∞∑∫∏√⟨⟩|{}[]01#$%';
  const scrambleTimers = [];
  const clearScrambleTimers = () => {
    scrambleTimers.forEach(t => clearInterval(t));
    scrambleTimers.length = 0;
  };
  const scrambleEl = (el, target, dur, delay) => {
    const start = () => {
      const steps = Math.ceil(dur / 28);
      let step = 0;
      el.textContent = '';
      const iv = setInterval(() => {
        const prog = step / steps;
        const resolved = Math.floor(prog * target.length);
        let out = '';
        for (let i = 0; i < target.length; i++) {
          const ch = target[i];
          if (ch === ' ' || ch === '\n') { out += ch; continue; }
          if (i < resolved) out += ch;
          else out += MC_GLYPHS[Math.floor(Math.random() * MC_GLYPHS.length)];
        }
        el.textContent = out;
        step++;
        if (step > steps) {
          clearInterval(iv);
          el.textContent = target;
        }
      }, 28);
      scrambleTimers.push(iv);
    };
    if (delay > 0) {
      const to = setTimeout(start, delay);
      scrambleTimers.push(to);
    } else start();
  };

  const renderPanel = (d) => {
    clearScrambleTimers();
    const bullets = d.bullets.map(b => `<li data-text="${b.replace(/"/g,'&quot;')}"></li>`).join('');
    const tags    = d.tags.map(t => `<span data-text="${t}"></span>`).join('');
    panel.innerHTML = `
      <span class="wi-kind" style="color:${d.kindColor};border-color:rgba(${d.kindRgba},.45)" data-text="${d.kind}"></span>
      <h3 class="wi-title" data-text="${d.title.replace(/"/g,'&quot;')}"></h3>
      <p class="wi-sub" data-text="${d.sub}"></p>
      <p class="wi-date" data-text="${d.date}"></p>
      <ul class="wi-bullets">${bullets}</ul>
      <div class="wi-tags">${tags}</div>
      <div class="wi-metrics">
        <div class="wi-metric"><span class="wi-metric-lbl">DRIFT μ</span><span class="wi-metric-val" data-text="${d.mu.toFixed(2)}"></span></div>
        <div class="wi-metric"><span class="wi-metric-lbl">VOL σ</span><span class="wi-metric-val" data-text="${d.sigma.toFixed(2)}"></span></div>
        <div class="wi-metric"><span class="wi-metric-lbl">${d.metric.lbl}</span><span class="wi-metric-val" data-text="${d.metric.val}"></span></div>
      </div>
    `;

    // Kick off scramble on every element with data-text, staggered
    const queue = [
      { sel: '.wi-kind',       dur: 320, delay: 0   },
      { sel: '.wi-title',      dur: 560, delay: 80  },
      { sel: '.wi-sub',        dur: 420, delay: 220 },
      { sel: '.wi-date',       dur: 360, delay: 320 },
    ];
    queue.forEach(q => {
      const el = panel.querySelector(q.sel);
      if (el) scrambleEl(el, el.dataset.text, q.dur, q.delay);
    });
    panel.querySelectorAll('.wi-bullets li').forEach((li, i) => {
      scrambleEl(li, li.dataset.text, 520, 420 + i * 110);
    });
    panel.querySelectorAll('.wi-tags span').forEach((sp, i) => {
      scrambleEl(sp, sp.dataset.text, 320, 860 + i * 60);
    });
    panel.querySelectorAll('.wi-metric-val').forEach((m, i) => {
      scrambleEl(m, m.dataset.text, 360, 1000 + i * 90);
    });
  };

  // Hover detection → highlights nearest path/node and pops the floating panel
  let pointerOnPanel = false;
  const showPanel = () => panel.classList.add('visible');
  const hidePanel = () => {
    panel.classList.remove('visible');
    activeIdx = -1;
    draw();
  };

  canvas.addEventListener('mousemove', (e) => {
    if (!done) return;
    const r = canvas.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    let nearest = -1;
    let minD = 60;
    // First: closest terminal node
    paths.forEach((p, i) => {
      const d = Math.hypot(mx - p.nodeX, my - p.nodeY);
      if (d < minD) { minD = d; nearest = i; }
    });
    // Second: nearest path line (so hovering anywhere on a line triggers)
    if (nearest === -1) {
      let bestLineD = 16;
      paths.forEach((p, i) => {
        const c = chartRect();
        if (mx < c.x || mx > c.x + c.w) return;
        const t = (mx - c.x) / c.w;
        const iFloat = t * (STEPS - 1);
        const i0 = Math.floor(iFloat);
        const i1 = Math.min(STEPS - 1, i0 + 1);
        const frac = iFloat - i0;
        const v = p.pts[i0] * (1 - frac) + p.pts[i1] * frac;
        const { y } = toPx(i0, v);
        const d = Math.abs(my - y);
        if (d < bestLineD) { bestLineD = d; nearest = i; }
      });
    }
    if (nearest >= 0) {
      if (nearest !== activeIdx) {
        activeIdx = nearest;
        renderPanel(paths[nearest].data);
        draw();
      }
      showPanel();
    }
    canvas.style.cursor = nearest >= 0 ? 'pointer' : 'default';
  });

  canvas.addEventListener('mouseleave', () => {
    // Defer hide so user can move into the panel
    setTimeout(() => { if (!pointerOnPanel) hidePanel(); }, 80);
  });

  panel.addEventListener('mouseenter', () => { pointerOnPanel = true; showPanel(); });
  panel.addEventListener('mouseleave', () => {
    pointerOnPanel = false;
    setTimeout(() => { if (!pointerOnPanel) hidePanel(); }, 80);
  });

  btn.addEventListener('click', runSim);
  window.addEventListener('resize', () => {
    resize();
    if (done) draw();
  });

  // Auto-run when section scrolls into view
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !done && !running) {
        runSim();
        io.unobserve(canvas);
      }
    });
  }, { threshold: 0.3 });
  io.observe(canvas);

  resize();
}

/* ══════════════════════════════════════════ HUD PANEL ════ */
function initHudPanel() {
  // Live NY clock + NYSE session state
  const clock = document.getElementById('hud-clock');
  const dot   = document.getElementById('hud-mkt-dot');
  const state = document.getElementById('hud-mkt-state');
  if (!clock) return;

  const update = () => {
    const now = new Date();
    // HH:MM:SS in America/New_York
    clock.textContent = now.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      hour12: false,
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    // Weekday + hour + minute in NY
    const meta = now.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      weekday: 'short',
      hour12: false,
      hour: '2-digit', minute: '2-digit'
    });
    const m = meta.match(/(\w+),?\s*(\d{1,2}):(\d{2})/);
    if (!m) return;
    const day = m[1];
    const mins = parseInt(m[2], 10) * 60 + parseInt(m[3], 10);
    const isWeekday = ['Mon','Tue','Wed','Thu','Fri'].includes(day);

    let cls = 'closed', txt = 'NYSE CLOSED';
    if (isWeekday) {
      if (mins >= 570 && mins < 960) { cls = 'open'; txt = 'NYSE OPEN'; }       // 09:30–16:00
      else if (mins >= 240 && mins < 570) { cls = 'pre'; txt = 'PRE-MARKET'; }  // 04:00–09:30
      else if (mins >= 960 && mins < 1200) { cls = 'pre'; txt = 'AFTER-HOURS'; }// 16:00–20:00
    }
    dot.className = 'hud-dot ' + cls;
    state.textContent = txt;
  };
  update();
  setInterval(update, 1000);
}

/* ══════════════════════════════════════════ DECK DEAL ════ */
function randomizeCards(cards) {
  const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  const SUITS = [
    { s: '♠', color: 'var(--cyan)',  rgba: '0,212,255' },
    { s: '♥', color: 'var(--green)', rgba: '0,255,136' },
    { s: '♦', color: 'var(--gold)',  rgba: '255,215,0' },
    { s: '♣', color: 'var(--cyan)',  rgba: '0,212,255' }
  ];
  // unique rank+suit combos
  const used = new Set();
  const pickUnique = () => {
    while (true) {
      const r = RANKS[Math.floor(Math.random() * RANKS.length)];
      const s = SUITS[Math.floor(Math.random() * SUITS.length)];
      const key = r + s.s;
      if (!used.has(key)) { used.add(key); return { r, s }; }
    }
  };
  const hand = [];
  cards.forEach(card => {
    const { r, s } = pickUnique();
    hand.push(r + s.s);
    card.style.setProperty('--sc', s.color);
    card.querySelectorAll('.pc-rank').forEach(el => el.textContent = r);
    card.querySelectorAll('.pc-si').forEach(el => el.textContent = s.s);
    const wm = card.querySelector('.pc-wm');
    if (wm) wm.textContent = s.s;
    const badge = card.querySelector('.pc-badge');
    if (badge) {
      badge.style.color = s.color;
      badge.style.borderColor = `rgba(${s.rgba},.4)`;
    }
  });
  // update deck-meta hand readout
  const handEl = document.getElementById('deck-meta-hand');
  if (handEl) handEl.innerHTML = hand.join(' &nbsp; ');
  const evalEl = document.getElementById('deck-meta-eval');
  if (evalEl) {
    evalEl.innerHTML = evaluateHand(hand) + ' <span class="deck-meta-star">★ BEST PAPER</span>';
  }
}

function evaluateHand(hand) {
  const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
  const ranks = hand.map(h => h.replace(/[♠♥♦♣]/g,''));
  const suits = hand.map(h => h.replace(/[^♠♥♦♣]/g,''));
  const counts = {};
  ranks.forEach(r => counts[r] = (counts[r]||0) + 1);
  const pairs = Object.values(counts).sort((a,b) => b-a);
  const suitCounts = {};
  suits.forEach(s => suitCounts[s] = (suitCounts[s]||0) + 1);
  const flushN = Math.max(...Object.values(suitCounts));
  if (pairs[0] >= 4) return 'FOUR OF A KIND';
  if (pairs[0] === 3 && pairs[1] >= 2) return 'FULL HOUSE';
  if (flushN >= 5) return 'FLUSH';
  if (pairs[0] === 3) return 'THREE OF A KIND';
  if (pairs[0] === 2 && pairs[1] === 2) return 'TWO PAIR';
  if (pairs[0] === 2) return 'PAIR';
  const idxs = [...new Set(ranks.map(r => RANKS.indexOf(r)))].sort((a,b)=>a-b);
  let run = 1, best = 1;
  for (let i = 1; i < idxs.length; i++) {
    if (idxs[i] === idxs[i-1] + 1) { run++; best = Math.max(best, run); }
    else run = 1;
  }
  if (best >= 5) return 'STRAIGHT';
  return 'HIGH CARD';
}

function initDeckDeal() {
  const grid = document.getElementById('deck-grid');
  if (!grid) return;
  const cards = Array.from(grid.querySelectorAll('.play-card'));
  if (!cards.length) return;
  randomizeCards(cards);

  // Compute each card's translate-to-center offset and deal/flip delays
  const computeOffsets = () => {
    const gridRect = grid.getBoundingClientRect();
    const cx = gridRect.left + gridRect.width  / 2;
    const cy = gridRect.top  + gridRect.height / 2;
    cards.forEach((card, i) => {
      const r   = card.getBoundingClientRect();
      const crX = r.left + r.width  / 2;
      const crY = r.top  + r.height / 2;
      card.style.setProperty('--dx', `${(cx - crX).toFixed(1)}px`);
      card.style.setProperty('--dy', `${(cy - crY).toFixed(1)}px`);
      card.style.setProperty('--i', i);
      card.style.setProperty('--stack-rot', `${(Math.sin(i * 1.7) * 7).toFixed(2)}deg`);
      card.style.setProperty('--deal-delay', `${(i * 0.14).toFixed(2)}s`);
      card.style.setProperty('--flip-delay', `${(i * 0.09).toFixed(2)}s`);
    });
  };
  computeOffsets();

  let dealt = false;
  window.addEventListener('resize', () => {
    if (!dealt) computeOffsets();
  });

  const startDeal = () => {
    // Parent .section-reveal must be fully settled at scale(1) before measuring
    computeOffsets();

    // Phase 1: fade into stacked position at center
    requestAnimationFrame(() => grid.classList.add('is-stacked'));

    // Phase 1.5: shuffle — jitter stack rotations
    let step = 0;
    const jitter = setInterval(() => {
      cards.forEach(c => {
        c.style.setProperty('--stack-rot', `${(Math.random() * 18 - 9).toFixed(2)}deg`);
      });
      step++;
      if (step >= 4) {
        clearInterval(jitter);
        cards.forEach(c => c.style.setProperty('--stack-rot', '0deg'));
      }
    }, 170);

    // Phase 2: deal out to grid positions (staggered)
    setTimeout(() => grid.classList.add('is-dealt'), 1150);

    // Phase 3: flip all cards face-up (staggered)
    const dealDone = 1150 + 5 * 140 + 520;
    setTimeout(() => grid.classList.add('is-flipped'), dealDone);
  };

  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting || dealt) return;
      dealt = true;
      io.unobserve(grid);
      // Wait for .section-reveal transform (0.95s) to finish before measuring
      setTimeout(startDeal, 1050);
    });
  }, { threshold: 0.18 });

  io.observe(grid);
}

/* ══════════════════════════════════ RESEARCH CARD TILT ════ */
function initResearchTilt() {
  document.querySelectorAll('.tilt-card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const x    = e.clientX - rect.left;
      const y    = e.clientY - rect.top;
      const rx   = ((y - rect.height / 2) / rect.height) * -14;
      const ry   = ((x - rect.width  / 2) / rect.width)  *  14;
      card.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) scale3d(1.03,1.03,1.03)`;
      const shine = card.querySelector('.card-shine');
      if (shine) {
        shine.style.background = `radial-gradient(circle at ${x}px ${y}px, rgba(0,212,255,.12), transparent 60%)`;
      }
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(900px) rotateX(0) rotateY(0) scale3d(1,1,1)';
    });
  });
}

/* ═══════════════════════════════════════ MINI CHARTS ════ */
function initMiniCharts() {
  drawOptionsPayoff();
  drawRatePath();
}

function drawOptionsPayoff() {
  const canvas = document.getElementById('chart-options');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  ctx.clearRect(0, 0, W, H);

  // Grid lines
  ctx.strokeStyle = 'rgba(0,212,255,0.08)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath(); ctx.moveTo(i * W / 4, 0); ctx.lineTo(i * W / 4, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * H / 4); ctx.lineTo(W, i * H / 4); ctx.stroke();
  }

  // Zero line
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, H * 0.75); ctx.lineTo(W, H * 0.75); ctx.stroke();

  // Payoff curve (call option payoff)
  const K = W * 0.42;
  const grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0,   'rgba(0,212,255,0)');
  grad.addColorStop(0.45,'rgba(0,212,255,0.9)');
  grad.addColorStop(1,   'rgba(0,255,136,1)');

  ctx.beginPath();
  ctx.strokeStyle = grad;
  ctx.lineWidth = 2.5;
  ctx.shadowBlur  = 8;
  ctx.shadowColor = '#00ff88';
  for (let px = 0; px < W; px++) {
    const payoff = px < K ? 0 : ((px - K) / (W - K)) * H * 0.65;
    const py = H * 0.75 - payoff;
    px === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Strike label
  ctx.font = '9px JetBrains Mono, monospace';
  ctx.fillStyle = 'rgba(0,212,255,0.6)';
  ctx.fillText('K', K - 4, H - 4);
}

function drawRatePath() {
  const canvas = document.getElementById('chart-rates');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  ctx.clearRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = 'rgba(0,212,255,0.08)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath(); ctx.moveTo(i * W / 4, 0); ctx.lineTo(i * W / 4, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * H / 4); ctx.lineTo(W, i * H / 4); ctx.stroke();
  }

  // Mean reversion level
  const mu   = H * 0.45;
  ctx.strokeStyle = 'rgba(255,215,0,0.25)';
  ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(0, mu); ctx.lineTo(W, mu); ctx.stroke();
  ctx.setLineDash([]);

  // Vasicek-style path (deterministic for visual clarity)
  const theta = 0.05, kappa = 1.8, sigma = 0.015;
  const steps = W;
  const dt    = 1 / steps;
  let   r     = 0.10;

  const grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, 'rgba(255,215,0,0.9)');
  grad.addColorStop(1, 'rgba(0,212,255,0.9)');

  ctx.beginPath();
  ctx.strokeStyle = grad;
  ctx.lineWidth = 2.5;
  ctx.shadowBlur  = 8;
  ctx.shadowColor = '#00d4ff';

  for (let i = 0; i < steps; i++) {
    // Vasicek: dr = κ(θ - r)dt + σ·dW  (simplified noise)
    const noise = (Math.sin(i * 0.4) * 0.6 + Math.cos(i * 0.7) * 0.4) * sigma;
    r += kappa * (theta - r) * dt + noise;
    const py = H - ((r - 0.01) / 0.14) * H;
    i === 0 ? ctx.moveTo(i, py) : ctx.lineTo(i, py);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Label
  ctx.font = '9px JetBrains Mono, monospace';
  ctx.fillStyle = 'rgba(255,215,0,0.55)';
  ctx.fillText('θ (long-run mean)', 4, mu - 4);
}

/* ══════════════════════════════════════════════════ GAME ════ */
let currentBS = 0;

function normalCDF(x) {
  const a1 =  0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 =  1.061405429, p  = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const ax   = Math.abs(x) / Math.SQRT2;
  const t    = 1 / (1 + p * ax);
  const erf  = 1 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-ax * ax);
  return 0.5 * (1 + sign * erf);
}

function bsCall(S, K, T, r, sigma) {
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  return S * normalCDF(d1) - K * Math.exp(-r * T) * normalCDF(d2);
}

function randomParams() {
  const S     = Math.round((80  + Math.random() * 80)  * 100) / 100;
  const K     = Math.round((S   * (0.88 + Math.random() * 0.24)) * 100) / 100;
  const sigma = Math.round((0.12 + Math.random() * 0.38) * 10000) / 10000;
  const T     = Math.round((0.25 + Math.random() * 1.75) * 100) / 100;
  const r     = Math.round((0.02 + Math.random() * 0.07) * 10000) / 10000;
  return { S, K, sigma, T, r };
}

function loadGameParams() {
  const p = randomParams();
  currentBS = bsCall(p.S, p.K, p.T, p.r, p.sigma);

  document.getElementById('gp-S').textContent     = `$${p.S.toFixed(2)}`;
  document.getElementById('gp-K').textContent     = `$${p.K.toFixed(2)}`;
  document.getElementById('gp-sigma').textContent = `${(p.sigma * 100).toFixed(2)}%`;
  document.getElementById('gp-T').textContent     = `${p.T.toFixed(2)} yr`;
  document.getElementById('gp-r').textContent     = `${(p.r * 100).toFixed(2)}%`;

  document.getElementById('game-result').style.display = 'none';
  document.getElementById('game-next').style.display   = 'none';
  document.getElementById('game-submit').style.display = 'block';
  document.getElementById('game-input').value          = '';
}

function initGame() {
  loadGameParams();

  document.getElementById('game-submit').addEventListener('click', () => {
    const raw = parseFloat(document.getElementById('game-input').value);
    if (isNaN(raw) || raw < 0) return;

    const delta    = raw - currentBS;
    const pctErr   = Math.abs(delta) / currentBS * 100;
    const accuracy = pctErr < 2  ? 100
                   : pctErr < 5  ?  92
                   : pctErr < 10 ?  78
                   : pctErr < 20 ?  55
                   : pctErr < 35 ?  30
                   :               10;

    const resultEl  = document.getElementById('game-result');
    const deltaEl   = document.getElementById('gr-delta');
    const accEl     = document.getElementById('gr-acc');

    document.getElementById('gr-est').textContent   = `$${raw.toFixed(2)}`;
    document.getElementById('gr-bs').textContent    = `$${currentBS.toFixed(4)}`;
    deltaEl.textContent = `${delta >= 0 ? '+' : ''}$${delta.toFixed(4)}`;
    deltaEl.className   = `gr-val ${delta >= 0 ? 'green' : ''}`;
    deltaEl.style.color = delta >= 0 ? 'var(--green)' : 'var(--red)';
    accEl.textContent   = `${accuracy}%`;
    accEl.style.color   = accuracy >= 80 ? 'var(--green)' : accuracy >= 50 ? 'var(--gold)' : 'var(--red)';

    resultEl.style.display = 'grid';
    document.getElementById('game-submit').style.display = 'none';
    document.getElementById('game-next').style.display   = 'block';
  });

  document.getElementById('game-next').addEventListener('click', loadGameParams);
}

/* ════════════════════════════════════════ CONTACT FORM ════ */
function initContactForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    const name    = form.querySelector('input[placeholder="Your Name"]').value.trim();
    const subject = form.querySelector('input[placeholder="Subject"]').value.trim();
    const msg     = form.querySelector('textarea').value.trim();
    if (!name || !subject || !msg) return;

    const email = 'sp8621@nyu.edu';
    const body  = `Hi Sparsh,\n\nFrom: ${name}\n\n${msg}`;
    const mailto = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;

    const conf = document.getElementById('form-confirm');
    if (conf) {
      conf.style.display = 'block';
      setTimeout(() => { conf.style.display = 'none'; }, 4000);
    }
    form.reset();
  });
}

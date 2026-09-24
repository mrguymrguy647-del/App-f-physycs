/*
 * Physics Quest — Projectile Lab.
 * Aim a cannon (angle + launch speed) to land on a target. Uses exact
 * projectile equations: x = v·cosθ·t,  y = v·sinθ·t − ½·g·t².
 */
(function (root) {
  'use strict';

  const G = 9.8;
  const WORLD_W = 130; // metres visible horizontally
  const VIEW_W = 800; // logical canvas units
  const VIEW_H = 400;
  const GROUND = 36; // px reserved for ground at the bottom
  const SCALE = VIEW_W / WORLD_W; // px per metre
  const LAUNCH_X = 4; // metres
  const MIN_V = 5, MAX_V = 40;
  const SIM_SPEED = 2.2; // animation runs faster than real time

  function rand(min, max) { return min + Math.random() * (max - min); }
  const toRad = (d) => (d * Math.PI) / 180;

  function create(opts) {
    const canvas = opts.canvas;
    const ctx = canvas.getContext('2d');
    const el = opts.elements; // { angle, speed, angleOut, speedOut, fire, hint, next, message, level, shots, stats }
    const onScore = opts.onScore || function () {};

    const state = {
      level: opts.startLevel || 1,
      target: null,
      wall: null,
      trails: [],
      shotsThisTarget: 0,
      flying: null,
      solved: false,
    };

    // ---------- physics ----------
    function simulate(angleDeg, v) {
      const vx = v * Math.cos(toRad(angleDeg));
      const vy = v * Math.sin(toRad(angleDeg));
      let tEnd = (2 * vy) / G;
      let result = 'ground';
      if (state.wall) {
        const tw = (state.wall.x - LAUNCH_X) / vx;
        if (tw > 0 && tw < tEnd) {
          const yw = vy * tw - 0.5 * G * tw * tw;
          if (yw < state.wall.h) { tEnd = tw; result = 'wall'; }
        }
      }
      const landX = LAUNCH_X + vx * tEnd;
      const hit = result === 'ground' && Math.abs(landX - state.target.x) <= state.target.w / 2;
      return {
        vx, vy, tEnd, result, landX, hit,
        range: vx * ((2 * vy) / G),
        maxH: (vy * vy) / (2 * G),
        flightT: (2 * vy) / G,
      };
    }

    function solvable() {
      for (let a = 10; a <= 80; a += 1) {
        const s2 = Math.sin(toRad(2 * a));
        const v = Math.sqrt(((state.target.x - LAUNCH_X) * G) / s2);
        if (v < MIN_V || v > MAX_V) continue;
        if (simulate(a, v).hit) return true;
      }
      return false;
    }

    function newTarget() {
      const lvl = state.level;
      const w = Math.max(3, 10 - lvl * 0.9);
      for (let attempt = 0; attempt < 200; attempt++) {
        state.target = { x: rand(25, 115), w };
        state.wall = null;
        if (lvl >= 3) {
          const dist = state.target.x - LAUNCH_X;
          state.wall = {
            x: LAUNCH_X + dist * rand(0.35, 0.65),
            h: Math.min(rand(6, 10 + lvl * 3), 38),
          };
        }
        if (solvable()) break;
      }
      state.trails = [];
      state.shotsThisTarget = 0;
      state.solved = false;
      el.next.hidden = true;
      el.fire.disabled = false;
      setMessage(
        `Target at <b>${(state.target.x - LAUNCH_X).toFixed(1)} m</b> (width ${state.target.w.toFixed(1)} m)` +
          (state.wall ? `. Wall ${state.wall.h.toFixed(1)} m tall at ${(state.wall.x - LAUNCH_X).toFixed(1)} m.` : '.') +
          ' Pick an angle and speed, then fire!'
      );
      updateHud();
      draw();
    }

    function fire() {
      if (state.flying || state.solved) return;
      const angle = +el.angle.value;
      const v = +el.speed.value;
      const sim = simulate(angle, v);
      state.shotsThisTarget++;
      state.flying = { angle, v, sim, t: 0, last: null, points: [] };
      el.fire.disabled = true;
      requestAnimationFrame(step);
    }

    function step(ts) {
      const f = state.flying;
      if (!f) return;
      if (f.last === null) f.last = ts;
      f.t = Math.min(f.sim.tEnd, f.t + ((ts - f.last) / 1000) * SIM_SPEED);
      f.last = ts;
      const x = LAUNCH_X + f.sim.vx * f.t;
      const y = f.sim.vy * f.t - 0.5 * G * f.t * f.t;
      f.points.push([x, Math.max(0, y)]);
      draw();
      if (f.t < f.sim.tEnd) requestAnimationFrame(step);
      else land();
    }

    function land() {
      const f = state.flying;
      state.flying = null;
      state.trails.push({ points: f.points, hit: f.sim.hit });
      if (state.trails.length > 6) state.trails.shift();
      const s = f.sim;
      const info =
        `<span class="lab-formula">Range R = v²·sin(2θ)/g = ${f.v}²·sin(${2 * f.angle}°)/9.8 = <b>${s.range.toFixed(1)} m</b> · ` +
        `max height = (v·sinθ)²/2g = ${s.maxH.toFixed(1)} m · flight time = 2v·sinθ/g = ${s.flightT.toFixed(2)} s</span>`;

      if (s.hit) {
        const xp = state.shotsThisTarget === 1 ? 30 : state.shotsThisTarget === 2 ? 20 : 10;
        state.solved = true;
        setMessage(`🎯 <b>Direct hit</b> in ${state.shotsThisTarget} shot${state.shotsThisTarget > 1 ? 's' : ''}! +${xp} XP<br>${info}`, 'good');
        onScore({ hit: true, xp, level: state.level, shots: state.shotsThisTarget });
        state.level++;
        el.next.hidden = false;
        el.fire.disabled = true;
      } else {
        onScore({ hit: false, xp: 0, level: state.level });
        const miss = s.result === 'wall'
          ? '🧱 Blocked by the wall — try a steeper angle.'
          : s.landX < state.target.x
            ? `⬅️ Too short by ${(state.target.x - s.landX).toFixed(1)} m.`
            : `➡️ Too long by ${(s.landX - state.target.x).toFixed(1)} m.`;
        setMessage(`${miss}<br>${info}`, 'bad');
        el.fire.disabled = false;
      }
      updateHud();
      draw();
    }

    function hint() {
      const angle = +el.angle.value;
      const d = state.target.x - LAUNCH_X;
      const v = Math.sqrt((d * G) / Math.sin(toRad(2 * angle)));
      const ok = v >= MIN_V && v <= MAX_V;
      setMessage(
        `💡 Solve R = v²·sin(2θ)/g for v: v = √(R·g / sin 2θ) = √(${d.toFixed(1)} × 9.8 / sin ${2 * angle}°) ≈ <b>${v.toFixed(1)} m/s</b>` +
          (ok ? '' : ` — outside the ${MIN_V}–${MAX_V} m/s range, try another angle.`) +
          (state.wall ? ' Remember the wall: the ball must be above it when passing!' : '') +
          ' (Hints are free, but try to calculate it yourself first!)'
      );
    }

    // ---------- rendering ----------
    function sx(x) { return x * SCALE; }
    function sy(y) { return VIEW_H - GROUND - y * SCALE; }

    function cssVar(name) {
      return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    }

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth || VIEW_W;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round((w * VIEW_H / VIEW_W) * dpr);
      draw();
    }

    function draw() {
      if (!state.target) return;
      const k = canvas.width / VIEW_W;
      ctx.setTransform(k, 0, 0, k, 0, 0);
      const c = {
        sky: cssVar('--lab-sky'), ground: cssVar('--lab-ground'), grid: cssVar('--lab-grid'),
        text: cssVar('--muted'), target: cssVar('--accent'), wall: cssVar('--lab-wall'),
        ball: cssVar('--text'), good: cssVar('--good'), trail: cssVar('--lab-trail'),
      };
      ctx.fillStyle = c.sky;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);

      // grid every 10 m
      ctx.strokeStyle = c.grid;
      ctx.lineWidth = 1;
      ctx.fillStyle = c.text;
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      for (let m = 0; m <= WORLD_W; m += 10) {
        const x = sx(LAUNCH_X + m);
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, VIEW_H - GROUND); ctx.stroke();
        if (m % 20 === 0) ctx.fillText(m + ' m', x, VIEW_H - 10);
      }
      ctx.textAlign = 'left';
      for (let h = 10; h * SCALE < VIEW_H - GROUND; h += 10) {
        ctx.beginPath(); ctx.moveTo(0, sy(h)); ctx.lineTo(VIEW_W, sy(h)); ctx.stroke();
        ctx.fillText(h + ' m', 4, sy(h) - 3);
      }

      // ground
      ctx.fillStyle = c.ground;
      ctx.fillRect(0, VIEW_H - GROUND, VIEW_W, GROUND);

      // target
      const t = state.target;
      ctx.fillStyle = c.target;
      ctx.fillRect(sx(t.x - t.w / 2), sy(0) - 6, t.w * SCALE, 6);
      ctx.beginPath();
      ctx.moveTo(sx(t.x), sy(0) - 6); ctx.lineTo(sx(t.x), sy(0) - 34);
      ctx.strokeStyle = c.target; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(sx(t.x), sy(0) - 34); ctx.lineTo(sx(t.x) + 16, sy(0) - 28); ctx.lineTo(sx(t.x), sy(0) - 22);
      ctx.fill();

      // wall
      if (state.wall) {
        ctx.fillStyle = c.wall;
        ctx.fillRect(sx(state.wall.x) - 4, sy(state.wall.h), 8, state.wall.h * SCALE);
      }

      // old trails
      ctx.setLineDash([4, 5]);
      ctx.lineWidth = 1.5;
      state.trails.forEach((tr) => {
        ctx.strokeStyle = tr.hit ? c.good : c.trail;
        path(tr.points);
      });
      ctx.setLineDash([]);

      // aim line + cannon
      const ang = toRad(+el.angle.value);
      const len = 16 + (+el.speed.value / MAX_V) * 30;
      ctx.strokeStyle = c.ball;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sx(LAUNCH_X), sy(0));
      ctx.lineTo(sx(LAUNCH_X) + Math.cos(ang) * len, sy(0) - Math.sin(ang) * len);
      ctx.stroke();
      ctx.lineCap = 'butt';
      ctx.fillStyle = c.ball;
      ctx.beginPath(); ctx.arc(sx(LAUNCH_X), sy(0), 9, Math.PI, 0); ctx.fill();

      // flying ball
      const f = state.flying;
      if (f && f.points.length) {
        ctx.strokeStyle = c.ball; ctx.lineWidth = 2;
        path(f.points);
        const [bx, by] = f.points[f.points.length - 1];
        ctx.fillStyle = c.ball;
        ctx.beginPath(); ctx.arc(sx(bx), Math.max(6, sy(by)), 6, 0, Math.PI * 2); ctx.fill();
        if (sy(by) < 0) { // off the top of the screen: show an arrow
          ctx.fillText('▲ ' + by.toFixed(0) + ' m', sx(bx) + 8, 14);
        }
      }
    }

    function path(points) {
      ctx.beginPath();
      points.forEach(([x, y], i) => (i ? ctx.lineTo(sx(x), sy(y)) : ctx.moveTo(sx(x), sy(y))));
      ctx.stroke();
    }

    // ---------- UI ----------
    function setMessage(html, tone) {
      el.message.innerHTML = html;
      el.message.className = 'lab-message' + (tone ? ' ' + tone : '');
    }
    function updateHud() {
      el.level.textContent = state.level;
      el.shots.textContent = state.shotsThisTarget;
    }
    function syncOutputs() {
      el.angleOut.textContent = el.angle.value + '°';
      el.speedOut.textContent = el.speed.value + ' m/s';
      if (!state.flying) draw();
    }

    el.angle.addEventListener('input', syncOutputs);
    el.speed.addEventListener('input', syncOutputs);
    el.fire.addEventListener('click', fire);
    el.hint.addEventListener('click', hint);
    el.next.addEventListener('click', newTarget);
    window.addEventListener('resize', resize);

    syncOutputs();
    newTarget();

    return {
      resize,
      fire,
      get level() { return state.level; },
      _simulate: simulate,
    };
  }

  root.ProjectileLab = { create };
})(window);

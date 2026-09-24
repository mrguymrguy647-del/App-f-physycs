/*
 * Physics Quest — Projectile Lab.
 * Aim a cannon (angle + launch speed) to land on a target. Uses exact
 * projectile equations: x = v·cosθ·t + ½·a_wind·t²,  y = v·sinθ·t − ½·g·t².
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

  // Per-difficulty rules. width: [start, shrink per level, minimum] in metres.
  const MODES = {
    beginner: { width: [12, 0.6, 6], wallsFrom: Infinity, wind: 0, preview: true, hints: true },
    medium: { width: [10, 0.9, 3], wallsFrom: 3, wind: 0, preview: false, hints: true },
    hard: { width: [6, 0.4, 2.5], wallsFrom: 1, wind: 0, preview: false, hints: false },
    hardcore: { width: [4, 0.3, 2], wallsFrom: 1, wind: 2, preview: false, hints: false },
  };

  function rand(min, max) { return min + Math.random() * (max - min); }
  const toRad = (d) => (d * Math.PI) / 180;

  function create(opts) {
    const canvas = opts.canvas;
    const ctx = canvas.getContext('2d');
    const el = opts.elements; // { angle, speed, angleOut, speedOut, fire, hint, next, message, level, shots, nudges }
    const onScore = opts.onScore || function () {};

    const state = {
      modeId: opts.mode || 'medium',
      mode: MODES[opts.mode] || MODES.medium,
      level: opts.startLevel || 1,
      target: null,
      wall: null,
      wind: 0,
      trails: [],
      shotsThisTarget: 0,
      flying: null,
      solved: false,
    };

    // ---------- physics ----------
    // Time at which the ball reaches horizontal distance dx (smallest positive root), or null.
    function timeToReach(dx, vx, ax) {
      if (Math.abs(ax) < 1e-9) return dx / vx;
      const disc = vx * vx + 2 * ax * dx;
      if (disc < 0) return null;
      const roots = [(-vx + Math.sqrt(disc)) / ax, (-vx - Math.sqrt(disc)) / ax].filter((t) => t > 0);
      return roots.length ? Math.min(...roots) : null;
    }

    function simulate(angleDeg, v) {
      const vx = v * Math.cos(toRad(angleDeg));
      const vy = v * Math.sin(toRad(angleDeg));
      const ax = state.wind;
      const flightT = (2 * vy) / G;
      let tEnd = flightT;
      let result = 'ground';
      if (state.wall) {
        const tw = timeToReach(state.wall.x - LAUNCH_X, vx, ax);
        if (tw !== null && tw > 0 && tw < tEnd) {
          const yw = vy * tw - 0.5 * G * tw * tw;
          if (yw < state.wall.h) { tEnd = tw; result = 'wall'; }
        }
      }
      const landX = LAUNCH_X + vx * tEnd + 0.5 * ax * tEnd * tEnd;
      const hit = result === 'ground' && Math.abs(landX - state.target.x) <= state.target.w / 2;
      return {
        vx, vy, ax, tEnd, result, landX, hit, flightT,
        range: vx * flightT,
        windShift: 0.5 * ax * flightT * flightT,
        maxH: (vy * vy) / (2 * G),
      };
    }

    function posAt(sim, t) {
      return [LAUNCH_X + sim.vx * t + 0.5 * sim.ax * t * t, sim.vy * t - 0.5 * G * t * t];
    }

    function solvable() {
      for (let a = 10; a <= 80; a += 1) {
        for (let v = MIN_V; v <= MAX_V; v += 0.1) {
          if (simulate(a, v).hit) return true;
        }
      }
      return false;
    }

    function targetWidth() {
      const [start, shrink, min] = state.mode.width;
      return Math.max(min, start - shrink * (state.level - 1));
    }

    function newTarget() {
      const w = targetWidth();
      for (let attempt = 0; attempt < 200; attempt++) {
        state.target = { x: rand(25, 115), w };
        state.wall = null;
        state.wind = state.mode.wind ? (Math.random() < 0.5 ? -1 : 1) * rand(0.4, state.mode.wind) : 0;
        if (state.level >= state.mode.wallsFrom) {
          const dist = state.target.x - LAUNCH_X;
          state.wall = {
            x: LAUNCH_X + dist * rand(0.35, 0.65),
            h: Math.min(rand(6, 10 + state.level * 3), 38),
          };
        }
        if (solvable()) break;
      }
      state.trails = [];
      state.shotsThisTarget = 0;
      state.solved = false;
      el.next.hidden = true;
      el.fire.disabled = false;
      el.hint.hidden = !state.mode.hints;
      setMessage(
        `Target at <b>${(state.target.x - LAUNCH_X).toFixed(1)} m</b> (width ${state.target.w.toFixed(1)} m)` +
          (state.wall ? `. Wall ${state.wall.h.toFixed(1)} m tall at ${(state.wall.x - LAUNCH_X).toFixed(1)} m` : '') +
          (state.wind ? `. 💨 Wind accelerates the ball <b>${Math.abs(state.wind).toFixed(1)} m/s² ${state.wind > 0 ? 'forward →' : '← backward'}</b>` : '') +
          '. Pick an angle and speed, then fire!' +
          (state.mode.preview ? ' The dotted line shows where your shot will go.' : '')
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
      const [x, y] = posAt(f.sim, f.t);
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
      let info =
        `<span class="lab-formula">R = v²·sin(2θ)/g = ${f.v}²·sin(${2 * f.angle}°)/9.8 = <b>${s.range.toFixed(1)} m</b>`;
      if (s.ax) {
        info += ` · wind shift ½·a·t² = ½ × ${s.ax.toFixed(1)} × ${s.flightT.toFixed(2)}² = <b>${s.windShift.toFixed(1)} m</b>`;
      }
      info += ` · max height = (v·sinθ)²/2g = ${s.maxH.toFixed(1)} m · flight time = 2v·sinθ/g = ${s.flightT.toFixed(2)} s</span>`;

      if (s.hit) {
        const xp = state.shotsThisTarget === 1 ? 30 : state.shotsThisTarget === 2 ? 20 : 10;
        state.solved = true;
        onScore({ hit: true, xp, level: state.level, shots: state.shotsThisTarget, mode: state.modeId, done: (gained) => {
          setMessage(`🎯 <b>Direct hit</b> in ${state.shotsThisTarget} shot${state.shotsThisTarget > 1 ? 's' : ''}! +${gained} XP<br>${info}`, 'good');
        } });
        state.level++;
        el.next.hidden = false;
        el.fire.disabled = true;
      } else {
        onScore({ hit: false, xp: 0, level: state.level, mode: state.modeId });
        const off = s.landX - state.target.x;
        const miss = s.result === 'wall'
          ? '🧱 Blocked by the wall. Try a steeper angle.'
          : off < 0
            ? `⬅️ Landed at ${(s.landX - LAUNCH_X).toFixed(1)} m: too short by ${(-off).toFixed(1)} m.`
            : `➡️ Landed at ${(s.landX - LAUNCH_X).toFixed(1)} m: too long by ${off.toFixed(1)} m.`;
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
          (ok ? '' : ` That's outside the ${MIN_V}–${MAX_V} m/s range, so try another angle.`) +
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
      // On narrow screens the canvas is scaled down, so enlarge text and lines to stay readable.
      const shrink = VIEW_W / (canvas.clientWidth || VIEW_W);
      const ts = Math.min(2.2, Math.max(1, shrink * 0.9));
      const ls = Math.min(1.6, Math.max(1, shrink * 0.6));
      const font = (px, bold) => `${bold ? 'bold ' : ''}${Math.round(px * ts)}px system-ui, sans-serif`;
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
      ctx.font = font(11);
      ctx.textAlign = 'center';
      for (let m = 0; m <= WORLD_W; m += 10) {
        const x = sx(LAUNCH_X + m);
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, VIEW_H - GROUND); ctx.stroke();
      }
      ctx.textAlign = 'left';
      for (let h = 10; h * SCALE < VIEW_H - GROUND; h += 10) {
        ctx.beginPath(); ctx.moveTo(0, sy(h)); ctx.lineTo(VIEW_W, sy(h)); ctx.stroke();
        if (h % (ts > 1.5 ? 20 : 10) === 0) ctx.fillText(h + ' m', 4, sy(h) - 3);
      }

      // wind indicator
      if (state.wind) {
        ctx.font = font(13, true);
        ctx.textAlign = 'right';
        ctx.fillStyle = c.ball;
        const arrow = state.wind > 0 ? '→→→' : '←←←';
        ctx.fillText(`wind ${Math.abs(state.wind).toFixed(1)} m/s²  ${arrow}`, VIEW_W - 12, 14 + 14 * ts);
        ctx.textAlign = 'left';
        ctx.font = font(11);
      }

      // ground + distance labels on it
      ctx.fillStyle = c.ground;
      ctx.fillRect(0, VIEW_H - GROUND, VIEW_W, GROUND);
      ctx.fillStyle = c.text;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let m = 20; m <= WORLD_W - 10; m += ts > 1.5 ? 40 : 20) ctx.fillText(m + ' m', sx(LAUNCH_X + m), VIEW_H - GROUND / 2);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';

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
      ctx.setLineDash([4 * ls, 5 * ls]);
      ctx.lineWidth = 1.5 * ls;
      state.trails.forEach((tr) => {
        ctx.strokeStyle = tr.hit ? c.good : c.trail;
        path(tr.points);
      });

      // beginner: predicted path for the current aim
      if (state.mode.preview && !state.flying && !state.solved) {
        const sim = simulate(+el.angle.value, +el.speed.value);
        const pts = [];
        for (let i = 0; i <= 60; i++) pts.push(posAt(sim, (sim.tEnd * i) / 60));
        ctx.setLineDash([2 * ls, 6 * ls]);
        ctx.strokeStyle = sim.hit ? c.good : c.target;
        ctx.globalAlpha = 0.7;
        path(pts);
        ctx.globalAlpha = 1;
      }
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
        ctx.strokeStyle = c.ball; ctx.lineWidth = 2 * ls;
        path(f.points);
        const [bx, by] = f.points[f.points.length - 1];
        ctx.fillStyle = c.ball;
        ctx.beginPath(); ctx.arc(sx(bx), Math.max(6 * ls, sy(by)), 6 * ls, 0, Math.PI * 2); ctx.fill();
        if (sy(by) < 0) { // off the top of the screen: show the height
          ctx.fillText('▲ ' + by.toFixed(0) + ' m', sx(bx) + 10, 12 * ts);
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
      el.speedOut.textContent = (+el.speed.value).toFixed(1) + ' m/s';
      if (!state.flying) draw();
    }

    el.angle.addEventListener('input', syncOutputs);
    el.speed.addEventListener('input', syncOutputs);
    (el.nudges || []).forEach((b) => b.addEventListener('click', () => {
      const input = document.getElementById(b.dataset.for);
      const v = Math.min(+input.max, Math.max(+input.min, +input.value + +b.dataset.step));
      input.value = +v.toFixed(1);
      syncOutputs();
    }));
    el.fire.addEventListener('click', fire);
    el.hint.addEventListener('click', hint);
    el.next.addEventListener('click', newTarget);
    window.addEventListener('resize', resize);

    syncOutputs();
    newTarget();

    return {
      resize,
      fire,
      setMode(modeId, level) {
        state.flying = null; // cancel a shot in the air
        state.modeId = modeId;
        state.mode = MODES[modeId] || MODES.medium;
        state.level = level || 1;
        newTarget();
      },
      get level() { return state.level; },
      _simulate: simulate,
    };
  }

  root.ProjectileLab = { create, MODES };
})(window);

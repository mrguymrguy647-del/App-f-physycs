/*
 * Physics Quest — question engine.
 * Generates endless randomized numeric problems plus conceptual questions,
 * at four difficulty levels.
 * Works as a browser global (window.PhysicsQuestions) and as a Node module (for tests).
 */
(function (root) {
  'use strict';

  const G = 9.8; // m/s², the "real" value used from Medium upwards
  const SOUND = 340; // m/s
  const LIGHT = 3e8; // m/s

  // ---------- difficulty levels ----------
  // tierWeights: how often generators of each tier appear (tier 1 = one step,
  // tier 2 = two steps / traps, tier 3 = multi-step challenge problems).
  const DIFFICULTIES = [
    { id: 'beginner', name: 'Beginner', icon: '🌱',
      blurb: 'New to physics? One-step problems, friendly numbers (g = 10) and the formula is shown every time.',
      tierWeights: { 1: 1 }, g: 10, conceptRate: 0.4, timer: 0, lives: 0, typed: false, xpMult: 1, formula: 'always' },
    { id: 'medium', name: 'Medium', icon: '🔥',
      blurb: 'Real values (g = 9.8), two-step problems and classic traps. Peek at the formula for half XP.',
      tierWeights: { 1: 1, 2: 1.5 }, g: G, conceptRate: 0.3, timer: 0, lives: 0, typed: false, xpMult: 1.5, formula: 'peek' },
    { id: 'hard', name: 'Hard', icon: '⚡',
      blurb: 'Multi-step problems against a 45-second clock. No hints. Answer fast for bonus XP.',
      tierWeights: { 2: 1, 3: 1.5 }, g: G, conceptRate: 0.15, timer: 45, lives: 0, typed: false, xpMult: 2, formula: 'none' },
    { id: 'hardcore', name: 'Hardcore', icon: '💀',
      blurb: 'No multiple choice: type the number yourself (within 2%). 60 seconds each and only 3 lives.',
      tierWeights: { 2: 1, 3: 3 }, g: G, conceptRate: 0, timer: 60, lives: 3, typed: true, xpMult: 3, formula: 'none' },
  ];
  const DIFF = Object.fromEntries(DIFFICULTIES.map((d) => [d.id, d]));

  // ---------- helpers ----------
  function rand(min, max, step) {
    step = step || 1;
    const n = Math.floor((max - min) / step + 1e-9) + 1;
    return +(min + Math.floor(Math.random() * n) * step).toFixed(6);
  }
  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }
  function weightedPick(arr, weight) {
    const total = arr.reduce((s, x) => s + weight(x), 0);
    let r = Math.random() * total;
    for (const x of arr) { r -= weight(x); if (r <= 0) return x; }
    return arr[arr.length - 1];
  }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  // Round to 3 significant figures for display; scientific notation for very big/small values.
  function fmt(x) {
    if (!isFinite(x)) return String(x);
    if (x === 0) return '0';
    const a = Math.abs(x);
    if (a >= 1e6 || a < 1e-3) {
      const [m, e] = x.toExponential(2).split('e');
      return `${Number(m)} × 10${String(+e).split('').map((c) => SUP[c]).join('')}`;
    }
    if (a >= 1000) return String(Math.round(x));
    return String(Number(x.toPrecision(3)));
  }
  const rad = (deg) => (deg * Math.PI) / 180;
  const ORDINAL = { 1: '1st (fundamental)', 2: '2nd', 3: '3rd' };

  // Parse a typed answer: "12.5", "12,5", "4.5e19", "4.5 x 10^19", "4.5×10^19".
  function parseAnswer(text) {
    const s = String(text).trim().replace(/\s+/g, '').replace(/,/g, '.');
    const m = s.match(/^([-+]?\d*\.?\d+)(?:(?:[xX×*]10\^?([-+]?\d+))|(?:[eE]([-+]?\d+)))?$/);
    if (!m) return NaN;
    const exp = m[2] !== undefined ? +m[2] : m[3] !== undefined ? +m[3] : 0;
    return parseFloat(m[1]) * Math.pow(10, exp);
  }
  function checkTyped(q, text, tolerance) {
    const v = parseAnswer(text);
    if (!isFinite(v)) return false;
    return Math.abs(v - q.answerValue) <= (tolerance || 0.02) * Math.abs(q.answerValue);
  }

  // Build a multiple-choice question from a numeric answer and a list of
  // "common mistake" values. Falls back to scaled values if mistakes collide.
  function numeric(topic, q) {
    const unit = q.unit ? ' ' + q.unit : '';
    const correct = fmt(q.answer) + unit;
    const seen = new Set([correct]);
    const values = [q.answer];
    const choices = [correct];

    function tryAdd(v) {
      if (choices.length >= 4) return;
      if (!isFinite(v) || v <= 0) return;
      // keep distractors clearly different from every existing choice
      if (values.some((u) => Math.abs(v - u) / Math.max(Math.abs(u), 1e-9) < 0.08)) return;
      const s = fmt(v) + unit;
      if (seen.has(s)) return;
      seen.add(s);
      values.push(v);
      choices.push(s);
    }

    shuffle(q.mistakes || []).forEach(tryAdd);
    shuffle([2, 0.5, 1.5, 0.75, 3, 1.25, 0.25, 4, 10, 0.1]).forEach((k) => tryAdd(q.answer * k));

    const order = shuffle([0, 1, 2, 3]);
    return {
      topic,
      kind: 'numeric',
      prompt: q.prompt,
      choices: order.map((i) => choices[i]),
      correctIndex: order.indexOf(0),
      explanation: q.explanation,
      answerValue: q.answer,
      answerText: correct,
    };
  }

  // Hardcore: no choices, the player types the number.
  function typed(topic, q) {
    return {
      topic,
      kind: 'typed',
      prompt: q.prompt,
      unit: q.unit || '',
      explanation: q.explanation,
      answerValue: q.answer,
      answerText: fmt(q.answer) + (q.unit ? ' ' + q.unit : ''),
    };
  }

  function conceptual(topic, c) {
    const order = shuffle(c.choices.map((_, i) => i));
    return {
      topic,
      kind: 'concept',
      prompt: c.prompt,
      choices: order.map((i) => c.choices[i]),
      correctIndex: order.indexOf(0), // first listed choice is always the right one
      answerText: c.choices[0],
      explanation: c.explanation,
    };
  }

  // ---------- topics ----------
  const TOPICS = [
    { id: 'kinematics', name: 'Motion', icon: '🏃', blurb: 'Speed, velocity, acceleration, free fall' },
    { id: 'forces', name: 'Forces', icon: '🧲', blurb: "Newton's laws, weight, friction, springs" },
    { id: 'energy', name: 'Energy', icon: '⚡', blurb: 'Kinetic & potential energy, work, power' },
    { id: 'momentum', name: 'Momentum', icon: '🎱', blurb: 'Momentum, collisions, impulse' },
    { id: 'waves', name: 'Waves', icon: '🌊', blurb: 'Frequency, wavelength, sound, light' },
    { id: 'electricity', name: 'Electricity', icon: '🔌', blurb: "Ohm's law, power, circuits" },
  ];

  // ---------- numeric generators ----------
  // Each make(d) receives { g, easy } and returns
  // { prompt, answer, unit, mistakes: [values from common errors], explanation }.
  const gen = (tier, formula, make) => ({ tier, formula, make });

  const GENERATORS = {
    kinematics: [
      gen(1, 'v = d / t', function simpleSpeed() {
        const d = rand(100, 1000, 50), t = rand(10, 200, 10);
        const v = d / t;
        return {
          prompt: `A runner covers ${d} m in ${t} s. What is their average speed?`,
          answer: v, unit: 'm/s', mistakes: [d * t, t / d, d - t],
          explanation: `Speed = distance ÷ time = ${d} / ${t} = ${fmt(v)} m/s.`,
        };
      }),
      gen(1, 'd = v·t', function constantVelocity() {
        const v = rand(3, 30), t = rand(2, 20);
        const d = v * t;
        return {
          prompt: `A cyclist moves at a constant ${v} m/s for ${t} s. How far do they travel?`,
          answer: d, unit: 'm', mistakes: [v / t, v + t, t / v * 10],
          explanation: `Constant velocity: d = v·t = ${v} × ${t} = ${fmt(d)} m.`,
        };
      }),
      gen(1, 'v = u + a·t', function finalSpeed(o) {
        const a = rand(1, 6, o.easy ? 1 : 0.5), t = rand(2, 10);
        const v = a * t;
        return {
          prompt: `A car starts from rest and accelerates at ${a} m/s² for ${t} s. What is its final speed?`,
          answer: v, unit: 'm/s', mistakes: [0.5 * a * t, a * t * t, a / t],
          explanation: `From rest: v = u + a·t = 0 + ${a} × ${t} = ${fmt(v)} m/s.`,
        };
      }),
      gen(2, 's = u·t + ½·a·t²', function distanceFromRest() {
        const a = rand(1, 6, 0.5), t = rand(2, 10);
        const s = 0.5 * a * t * t;
        return {
          prompt: `An object starts from rest with acceleration ${a} m/s². How far does it go in ${t} s?`,
          answer: s, unit: 'm', mistakes: [a * t * t, a * t, 0.5 * a * t],
          explanation: `s = u·t + ½·a·t² = 0 + ½ × ${a} × ${t}² = ${fmt(s)} m. Don't forget the ½ and the square!`,
        };
      }),
      gen(2, 'h = ½·g·t²', function freeFallTime(o) {
        const h = pick([5, 10, 20, 30, 45, 60, 80, 100, 125]);
        const t = Math.sqrt((2 * h) / o.g);
        return {
          prompt: `A stone is dropped from a height of ${h} m. How long does it take to hit the ground? (ignore air resistance, g = ${o.g} m/s²)`,
          answer: t, unit: 's', mistakes: [Math.sqrt(h / o.g), (2 * h) / o.g, h / o.g],
          explanation: `h = ½·g·t² ⇒ t = √(2h/g) = √(2 × ${h} / ${o.g}) = ${fmt(t)} s.`,
        };
      }),
      gen(2, 'average speed = total distance / total time', function averageSpeed() {
        const d1 = rand(20, 120, 10), t1 = rand(1, 3), d2 = rand(20, 120, 10), t2 = rand(1, 4);
        const avg = (d1 + d2) / (t1 + t2);
        const wrong = (d1 / t1 + d2 / t2) / 2;
        return {
          prompt: `A bus travels ${d1} km in ${t1} h, then ${d2} km in ${t2} h. What is its average speed for the whole trip?`,
          answer: avg, unit: 'km/h', mistakes: [wrong, (d1 + d2) / Math.max(t1, t2), d1 / t1 + d2 / t2],
          explanation: `Average speed = total distance / total time = (${d1} + ${d2}) / (${t1} + ${t2}) = ${fmt(avg)} km/h. Averaging the two speeds (${fmt(wrong)}) is a classic trap!`,
        };
      }),
      gen(2, 'v² = u² + 2·a·s', function stoppingDistance() {
        const v = rand(10, 30, 2), a = rand(2, 8);
        const s = (v * v) / (2 * a);
        return {
          prompt: `A car moving at ${v} m/s brakes with a constant deceleration of ${a} m/s². What is its stopping distance?`,
          answer: s, unit: 'm', mistakes: [(v * v) / a, v / (2 * a), v / a],
          explanation: `v² = u² − 2·a·s with v = 0 ⇒ s = u² / (2a) = ${v}² / (2 × ${a}) = ${fmt(s)} m.`,
        };
      }),
      gen(3, 'R = v²·sin(2θ) / g', function projectileRange(o) {
        const v = rand(10, 40), th = pick([15, 20, 30, 40, 50, 60, 70, 75]);
        const R = (v * v * Math.sin(rad(2 * th))) / o.g;
        return {
          prompt: `A ball is launched from flat ground at ${v} m/s, ${th}° above the horizontal. How far away does it land? (g = ${o.g} m/s², no air resistance)`,
          answer: R, unit: 'm',
          mistakes: [(v * v * Math.sin(rad(th))) / o.g, (v * v * Math.sin(rad(2 * th))) / (2 * o.g), (v * v) / o.g, v * Math.cos(rad(th)) * (v * Math.sin(rad(th))) / o.g],
          explanation: `Flight time t = 2v·sinθ/g, horizontal speed v·cosθ, so R = v²·sin(2θ)/g = ${v}² × sin ${2 * th}° / ${o.g} = ${fmt(R)} m.`,
        };
      }),
      gen(3, 'v² = u² − 2·g·h', function upwardThrow(o) {
        const v = rand(5, 40);
        const H = (v * v) / (2 * o.g);
        return {
          prompt: `A ball is thrown straight up at ${v} m/s. How high does it rise above the launch point? (g = ${o.g} m/s²)`,
          answer: H, unit: 'm', mistakes: [(v * v) / o.g, v / o.g, (v * v) / (4 * o.g)],
          explanation: `At the top v = 0, so 0 = u² − 2·g·h ⇒ h = u²/(2g) = ${v}² / (2 × ${o.g}) = ${fmt(H)} m.`,
        };
      }),
      gen(3, 'x = v·t,  h = ½·g·t²', function cliffThrow(o) {
        const h = pick([5, 10, 20, 45, 80]), v = rand(3, 25);
        const t = Math.sqrt((2 * h) / o.g);
        const x = v * t;
        return {
          prompt: `A ball is kicked horizontally at ${v} m/s off a cliff ${h} m high. How far from the base of the cliff does it land? (g = ${o.g} m/s²)`,
          answer: x, unit: 'm', mistakes: [v * Math.sqrt(h / o.g), (v * 2 * h) / o.g, 2 * x, t],
          explanation: `Fall time only depends on height: t = √(2h/g) = ${fmt(t)} s. Horizontally it keeps ${v} m/s: x = v·t = ${fmt(x)} m.`,
        };
      }),
    ],

    forces: [
      gen(1, 'F = m·a', function newtonSecond(o) {
        const m = rand(2, 50), a = rand(0.5, 10, o.easy ? 1 : 0.5);
        const F = m * a;
        return {
          prompt: `What net force is needed to accelerate a ${m} kg trolley at ${a} m/s²?`,
          answer: F, unit: 'N', mistakes: [m / a, a / m * 10, m + a],
          explanation: `Newton's 2nd law: F = m·a = ${m} × ${a} = ${fmt(F)} N.`,
        };
      }),
      gen(1, 'a = F / m', function accelerationFromForce() {
        const m = rand(2, 40), F = rand(10, 400, 10);
        const a = F / m;
        return {
          prompt: `A net force of ${F} N acts on a ${m} kg box. What is its acceleration?`,
          answer: a, unit: 'm/s²', mistakes: [F * m, m / F, F - m],
          explanation: `a = F / m = ${F} / ${m} = ${fmt(a)} m/s².`,
        };
      }),
      gen(1, 'W = m·g', function weight(o) {
        const m = rand(2, 120);
        const W = m * o.g;
        return {
          prompt: `What is the weight of a ${m} kg object on Earth? (g = ${o.g} m/s²)`,
          answer: W, unit: 'N', mistakes: [m, m / o.g, m * o.g * 2],
          explanation: `Weight is a force: W = m·g = ${m} × ${o.g} = ${fmt(W)} N. Mass (${m} kg) and weight are not the same thing!`,
        };
      }),
      gen(1, 'F = k·x', function hooke() {
        const k = rand(50, 500, 10), x = rand(0.05, 0.5, 0.05);
        const F = k * x;
        return {
          prompt: `A spring with stiffness k = ${k} N/m is stretched by ${x} m. What force does it exert?`,
          answer: F, unit: 'N', mistakes: [k / x, k * x * x, 0.5 * k * x],
          explanation: `Hooke's law: F = k·x = ${k} × ${x} = ${fmt(F)} N.`,
        };
      }),
      gen(2, 'F_net = m·a', function netForce() {
        const m = rand(2, 30), F1 = rand(20, 200, 10), F2 = rand(10, F1 - 10, 10);
        const a = (F1 - F2) / m;
        return {
          prompt: `A ${m} kg sled is pulled forward with ${F1} N while a ${F2} N force pulls it backward. What is its acceleration?`,
          answer: a, unit: 'm/s²', mistakes: [(F1 + F2) / m, F1 / m, (F1 - F2) * m],
          explanation: `Forces in opposite directions subtract: F_net = ${F1} − ${F2} = ${F1 - F2} N, so a = F_net / m = ${fmt(a)} m/s².`,
        };
      }),
      gen(2, 'f = μ·m·g', function friction(o) {
        const m = rand(5, 30), mu = pick([0.1, 0.2, 0.25, 0.3, 0.4]);
        const f = mu * m * o.g;
        const F = Math.ceil((f + rand(10, 80)) / 5) * 5;
        const a = (F - f) / m;
        return {
          prompt: `A ${m} kg crate is pushed across the floor with a ${F} N horizontal force. The coefficient of kinetic friction is ${mu}. What is its acceleration? (g = ${o.g} m/s²)`,
          answer: a, unit: 'm/s²', mistakes: [F / m, (F + f) / m, mu * o.g],
          explanation: `Friction f = μ·m·g = ${mu} × ${m} × ${o.g} = ${fmt(f)} N. Net force = ${F} − ${fmt(f)} = ${fmt(F - f)} N, so a = F_net / m = ${fmt(a)} m/s².`,
        };
      }),
      gen(3, 'a = g·(sin θ − μ·cos θ)', function incline(o) {
        const th = pick([20, 25, 30, 35, 40]), mu = pick([0.1, 0.15, 0.2, 0.25, 0.3]);
        const a = o.g * (Math.sin(rad(th)) - mu * Math.cos(rad(th)));
        return {
          prompt: `A block slides down a ${th}° slope. The coefficient of kinetic friction is ${mu}. What is its acceleration? (g = ${o.g} m/s²)`,
          answer: a, unit: 'm/s²',
          mistakes: [o.g * Math.sin(rad(th)), o.g * (Math.sin(rad(th)) + mu * Math.cos(rad(th))), o.g * (Math.cos(rad(th)) - mu * Math.sin(rad(th)))],
          explanation: `Along the slope: gravity component m·g·sinθ, friction μ·m·g·cosθ (the normal force is m·g·cosθ). a = g(sinθ − μcosθ) = ${o.g} × (sin ${th}° − ${mu} × cos ${th}°) = ${fmt(a)} m/s².`,
        };
      }),
      gen(3, 'N − m·g = m·a', function elevator(o) {
        const m = rand(40, 100, 5), a = rand(0.5, 3, 0.5), up = Math.random() < 0.5;
        const N = m * (o.g + (up ? a : -a));
        return {
          prompt: `A ${m} kg person stands on bathroom scales in a lift that is accelerating ${up ? 'upward' : 'downward'} at ${a} m/s². What force do the scales read? (g = ${o.g} m/s²)`,
          answer: N, unit: 'N', mistakes: [m * o.g, m * (o.g + (up ? -a : a)), m * a],
          explanation: `Net force = m·a: N − m·g = m·(${up ? '+' : '−'}${a}) ⇒ N = m(g ${up ? '+' : '−'} a) = ${m} × (${o.g} ${up ? '+' : '−'} ${a}) = ${fmt(N)} N. You feel ${up ? 'heavier' : 'lighter'}!`,
        };
      }),
      gen(3, 'F_net = (m₁ + m₂)·a', function pulley(o) {
        const m1 = rand(1, 10), m2 = rand(1, 20);
        const a = (m1 * o.g) / (m1 + m2);
        return {
          prompt: `A ${m2} kg block on a frictionless table is tied by a string over a pulley to a ${m1} kg mass hanging over the edge. What is the acceleration of the blocks? (g = ${o.g} m/s²)`,
          answer: a, unit: 'm/s²', mistakes: [o.g, (m1 * o.g) / m2, (m2 * o.g) / (m1 + m2)],
          explanation: `Only the hanging weight m₁g drives the motion, but it has to accelerate both masses: a = m₁g / (m₁ + m₂) = ${m1} × ${o.g} / ${m1 + m2} = ${fmt(a)} m/s².`,
        };
      }),
    ],

    energy: [
      gen(1, 'KE = ½·m·v²', function kinetic() {
        const m = rand(1, 80), v = rand(2, 25);
        const KE = 0.5 * m * v * v;
        return {
          prompt: `What is the kinetic energy of a ${m} kg object moving at ${v} m/s?`,
          answer: KE, unit: 'J', mistakes: [m * v * v, 0.5 * m * v, m * v],
          explanation: `KE = ½·m·v² = ½ × ${m} × ${v}² = ${fmt(KE)} J. Speed is squared, so doubling v quadruples KE!`,
        };
      }),
      gen(1, 'PE = m·g·h', function potential(o) {
        const m = rand(1, 60), h = rand(2, 50);
        const PE = m * o.g * h;
        return {
          prompt: `How much gravitational potential energy does a ${m} kg mass gain when lifted ${h} m? (g = ${o.g} m/s²)`,
          answer: PE, unit: 'J', mistakes: [m * h, 0.5 * m * o.g * h, o.g * h],
          explanation: `PE = m·g·h = ${m} × ${o.g} × ${h} = ${fmt(PE)} J.`,
        };
      }),
      gen(1, 'P = W / t', function power() {
        const W = rand(200, 6000, 100), t = rand(2, 60);
        const P = W / t;
        return {
          prompt: `A motor does ${W} J of work in ${t} s. What is its power output?`,
          answer: P, unit: 'W', mistakes: [W * t, t / W * 1000, W - t],
          explanation: `Power = work / time = ${W} / ${t} = ${fmt(P)} W.`,
        };
      }),
      gen(2, 'm·g·h = ½·m·v²', function speedAtBottom(o) {
        const h = rand(2, 60);
        const v = Math.sqrt(2 * o.g * h);
        return {
          prompt: `A ball slides down a frictionless ramp from a height of ${h} m, starting at rest. How fast is it going at the bottom? (g = ${o.g} m/s²)`,
          answer: v, unit: 'm/s', mistakes: [Math.sqrt(o.g * h), 2 * o.g * h, Math.sqrt(2 * h)],
          explanation: `Energy conservation: m·g·h = ½·m·v² ⇒ v = √(2gh) = √(2 × ${o.g} × ${h}) = ${fmt(v)} m/s. The mass cancels out!`,
        };
      }),
      gen(2, 'W = F·d·cos θ', function workAtAngle() {
        const F = rand(10, 200, 10), d = rand(2, 30), th = pick([30, 45, 60]);
        const W = F * d * Math.cos(rad(th));
        return {
          prompt: `A sled is pulled ${d} m by a rope with tension ${F} N at ${th}° above the horizontal. How much work does the rope do?`,
          answer: W, unit: 'J', mistakes: [F * d, F * d * Math.sin(rad(th)), F / d],
          explanation: `Only the component along the motion does work: W = F·d·cos θ = ${F} × ${d} × cos ${th}° = ${fmt(W)} J.`,
        };
      }),
      gen(3, '½·k·x² = ½·m·v²', function springLaunch() {
        const k = rand(100, 1000, 50), x = rand(0.05, 0.3, 0.05), m = rand(0.1, 2, 0.1);
        const v = x * Math.sqrt(k / m);
        return {
          prompt: `A spring (k = ${k} N/m) is compressed by ${x} m and launches a ${m} kg ball across a frictionless floor. How fast does the ball leave the spring?`,
          answer: v, unit: 'm/s', mistakes: [(k * x) / m, x * Math.sqrt(k / (2 * m)), (0.5 * k * x * x) / m],
          explanation: `Spring energy becomes kinetic energy: ½kx² = ½mv² ⇒ v = x·√(k/m) = ${x} × √(${k}/${m}) = ${fmt(v)} m/s.`,
        };
      }),
      gen(3, 'm·g·h = ½·m·v² + E_lost', function frictionRamp(o) {
        const m = rand(2, 20), h = rand(3, 20);
        const mgh = m * o.g * h;
        const lost = Math.round(mgh * rand(0.1, 0.5, 0.05));
        const v = Math.sqrt((2 * (mgh - lost)) / m);
        return {
          prompt: `A ${m} kg sledge slides from rest down a hill ${h} m high. Friction turns ${lost} J into heat on the way down. How fast is it going at the bottom? (g = ${o.g} m/s²)`,
          answer: v, unit: 'm/s', mistakes: [Math.sqrt(2 * o.g * h), Math.sqrt((2 * (mgh + lost)) / m), Math.sqrt((mgh - lost) / m)],
          explanation: `Start: PE = m·g·h = ${fmt(mgh)} J. Minus ${lost} J lost leaves KE = ${fmt(mgh - lost)} J. v = √(2·KE/m) = √(2 × ${fmt(mgh - lost)} / ${m}) = ${fmt(v)} m/s.`,
        };
      }),
      gen(3, 'efficiency = useful energy out / energy in', function efficiency(o) {
        const m = rand(20, 200, 10), h = rand(2, 20), t = rand(5, 60, 5);
        const useful = m * o.g * h;
        const P = Math.max(1, Math.round(useful / (t * rand(0.4, 0.9, 0.05))));
        const eff = (useful / (P * t)) * 100;
        return {
          prompt: `A motor with an input power of ${P} W lifts a ${m} kg load ${h} m in ${t} s. What is its efficiency? (g = ${o.g} m/s²)`,
          answer: eff, unit: '%', mistakes: [((P * t) / useful) * 100, (useful / P) * 100, 100 - eff],
          explanation: `Useful energy = m·g·h = ${fmt(useful)} J. Energy in = P·t = ${P} × ${t} = ${P * t} J. Efficiency = ${fmt(useful)} / ${P * t} = ${fmt(eff)} %.`,
        };
      }),
    ],

    momentum: [
      gen(1, 'p = m·v', function momentum() {
        const m = rand(1, 90), v = rand(2, 30);
        const p = m * v;
        return {
          prompt: `What is the momentum of a ${m} kg object moving at ${v} m/s?`,
          answer: p, unit: 'kg·m/s', mistakes: [0.5 * m * v * v, m / v, m + v],
          explanation: `p = m·v = ${m} × ${v} = ${fmt(p)} kg·m/s.`,
        };
      }),
      gen(1, 'Δp = m·(v − u)', function changeInMomentum() {
        const m = rand(1, 20), u = rand(1, 10), v = rand(u + 2, 30);
        const dp = m * (v - u);
        return {
          prompt: `A ${m} kg cart speeds up from ${u} m/s to ${v} m/s. What is its change in momentum?`,
          answer: dp, unit: 'kg·m/s', mistakes: [m * (v + u), m * v, (v - u) / m],
          explanation: `Δp = m·v − m·u = ${m} × (${v} − ${u}) = ${fmt(dp)} kg·m/s.`,
        };
      }),
      gen(2, 'F·Δt = m·Δv', function impulse() {
        const m = rand(1, 20), F = rand(10, 200, 10), t = rand(0.1, 2, 0.1);
        const v = (F * t) / m;
        return {
          prompt: `A ${m} kg ball at rest is pushed by a constant ${F} N force for ${t} s. What speed does it reach?`,
          answer: v, unit: 'm/s', mistakes: [F * t, F / (m * t), (F * m) / t],
          explanation: `Impulse = change in momentum: F·Δt = m·v ⇒ v = F·Δt / m = ${F} × ${t} / ${m} = ${fmt(v)} m/s.`,
        };
      }),
      gen(2, 'm₁·v₁ = (m₁ + m₂)·v', function inelastic() {
        const m1 = rand(500, 2000, 100), v1 = rand(5, 25), m2 = rand(500, 2000, 100);
        const v = (m1 * v1) / (m1 + m2);
        return {
          prompt: `A ${m1} kg car moving at ${v1} m/s crashes into a stationary ${m2} kg car and they stick together. How fast do they move just after the collision?`,
          answer: v, unit: 'm/s', mistakes: [v1 / 2, (m1 * v1) / m2, v1],
          explanation: `Momentum is conserved: m₁v₁ = (m₁ + m₂)·v ⇒ v = ${m1} × ${v1} / (${m1} + ${m2}) = ${fmt(v)} m/s.`,
        };
      }),
      gen(2, '0 = m₁·v₁ − m₂·v₂', function recoil() {
        const mb = rand(0.01, 0.05, 0.01), vb = rand(200, 800, 50), mg = rand(2, 6);
        const v = (mb * vb) / mg;
        return {
          prompt: `A ${mg} kg rifle fires a ${mb} kg bullet at ${vb} m/s. What is the rifle's recoil speed?`,
          answer: v, unit: 'm/s', mistakes: [vb / mg, mb * vb, (mg * vb) / 1000],
          explanation: `Total momentum starts at zero, so m_bullet·v_bullet = m_rifle·v_rifle ⇒ v = ${mb} × ${vb} / ${mg} = ${fmt(v)} m/s.`,
        };
      }),
      gen(3, 'momentum AND kinetic energy conserved', function elastic() {
        const m1 = rand(1, 10), v1 = rand(2, 20), m2 = rand(1, 10);
        const v2 = (2 * m1 * v1) / (m1 + m2);
        return {
          prompt: `A ${m1} kg ball moving at ${v1} m/s hits a stationary ${m2} kg ball head-on in a perfectly elastic collision. How fast does the ${m2} kg ball move afterwards?`,
          answer: v2, unit: 'm/s', mistakes: [(m1 * v1) / (m1 + m2), v1 === v2 ? v1 / 2 : v1, (m1 * v1) / m2],
          explanation: `Solving conservation of momentum and kinetic energy together (target at rest) gives v₂ = 2m₁v₁ / (m₁ + m₂) = 2 × ${m1} × ${v1} / ${m1 + m2} = ${fmt(v2)} m/s.`,
        };
      }),
      gen(3, 'F = Δp / Δt', function reboundForce() {
        const m = rand(0.1, 1, 0.1), v = rand(5, 30), v2 = rand(2, v - 1), t = rand(0.01, 0.1, 0.01);
        const F = (m * (v + v2)) / t;
        return {
          prompt: `A ${m} kg ball hits a wall at ${v} m/s and bounces straight back at ${v2} m/s. It is in contact with the wall for ${t} s. What is the average force on the ball?`,
          answer: F, unit: 'N', mistakes: [(m * (v - v2)) / t, (m * v) / t, m * (v + v2) * t],
          explanation: `Velocity reverses, so Δv = ${v2} − (−${v}) = ${v + v2} m/s. F = m·Δv / Δt = ${m} × ${v + v2} / ${t} = ${fmt(F)} N. Forgetting the direction change is the trap!`,
        };
      }),
      gen(3, 'KE lost = KE before − KE after', function keLost() {
        const m1 = rand(1, 10), v1 = rand(2, 15), m2 = rand(1, 10);
        const vf = (m1 * v1) / (m1 + m2);
        const before = 0.5 * m1 * v1 * v1, after = 0.5 * (m1 + m2) * vf * vf;
        const lost = before - after;
        return {
          prompt: `A ${m1} kg trolley at ${v1} m/s collides with a stationary ${m2} kg trolley and they couple together. How much kinetic energy is lost in the collision?`,
          answer: lost, unit: 'J', mistakes: [before, after, 2 * lost],
          explanation: `Momentum gives v = ${m1} × ${v1} / ${m1 + m2} = ${fmt(vf)} m/s. KE before = ${fmt(before)} J, KE after = ½ × ${m1 + m2} × ${fmt(vf)}² = ${fmt(after)} J. Lost = ${fmt(lost)} J (turned into heat and sound).`,
        };
      }),
    ],

    waves: [
      gen(1, 'v = f·λ', function waveSpeed() {
        const f = rand(50, 1000, 10), lam = rand(0.2, 5, 0.1);
        const v = f * lam;
        return {
          prompt: `A wave has frequency ${f} Hz and wavelength ${lam} m. What is its speed?`,
          answer: v, unit: 'm/s', mistakes: [f / lam, lam / f * 1000, f + lam],
          explanation: `Wave equation: v = f·λ = ${f} × ${lam} = ${fmt(v)} m/s.`,
        };
      }),
      gen(1, 'λ = v / f', function wavelength() {
        const f = rand(100, 2000, 50);
        const lam = SOUND / f;
        return {
          prompt: `Sound travels at ${SOUND} m/s in air. What is the wavelength of a ${f} Hz note?`,
          answer: lam, unit: 'm', mistakes: [SOUND * f, f / SOUND, SOUND / f / 2],
          explanation: `λ = v / f = ${SOUND} / ${f} = ${fmt(lam)} m.`,
        };
      }),
      gen(1, 'T = 1 / f', function period() {
        const f = rand(2, 50);
        const T = 1 / f;
        return {
          prompt: `A machine vibrates at ${f} Hz. What is the period of one vibration?`,
          answer: T, unit: 's', mistakes: [f, (2 * Math.PI) / f, 1 / (2 * f)],
          explanation: `Period is the inverse of frequency: T = 1/f = 1/${f} = ${fmt(T)} s.`,
        };
      }),
      gen(1, 'f = number of waves / time', function frequencyCount() {
        const t = rand(5, 60, 5), N = rand(5, 60);
        const f = N / t;
        return {
          prompt: `A buoy bobs up and down ${N} times in ${t} s as waves pass. What is the frequency of the waves?`,
          answer: f, unit: 'Hz', mistakes: [t / N, N * t, N / t / 2],
          explanation: `Frequency = waves per second = ${N} / ${t} = ${fmt(f)} Hz.`,
        };
      }),
      gen(2, 'd = v·t / 2', function echo() {
        const t = rand(0.5, 6, 0.5);
        const d = (SOUND * t) / 2;
        return {
          prompt: `You shout toward a cliff and hear the echo ${t} s later. How far away is the cliff? (speed of sound = ${SOUND} m/s)`,
          answer: d, unit: 'm', mistakes: [SOUND * t, SOUND / t, 2 * SOUND * t],
          explanation: `The sound travels there AND back, so 2d = v·t ⇒ d = ${SOUND} × ${t} / 2 = ${fmt(d)} m.`,
        };
      }),
      gen(2, 't = d / c', function lightTravel() {
        const trip = pick([
          { from: 'the Moon to Earth', d: 3.84e8 },
          { from: 'the Sun to Earth', d: 1.5e11 },
          { from: 'Mars to Earth (at their closest)', d: 5.5e10 },
          { from: 'a GPS satellite to your phone', d: 2.02e7 },
        ]);
        const t = trip.d / LIGHT;
        return {
          prompt: `Light travels at 3 × 10⁸ m/s. How long does light take to travel from ${trip.from}, a distance of ${fmt(trip.d)} m?`,
          answer: t, unit: 's', mistakes: [trip.d / 3e5, (2 * trip.d) / LIGHT, t / 60],
          explanation: `t = d / c = ${fmt(trip.d)} / (3 × 10⁸) = ${fmt(t)} s. Careful with the powers of ten!`,
        };
      }),
      gen(3, 'fₙ = n·v / (2L)', function stringHarmonic() {
        const L = rand(0.3, 1.5, 0.1), v = rand(100, 500, 10), n = pick([1, 2, 3]);
        const f = (n * v) / (2 * L);
        return {
          prompt: `A guitar string is ${L} m long and waves travel along it at ${v} m/s. What is the frequency of its ${ORDINAL[n]} harmonic?`,
          answer: f, unit: 'Hz', mistakes: [(n * v) / L, (n * v) / (4 * L), n > 1 ? v / (2 * L) : (2 * v) / (2 * L), ((n + 1) * v) / (2 * L)],
          explanation: `With both ends fixed, the nth harmonic fits n half-wavelengths: λ = 2L/n. So f = n·v/(2L) = ${n} × ${v} / (2 × ${L}) = ${fmt(f)} Hz.`,
        };
      }),
      gen(3, "f' = f·v / (v ∓ v_s)", function doppler() {
        const f = rand(300, 1000, 50), vs = rand(10, 40, 5), toward = Math.random() < 0.5;
        const heard = (f * SOUND) / (SOUND + (toward ? -vs : vs));
        const other = (f * SOUND) / (SOUND + (toward ? vs : -vs));
        return {
          prompt: `An ambulance siren emits ${f} Hz. It drives ${toward ? 'toward' : 'away from'} you at ${vs} m/s. What frequency do you hear? (speed of sound = ${SOUND} m/s)`,
          answer: heard, unit: 'Hz', mistakes: [other, (f * (SOUND + (toward ? vs : -vs))) / SOUND, f],
          explanation: `Moving source: f' = f·v / (v ${toward ? '−' : '+'} v_s) = ${f} × ${SOUND} / (${SOUND} ${toward ? '−' : '+'} ${vs}) = ${fmt(heard)} Hz. ${toward ? 'Approaching → higher pitch.' : 'Moving away → lower pitch.'}`,
        };
      }),
      gen(3, 'v = √(T / μ)', function stringSpeed() {
        const T = rand(20, 200, 10), mu = rand(0.002, 0.02, 0.002);
        const v = Math.sqrt(T / mu);
        return {
          prompt: `A rope under ${T} N of tension has a mass per unit length of ${mu} kg/m. How fast do waves travel along it?`,
          answer: v, unit: 'm/s', mistakes: [T / mu, Math.sqrt(T * mu), Math.sqrt(T / mu) / 2],
          explanation: `Wave speed on a string: v = √(T/μ) = √(${T} / ${mu}) = ${fmt(v)} m/s. Tighter or lighter string → faster waves.`,
        };
      }),
    ],

    electricity: [
      gen(1, 'V = I·R', function ohmVoltage(o) {
        const I = rand(0.5, 5, o.easy ? 1 : 0.5), R = rand(2, 100, 2);
        const V = I * R;
        return {
          prompt: `A current of ${I} A flows through a ${R} Ω resistor. What is the voltage across it?`,
          answer: V, unit: 'V', mistakes: [I / R, R / I, I + R],
          explanation: `Ohm's law: V = I·R = ${I} × ${R} = ${fmt(V)} V.`,
        };
      }),
      gen(1, 'I = V / R', function ohmCurrent() {
        const V = pick([1.5, 3, 4.5, 6, 9, 12, 24, 230]), R = rand(2, 200, 2);
        const I = V / R;
        return {
          prompt: `A ${V} V source is connected across a ${R} Ω resistor. What current flows?`,
          answer: I, unit: 'A', mistakes: [V * R, R / V, V / R / 2],
          explanation: `I = V / R = ${V} / ${R} = ${fmt(I)} A.`,
        };
      }),
      gen(1, 'P = V·I', function electricPower(o) {
        const V = pick([3, 6, 9, 12, 24, 120, 230]), I = o.easy ? rand(1, 10) : rand(0.2, 10, 0.2);
        const P = V * I;
        return {
          prompt: `A device draws ${I} A from a ${V} V supply. What power does it use?`,
          answer: P, unit: 'W', mistakes: [V / I, I / V * 100, V * I * I],
          explanation: `P = V·I = ${V} × ${I} = ${fmt(P)} W.`,
        };
      }),
      gen(2, 'R = R₁ + R₂ + R₃', function series() {
        const rs = [rand(2, 50), rand(2, 50), rand(2, 50)];
        const R = rs[0] + rs[1] + rs[2];
        const par = 1 / (1 / rs[0] + 1 / rs[1] + 1 / rs[2]);
        return {
          prompt: `Resistors of ${rs[0]} Ω, ${rs[1]} Ω and ${rs[2]} Ω are connected in series. What is the total resistance?`,
          answer: R, unit: 'Ω', mistakes: [par, R / 3, Math.max(...rs)],
          explanation: `In series, resistances simply add: ${rs[0]} + ${rs[1]} + ${rs[2]} = ${R} Ω.`,
        };
      }),
      gen(2, '1/R = 1/R₁ + 1/R₂', function parallel() {
        const r1 = rand(2, 60, 2), r2 = rand(2, 60, 2);
        const R = (r1 * r2) / (r1 + r2);
        return {
          prompt: `Two resistors, ${r1} Ω and ${r2} Ω, are connected in parallel. What is the combined resistance?`,
          answer: R, unit: 'Ω', mistakes: [r1 + r2, (r1 + r2) / 2, 1 / (r1 + r2) * 100],
          explanation: `Parallel: 1/R = 1/${r1} + 1/${r2} ⇒ R = (${r1} × ${r2}) / (${r1} + ${r2}) = ${fmt(R)} Ω. It's always smaller than the smallest resistor!`,
        };
      }),
      gen(2, 'E = P·t', function energyUsed() {
        const P = rand(100, 3000, 100), h = rand(1, 10);
        const E = (P * h) / 1000;
        return {
          prompt: `A ${P} W heater runs for ${h} hours. How much energy does it use, in kilowatt-hours?`,
          answer: E, unit: 'kWh', mistakes: [P * h, (P * h) / 100, P / h / 1000],
          explanation: `Convert to kilowatts first: ${P} W = ${fmt(P / 1000)} kW. E = P·t = ${fmt(P / 1000)} kW × ${h} h = ${fmt(E)} kWh.`,
        };
      }),
      gen(3, 'R = R₁ + (R₂·R₃)/(R₂ + R₃)', function mixedCircuit() {
        const V = pick([6, 9, 12, 24]), R1 = rand(2, 20), R2 = rand(4, 40, 2), R3 = rand(4, 40, 2);
        const Rp = (R2 * R3) / (R2 + R3);
        const I = V / (R1 + Rp);
        return {
          prompt: `A ${V} V battery is connected to a ${R1} Ω resistor in series with a parallel pair of ${R2} Ω and ${R3} Ω. What current does the battery supply?`,
          answer: I, unit: 'A', mistakes: [V / (R1 + R2 + R3), V / R1, V / Rp],
          explanation: `Parallel pair: ${R2}·${R3}/(${R2}+${R3}) = ${fmt(Rp)} Ω. Total = ${R1} + ${fmt(Rp)} = ${fmt(R1 + Rp)} Ω. I = V/R = ${V} / ${fmt(R1 + Rp)} = ${fmt(I)} A.`,
        };
      }),
      gen(3, 'P = I²·R', function seriesPower() {
        const V = pick([6, 9, 12, 24]), R1 = rand(2, 30), R2 = rand(2, 30);
        const I = V / (R1 + R2);
        const P = I * I * R1;
        return {
          prompt: `A ${R1} Ω and a ${R2} Ω resistor are in series with a ${V} V battery. How much power is dissipated in the ${R1} Ω resistor?`,
          answer: P, unit: 'W', mistakes: [(V * V) / R1, (V * V) / (R1 + R2), I * R1],
          explanation: `Current is the same everywhere in series: I = ${V} / (${R1} + ${R2}) = ${fmt(I)} A. P = I²·R = ${fmt(I)}² × ${R1} = ${fmt(P)} W. Using V²/R with the full ${V} V is wrong: the ${R1} Ω resistor doesn't get all of it.`,
        };
      }),
      gen(3, 'V = E − I·r', function internalResistance() {
        const E = pick([1.5, 3, 4.5, 6, 9, 12]), r = rand(0.2, 2, 0.1), R = rand(2, 20);
        const I = E / (R + r);
        const V = I * R;
        return {
          prompt: `A battery with EMF ${E} V and internal resistance ${r} Ω is connected to a ${R} Ω lamp. What is the voltage across the lamp?`,
          answer: V, unit: 'V', mistakes: [E, I * r, I],
          explanation: `I = E / (R + r) = ${E} / ${fmt(R + r)} = ${fmt(I)} A. Some voltage is "lost" inside the battery: V = E − I·r = ${E} − ${fmt(I * r)} = ${fmt(V)} V.`,
        };
      }),
    ],
  };

  // ---------- conceptual questions (first choice is correct) ----------
  const CONCEPTS = {
    kinematics: [
      { prompt: 'A ball is thrown straight up. At the very top of its flight, what is true?',
        choices: ['Velocity is zero, acceleration is g downward', 'Velocity and acceleration are both zero', 'Velocity is zero, acceleration is upward', 'Velocity is maximum'],
        explanation: 'At the top the ball momentarily stops, but gravity never switches off — the acceleration is still g downward the whole time.' },
      { prompt: 'Ignoring air resistance, a feather and a hammer are dropped together on the Moon. What happens?',
        choices: ['They hit the ground at the same time', 'The hammer lands first', 'The feather lands first', 'The feather floats away'],
        explanation: 'Without air, every object falls with the same acceleration regardless of mass. Apollo 15 astronauts actually did this experiment!' },
      { prompt: 'On a distance–time graph, what does the slope represent?',
        choices: ['Speed', 'Acceleration', 'Distance travelled', 'Force'],
        explanation: 'Slope = change in distance / change in time = speed. On a velocity–time graph, the slope is acceleration.' },
      { prompt: 'Two balls leave a table at the same moment: one is dropped, one is fired horizontally. Which lands first?',
        choices: ['They land at the same time', 'The dropped ball', 'The fired ball', 'It depends on the fired speed'],
        explanation: 'Horizontal and vertical motions are independent. Both start with zero vertical velocity, so both fall the same height in the same time.' },
    ],
    forces: [
      { prompt: 'A book rests on a table. According to Newton\'s 3rd law, what is the reaction to the book\'s weight (Earth pulling the book down)?',
        choices: ['The book pulling the Earth up', 'The table pushing the book up', 'The book pushing on the table', 'Friction'],
        explanation: 'Action–reaction pairs act on DIFFERENT objects and are the same type of force. Earth pulls the book (gravity) ⇔ the book pulls Earth (gravity). The table\'s push is a separate force.' },
      { prompt: 'A spacecraft far from any planet is moving at 1000 m/s with its engines off. What happens?',
        choices: ['It keeps moving at 1000 m/s in a straight line', 'It slowly comes to a stop', 'It speeds up', 'It starts to curve'],
        explanation: "Newton's 1st law: with no net force, an object keeps its velocity. Nothing is needed to keep something moving — only to change its motion." },
      { prompt: 'A car moves at constant velocity on a straight road. What is the net force on it?',
        choices: ['Zero', 'Forward, equal to the engine force', 'Backward, due to friction', 'Downward, due to gravity'],
        explanation: 'Constant velocity means zero acceleration, so the net force must be zero. The engine force exactly balances drag and friction.' },
      { prompt: 'Your mass is 60 kg on Earth. What is your mass on the Moon?',
        choices: ['60 kg', '10 kg', '0 kg', '360 kg'],
        explanation: 'Mass is the amount of matter and does not change. Your WEIGHT on the Moon is about 1/6 of Earth\'s because g is smaller there.' },
    ],
    energy: [
      { prompt: 'If you double the speed of a car, its kinetic energy becomes…',
        choices: ['4 times larger', '2 times larger', 'Unchanged', '8 times larger'],
        explanation: 'KE = ½mv². Doubling v multiplies v² by 4. This is why high-speed crashes are so much more dangerous.' },
      { prompt: 'A pendulum swings back and forth. At the lowest point of its swing it has…',
        choices: ['Maximum kinetic energy, minimum potential energy', 'Maximum potential energy, minimum kinetic energy', 'Zero total energy', 'Equal KE and PE always'],
        explanation: 'As it falls, PE converts to KE. At the bottom it is fastest (max KE) and lowest (min PE).' },
      { prompt: 'You carry a heavy box horizontally across a room at constant speed. How much work does gravity do on the box?',
        choices: ['Zero', 'm·g·d', 'Negative m·g·d', 'It depends on the speed'],
        explanation: 'Work = F·d·cos θ. Gravity points down, the motion is horizontal: θ = 90° and cos 90° = 0.' },
      { prompt: 'The SI unit of power, the watt, is equal to…',
        choices: ['1 joule per second', '1 newton per metre', '1 joule × second', '1 volt per ampere'],
        explanation: 'Power is the rate of doing work: 1 W = 1 J/s.' },
    ],
    momentum: [
      { prompt: 'Why do airbags reduce injuries in a crash?',
        choices: ['They increase the stopping time, reducing the force', 'They reduce your change in momentum', 'They increase your mass', 'They absorb all of your momentum instantly'],
        explanation: 'Impulse F·Δt = Δp. Your change in momentum is fixed, so a longer stopping time Δt means a smaller force F.' },
      { prompt: 'In which type of collision is kinetic energy conserved?',
        choices: ['Elastic', 'Inelastic', 'Perfectly inelastic', 'All collisions'],
        explanation: 'Momentum is conserved in all collisions (with no external force), but kinetic energy is only conserved in elastic ones.' },
      { prompt: 'A skater standing still throws a heavy ball forward. What happens to the skater?',
        choices: ['They glide backward', 'They stay still', 'They glide forward', 'They spin'],
        explanation: 'Total momentum was zero before, so it must be zero after: the ball goes forward, the skater goes backward.' },
    ],
    waves: [
      { prompt: 'Why can\'t sound travel through outer space?',
        choices: ['Sound needs a medium (particles) to travel through', 'Space is too cold', 'Sound is absorbed by stars', 'Sound travels too slowly'],
        explanation: 'Sound is a mechanical wave — vibrating particles. In a vacuum there are no particles to vibrate. Light, an electromagnetic wave, needs no medium.' },
      { prompt: 'A note gets higher in pitch. What has increased?',
        choices: ['Frequency', 'Amplitude', 'Wavelength', 'Speed of sound'],
        explanation: 'Pitch is determined by frequency. Loudness is determined by amplitude.' },
      { prompt: 'An ambulance siren sounds higher as it approaches you and lower as it moves away. This is called…',
        choices: ['The Doppler effect', 'Refraction', 'Resonance', 'Diffraction'],
        explanation: 'The Doppler effect: waves bunch up in front of a moving source (higher frequency) and spread out behind it (lower frequency).' },
      { prompt: 'Sound waves in air are…',
        choices: ['Longitudinal', 'Transverse', 'Electromagnetic', 'Standing only'],
        explanation: 'In sound, air particles vibrate back and forth along the direction the wave travels — that makes it longitudinal.' },
    ],
    electricity: [
      { prompt: 'When more bulbs are added in parallel to a battery, the total current from the battery…',
        choices: ['Increases', 'Decreases', 'Stays the same', 'Becomes zero'],
        explanation: 'Each new parallel branch is another path for current, so total resistance drops and the total current increases.' },
      { prompt: 'In a series circuit, one bulb breaks. What happens to the others?',
        choices: ['They all go out', 'They get brighter', 'Nothing changes', 'Only the next bulb goes out'],
        explanation: 'A series circuit has only one path. A break anywhere stops the current everywhere.' },
      { prompt: 'Which is the best description of electric current?',
        choices: ['The rate of flow of charge', 'The energy per unit charge', 'The opposition to charge flow', 'The total charge stored'],
        explanation: 'Current I = Q/t — the charge passing a point per second. Energy per charge is voltage; opposition to flow is resistance.' },
      { prompt: 'A 60 W bulb and a 100 W bulb are both designed for 230 V. Which has the higher resistance?',
        choices: ['The 60 W bulb', 'The 100 W bulb', 'They have the same resistance', 'It cannot be determined'],
        explanation: 'P = V²/R, so R = V²/P. With the same V, a smaller P means a larger R.' },
    ],
  };

  // ---------- formula reference ----------
  const FORMULAS = {
    kinematics: [
      ['v = d / t', 'speed = distance ÷ time'],
      ['v = u + a·t', 'final velocity after accelerating'],
      ['s = u·t + ½·a·t²', 'displacement with constant acceleration'],
      ['v² = u² + 2·a·s', 'no time needed'],
      ['R = v²·sin(2θ) / g', 'range of a projectile on flat ground'],
      ['x = v·t,  h = ½·g·t²', 'horizontal launch: split into x and y'],
    ],
    forces: [
      ['F = m·a', "Newton's 2nd law"],
      ['W = m·g', 'weight (g = 9.8 m/s², or 10 in Beginner)'],
      ['f = μ·N', 'friction force (N = normal force)'],
      ['F = k·x', "Hooke's law for springs"],
      ['a = g·(sin θ − μ·cos θ)', 'sliding down a slope with friction'],
      ['N = m·(g ± a)', 'apparent weight in an accelerating lift'],
    ],
    energy: [
      ['KE = ½·m·v²', 'kinetic energy'],
      ['PE = m·g·h', 'gravitational potential energy'],
      ['E = ½·k·x²', 'energy stored in a spring'],
      ['W = F·d·cos θ', 'work done by a force'],
      ['P = W / t', 'power = work ÷ time'],
      ['efficiency = useful out / total in', 'as a fraction or ×100 for %'],
    ],
    momentum: [
      ['p = m·v', 'momentum'],
      ['F·Δt = Δp', 'impulse = change in momentum'],
      ['m₁u₁ + m₂u₂ = m₁v₁ + m₂v₂', 'conservation of momentum'],
      ['v₂ = 2m₁v₁ / (m₁ + m₂)', 'elastic collision, target at rest'],
    ],
    waves: [
      ['v = f·λ', 'wave speed'],
      ['T = 1 / f', 'period'],
      ['d = v·t / 2', 'echo distance'],
      ['fₙ = n·v / (2L)', 'harmonics on a string fixed at both ends'],
      ['v = √(T / μ)', 'wave speed on a string'],
      ["f' = f·v / (v ∓ v_s)", 'Doppler effect, moving source (− approaching)'],
    ],
    electricity: [
      ['V = I·R', "Ohm's law"],
      ['P = V·I = I²R = V²/R', 'electrical power'],
      ['R = R₁ + R₂ + …', 'series resistors'],
      ['1/R = 1/R₁ + 1/R₂ + …', 'parallel resistors'],
      ['E = P·t', 'energy (kWh when P in kW and t in hours)'],
      ['V = E − I·r', 'terminal voltage with internal resistance'],
    ],
  };

  // ---------- public API ----------
  function generate(topicId, difficultyId) {
    const diff = DIFF[difficultyId] || DIFF.medium;
    const gens = GENERATORS[topicId];
    if (!gens) throw new Error('Unknown topic: ' + topicId);
    const concepts = CONCEPTS[topicId] || [];
    if (concepts.length && Math.random() < diff.conceptRate) {
      return Object.assign(conceptual(topicId, pick(concepts)), { difficulty: diff.id });
    }
    const pool = gens.filter((g) => diff.tierWeights[g.tier]);
    const chosen = weightedPick(pool, (g) => diff.tierWeights[g.tier]);
    const raw = chosen.make({ g: diff.g, easy: diff.id === 'beginner' });
    const q = diff.typed ? typed(topicId, raw) : numeric(topicId, raw);
    return Object.assign(q, { formula: chosen.formula, tier: chosen.tier, difficulty: diff.id });
  }

  // Pick a topic, favouring the ones the player is weakest at.
  // accuracyByTopic: { topicId: number in [0,1] or undefined when unseen }
  function pickWeightedTopic(accuracyByTopic) {
    const weights = TOPICS.map((t) => {
      const acc = accuracyByTopic && accuracyByTopic[t.id];
      return 1.6 - (acc === undefined || acc === null ? 0.5 : acc);
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < TOPICS.length; i++) {
      r -= weights[i];
      if (r <= 0) return TOPICS[i].id;
    }
    return TOPICS[TOPICS.length - 1].id;
  }

  const api = {
    G, TOPICS, DIFFICULTIES, DIFF, GENERATORS, CONCEPTS, FORMULAS,
    generate, pickWeightedTopic, fmt, numeric, typed, conceptual, parseAnswer, checkTyped,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PhysicsQuestions = api;
})(typeof window !== 'undefined' ? window : globalThis);

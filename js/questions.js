/*
 * Physics Quest — question engine.
 * Generates endless randomized numeric problems plus conceptual questions.
 * Works as a browser global (window.PhysicsQuestions) and as a Node module (for tests).
 */
(function (root) {
  'use strict';

  const G = 9.8; // m/s², used consistently everywhere

  // ---------- helpers ----------
  function rand(min, max, step) {
    step = step || 1;
    const n = Math.floor((max - min) / step + 1e-9) + 1;
    return +(min + Math.floor(Math.random() * n) * step).toFixed(6);
  }
  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  // Round to 3 significant figures for display (whole numbers above 1000).
  function fmt(x) {
    if (!isFinite(x)) return String(x);
    if (x === 0) return '0';
    if (Math.abs(x) >= 1000) return String(Math.round(x));
    return String(Number(x.toPrecision(3)));
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
      explanation: c.explanation,
    };
  }

  // ---------- topics ----------
  const TOPICS = [
    { id: 'kinematics', name: 'Motion', icon: '🏃', blurb: 'Speed, velocity, acceleration, free fall' },
    { id: 'forces', name: 'Forces', icon: '🧲', blurb: "Newton's laws, weight, friction, springs" },
    { id: 'energy', name: 'Energy', icon: '⚡', blurb: 'Kinetic & potential energy, work, power' },
    { id: 'momentum', name: 'Momentum', icon: '🎱', blurb: 'Momentum, collisions, impulse' },
    { id: 'waves', name: 'Waves', icon: '🌊', blurb: 'Frequency, wavelength, sound' },
    { id: 'electricity', name: 'Electricity', icon: '🔌', blurb: "Ohm's law, power, circuits" },
  ];

  // ---------- numeric generators ----------
  const GENERATORS = {
    kinematics: [
      function constantVelocity() {
        const v = rand(3, 30), t = rand(2, 20);
        const d = v * t;
        return {
          prompt: `A cyclist moves at a constant ${v} m/s for ${t} s. How far do they travel?`,
          answer: d, unit: 'm', mistakes: [v / t, v + t, t / v * 10],
          explanation: `Constant velocity: d = v·t = ${v} × ${t} = ${fmt(d)} m.`,
        };
      },
      function finalSpeed() {
        const a = rand(1, 6, 0.5), t = rand(2, 10);
        const v = a * t;
        return {
          prompt: `A car starts from rest and accelerates at ${a} m/s² for ${t} s. What is its final speed?`,
          answer: v, unit: 'm/s', mistakes: [0.5 * a * t, a * t * t, a / t],
          explanation: `From rest: v = u + a·t = 0 + ${a} × ${t} = ${fmt(v)} m/s.`,
        };
      },
      function distanceFromRest() {
        const a = rand(1, 6, 0.5), t = rand(2, 10);
        const s = 0.5 * a * t * t;
        return {
          prompt: `An object starts from rest with acceleration ${a} m/s². How far does it go in ${t} s?`,
          answer: s, unit: 'm', mistakes: [a * t * t, a * t, 0.5 * a * t],
          explanation: `s = u·t + ½·a·t² = 0 + ½ × ${a} × ${t}² = ${fmt(s)} m. Don't forget the ½ and the square!`,
        };
      },
      function freeFallTime() {
        const h = pick([5, 10, 20, 30, 45, 60, 80, 100, 125]);
        const t = Math.sqrt((2 * h) / G);
        return {
          prompt: `A stone is dropped from a height of ${h} m. How long does it take to hit the ground? (ignore air resistance, g = 9.8 m/s²)`,
          answer: t, unit: 's', mistakes: [Math.sqrt(h / G), (2 * h) / G, h / G],
          explanation: `h = ½·g·t² ⇒ t = √(2h/g) = √(2 × ${h} / 9.8) = ${fmt(t)} s.`,
        };
      },
      function averageSpeed() {
        const d1 = rand(20, 120, 10), t1 = rand(1, 3), d2 = rand(20, 120, 10), t2 = rand(1, 4);
        const avg = (d1 + d2) / (t1 + t2);
        const wrong = (d1 / t1 + d2 / t2) / 2;
        return {
          prompt: `A bus travels ${d1} km in ${t1} h, then ${d2} km in ${t2} h. What is its average speed for the whole trip?`,
          answer: avg, unit: 'km/h', mistakes: [wrong, (d1 + d2) / Math.max(t1, t2), d1 / t1 + d2 / t2],
          explanation: `Average speed = total distance / total time = (${d1} + ${d2}) / (${t1} + ${t2}) = ${fmt(avg)} km/h. Averaging the two speeds (${fmt(wrong)}) is a classic trap!`,
        };
      },
      function stoppingDistance() {
        const v = rand(10, 30, 2), a = rand(2, 8);
        const s = (v * v) / (2 * a);
        return {
          prompt: `A car moving at ${v} m/s brakes with a constant deceleration of ${a} m/s². What is its stopping distance?`,
          answer: s, unit: 'm', mistakes: [(v * v) / a, v / (2 * a), v / a],
          explanation: `v² = u² − 2·a·s with v = 0 ⇒ s = u² / (2a) = ${v}² / (2 × ${a}) = ${fmt(s)} m.`,
        };
      },
    ],

    forces: [
      function newtonSecond() {
        const m = rand(2, 50), a = rand(0.5, 10, 0.5);
        const F = m * a;
        return {
          prompt: `What net force is needed to accelerate a ${m} kg trolley at ${a} m/s²?`,
          answer: F, unit: 'N', mistakes: [m / a, a / m * 10, m + a],
          explanation: `Newton's 2nd law: F = m·a = ${m} × ${a} = ${fmt(F)} N.`,
        };
      },
      function accelerationFromForce() {
        const m = rand(2, 40), F = rand(10, 400, 10);
        const a = F / m;
        return {
          prompt: `A net force of ${F} N acts on a ${m} kg box. What is its acceleration?`,
          answer: a, unit: 'm/s²', mistakes: [F * m, m / F, F - m],
          explanation: `a = F / m = ${F} / ${m} = ${fmt(a)} m/s².`,
        };
      },
      function weight() {
        const m = rand(2, 120);
        const W = m * G;
        return {
          prompt: `What is the weight of a ${m} kg object on Earth? (g = 9.8 m/s²)`,
          answer: W, unit: 'N', mistakes: [m, m / G, m * G * 2],
          explanation: `Weight is a force: W = m·g = ${m} × 9.8 = ${fmt(W)} N. Mass (${m} kg) and weight are not the same thing!`,
        };
      },
      function friction() {
        const m = rand(5, 30), mu = pick([0.1, 0.2, 0.25, 0.3, 0.4]);
        const f = mu * m * G;
        const F = Math.ceil((f + rand(10, 80)) / 5) * 5;
        const a = (F - f) / m;
        return {
          prompt: `A ${m} kg crate is pushed across the floor with a ${F} N horizontal force. The coefficient of kinetic friction is ${mu}. What is its acceleration? (g = 9.8 m/s²)`,
          answer: a, unit: 'm/s²', mistakes: [F / m, (F + f) / m, mu * G],
          explanation: `Friction f = μ·m·g = ${mu} × ${m} × 9.8 = ${fmt(f)} N. Net force = ${F} − ${fmt(f)} = ${fmt(F - f)} N, so a = F_net / m = ${fmt(a)} m/s².`,
        };
      },
      function hooke() {
        const k = rand(50, 500, 10), x = rand(0.05, 0.5, 0.05);
        const F = k * x;
        return {
          prompt: `A spring with stiffness k = ${k} N/m is stretched by ${x} m. What force does it exert?`,
          answer: F, unit: 'N', mistakes: [k / x, k * x * x, 0.5 * k * x],
          explanation: `Hooke's law: F = k·x = ${k} × ${x} = ${fmt(F)} N.`,
        };
      },
    ],

    energy: [
      function kinetic() {
        const m = rand(1, 80), v = rand(2, 25);
        const KE = 0.5 * m * v * v;
        return {
          prompt: `What is the kinetic energy of a ${m} kg object moving at ${v} m/s?`,
          answer: KE, unit: 'J', mistakes: [m * v * v, 0.5 * m * v, m * v],
          explanation: `KE = ½·m·v² = ½ × ${m} × ${v}² = ${fmt(KE)} J. Speed is squared, so doubling v quadruples KE!`,
        };
      },
      function potential() {
        const m = rand(1, 60), h = rand(2, 50);
        const PE = m * G * h;
        return {
          prompt: `How much gravitational potential energy does a ${m} kg mass gain when lifted ${h} m? (g = 9.8 m/s²)`,
          answer: PE, unit: 'J', mistakes: [m * h, 0.5 * m * G * h, G * h],
          explanation: `PE = m·g·h = ${m} × 9.8 × ${h} = ${fmt(PE)} J.`,
        };
      },
      function speedAtBottom() {
        const h = rand(2, 60);
        const v = Math.sqrt(2 * G * h);
        return {
          prompt: `A ball slides down a frictionless ramp from a height of ${h} m, starting at rest. How fast is it going at the bottom? (g = 9.8 m/s²)`,
          answer: v, unit: 'm/s', mistakes: [Math.sqrt(G * h), 2 * G * h, Math.sqrt(2 * h)],
          explanation: `Energy conservation: m·g·h = ½·m·v² ⇒ v = √(2gh) = √(2 × 9.8 × ${h}) = ${fmt(v)} m/s. The mass cancels out!`,
        };
      },
      function power() {
        const W = rand(200, 6000, 100), t = rand(2, 60);
        const P = W / t;
        return {
          prompt: `A motor does ${W} J of work in ${t} s. What is its power output?`,
          answer: P, unit: 'W', mistakes: [W * t, t / W * 1000, W - t],
          explanation: `Power = work / time = ${W} / ${t} = ${fmt(P)} W.`,
        };
      },
      function workAtAngle() {
        const F = rand(10, 200, 10), d = rand(2, 30), th = pick([30, 45, 60]);
        const W = F * d * Math.cos((th * Math.PI) / 180);
        return {
          prompt: `A sled is pulled ${d} m by a rope with tension ${F} N at ${th}° above the horizontal. How much work does the rope do?`,
          answer: W, unit: 'J', mistakes: [F * d, F * d * Math.sin((th * Math.PI) / 180), F / d],
          explanation: `Only the component along the motion does work: W = F·d·cos θ = ${F} × ${d} × cos ${th}° = ${fmt(W)} J.`,
        };
      },
    ],

    momentum: [
      function momentum() {
        const m = rand(1, 90), v = rand(2, 30);
        const p = m * v;
        return {
          prompt: `What is the momentum of a ${m} kg object moving at ${v} m/s?`,
          answer: p, unit: 'kg·m/s', mistakes: [0.5 * m * v * v, m / v, m + v],
          explanation: `p = m·v = ${m} × ${v} = ${fmt(p)} kg·m/s.`,
        };
      },
      function inelastic() {
        const m1 = rand(500, 2000, 100), v1 = rand(5, 25), m2 = rand(500, 2000, 100);
        const v = (m1 * v1) / (m1 + m2);
        return {
          prompt: `A ${m1} kg car moving at ${v1} m/s crashes into a stationary ${m2} kg car and they stick together. How fast do they move just after the collision?`,
          answer: v, unit: 'm/s', mistakes: [v1 / 2, (m1 * v1) / m2, v1],
          explanation: `Momentum is conserved: m₁v₁ = (m₁ + m₂)·v ⇒ v = ${m1} × ${v1} / (${m1} + ${m2}) = ${fmt(v)} m/s.`,
        };
      },
      function impulse() {
        const m = rand(1, 20), F = rand(10, 200, 10), t = rand(0.1, 2, 0.1);
        const v = (F * t) / m;
        return {
          prompt: `A ${m} kg ball at rest is pushed by a constant ${F} N force for ${t} s. What speed does it reach?`,
          answer: v, unit: 'm/s', mistakes: [F * t, F / (m * t), (F * m) / t],
          explanation: `Impulse = change in momentum: F·Δt = m·v ⇒ v = F·Δt / m = ${F} × ${t} / ${m} = ${fmt(v)} m/s.`,
        };
      },
      function recoil() {
        const mb = rand(0.01, 0.05, 0.01), vb = rand(200, 800, 50), mg = rand(2, 6);
        const v = (mb * vb) / mg;
        return {
          prompt: `A ${mg} kg rifle fires a ${mb} kg bullet at ${vb} m/s. What is the rifle's recoil speed?`,
          answer: v, unit: 'm/s', mistakes: [vb / mg, mb * vb, (mg * vb) / 1000],
          explanation: `Total momentum starts at zero, so m_bullet·v_bullet = m_rifle·v_rifle ⇒ v = ${mb} × ${vb} / ${mg} = ${fmt(v)} m/s.`,
        };
      },
    ],

    waves: [
      function waveSpeed() {
        const f = rand(50, 1000, 10), lam = rand(0.2, 5, 0.1);
        const v = f * lam;
        return {
          prompt: `A wave has frequency ${f} Hz and wavelength ${lam} m. What is its speed?`,
          answer: v, unit: 'm/s', mistakes: [f / lam, lam / f * 1000, f + lam],
          explanation: `Wave equation: v = f·λ = ${f} × ${lam} = ${fmt(v)} m/s.`,
        };
      },
      function wavelength() {
        const f = rand(100, 2000, 50), v = 340;
        const lam = v / f;
        return {
          prompt: `Sound travels at 340 m/s in air. What is the wavelength of a ${f} Hz note?`,
          answer: lam, unit: 'm', mistakes: [v * f, f / v, v / f / 2],
          explanation: `λ = v / f = 340 / ${f} = ${fmt(lam)} m.`,
        };
      },
      function period() {
        const f = rand(2, 50);
        const T = 1 / f;
        return {
          prompt: `A pendulum-driven machine vibrates at ${f} Hz. What is the period of one vibration?`,
          answer: T, unit: 's', mistakes: [f, (2 * Math.PI) / f, 1 / (2 * f)],
          explanation: `Period is the inverse of frequency: T = 1/f = 1/${f} = ${fmt(T)} s.`,
        };
      },
      function echo() {
        const t = rand(0.5, 6, 0.5), v = 340;
        const d = (v * t) / 2;
        return {
          prompt: `You shout toward a cliff and hear the echo ${t} s later. How far away is the cliff? (speed of sound = 340 m/s)`,
          answer: d, unit: 'm', mistakes: [v * t, v / t, 2 * v * t],
          explanation: `The sound travels there AND back, so 2d = v·t ⇒ d = 340 × ${t} / 2 = ${fmt(d)} m.`,
        };
      },
    ],

    electricity: [
      function ohmVoltage() {
        const I = rand(0.5, 5, 0.5), R = rand(2, 100, 2);
        const V = I * R;
        return {
          prompt: `A current of ${I} A flows through a ${R} Ω resistor. What is the voltage across it?`,
          answer: V, unit: 'V', mistakes: [I / R, R / I, I + R],
          explanation: `Ohm's law: V = I·R = ${I} × ${R} = ${fmt(V)} V.`,
        };
      },
      function ohmCurrent() {
        const V = pick([1.5, 3, 4.5, 6, 9, 12, 24, 230]), R = rand(2, 200, 2);
        const I = V / R;
        return {
          prompt: `A ${V} V source is connected across a ${R} Ω resistor. What current flows?`,
          answer: I, unit: 'A', mistakes: [V * R, R / V, V / R / 2],
          explanation: `I = V / R = ${V} / ${R} = ${fmt(I)} A.`,
        };
      },
      function electricPower() {
        const V = pick([3, 6, 9, 12, 24, 120, 230]), I = rand(0.2, 10, 0.2);
        const P = V * I;
        return {
          prompt: `A device draws ${I} A from a ${V} V supply. What power does it use?`,
          answer: P, unit: 'W', mistakes: [V / I, I / V * 100, V * I * I],
          explanation: `P = V·I = ${V} × ${I} = ${fmt(P)} W.`,
        };
      },
      function series() {
        const rs = [rand(2, 50), rand(2, 50), rand(2, 50)];
        const R = rs[0] + rs[1] + rs[2];
        const par = 1 / (1 / rs[0] + 1 / rs[1] + 1 / rs[2]);
        return {
          prompt: `Resistors of ${rs[0]} Ω, ${rs[1]} Ω and ${rs[2]} Ω are connected in series. What is the total resistance?`,
          answer: R, unit: 'Ω', mistakes: [par, R / 3, Math.max(...rs)],
          explanation: `In series, resistances simply add: ${rs[0]} + ${rs[1]} + ${rs[2]} = ${R} Ω.`,
        };
      },
      function parallel() {
        const r1 = rand(2, 60, 2), r2 = rand(2, 60, 2);
        const R = (r1 * r2) / (r1 + r2);
        return {
          prompt: `Two resistors, ${r1} Ω and ${r2} Ω, are connected in parallel. What is the combined resistance?`,
          answer: R, unit: 'Ω', mistakes: [r1 + r2, (r1 + r2) / 2, 1 / (r1 + r2) * 100],
          explanation: `Parallel: 1/R = 1/${r1} + 1/${r2} ⇒ R = (${r1} × ${r2}) / (${r1} + ${r2}) = ${fmt(R)} Ω. It's always smaller than the smallest resistor!`,
        };
      },
    ],
  };

  // ---------- conceptual questions (first choice is correct) ----------
  const CONCEPTS = {
    kinematics: [
      { prompt: 'A ball is thrown straight up. At the very top of its flight, what is true?',
        choices: ['Velocity is zero, acceleration is 9.8 m/s² downward', 'Velocity and acceleration are both zero', 'Velocity is zero, acceleration is upward', 'Velocity is maximum'],
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
    ],
    forces: [
      ['F = m·a', "Newton's 2nd law"],
      ['W = m·g', 'weight (g = 9.8 m/s²)'],
      ['f = μ·N', 'friction force (N = normal force)'],
      ['F = k·x', "Hooke's law for springs"],
    ],
    energy: [
      ['KE = ½·m·v²', 'kinetic energy'],
      ['PE = m·g·h', 'gravitational potential energy'],
      ['W = F·d·cos θ', 'work done by a force'],
      ['P = W / t', 'power = work ÷ time'],
    ],
    momentum: [
      ['p = m·v', 'momentum'],
      ['F·Δt = Δp', 'impulse = change in momentum'],
      ['m₁u₁ + m₂u₂ = m₁v₁ + m₂v₂', 'conservation of momentum'],
    ],
    waves: [
      ['v = f·λ', 'wave speed'],
      ['T = 1 / f', 'period'],
      ['d = v·t / 2', 'echo distance'],
    ],
    electricity: [
      ['V = I·R', "Ohm's law"],
      ['P = V·I = I²R = V²/R', 'electrical power'],
      ['R = R₁ + R₂ + …', 'series resistors'],
      ['1/R = 1/R₁ + 1/R₂ + …', 'parallel resistors'],
      ['Q = I·t', 'charge'],
    ],
  };

  // ---------- public API ----------
  function generate(topicId) {
    const gens = GENERATORS[topicId];
    const concepts = CONCEPTS[topicId] || [];
    if (!gens) throw new Error('Unknown topic: ' + topicId);
    if (concepts.length && Math.random() < 0.3) return conceptual(topicId, pick(concepts));
    return numeric(topicId, pick(gens)());
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

  const api = { G, TOPICS, GENERATORS, CONCEPTS, FORMULAS, generate, pickWeightedTopic, fmt, numeric, conceptual };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PhysicsQuestions = api;
})(typeof window !== 'undefined' ? window : globalThis);

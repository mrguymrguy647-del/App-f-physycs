/*
 * Physics Quest — question engine.
 * Generates endless randomized numeric problems plus conceptual questions,
 * at four difficulty levels, in English and Arabic.
 * Works as a browser global (window.PhysicsQuestions) and as a Node module (for tests).
 */
(function (root) {
  'use strict';

  const G = 9.8; // m/s², the "real" value used from Medium upwards
  const SOUND = 340; // m/s
  const LIGHT = 3e8; // m/s

  // ---------- bidi helpers for Arabic text ----------
  // Formulas and "number unit" pairs are wrapped in first-strong isolates so they
  // keep their left-to-right order inside right-to-left sentences.
  const iso = (s) => '⁨' + s + '⁩';
  const nu = (value, unit) => iso(value + ' ' + unit);
  const L = (o, en, ar) => (o && o.ar ? ar : en);

  // ---------- difficulty levels ----------
  // tierWeights: how often generators of each tier appear (tier 1 = one step,
  // tier 2 = two steps / traps, tier 3 = multi-step challenge problems).
  const DIFFICULTIES = [
    { id: 'beginner', icon: '🌱',
      name: { en: 'Beginner', ar: 'مبتدئ' },
      blurb: { en: 'New to physics? One-step problems, friendly numbers (g = 10) and the formula is shown every time.',
        ar: `جديد في الفيزياء؟ مسائل من خطوة واحدة، وأرقام سهلة (${iso('g = 10')})، والقانون يظهر لك في كل سؤال.` },
      tierWeights: { 1: 1 }, g: 10, conceptRate: 0.4, timer: 0, lives: 0, typed: false, xpMult: 1, formula: 'always' },
    { id: 'medium', icon: '🔥',
      name: { en: 'Medium', ar: 'متوسط' },
      blurb: { en: 'Real values (g = 9.8), two-step problems and classic traps. Peek at the formula for half XP.',
        ar: `قيم حقيقية (${iso('g = 9.8')})، ومسائل من خطوتين وفخاخ شائعة. يمكنك إظهار القانون مقابل نصف النقاط.` },
      tierWeights: { 1: 1, 2: 1.5 }, g: G, conceptRate: 0.3, timer: 0, lives: 0, typed: false, xpMult: 1.5, formula: 'peek' },
    { id: 'hard', icon: '⚡',
      name: { en: 'Hard', ar: 'صعب' },
      blurb: { en: 'Multi-step problems against a 45-second clock. No hints. Answer fast for bonus XP.',
        ar: 'مسائل متعددة الخطوات مع مؤقت 45 ثانية وبلا تلميحات. أجب بسرعة لتحصل على نقاط إضافية.' },
      tierWeights: { 2: 1, 3: 1.5 }, g: G, conceptRate: 0.15, timer: 45, lives: 0, typed: false, xpMult: 2, formula: 'none' },
    { id: 'hardcore', icon: '💀',
      name: { en: 'Hardcore', ar: 'هاردكور' },
      blurb: { en: 'No multiple choice: type the number yourself (within 2%). 60 seconds each and only 3 lives.',
        ar: 'بلا خيارات: اكتب الرقم بنفسك (بدقة 2%). 60 ثانية لكل سؤال و3 أرواح فقط.' },
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
  const ORDINAL = {
    en: { 1: '1st (fundamental)', 2: '2nd', 3: '3rd' },
    ar: { 1: 'الأولى (الأساسية)', 2: 'الثانية', 3: 'الثالثة' },
  };

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

  // c: { prompt: {en, ar}, choices: {en: [...], ar: [...]}, explanation: {en, ar} }
  // The first listed choice is always the right one.
  function conceptual(topic, c, lang) {
    const pickLang = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x[lang] || x.en : x);
    const choices = pickLang(c.choices);
    const order = shuffle(choices.map((_, i) => i));
    return {
      topic,
      kind: 'concept',
      prompt: pickLang(c.prompt),
      choices: order.map((i) => choices[i]),
      correctIndex: order.indexOf(0),
      answerText: choices[0],
      explanation: pickLang(c.explanation),
    };
  }

  // ---------- topics ----------
  const TOPICS = [
    { id: 'kinematics', icon: '🏃', name: { en: 'Motion', ar: 'الحركة' },
      blurb: { en: 'Speed, velocity, acceleration, free fall', ar: 'السرعة والتسارع والسقوط الحر' } },
    { id: 'forces', icon: '🧲', name: { en: 'Forces', ar: 'القوى' },
      blurb: { en: "Newton's laws, weight, friction, springs", ar: 'قوانين نيوتن والوزن والاحتكاك والنوابض' } },
    { id: 'energy', icon: '⚡', name: { en: 'Energy', ar: 'الطاقة' },
      blurb: { en: 'Kinetic & potential energy, work, power', ar: 'الطاقة الحركية وطاقة الوضع والشغل والقدرة' } },
    { id: 'momentum', icon: '🎱', name: { en: 'Momentum', ar: 'الزخم' },
      blurb: { en: 'Momentum, collisions, impulse', ar: 'الزخم والتصادمات والدفع' } },
    { id: 'waves', icon: '🌊', name: { en: 'Waves', ar: 'الموجات' },
      blurb: { en: 'Frequency, wavelength, sound, light', ar: 'التردد والطول الموجي والصوت والضوء' } },
    { id: 'electricity', icon: '🔌', name: { en: 'Electricity', ar: 'الكهرباء' },
      blurb: { en: "Ohm's law, power, circuits", ar: 'قانون أوم والقدرة والدوائر' } },
  ];

  // ---------- numeric generators ----------
  // Each make(o) receives { g, easy, ar } and returns
  // { prompt, answer, unit, mistakes: [values from common errors], explanation }.
  const gen = (tier, formula, make) => ({ tier, formula, make });
  const gtext = (o) => iso(`g = ${o.g} m/s²`);

  const GENERATORS = {
    kinematics: [
      gen(1, 'v = d / t', function simpleSpeed(o) {
        const d = rand(100, 1000, 50), t = rand(10, 200, 10);
        const v = d / t;
        return {
          prompt: L(o, `A runner covers ${d} m in ${t} s. What is their average speed?`,
            `يقطع عدّاء مسافة ${nu(d, 'm')} في ${nu(t, 's')}. ما متوسط سرعته؟`),
          answer: v, unit: 'm/s', mistakes: [d * t, t / d, d - t],
          explanation: L(o, `Speed = distance ÷ time = ${d} / ${t} = ${fmt(v)} m/s.`,
            `السرعة = المسافة ÷ الزمن: ${iso(`v = ${d} / ${t} = ${fmt(v)} m/s`)}.`),
        };
      }),
      gen(1, 'd = v·t', function constantVelocity(o) {
        const v = rand(3, 30), t = rand(2, 20);
        const d = v * t;
        return {
          prompt: L(o, `A cyclist moves at a constant ${v} m/s for ${t} s. How far do they travel?`,
            `يتحرك دراج بسرعة ثابتة ${nu(v, 'm/s')} لمدة ${nu(t, 's')}. ما المسافة التي يقطعها؟`),
          answer: d, unit: 'm', mistakes: [v / t, v + t, t / v * 10],
          explanation: L(o, `Constant velocity: d = v·t = ${v} × ${t} = ${fmt(d)} m.`,
            `عند السرعة الثابتة: ${iso(`d = v·t = ${v} × ${t} = ${fmt(d)} m`)}.`),
        };
      }),
      gen(1, 'v = u + a·t', function finalSpeed(o) {
        const a = rand(1, 6, o.easy ? 1 : 0.5), t = rand(2, 10);
        const v = a * t;
        return {
          prompt: L(o, `A car starts from rest and accelerates at ${a} m/s² for ${t} s. What is its final speed?`,
            `تبدأ سيارة من السكون وتتسارع بمعدل ${nu(a, 'm/s²')} لمدة ${nu(t, 's')}. ما سرعتها النهائية؟`),
          answer: v, unit: 'm/s', mistakes: [0.5 * a * t, a * t * t, a / t],
          explanation: L(o, `From rest: v = u + a·t = 0 + ${a} × ${t} = ${fmt(v)} m/s.`,
            `تبدأ من السكون (${iso('u = 0')}): ${iso(`v = u + a·t = 0 + ${a} × ${t} = ${fmt(v)} m/s`)}.`),
        };
      }),
      gen(2, 's = u·t + ½·a·t²', function distanceFromRest(o) {
        const a = rand(1, 6, 0.5), t = rand(2, 10);
        const s = 0.5 * a * t * t;
        return {
          prompt: L(o, `An object starts from rest with acceleration ${a} m/s². How far does it go in ${t} s?`,
            `يبدأ جسم من السكون بتسارع ${nu(a, 'm/s²')}. ما المسافة التي يقطعها خلال ${nu(t, 's')}؟`),
          answer: s, unit: 'm', mistakes: [a * t * t, a * t, 0.5 * a * t],
          explanation: L(o, `s = u·t + ½·a·t² = 0 + ½ × ${a} × ${t}² = ${fmt(s)} m. Don't forget the ½ and the square!`,
            `${iso(`s = u·t + ½·a·t² = 0 + ½ × ${a} × ${t}² = ${fmt(s)} m`)}. لا تنسَ النصف والتربيع!`),
        };
      }),
      gen(2, 'h = ½·g·t²', function freeFallTime(o) {
        const h = pick([5, 10, 20, 30, 45, 60, 80, 100, 125]);
        const t = Math.sqrt((2 * h) / o.g);
        return {
          prompt: L(o, `A stone is dropped from a height of ${h} m. How long does it take to hit the ground? (ignore air resistance, g = ${o.g} m/s²)`,
            `سقط حجر من ارتفاع ${nu(h, 'm')}. كم يستغرق ليصل إلى الأرض؟ (أهمل مقاومة الهواء، ${gtext(o)})`),
          answer: t, unit: 's', mistakes: [Math.sqrt(h / o.g), (2 * h) / o.g, h / o.g],
          explanation: L(o, `h = ½·g·t² ⇒ t = √(2h/g) = √(2 × ${h} / ${o.g}) = ${fmt(t)} s.`,
            `${iso('h = ½·g·t²')}، إذن ${iso(`t = √(2h/g) = √(2 × ${h} / ${o.g}) = ${fmt(t)} s`)}.`),
        };
      }),
      gen(2, 'v_avg = (d₁ + d₂) / (t₁ + t₂)', function averageSpeed(o) {
        const d1 = rand(20, 120, 10), t1 = rand(1, 3), d2 = rand(20, 120, 10), t2 = rand(1, 4);
        const avg = (d1 + d2) / (t1 + t2);
        const wrong = (d1 / t1 + d2 / t2) / 2;
        return {
          prompt: L(o, `A bus travels ${d1} km in ${t1} h, then ${d2} km in ${t2} h. What is its average speed for the whole trip?`,
            `تقطع حافلة ${nu(d1, 'km')} في ${nu(t1, 'h')}، ثم ${nu(d2, 'km')} في ${nu(t2, 'h')}. ما متوسط سرعتها للرحلة كلها؟`),
          answer: avg, unit: 'km/h', mistakes: [wrong, (d1 + d2) / Math.max(t1, t2), d1 / t1 + d2 / t2],
          explanation: L(o, `Average speed = total distance / total time = (${d1} + ${d2}) / (${t1} + ${t2}) = ${fmt(avg)} km/h. Averaging the two speeds (${fmt(wrong)}) is a classic trap!`,
            `متوسط السرعة = المسافة الكلية ÷ الزمن الكلي = ${iso(`(${d1} + ${d2}) / (${t1} + ${t2}) = ${fmt(avg)} km/h`)}. حساب متوسط السرعتين (${iso(fmt(wrong))}) فخ شائع!`),
        };
      }),
      gen(2, 'v² = u² + 2·a·s', function stoppingDistance(o) {
        const v = rand(10, 30, 2), a = rand(2, 8);
        const s = (v * v) / (2 * a);
        return {
          prompt: L(o, `A car moving at ${v} m/s brakes with a constant deceleration of ${a} m/s². What is its stopping distance?`,
            `سيارة تسير بسرعة ${nu(v, 'm/s')} تضغط على المكابح فتتباطأ بمعدل ثابت ${nu(a, 'm/s²')}. ما مسافة التوقف؟`),
          answer: s, unit: 'm', mistakes: [(v * v) / a, v / (2 * a), v / a],
          explanation: L(o, `v² = u² − 2·a·s with v = 0 ⇒ s = u² / (2a) = ${v}² / (2 × ${a}) = ${fmt(s)} m.`,
            `${iso('v² = u² − 2·a·s')} مع ${iso('v = 0')}، إذن ${iso(`s = u² / (2a) = ${v}² / (2 × ${a}) = ${fmt(s)} m`)}.`),
        };
      }),
      gen(3, 'R = v²·sin(2θ) / g', function projectileRange(o) {
        const v = rand(10, 40), th = pick([15, 20, 30, 40, 50, 60, 70, 75]);
        const R = (v * v * Math.sin(rad(2 * th))) / o.g;
        return {
          prompt: L(o, `A ball is launched from flat ground at ${v} m/s, ${th}° above the horizontal. How far away does it land? (g = ${o.g} m/s², no air resistance)`,
            `تُقذف كرة من أرض مستوية بسرعة ${nu(v, 'm/s')} بزاوية ${iso(th + '°')} فوق الأفقي. على أي بُعد تسقط؟ (${gtext(o)}، بلا مقاومة هواء)`),
          answer: R, unit: 'm',
          mistakes: [(v * v * Math.sin(rad(th))) / o.g, (v * v * Math.sin(rad(2 * th))) / (2 * o.g), (v * v) / o.g, v * Math.cos(rad(th)) * (v * Math.sin(rad(th))) / o.g],
          explanation: L(o, `Flight time t = 2v·sinθ/g, horizontal speed v·cosθ, so R = v²·sin(2θ)/g = ${v}² × sin ${2 * th}° / ${o.g} = ${fmt(R)} m.`,
            `زمن التحليق ${iso('t = 2v·sinθ/g')} والسرعة الأفقية ${iso('v·cosθ')}، إذن ${iso(`R = v²·sin(2θ)/g = ${v}² × sin ${2 * th}° / ${o.g} = ${fmt(R)} m`)}.`),
        };
      }),
      gen(3, 'v² = u² − 2·g·h', function upwardThrow(o) {
        const v = rand(5, 40);
        const H = (v * v) / (2 * o.g);
        return {
          prompt: L(o, `A ball is thrown straight up at ${v} m/s. How high does it rise above the launch point? (g = ${o.g} m/s²)`,
            `قُذفت كرة رأسيًا إلى أعلى بسرعة ${nu(v, 'm/s')}. ما أقصى ارتفاع تبلغه فوق نقطة القذف؟ (${gtext(o)})`),
          answer: H, unit: 'm', mistakes: [(v * v) / o.g, v / o.g, (v * v) / (4 * o.g)],
          explanation: L(o, `At the top v = 0, so 0 = u² − 2·g·h ⇒ h = u²/(2g) = ${v}² / (2 × ${o.g}) = ${fmt(H)} m.`,
            `عند القمة تصبح السرعة صفرًا: ${iso('0 = u² − 2·g·h')}، إذن ${iso(`h = u²/(2g) = ${v}² / (2 × ${o.g}) = ${fmt(H)} m`)}.`),
        };
      }),
      gen(3, 'x = v·t,  h = ½·g·t²', function cliffThrow(o) {
        const h = pick([5, 10, 20, 45, 80]), v = rand(3, 25);
        const t = Math.sqrt((2 * h) / o.g);
        const x = v * t;
        return {
          prompt: L(o, `A ball is kicked horizontally at ${v} m/s off a cliff ${h} m high. How far from the base of the cliff does it land? (g = ${o.g} m/s²)`,
            `رُكلت كرة أفقيًا بسرعة ${nu(v, 'm/s')} من فوق جرف ارتفاعه ${nu(h, 'm')}. على أي بُعد من قاعدة الجرف تسقط؟ (${gtext(o)})`),
          answer: x, unit: 'm', mistakes: [v * Math.sqrt(h / o.g), (v * 2 * h) / o.g, 2 * x, t],
          explanation: L(o, `Fall time only depends on height: t = √(2h/g) = ${fmt(t)} s. Horizontally it keeps ${v} m/s: x = v·t = ${fmt(x)} m.`,
            `زمن السقوط يعتمد على الارتفاع فقط: ${iso(`t = √(2h/g) = ${fmt(t)} s`)}. أفقيًا تحافظ على ${nu(v, 'm/s')}: ${iso(`x = v·t = ${fmt(x)} m`)}.`),
        };
      }),
    ],

    forces: [
      gen(1, 'F = m·a', function newtonSecond(o) {
        const m = rand(2, 50), a = rand(0.5, 10, o.easy ? 1 : 0.5);
        const F = m * a;
        return {
          prompt: L(o, `What net force is needed to accelerate a ${m} kg trolley at ${a} m/s²?`,
            `ما القوة المحصلة اللازمة لإكساب عربة كتلتها ${nu(m, 'kg')} تسارعًا مقداره ${nu(a, 'm/s²')}؟`),
          answer: F, unit: 'N', mistakes: [m / a, a / m * 10, m + a],
          explanation: L(o, `Newton's 2nd law: F = m·a = ${m} × ${a} = ${fmt(F)} N.`,
            `قانون نيوتن الثاني: ${iso(`F = m·a = ${m} × ${a} = ${fmt(F)} N`)}.`),
        };
      }),
      gen(1, 'a = F / m', function accelerationFromForce(o) {
        const m = rand(2, 40), F = rand(10, 400, 10);
        const a = F / m;
        return {
          prompt: L(o, `A net force of ${F} N acts on a ${m} kg box. What is its acceleration?`,
            `تؤثر قوة محصلة ${nu(F, 'N')} في صندوق كتلته ${nu(m, 'kg')}. ما تسارعه؟`),
          answer: a, unit: 'm/s²', mistakes: [F * m, m / F, F - m],
          explanation: L(o, `a = F / m = ${F} / ${m} = ${fmt(a)} m/s².`,
            `${iso(`a = F / m = ${F} / ${m} = ${fmt(a)} m/s²`)}.`),
        };
      }),
      gen(1, 'W = m·g', function weight(o) {
        const m = rand(2, 120);
        const W = m * o.g;
        return {
          prompt: L(o, `What is the weight of a ${m} kg object on Earth? (g = ${o.g} m/s²)`,
            `ما وزن جسم كتلته ${nu(m, 'kg')} على الأرض؟ (${gtext(o)})`),
          answer: W, unit: 'N', mistakes: [m, m / o.g, m * o.g * 2],
          explanation: L(o, `Weight is a force: W = m·g = ${m} × ${o.g} = ${fmt(W)} N. Mass (${m} kg) and weight are not the same thing!`,
            `الوزن قوة: ${iso(`W = m·g = ${m} × ${o.g} = ${fmt(W)} N`)}. الكتلة (${nu(m, 'kg')}) والوزن ليسا الشيء نفسه!`),
        };
      }),
      gen(1, 'F = k·x', function hooke(o) {
        const k = rand(50, 500, 10), x = rand(0.05, 0.5, 0.05);
        const F = k * x;
        return {
          prompt: L(o, `A spring with stiffness k = ${k} N/m is stretched by ${x} m. What force does it exert?`,
            `نابض ثابته ${iso(`k = ${k} N/m`)} استطال بمقدار ${nu(x, 'm')}. ما القوة التي يؤثر بها؟`),
          answer: F, unit: 'N', mistakes: [k / x, k * x * x, 0.5 * k * x],
          explanation: L(o, `Hooke's law: F = k·x = ${k} × ${x} = ${fmt(F)} N.`,
            `قانون هوك: ${iso(`F = k·x = ${k} × ${x} = ${fmt(F)} N`)}.`),
        };
      }),
      gen(2, 'F_net = m·a', function netForce(o) {
        const m = rand(2, 30), F1 = rand(20, 200, 10), F2 = rand(10, F1 - 10, 10);
        const a = (F1 - F2) / m;
        return {
          prompt: L(o, `A ${m} kg sled is pulled forward with ${F1} N while a ${F2} N force pulls it backward. What is its acceleration?`,
            `تُسحب مزلجة كتلتها ${nu(m, 'kg')} إلى الأمام بقوة ${nu(F1, 'N')} بينما تسحبها قوة ${nu(F2, 'N')} إلى الخلف. ما تسارعها؟`),
          answer: a, unit: 'm/s²', mistakes: [(F1 + F2) / m, F1 / m, (F1 - F2) * m],
          explanation: L(o, `Forces in opposite directions subtract: F_net = ${F1} − ${F2} = ${F1 - F2} N, so a = F_net / m = ${fmt(a)} m/s².`,
            `القوتان متعاكستان فتُطرحان: ${iso(`F_net = ${F1} − ${F2} = ${F1 - F2} N`)}، إذن ${iso(`a = F_net / m = ${fmt(a)} m/s²`)}.`),
        };
      }),
      gen(2, 'f = μ·m·g', function friction(o) {
        const m = rand(5, 30), mu = pick([0.1, 0.2, 0.25, 0.3, 0.4]);
        const f = mu * m * o.g;
        const F = Math.ceil((f + rand(10, 80)) / 5) * 5;
        const a = (F - f) / m;
        return {
          prompt: L(o, `A ${m} kg crate is pushed across the floor with a ${F} N horizontal force. The coefficient of kinetic friction is ${mu}. What is its acceleration? (g = ${o.g} m/s²)`,
            `يُدفع صندوق كتلته ${nu(m, 'kg')} على الأرض بقوة أفقية ${nu(F, 'N')}. معامل الاحتكاك الحركي ${iso(mu)}. ما تسارعه؟ (${gtext(o)})`),
          answer: a, unit: 'm/s²', mistakes: [F / m, (F + f) / m, mu * o.g],
          explanation: L(o, `Friction f = μ·m·g = ${mu} × ${m} × ${o.g} = ${fmt(f)} N. Net force = ${F} − ${fmt(f)} = ${fmt(F - f)} N, so a = F_net / m = ${fmt(a)} m/s².`,
            `الاحتكاك ${iso(`f = μ·m·g = ${mu} × ${m} × ${o.g} = ${fmt(f)} N`)}. القوة المحصلة ${iso(`= ${F} − ${fmt(f)} = ${fmt(F - f)} N`)}، إذن ${iso(`a = F_net / m = ${fmt(a)} m/s²`)}.`),
        };
      }),
      gen(3, 'a = g·(sin θ − μ·cos θ)', function incline(o) {
        const th = pick([20, 25, 30, 35, 40]), mu = pick([0.1, 0.15, 0.2, 0.25, 0.3]);
        const a = o.g * (Math.sin(rad(th)) - mu * Math.cos(rad(th)));
        return {
          prompt: L(o, `A block slides down a ${th}° slope. The coefficient of kinetic friction is ${mu}. What is its acceleration? (g = ${o.g} m/s²)`,
            `ينزلق مكعب على منحدر زاويته ${iso(th + '°')}. معامل الاحتكاك الحركي ${iso(mu)}. ما تسارعه؟ (${gtext(o)})`),
          answer: a, unit: 'm/s²',
          mistakes: [o.g * Math.sin(rad(th)), o.g * (Math.sin(rad(th)) + mu * Math.cos(rad(th))), o.g * (Math.cos(rad(th)) - mu * Math.sin(rad(th)))],
          explanation: L(o, `Along the slope: gravity component m·g·sinθ, friction μ·m·g·cosθ (the normal force is m·g·cosθ). a = g(sinθ − μcosθ) = ${o.g} × (sin ${th}° − ${mu} × cos ${th}°) = ${fmt(a)} m/s².`,
            `على امتداد المنحدر: مركبة الجاذبية ${iso('m·g·sinθ')} والاحتكاك ${iso('μ·m·g·cosθ')} (القوة العمودية ${iso('m·g·cosθ')}). ${iso(`a = g(sinθ − μcosθ) = ${o.g} × (sin ${th}° − ${mu} × cos ${th}°) = ${fmt(a)} m/s²`)}.`),
        };
      }),
      gen(3, 'N − m·g = m·a', function elevator(o) {
        const m = rand(40, 100, 5), a = rand(0.5, 3, 0.5), up = Math.random() < 0.5;
        const N = m * (o.g + (up ? a : -a));
        const sign = up ? '+' : '−';
        return {
          prompt: L(o, `A ${m} kg person stands on bathroom scales in a lift that is accelerating ${up ? 'upward' : 'downward'} at ${a} m/s². What force do the scales read? (g = ${o.g} m/s²)`,
            `يقف شخص كتلته ${nu(m, 'kg')} على ميزان داخل مصعد يتسارع ${up ? 'إلى أعلى' : 'إلى أسفل'} بمعدل ${nu(a, 'm/s²')}. ما قراءة الميزان؟ (${gtext(o)})`),
          answer: N, unit: 'N', mistakes: [m * o.g, m * (o.g + (up ? -a : a)), m * a],
          explanation: L(o, `Net force = m·a: N − m·g = m·(${sign}${a}) ⇒ N = m(g ${sign} a) = ${m} × (${o.g} ${sign} ${a}) = ${fmt(N)} N. You feel ${up ? 'heavier' : 'lighter'}!`,
            `القوة المحصلة = ${iso('m·a')}: ${iso(`N − m·g = m·(${sign}${a})`)}، إذن ${iso(`N = m(g ${sign} a) = ${m} × (${o.g} ${sign} ${a}) = ${fmt(N)} N`)}. ستشعر أنك ${up ? 'أثقل' : 'أخف'}!`),
        };
      }),
      gen(3, 'F_net = (m₁ + m₂)·a', function pulley(o) {
        const m1 = rand(1, 10), m2 = rand(1, 20);
        const a = (m1 * o.g) / (m1 + m2);
        return {
          prompt: L(o, `A ${m2} kg block on a frictionless table is tied by a string over a pulley to a ${m1} kg mass hanging over the edge. What is the acceleration of the blocks? (g = ${o.g} m/s²)`,
            `مكعب كتلته ${nu(m2, 'kg')} على طاولة ملساء مربوط بخيط يمر فوق بكرة بكتلة ${nu(m1, 'kg')} معلّقة عند حافة الطاولة. ما تسارع الجسمين؟ (${gtext(o)})`),
          answer: a, unit: 'm/s²', mistakes: [o.g, (m1 * o.g) / m2, (m2 * o.g) / (m1 + m2)],
          explanation: L(o, `Only the hanging weight m₁g drives the motion, but it has to accelerate both masses: a = m₁g / (m₁ + m₂) = ${m1} × ${o.g} / ${m1 + m2} = ${fmt(a)} m/s².`,
            `وزن الكتلة المعلّقة ${iso('m₁g')} وحده يحرّك النظام، لكنه يجب أن يسرّع الكتلتين معًا: ${iso(`a = m₁g / (m₁ + m₂) = ${m1} × ${o.g} / ${m1 + m2} = ${fmt(a)} m/s²`)}.`),
        };
      }),
    ],

    energy: [
      gen(1, 'KE = ½·m·v²', function kinetic(o) {
        const m = rand(1, 80), v = rand(2, 25);
        const KE = 0.5 * m * v * v;
        return {
          prompt: L(o, `What is the kinetic energy of a ${m} kg object moving at ${v} m/s?`,
            `ما الطاقة الحركية لجسم كتلته ${nu(m, 'kg')} يتحرك بسرعة ${nu(v, 'm/s')}؟`),
          answer: KE, unit: 'J', mistakes: [m * v * v, 0.5 * m * v, m * v],
          explanation: L(o, `KE = ½·m·v² = ½ × ${m} × ${v}² = ${fmt(KE)} J. Speed is squared, so doubling v quadruples KE!`,
            `${iso(`KE = ½·m·v² = ½ × ${m} × ${v}² = ${fmt(KE)} J`)}. السرعة مربّعة، لذا مضاعفة السرعة تضاعف الطاقة الحركية أربع مرات!`),
        };
      }),
      gen(1, 'PE = m·g·h', function potential(o) {
        const m = rand(1, 60), h = rand(2, 50);
        const PE = m * o.g * h;
        return {
          prompt: L(o, `How much gravitational potential energy does a ${m} kg mass gain when lifted ${h} m? (g = ${o.g} m/s²)`,
            `ما مقدار طاقة الوضع الجاذبية التي تكتسبها كتلة ${nu(m, 'kg')} عند رفعها ${nu(h, 'm')}؟ (${gtext(o)})`),
          answer: PE, unit: 'J', mistakes: [m * h, 0.5 * m * o.g * h, o.g * h],
          explanation: L(o, `PE = m·g·h = ${m} × ${o.g} × ${h} = ${fmt(PE)} J.`,
            `${iso(`PE = m·g·h = ${m} × ${o.g} × ${h} = ${fmt(PE)} J`)}.`),
        };
      }),
      gen(1, 'P = W / t', function power(o) {
        const W = rand(200, 6000, 100), t = rand(2, 60);
        const P = W / t;
        return {
          prompt: L(o, `A motor does ${W} J of work in ${t} s. What is its power output?`,
            `يبذل محرك شغلًا مقداره ${nu(W, 'J')} خلال ${nu(t, 's')}. ما قدرته؟`),
          answer: P, unit: 'W', mistakes: [W * t, t / W * 1000, W - t],
          explanation: L(o, `Power = work / time = ${W} / ${t} = ${fmt(P)} W.`,
            `القدرة = الشغل ÷ الزمن = ${iso(`${W} / ${t} = ${fmt(P)} W`)}.`),
        };
      }),
      gen(2, 'm·g·h = ½·m·v²', function speedAtBottom(o) {
        const h = rand(2, 60);
        const v = Math.sqrt(2 * o.g * h);
        return {
          prompt: L(o, `A ball slides down a frictionless ramp from a height of ${h} m, starting at rest. How fast is it going at the bottom? (g = ${o.g} m/s²)`,
            `تنزلق كرة من السكون على منحدر أملس من ارتفاع ${nu(h, 'm')}. ما سرعتها عند أسفل المنحدر؟ (${gtext(o)})`),
          answer: v, unit: 'm/s', mistakes: [Math.sqrt(o.g * h), 2 * o.g * h, Math.sqrt(2 * h)],
          explanation: L(o, `Energy conservation: m·g·h = ½·m·v² ⇒ v = √(2gh) = √(2 × ${o.g} × ${h}) = ${fmt(v)} m/s. The mass cancels out!`,
            `حفظ الطاقة: ${iso('m·g·h = ½·m·v²')}، إذن ${iso(`v = √(2gh) = √(2 × ${o.g} × ${h}) = ${fmt(v)} m/s`)}. الكتلة تُختصر!`),
        };
      }),
      gen(2, 'W = F·d·cos θ', function workAtAngle(o) {
        const F = rand(10, 200, 10), d = rand(2, 30), th = pick([30, 45, 60]);
        const W = F * d * Math.cos(rad(th));
        return {
          prompt: L(o, `A sled is pulled ${d} m by a rope with tension ${F} N at ${th}° above the horizontal. How much work does the rope do?`,
            `تُسحب مزلجة مسافة ${nu(d, 'm')} بحبل قوة شدّه ${nu(F, 'N')} يميل بزاوية ${iso(th + '°')} فوق الأفقي. ما الشغل الذي يبذله الحبل؟`),
          answer: W, unit: 'J', mistakes: [F * d, F * d * Math.sin(rad(th)), F / d],
          explanation: L(o, `Only the component along the motion does work: W = F·d·cos θ = ${F} × ${d} × cos ${th}° = ${fmt(W)} J.`,
            `المركبة الموازية للحركة فقط تبذل شغلًا: ${iso(`W = F·d·cos θ = ${F} × ${d} × cos ${th}° = ${fmt(W)} J`)}.`),
        };
      }),
      gen(3, '½·k·x² = ½·m·v²', function springLaunch(o) {
        const k = rand(100, 1000, 50), x = rand(0.05, 0.3, 0.05), m = rand(0.1, 2, 0.1);
        const v = x * Math.sqrt(k / m);
        return {
          prompt: L(o, `A spring (k = ${k} N/m) is compressed by ${x} m and launches a ${m} kg ball across a frictionless floor. How fast does the ball leave the spring?`,
            `ضُغط نابض ثابته ${iso(`k = ${k} N/m`)} بمقدار ${nu(x, 'm')} ثم أطلق كرة كتلتها ${nu(m, 'kg')} على أرض ملساء. ما سرعة الكرة لحظة مغادرتها النابض؟`),
          answer: v, unit: 'm/s', mistakes: [(k * x) / m, x * Math.sqrt(k / (2 * m)), (0.5 * k * x * x) / m],
          explanation: L(o, `Spring energy becomes kinetic energy: ½kx² = ½mv² ⇒ v = x·√(k/m) = ${x} × √(${k}/${m}) = ${fmt(v)} m/s.`,
            `طاقة النابض تتحول إلى طاقة حركية: ${iso('½kx² = ½mv²')}، إذن ${iso(`v = x·√(k/m) = ${x} × √(${k}/${m}) = ${fmt(v)} m/s`)}.`),
        };
      }),
      gen(3, 'm·g·h = ½·m·v² + E_lost', function frictionRamp(o) {
        const m = rand(2, 20), h = rand(3, 20);
        const mgh = m * o.g * h;
        const lost = Math.round(mgh * rand(0.1, 0.5, 0.05));
        const v = Math.sqrt((2 * (mgh - lost)) / m);
        return {
          prompt: L(o, `A ${m} kg sledge slides from rest down a hill ${h} m high. Friction turns ${lost} J into heat on the way down. How fast is it going at the bottom? (g = ${o.g} m/s²)`,
            `تنزلق زلّاجة كتلتها ${nu(m, 'kg')} من السكون أسفل تل ارتفاعه ${nu(h, 'm')}. يحوّل الاحتكاك ${nu(lost, 'J')} إلى حرارة أثناء النزول. ما سرعتها عند أسفل التل؟ (${gtext(o)})`),
          answer: v, unit: 'm/s', mistakes: [Math.sqrt(2 * o.g * h), Math.sqrt((2 * (mgh + lost)) / m), Math.sqrt((mgh - lost) / m)],
          explanation: L(o, `Start: PE = m·g·h = ${fmt(mgh)} J. Minus ${lost} J lost leaves KE = ${fmt(mgh - lost)} J. v = √(2·KE/m) = √(2 × ${fmt(mgh - lost)} / ${m}) = ${fmt(v)} m/s.`,
            `في البداية: ${iso(`PE = m·g·h = ${fmt(mgh)} J`)}. بعد طرح ${nu(lost, 'J')} المفقودة تبقى ${iso(`KE = ${fmt(mgh - lost)} J`)}. ${iso(`v = √(2·KE/m) = √(2 × ${fmt(mgh - lost)} / ${m}) = ${fmt(v)} m/s`)}.`),
        };
      }),
      gen(3, 'η = E_out / E_in × 100%', function efficiency(o) {
        const m = rand(20, 200, 10), h = rand(2, 20), t = rand(5, 60, 5);
        const useful = m * o.g * h;
        const P = Math.max(1, Math.round(useful / (t * rand(0.4, 0.9, 0.05))));
        const eff = (useful / (P * t)) * 100;
        return {
          prompt: L(o, `A motor with an input power of ${P} W lifts a ${m} kg load ${h} m in ${t} s. What is its efficiency? (g = ${o.g} m/s²)`,
            `محرك قدرته الداخلة ${nu(P, 'W')} يرفع حمولة كتلتها ${nu(m, 'kg')} مسافة ${nu(h, 'm')} خلال ${nu(t, 's')}. ما كفاءته؟ (${gtext(o)})`),
          answer: eff, unit: '%', mistakes: [((P * t) / useful) * 100, (useful / P) * 100, 100 - eff],
          explanation: L(o, `Useful energy = m·g·h = ${fmt(useful)} J. Energy in = P·t = ${P} × ${t} = ${P * t} J. Efficiency = ${fmt(useful)} / ${P * t} = ${fmt(eff)} %.`,
            `الطاقة المفيدة ${iso(`= m·g·h = ${fmt(useful)} J`)}. الطاقة الداخلة ${iso(`= P·t = ${P} × ${t} = ${P * t} J`)}. الكفاءة ${iso(`= ${fmt(useful)} / ${P * t} = ${fmt(eff)} %`)}.`),
        };
      }),
    ],

    momentum: [
      gen(1, 'p = m·v', function momentum(o) {
        const m = rand(1, 90), v = rand(2, 30);
        const p = m * v;
        return {
          prompt: L(o, `What is the momentum of a ${m} kg object moving at ${v} m/s?`,
            `ما زخم (كمية حركة) جسم كتلته ${nu(m, 'kg')} يتحرك بسرعة ${nu(v, 'm/s')}؟`),
          answer: p, unit: 'kg·m/s', mistakes: [0.5 * m * v * v, m / v, m + v],
          explanation: L(o, `p = m·v = ${m} × ${v} = ${fmt(p)} kg·m/s.`,
            `${iso(`p = m·v = ${m} × ${v} = ${fmt(p)} kg·m/s`)}.`),
        };
      }),
      gen(1, 'Δp = m·(v − u)', function changeInMomentum(o) {
        const m = rand(1, 20), u = rand(1, 10), v = rand(u + 2, 30);
        const dp = m * (v - u);
        return {
          prompt: L(o, `A ${m} kg cart speeds up from ${u} m/s to ${v} m/s. What is its change in momentum?`,
            `تزداد سرعة عربة كتلتها ${nu(m, 'kg')} من ${nu(u, 'm/s')} إلى ${nu(v, 'm/s')}. ما التغير في زخمها؟`),
          answer: dp, unit: 'kg·m/s', mistakes: [m * (v + u), m * v, (v - u) / m],
          explanation: L(o, `Δp = m·v − m·u = ${m} × (${v} − ${u}) = ${fmt(dp)} kg·m/s.`,
            `${iso(`Δp = m·v − m·u = ${m} × (${v} − ${u}) = ${fmt(dp)} kg·m/s`)}.`),
        };
      }),
      gen(2, 'F·Δt = m·Δv', function impulse(o) {
        const m = rand(1, 20), F = rand(10, 200, 10), t = rand(0.1, 2, 0.1);
        const v = (F * t) / m;
        return {
          prompt: L(o, `A ${m} kg ball at rest is pushed by a constant ${F} N force for ${t} s. What speed does it reach?`,
            `كرة ساكنة كتلتها ${nu(m, 'kg')} تُدفع بقوة ثابتة ${nu(F, 'N')} لمدة ${nu(t, 's')}. ما السرعة التي تبلغها؟`),
          answer: v, unit: 'm/s', mistakes: [F * t, F / (m * t), (F * m) / t],
          explanation: L(o, `Impulse = change in momentum: F·Δt = m·v ⇒ v = F·Δt / m = ${F} × ${t} / ${m} = ${fmt(v)} m/s.`,
            `الدفع = التغير في الزخم: ${iso('F·Δt = m·v')}، إذن ${iso(`v = F·Δt / m = ${F} × ${t} / ${m} = ${fmt(v)} m/s`)}.`),
        };
      }),
      gen(2, 'm₁·v₁ = (m₁ + m₂)·v', function inelastic(o) {
        const m1 = rand(500, 2000, 100), v1 = rand(5, 25), m2 = rand(500, 2000, 100);
        const v = (m1 * v1) / (m1 + m2);
        return {
          prompt: L(o, `A ${m1} kg car moving at ${v1} m/s crashes into a stationary ${m2} kg car and they stick together. How fast do they move just after the collision?`,
            `سيارة كتلتها ${nu(m1, 'kg')} تسير بسرعة ${nu(v1, 'm/s')} تصطدم بسيارة ساكنة كتلتها ${nu(m2, 'kg')} فتلتحمان معًا. ما سرعتهما بعد التصادم مباشرة؟`),
          answer: v, unit: 'm/s', mistakes: [v1 / 2, (m1 * v1) / m2, v1],
          explanation: L(o, `Momentum is conserved: m₁v₁ = (m₁ + m₂)·v ⇒ v = ${m1} × ${v1} / (${m1} + ${m2}) = ${fmt(v)} m/s.`,
            `الزخم محفوظ: ${iso('m₁v₁ = (m₁ + m₂)·v')}، إذن ${iso(`v = ${m1} × ${v1} / (${m1} + ${m2}) = ${fmt(v)} m/s`)}.`),
        };
      }),
      gen(2, '0 = m₁·v₁ − m₂·v₂', function recoil(o) {
        const mb = rand(0.01, 0.05, 0.01), vb = rand(200, 800, 50), mg = rand(2, 6);
        const v = (mb * vb) / mg;
        return {
          prompt: L(o, `A ${mg} kg rifle fires a ${mb} kg bullet at ${vb} m/s. What is the rifle's recoil speed?`,
            `بندقية كتلتها ${nu(mg, 'kg')} تطلق رصاصة كتلتها ${nu(mb, 'kg')} بسرعة ${nu(vb, 'm/s')}. ما سرعة ارتداد البندقية؟`),
          answer: v, unit: 'm/s', mistakes: [vb / mg, mb * vb, (mg * vb) / 1000],
          explanation: L(o, `Total momentum starts at zero, so m_bullet·v_bullet = m_rifle·v_rifle ⇒ v = ${mb} × ${vb} / ${mg} = ${fmt(v)} m/s.`,
            `الزخم الكلي يبدأ صفرًا، لذا ${iso('m_bullet·v_bullet = m_rifle·v_rifle')}، إذن ${iso(`v = ${mb} × ${vb} / ${mg} = ${fmt(v)} m/s`)}.`),
        };
      }),
      gen(3, 'm₁u₁ = m₁v₁ + m₂v₂,  ½m₁u₁² = ½m₁v₁² + ½m₂v₂²', function elastic(o) {
        const m1 = rand(1, 10), v1 = rand(2, 20), m2 = rand(1, 10);
        const v2 = (2 * m1 * v1) / (m1 + m2);
        return {
          prompt: L(o, `A ${m1} kg ball moving at ${v1} m/s hits a stationary ${m2} kg ball head-on in a perfectly elastic collision. How fast does the ${m2} kg ball move afterwards?`,
            `كرة كتلتها ${nu(m1, 'kg')} تتحرك بسرعة ${nu(v1, 'm/s')} تصطدم تصادمًا مباشرًا مرنًا تمامًا بكرة ساكنة كتلتها ${nu(m2, 'kg')}. ما سرعة الكرة التي كتلتها ${nu(m2, 'kg')} بعد التصادم؟`),
          answer: v2, unit: 'm/s', mistakes: [(m1 * v1) / (m1 + m2), v1 === v2 ? v1 / 2 : v1, (m1 * v1) / m2],
          explanation: L(o, `Solving conservation of momentum and kinetic energy together (target at rest) gives v₂ = 2m₁v₁ / (m₁ + m₂) = 2 × ${m1} × ${v1} / ${m1 + m2} = ${fmt(v2)} m/s.`,
            `بحل معادلتي حفظ الزخم وحفظ الطاقة الحركية معًا (والهدف ساكن) نحصل على ${iso(`v₂ = 2m₁v₁ / (m₁ + m₂) = 2 × ${m1} × ${v1} / ${m1 + m2} = ${fmt(v2)} m/s`)}.`),
        };
      }),
      gen(3, 'F = Δp / Δt', function reboundForce(o) {
        const m = rand(0.1, 1, 0.1), v = rand(5, 30), v2 = rand(2, v - 1), t = rand(0.01, 0.1, 0.01);
        const F = (m * (v + v2)) / t;
        return {
          prompt: L(o, `A ${m} kg ball hits a wall at ${v} m/s and bounces straight back at ${v2} m/s. It is in contact with the wall for ${t} s. What is the average force on the ball?`,
            `كرة كتلتها ${nu(m, 'kg')} تصطدم بجدار بسرعة ${nu(v, 'm/s')} وترتد مباشرة بسرعة ${nu(v2, 'm/s')}. زمن التلامس مع الجدار ${nu(t, 's')}. ما متوسط القوة المؤثرة في الكرة؟`),
          answer: F, unit: 'N', mistakes: [(m * (v - v2)) / t, (m * v) / t, m * (v + v2) * t],
          explanation: L(o, `Velocity reverses, so Δv = ${v2} − (−${v}) = ${v + v2} m/s. F = m·Δv / Δt = ${m} × ${v + v2} / ${t} = ${fmt(F)} N. Forgetting the direction change is the trap!`,
            `اتجاه السرعة ينعكس، لذا ${iso(`Δv = ${v2} − (−${v}) = ${v + v2} m/s`)}. ${iso(`F = m·Δv / Δt = ${m} × ${v + v2} / ${t} = ${fmt(F)} N`)}. نسيان انعكاس الاتجاه هو الفخ!`),
        };
      }),
      gen(3, 'ΔKE = KE_before − KE_after', function keLost(o) {
        const m1 = rand(1, 10), v1 = rand(2, 15), m2 = rand(1, 10);
        const vf = (m1 * v1) / (m1 + m2);
        const before = 0.5 * m1 * v1 * v1, after = 0.5 * (m1 + m2) * vf * vf;
        const lost = before - after;
        return {
          prompt: L(o, `A ${m1} kg trolley at ${v1} m/s collides with a stationary ${m2} kg trolley and they couple together. How much kinetic energy is lost in the collision?`,
            `عربة كتلتها ${nu(m1, 'kg')} تسير بسرعة ${nu(v1, 'm/s')} تصطدم بعربة ساكنة كتلتها ${nu(m2, 'kg')} فتلتحمان. ما مقدار الطاقة الحركية المفقودة في التصادم؟`),
          answer: lost, unit: 'J', mistakes: [before, after, 2 * lost],
          explanation: L(o, `Momentum gives v = ${m1} × ${v1} / ${m1 + m2} = ${fmt(vf)} m/s. KE before = ${fmt(before)} J, KE after = ½ × ${m1 + m2} × ${fmt(vf)}² = ${fmt(after)} J. Lost = ${fmt(lost)} J (turned into heat and sound).`,
            `من حفظ الزخم: ${iso(`v = ${m1} × ${v1} / ${m1 + m2} = ${fmt(vf)} m/s`)}. الطاقة الحركية قبل ${iso(`= ${fmt(before)} J`)}، وبعد ${iso(`= ½ × ${m1 + m2} × ${fmt(vf)}² = ${fmt(after)} J`)}. المفقود ${iso(`= ${fmt(lost)} J`)} (تحوّل إلى حرارة وصوت).`),
        };
      }),
    ],

    waves: [
      gen(1, 'v = f·λ', function waveSpeed(o) {
        const f = rand(50, 1000, 10), lam = rand(0.2, 5, 0.1);
        const v = f * lam;
        return {
          prompt: L(o, `A wave has frequency ${f} Hz and wavelength ${lam} m. What is its speed?`,
            `موجة ترددها ${nu(f, 'Hz')} وطولها الموجي ${nu(lam, 'm')}. ما سرعتها؟`),
          answer: v, unit: 'm/s', mistakes: [f / lam, lam / f * 1000, f + lam],
          explanation: L(o, `Wave equation: v = f·λ = ${f} × ${lam} = ${fmt(v)} m/s.`,
            `معادلة الموجة: ${iso(`v = f·λ = ${f} × ${lam} = ${fmt(v)} m/s`)}.`),
        };
      }),
      gen(1, 'λ = v / f', function wavelength(o) {
        const f = rand(100, 2000, 50);
        const lam = SOUND / f;
        return {
          prompt: L(o, `Sound travels at ${SOUND} m/s in air. What is the wavelength of a ${f} Hz note?`,
            `ينتقل الصوت في الهواء بسرعة ${nu(SOUND, 'm/s')}. ما الطول الموجي لنغمة ترددها ${nu(f, 'Hz')}؟`),
          answer: lam, unit: 'm', mistakes: [SOUND * f, f / SOUND, SOUND / f / 2],
          explanation: L(o, `λ = v / f = ${SOUND} / ${f} = ${fmt(lam)} m.`,
            `${iso(`λ = v / f = ${SOUND} / ${f} = ${fmt(lam)} m`)}.`),
        };
      }),
      gen(1, 'T = 1 / f', function period(o) {
        const f = rand(2, 50);
        const T = 1 / f;
        return {
          prompt: L(o, `A machine vibrates at ${f} Hz. What is the period of one vibration?`,
            `آلة تهتز بتردد ${nu(f, 'Hz')}. ما الزمن الدوري لاهتزازة واحدة؟`),
          answer: T, unit: 's', mistakes: [f, (2 * Math.PI) / f, 1 / (2 * f)],
          explanation: L(o, `Period is the inverse of frequency: T = 1/f = 1/${f} = ${fmt(T)} s.`,
            `الزمن الدوري مقلوب التردد: ${iso(`T = 1/f = 1/${f} = ${fmt(T)} s`)}.`),
        };
      }),
      gen(1, 'f = N / t', function frequencyCount(o) {
        const t = rand(5, 60, 5), N = rand(5, 60);
        const f = N / t;
        return {
          prompt: L(o, `A buoy bobs up and down ${N} times in ${t} s as waves pass. What is the frequency of the waves?`,
            `تتمايل عوّامة صعودًا وهبوطًا ${iso(N)} مرة خلال ${nu(t, 's')} مع مرور الأمواج. ما تردد الأمواج؟`),
          answer: f, unit: 'Hz', mistakes: [t / N, N * t, N / t / 2],
          explanation: L(o, `Frequency = waves per second = ${N} / ${t} = ${fmt(f)} Hz.`,
            `التردد = عدد الموجات في الثانية ${iso(`= ${N} / ${t} = ${fmt(f)} Hz`)}.`),
        };
      }),
      gen(2, 'd = v·t / 2', function echo(o) {
        const t = rand(0.5, 6, 0.5);
        const d = (SOUND * t) / 2;
        return {
          prompt: L(o, `You shout toward a cliff and hear the echo ${t} s later. How far away is the cliff? (speed of sound = ${SOUND} m/s)`,
            `تصرخ باتجاه جرف فتسمع الصدى بعد ${nu(t, 's')}. ما بُعد الجرف عنك؟ (سرعة الصوت ${nu(SOUND, 'm/s')})`),
          answer: d, unit: 'm', mistakes: [SOUND * t, SOUND / t, 2 * SOUND * t],
          explanation: L(o, `The sound travels there AND back, so 2d = v·t ⇒ d = ${SOUND} × ${t} / 2 = ${fmt(d)} m.`,
            `الصوت يذهب ويعود، لذا ${iso('2d = v·t')}، إذن ${iso(`d = ${SOUND} × ${t} / 2 = ${fmt(d)} m`)}.`),
        };
      }),
      gen(2, 't = d / c', function lightTravel(o) {
        const trip = pick([
          { en: 'the Moon to Earth', ar: 'من القمر إلى الأرض', d: 3.84e8 },
          { en: 'the Sun to Earth', ar: 'من الشمس إلى الأرض', d: 1.5e11 },
          { en: 'Mars to Earth (at their closest)', ar: 'من المريخ إلى الأرض (عند أقرب مسافة بينهما)', d: 5.5e10 },
          { en: 'a GPS satellite to your phone', ar: 'من قمر صناعي لنظام GPS إلى هاتفك', d: 2.02e7 },
        ]);
        const t = trip.d / LIGHT;
        return {
          prompt: L(o, `Light travels at 3 × 10⁸ m/s. How long does light take to travel from ${trip.en}, a distance of ${fmt(trip.d)} m?`,
            `ينتقل الضوء بسرعة ${iso('3 × 10⁸ m/s')}. كم يستغرق الضوء للانتقال ${trip.ar}، أي مسافة ${nu(fmt(trip.d), 'm')}؟`),
          answer: t, unit: 's', mistakes: [trip.d / 3e5, (2 * trip.d) / LIGHT, t / 60],
          explanation: L(o, `t = d / c = ${fmt(trip.d)} / (3 × 10⁸) = ${fmt(t)} s. Careful with the powers of ten!`,
            `${iso(`t = d / c = ${fmt(trip.d)} / (3 × 10⁸) = ${fmt(t)} s`)}. انتبه لقوى العشرة!`),
        };
      }),
      gen(3, 'fₙ = n·v / (2L)', function stringHarmonic(o) {
        const Ln = rand(0.3, 1.5, 0.1), v = rand(100, 500, 10), n = pick([1, 2, 3]);
        const f = (n * v) / (2 * Ln);
        return {
          prompt: L(o, `A guitar string is ${Ln} m long and waves travel along it at ${v} m/s. What is the frequency of its ${ORDINAL.en[n]} harmonic?`,
            `وتر جيتار طوله ${nu(Ln, 'm')} وتنتقل الموجات عليه بسرعة ${nu(v, 'm/s')}. ما تردد نغمته التوافقية ${ORDINAL.ar[n]}؟`),
          answer: f, unit: 'Hz', mistakes: [(n * v) / Ln, (n * v) / (4 * Ln), n > 1 ? v / (2 * Ln) : (2 * v) / (2 * Ln), ((n + 1) * v) / (2 * Ln)],
          explanation: L(o, `With both ends fixed, the nth harmonic fits n half-wavelengths: λ = 2L/n. So f = n·v/(2L) = ${n} × ${v} / (2 × ${Ln}) = ${fmt(f)} Hz.`,
            `الوتر مثبّت من طرفيه، فالتوافقية رقم n تحوي n من أنصاف الأطوال الموجية: ${iso('λ = 2L/n')}. إذن ${iso(`f = n·v/(2L) = ${n} × ${v} / (2 × ${Ln}) = ${fmt(f)} Hz`)}.`),
        };
      }),
      gen(3, "f' = f·v / (v ∓ v_s)", function doppler(o) {
        const f = rand(300, 1000, 50), vs = rand(10, 40, 5), toward = Math.random() < 0.5;
        const heard = (f * SOUND) / (SOUND + (toward ? -vs : vs));
        const other = (f * SOUND) / (SOUND + (toward ? vs : -vs));
        const sign = toward ? '−' : '+';
        return {
          prompt: L(o, `An ambulance siren emits ${f} Hz. It drives ${toward ? 'toward' : 'away from'} you at ${vs} m/s. What frequency do you hear? (speed of sound = ${SOUND} m/s)`,
            `صفارة سيارة إسعاف ترددها ${nu(f, 'Hz')}. تتحرك ${toward ? 'نحوك' : 'مبتعدة عنك'} بسرعة ${nu(vs, 'm/s')}. ما التردد الذي تسمعه؟ (سرعة الصوت ${nu(SOUND, 'm/s')})`),
          answer: heard, unit: 'Hz', mistakes: [other, (f * (SOUND + (toward ? vs : -vs))) / SOUND, f],
          explanation: L(o, `Moving source: f' = f·v / (v ${sign} v_s) = ${f} × ${SOUND} / (${SOUND} ${sign} ${vs}) = ${fmt(heard)} Hz. ${toward ? 'Approaching → higher pitch.' : 'Moving away → lower pitch.'}`,
            `مصدر متحرك: ${iso(`f' = f·v / (v ${sign} v_s) = ${f} × ${SOUND} / (${SOUND} ${sign} ${vs}) = ${fmt(heard)} Hz`)}. ${toward ? 'الاقتراب يعني نغمة أعلى.' : 'الابتعاد يعني نغمة أخفض.'}`),
        };
      }),
      gen(3, 'v = √(T / μ)', function stringSpeed(o) {
        const T = rand(20, 200, 10), mu = rand(0.002, 0.02, 0.002);
        const v = Math.sqrt(T / mu);
        return {
          prompt: L(o, `A rope under ${T} N of tension has a mass per unit length of ${mu} kg/m. How fast do waves travel along it?`,
            `حبل مشدود بقوة ${nu(T, 'N')} وكتلته لكل وحدة طول ${nu(mu, 'kg/m')}. ما سرعة الموجات عليه؟`),
          answer: v, unit: 'm/s', mistakes: [T / mu, Math.sqrt(T * mu), Math.sqrt(T / mu) / 2],
          explanation: L(o, `Wave speed on a string: v = √(T/μ) = √(${T} / ${mu}) = ${fmt(v)} m/s. Tighter or lighter string → faster waves.`,
            `سرعة الموجة على وتر: ${iso(`v = √(T/μ) = √(${T} / ${mu}) = ${fmt(v)} m/s`)}. الوتر الأشد أو الأخف يعني موجات أسرع.`),
        };
      }),
    ],

    electricity: [
      gen(1, 'V = I·R', function ohmVoltage(o) {
        const I = rand(0.5, 5, o.easy ? 1 : 0.5), R = rand(2, 100, 2);
        const V = I * R;
        return {
          prompt: L(o, `A current of ${I} A flows through a ${R} Ω resistor. What is the voltage across it?`,
            `يمر تيار ${nu(I, 'A')} في مقاوم ${nu(R, 'Ω')}. ما فرق الجهد بين طرفيه؟`),
          answer: V, unit: 'V', mistakes: [I / R, R / I, I + R],
          explanation: L(o, `Ohm's law: V = I·R = ${I} × ${R} = ${fmt(V)} V.`,
            `قانون أوم: ${iso(`V = I·R = ${I} × ${R} = ${fmt(V)} V`)}.`),
        };
      }),
      gen(1, 'I = V / R', function ohmCurrent(o) {
        const V = pick([1.5, 3, 4.5, 6, 9, 12, 24, 230]), R = rand(2, 200, 2);
        const I = V / R;
        return {
          prompt: L(o, `A ${V} V source is connected across a ${R} Ω resistor. What current flows?`,
            `وُصل مصدر ${nu(V, 'V')} بطرفي مقاوم ${nu(R, 'Ω')}. ما التيار المار؟`),
          answer: I, unit: 'A', mistakes: [V * R, R / V, V / R / 2],
          explanation: L(o, `I = V / R = ${V} / ${R} = ${fmt(I)} A.`,
            `${iso(`I = V / R = ${V} / ${R} = ${fmt(I)} A`)}.`),
        };
      }),
      gen(1, 'P = V·I', function electricPower(o) {
        const V = pick([3, 6, 9, 12, 24, 120, 230]), I = o.easy ? rand(1, 10) : rand(0.2, 10, 0.2);
        const P = V * I;
        return {
          prompt: L(o, `A device draws ${I} A from a ${V} V supply. What power does it use?`,
            `جهاز يسحب تيارًا ${nu(I, 'A')} من مصدر ${nu(V, 'V')}. ما قدرته؟`),
          answer: P, unit: 'W', mistakes: [V / I, I / V * 100, V * I * I],
          explanation: L(o, `P = V·I = ${V} × ${I} = ${fmt(P)} W.`,
            `${iso(`P = V·I = ${V} × ${I} = ${fmt(P)} W`)}.`),
        };
      }),
      gen(2, 'R = R₁ + R₂ + R₃', function series(o) {
        const rs = [rand(2, 50), rand(2, 50), rand(2, 50)];
        const R = rs[0] + rs[1] + rs[2];
        const par = 1 / (1 / rs[0] + 1 / rs[1] + 1 / rs[2]);
        return {
          prompt: L(o, `Resistors of ${rs[0]} Ω, ${rs[1]} Ω and ${rs[2]} Ω are connected in series. What is the total resistance?`,
            `وُصلت مقاومات ${nu(rs[0], 'Ω')} و${nu(rs[1], 'Ω')} و${nu(rs[2], 'Ω')} على التوالي. ما المقاومة الكلية؟`),
          answer: R, unit: 'Ω', mistakes: [par, R / 3, Math.max(...rs)],
          explanation: L(o, `In series, resistances simply add: ${rs[0]} + ${rs[1]} + ${rs[2]} = ${R} Ω.`,
            `على التوالي تُجمع المقاومات: ${iso(`${rs[0]} + ${rs[1]} + ${rs[2]} = ${R} Ω`)}.`),
        };
      }),
      gen(2, '1/R = 1/R₁ + 1/R₂', function parallel(o) {
        const r1 = rand(2, 60, 2), r2 = rand(2, 60, 2);
        const R = (r1 * r2) / (r1 + r2);
        return {
          prompt: L(o, `Two resistors, ${r1} Ω and ${r2} Ω, are connected in parallel. What is the combined resistance?`,
            `مقاومان ${nu(r1, 'Ω')} و${nu(r2, 'Ω')} موصولان على التوازي. ما المقاومة المكافئة؟`),
          answer: R, unit: 'Ω', mistakes: [r1 + r2, (r1 + r2) / 2, 1 / (r1 + r2) * 100],
          explanation: L(o, `Parallel: 1/R = 1/${r1} + 1/${r2} ⇒ R = (${r1} × ${r2}) / (${r1} + ${r2}) = ${fmt(R)} Ω. It's always smaller than the smallest resistor!`,
            `على التوازي: ${iso(`1/R = 1/${r1} + 1/${r2}`)}، إذن ${iso(`R = (${r1} × ${r2}) / (${r1} + ${r2}) = ${fmt(R)} Ω`)}. وهي دائمًا أصغر من أصغر مقاومة!`),
        };
      }),
      gen(2, 'E = P·t', function energyUsed(o) {
        const P = rand(100, 3000, 100), h = rand(1, 10);
        const E = (P * h) / 1000;
        return {
          prompt: L(o, `A ${P} W heater runs for ${h} hours. How much energy does it use, in kilowatt-hours?`,
            `مدفأة قدرتها ${nu(P, 'W')} تعمل لمدة ${nu(h, 'h')}. ما الطاقة التي تستهلكها بالكيلوواط ساعة؟`),
          answer: E, unit: 'kWh', mistakes: [P * h, (P * h) / 100, P / h / 1000],
          explanation: L(o, `Convert to kilowatts first: ${P} W = ${fmt(P / 1000)} kW. E = P·t = ${fmt(P / 1000)} kW × ${h} h = ${fmt(E)} kWh.`,
            `حوّل إلى كيلوواط أولًا: ${iso(`${P} W = ${fmt(P / 1000)} kW`)}. ${iso(`E = P·t = ${fmt(P / 1000)} kW × ${h} h = ${fmt(E)} kWh`)}.`),
        };
      }),
      gen(3, 'R = R₁ + (R₂·R₃)/(R₂ + R₃)', function mixedCircuit(o) {
        const V = pick([6, 9, 12, 24]), R1 = rand(2, 20), R2 = rand(4, 40, 2), R3 = rand(4, 40, 2);
        const Rp = (R2 * R3) / (R2 + R3);
        const I = V / (R1 + Rp);
        return {
          prompt: L(o, `A ${V} V battery is connected to a ${R1} Ω resistor in series with a parallel pair of ${R2} Ω and ${R3} Ω. What current does the battery supply?`,
            `بطارية ${nu(V, 'V')} موصولة بمقاوم ${nu(R1, 'Ω')} على التوالي مع مقاومين على التوازي ${nu(R2, 'Ω')} و${nu(R3, 'Ω')}. ما التيار الذي تزوّده البطارية؟`),
          answer: I, unit: 'A', mistakes: [V / (R1 + R2 + R3), V / R1, V / Rp],
          explanation: L(o, `Parallel pair: ${R2}·${R3}/(${R2}+${R3}) = ${fmt(Rp)} Ω. Total = ${R1} + ${fmt(Rp)} = ${fmt(R1 + Rp)} Ω. I = V/R = ${V} / ${fmt(R1 + Rp)} = ${fmt(I)} A.`,
            `المقاومان على التوازي: ${iso(`${R2}·${R3}/(${R2}+${R3}) = ${fmt(Rp)} Ω`)}. المقاومة الكلية ${iso(`= ${R1} + ${fmt(Rp)} = ${fmt(R1 + Rp)} Ω`)}. ${iso(`I = V/R = ${V} / ${fmt(R1 + Rp)} = ${fmt(I)} A`)}.`),
        };
      }),
      gen(3, 'P = I²·R', function seriesPower(o) {
        const V = pick([6, 9, 12, 24]), R1 = rand(2, 30), R2 = rand(2, 30);
        const I = V / (R1 + R2);
        const P = I * I * R1;
        return {
          prompt: L(o, `A ${R1} Ω and a ${R2} Ω resistor are in series with a ${V} V battery. How much power is dissipated in the ${R1} Ω resistor?`,
            `مقاومان ${nu(R1, 'Ω')} و${nu(R2, 'Ω')} على التوالي مع بطارية ${nu(V, 'V')}. ما القدرة المستهلكة في المقاوم ${nu(R1, 'Ω')}؟`),
          answer: P, unit: 'W', mistakes: [(V * V) / R1, (V * V) / (R1 + R2), I * R1],
          explanation: L(o, `Current is the same everywhere in series: I = ${V} / (${R1} + ${R2}) = ${fmt(I)} A. P = I²·R = ${fmt(I)}² × ${R1} = ${fmt(P)} W. Using V²/R with the full ${V} V is wrong: the ${R1} Ω resistor doesn't get all of it.`,
            `التيار نفسه في كل أجزاء دائرة التوالي: ${iso(`I = ${V} / (${R1} + ${R2}) = ${fmt(I)} A`)}. ${iso(`P = I²·R = ${fmt(I)}² × ${R1} = ${fmt(P)} W`)}. استخدام ${iso('V²/R')} مع الجهد الكامل ${nu(V, 'V')} خطأ، فالمقاوم لا يأخذ الجهد كله.`),
        };
      }),
      gen(3, 'V = E − I·r', function internalResistance(o) {
        const E = pick([1.5, 3, 4.5, 6, 9, 12]), r = rand(0.2, 2, 0.1), R = rand(2, 20);
        const I = E / (R + r);
        const V = I * R;
        return {
          prompt: L(o, `A battery with EMF ${E} V and internal resistance ${r} Ω is connected to a ${R} Ω lamp. What is the voltage across the lamp?`,
            `بطارية قوتها الدافعة الكهربائية ${nu(E, 'V')} ومقاومتها الداخلية ${nu(r, 'Ω')} موصولة بمصباح مقاومته ${nu(R, 'Ω')}. ما فرق الجهد بين طرفي المصباح؟`),
          answer: V, unit: 'V', mistakes: [E, I * r, I],
          explanation: L(o, `I = E / (R + r) = ${E} / ${fmt(R + r)} = ${fmt(I)} A. Some voltage is "lost" inside the battery: V = E − I·r = ${E} − ${fmt(I * r)} = ${fmt(V)} V.`,
            `${iso(`I = E / (R + r) = ${E} / ${fmt(R + r)} = ${fmt(I)} A`)}. جزء من الجهد "يضيع" داخل البطارية: ${iso(`V = E − I·r = ${E} − ${fmt(I * r)} = ${fmt(V)} V`)}.`),
        };
      }),
    ],
  };

  // ---------- conceptual questions (first choice is correct) ----------
  const c = (enPrompt, enChoices, enExp, arPrompt, arChoices, arExp) => ({
    prompt: { en: enPrompt, ar: arPrompt },
    choices: { en: enChoices, ar: arChoices },
    explanation: { en: enExp, ar: arExp },
  });

  const CONCEPTS = {
    kinematics: [
      c('A ball is thrown straight up. At the very top of its flight, what is true?',
        ['Velocity is zero, acceleration is g downward', 'Velocity and acceleration are both zero', 'Velocity is zero, acceleration is upward', 'Velocity is maximum'],
        'At the top the ball momentarily stops, but gravity never switches off. The acceleration is still g downward the whole time.',
        'قُذفت كرة رأسيًا إلى أعلى. عند أعلى نقطة في مسارها، أي العبارات صحيحة؟',
        ['السرعة صفر، والتسارع g نحو الأسفل', 'السرعة والتسارع كلاهما صفر', 'السرعة صفر، والتسارع نحو الأعلى', 'السرعة أكبر ما يمكن'],
        'عند القمة تتوقف الكرة لحظيًا، لكن الجاذبية لا تتوقف أبدًا، فالتسارع يبقى g نحو الأسفل طوال الوقت.'),
      c('Ignoring air resistance, a feather and a hammer are dropped together on the Moon. What happens?',
        ['They hit the ground at the same time', 'The hammer lands first', 'The feather lands first', 'The feather floats away'],
        'Without air, every object falls with the same acceleration regardless of mass. Apollo 15 astronauts actually did this experiment!',
        'بإهمال مقاومة الهواء، أُسقطت ريشة ومطرقة معًا على سطح القمر. ماذا يحدث؟',
        ['تصلان إلى السطح في اللحظة نفسها', 'المطرقة تصل أولًا', 'الريشة تصل أولًا', 'الريشة تطفو بعيدًا'],
        'بدون هواء تسقط جميع الأجسام بالتسارع نفسه مهما كانت كتلتها. روّاد مهمة أبولو 15 أجروا هذه التجربة فعلًا!'),
      c('On a distance–time graph, what does the slope represent?',
        ['Speed', 'Acceleration', 'Distance travelled', 'Force'],
        'Slope = change in distance / change in time = speed. On a velocity–time graph, the slope is acceleration.',
        'في منحنى (المسافة – الزمن)، ماذا يمثّل الميل؟',
        ['السرعة', 'التسارع', 'المسافة المقطوعة', 'القوة'],
        'الميل = التغير في المسافة ÷ التغير في الزمن = السرعة. أما في منحنى (السرعة – الزمن) فالميل هو التسارع.'),
      c('Two balls leave a table at the same moment: one is dropped, one is fired horizontally. Which lands first?',
        ['They land at the same time', 'The dropped ball', 'The fired ball', 'It depends on the fired speed'],
        'Horizontal and vertical motions are independent. Both start with zero vertical velocity, so both fall the same height in the same time.',
        'تغادر كرتان حافة طاولة في اللحظة نفسها: الأولى سقطت سقوطًا حرًا، والثانية قُذفت أفقيًا. أيهما تصل إلى الأرض أولًا؟',
        ['تصلان في الوقت نفسه', 'الكرة الساقطة', 'الكرة المقذوفة', 'يعتمد على سرعة القذف'],
        'الحركتان الأفقية والرأسية مستقلتان. كلتا الكرتين تبدآن بسرعة رأسية صفرية، فتسقطان الارتفاع نفسه في الزمن نفسه.'),
    ],
    forces: [
      c("A book rests on a table. According to Newton's 3rd law, what is the reaction to the book's weight (Earth pulling the book down)?",
        ['The book pulling the Earth up', 'The table pushing the book up', 'The book pushing on the table', 'Friction'],
        "Action–reaction pairs act on DIFFERENT objects and are the same type of force. Earth pulls the book (gravity) and the book pulls Earth (gravity). The table's push is a separate force.",
        'كتاب موضوع على طاولة. وفق قانون نيوتن الثالث، ما رد الفعل لوزن الكتاب (جذب الأرض للكتاب نحو الأسفل)؟',
        ['جذب الكتاب للأرض نحو الأعلى', 'دفع الطاولة للكتاب نحو الأعلى', 'دفع الكتاب للطاولة', 'الاحتكاك'],
        'زوجا الفعل ورد الفعل يؤثران في جسمين مختلفين ومن النوع نفسه. الأرض تجذب الكتاب (جاذبية) والكتاب يجذب الأرض (جاذبية). أما دفع الطاولة فقوة مختلفة.'),
      c('A spacecraft far from any planet is moving at 1000 m/s with its engines off. What happens?',
        ['It keeps moving at 1000 m/s in a straight line', 'It slowly comes to a stop', 'It speeds up', 'It starts to curve'],
        "Newton's 1st law: with no net force, an object keeps its velocity. Nothing is needed to keep something moving, only to change its motion.",
        `مركبة فضائية بعيدة عن أي كوكب تتحرك بسرعة ${nu(1000, 'm/s')} ومحركاتها مطفأة. ماذا يحدث؟`,
        [`تستمر بسرعة ${nu(1000, 'm/s')} في خط مستقيم`, 'تتباطأ تدريجيًا حتى تتوقف', 'تتسارع', 'تبدأ بالانعطاف'],
        'قانون نيوتن الأول: إذا انعدمت القوة المحصلة يحافظ الجسم على سرعته. لا نحتاج إلى قوة لنُبقي الجسم متحركًا، بل لنغيّر حركته فقط.'),
      c('A car moves at constant velocity on a straight road. What is the net force on it?',
        ['Zero', 'Forward, equal to the engine force', 'Backward, due to friction', 'Downward, due to gravity'],
        'Constant velocity means zero acceleration, so the net force must be zero. The engine force exactly balances drag and friction.',
        'سيارة تتحرك بسرعة ثابتة على طريق مستقيم. ما القوة المحصلة المؤثرة فيها؟',
        ['صفر', 'إلى الأمام وتساوي قوة المحرك', 'إلى الخلف بسبب الاحتكاك', 'إلى الأسفل بسبب الجاذبية'],
        'السرعة الثابتة تعني تسارعًا صفريًا، إذن القوة المحصلة صفر. قوة المحرك تتوازن تمامًا مع مقاومة الهواء والاحتكاك.'),
      c('Your mass is 60 kg on Earth. What is your mass on the Moon?',
        ['60 kg', '10 kg', '0 kg', '360 kg'],
        "Mass is the amount of matter and does not change. Your WEIGHT on the Moon is about 1/6 of Earth's because g is smaller there.",
        `كتلتك ${nu(60, 'kg')} على الأرض. كم تكون كتلتك على القمر؟`,
        ['60 kg', '10 kg', '0 kg', '360 kg'],
        'الكتلة مقدار المادة ولا تتغير. أما وزنك على القمر فيصبح نحو سدس وزنك على الأرض لأن g هناك أصغر.'),
    ],
    energy: [
      c('If you double the speed of a car, its kinetic energy becomes…',
        ['4 times larger', '2 times larger', 'Unchanged', '8 times larger'],
        'KE = ½mv². Doubling v multiplies v² by 4. This is why high-speed crashes are so much more dangerous.',
        'إذا ضاعفت سرعة سيارة، فإن طاقتها الحركية تصبح…',
        ['أكبر 4 مرات', 'أكبر مرتين', 'لا تتغير', 'أكبر 8 مرات'],
        `${iso('KE = ½mv²')}. مضاعفة v تضرب ${iso('v²')} في 4. لهذا تكون الحوادث عند السرعات العالية أخطر بكثير.`),
      c('A pendulum swings back and forth. At the lowest point of its swing it has…',
        ['Maximum kinetic energy, minimum potential energy', 'Maximum potential energy, minimum kinetic energy', 'Zero total energy', 'Equal KE and PE always'],
        'As it falls, PE converts to KE. At the bottom it is fastest (max KE) and lowest (min PE).',
        'بندول يتأرجح ذهابًا وإيابًا. عند أدنى نقطة في مساره تكون له…',
        ['أكبر طاقة حركية وأقل طاقة وضع', 'أكبر طاقة وضع وأقل طاقة حركية', 'طاقة كلية صفرية', 'طاقة حركية تساوي طاقة الوضع دائمًا'],
        'أثناء الهبوط تتحول طاقة الوضع إلى طاقة حركية. عند الأسفل يكون أسرع ما يمكن (أكبر طاقة حركية) وأخفض ما يمكن (أقل طاقة وضع).'),
      c('You carry a heavy box horizontally across a room at constant speed. How much work does gravity do on the box?',
        ['Zero', 'm·g·d', 'Negative m·g·d', 'It depends on the speed'],
        'Work = F·d·cos θ. Gravity points down, the motion is horizontal: θ = 90° and cos 90° = 0.',
        'تحمل صندوقًا ثقيلًا وتمشي به أفقيًا بسرعة ثابتة. ما الشغل الذي تبذله الجاذبية على الصندوق؟',
        ['صفر', iso('m·g·d'), `سالب ${iso('m·g·d')}`, 'يعتمد على السرعة'],
        `الشغل ${iso('= F·d·cos θ')}. الجاذبية نحو الأسفل والحركة أفقية: ${iso('θ = 90°')} و${iso('cos 90° = 0')}.`),
      c('The SI unit of power, the watt, is equal to…',
        ['1 joule per second', '1 newton per metre', '1 joule × second', '1 volt per ampere'],
        'Power is the rate of doing work: 1 W = 1 J/s.',
        'وحدة القدرة في النظام الدولي، الواط، تساوي…',
        ['1 جول لكل ثانية', '1 نيوتن لكل متر', '1 جول × ثانية', '1 فولت لكل أمبير'],
        `القدرة هي معدل بذل الشغل: ${iso('1 W = 1 J/s')}.`),
    ],
    momentum: [
      c('Why do airbags reduce injuries in a crash?',
        ['They increase the stopping time, reducing the force', 'They reduce your change in momentum', 'They increase your mass', 'They absorb all of your momentum instantly'],
        'Impulse F·Δt = Δp. Your change in momentum is fixed, so a longer stopping time Δt means a smaller force F.',
        'لماذا تقلل الوسائد الهوائية من الإصابات في الحوادث؟',
        ['تزيد زمن التوقف فتقل القوة', 'تقلل التغير في زخمك', 'تزيد كتلتك', 'تمتص كل زخمك فورًا'],
        `الدفع ${iso('F·Δt = Δp')}. التغير في زخمك ثابت، لذا زيادة زمن التوقف ${iso('Δt')} تعني قوة ${iso('F')} أصغر.`),
      c('In which type of collision is kinetic energy conserved?',
        ['Elastic', 'Inelastic', 'Perfectly inelastic', 'All collisions'],
        'Momentum is conserved in all collisions (with no external force), but kinetic energy is only conserved in elastic ones.',
        'في أي نوع من التصادمات تكون الطاقة الحركية محفوظة؟',
        ['المرن', 'غير المرن', 'عديم المرونة تمامًا', 'جميع التصادمات'],
        'الزخم محفوظ في جميع التصادمات (بغياب القوى الخارجية)، لكن الطاقة الحركية محفوظة في التصادمات المرنة فقط.'),
      c('A skater standing still throws a heavy ball forward. What happens to the skater?',
        ['They glide backward', 'They stay still', 'They glide forward', 'They spin'],
        'Total momentum was zero before, so it must be zero after: the ball goes forward, the skater goes backward.',
        'متزلج ساكن يرمي كرة ثقيلة إلى الأمام. ماذا يحدث له؟',
        ['ينزلق إلى الخلف', 'يبقى ساكنًا', 'ينزلق إلى الأمام', 'يدور حول نفسه'],
        'الزخم الكلي كان صفرًا، فيجب أن يبقى صفرًا: الكرة تتحرك إلى الأمام والمتزلج إلى الخلف.'),
    ],
    waves: [
      c("Why can't sound travel through outer space?",
        ['Sound needs a medium (particles) to travel through', 'Space is too cold', 'Sound is absorbed by stars', 'Sound travels too slowly'],
        'Sound is a mechanical wave: vibrating particles. In a vacuum there are no particles to vibrate. Light, an electromagnetic wave, needs no medium.',
        'لماذا لا ينتقل الصوت في الفضاء الخارجي؟',
        ['لأن الصوت يحتاج إلى وسط (جسيمات) لينتقل فيه', 'لأن الفضاء بارد جدًا', 'لأن النجوم تمتص الصوت', 'لأن الصوت بطيء جدًا'],
        'الصوت موجة ميكانيكية، أي جسيمات تهتز. في الفراغ لا توجد جسيمات لتهتز. أما الضوء فموجة كهرومغناطيسية لا تحتاج إلى وسط.'),
      c('A note gets higher in pitch. What has increased?',
        ['Frequency', 'Amplitude', 'Wavelength', 'Speed of sound'],
        'Pitch is determined by frequency. Loudness is determined by amplitude.',
        'أصبحت نغمة أكثر حدّة. ما الذي ازداد؟',
        ['التردد', 'السعة', 'الطول الموجي', 'سرعة الصوت'],
        'حدّة الصوت يحددها التردد، أما شدته (علوّه) فتحددها السعة.'),
      c('An ambulance siren sounds higher as it approaches you and lower as it moves away. This is called…',
        ['The Doppler effect', 'Refraction', 'Resonance', 'Diffraction'],
        'The Doppler effect: waves bunch up in front of a moving source (higher frequency) and spread out behind it (lower frequency).',
        'تبدو صفارة سيارة الإسعاف أعلى وهي تقترب منك وأخفض وهي تبتعد. تُسمى هذه الظاهرة…',
        ['ظاهرة دوبلر', 'الانكسار', 'الرنين', 'الحيود'],
        'ظاهرة دوبلر: تتقارب الموجات أمام المصدر المتحرك (تردد أعلى) وتتباعد خلفه (تردد أقل).'),
      c('Sound waves in air are…',
        ['Longitudinal', 'Transverse', 'Electromagnetic', 'Standing only'],
        'In sound, air particles vibrate back and forth along the direction the wave travels. That makes it longitudinal.',
        'موجات الصوت في الهواء هي موجات…',
        ['طولية', 'مستعرضة', 'كهرومغناطيسية', 'موقوفة فقط'],
        'في الصوت تهتز جسيمات الهواء ذهابًا وإيابًا في اتجاه انتشار الموجة نفسه، ولذلك فهي طولية.'),
    ],
    electricity: [
      c('When more bulbs are added in parallel to a battery, the total current from the battery…',
        ['Increases', 'Decreases', 'Stays the same', 'Becomes zero'],
        'Each new parallel branch is another path for current, so total resistance drops and the total current increases.',
        'عند إضافة مصابيح أكثر على التوازي مع بطارية، فإن التيار الكلي من البطارية…',
        ['يزداد', 'يقل', 'يبقى كما هو', 'يصبح صفرًا'],
        'كل فرع جديد على التوازي مسار إضافي للتيار، فتقل المقاومة الكلية ويزداد التيار الكلي.'),
      c('In a series circuit, one bulb breaks. What happens to the others?',
        ['They all go out', 'They get brighter', 'Nothing changes', 'Only the next bulb goes out'],
        'A series circuit has only one path. A break anywhere stops the current everywhere.',
        'في دائرة توالٍ، تعطّل أحد المصابيح. ماذا يحدث للمصابيح الأخرى؟',
        ['تنطفئ جميعها', 'تزداد إضاءتها', 'لا يتغير شيء', 'ينطفئ المصباح التالي فقط'],
        'دائرة التوالي لها مسار واحد فقط. أي انقطاع في أي مكان يوقف التيار في كل مكان.'),
      c('Which is the best description of electric current?',
        ['The rate of flow of charge', 'The energy per unit charge', 'The opposition to charge flow', 'The total charge stored'],
        'Current I = Q/t: the charge passing a point per second. Energy per charge is voltage; opposition to flow is resistance.',
        'ما أفضل وصف للتيار الكهربائي؟',
        ['معدل تدفق الشحنة', 'الطاقة لكل وحدة شحنة', 'الممانعة لتدفق الشحنة', 'مجموع الشحنة المخزنة'],
        `التيار ${iso('I = Q/t')} هو الشحنة المارة بنقطة في الثانية. الطاقة لكل وحدة شحنة هي الجهد، والممانعة للتدفق هي المقاومة.`),
      c('A 60 W bulb and a 100 W bulb are both designed for 230 V. Which has the higher resistance?',
        ['The 60 W bulb', 'The 100 W bulb', 'They have the same resistance', 'It cannot be determined'],
        'P = V²/R, so R = V²/P. With the same V, a smaller P means a larger R.',
        `مصباح ${nu(60, 'W')} ومصباح ${nu(100, 'W')} صُمّم كلاهما للعمل على ${nu(230, 'V')}. أيهما له مقاومة أكبر؟`,
        [`مصباح ${nu(60, 'W')}`, `مصباح ${nu(100, 'W')}`, 'لهما المقاومة نفسها', 'لا يمكن تحديد ذلك'],
        `${iso('P = V²/R')}، إذن ${iso('R = V²/P')}. عند الجهد نفسه، القدرة الأصغر تعني مقاومة أكبر.`),
    ],
  };

  // ---------- formula reference ----------
  const f = (formula, en, ar) => [formula, { en, ar }];
  const FORMULAS = {
    kinematics: [
      f('v = d / t', 'speed = distance ÷ time', 'السرعة = المسافة ÷ الزمن'),
      f('v = u + a·t', 'final velocity after accelerating', 'السرعة النهائية بعد التسارع'),
      f('s = u·t + ½·a·t²', 'displacement with constant acceleration', 'الإزاحة بتسارع ثابت'),
      f('v² = u² + 2·a·s', 'no time needed', 'دون الحاجة إلى الزمن'),
      f('R = v²·sin(2θ) / g', 'range of a projectile on flat ground', 'مدى المقذوف على أرض مستوية'),
      f('x = v·t,  h = ½·g·t²', 'horizontal launch: split into x and y', 'القذف الأفقي: افصل الحركة إلى x و y'),
    ],
    forces: [
      f('F = m·a', "Newton's 2nd law", 'قانون نيوتن الثاني'),
      f('W = m·g', 'weight (g = 9.8 m/s², or 10 in Beginner and School)', 'الوزن (g = 9.8 m/s²، أو 10 في المبتدئ والمدرسة)'),
      f('f = μ·N', 'friction force (N = normal force)', 'قوة الاحتكاك (N القوة العمودية)'),
      f('F = k·x', "Hooke's law for springs", 'قانون هوك للنوابض'),
      f('a = g·(sin θ − μ·cos θ)', 'sliding down a slope with friction', 'الانزلاق على منحدر مع احتكاك'),
      f('N = m·(g ± a)', 'apparent weight in an accelerating lift', 'الوزن الظاهري في مصعد متسارع'),
    ],
    energy: [
      f('KE = ½·m·v²', 'kinetic energy', 'الطاقة الحركية'),
      f('PE = m·g·h', 'gravitational potential energy', 'طاقة الوضع الجاذبية'),
      f('E = ½·k·x²', 'energy stored in a spring', 'الطاقة المختزنة في نابض'),
      f('W = F·d·cos θ', 'work done by a force', 'الشغل المبذول بقوة'),
      f('P = W / t', 'power = work ÷ time', 'القدرة = الشغل ÷ الزمن'),
      f('η = E_out / E_in × 100%', 'efficiency: useful energy out ÷ energy in', 'الكفاءة: الطاقة المفيدة الخارجة ÷ الطاقة الداخلة'),
    ],
    momentum: [
      f('p = m·v', 'momentum', 'الزخم (كمية الحركة)'),
      f('F·Δt = Δp', 'impulse = change in momentum', 'الدفع = التغير في الزخم'),
      f('m₁u₁ + m₂u₂ = m₁v₁ + m₂v₂', 'conservation of momentum', 'حفظ الزخم'),
      f('v₂ = 2m₁v₁ / (m₁ + m₂)', 'elastic collision, target at rest', 'تصادم مرن والهدف ساكن'),
    ],
    waves: [
      f('v = f·λ', 'wave speed', 'سرعة الموجة'),
      f('T = 1 / f', 'period', 'الزمن الدوري'),
      f('d = v·t / 2', 'echo distance', 'بُعد مصدر الصدى'),
      f('fₙ = n·v / (2L)', 'harmonics on a string fixed at both ends', 'توافقيات وتر مثبّت من طرفيه'),
      f('v = √(T / μ)', 'wave speed on a string', 'سرعة الموجة على وتر'),
      f("f' = f·v / (v ∓ v_s)", 'Doppler effect, moving source (− when approaching)', 'ظاهرة دوبلر لمصدر متحرك (− عند الاقتراب)'),
    ],
    electricity: [
      f('V = I·R', "Ohm's law", 'قانون أوم'),
      f('P = V·I = I²R = V²/R', 'electrical power', 'القدرة الكهربائية'),
      f('R = R₁ + R₂ + …', 'series resistors', 'مقاومات على التوالي'),
      f('1/R = 1/R₁ + 1/R₂ + …', 'parallel resistors', 'مقاومات على التوازي'),
      f('E = P·t', 'energy (kWh when P is in kW and t in hours)', 'الطاقة (kWh عندما تكون P بالكيلوواط و t بالساعات)'),
      f('V = E − I·r', 'terminal voltage with internal resistance', 'فرق الجهد مع مقاومة داخلية'),
    ],
  };

  // ---------- public API ----------
  // Build a question from one generator with the given settings.
  function fromGenerator(topicId, chosen, opts) {
    const o = { g: opts.g, easy: !!opts.easy, ar: opts.lang === 'ar' };
    const raw = chosen.make(o);
    const q = opts.typed ? typed(topicId, raw) : numeric(topicId, raw);
    return Object.assign(q, { formula: chosen.formula, tier: chosen.tier });
  }

  function generate(topicId, difficultyId, lang) {
    const diff = DIFF[difficultyId] || DIFF.medium;
    lang = lang || 'en';
    const gens = GENERATORS[topicId];
    if (!gens) throw new Error('Unknown topic: ' + topicId);
    const concepts = CONCEPTS[topicId] || [];
    if (concepts.length && Math.random() < diff.conceptRate) {
      return Object.assign(conceptual(topicId, pick(concepts), lang), { difficulty: diff.id });
    }
    const pool = gens.filter((g) => diff.tierWeights[g.tier]);
    const chosen = weightedPick(pool, (g) => diff.tierWeights[g.tier]);
    const q = fromGenerator(topicId, chosen, { g: diff.g, easy: diff.id === 'beginner', lang, typed: diff.typed });
    return Object.assign(q, { difficulty: diff.id });
  }

  function findGenerator(topicId, name) {
    return (GENERATORS[topicId] || []).find((g) => g.make.name === name) || null;
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
    generate, fromGenerator, findGenerator, pickWeightedTopic,
    fmt, iso, nu, L, rand, pick, shuffle, gen,
    numeric, typed, conceptual, parseAnswer, checkTyped,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PhysicsQuestions = api;
})(typeof window !== 'undefined' ? window : globalThis);

// Run with: npm test
const test = require('node:test');
const assert = require('node:assert');
const Q = require('../js/questions.js');
const I18N = require('../js/i18n.js');
const S = require('../js/school.js');

const RUNS = 200;
const ARABIC = /[؀-ۿ]/;
const BROKEN = /NaN|undefined|Infinity|\[object/;

function checkNumeric(name, raw, q) {
  assert.strictEqual(q.choices.length, 4, `${name}: ${q.choices}`);
  assert.strictEqual(new Set(q.choices).size, 4, `${name}: duplicate choices ${q.choices}`);
  assert.ok(q.correctIndex >= 0 && q.correctIndex < 4);
  assert.ok(isFinite(q.answerValue) && q.answerValue > 0, `${name}: bad answer ${q.answerValue}`);
  const show = raw.format ? Q[raw.format] : Q.fmt;
  assert.ok(q.choices[q.correctIndex].startsWith(show(q.answerValue)), `${name}: correct choice mismatch`);
  assert.ok(!BROKEN.test(raw.prompt + raw.explanation), `${name}: broken text: ${raw.prompt}`);
}

test('every generator produces 4 distinct choices with the correct answer, in both languages', () => {
  for (const [topic, gens] of Object.entries(Q.GENERATORS)) {
    for (const gen of gens) {
      for (const g of [10, 9.8]) {
        for (const ar of [false, true]) {
          for (let i = 0; i < RUNS; i++) {
            const raw = gen.make({ g, easy: g === 10, ar });
            checkNumeric(gen.make.name, raw, Q.numeric(topic, raw));
            if (g === 10) assert.ok(!/g = 9\.8/.test(raw.prompt + raw.explanation), `${gen.make.name}: uses 9.8 when g = 10`);
            if (ar) assert.ok(ARABIC.test(raw.prompt), `${gen.make.name}: Arabic text missing`);
            else assert.ok(!ARABIC.test(raw.prompt + raw.explanation), `${gen.make.name}: Arabic in English text`);
          }
        }
      }
    }
  }
});

test('every topic has problems for every difficulty tier', () => {
  for (const t of Q.TOPICS) {
    for (const tier of [1, 2, 3]) {
      assert.ok(Q.GENERATORS[t.id].some((g) => g.tier === tier), `${t.id} has no tier ${tier} generator`);
    }
  }
});

test('conceptual questions keep the right answer after shuffling, in both languages', () => {
  for (const [topic, list] of Object.entries(Q.CONCEPTS)) {
    for (const c of list) {
      assert.strictEqual(c.choices.en.length, c.choices.ar.length, `choice count differs: ${c.prompt.en}`);
      for (const lang of ['en', 'ar']) {
        for (let i = 0; i < 20; i++) {
          const q = Q.conceptual(topic, c, lang);
          assert.strictEqual(q.choices[q.correctIndex], c.choices[lang][0]);
          assert.strictEqual(new Set(q.choices).size, c.choices[lang].length);
        }
      }
      assert.ok(ARABIC.test(c.prompt.ar) && ARABIC.test(c.explanation.ar), `Arabic missing: ${c.prompt.en}`);
    }
  }
});

test('generate() respects each difficulty and language', () => {
  for (const d of Q.DIFFICULTIES) {
    for (const t of Q.TOPICS) {
      for (const lang of ['en', 'ar']) {
        for (let i = 0; i < 60; i++) {
          const q = Q.generate(t.id, d.id, lang);
          assert.strictEqual(q.topic, t.id);
          assert.strictEqual(q.difficulty, d.id);
          if (q.kind !== 'concept') assert.ok(d.tierWeights[q.tier], `${d.id} got tier ${q.tier}`);
          if (d.typed) {
            assert.strictEqual(q.kind, 'typed');
            assert.ok(Q.checkTyped(q, String(q.answerValue)), 'exact answer accepted');
          } else {
            assert.ok(q.choices.length >= 3);
          }
        }
      }
    }
  }
});

test('typed answers: parsing and 2% tolerance', () => {
  assert.strictEqual(Q.parseAnswer('12.5'), 12.5);
  assert.strictEqual(Q.parseAnswer(' 12,5 '), 12.5);
  assert.strictEqual(Q.parseAnswer('4.5e3'), 4500);
  assert.strictEqual(Q.parseAnswer('4.5 x 10^3'), 4500);
  assert.strictEqual(Q.parseAnswer('4.5×10^3'), 4500);
  assert.strictEqual(Q.parseAnswer('4.5×10³'), 4500);
  assert.strictEqual(Q.parseAnswer('5×10⁻³'), 0.005);
  assert.strictEqual(Q.parseAnswer('4.5×10^-3'), 0.0045);
  assert.strictEqual(Q.parseAnswer('٤٫٥×١٠^٣'), 4500);
  assert.ok(Number.isNaN(Q.parseAnswer('abc')));
  assert.ok(Number.isNaN(Q.parseAnswer('')));
  const q = { answerValue: 100 };
  assert.ok(Q.checkTyped(q, '101.9'));
  assert.ok(Q.checkTyped(q, '98.1'));
  assert.ok(!Q.checkTyped(q, '103'));
  assert.ok(!Q.checkTyped(q, 'hello'));
});

test('number formatting', () => {
  assert.strictEqual(Q.fmt(Math.sqrt((2 * 20) / Q.G)), '2.02');
  assert.strictEqual(Q.fmt(500), '500');
  assert.strictEqual(Q.fmt(2400), '2.4 × 10³');
  assert.strictEqual(Q.fmt(12345), '1.23 × 10⁴');
  assert.strictEqual(Q.fmt(999.7), '1 × 10³');
  assert.strictEqual(Q.fmt(0.012345), '0.0123');
  assert.strictEqual(Q.fmt(0.004), '4 × 10⁻³');
  assert.strictEqual(Q.fmt(1.5e11), '1.5 × 10¹¹');
  assert.strictEqual(Q.fmt(101.92, 4), '101.9');
  assert.strictEqual(Q.sci(380), '3.8 × 10²');
  assert.strictEqual(Q.plain(45000), '45 000');
  assert.strictEqual(Q.plain(0.0045), '0.0045');
});

test('weighted topic picker favours weak topics', () => {
  const acc = { kinematics: 0, forces: 1, energy: 1, momentum: 1, waves: 1, electricity: 1 };
  const counts = {};
  for (let i = 0; i < 5000; i++) {
    const t = Q.pickWeightedTopic(acc);
    counts[t] = (counts[t] || 0) + 1;
  }
  assert.ok(counts.kinematics > counts.forces * 2, JSON.stringify(counts));
});

test('interface text exists in both languages', () => {
  const en = Object.keys(I18N.STRINGS.en).sort();
  const ar = Object.keys(I18N.STRINGS.ar).sort();
  assert.deepStrictEqual(ar, en, 'English and Arabic keys differ');
  for (const k of en) {
    const a = (I18N.STRINGS.en[k].match(/\{\w+\}/g) || []).sort().join();
    const b = (I18N.STRINGS.ar[k].match(/\{\w+\}/g) || []).sort().join();
    assert.strictEqual(b, a, `placeholders differ for ${k}`);
  }
  assert.strictEqual(I18N.LEVEL_TITLES.en.length, I18N.LEVEL_TITLES.ar.length);
  I18N.set('ar');
  assert.strictEqual(I18N.t('sum.score', { a: 3, b: 5 }).replace(/[\u2066-\u2069]/g, ''), '3 / 5 إجابات صحيحة');
  I18N.set('en');
  assert.strictEqual(I18N.t('sum.score', { a: 3, b: 5 }), '3 / 5 correct');
});

test('school: 7 units, 21 lessons, every lesson is complete in both languages', () => {
  assert.strictEqual(S.UNITS.length, 7);
  assert.strictEqual(S.LESSONS.length, 21);
  for (const l of S.LESSONS) {
    assert.ok(l.title.en && ARABIC.test(l.title.ar), `${l.id}: title`);
    assert.ok(l.cards.length >= 3, `${l.id}: needs teaching cards`);
    assert.ok(l.cards.some((c) => c.example), `${l.id}: needs a worked example`);
    l.cards.forEach((c, i) => assert.ok(c.en && ARABIC.test(c.ar), `${l.id}: card ${i}`));
    assert.ok(l.checks.length >= 3, `${l.id}: needs concept checks`);
    l.checks.forEach((c) => assert.strictEqual(c.choices.en.length, c.choices.ar.length, `${l.id}: ${c.prompt.en}`));
    if (!l.practice.length) assert.ok(l.checks.length >= S.RULES.exerciseCount, `${l.id}: not enough checks for a full exercise set`);
    l.practice.forEach((ref) => assert.ok(S.resolvePractice(ref), `${l.id}: unknown practice generator ${ref}`));
  }
});

test('school: exercise sets and exams build valid questions', () => {
  for (const lang of ['en', 'ar']) {
    for (const l of S.LESSONS) {
      for (let i = 0; i < 20; i++) {
        const set = S.buildSet([l], S.RULES.exerciseCount, lang);
        assert.strictEqual(set.length, S.RULES.exerciseCount);
        set.forEach((q) => {
          assert.ok(q.choices.length >= 3 && q.correctIndex >= 0, `${l.id}: bad question`);
          assert.ok(!BROKEN.test(q.prompt + q.explanation), `${l.id}: broken text ${q.prompt}`);
          if (lang === 'ar') assert.ok(ARABIC.test(q.prompt), `${l.id}: prompt not Arabic`);
        });
        if (!l.practice.length) assert.strictEqual(new Set(set.map((q) => q.prompt)).size, set.length, `${l.id}: repeated check`);
      }
    }
    for (const u of S.UNITS) {
      const exam = S.buildSet(u.lessons, S.RULES.unitExamCount, lang);
      assert.strictEqual(exam.length, S.RULES.unitExamCount);
      u.lessons.forEach((l) => assert.ok(exam.some((q) => q.lessonId === l.id), `${u.id}: exam skips ${l.id}`));
    }
    const final = S.buildSet(S.LESSONS, S.RULES.finalCount, lang);
    assert.strictEqual(final.length, S.RULES.finalCount);
    assert.strictEqual(new Set(final.map((q) => q.lessonId)).size, Math.min(S.RULES.finalCount, S.LESSONS.length), 'final exam spreads across lessons');
  }
});

test('school generators are valid in both languages', () => {
  for (const [name, gen] of Object.entries(S.SCHOOL_GENERATORS)) {
    for (const ar of [false, true]) {
      for (let i = 0; i < RUNS; i++) {
        const raw = gen.make({ g: 10, easy: true, ar });
        checkNumeric(name, raw, Q.numeric('x', raw));
        if (ar) assert.ok(ARABIC.test(raw.prompt), `${name}: Arabic missing`);
      }
    }
  }
});

// ---------- worked explanations must add up ----------
// Every "numbers = result" step is recomputed from the numbers exactly as shown,
// so a student redoing the working by hand gets the same result as the game.
const SUPD = { '⁰': 0, '¹': 1, '²': 2, '³': 3, '⁴': 4, '⁵': 5, '⁶': 6, '⁷': 7, '⁸': 8, '⁹': 9 };
function evalShown(expr) {
  const e = expr
    .replace(/(\d(?:\.\d+)?) × 10(⁻?[⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g, (m, a, p) => `(${a}e${p.replace('⁻', '-').split('').map((c) => (c === '-' ? '-' : SUPD[c])).join('')})`)
    .replace(/(sin|cos) (\d+(?:\.\d+)?)°/g, (m, f, d) => `Math.${f}(${d}*Math.PI/180)`)
    .replace(/½/g, '0.5').replace(/√\(/g, 'Math.sqrt(').replace(/×|·/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/²/g, '**2')
    .replace(/%/g, '');
  if (!/^[\d\s.+\-*/()e]*(Math\.(sqrt|sin|cos|PI)[\d\s.+\-*/()e]*)*$/.test(e.replace(/Math\.(sqrt|sin|cos|PI)/g, '')) || !/\d/.test(e)) return null;
  try { const v = Function(`return (${e})`)(); return isFinite(v) ? v : null; } catch (x) { return null; }
}
function checkSteps(name, explanation) {
  const text = explanation.replace(/[⁦-⁩]/g, '');
  const parts = text.split('=');
  for (let k = 0; k < parts.length - 1; k++) {
    const lhs = parts[k].trim().replace(/^.*?(?=[\d(√½])/, '').replace(/\s*[A-Za-zΩ%][A-Za-z/²·Ω%]*\s*$/, '');
    const m = parts[k + 1].trim().match(/^(\d+(?:\.\d+)?(?: × 10⁻?[⁰¹²³⁴⁵⁶⁷⁸⁹]+)?)/);
    if (!m || !/[×÷\-−+/·²√]/.test(lhs)) continue;
    const a = evalShown(lhs), b = evalShown(m[1]);
    if (a === null || b === null) continue;
    // allowed error: rounding of the shown result to its last digit
    const mant = m[1].split(' ×')[0];
    const decimals = (mant.split('.')[1] || '').length;
    const scale = / × /.test(m[1]) ? b / Number(mant) : 1;
    const tol = 0.5 * Math.pow(10, -decimals) * scale * 1.001 + 1e-12;
    const scaled = /× 100$/.test(lhs.trim()) ? a : a; // efficiency already includes × 100
    assert.ok(Math.abs(scaled - b) <= tol, `${name}: "${lhs} = ${m[1]}" is really ${+a.toPrecision(6)}\n  in: ${explanation}`);
  }
}

test('worked explanations: every step adds up with the numbers shown', () => {
  const all = [];
  for (const gens of Object.values(Q.GENERATORS)) all.push(...gens);
  all.push(...Object.values(S.SCHOOL_GENERATORS));
  for (const gen of all) {
    for (let i = 0; i < 400; i++) {
      for (const g of [10, 9.8]) {
        const raw = gen.make({ g, easy: g === 10, ar: false });
        checkSteps(gen.make.name, raw.explanation);
        checkSteps(gen.make.name + ' (ar)', gen.make({ g, easy: g === 10, ar: true }).explanation);
      }
    }
  }
});

// ---------- calculator ----------
const C = require('../js/calculator.js');
const keys = (seq) => { const e = C.createEngine(); seq.split(' ').forEach((k) => e.press(k)); return e; };

test('calculator: key sequences work like a real school calculator', () => {
  const cases = [
    ['2 add 3 mul 4 eq', 14], // × before +
    ['( 2 add 3 ) mul 4 eq', 20],
    ['3 add 4 mul ( 2 add 3 ) eq', 23],
    ['2 ( 3 add 1 ) eq', 8], // 2(3+1) means 2 × (3+1)
    ['3 0 sin', 0.5], // number first, then the function
    ['0 . 5 2nd sin', 30],
    ['4 5 tan', 1],
    ['1 2 0 mul 1 6 mul 4 5 cos eq', 1920 * Math.SQRT1_2],
    ['2 pow 1 0 eq', 1024],
    ['8 2nd sqrt', 2], ['9 sqrt', 3], ['5 sq', 25], ['2 2nd sq', 8], ['4 inv', 0.25],
    ['4 . 7 ee 3', 4700], ['4 . 7 ee 3 neg', 0.0047],
    ['2 div 4 . 7 ee 3 eq', 2 / 4700], // EE belongs to the number
    ['1 ee 1 2 mul 1 ee 1 2 eq', 1e24],
    ['1 0 0 log', 2], ['2 2nd log', 100], ['1 ln', 0], ['0 2nd ln', 1],
    ['5 fact', 120], ['5 2nd fact 2 eq', 10],
    ['2 add 3 eq mul 2 eq', 10], // carry on from the result
    ['2 add mul 3 eq', 6], // change your mind about the operator
    ['5 0 0 add 1 0 2nd 2 eq', 550], // 500 + 10%
    ['7 sto onac rcl', 7],
    ['2 add 3 eq onac ans mul 2 eq', 10],
    ['1 8 0 2nd drg', Math.PI], // DRG▸ converts 180° to radians
    ['1 2 3 4 del', 123],
    ['6 sub 2 2nd pi eq', -4], // x⇄y swaps: 2 − 6
  ];
  for (const [seq, want] of cases) {
    const got = keys(seq).value();
    assert.ok(Math.abs(got - want) <= 1e-9 * Math.max(1, Math.abs(want)), `${seq} gave ${got}, expected ${want}`);
  }
  for (const seq of ['5 div 0 eq', '9 neg sqrt', '0 inv', '9 0 tan', '2 2nd sin', '0 log']) {
    const e = keys(seq);
    assert.ok(e.view().error && e.view().main === 'Error', `${seq} should show Error`);
    e.press('cec');
    assert.ok(!e.view().error, 'CE/C clears an error');
  }
});

test('calculator: display, modes and expression line', () => {
  let v = keys('1 . 5 ee 1 1').view();
  assert.deepStrictEqual([v.main, v.exp], ['1.5', '11']);
  v = keys('2 div 3 eq').view();
  assert.strictEqual(v.main, '0.666666667'); // 10 digits, like the real screen
  v = keys('2nd ee 2 2 div 3 eq').view(); // FIX 2
  assert.strictEqual(v.main, '0.67');
  v = keys('2nd 8 1 2 3 4 5 eq').view(); // SCI
  assert.deepStrictEqual([v.main, v.exp], ['1.2345', '04']);
  v = keys('2nd 9 1 2 3 4 5 eq').view(); // ENG: exponent is a multiple of 3
  assert.deepStrictEqual([v.main, v.exp], ['12.345', '03']);
  v = keys('1 ee 1 2 mul 1 ee 1 2 eq').view();
  assert.deepStrictEqual([v.main, v.exp], ['1', '24']);
  assert.strictEqual(keys('1 2 0 mul 1 6 mul 4 5 cos eq').view().line, '120 × 16 × cos(45) =');
  assert.strictEqual(keys('( 3 0 ) sin').view().line, 'sin(30)');
  assert.strictEqual(keys('drg').view().angle, 'RAD');
  assert.ok(keys('2nd').view().second);
  assert.ok(keys('7 sto').view().mem);
  assert.strictEqual(keys('( 1 add').view().parens, 1);
  for (const val of [1357.645, 1.5e11, 0.000314, 42]) {
    assert.ok(Math.abs(Q.parseAnswer(C.forAnswerBox(val)) - val) / val < 1e-5, `answer box text for ${val}`);
  }
});

// ---------- formula sheet ----------
const FS = require('../js/formulas.js');

test('formula sheet: every topic, every symbol explained with a unit, in both languages', () => {
  for (const t of Q.TOPICS) {
    const sec = FS.SECTIONS.find((x) => x.id === t.id);
    assert.ok(sec && sec.formulas.length >= 5, `formula sheet section for ${t.id}`);
  }
  for (const sy of Object.values(FS.SYMBOLS)) {
    assert.ok(sy.sym && sy.name.en && ARABIC.test(sy.name.ar), `symbol ${sy.id} needs a meaning in both languages`);
    assert.ok(typeof sy.unit === 'string', `symbol ${sy.id} needs a unit ('' for none)`);
  }
  const used = new Set();
  for (const sec of FS.SECTIONS) {
    for (const f of sec.formulas) {
      assert.ok(f.name.en && ARABIC.test(f.name.ar), `name for ${f.formula}`);
      if (f.tip) assert.ok(f.tip.en && ARABIC.test(f.tip.ar), `tip for ${f.formula}`);
      assert.ok(f.vars.length > 0, `${f.formula} lists its symbols`);
      for (const v of f.vars) {
        assert.ok(FS.SYMBOLS[v], `${f.formula}: unknown symbol id ${v}`);
        used.add(v);
        const base = FS.SYMBOLS[v].sym.split('_')[0];
        assert.ok(f.formula.includes(base), `${f.formula} lists ${FS.SYMBOLS[v].sym}, which isn't in the formula`);
      }
    }
  }
  for (const id of Object.keys(FS.SYMBOLS)) assert.ok(used.has(id), `symbol ${id} is never used on the sheet`);
  // every formula the game shows during questions appears on the sheet in some form
  const sheet = FS.SECTIONS.flatMap((s) => s.formulas.map((f) => f.formula + ' ' + (f.tip ? f.tip.en : ''))).join(' | ').replace(/\s/g, '');
  const missing = [];
  for (const gens of Object.values(Q.GENERATORS)) {
    for (const g of gens) {
      const main = g.formula.split(',')[0].replace(/\s/g, '');
      if (!sheet.includes(main)) missing.push(g.formula);
    }
  }
  assert.deepStrictEqual(missing, [], 'quiz formulas missing from the sheet');
});

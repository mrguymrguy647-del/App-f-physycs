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
  assert.ok(q.choices[q.correctIndex].startsWith(Q.fmt(q.answerValue)), `${name}: correct choice mismatch`);
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
  for (const t of Q.TOPICS) {
    assert.ok(Q.FORMULAS[t.id].length > 0, `no formulas for ${t.id}`);
    Q.FORMULAS[t.id].forEach(([, d]) => assert.ok(d.en && ARABIC.test(d.ar), `formula description missing: ${d.en}`));
  }
});

test('typed answers: parsing and 2% tolerance', () => {
  assert.strictEqual(Q.parseAnswer('12.5'), 12.5);
  assert.strictEqual(Q.parseAnswer(' 12,5 '), 12.5);
  assert.strictEqual(Q.parseAnswer('4.5e3'), 4500);
  assert.strictEqual(Q.parseAnswer('4.5 x 10^3'), 4500);
  assert.strictEqual(Q.parseAnswer('4.5×10^3'), 4500);
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
  assert.strictEqual(Q.fmt(12345), '12345');
  assert.strictEqual(Q.fmt(0.012345), '0.0123');
  assert.strictEqual(Q.fmt(1.5e11), '1.5 × 10¹¹');
  assert.strictEqual(Q.fmt(0.00042), '4.2 × 10⁻⁴');
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

test('school: 7 units, 20 lessons, every lesson is complete in both languages', () => {
  assert.strictEqual(S.UNITS.length, 7);
  assert.strictEqual(S.LESSONS.length, 20);
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
    assert.strictEqual(new Set(final.map((q) => q.lessonId)).size, 20, 'final exam covers every lesson');
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

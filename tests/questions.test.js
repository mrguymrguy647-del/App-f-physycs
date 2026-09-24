// Run with: npm test
const test = require('node:test');
const assert = require('node:assert');
const Q = require('../js/questions.js');

const RUNS = 300;

test('every generator produces 4 distinct choices with the correct answer included', () => {
  for (const [topic, gens] of Object.entries(Q.GENERATORS)) {
    for (const gen of gens) {
      for (const g of [10, 9.8]) {
        for (let i = 0; i < RUNS; i++) {
          const raw = gen.make({ g, easy: g === 10 });
          const q = Q.numeric(topic, raw);
          const name = gen.make.name;
          assert.strictEqual(q.choices.length, 4, `${name}: ${q.choices}`);
          assert.strictEqual(new Set(q.choices).size, 4, `${name}: duplicate choices ${q.choices}`);
          assert.ok(q.correctIndex >= 0 && q.correctIndex < 4);
          assert.ok(isFinite(q.answerValue) && q.answerValue > 0, `${name}: bad answer ${q.answerValue}`);
          assert.ok(q.choices[q.correctIndex].startsWith(Q.fmt(q.answerValue)), `${name}: correct choice mismatch`);
          assert.ok(!/NaN|undefined|Infinity/.test(raw.prompt + raw.explanation), `${name}: broken text: ${raw.prompt}`);
          if (g === 10) assert.ok(!/g = 9\.8/.test(raw.prompt + raw.explanation), `${name}: uses 9.8 when g = 10`);
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

test('conceptual questions keep the right answer after shuffling', () => {
  for (const [topic, list] of Object.entries(Q.CONCEPTS)) {
    for (const c of list) {
      for (let i = 0; i < 20; i++) {
        const q = Q.conceptual(topic, c);
        assert.strictEqual(q.choices[q.correctIndex], c.choices[0]);
        assert.strictEqual(new Set(q.choices).size, c.choices.length);
      }
    }
  }
});

test('generate() respects each difficulty', () => {
  for (const d of Q.DIFFICULTIES) {
    for (const t of Q.TOPICS) {
      for (let i = 0; i < 100; i++) {
        const q = Q.generate(t.id, d.id);
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
  for (const t of Q.TOPICS) assert.ok(Q.FORMULAS[t.id].length > 0, `no formulas for ${t.id}`);
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
  // free fall from 20 m: t = sqrt(2*20/9.8) ≈ 2.02 s
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

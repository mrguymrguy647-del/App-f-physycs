// Run with: npm test
const test = require('node:test');
const assert = require('node:assert');
const Q = require('../js/questions.js');

const RUNS = 300;

test('every generator produces 4 distinct choices with the correct answer included', () => {
  for (const [topic, gens] of Object.entries(Q.GENERATORS)) {
    for (const gen of gens) {
      for (let i = 0; i < RUNS; i++) {
        const q = Q.numeric(topic, gen());
        assert.strictEqual(q.choices.length, 4, `${gen.name}: ${q.choices}`);
        assert.strictEqual(new Set(q.choices).size, 4, `${gen.name}: duplicate choices ${q.choices}`);
        assert.ok(q.correctIndex >= 0 && q.correctIndex < 4);
        assert.ok(isFinite(q.answerValue) && q.answerValue > 0, `${gen.name}: bad answer ${q.answerValue}`);
        assert.ok(q.choices[q.correctIndex].startsWith(Q.fmt(q.answerValue)), `${gen.name}: correct choice mismatch`);
        assert.ok(q.prompt.length > 10 && q.explanation.length > 10);
      }
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

test('generate() works for every topic', () => {
  for (const t of Q.TOPICS) {
    for (let i = 0; i < 100; i++) {
      const q = Q.generate(t.id);
      assert.strictEqual(q.topic, t.id);
      assert.ok(q.choices.length >= 3);
    }
    assert.ok(Q.FORMULAS[t.id].length > 0, `no formulas for ${t.id}`);
  }
});

test('physics spot-checks', () => {
  // free fall from 20 m: t = sqrt(2*20/9.8) ≈ 2.02 s
  assert.strictEqual(Q.fmt(Math.sqrt((2 * 20) / Q.G)), '2.02');
  assert.strictEqual(Q.fmt(12345), '12345');
  assert.strictEqual(Q.fmt(0.012345), '0.0123');
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

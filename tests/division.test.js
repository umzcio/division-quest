// Run with: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../js/division.js');
const { LEVELS, makeLevelProblems } = require('../js/levels.js');

test('worksheet problem 0.25 ) 4,127 works out to 16,508', () => {
  const p = D.makeProblem(25, 2, 16508, 0);
  assert.equal(p.divisorText, '0.25');
  assert.equal(p.dividendText, '4127');
  assert.equal(p.dividendDisplay, '4,127');
  assert.deepEqual(p.board, { digits: '412700', point: 6 });
  assert.equal(p.solution.firstCol, 1); // 25 doesn't fit into 4, so the first digit sits above the 1 in 41
  assert.deepEqual(p.solution.cycles.map(c => c.digit), [1, 6, 5, 0, 8]);
  assert.deepEqual(p.solution.cycles.map(c => c.partial), [41, 162, 127, 20, 200]);
  assert.equal(p.solution.quotient, '16508');
  assert.equal(p.solution.remainder, 0);
});

test('shifting adds zeros and normalizing drops leading zeros', () => {
  assert.deepEqual(D.shiftNumber(D.parseNumber('4127'), 2), { digits: '412700', point: 6 });
  assert.deepEqual(D.normalizeNumber(D.shiftNumber(D.parseNumber('0.75'), 2)), { digits: '75', point: 2 });
  assert.deepEqual(D.shiftNumber(D.parseNumber('3.96'), 1), { digits: '396', point: 2 });
});

test('decimal answers keep the decimal straight above', () => {
  const p = D.makeProblem(12, 1, 33, 1); // 1.2 ) 3.96 -> 12 ) 39.6
  assert.equal(p.divisorText, '1.2');
  assert.equal(p.dividendText, '3.96');
  assert.equal(D.numberToString(p.board), '39.6');
  assert.equal(p.solution.quotient, '3.3');
});

test('formatScaled', () => {
  assert.equal(D.formatScaled(25, 2), '0.25');
  assert.equal(D.formatScaled(5, 2), '0.05');
  assert.equal(D.formatScaled(412700, 2), '4127');
  assert.equal(D.formatScaled(735, 2), '7.35');
});

test('every level generates problems that come out even and match the answer', () => {
  let seed = 42;
  const rng = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  LEVELS.forEach((level, i) => {
    for (let round = 0; round < 60; round++) {
      for (const p of makeLevelProblems(i, rng)) {
        const label = `${level.id}: ${p.divisorText} ) ${p.dividendText}`;
        assert.equal(p.solution.remainder, 0, label);
        assert.equal(p.solution.quotient, p.answerText, label);
        assert.ok(Math.abs(Number(p.answerText) * Number(p.divisorText) - Number(p.dividendText)) < 1e-9, label);
        assert.ok(p.solution.firstCol < p.board.point, `${label}: answer must be at least 1`);
        assert.notEqual(p.board.digits[0], '0', label);
        assert.equal(p.solution.cycles[0].digit > 0, true, label);
      }
    }
  });
});

test('zero-trap level always has a 0 in the answer', () => {
  for (let i = 0; i < 50; i++) {
    for (const p of makeLevelProblems(2)) assert.match(p.answerText.slice(1), /0/);
  }
});

test('boss level starts with the worksheet problem', () => {
  const [first] = makeLevelProblems(LEVELS.findIndex(l => l.id === 'boss'));
  assert.equal(first.divisorText, '0.25');
  assert.equal(first.dividendDisplay, '4,127');
});

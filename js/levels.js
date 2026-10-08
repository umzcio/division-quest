/* Level definitions: each level knows how to generate a fresh problem. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./division.js'));
  else root.Levels = factory(root.Division);
})(typeof self !== 'undefined' ? self : this, function (Division) {
  'use strict';

  const make = Division.makeProblem;
  const randInt = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
  const pick = (rng, list) => list[Math.floor(rng() * list.length)];

  // Keep drawing until the value passes the check.
  function draw(gen, ok) {
    for (let i = 0; i < 1000; i++) {
      const v = gen();
      if (ok(v)) return v;
    }
    throw new Error('Could not generate a valid problem');
  }

  const LEVELS = [
    {
      id: 'warmup',
      name: 'Warm Up',
      blurb: 'One-digit divisors, small numbers.',
      make: rng => make(randInt(rng, 2, 9), 0, randInt(rng, 11, 99), 0),
    },
    {
      id: 'bigger',
      name: 'Bigger Numbers',
      blurb: 'Longer dividends, more steps.',
      make: rng => make(randInt(rng, 3, 9), 0, draw(() => randInt(rng, 112, 999), q => !/0/.test(q)), 0),
    },
    {
      id: 'zeros',
      name: 'Zero Traps',
      blurb: 'Sometimes the answer digit is 0. Don’t skip it!',
      make: rng => make(randInt(rng, 2, 9), 0, draw(() => randInt(rng, 102, 4999), q => /0/.test(String(q).slice(1))), 0),
    },
    {
      id: 'two-digit',
      name: 'Two-Digit Divisors',
      blurb: 'Estimate with bigger divisors like 12, 25, 35.',
      make: rng => make(pick(rng, [11, 12, 13, 14, 15, 16, 18, 21, 24, 25, 32, 35, 45]), 0, randInt(rng, 12, 399), 0),
    },
    {
      id: 'decimal-dividend',
      name: 'Decimals Inside',
      blurb: 'The decimal point goes straight up.',
      make: rng => {
        const d = randInt(rng, 2, 9);
        const places = pick(rng, [1, 2]);
        const q = draw(() => randInt(rng, places === 1 ? 11 : 101, 999), q => (q * d) % 10 !== 0);
        return make(d, 0, q, places);
      },
    },
    {
      id: 'decimal-divisor',
      name: 'Decimal Divisors',
      blurb: 'Move the decimal to make the divisor whole.',
      make: rng => {
        // [divisor digits, decimal places]: 0.5, 0.2, 0.4, 0.8, 2.5, 1.5, 1.2, 0.25, 0.05, 0.04, 0.75
        const [d, shift] = pick(rng, [[5, 1], [2, 1], [4, 1], [8, 1], [25, 1], [15, 1], [12, 1], [25, 2], [5, 2], [4, 2], [75, 2]]);
        return make(d, shift, randInt(rng, 12, 999), 0);
      },
    },
    {
      id: 'boss',
      name: 'Boss Level',
      blurb: 'Worksheet-style problems like 0.25 ) 4,127.',
      first: () => make(25, 2, 16508, 0),
      make: rng => {
        if (rng() < 0.6) {
          const [d, shift] = pick(rng, [[25, 2], [75, 2], [12, 2], [15, 2], [125, 3]]);
          return make(d, shift, randInt(rng, 1000, 19999), 0);
        }
        // decimal divisor AND decimal answer, e.g. 1.2 ) 3.96 = 3.3
        const [d, shift] = pick(rng, [[12, 1], [15, 1], [25, 1], [35, 1], [6, 1]]);
        const q = draw(() => randInt(rng, 11, 999), q => (q * d) % 10 !== 0);
        return make(d, shift, q, 1);
      },
    },
  ];

  function makeLevelProblems(levelIndex, rng = Math.random, count = 5) {
    const level = LEVELS[levelIndex];
    const problems = level.first ? [level.first()] : [];
    const seen = new Set(problems.map(p => p.divisorText + ')' + p.dividendText));
    while (problems.length < count) {
      const p = level.make(rng);
      const key = p.divisorText + ')' + p.dividendText;
      if (seen.has(key)) continue;
      seen.add(key);
      problems.push(p);
    }
    return problems;
  }

  return { LEVELS, makeLevelProblems };
});

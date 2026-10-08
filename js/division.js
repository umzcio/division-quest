/* Long division engine: pure functions, no DOM. Shared by the game (window.Division) and the tests (require). */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Division = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // A number is kept as its digits plus where the decimal point sits:
  //   "0.25" -> { digits: '025', point: 1 }     "4127" -> { digits: '4127', point: 4 }
  function parseNumber(text) {
    const clean = String(text).replace(/,/g, '');
    const dot = clean.indexOf('.');
    if (dot === -1) return { digits: clean, point: clean.length };
    return { digits: clean.slice(0, dot) + clean.slice(dot + 1), point: dot };
  }

  // Move the decimal point `places` to the right, adding zeros on the end when we run out of digits.
  function shiftNumber(num, places) {
    const point = num.point + places;
    return { digits: num.digits.padEnd(point, '0'), point };
  }

  // Drop leading zeros ("075" -> "75") so the board starts at the first real digit.
  function normalizeNumber(num) {
    let { digits, point } = num;
    while (point > 1 && digits[0] === '0') {
      digits = digits.slice(1);
      point--;
    }
    return { digits, point };
  }

  function numberToString(num, withCommas) {
    let intPart = num.digits.slice(0, num.point) || '0';
    const frac = num.digits.slice(num.point);
    if (withCommas) intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return frac ? intPart + '.' + frac : intPart;
  }

  // formatScaled(25, 2) -> "0.25". Trailing zeros after the decimal point are dropped.
  function formatScaled(n, places) {
    if (places === 0) return String(n);
    const s = String(n).padStart(places + 1, '0');
    const intPart = s.slice(0, -places);
    const frac = s.slice(-places).replace(/0+$/, '');
    return frac ? intPart + '.' + frac : intPart;
  }

  // Work a long division the way it's done on paper. Each cycle is one Divide/Multiply/Subtract
  // round; `col` is the dividend column the answer digit sits above.
  function solve(divisor, num) {
    const ds = num.digits.split('').map(Number);
    let col = 0;
    let partial = ds[0];
    while (partial < divisor && col < ds.length - 1) partial = partial * 10 + ds[++col];
    const firstCol = col;

    const cycles = [];
    for (;;) {
      const digit = Math.floor(partial / divisor);
      const product = digit * divisor;
      cycles.push({ col, partial, digit, product, remainder: partial - product });
      if (col === ds.length - 1) break;
      partial = (partial - product) * 10 + ds[++col];
    }

    const intDigits = cycles.filter(c => c.col < num.point).map(c => c.digit).join('') || '0';
    const fracDigits = cycles.filter(c => c.col >= num.point).map(c => c.digit).join('');
    return {
      firstCol,
      cycles,
      remainder: cycles[cycles.length - 1].remainder,
      quotient: fracDigits ? intDigits + '.' + fracDigits : intDigits,
    };
  }

  // Build a problem backwards from its answer so it always divides evenly.
  //   divisor = divisorInt / 10^shift, answer = quotientInt / 10^quotientPlaces
  // e.g. makeProblem(25, 2, 16508, 0) is 0.25 ) 4,127 = 16,508
  function makeProblem(divisorInt, shift, quotientInt, quotientPlaces) {
    const dividendText = formatScaled(quotientInt * divisorInt, quotientPlaces + shift);
    const board = normalizeNumber(shiftNumber(parseNumber(dividendText), shift));
    return {
      divisorText: formatScaled(divisorInt, shift),
      dividendText,
      dividendDisplay: numberToString(parseNumber(dividendText), true),
      answerText: formatScaled(quotientInt, quotientPlaces),
      shift,
      divisorInt,
      board,
      solution: solve(divisorInt, board),
    };
  }

  return { parseNumber, shiftNumber, normalizeNumber, numberToString, formatScaled, solve, makeProblem };
});

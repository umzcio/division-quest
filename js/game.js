/* Division Quest UI: level map, the step-by-step long division board, keyboard + mouse input. */
(function () {
  'use strict';

  const { LEVELS, makeLevelProblems } = window.Levels;
  const { parseNumber, shiftNumber, numberToString } = window.Division;
  const Progress = window.Progress;

  const MISTAKE_LABELS = {
    shift: 'Moving the decimal (divisor → whole number)',
    point: 'Putting the decimal point on top',
    place: 'Where the answer digit goes on top',
    divide: 'Divide: how many times does it fit?',
    multiply: 'Multiply',
    subtract: 'Subtract',
    bring: 'Bring down',
    hint: 'Problems where the times-table helper was used',
  };
  const PRAISE = ['Nice!', 'Yes!', 'Correct!', 'You got it!', 'Great!', 'Exactly!'];

  const app = document.getElementById('app');
  let progress = Progress.load();
  let screen = 'map'; // 'map' | 'play' | 'levelDone'
  let S = null; // everything about the level currently being played
  let resetArmed = false;
  let grownupsOpen = false;

  // ---------- small helpers ----------
  const praise = () => PRAISE[Math.floor(Math.random() * PRAISE.length)];
  const commas = text => numberToString(parseNumber(text), true);
  const starsFor = cost => (cost === 0 ? 3 : cost <= 2 ? 2 : 1);
  const starSpans = n => [0, 1, 2].map(i => `<span class="star ${i < n ? 'on' : ''}">★</span>`).join('');
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const cycle = () => S.sol.cycles[S.cycle];
  const lastCol = () => S.board.digits.length - 1;
  const boardText = () => numberToString(S.board, true);
  const prefixValue = col => Number(S.board.digits.slice(0, col + 1));
  const hasPoint = () => S.board.point < S.board.digits.length;

  // ---------- game flow ----------
  function startLevel(levelIndex) {
    S = { levelIndex, problems: makeLevelProblems(levelIndex), problemIndex: 0, stars: [] };
    screen = 'play';
    startProblem();
  }

  function startProblem() {
    const p = S.problems[S.problemIndex];
    Object.assign(S, {
      p,
      D: p.divisorInt,
      board: p.board,
      sol: p.solution,
      phase: 'shift',
      shiftPos: 0,
      cycle: 0,
      quotient: {},
      pointPlaced: false,
      rows: [], // work rows under the dividend: { text, right, kind: 'product' | 'diff', lineFrom }
      partialRow: -1, // which row holds the number we're dividing into (-1 = the dividend itself)
      brought: new Set(),
      cursor: null,
      input: '',
      mistakes: 0,
      stepMistakes: 0,
      helperUsed: false,
      helperOpen: false,
      feedback: null,
      anim: null,
      earned: 0,
    });
    if (p.shift === 0) afterShift();
  }

  function goTo(phase) {
    S.phase = phase;
    S.stepMistakes = 0;
    S.input = '';
    S.cursor = null;
  }

  function say(text, tone) {
    S.feedback = { text, tone };
  }

  // Two misses on the same step and we show the answer, so nobody gets stuck.
  function mistake(type, msg, reveal) {
    S.mistakes++;
    S.stepMistakes++;
    progress.mistakes[type] = (progress.mistakes[type] || 0) + 1;
    Progress.save(progress);
    if (S.stepMistakes >= 2) reveal();
    else say(`${msg} Try again!`, 'oops');
  }

  function afterShift() {
    goTo(hasPoint() ? 'point' : 'divide');
  }

  // Step 0: hop the decimal point until the divisor is whole.
  function moveShift(delta) {
    S.shiftPos = Math.max(0, Math.min(S.p.shift + 2, S.shiftPos + delta));
    S.feedback = null;
  }

  function checkShift() {
    const k = S.p.shift;
    if (S.shiftPos === k) {
      say(`${praise()} ${S.p.divisorText} became ${S.D}, and ${S.p.dividendDisplay} became ${boardText()}.`, 'good');
      afterShift();
    } else if (S.shiftPos < k) {
      mistake('shift', 'The divisor still has a decimal part. Keep hopping the decimal point to the right.', revealShift);
    } else {
      mistake('shift', 'Too far! Stop as soon as the divisor is a whole number.', revealShift);
    }
  }

  function revealShift() {
    const k = S.p.shift;
    S.shiftPos = k;
    say(`Let's do it together: ${S.p.divisorText} has ${plural(k, 'digit')} after the decimal point, so hop ${plural(k, 'place')}. ` +
      `${S.p.divisorText} → ${S.D}, and the dividend hops the same: ${S.p.dividendDisplay} → ${boardText()}.`, 'reveal');
    afterShift();
  }

  // The decimal point goes straight up before dividing.
  function placePoint(col) {
    if (col === S.board.point - 1) {
      S.pointPlaced = true;
      say(`${praise()} The decimal point goes straight up. Now divide like normal.`, 'good');
      goTo('divide');
    } else {
      mistake('point', 'The decimal point on top has to be straight above the decimal point in the dividend.', () => {
        S.pointPlaced = true;
        say("Here it is: right above the dividend's decimal point. Now divide like normal.", 'reveal');
        goTo('divide');
      });
    }
  }

  // Divide: the kid picks the column on top, then types the digit.
  function typeDivide(d) {
    const c = cycle();
    if (S.cursor === null) {
      say('First click the box on top where this answer digit goes.', 'info');
      return;
    }
    if (S.cursor !== c.col) {
      let msg;
      if (S.cycle === 0 && S.cursor < c.col) msg = `${S.D} doesn't fit into ${prefixValue(S.cursor)}. Include the next digit too.`;
      else if (S.cycle === 0) msg = `Too far right. Find the smallest number from the left that ${S.D} fits into, and write the digit above its last digit.`;
      else msg = 'The answer digit goes right above the digit you just brought down.';
      mistake('place', msg, revealDivide);
      return;
    }
    if (d !== c.digit) {
      const msg = d * S.D > c.partial
        ? `Too big: ${d} × ${S.D} = ${d * S.D}, which is more than ${c.partial}.`
        : `Too small: ${d + 1} × ${S.D} = ${(d + 1) * S.D} still fits into ${c.partial}.`;
      mistake('divide', msg, revealDivide);
      return;
    }
    acceptDivide(`${praise()} `, 'good');
  }

  function revealDivide() {
    const c = cycle();
    acceptDivide(`Let's look together: ${S.D} fits into ${c.partial} ${plural(c.digit, 'time')} ` +
      `(${c.digit} × ${S.D} = ${c.product}), so ${c.digit} goes above the last digit of ${c.partial}. `, 'reveal');
  }

  function acceptDivide(note, tone) {
    const c = cycle();
    S.quotient[c.col] = c.digit;
    S.anim = { kind: 'quotient', col: c.col };
    if (c.digit !== 0) {
      say(note, tone);
      goTo('multiply');
      return;
    }
    const zeroNote = `${S.D} doesn't fit into ${c.partial}, so the answer digit is 0. `;
    if (c.col === lastCol()) {
      finish();
      return;
    }
    say(`${note}${zeroNote}Nothing to subtract (0 × ${S.D} = 0), so go straight to bringing down the next digit.`, tone);
    goTo('bring');
  }

  function submitNumber() {
    if (!S.input) return;
    const v = Number(S.input);
    const c = cycle();
    S.input = '';
    if (S.phase === 'multiply') {
      if (v === c.product) acceptMultiply(praise(), 'good');
      else mistake('multiply', `Not quite. Check ${c.digit} × ${S.D} again.`,
        () => acceptMultiply(`Here's the answer: ${c.digit} × ${S.D} = ${c.product}.`, 'reveal'));
    } else {
      if (v === c.remainder) acceptSubtract(praise(), 'good');
      else mistake('subtract', `Not quite. Line up the columns and do ${c.partial} − ${c.product} again.`,
        () => acceptSubtract(`Here's the answer: ${c.partial} − ${c.product} = ${c.remainder}.`, 'reveal'));
    }
  }

  function acceptMultiply(note, tone) {
    const c = cycle();
    const width = Math.max(String(c.partial).length, String(c.product).length);
    S.rows.push({ text: String(c.product), right: c.col, kind: 'product', lineFrom: c.col - width + 1 });
    say(note, tone);
    goTo('subtract');
  }

  function acceptSubtract(note, tone) {
    const c = cycle();
    S.rows.push({ text: String(c.remainder), right: c.col, kind: 'diff' });
    if (c.col === lastCol()) {
      finish();
      return;
    }
    say(`${note} Now bring down the next digit.`, tone);
    goTo('bring');
  }

  function bringDown(col) {
    const next = cycle().col + 1;
    if (col === next) doBring(praise(), 'good');
    else mistake('bring', 'Bring down the very next digit: the one right after the last digit you used.',
      () => doBring(`Here it is: bring down the ${S.board.digits[next]}.`, 'reveal'));
  }

  function doBring(note, tone) {
    const c = cycle();
    const next = c.col + 1;
    const row = S.rows[S.rows.length - 1];
    // After a 0 answer digit nothing was subtracted, so remainder === partial and this still works.
    row.text = String(c.remainder * 10 + Number(S.board.digits[next]));
    row.right = next;
    S.partialRow = S.rows.length - 1;
    S.brought.add(next);
    S.anim = { kind: 'drop', row: S.rows.length - 1, col: next };
    S.cycle++;
    say(note, tone);
    goTo('divide');
  }

  function finish() {
    S.earned = starsFor(S.mistakes + (S.helperUsed ? 1 : 0));
    S.stars.push(S.earned);
    S.phase = 'done';
    S.cursor = null;
    S.helperOpen = false;
    S.feedback = null;
  }

  function nextProblem() {
    if (S.problemIndex + 1 < S.problems.length) {
      S.problemIndex++;
      startProblem();
      return;
    }
    const level = LEVELS[S.levelIndex];
    const total = S.stars.reduce((a, b) => a + b, 0);
    progress.best[level.id] = Math.max(progress.best[level.id] || 0, total);
    progress.unlocked = Math.max(progress.unlocked, Math.min(LEVELS.length, S.levelIndex + 2));
    Progress.save(progress);
    screen = 'levelDone';
  }

  function toggleHelper() {
    S.helperOpen = !S.helperOpen;
    if (S.helperOpen && !S.helperUsed) {
      S.helperUsed = true;
      progress.mistakes.hint = (progress.mistakes.hint || 0) + 1;
      Progress.save(progress);
    }
  }

  // ---------- rendering: level map ----------
  function renderMap() {
    const cards = LEVELS.map((level, i) => {
      const locked = i >= progress.unlocked;
      const best = progress.best[level.id];
      const status = locked ? 'Locked' : best != null ? `★ ${best} / 15` : 'New!';
      return `
        <button class="level-card ${locked ? 'locked' : ''} ${best != null ? 'played' : ''}" data-act="level" data-level="${i}" ${locked ? 'disabled' : ''}>
          <span class="level-num">${locked ? '🔒' : i + 1}</span>
          <span class="level-name">${level.name}</span>
          <span class="level-blurb">${level.blurb}</span>
          <span class="level-status">${status}</span>
        </button>`;
    }).join('');

    return `
      <div class="map">
        <header class="hero">
          <p class="eyebrow">Long division practice</p>
          <h1>Division Quest</h1>
          <p class="hero-sub">Beat a level to unlock the next one. Fewer mistakes means more stars.</p>
        </header>
        <div class="levels">${cards}</div>
        ${grownupsHTML()}
      </div>`;
  }

  function grownupsHTML() {
    const entries = Object.keys(MISTAKE_LABELS).map(k => [k, progress.mistakes[k] || 0]);
    const max = Math.max(1, ...entries.map(e => e[1]));
    const any = entries.some(e => e[1] > 0);
    const bars = entries.map(([k, v]) => `
      <li>
        <span class="bar-label">${MISTAKE_LABELS[k]}</span>
        <span class="bar"><span style="width:${(v / max) * 100}%"></span></span>
        <span class="bar-val">${v}</span>
      </li>`).join('');
    return `
      <details class="grownups" ${grownupsOpen ? 'open' : ''}>
        <summary>For grown-ups: where do the mistakes happen?</summary>
        ${any ? `<ul class="bars">${bars}</ul>` : '<p class="muted">No data yet. Play a few problems first.</p>'}
        <button class="btn ghost small" data-act="reset">${resetArmed ? 'Click again to erase all progress' : 'Reset progress'}</button>
      </details>`;
  }

  // ---------- rendering: level complete ----------
  function renderLevelDone() {
    const level = LEVELS[S.levelIndex];
    const total = S.stars.reduce((a, b) => a + b, 0);
    const hasNext = S.levelIndex + 1 < LEVELS.length;
    return `
      <div class="level-done">
        <p class="eyebrow">Level ${S.levelIndex + 1} complete</p>
        <h1>${level.name}</h1>
        <div class="level-done-stars">${S.stars.map(n => `<div class="mini-stars">${starSpans(n)}</div>`).join('')}</div>
        <p class="total">★ ${total} of ${S.stars.length * 3}</p>
        ${hasNext ? '' : '<p class="trophy">🏆 You beat the Boss Level!</p>'}
        <div class="actions">
          ${hasNext ? `<button class="btn primary" data-act="level" data-level="${S.levelIndex + 1}">Next level →</button>` : ''}
          <button class="btn" data-act="level" data-level="${S.levelIndex}">Play again</button>
          <button class="btn ghost" data-act="map">All levels</button>
        </div>
      </div>`;
  }

  // ---------- rendering: playing a problem ----------
  function renderPlay() {
    const level = LEVELS[S.levelIndex];
    const soFar = S.stars.reduce((a, b) => a + b, 0);
    const fb = S.feedback;
    return `
      <div class="play">
        <header class="topbar">
          <button class="btn ghost" data-act="map">← Levels</button>
          <div class="topbar-title"><span class="eyebrow">Level ${S.levelIndex + 1}</span>${level.name}</div>
          <div class="topbar-meta">Problem ${S.problemIndex + 1} of ${S.problems.length}<span class="star-count">★ ${soFar}</span></div>
        </header>
        ${trackerHTML()}
        ${S.phase === 'done' ? doneHTML() : `<div class="prompt">${promptHTML()}</div>`}
        <div class="feedback ${fb ? fb.tone : 'empty'}" aria-live="polite">${fb ? fb.text : ''}</div>
        <div class="workspace">
          <section class="board-card">
            <div class="problem-label">${S.p.divisorText} ) ${S.p.dividendDisplay}</div>
            ${S.phase === 'shift' ? shiftHTML() : boardHTML()}
            ${entryHTML()}
          </section>
          ${helperHTML()}
        </div>
      </div>`;
  }

  function trackerHTML() {
    const steps = [];
    if (S.p.shift > 0) steps.push(['shift', 'Move the decimal']);
    if (hasPoint()) steps.push(['point', 'Decimal point up']);
    steps.push(['divide', 'Divide'], ['multiply', 'Multiply'], ['subtract', 'Subtract'], ['bring', 'Bring down']);
    return `
      <div class="tracker-wrap">
        <ol class="tracker">${steps.map(([k, label]) => `<li class="${S.phase === k ? 'on' : ''} ${k === 'shift' || k === 'point' ? 'pre' : ''}">${label}</li>`).join('')}</ol>
        <p class="mnemonic"><b>D</b>oes <b>M</b>cDonald's <b>S</b>ell <b>B</b>urgers?</p>
      </div>`;
  }

  function promptHTML() {
    const D = S.D;
    const c = cycle();
    switch (S.phase) {
      case 'shift':
        return `<b>Step 0: make the divisor a whole number.</b> Hop the decimal point in ${S.p.divisorText} to the right with <kbd>→</kbd>. ` +
          `The dividend's decimal point hops the same amount. Press <kbd>Enter</kbd> when the divisor is a whole number.`;
      case 'point':
        return `<b>Decimal point first.</b> Click the spot on top that is straight above the decimal point in ${boardText()}.`;
      case 'divide':
        return S.cycle === 0
          ? `<b>Divide.</b> Starting from the left of ${boardText()}, find the smallest number that ${D} fits into. ` +
            `Click the box on top above its last digit, then type how many times ${D} fits.`
          : `<b>Divide.</b> How many times does ${D} fit into <span class="hl-text">${c.partial}</span>? Click its box on top, then type the digit.`;
      case 'multiply':
        return `<b>Multiply.</b> ${c.digit} × ${D} = ? Type it and press <kbd>Enter</kbd>.`;
      case 'subtract':
        return `<b>Subtract.</b> ${c.partial} − ${c.product} = ? Type it and press <kbd>Enter</kbd>.`;
      case 'bring':
        return `<b>Bring down.</b> Click the next digit of ${boardText()} to bring it down.`;
      default:
        return '';
    }
  }

  function doneHTML() {
    const titles = { 3: 'Perfect!', 2: 'Great work!', 1: 'You solved it!' };
    const last = S.problemIndex + 1 === S.problems.length;
    const meta = [S.mistakes === 0 ? 'No mistakes' : plural(S.mistakes, 'mistake')];
    if (S.helperUsed) meta.push('used the helper');
    return `
      <div class="done-panel">
        <div class="done-stars">${starSpans(S.earned)}</div>
        <div class="done-text">
          <h2>${titles[S.earned]} The answer is ${commas(S.p.answerText)}.</h2>
          <p class="check">Check by multiplying: ${commas(S.p.answerText)} × ${S.p.divisorText} = ${S.p.dividendDisplay} ✓</p>
          <p class="muted">${meta.join(' · ')}</p>
        </div>
        <button class="btn primary" data-act="next">${last ? 'Finish level' : 'Next problem'} →</button>
      </div>`;
  }

  function entryHTML() {
    switch (S.phase) {
      case 'divide':
        return '<p class="entry-hint">Click a box on top (or use <kbd>←</kbd> <kbd>→</kbd>), then type a digit.</p>';
      case 'multiply':
      case 'subtract':
        return `<div class="entry-hint">Type the number, <kbd>Backspace</kbd> to fix it, <kbd>Enter</kbd> to check.
          <button class="btn small primary" data-act="submit" ${S.input ? '' : 'disabled'}>Check ✓</button></div>`;
      default:
        return '';
    }
  }

  function helperHTML() {
    if (S.phase === 'shift' || S.phase === 'done') return '';
    const list = Array.from({ length: 9 }, (_, i) => `<li><span>${i + 1} × ${S.D}</span><b>${(i + 1) * S.D}</b></li>`).join('');
    return `
      <aside class="helper">
        <button class="btn ${S.helperOpen ? '' : 'soft'}" data-act="helper">${S.helperOpen ? 'Hide helper' : '🧮 Times-table helper'}</button>
        ${S.helperOpen
          ? `<ol class="multiples">${list}</ol>`
          : `<p class="helper-note">Stuck on "how many times?" Peek at the ${S.D}s. Using it makes this problem worth 2 stars max.</p>`}
      </aside>`;
  }

  // Step 0 view: the original problem with a decimal point that hops.
  function shiftHTML() {
    const pos = S.shiftPos;
    const dv = parseNumber(S.p.divisorText);
    const dd = parseNumber(S.p.dividendText);
    const note = pos === 0
      ? 'Tip: a whole number has a hidden decimal point at its end.'
      : `Hopped ${plural(pos, 'place')}: both numbers ×${(10 ** pos).toLocaleString()}. Same answer, easier problem!`;
    return `
      <div class="shift-stage">
        <div class="shift-problem">
          <div class="shift-divisor">${numberHTML(shiftNumber(dv, pos), dv.digits.length)}</div>
          <div class="shift-dividend">${numberHTML(shiftNumber(dd, pos), dd.digits.length)}</div>
        </div>
        <p class="shift-note">${note}</p>
        <div class="shift-controls">
          <button class="btn" data-act="shift-left" ${pos === 0 ? 'disabled' : ''}>◀ Back</button>
          <button class="btn" data-act="shift-right" ${pos >= S.p.shift + 2 ? 'disabled' : ''}>Hop ▶</button>
          <button class="btn primary" data-act="shift-done">Done ✓</button>
        </div>
      </div>`;
  }

  function numberHTML(num, originalLength) {
    let html = '';
    for (let i = 0; i < num.digits.length; i++) {
      html += `<span class="sd ${i >= originalLength ? 'added' : ''}">${num.digits[i]}</span>`;
      if (i === num.point - 1) html += `<span class="sdot ${i === num.digits.length - 1 ? 'end' : ''}">.</span>`;
    }
    return html;
  }

  // The graph-paper board. Row 0 = answer, row 1 = dividend, rows 2+ = work. Column -1 is the gutter.
  function boardHTML() {
    const { digits, point } = S.board;
    const n = digits.length;
    const live = S.phase === 'multiply' || S.phase === 'subtract';
    const c = S.phase === 'done' ? null : cycle();
    const rows = S.rows.slice();
    if (live) {
      const width = Math.max(String(c.partial).length, String(c.product).length);
      rows.push({ text: S.input, right: c.col, kind: S.phase === 'multiply' ? 'product' : 'diff', lineFrom: c.col - width + 1, live: true });
    }

    const total = 2 + rows.length + 1;
    const grid = Array.from({ length: total }, () => ({}));
    const cellAt = (r, col) => (grid[r][col] = grid[r][col] || { content: '', cls: [], attrs: '' });

    // Answer row
    for (let col = 0; col < n; col++) {
      const cell = cellAt(0, col);
      cell.cls.push('q');
      if (S.quotient[col] !== undefined) cell.content = String(S.quotient[col]);
      if (S.phase === 'divide') {
        cell.cls.push('pickable');
        cell.attrs = `data-act="cursor" data-col="${col}"`;
        if (S.cursor === col) cell.cls.push('cursor');
      }
      if (S.anim && S.anim.kind === 'quotient' && S.anim.col === col) cell.cls.push('pop');
      if (S.pointPlaced && col === point - 1) cell.content += '<span class="dot"></span>';
      if (S.phase === 'point' && col < n - 1) {
        cell.content += `<button class="dot-target" data-act="point" data-col="${col}" aria-label="Decimal point after column ${col + 1}"></button>`;
      }
    }

    // Dividend row
    const nextBring = c ? c.col + 1 : -1;
    for (let col = 0; col < n; col++) {
      const cell = cellAt(1, col);
      cell.content = digits[col];
      cell.cls.push('dd');
      if (hasPoint() && col === point - 1) cell.content += '<span class="dot"></span>';
      if (S.brought.has(col)) cell.cls.push('used');
      if (S.phase === 'bring') {
        cell.cls.push('bringable');
        cell.attrs = `data-act="bring" data-col="${col}"`;
        if (S.stepMistakes > 0 && col === nextBring) cell.cls.push('glow');
      }
    }

    // Work rows
    rows.forEach((row, i) => {
      const r = 2 + i;
      const start = row.right - row.text.length + 1;
      for (let j = 0; j < row.text.length; j++) cellAt(r, start + j).content = row.text[j];
      if (row.kind === 'product') {
        for (let col = row.lineFrom; col <= row.right; col++) cellAt(r, col).cls.push('line');
        cellAt(r, Math.min(start, row.lineFrom) - 1).content = '−';
        cellAt(r, Math.min(start, row.lineFrom) - 1).cls.push('minus');
      }
      if (row.live) for (let col = row.lineFrom; col <= row.right; col++) cellAt(r, col).cls.push('live');
      if (S.anim && S.anim.kind === 'drop' && S.anim.row === i) cellAt(r, S.anim.col).cls.push('drop');
    });

    // Highlight the number we're dividing into
    const showPartial = c && (live || (S.phase === 'divide' && S.cycle > 0));
    if (showPartial) {
      const r = S.partialRow === -1 ? 1 : 2 + S.partialRow;
      for (let col = c.col - String(c.partial).length + 1; col <= c.col; col++) cellAt(r, col).cls.push('hl');
    }

    let html = '';
    for (let r = 0; r < total; r++) {
      for (let col = -1; col < n; col++) {
        const cell = grid[r][col] || { content: '', cls: [], attrs: '' };
        if (col === -1) {
          const content = r === 1 ? String(S.D) : cell.content;
          html += `<div class="gutter ${r === 1 ? 'divisor' : ''} ${cell.cls.join(' ')}" style="grid-row:${r + 1};grid-column:1">${content}</div>`;
        } else {
          html += `<div class="cell ${cell.cls.join(' ')}" style="grid-row:${r + 1};grid-column:${col + 2}" ${cell.attrs}>${cell.content}</div>`;
        }
      }
    }
    html += `<div class="bracket" style="grid-row:2;grid-column:2 / span ${n}"></div>`;
    return `<div class="board" style="--n:${n}">${html}</div>`;
  }

  function render() {
    if (screen === 'map') app.innerHTML = renderMap();
    else if (screen === 'levelDone') app.innerHTML = renderLevelDone();
    else {
      app.innerHTML = renderPlay();
      S.anim = null;
    }
  }

  // ---------- input ----------
  app.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const act = el.dataset.act;
    const col = Number(el.dataset.col);
    if (act !== 'reset') resetArmed = false;
    switch (act) {
      case 'level': startLevel(Number(el.dataset.level)); break;
      case 'map': screen = 'map'; break;
      case 'cursor': if (S.phase === 'divide') S.cursor = col; break;
      case 'point': if (S.phase === 'point') placePoint(col); break;
      case 'bring': if (S.phase === 'bring') bringDown(col); break;
      case 'shift-left': moveShift(-1); break;
      case 'shift-right': moveShift(1); break;
      case 'shift-done': checkShift(); break;
      case 'helper': toggleHelper(); break;
      case 'submit': submitNumber(); break;
      case 'next': nextProblem(); break;
      case 'reset':
        if (resetArmed) {
          progress = Progress.reset();
          resetArmed = false;
        } else resetArmed = true;
        break;
      default: return;
    }
    render();
  });

  // <details> toggle doesn't bubble, so listen in the capture phase to remember open/closed across renders.
  app.addEventListener('toggle', e => {
    if (e.target.classList && e.target.classList.contains('grownups')) grownupsOpen = e.target.open;
  }, true);

  document.addEventListener('keydown', e => {
    if (screen !== 'play' || !S || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    let handled = true;
    if (S.phase === 'done') {
      if (k === 'Enter') nextProblem();
      else handled = false;
    } else if (S.phase === 'shift') {
      if (k === 'ArrowRight') moveShift(1);
      else if (k === 'ArrowLeft') moveShift(-1);
      else if (k === 'Enter') checkShift();
      else handled = false;
    } else if (S.phase === 'divide') {
      if (k === 'ArrowRight' || k === 'ArrowLeft') {
        const step = k === 'ArrowRight' ? 1 : -1;
        S.cursor = S.cursor === null ? 0 : Math.max(0, Math.min(lastCol(), S.cursor + step));
      } else if (/^[0-9]$/.test(k)) typeDivide(Number(k));
      else handled = false;
    } else if (S.phase === 'multiply' || S.phase === 'subtract') {
      if (/^[0-9]$/.test(k)) {
        if (S.input.length < cycle().col + 1) S.input += k;
      } else if (k === 'Backspace') S.input = S.input.slice(0, -1);
      else if (k === 'Enter') submitNumber();
      else handled = false;
    } else handled = false;
    if (handled) {
      e.preventDefault();
      render();
    }
  });

  render();
})();

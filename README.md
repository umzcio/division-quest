# Division Quest

A small browser game that teaches long division step by step, from whole numbers up to decimal divisors like `0.25 ) 4,127`.

Built for a 6th grader who was stuck on long division. Instead of only checking the final answer, it walks through every step on a graph-paper board:

- **Move the decimal**: hop the divisor's decimal point until it's a whole number (the dividend's decimal hops too)
- **Decimal point up**: place the answer's decimal straight above the dividend's
- **Divide → Multiply → Subtract → Bring down**: click the column on top where each answer digit goes, then type it
- **Zero traps**: when the divisor doesn't fit, a 0 still goes on top

Mistakes get a specific hint, and after two misses on a step the game shows the answer so nobody gets stuck. There are 7 levels with stars, plus a "For grown-ups" panel showing which step causes the most mistakes.

## Play

Open `index.html` in a browser. There's no build step or install, and it works offline. Progress is saved in that browser's local storage.

## Tests

```sh
node --test tests/*.test.js
```

## Files

- `js/division.js`: long division engine (pure functions, shared with tests)
- `js/levels.js`: level definitions and problem generators
- `js/progress.js`: saved stars and mistake counts
- `js/game.js`: screens, board rendering, keyboard and mouse input
- `css/style.css`: styles

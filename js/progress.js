/* Saves stars, unlocked levels and mistake counts in this browser (localStorage). */
(function (root) {
  'use strict';

  const KEY = 'division-quest-progress-v1';
  const fresh = () => ({ unlocked: 1, best: {}, mistakes: {} });

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? Object.assign(fresh(), JSON.parse(raw)) : fresh();
    } catch (e) {
      return fresh();
    }
  }

  function save(progress) {
    try {
      localStorage.setItem(KEY, JSON.stringify(progress));
    } catch (e) {
      // Private browsing or storage blocked: the game still works, it just won't remember.
    }
  }

  function reset() {
    try {
      localStorage.removeItem(KEY);
    } catch (e) {}
    return fresh();
  }

  root.Progress = { load, save, reset };
})(window);

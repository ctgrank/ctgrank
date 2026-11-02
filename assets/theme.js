// Standalone theme handler for pages that don't load app.js (reviews.html).
//
// Deliberately a copy of initTheme()/setTheme() in app.js rather than a
// shared import: app.js is one big IIFE and splitting it out risks the main
// app. This file must stay in step with it — same storage key, same
// data-theme attribute, same label swap.
(function () {
  var root = document.documentElement;
  var KEY = 'shikhor_theme';

  function setTheme(dark) {
    root.dataset.theme = dark ? 'dark' : 'light';
    var lbl = document.querySelector('.theme-label');
    if (lbl) lbl.textContent = dark ? 'Light' : 'Dark';
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', dark ? '#0b1120' : '#2563eb');
  }

  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  var dark = saved
    ? saved === 'dark'
    : window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  setTheme(dark);

  var btn = document.getElementById('themeBtn');
  if (btn) {
    btn.addEventListener('click', function () {
      setTheme(root.dataset.theme !== 'dark');
      try { localStorage.setItem(KEY, root.dataset.theme); } catch (e) {}
    });
  }
})();

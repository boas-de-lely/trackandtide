// Track & Tide - Shared Footer
// Injects a unified footer (theme toggle + links) on every page.
// Handles theme toggling; delegates to page's setTheme() if it exists.

(function() {
  // -- CSS --
  var style = document.createElement('style');
  style.textContent =
    '.site-footer{text-align:center;padding:1.5rem 1rem 2rem;border-top:1px solid var(--border,rgba(255,255,255,0.08));margin-top:2rem;opacity:0.85}' +
    '.footer-links{display:flex;flex-wrap:wrap;justify-content:center;gap:0.6rem 1.2rem;margin-top:0.75rem}' +
    '.footer-link{color:var(--hover,#38BDF8);cursor:pointer;text-decoration:none;font-size:0.9rem;display:inline-flex;align-items:center;gap:0.35rem;white-space:nowrap}' +
    '.footer-link:hover{text-decoration:underline;opacity:1}' +
    '.footer-theme{display:flex;align-items:center;justify-content:center;gap:0.65rem;margin-bottom:0.5rem}' +
    '.footer-theme-label{font-size:0.85rem;color:var(--text-secondary,#94A3B8);user-select:none}' +
    '.theme-switch{position:relative;display:inline-block;width:46px;height:24px;flex-shrink:0}' +
    '.theme-switch input{display:none}' +
    '.theme-slider{position:absolute;cursor:pointer;inset:0;background:var(--border,#3B4A5F);border-radius:24px;transition:0.25s}' +
    '.theme-slider::before{content:"";position:absolute;height:18px;width:18px;left:3px;bottom:3px;background:var(--text,#F8FAFC);border-radius:50%;transition:0.25s}' +
    'input:checked+.theme-slider{background:var(--hover,#38BDF8)}' +
    'input:checked+.theme-slider::before{transform:translateX(22px)}' +
    '@media (max-width:768px){.site-footer{display:none}}';
  document.head.appendChild(style);

  // -- HTML --
  var html =
    '<footer class="site-footer">' +
      '<div class="footer-theme">' +
        '<span class="footer-theme-label" id="ttFooterLabel">Switch to light mode</span>' +
        '<label class="theme-switch" title="Toggle dark/light mode">' +
          '<input type="checkbox" id="ttFooterToggle" />' +
          '<span class="theme-slider"></span>' +
        '</label>' +
      '</div>' +
      '<div class="footer-links">' +
        '<a class="footer-link" id="ftReportLink" onclick="if(window.openReportModal)openReportModal()">Report a bug or idea</a>' +
        '<a class="footer-link" href="/status">System Status</a>' +
        '<a class="footer-link" href="/about">About</a>' +
        '<a class="footer-link" href="/privacy">Privacy</a>' +
        '<a class="footer-link" href="/terms">Terms</a>' +
      '</div>' +
    '</footer>';

  // -- Wait for body, then inject --
  function inject() {
    if (!document.body) { requestAnimationFrame(inject); return; }
    document.body.insertAdjacentHTML('beforeend', html);

    var root = document.documentElement;
    var toggle = document.getElementById('ttFooterToggle');
    var label = document.getElementById('ttFooterLabel');
    var logo = document.getElementById('logo');

    // -- Theme logic --
    function getSavedMode() {
      var saved = localStorage.getItem('trackandtide:theme');
      if (saved) return saved;
      return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }

    function updateUI(mode) {
      var isLight = mode === 'light';
      if (toggle) toggle.checked = isLight;
      if (label) label.textContent = isLight ? 'Switch to dark mode' : 'Switch to light mode';
      if (logo) logo.src = isLight ? 'trackandtide logo full.png' : 'logo full light.png';
    }

    // If the page has its own setTheme (e.g. index.html with map), delegate to it.
    // Otherwise apply theme directly.
    var mode = getSavedMode();

    if (typeof window.setTheme === 'function') {
      // Page handles theme -- just sync the toggle
      updateUI(mode);
      if (toggle) {
        toggle.addEventListener('change', function() {
          window.setTheme(toggle.checked ? 'light' : 'dark');
        });
      }
    } else {
      // Simple theme: just toggle .light class + logo
      if (mode === 'light') root.classList.add('light');
      else root.classList.remove('light');
      updateUI(mode);

      if (toggle) {
        toggle.addEventListener('change', function() {
          var newMode = toggle.checked ? 'light' : 'dark';
          if (newMode === 'light') root.classList.add('light');
          else root.classList.remove('light');
          localStorage.setItem('trackandtide:theme', newMode);
          updateUI(newMode);
        });
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();

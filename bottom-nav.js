// ── Bottom Nav Bar ── Shared across all Track & Tide pages ──

(function() {
  // ── CSS ──
  var style = document.createElement('style');
  style.textContent =
    '.bottom-nav{display:none;position:fixed;bottom:0;left:0;right:0;z-index:9998;height:64px;background:var(--panel,#1F2937);border-top:1px solid var(--border,rgba(255,255,255,0.08));padding:6px 8px;padding-bottom:max(6px,env(safe-area-inset-bottom));box-sizing:border-box;}' +
    '.bottom-nav-inner{display:flex;justify-content:space-around;align-items:center;max-width:500px;margin:0 auto;}' +
    '.bottom-nav a{display:flex;flex-direction:column;align-items:center;gap:3px;color:var(--text,#F8FAFC);text-decoration:none;opacity:0.55;font-size:0.68rem;font-weight:600;padding:4px 8px;border-radius:10px;transition:opacity 0.15s;min-width:56px;}' +
    '.bottom-nav a:hover,.bottom-nav a.active{opacity:1;}' +
    '.bottom-nav a.active{color:var(--hover,#60A5FA);}' +
    '.bottom-nav img{width:24px;height:24px;object-fit:contain;}' +
    ':root.light .bottom-nav img{filter:none;}' +
    ':root:not(.light) .bottom-nav img{filter:invert(1);}' +
    ':root{--bnav-h:64px;}' +
    '@media (max-width: 768px){.bottom-nav{display:block;}}' +
    'body.has-bottom-nav{padding-bottom:70px;}' +
    '@media (min-width:769px){body.has-bottom-nav{padding-bottom:0;}}';

  document.head.appendChild(style);

  // ── Determine current page ──
  var path = window.location.pathname.replace(/\/$/, '') || '/';
  var isActive = function(href) {
    if (href === '/') return path === '/' || path === '/index' || path === '/index.html';
    return path.startsWith(href);
  };

  // ── Nav items ──
  var items = [
    { href: '/',         icon: 'webapp icons/world-map.png',      label: 'Map',     alt: 'Map' },
    { href: '/explore',  icon: 'webapp icons/trainferry.png',     label: 'Explore', alt: 'Explore' },
    { href: '/journey',  icon: 'webapp icons/navigator.png',      label: 'Journey', alt: 'Journey' },
    { href: '/more',     icon: 'webapp icons/more.png',           label: 'More',    alt: 'More' }
  ];

  // ── Build HTML ──
  var links = items.map(function(item) {
    var activeClass = isActive(item.href) ? ' class="active"' : '';
    return '<a href="' + item.href + '"' + activeClass + ' aria-label="' + item.alt + '">' +
      '<img src="' + item.icon + '" alt="' + item.alt + '" width="24" height="24" />' +
      '<span>' + item.label + '</span></a>';
  }).join('');

  var nav = document.createElement('nav');
  nav.className = 'bottom-nav';
  nav.setAttribute('aria-label', 'Mobile navigation');
  nav.innerHTML = '<div class="bottom-nav-inner">' + links + '</div>';

  // ── Wait for body, then inject ──
  function inject() {
    if (!document.body) { requestAnimationFrame(inject); return; }
    document.body.appendChild(nav);
    document.body.classList.add('has-bottom-nav');
  }
  inject();
})();

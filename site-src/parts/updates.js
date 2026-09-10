// Only included in the hosted landing page, never in the arcade or inline demo.
(() => {
  if (!('serviceWorker' in navigator)) return;
  let controlled = !!navigator.serviceWorker.controller;
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!controlled) { controlled = true; return; }
    if (!refreshing) { refreshing = true; location.reload(); }
  });
  navigator.serviceWorker.register('./sw.js', {updateViaCache: 'none'}).then(reg => {
    let lastCheck = Date.now();
    const check = () => {
      if (document.hidden || Date.now() - lastCheck < 60000) return;
      lastCheck = Date.now();
      reg.update().catch(() => {});
    };
    // Registration already checks on entry; also check returning/open tabs.
    addEventListener('pageshow', check);
    document.addEventListener('visibilitychange', check);
    setInterval(check, 60000);
  }).catch(() => {}); // Offline visits must still render normally.
})();

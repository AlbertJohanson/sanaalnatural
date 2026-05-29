/*
 * San — language switcher enhancement.
 * The switcher works without JS (native <details> + submit buttons).
 * This only adds nicety: close the open panel on outside-click / Escape,
 * and never leave two panels open at once.
 */
(function () {
  function openOne() {
    return document.querySelector('details[data-san-lang][open]');
  }

  function closeAll(except) {
    document.querySelectorAll('details[data-san-lang][open]').forEach(function (d) {
      if (d !== except) d.removeAttribute('open');
    });
  }

  document.addEventListener('click', function (event) {
    var open = openOne();
    if (open && !open.contains(event.target)) open.removeAttribute('open');
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      var open = openOne();
      if (open) {
        var summary = open.querySelector('summary');
        open.removeAttribute('open');
        if (summary) summary.focus();
      }
    }
  });

  // When one opens, close any other.
  document.addEventListener(
    'toggle',
    function (event) {
      var d = event.target;
      if (d && d.matches && d.matches('details[data-san-lang]') && d.open) closeAll(d);
    },
    true
  );
})();

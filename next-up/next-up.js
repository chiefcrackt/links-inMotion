/* Renders the "Next up" card from window.NEXT_UP (next-up/schedule.js).
   Text goes in with textContent only; links must be https. */
(function () {
  var DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // "2026-11-14" -> local midnight Date, or null when missing/invalid.
  function parseDay(text) {
    if (typeof text !== 'string') return null;
    var m = DAY.exec(text.trim()); if (!m) return null;
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    return d.getMonth() === +m[2] - 1 && d.getDate() === +m[3] ? d : null;
  }
  function today(now) { var n = now || new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
  function daysBetween(a, b) { return Math.round((b - a) / 864e5); }
  function str(v, max) { return typeof v === 'string' ? v.trim().slice(0, max) : ''; }
  function safeLink(v) {
    if (typeof v !== 'string' || !v.trim()) return '';
    try { var u = new URL(v.trim()); return u.protocol === 'https:' ? u.href : ''; } catch (e) { return ''; }
  }

  // Clean one schedule entry, or return null when it can't be shown.
  function normalize(raw) {
    if (!raw || typeof raw !== 'object' || raw.off === true) return null;
    var title = str(raw.title, 80); if (!title) return null;
    var date = parseDay(raw.date);
    if (raw.date && !date) return null;                    // a typo'd date shouldn't show forever
    var from = raw.showFrom ? parseDay(raw.showFrom) : null;
    if (raw.showFrom && !from) return null;
    var until = raw.showUntil ? parseDay(raw.showUntil) : date;
    if (raw.showUntil && !until) return null;
    if (raw.link && !safeLink(raw.link)) return null;      // never ship a broken or unsafe link
    return { label: str(raw.label, 40), title: title, description: str(raw.description, 160),
             date: date, from: from, until: until, link: safeLink(raw.link) };
  }

  // The soonest live entry: dated entries by date, then undated in list order.
  function pick(config, now) {
    if (!config || config.enabled === false || !Array.isArray(config.items)) return null;
    var t = today(now), live = [];
    config.items.forEach(function (raw, i) {
      var item = normalize(raw); if (!item) return;
      if (item.from && t < item.from) return;
      if (item.until && t > item.until) return;
      item.order = i; live.push(item);
    });
    live.sort(function (a, b) {
      if (a.date && b.date) return a.date - b.date || a.order - b.order;
      if (a.date || b.date) return a.date ? -1 : 1;
      return a.order - b.order;
    });
    return live[0] || null;
  }

  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; }

  function render(section, item, now) {
    var card = el(item.link ? 'a' : 'div', 'nu-card');
    if (item.link) { card.href = item.link; card.target = '_blank'; card.rel = 'noopener'; }

    var main = el('span', 'nu-main');
    if (item.label) main.appendChild(el('span', 'nu-label', item.label));
    main.appendChild(el('span', 'nu-title', item.title));
    if (item.description) main.appendChild(el('span', 'nu-desc', item.description));
    if (item.date) {
      var d = item.date;
      var when = el('time', 'nu-date', WEEKDAYS[d.getDay()] + ' · ' + MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear());
      when.dateTime = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      main.appendChild(when);
    }
    card.appendChild(main);

    var side = el('span', 'nu-side');
    if (item.date) {
      var n = daysBetween(today(now), item.date), count = el('span', 'nu-count');
      if (n <= 0) count.appendChild(el('b', '', 'Today'));
      else { count.appendChild(el('b', '', String(n))); count.appendChild(el('span', '', n === 1 ? 'Day' : 'Days')); }
      side.appendChild(count);
    }
    if (item.link) { var arrow = el('span', 'arrow', '→'); arrow.setAttribute('aria-hidden', 'true'); side.appendChild(arrow); }
    if (side.childNodes.length) card.appendChild(side);

    section.appendChild(card);
    section.hidden = false;
  }

  window.NextUpCard = { pick: pick, normalize: normalize };
  var section = document.querySelector('[data-next-up]');
  if (!section) return;
  try { var item = pick(window.NEXT_UP); if (item) render(section, item); }
  catch (e) { section.hidden = true; }
})();

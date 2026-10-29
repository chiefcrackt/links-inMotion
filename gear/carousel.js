/* Gear carousel. Product content is rendered with DOM APIs, never HTML strings. */
(function () {
  const root = document.querySelector('[data-gear]');
  if (!root) return;
  const track = root.querySelector('.gear-track');
  const previous = root.querySelector('[data-previous]');
  const next = root.querySelector('[data-next]');
  const status = root.querySelector('[data-gear-status]');
  const origin = (window.GEAR_API_ORIGIN || '').replace(/\/$/, '');
  if (!origin) return;
  const safeLink = value => { try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; } catch { return null; } };
  function update() {
    previous.disabled = track.scrollLeft < 4;
    next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
  }
  function card(item) {
    const href = safeLink(item.url);
    if (!href) return null;
    const link = document.createElement('a');
    link.className = 'gear-card'; link.href = href; link.target = '_blank'; link.rel = 'sponsored noopener noreferrer';
    const art = document.createElement('div'); art.className = 'gear-art';
    if (item.image && safeLink(item.image)) {
      const img = document.createElement('img'); img.src = item.image; img.alt = item.name; img.loading = 'lazy'; img.decoding = 'async';
      img.addEventListener('error', () => { img.remove(); art.textContent = 'T.im'; }, { once: true }); art.append(img);
    } else art.textContent = 'T.im';
    const body = document.createElement('div'); body.className = 'gear-body';
    const brand = document.createElement('span'); brand.className = 'gear-brand'; brand.textContent = item.brand || 'My gear';
    const title = document.createElement('h3'); title.textContent = item.name;
    const note = document.createElement('p'); note.textContent = item.note || '';
    const cta = document.createElement('span'); cta.className = 'gear-cta'; cta.textContent = 'Shop item ↗';
    body.append(brand, title, note, cta); link.append(art, body); return link;
  }
  previous.addEventListener('click', () => track.scrollBy({ left: -track.clientWidth * .85, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }));
  next.addEventListener('click', () => track.scrollBy({ left: track.clientWidth * .85, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }));
  track.addEventListener('scroll', update, { passive: true });
  new ResizeObserver(update).observe(track);
  fetch(origin + '/api/products', { credentials: 'omit', signal: AbortSignal.timeout(10000) })
    .then(response => { if (!response.ok) throw new Error('Products unavailable'); return response.json(); })
    .then(data => {
      const cards = (Array.isArray(data.products) ? data.products : []).map(card).filter(Boolean);
      if (!cards.length) return;
      track.replaceChildren(...cards); root.hidden = false;
      status.textContent = cards.length + (cards.length === 1 ? ' pick' : ' picks'); update();
    }).catch(() => { root.hidden = true; });
})();

/* T.im editor. Reads and writes the page's data files in GitHub with the
   owner's personal access key. No server: everything is a commit to main. */
(function () {
  var REPO = 'chiefcrackt/links-inMotion', BRANCH = 'main', API = 'https://api.github.com';
  var FILES = { gear: 'gear/products.json', nextup: 'next-up/schedule.json' };
  var KEY = 'tim_editor_key';
  var $ = function (id) { return document.getElementById(id); };
  var token = '', busy = false;
  var data = { gear: null, nextup: null }, sha = { gear: null, nextup: null };
  var NU = window.NextUpCard;

  // ---------- small helpers ----------
  function store(get, value) {
    try { if (get) return localStorage.getItem(KEY) || ''; if (value) localStorage.setItem(KEY, value); else localStorage.removeItem(KEY); } catch (e) { return ''; }
  }
  function notice(text, error) { var n = $('notice'); n.textContent = text || ''; n.className = error ? 'error' : ''; }
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function btn(label, onClick, aria) { var b = el('button', '', label); b.type = 'button'; if (aria) b.setAttribute('aria-label', aria); b.addEventListener('click', onClick); return b; }
  function toBase64(bytes) { var s = '', i; for (i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); }
  function fromBase64(b64) { var bin = atob(b64.replace(/\s/g, '')), out = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return new TextDecoder().decode(out); }
  function httpsOk(v) { try { var u = new URL(v); return u.protocol === 'https:' && !u.username && !u.password; } catch (e) { return false; } }
  function repoImage(v) { return /^gear\/images\/[\w.-]+\.(webp|jpe?g|png)$/i.test(v || ''); }
  function prettyDay(text) {
    var d = NU.parseDay(text); if (!d) return '';
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }
  function clean(v) { return typeof v === 'string' ? v.trim() : ''; }

  // ---------- GitHub ----------
  function gh(path, options) {
    options = options || {};
    var headers = { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token, 'X-GitHub-Api-Version': '2022-11-28' };
    if (options.body) headers['Content-Type'] = 'application/json';
    return fetch(API + path, { method: options.method || 'GET', headers: headers, body: options.body, cache: 'no-store' }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (body) {
        if (r.ok) return body;
        var err = new Error(body.message || ('GitHub said ' + r.status)); err.status = r.status; throw err;
      });
    });
  }
  function explain(err) {
    if (err.status === 401) return 'GitHub didn\'t accept that key. It may have expired. Sign out and paste a new one.';
    if (err.status === 403 || err.status === 404) return 'That key can\'t edit links-inMotion. Check it has Contents: Read and write on that repo.';
    if (err.status === 409 || err.status === 422) return 'This changed somewhere else since you opened it. Reloaded the latest; please make your change again.';
    return 'Couldn\'t reach GitHub (' + err.message + '). Check your connection and try again.';
  }
  function load(kind) {
    return gh('/repos/' + REPO + '/contents/' + FILES[kind] + '?ref=' + BRANCH).then(function (file) {
      sha[kind] = file.sha; data[kind] = JSON.parse(fromBase64(file.content));
    }).catch(function (err) {
      if (err.status !== 404) throw err;
      sha[kind] = null; data[kind] = kind === 'gear' ? { products: [] } : { enabled: true, items: [] };
    });
  }
  function putFile(path, bytes, message, fileSha) {
    var body = { message: message, content: toBase64(bytes), branch: BRANCH };
    if (fileSha) body.sha = fileSha;
    return gh('/repos/' + REPO + '/contents/' + path, { method: 'PUT', body: JSON.stringify(body) });
  }
  // Save one data file; on failure restore what GitHub has so the screen never lies.
  function save(kind, next, message) {
    var bytes = new TextEncoder().encode(JSON.stringify(next, null, 2) + '\n');
    return putFile(FILES[kind], bytes, message, sha[kind]).then(function (res) {
      sha[kind] = res.content.sha; data[kind] = next;
      notice('Saved. It shows on your page in about a minute.');
    }).catch(function (err) {
      return load(kind).then(function () { throw err; }, function () { throw err; });
    }).finally(render);
  }
  function task(fn) {
    if (busy) return Promise.resolve(); busy = true; setBusy(true);
    return Promise.resolve().then(fn).catch(function (err) { notice(err.userMessage || explain(err), true); })
      .finally(function () { busy = false; setBusy(false); });
  }
  function setBusy(on) { document.querySelectorAll('#workspace button, #login button').forEach(function (b) { b.disabled = on; }); }

  // ---------- sign in ----------
  function signIn(key) {
    token = key;
    return gh('/repos/' + REPO).then(function (repo) {
      if (!repo.permissions || !repo.permissions.push) { var e = new Error('read only'); e.status = 403; throw e; }
      return Promise.all([load('gear'), load('nextup')]);
    }).then(function () {
      store(false, key); $('login').hidden = true; $('workspace').hidden = false; $('signout').hidden = false; notice(''); render();
    }).catch(function (err) {
      token = ''; if (err.status === 401 || err.status === 403 || err.status === 404) store(false, ''); $('login').hidden = false; $('workspace').hidden = true; $('signout').hidden = true; throw err;
    });
  }
  $('login-form').addEventListener('submit', function (e) {
    e.preventDefault(); var key = clean(e.target.elements.token.value);
    task(function () { return signIn(key).then(function () { e.target.reset(); }); });
  });
  $('signout').addEventListener('click', function () {
    token = ''; store(false, ''); $('workspace').hidden = true; $('signout').hidden = true; $('login').hidden = false; notice('Signed out. The key was removed from this device.');
  });

  // ---------- tabs ----------
  ['nextup', 'gear'].forEach(function (name) {
    $('tab-' + name).addEventListener('click', function () {
      ['nextup', 'gear'].forEach(function (other) {
        $('tab-' + other).setAttribute('aria-selected', other === name ? 'true' : 'false');
        $('view-' + other).hidden = other !== name;
      });
    });
  });

  function render() { if (data.nextup) renderNextUp(); if (data.gear) renderGear(); }

  // ---------- Next up ----------
  function statusOf(item, index, showing) {
    if (item.off) return ['Off', 'off'];
    var n = NU.normalize(item); if (!n) return ['Needs fixing', 'bad'];
    var t = NU.today();
    if (n.until && t > n.until) return ['Past', 'past'];
    if (showing && showing.order === index) return [data.nextup.enabled === false ? 'Next (card hidden)' : 'Showing now', 'live'];
    if (n.from && t < n.from) return ['Shows from ' + prettyDay(item.showFrom), 'queued'];
    return ['Queued', 'queued'];
  }
  function renderNextUp() {
    var cfg = data.nextup, items = cfg.items || [], showing = NU.pick(Object.assign({}, cfg, { enabled: true }));
    $('nu-enabled').checked = cfg.enabled !== false;
    var now = $('nu-now'); now.replaceChildren();
    if (cfg.enabled === false) now.append('The card is hidden on your page.');
    else if (showing) { now.append('Showing now: '); now.append(el('b', '', showing.title)); }
    else now.append('Nothing is showing right now. Add a race or turn one on.');

    var list = $('nu-list'); list.replaceChildren();
    var order = items.map(function (item, i) { return i; }).sort(function (a, b) {
      var da = items[a].date || '9999', db = items[b].date || '9999'; return da < db ? -1 : da > db ? 1 : a - b;
    });
    if (!items.length) list.append(el('li', 'empty', 'No races yet.'));
    order.forEach(function (i) {
      var item = items[i], st = statusOf(item, i, showing), li = el('li', st[1] === 'past' || st[1] === 'off' ? 'dim' : '');
      var info = el('div', 'info');
      info.append(el('span', 'pill ' + st[1], st[0]), el('span', 'title', item.title || '(no title)'));
      var meta = [item.label, prettyDay(item.date)].filter(Boolean).join(' · ');
      if (meta) info.append(el('span', 'meta', meta));
      if (item.note) info.append(el('span', 'meta', item.note));
      var tools = el('div', 'tools');
      tools.append(
        btn('Edit', function () { openRace(i); }, 'Edit ' + item.title),
        btn(item.off ? 'Turn on' : 'Turn off', function () { toggleRace(i); }, (item.off ? 'Turn on ' : 'Turn off ') + item.title),
        btn('Delete', function () { deleteRace(i); }, 'Delete ' + item.title));
      li.append(info, tools); list.append(li);
    });
  }
  function sortedItems(items) {
    return items.slice().sort(function (a, b) { var da = a.date || '9999', db = b.date || '9999'; return da < db ? -1 : da > db ? 1 : 0; });
  }
  function withItems(items) { return Object.assign({}, data.nextup, { items: sortedItems(items) }); }
  function toggleRace(i) {
    task(function () {
      var items = data.nextup.items.slice(), item = Object.assign({}, items[i]);
      if (item.off) delete item.off; else item.off = true;
      if (!item.off && !NU.normalize(item)) { var e = new Error(); e.userMessage = 'Fix this one before turning it on (check the date and link).'; throw e; }
      items[i] = item;
      return save('nextup', withItems(items), 'Next up: turn ' + (item.off ? 'off ' : 'on ') + item.title);
    });
  }
  function deleteRace(i) {
    var item = data.nextup.items[i];
    if (!confirm('Delete "' + item.title + '" from Next up?')) return;
    task(function () {
      var items = data.nextup.items.slice(); items.splice(i, 1);
      return save('nextup', withItems(items), 'Next up: remove ' + item.title);
    });
  }
  $('nu-enabled').addEventListener('change', function (e) {
    var on = e.target.checked;
    task(function () { return save('nextup', Object.assign({}, data.nextup, { enabled: on }), on ? 'Next up: show card' : 'Next up: hide card'); });
  });
  var nuForm = $('nu-form');
  function openRace(i) {
    nuForm.reset(); var f = nuForm.elements, item = i == null ? {} : data.nextup.items[i];
    f.index.value = i == null ? '' : i;
    ['title', 'label', 'description', 'date', 'link', 'showFrom', 'showUntil', 'note'].forEach(function (k) { f[k].value = item[k] || ''; });
    f.on.checked = !item.off;
    nuForm.querySelector('details').open = !!(item.showFrom || item.showUntil);
    $('nu-form-title').textContent = i == null ? 'Add a race' : 'Edit ' + (item.title || 'race');
    nuForm.hidden = false; f.title.focus(); nuForm.scrollIntoView({ block: 'nearest' });
  }
  $('nu-add').addEventListener('click', function () { openRace(null); });
  nuForm.querySelector('[data-cancel]').addEventListener('click', function () { nuForm.hidden = true; });
  nuForm.addEventListener('submit', function (e) {
    e.preventDefault(); var f = nuForm.elements, item = {};
    ['label', 'title', 'description', 'date', 'link', 'showFrom', 'showUntil', 'note'].forEach(function (k) { var v = clean(f[k].value); if (v) item[k] = v; });
    if (!f.on.checked) item.off = true;
    var problem = !item.title ? 'Give it a title.'
      : item.link && !httpsOk(item.link) ? 'The link has to start with https://.'
      : item.showFrom && item.showUntil && item.showFrom > item.showUntil ? '"Start showing" has to be on or before "Last day".'
      : !NU.normalize(Object.assign({}, item, { off: false })) ? 'Something in this one isn\'t valid. Check the dates and link.' : '';
    if (problem) { notice(problem, true); return; }
    var i = f.index.value === '' ? null : +f.index.value;
    task(function () {
      var items = data.nextup.items.slice(); if (i == null) items.push(item); else items[i] = item;
      return save('nextup', withItems(items), 'Next up: ' + (i == null ? 'add ' : 'update ') + item.title).then(function () { nuForm.hidden = true; });
    });
  });

  // ---------- Gear ----------
  function renderGear() {
    var products = data.gear.products || [], list = $('gear-list'); list.replaceChildren();
    if (!products.length) list.append(el('li', 'empty', 'No products yet. The carousel stays hidden until you add one.'));
    products.forEach(function (p, i) {
      var li = el('li', p.visible === false ? 'dim' : ''), art = el('div', 'img');
      if (p.image && (repoImage(p.image) || httpsOk(p.image))) { var img = el('img'); img.alt = ''; img.src = repoImage(p.image) ? '../' + p.image : p.image; art.append(img); }
      var info = el('div', 'info');
      if (p.visible === false) info.append(el('span', 'pill off', 'Hidden'));
      info.append(el('span', 'title', p.name), el('span', 'meta', p.brand || ''));
      var tools = el('div', 'tools');
      var up = btn('↑', function () { moveGear(i, -1); }, 'Move ' + p.name + ' up'), down = btn('↓', function () { moveGear(i, 1); }, 'Move ' + p.name + ' down');
      up.dataset.edge = i === 0 ? '1' : ''; down.dataset.edge = i === products.length - 1 ? '1' : '';
      tools.append(up, down,
        btn('Edit', function () { openGear(i); }, 'Edit ' + p.name),
        btn(p.visible === false ? 'Show' : 'Hide', function () { toggleGear(i); }, (p.visible === false ? 'Show ' : 'Hide ') + p.name),
        btn('Delete', function () { deleteGear(i); }, 'Delete ' + p.name));
      li.append(art, info, tools); list.append(li);
    });
    list.querySelectorAll('[data-edge="1"]').forEach(function (b) { b.hidden = true; });
  }
  function withProducts(products) { return Object.assign({}, data.gear, { products: products }); }
  function moveGear(i, step) {
    task(function () {
      var products = data.gear.products.slice(), item = products.splice(i, 1)[0]; products.splice(i + step, 0, item);
      return save('gear', withProducts(products), 'Gear: reorder ' + item.name);
    });
  }
  function toggleGear(i) {
    task(function () {
      var products = data.gear.products.slice(), p = Object.assign({}, products[i], { visible: products[i].visible === false });
      products[i] = p; return save('gear', withProducts(products), 'Gear: ' + (p.visible ? 'show ' : 'hide ') + p.name);
    });
  }
  function deleteGear(i) {
    var p = data.gear.products[i];
    if (!confirm('Delete "' + p.name + '"?')) return;
    task(function () { var products = data.gear.products.slice(); products.splice(i, 1); return save('gear', withProducts(products), 'Gear: remove ' + p.name); });
  }
  var gearForm = $('gear-form'), pendingImage = null;
  function preview(src) { var box = $('gear-preview'); box.hidden = !src; box.querySelector('img').src = src || ''; }
  function openGear(i) {
    gearForm.reset(); pendingImage = null; var f = gearForm.elements, p = i == null ? {} : data.gear.products[i];
    f.index.value = i == null ? '' : i;
    ['name', 'brand', 'url', 'note', 'image'].forEach(function (k) { f[k].value = p[k] || ''; });
    f.visible.checked = p.visible !== false;
    preview(p.image ? (repoImage(p.image) ? '../' + p.image : p.image) : '');
    $('gear-form-title').textContent = i == null ? 'Add a product' : 'Edit ' + p.name;
    gearForm.hidden = false; f.name.focus(); gearForm.scrollIntoView({ block: 'nearest' });
  }
  $('gear-add').addEventListener('click', function () { openGear(null); });
  gearForm.querySelector('[data-cancel]').addEventListener('click', function () { gearForm.hidden = true; pendingImage = null; });
  gearForm.elements.image.addEventListener('input', function (e) { pendingImage = null; gearForm.elements.file.value = ''; var v = clean(e.target.value); preview(httpsOk(v) ? v : ''); });
  // Shrink photos to 1000px WebP in the browser so the repo stays small.
  gearForm.elements.file.addEventListener('change', function (e) {
    var file = e.target.files[0]; pendingImage = null; if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 20 * 1024 * 1024) { notice('Use a JPG, PNG or WebP under 20 MB.', true); e.target.value = ''; return; }
    var url = URL.createObjectURL(file), img = new Image();
    img.onload = function () {
      var scale = Math.min(1, 1000 / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      c.toBlob(function (blob) {
        if (!blob) { notice('Couldn\'t read that photo.', true); return; }
        pendingImage = blob; gearForm.elements.image.value = ''; preview(URL.createObjectURL(blob)); notice('');
      }, 'image/webp', 0.85);
    };
    img.onerror = function () { URL.revokeObjectURL(url); notice('Couldn\'t read that photo.', true); };
    img.src = url;
  });
  function slug(text) { return (text || 'product').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'product'; }
  gearForm.addEventListener('submit', function (e) {
    e.preventDefault(); var f = gearForm.elements, i = f.index.value === '' ? null : +f.index.value;
    var old = i == null ? {} : data.gear.products[i];
    var p = { id: old.id || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())), name: clean(f.name.value), brand: clean(f.brand.value),
      note: clean(f.note.value), url: clean(f.url.value), image: clean(f.image.value), visible: f.visible.checked };
    var problem = !p.name ? 'Give it a name.' : !httpsOk(p.url) ? 'The affiliate link has to start with https://.'
      : p.image && !httpsOk(p.image) && !repoImage(p.image) ? 'The image link has to start with https://.' : '';
    if (problem) { notice(problem, true); return; }
    task(function () {
      var upload = Promise.resolve();
      if (pendingImage) {
        var path = 'gear/images/' + slug(p.name) + '-' + Math.random().toString(36).slice(2, 8) + '.webp';
        upload = pendingImage.arrayBuffer().then(function (buf) { return putFile(path, new Uint8Array(buf), 'Gear: photo for ' + p.name); })
          .then(function () { p.image = path; });
      }
      return upload.then(function () {
        var products = data.gear.products.slice(); if (i == null) products.push(p); else products[i] = p;
        return save('gear', withProducts(products), 'Gear: ' + (i == null ? 'add ' : 'update ') + p.name);
      }).then(function () { gearForm.hidden = true; pendingImage = null; });
    });
  });

  // ---------- start ----------
  var saved = store(true);
  if (saved) task(function () { return signIn(saved); }); else $('login').hidden = false;
})();

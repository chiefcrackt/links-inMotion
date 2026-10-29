(() => {
  const $ = id => document.getElementById(id);
  const productForm = $('product-form'), loginForm = $('login-form');
  let products = [], revision = 0, csrf = '', setup = false, busy = false;
  let setupToken = new URLSearchParams(location.hash.slice(1)).get('setup') || '';
  if (setupToken) history.replaceState(null, '', location.pathname);
  const notice = (message, error = false) => { $('notice').textContent = message; $('notice').className = error ? 'error' : ''; };
  function setBusy(value) { busy = value; document.querySelectorAll('button').forEach(b => { b.disabled = value || b.dataset.edge === 'true'; }); }
  async function api(path, options = {}) {
    const headers = { ...options.headers };
    if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
    if (csrf) headers['X-CSRF-Token'] = csrf;
    const response = await fetch(path, { ...options, headers, credentials: 'same-origin', signal: AbortSignal.timeout(30000) });
    const data = await response.json();
    if (!response.ok) { if (response.status === 401 && path !== '/api/login' && path !== '/api/password') { $('workspace').hidden = true; $('login').hidden = false; csrf = ''; } throw new Error(data.error || 'Please try again.'); }
    return data;
  }
  async function task(action) { if (busy) return; setBusy(true); try { await action(); } catch (error) { notice(error.message, true); } finally { setBusy(false); } }
  async function refresh() { const data = await api('/api/admin/products'); products = data.products; revision = data.revision; render(); }
  async function save(items, message) { const data = await api('/api/admin/products', { method: 'PUT', body: JSON.stringify({ products: items, revision }) }); products = data.products; revision = data.revision; render(); notice(message); }
  function resetForm() { productForm.reset(); productForm.elements.image.value = ''; productForm.elements.id.value = ''; $('form-title').textContent = 'Add a product'; $('save-product').textContent = 'Publish product →'; $('cancel-edit').hidden = true; updatePreview(); }
  function updatePreview() {
    const image = productForm.elements.imageURL.value || productForm.elements.image.value;
    let safe = ''; try { const url = new URL(image, location.origin); if ((url.protocol === 'https:' || url.origin === location.origin) && !url.username && !url.password) safe = url.href; } catch {}
    $('image-preview').hidden = !safe; if (safe) $('preview').src = safe; else $('preview').removeAttribute('src');
  }
  function edit(item) {
    resetForm(); for (const key of ['id', 'name', 'brand', 'note', 'url', 'image']) productForm.elements[key].value = item[key];
    productForm.elements.visible.checked = item.visible; $('form-title').textContent = 'Edit product'; $('save-product').textContent = 'Save changes →'; $('cancel-edit').hidden = false; updatePreview(); productForm.elements.name.focus();
  }
  function button(label, action, edge = false, extraClass = '') { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.className = 'quiet ' + extraClass; b.dataset.edge = String(edge); b.disabled = edge || busy; b.addEventListener('click', () => task(action)); return b; }
  function render() {
    $('products').replaceChildren(); $('empty').hidden = !!products.length; $('count').textContent = '(' + products.length + '/100)';
    products.forEach((item, index) => {
      const row = document.createElement('article'); row.className = 'item';
      const top = document.createElement('div'); top.className = 'item-top'; const art = document.createElement('div'); art.className = 'item-art';
      if (item.image) { const img = document.createElement('img'); img.src = item.image; img.alt = ''; img.loading = 'lazy'; img.addEventListener('error', () => { img.remove(); art.textContent = 'T.im'; }, { once: true }); art.append(img); } else art.textContent = 'T.im';
      const copy = document.createElement('div'); copy.className = 'item-copy'; const tag = document.createElement('span'); tag.className = 'tag' + (item.visible ? '' : ' hidden-tag'); tag.textContent = item.visible ? 'LIVE' : 'HIDDEN';
      const title = document.createElement('h3'); title.textContent = item.name; const desc = document.createElement('p'); desc.textContent = item.note || item.brand || new URL(item.url).hostname; copy.append(tag, title, desc); top.append(art, copy);
      const controls = document.createElement('div'); controls.className = 'item-actions';
      const move = async delta => { const next = [...products]; [next[index], next[index + delta]] = [next[index + delta], next[index]]; await save(next, 'Order updated.'); };
      controls.append(button('Edit', () => edit(item)), button(item.visible ? 'Hide' : 'Show', () => save(products.map(p => p.id === item.id ? { ...p, visible: !p.visible } : p), item.visible ? 'Product hidden.' : 'Product published.')), button('↑', () => move(-1), index === 0), button('↓', () => move(1), index === products.length - 1), button('Delete', async () => { if (confirm('Delete “' + item.name + '”?')) { await save(products.filter(p => p.id !== item.id), 'Product deleted.'); if (productForm.elements.id.value === item.id) resetForm(); } }, false, 'remove'));
      controls.children[2].setAttribute('aria-label', 'Move ' + item.name + ' up'); controls.children[3].setAttribute('aria-label', 'Move ' + item.name + ' down');
      row.append(top, controls); $('products').append(row);
    });
  }
  loginForm.addEventListener('submit', event => { event.preventDefault(); task(async () => { const password = loginForm.elements.password.value; const result = await api(setup ? '/api/setup' : '/api/login', { method: 'POST', body: JSON.stringify({ password, token: setupToken }) }); csrf = result.csrf; setup = false; setupToken = ''; loginForm.reset(); await refresh(); $('login').hidden = true; $('workspace').hidden = false; notice('You’re signed in.'); }); });
  productForm.addEventListener('submit', event => { event.preventDefault(); task(async () => {
    const fields = productForm.elements, id = fields.id.value || crypto.randomUUID();
    let image = fields.imageURL.value.trim() || fields.image.value; const file = $('image-file').files[0];
    if (file) { if (file.size > 5 * 1024 * 1024) throw new Error('Choose an image smaller than 5 MB.'); const data = new FormData(); data.append('image', file); image = (await api('/api/admin/upload', { method: 'POST', body: data })).image; }
    const item = { id, name: fields.name.value.trim(), brand: fields.brand.value.trim(), note: fields.note.value.trim(), url: fields.url.value.trim(), image, visible: fields.visible.checked };
    await save(products.some(p => p.id === id) ? products.map(p => p.id === id ? item : p) : [...products, item], item.visible ? 'Product published. Your carousel is updated.' : 'Product saved as hidden.'); resetForm();
  }); });
  $('image-file').addEventListener('change', () => { const file = $('image-file').files[0]; if (!file) return; if (file.size > 5 * 1024 * 1024) { notice('Choose an image smaller than 5 MB.', true); $('image-file').value = ''; return; } const reader = new FileReader(); reader.onload = () => { $('preview').src = reader.result; $('image-preview').hidden = false; }; reader.readAsDataURL(file); productForm.elements.imageURL.value = ''; });
  productForm.elements.imageURL.addEventListener('input', () => { $('image-file').value = ''; updatePreview(); });
  $('remove-image').addEventListener('click', () => { productForm.elements.image.value = ''; productForm.elements.imageURL.value = ''; $('image-file').value = ''; updatePreview(); });
  $('cancel-edit').addEventListener('click', resetForm);
  $('refresh').addEventListener('click', () => task(async () => { await refresh(); notice('Product list refreshed.'); }));
  $('logout').addEventListener('click', () => task(async () => { await api('/api/logout', { method: 'POST' }); csrf = ''; products = []; $('products').replaceChildren(); resetForm(); $('workspace').hidden = true; $('login').hidden = false; notice('Signed out.'); }));
  $('password-form').addEventListener('submit', event => { event.preventDefault(); task(async () => { const form = event.target; const result = await api('/api/password', { method: 'POST', body: JSON.stringify({ currentPassword: form.elements.currentPassword.value, password: form.elements.password.value }) }); csrf = result.csrf; form.reset(); notice('Password updated. Other sessions have been signed out.'); }); });
  task(async () => { const state = await api('/api/session'); csrf = state.csrf || ''; setup = state.setupRequired;
    if (state.authenticated) { await refresh(); $('workspace').hidden = false; }
    else { $('login').hidden = false; if (setup) { $('login-title').textContent = 'Set your password.'; $('login-help').textContent = setupToken ? 'Choose a password of at least 14 characters for your private editor.' : 'Open the private setup link provided in your chat to choose your password.'; loginForm.elements.password.autocomplete = 'new-password'; loginForm.elements.password.minLength = 14; $('login-button').textContent = 'Create password →'; $('login-button').dataset.edge = String(!setupToken); } }
  });
})();

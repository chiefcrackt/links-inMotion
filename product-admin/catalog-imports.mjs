// Deployment-owned catalog additions. Each marker is applied once, transactionally.
// After import, products are managed normally in /admin and are never restored automatically.
export const headlamp = {
  id: '0cc32594-01e1-43cf-858d-f1e41466e2ee',
  name: 'Fenix HM55R Rechargeable Headlamp',
  brand: 'Fenix',
  note: 'Easy to swap batteries out. Adjustable brightness for your needs. Long battery life. Ran my first 24 hour race with this!',
  url: 'https://rendezvu.co/p-44886709?h=tristan-blain',
  image: 'https://media.rendezvu.co/products/0cc32594-01e1-43cf-858d-f1e41466e2ee/941d4971-b98c-413c-8828-e7585af50b10.webp',
  visible: true
};
const marker = 'import:rendezvu-headlamp-44886709:v1';
export async function applyCatalogImports(env) {
  if (await env.DB.prepare('SELECT value FROM gear_settings WHERE key = ?').bind(marker).first()) return;
  await env.DB.batch([
    env.DB.prepare('INSERT OR IGNORE INTO gear_catalog (id) VALUES (1)'),
    env.DB.prepare(`UPDATE gear_catalog
      SET products = json_insert(products, '$[#]', json(?)), revision = revision + 1
      WHERE id = 1 AND json_array_length(products) < 100
      AND NOT EXISTS (SELECT 1 FROM gear_settings WHERE key = ?)
      AND NOT EXISTS (SELECT 1 FROM json_each(products) WHERE json_extract(value, '$.url') = ? OR json_extract(value, '$.id') = ?)`)
      .bind(JSON.stringify(headlamp), marker, headlamp.url, headlamp.id),
    env.DB.prepare('INSERT OR IGNORE INTO gear_settings (key, value) VALUES (?, ?)').bind(marker, 'applied')
  ]);
}

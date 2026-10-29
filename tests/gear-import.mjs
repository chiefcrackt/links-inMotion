import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { applyCatalogImports, headlamp } from '../product-admin/catalog-imports.mjs';
const db = new DatabaseSync(':memory:');
db.exec(readFileSync(new URL('../product-admin/schema.sql', import.meta.url), 'utf8'));
class Statement {
  constructor(sql, args = []) { this.sql = sql; this.args = args; }
  bind(...args) { return new Statement(this.sql, args); }
  async first() { return db.prepare(this.sql).get(...this.args) || null; }
  async run() { return { meta: { changes: Number(db.prepare(this.sql).run(...this.args).changes) } }; }
}
const env = { DB: { prepare: sql => new Statement(sql), batch: async statements => { db.exec('BEGIN'); try { const results = []; for (const s of statements) results.push(await s.run()); db.exec('COMMIT'); return results; } catch (e) { db.exec('ROLLBACK'); throw e; } } } };
const catalog = () => db.prepare('SELECT products, revision FROM gear_catalog WHERE id = 1').get();
const existing = { id: crypto.randomUUID(), name: 'Existing pick', visible: false };
db.prepare('INSERT INTO gear_catalog (id, products, revision) VALUES (1, ?, 7)').run(JSON.stringify([existing]));
await applyCatalogImports(env);
assert.deepEqual(JSON.parse(catalog().products), [existing, headlamp]);
assert.equal(catalog().revision, 8);
await Promise.all([applyCatalogImports(env), applyCatalogImports(env)]);
assert.equal(catalog().revision, 8);
const edited = { ...headlamp, name: 'My edited headlamp', visible: false };
db.prepare('UPDATE gear_catalog SET products = ? WHERE id = 1').run(JSON.stringify([existing, edited]));
await applyCatalogImports(env);
assert.deepEqual(JSON.parse(catalog().products), [existing, edited]);
db.prepare('UPDATE gear_catalog SET products = ? WHERE id = 1').run(JSON.stringify([existing]));
await applyCatalogImports(env);
assert.deepEqual(JSON.parse(catalog().products), [existing]);
// A manually added copy is preserved instead of duplicated or replaced.
db.prepare('DELETE FROM gear_settings').run();
db.prepare('UPDATE gear_catalog SET products = ? WHERE id = 1').run(JSON.stringify([edited]));
await applyCatalogImports(env);
assert.deepEqual(JSON.parse(catalog().products), [edited]);
// A new empty catalog is initialized too.
db.prepare('DELETE FROM gear_settings').run(); db.prepare('DELETE FROM gear_catalog').run();
await applyCatalogImports(env);
assert.deepEqual(JSON.parse(catalog().products), [headlamp]);
assert.equal(catalog().revision, 1);
db.close();
console.log('PASS: headlamp import preserves existing items, runs once, avoids duplicates, and respects later edits, visibility, and deletion.');

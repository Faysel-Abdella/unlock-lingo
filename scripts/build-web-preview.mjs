#!/usr/bin/env node
/**
 * Packs the static web export (dist/) into one self-contained HTML file:
 * JS inlined, the Ionicons font and router images as data URLs. The result
 * opens anywhere (file://, sandboxed preview panes) with no server.
 *
 * Usage: npm run preview:web   →   web-preview.html
 */
import fs from 'node:fs';
import path from 'node:path';

const [dist = 'dist', out = 'web-preview.html'] = process.argv.slice(2);
let html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const src = html.match(/<script src="([^"]+)" defer><\/script>/)?.[1];
if (!src) throw new Error('No entry script found in index.html');
let js = fs.readFileSync(path.join(dist, src.replace(/^\//, '')), 'utf8');

const MIME = { '.ttf': 'font/ttf', '.png': 'image/png' };
function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}
let inlined = 0;
for (const file of walk(path.join(dist, 'assets'))) {
  const ext = path.extname(file);
  if (ext === '.ttf' && !path.basename(file).startsWith('Ionicons')) continue; // only icon set in use
  if (/@\dx\.png$/.test(file) || !MIME[ext]) continue;
  const url = '/' + path.relative(dist, file).split(path.sep).join('/');
  if (!js.includes(url)) continue;
  js = js.split(url).join(`data:${MIME[ext]};base64,${fs.readFileSync(file).toString('base64')}`);
  inlined += 1;
}
js = js.replaceAll('</script', '<\\/script');
html = html.replace('<link rel="icon" href="/favicon.ico"/>', '');
html = html.replace(/<script src="[^"]+" defer><\/script>/, () => `<script>${js}</script>`);
fs.writeFileSync(out, html);
console.log(`Wrote ${out} (${(fs.statSync(out).size / 1e6).toFixed(1)} MB, ${inlined} assets inlined)`);

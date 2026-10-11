// Packs the game into dist/artifact/: one page (inline CSS + one bundled module script)
// plus the figure images and CREDITS.md. Used to publish the playable version.
//   npm install && npm run build
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist', 'artifact');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'assets', 'figures'), { recursive: true });

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

// Inline the local stylesheets in the order index.html links them.
const cssLinks = [...html.matchAll(/<link rel="stylesheet" href="(css\/[^"]+)">/g)].map((m) => m[1]);
const css = cssLinks.map((href) => `/* ${href} */\n${fs.readFileSync(path.join(root, href), 'utf8')}`).join('\n');

const bundle = await build({
  entryPoints: [path.join(root, 'js', 'main.js')],
  bundle: true,
  format: 'esm',
  minify: true,
  write: false,
  target: ['es2020'],
  legalComments: 'none',
});
const js = bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

let page = html
  .replace(/<!doctype html>\s*/i, '')
  .replace(/<html[^>]*>\s*/i, '')
  .replace(/<\/html>\s*/i, '')
  .replace(/<head>\s*/i, '')
  .replace(/<\/head>\s*/i, '')
  .replace(/<body>\s*/i, '')
  .replace(/<\/body>\s*/i, '')
  .replace(/<meta charset="utf-8">\s*/i, '')
  .replace(/<meta name="viewport"[^>]*>\s*/i, '');
for (const href of cssLinks) page = page.replace(`<link rel="stylesheet" href="${href}">\n`, '');
page = page.replace('</noscript>', () => `</noscript>\n<style>\n${css}\n</style>`);
// Function replacements: the bundle contains `$'` sequences that string replacements would expand.
page = page.replace('<script type="module" src="js/main.js"></script>', () => `<script type="module">\n${js}\n</script>`);
fs.writeFileSync(path.join(out, 'index.html'), page);

// Images: only the launch figures (not Sheet B, not the source sheets).
const figDir = path.join(root, 'assets', 'figures');
const files = { 'CREDITS.md': 'CREDITS.md' };
for (const name of fs.readdirSync(figDir)) {
  if (!name.endsWith('.png')) continue;
  fs.copyFileSync(path.join(figDir, name), path.join(out, 'assets', 'figures', name));
  files[`assets/figures/${name}`] = `assets/figures/${name}`;
}
fs.copyFileSync(path.join(root, 'CREDITS.md'), path.join(out, 'CREDITS.md'));
fs.writeFileSync(path.join(out, 'files.json'), JSON.stringify(files, null, 2));

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
const imgBytes = Object.keys(files).reduce((s, f) => s + fs.statSync(path.join(out, f)).size, 0);
console.log(`page ${kb(Buffer.byteLength(page))} (js ${kb(js.length)}, css ${kb(css.length)}), ${Object.keys(files).length} files ${kb(imgBytes)}`);

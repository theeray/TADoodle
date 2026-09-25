import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
let html = readFileSync('dist/index.html', 'utf8');
const jsPath = html.match(/<script type="module" crossorigin src="([^"]+)"><\/script>/)[1];
const cssPath = html.match(/<link rel="stylesheet" crossorigin href="([^"]+)">/)[1];
let js = readFileSync(resolve('dist', jsPath), 'utf8');
const css = readFileSync(resolve('dist', cssPath), 'utf8');
for (const [asset, mime] of [['tadoodle-logo.svg','image/svg+xml'],['source.zip','application/zip'],['LICENSE','text/plain']]) {
  const data = `data:${mime};base64,${readFileSync(`dist/${asset}`).toString('base64')}`;
  const literal = JSON.stringify(`./${asset}`);
  if (!js.includes(literal)) throw new Error(`Missing bundled reference: ${asset}`);
  js = js.replaceAll(literal, JSON.stringify(data));
}
const icon = `data:image/png;base64,${readFileSync('dist/favicon.png').toString('base64')}`;
html = html.replaceAll('./favicon.png', icon)
  .replace(/<script type="module" crossorigin src="[^"]+"><\/script>/, () => `<script type="module">${js.replaceAll('</script','<\\/script')}</script>`)
  .replace(/<link rel="stylesheet" crossorigin href="[^"]+">/, () => `<style>${css}</style>`);
writeFileSync(process.argv[2] || 'TADoodle-preview.html', html);

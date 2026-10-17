// Renders web/src/app/icon.svg into windows/career-ops.ico (PNG-in-ICO, 256/48/32/16).
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const svg = readFileSync(join(here, '..', 'web', 'src', 'app', 'icon.svg'), 'utf8');
const sizes = [256, 48, 32, 16];
const browser = await chromium.launch();
const pngs = [];
for (const s of sizes) {
  const page = await browser.newPage({ viewport: { width: s, height: s } });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace(/width="96" height="96"/, `width="${s}" height="${s}"`)}</body></html>`);
  pngs.push(await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: s, height: s } }));
  await page.close();
}
await browser.close();
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
sizes.forEach((s, i) => {
  const e = 6 + 16 * i;
  header.writeUInt8(s === 256 ? 0 : s, e); header.writeUInt8(s === 256 ? 0 : s, e + 1);
  header.writeUInt16LE(1, e + 4); header.writeUInt16LE(32, e + 6);
  header.writeUInt32LE(pngs[i].length, e + 8); header.writeUInt32LE(offset, e + 12);
  offset += pngs[i].length;
});
writeFileSync(join(here, 'career-ops.ico'), Buffer.concat([header, ...pngs]));
console.log('wrote windows/career-ops.ico');

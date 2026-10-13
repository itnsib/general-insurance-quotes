import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import chromium from '@sparticuz/chromium';
import puppeteer, { type HTTPRequest } from 'puppeteer-core';

// Turns the comparison document into a real PDF with headless Chromium, as the
// IM tool does. The browser used to rasterise each page with html2canvas,
// which gave images of text rather than selectable text, files large enough to
// press on Vercel's 4.5 MB body limit, and output that varied with the
// advisor's browser. Server-only.

// The document's images are site paths ("/nsib-logo.png"). They resolve
// against this made-up origin and are answered from public/ on disk, so the
// HTML sent here stays small and nothing has to be fetched over the network.
const ASSET_ORIGIN = 'https://pdf-assets.invalid';

// The only network requests the page may make. This app has no sign-in, so the
// HTML could come from anyone: without this the server's browser would fetch
// whatever URL it was handed, including internal ones.
const ALLOWED_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com']);

// Only the PDF's brand artwork (public/pdf/) and insurer logos are served, by
// exact pattern, so a crafted path can't read anything else off the server's disk.
const PUBLIC_ASSET = /^\/(?:pdf|insurers)\/[\w-]+\.(?:png|jpe?g)$/;
const CONTENT_TYPES: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };

// Laid on top of the document's own stylesheet for the PDF only; the HTML
// download and the browser's print keep their own look.
//
// Fonts: the document asks for Segoe UI, which Vercel's Linux servers don't
// have. Open Sans is a close humanist match and is loaded from Google Fonts so
// the PDF looks the same wherever it's made. The Noto families cover what Open
// Sans lacks — the cover's ★ rating and Arabic customer names.
const PDF_HEAD = `
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700;800&family=Noto+Sans+Arabic:wght@400;700&family=Noto+Sans+Symbols+2&display=block">
<style>
  /* No printer margin: the sheets carry their own padding and cream ground,
     so the colour bleeds to every edge as it did in the rasterised PDF. */
  @page { size: A4 portrait; margin: 0; }
  html, body { background: var(--cream); }
  body { font-family: "Open Sans", "Noto Sans Arabic", "Noto Sans Symbols 2", "Segoe UI", Arial, sans-serif; }

  /* On-screen page furniture off. */
  .sheet { margin: 0; border: 0; box-shadow: none; overflow: visible; }
  .cover-sheet { margin: 0; overflow: hidden; break-after: page; }
  .sheet + .sheet { break-before: page; }

  /* A comparison running onto further pages repeats its top padding there, so
     continued rows don't start hard against the paper edge. */
  .comparison-sheet { -webkit-box-decoration-break: clone; box-decoration-break: clone; }

  /* Rows are never sawn in half, and the insurer headers repeat on each page. */
  .cmp-table thead { display: table-header-group; }
  .cmp-table tr { break-inside: avoid; }
</style>`;

const A4_RATIO = 297 / 210;
// The floor on printed body type. Fitting a sheet onto one page shrinks its
// text, so this — not an arbitrary ratio — limits how hard it may be squeezed.
const MIN_EFFECTIVE_FONT_PT = 7;

export async function renderPdf(html: string): Promise<Buffer> {
  // @sparticuz/chromium is a Linux build for Vercel. Anywhere else — a
  // developer's Windows machine running `npm run dev` — use the installed browser.
  const onVercelLinux = process.platform === 'linux';
  const browser = await puppeteer.launch({
    args: onVercelLinux ? chromium.args : [],
    executablePath: onVercelLinux ? await chromium.executablePath() : localBrowserPath(),
    headless: true,
    // A4 portrait at 96dpi, so the layout measured below is the printed one.
    defaultViewport: { width: 794, height: 1123, deviceScaleFactor: 1 },
  });

  try {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      void answer(request).catch(() => request.abort().catch(() => {}));
    });

    // Screen styles, not the print ones: the print stylesheet is tuned for an
    // advisor printing the HTML on paper with margins.
    await page.emulateMediaType('screen');
    // The base goes first so every image path resolves against it; the PDF
    // styles go last so they win over the document's own.
    const withHead = html
      .replace(/<head>/i, `<head><base href="${ASSET_ORIGIN}/">`)
      .replace(/<\/head>/i, `${PDF_HEAD}</head>`);
    // Waits for the logos and web fonts; without it the first render can go to
    // PDF before they arrive.
    await page.setContent(withHead, { waitUntil: 'load', timeout: 30000 });
    await page.waitForNetworkIdle({ idleTime: 300, timeout: 15000 }).catch(() => {});
    await page.evaluate(() => document.fonts.ready.then(() => undefined));

    await page.evaluate(fitSheetsToOnePage, A4_RATIO, MIN_EFFECTIVE_FONT_PT);

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
    });
    return Buffer.from(pdf);
  } finally {
    // Leaving a browser open leaks the whole serverless instance's memory.
    await browser.close().catch(() => {});
  }
}

async function answer(request: HTTPRequest) {
  const url = new URL(request.url());
  if (url.protocol === 'data:') return request.continue();

  if (url.origin === ASSET_ORIGIN) {
    const assetPath = decodeURIComponent(url.pathname);
    if (!PUBLIC_ASSET.test(assetPath)) return request.abort();
    const body = await fs.readFile(path.join(process.cwd(), 'public', assetPath)).catch(() => null);
    if (!body) return request.abort();
    const contentType = CONTENT_TYPES[path.extname(assetPath).toLowerCase()] || 'application/octet-stream';
    return request.respond({ status: 200, contentType, body });
  }

  if (url.protocol === 'https:' && ALLOWED_HOSTS.has(url.hostname)) return request.continue();
  return request.abort();
}

// Runs inside the page. A sheet running a little past one page would otherwise
// throw a near-empty extra page for the sake of a couple of rows, so it is laid
// out wider — its content reflows shorter — until its proportions match A4,
// then zoomed back to page width. Stepped rather than solved for: widening
// reflows text, so height falls in discrete jumps as lines rewrap, and walking
// up in small steps returns the smallest width that fits, keeping the type as
// large as possible. A sheet that can't fit without dropping below the type
// floor is left to paginate.
function fitSheetsToOnePage(ratio: number, minFontPt: number) {
  const sheets = Array.from(document.querySelectorAll<HTMLElement>('.sheet:not(.cover-sheet)'));
  for (const sheet of sheets) {
    const base = sheet.getBoundingClientRect().width;
    if (sheet.scrollHeight <= base * ratio + 2) continue;

    const table = sheet.querySelector('.cmp-table');
    const fontPx = table ? parseFloat(getComputedStyle(table).fontSize) : 12;
    const maxFactor = Math.max(1, fontPx / (minFontPt * (96 / 72)));

    let fitted = 0;
    for (let factor = 1; factor <= maxFactor + 1e-9; factor += 0.02) {
      const width = Math.round(base * factor);
      sheet.style.width = `${width}px`;
      if (sheet.scrollHeight <= width * ratio + 2) {
        fitted = width;
        break;
      }
    }

    if (!fitted) {
      sheet.style.width = '';
      continue;
    }
    // Exactly one page tall once zoomed, so the cream ground fills the page
    // and nothing spills onto a second one.
    sheet.style.minHeight = `${Math.floor(fitted * ratio)}px`;
    sheet.style.height = `${Math.floor(fitted * ratio)}px`;
    sheet.style.overflow = 'hidden';
    sheet.style.setProperty('zoom', String(base / fitted));
  }
}

// Chrome or Edge for local development; CHROME_PATH overrides when it lives elsewhere.
function localBrowserPath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  if (process.platform === 'darwin') {
    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  }
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  return candidates.find((p) => existsSync(p)) || candidates[0];
}

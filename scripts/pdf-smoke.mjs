// Chromium smoke check: a PDF made with pdf-lib renders in the real PdfViewer (pdf.js, worker, canvas).
// Needs a production build (`npm run build`) and Playwright with a Chromium; the Core API is faked
// in the browser, so no backend is needed.   Usage: node scripts/pdf-smoke.mjs [screenshot.png]
// PLAYWRIGHT_MODULE can point at an installed playwright package; PLAYWRIGHT_BROWSERS_PATH at its browsers.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const port = 3117;
const origin = `http://localhost:${port}`;

async function makePdf(pages) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let index = 1; index <= pages; index++) {
    const page = doc.addPage([612, 792]);
    page.drawText(`Smoke statement page ${index}`, { x: 72, y: 700, size: 28, font });
  }
  return Buffer.from(await doc.save());
}

const json = (route, body, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const server = spawn('npx', ['next', 'start', '-p', String(port)], { stdio: 'ignore' });
let browser;
try {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (
      await fetch(origin).then(
        (response) => response.ok || response.status < 500,
        () => false
      )
    )
      break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  const pdf = await makePdf(3);
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 800 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const iframes = [];
  await page.route('**/api/v1/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/v1/me')
      return json(route, { status: 401, error_code: 'UNAUTHENTICATED', message: 'Sign in.', request_id: 'r' }, 401);
    if (url.pathname === '/api/v1/spaces/team')
      return json(route, {
        id: 's',
        name: 'Team',
        slug: 'team',
        description: '',
        visibility: 'public',
        is_personal: false,
        archived_at: null,
        created_at: '2026-10-11T00:00:00Z',
        my_role: null,
      });
    if (url.pathname === '/api/v1/spaces/team/problems/sum/statement.pdf')
      return route.fulfill({ status: 200, contentType: 'application/pdf', body: pdf });
    if (url.pathname === '/api/v1/spaces/team/problems/sum')
      return json(route, {
        id: 'p',
        slug: 'sum',
        status: 'published',
        space: { name: 'Team', slug: 'team' },
        title: 'Sum',
        statement: '',
        statement_mode: 'pdf',
        statement_pdf: { size_bytes: pdf.length, pages: 3 },
        version_number: 1,
        time_limit_ms: 1000,
        memory_limit_kb: 262144,
        allowed_languages: ['cpp'],
        samples: [{ position: 1, input: '1 2\n', output: '3\n' }],
        accepts_submissions: true,
        created_by: { username: 'e', display_name: 'Edith', avatar_url: null },
        published_at: '2026-10-11T00:00:00Z',
      });
    return json(route, { status: 404, error_code: 'NOT_FOUND', message: 'Not found', request_id: 'r' }, 404);
  });
  await page.goto(`${origin}/spaces/team/problems/sum`);
  await page.getByText('Page 1 of 3').waitFor({ timeout: 30000 });
  // Drawn pixels: the first canvas must contain dark (text) pixels on its white page.
  const drawn = await page.waitForFunction(
    () => {
      const canvas = document.querySelector('.vd-pdf__canvas');
      if (!canvas || !canvas.width) return false;
      const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let dark = 0;
      for (let i = 0; i < data.length; i += 4) if (data[i] < 100 && data[i + 3] > 0) dark++;
      return dark > 50;
    },
    null,
    { timeout: 30000 }
  );
  await drawn.dispose();
  iframes.push(
    ...(await page
      .locator('iframe, object, embed')
      .count()
      .then((count) => (count ? ['found'] : [])))
  );
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await page.getByText('125%').waitFor();
  await page.getByText('Examples').waitFor();
  if (process.argv[2]) await page.screenshot({ path: process.argv[2], fullPage: true });
  if (errors.length) throw new Error(`page errors: ${errors.join('; ')}`);
  if (iframes.length) throw new Error('the PDF was embedded with iframe/object/embed');
  console.log('pdf smoke check passed: 3-page PDF drawn by pdf.js in Chromium, zoom works, examples shown');
} finally {
  await browser?.close();
  server.kill();
}

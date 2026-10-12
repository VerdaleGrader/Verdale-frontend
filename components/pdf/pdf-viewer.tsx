'use client';

import { Minus, Plus, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Loading } from '@/components/states/states';
import { Button } from '@/components/ui/button';

/** The part of pdf.js this viewer uses, so tests can stand in for it. */
interface PdfPage {
  getViewport: (options: { scale: number }) => { width: number; height: number };
  render: (options: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => { promise: Promise<unknown> };
}
interface PdfDocument {
  numPages: number;
  getPage: (number: number) => Promise<PdfPage>;
}

async function loadPdfJs() {
  const pdfjs = await import('pdfjs-dist');
  // The worker is a separate file the bundler serves; it parses and draws off the main thread.
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  return pdfjs;
}

type State = { kind: 'loading' } | { kind: 'ready'; document: PdfDocument } | { kind: 'failed'; reason: string };

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const STEP = 0.25;

/**
 * Shows a PDF statement page by page with pdf.js (GRD-74).
 *
 * The file is fetched with the session cookie (it is not public) and handed to pdf.js as bytes.
 * Each page is a canvas sized to the box at the chosen zoom; wider pages scroll sideways, which is
 * also how a phone pans a zoomed page (and the browser's own pinch zoom still works). In the dark
 * theme the pages are inverted by CSS. Nothing inside the PDF can run: pdf.js draws pixels only.
 * When the file cannot be loaded or drawn, the reader gets a message and a way to open it directly.
 */
export function PdfViewer({ url, title, pages }: { url: string; title: string; pages?: number }) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [zoom, setZoom] = useState(1);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    // pdf.js frees the document through the loading task; the document itself has no destroy().
    let task: { destroy: () => Promise<void> } | null = null;
    (async () => {
      try {
        const response = await fetch(url, { credentials: 'include' });
        if (!response.ok) {
          throw new Error(
            response.status === 404 ? 'The PDF is not available.' : `The server answered ${response.status}.`
          );
        }
        const data = new Uint8Array(await response.arrayBuffer());
        const pdfjs = await loadPdfJs();
        const loading = pdfjs.getDocument({ data });
        task = loading;
        const document = (await loading.promise) as unknown as PdfDocument;
        if (cancelled) return;
        setState({ kind: 'ready', document });
      } catch (error) {
        if (!cancelled) {
          setState({ kind: 'failed', reason: error instanceof Error ? error.message : 'Unknown error.' });
        }
      }
    })();
    return () => {
      cancelled = true;
      if (task) void task.destroy();
    };
  }, [url, attempt]);

  const failed = useCallback((reason: string) => setState({ kind: 'failed', reason }), []);

  if (state.kind === 'loading') {
    return (
      <div className="vd-pdf">
        <Loading label="Loading the PDF" />
      </div>
    );
  }
  if (state.kind === 'failed') {
    return (
      <div role="alert" className="vd-pdf bg-danger-soft rounded-md p-4">
        <p className="text-danger text-body-strong">The PDF could not be shown.</p>
        <p className="text-small">
          {state.reason} You can{' '}
          <a href={url} target="_blank" rel="noopener noreferrer" className="vd-link">
            open it in a new tab
          </a>{' '}
          or try again.
        </p>
        <div>
          <Button
            size="sm"
            onClick={() => {
              setState({ kind: 'loading' });
              setAttempt((current) => current + 1);
            }}
          >
            <RotateCcw aria-hidden />
            Try again
          </Button>
        </div>
      </div>
    );
  }

  const count = state.document.numPages;
  return (
    <div className="vd-pdf">
      <div className="vd-pdf__bar" role="group" aria-label="PDF controls">
        <Button
          size="sm"
          aria-label="Zoom out"
          disabled={zoom <= MIN_ZOOM}
          onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - STEP))}
        >
          <Minus aria-hidden />
        </Button>
        <span className="text-small text-text-muted vd-mono" aria-live="polite">
          {Math.round(zoom * 100)}%
        </span>
        <Button
          size="sm"
          aria-label="Zoom in"
          disabled={zoom >= MAX_ZOOM}
          onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + STEP))}
        >
          <Plus aria-hidden />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setZoom(1)} disabled={zoom === 1}>
          Fit width
        </Button>
        <span className="text-small text-text-muted ml-auto">
          {count} {count === 1 ? 'page' : 'pages'} ·{' '}
          <a href={url} target="_blank" rel="noopener noreferrer" className="vd-link">
            Open in a new tab
          </a>
        </span>
      </div>
      <div ref={box} className="vd-pdf__scroll" role="region" aria-label={`${title} (PDF)`} tabIndex={0}>
        <div className="vd-pdf__pages">
          {Array.from({ length: pages && pages < count ? pages : count }, (_, index) => (
            <PdfPageCanvas
              key={index}
              document={state.document}
              number={index + 1}
              total={count}
              zoom={zoom}
              boxWidth={() => box.current?.clientWidth ?? 640}
              onError={failed}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function PdfPageCanvas({
  document: pdf,
  number,
  total,
  zoom,
  boxWidth,
  onError,
}: {
  document: PdfDocument;
  number: number;
  total: number;
  zoom: number;
  boxWidth: () => number;
  onError: (reason: string) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const page = await pdf.getPage(number);
        const element = canvas.current;
        const context = element?.getContext('2d');
        if (cancelled || !element || !context) return;
        const base = page.getViewport({ scale: 1 });
        // One page is as wide as the box at 100%; zoom scales from there.
        const scale = ((boxWidth() - 24) / base.width) * zoom;
        const viewport = page.getViewport({ scale: Math.max(scale, 0.1) });
        const ratio = window.devicePixelRatio || 1;
        element.width = Math.floor(viewport.width * ratio);
        element.height = Math.floor(viewport.height * ratio);
        element.style.width = `${Math.floor(viewport.width)}px`;
        element.style.height = `${Math.floor(viewport.height)}px`;
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        await page.render({ canvasContext: context, viewport }).promise;
      } catch (error) {
        if (!cancelled) onError(error instanceof Error ? error.message : 'A page could not be drawn.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdf, number, zoom, boxWidth, onError]);

  return <canvas ref={canvas} className="vd-pdf__canvas" role="img" aria-label={`Page ${number} of ${total}`} />;
}

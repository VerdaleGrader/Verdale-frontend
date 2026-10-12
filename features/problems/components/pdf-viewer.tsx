'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, FileWarning, LoaderCircle, Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { formatBytes } from '@/lib/format';
import { loadPdf, type PdfDocument } from '../pdf/load-pdf';

export interface PdfViewerProps {
  /** Gets the file's bytes (with the session cookie). */
  load: () => Promise<ArrayBuffer>;
  /** A plain link, so the browser saves the file; the PDF is never opened inside our own page. */
  downloadHref: string;
  /** Changes when the file changes, so the viewer loads it again. */
  fileKey: string;
  sizeBytes?: number;
}

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];

type Loaded = { status: 'loading' } | { status: 'ready'; document: PdfDocument } | { status: 'error'; error: unknown };

/** The outcome of one load, tagged with the load it belongs to so an older one is never shown. */
type Outcome = { id: string; result: Exclude<Loaded, { status: 'loading' }> };

/**
 * A PDF statement drawn page by page on canvases with pdf.js. Nothing is embedded
 * with iframe or object, and scripts inside the PDF never run. Pages are drawn
 * when they come near the screen. Zoom is relative to the width of the box ("fit width").
 */
export function PdfViewer({ load, downloadHref, fileKey, sizeBytes }: PdfViewerProps) {
  const [attempt, setAttempt] = useState(0);
  const loadId = `${fileKey}#${attempt}`;
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const state: Loaded = outcome?.id === loadId ? outcome.result : { status: 'loading' };
  const [zoom, setZoom] = useState(1);
  const [current, setCurrent] = useState(1);
  const [width, setWidth] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let opened: PdfDocument | undefined;
    load()
      .then(loadPdf)
      .then(
        (document) => {
          if (cancelled) return document.destroy();
          opened = document;
          setOutcome({ id: loadId, result: { status: 'ready', document } });
        },
        (error: unknown) => !cancelled && setOutcome({ id: loadId, result: { status: 'error', error } })
      );
    return () => {
      cancelled = true;
      opened?.destroy();
    };
    // `load` is a fresh closure every render; only the file (and a retry) decides when to load again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadId]);

  // The width the pages fit into, kept up to date as the window or the layout changes.
  const ready = state.status === 'ready';
  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const measure = () => setWidth(element.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ready]);

  const zoomBy = (direction: 1 | -1) => {
    const index = ZOOM_STEPS.findIndex((step) => step >= zoom - 1e-6);
    const next = Math.min(Math.max((index < 0 ? ZOOM_STEPS.length - 1 : index) + direction, 0), ZOOM_STEPS.length - 1);
    setZoom(ZOOM_STEPS[next]!);
  };

  const download = (
    <a className="vd-link inline-flex items-center gap-1" href={downloadHref} download>
      <Download className="size-4" strokeWidth={1.75} aria-hidden />
      Download PDF{sizeBytes ? ` (${formatBytes(sizeBytes)})` : ''}
    </a>
  );

  if (state.status === 'loading') {
    return (
      <div className="vd-pdf__status" role="status">
        <LoaderCircle className="vd-spin mx-auto mb-2 size-5" strokeWidth={1.75} aria-hidden />
        Loading the PDF statement…
      </div>
    );
  }
  if (state.status === 'error') {
    const missing = state.error instanceof ApiError && state.error.status === 404;
    return (
      <div className="vd-pdf__status flex flex-col items-center gap-3" role="alert">
        <FileWarning className="size-5" strokeWidth={1.75} aria-hidden />
        <p>
          {missing
            ? 'The PDF statement is not available.'
            : 'The PDF statement could not be shown here. You can still download it and read it on your device.'}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          {!missing && download}
          <button type="button" className="vd-link" onClick={() => setAttempt((count) => count + 1)}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  const { document } = state;
  const total = document.pages.length;
  return (
    <div className="vd-pdf">
      <div className="vd-pdf__toolbar" role="toolbar" aria-label="PDF controls">
        <span role="status" aria-live="polite">
          Page {Math.min(current, total)} of {total}
        </span>
        <span className="vd-pdf__spacer" />
        <button type="button" className="vd-iconbtn" aria-label="Zoom out" onClick={() => zoomBy(-1)}>
          <ZoomOut className="size-4" strokeWidth={1.75} aria-hidden />
        </button>
        <span aria-label="Zoom" className="vd-mono min-w-[4ch] text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button type="button" className="vd-iconbtn" aria-label="Zoom in" onClick={() => zoomBy(1)}>
          <ZoomIn className="size-4" strokeWidth={1.75} aria-hidden />
        </button>
        <button type="button" className="vd-iconbtn" aria-label="Fit width" onClick={() => setZoom(1)}>
          <Maximize2 className="size-4" strokeWidth={1.75} aria-hidden />
        </button>
        {download}
      </div>
      <div ref={box} className="vd-pdf__scroll" tabIndex={0} role="region" aria-label="PDF statement">
        <div className="vd-pdf__pages">
          {document.pages.map((size, index) => (
            <PdfPage
              key={index}
              document={document}
              number={index + 1}
              // Fit width: the box minus its padding (12px each side) and the page border.
              scale={(Math.max(width - 26, 120) / size.width) * zoom}
              size={size}
              onNear={setCurrent}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** One page: an empty frame of the right size until it nears the screen, then drawn on a canvas. */
function PdfPage({
  document,
  number,
  scale,
  size,
  onNear,
}: {
  document: PdfDocument;
  number: number;
  scale: number;
  size: { width: number; height: number };
  onNear: (number: number) => void;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === 'undefined');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setSeen(true);
          if (entry.intersectionRatio >= 0.5) onNear(number);
        }
      },
      { rootMargin: '600px 0px', threshold: [0, 0.5] }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [number, onNear]);

  useEffect(() => {
    if (!seen || !canvas.current) return;
    const job = document.render(number, canvas.current, scale);
    setFailed(false);
    job.done.catch((error: unknown) => {
      // A render stopped by a newer zoom is not a failure.
      if (!(error instanceof Error && error.name === 'RenderingCancelledException')) setFailed(true);
    });
    return job.cancel;
  }, [seen, document, number, scale]);

  return (
    <div
      ref={frame}
      className="vd-pdf__page"
      style={{ width: size.width * scale, height: size.height * scale }}
      role="group"
      aria-label={`Page ${number}`}
    >
      <canvas ref={canvas} className="vd-pdf__canvas" aria-hidden />
      {failed && <p className="vd-pdf__status">This page could not be drawn.</p>}
    </div>
  );
}

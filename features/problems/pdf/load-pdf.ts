/**
 * The only file that touches pdf.js, so tests replace it and the library stays
 * out of the first page load (it is imported when a PDF statement is opened).
 * Nothing here runs scripts from the PDF: pdf.js only draws pages to a canvas,
 * and eval is switched off for fonts.
 */
export interface PdfPageSize {
  /** At scale 1, in CSS pixels. */
  width: number;
  height: number;
}

export interface PdfDocument {
  pages: PdfPageSize[];
  /** Draws page `number` (1-based) into `canvas` at `scale`; the returned function stops it. */
  render: (number: number, canvas: HTMLCanvasElement, scale: number) => { done: Promise<void>; cancel: () => void };
  destroy: () => void;
}

export async function loadPdf(data: ArrayBuffer): Promise<PdfDocument> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  const task = pdfjs.getDocument({ data, isEvalSupported: false, enableXfa: false });
  const document = await task.promise;
  const pages = await Promise.all(
    Array.from({ length: document.numPages }, async (_, index) => {
      const view = (await document.getPage(index + 1)).getViewport({ scale: 1 });
      return { width: view.width, height: view.height };
    })
  );
  return {
    pages,
    render(number, canvas, scale) {
      let task: { promise: Promise<void>; cancel: () => void } | undefined;
      let cancelled = false;
      const done = document.getPage(number).then(async (page) => {
        if (cancelled) return;
        const ratio = window.devicePixelRatio || 1;
        const viewport = page.getViewport({ scale: scale * ratio });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${Math.floor(viewport.width / ratio)}px`;
        canvas.style.height = `${Math.floor(viewport.height / ratio)}px`;
        task = page.render({ canvas, viewport });
        await task.promise;
      });
      return {
        done,
        cancel: () => {
          cancelled = true;
          task?.cancel();
        },
      };
    },
    destroy: () => void task.destroy(),
  };
}

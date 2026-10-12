import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const pdfjs = vi.hoisted(() => ({
  getDocument: vi.fn(),
  GlobalWorkerOptions: { workerSrc: '' },
}));
vi.mock('pdfjs-dist', () => pdfjs);

import { PdfViewer } from './pdf-viewer';

function fakeDocument(numPages: number) {
  return {
    numPages,
    getPage: vi.fn().mockResolvedValue({
      getViewport: ({ scale }: { scale: number }) => ({ width: 600 * scale, height: 800 * scale }),
      render: () => ({ promise: Promise.resolve() }),
    }),
  };
}

/** pdf.js's loading task: it owns destroy(); the document it resolves to has none. */
function fakeTask(promise: Promise<unknown>) {
  return { promise, destroy: vi.fn().mockResolvedValue(undefined) };
}

function respond(status: number, body = new Uint8Array([37, 80, 68, 70])) {
  // A new Response each time: a body can be read only once.
  return vi.fn().mockImplementation(async () => new Response(status === 200 ? body : 'nope', { status }));
}

beforeEach(() => {
  pdfjs.getDocument.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe('PdfViewer (GRD-74)', () => {
  it('fetches the file with the session cookie and shows one canvas per page, named for assistive technology', async () => {
    const fetchMock = respond(200);
    vi.stubGlobal('fetch', fetchMock);
    pdfjs.getDocument.mockReturnValue(fakeTask(Promise.resolve(fakeDocument(3))));
    render(<PdfViewer url="/api/v1/spaces/team/problems/sum/statement/pdf" title="Sum" />);
    expect(screen.getByText(/Loading the PDF/)).toBeTruthy();
    expect(await screen.findByRole('img', { name: 'Page 1 of 3' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Page 3 of 3' })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/spaces/team/problems/sum/statement/pdf', {
      credentials: 'include',
    });
    expect(screen.getByRole('region', { name: 'Sum (PDF)' })).toBeTruthy();
    expect(screen.getByText(/3 pages/)).toBeTruthy();
    expect(pdfjs.GlobalWorkerOptions.workerSrc).toContain('pdf.worker');
  });

  it('frees pdf.js through the loading task when it is left, which is the only object with destroy()', async () => {
    vi.stubGlobal('fetch', respond(200));
    const task = fakeTask(Promise.resolve(fakeDocument(1)));
    pdfjs.getDocument.mockReturnValue(task);
    const { unmount } = render(<PdfViewer url="/x.pdf" title="Sum" />);
    await screen.findByRole('img', { name: 'Page 1 of 1' });
    expect(() => unmount()).not.toThrow();
    expect(task.destroy).toHaveBeenCalled();
  });

  it('can be zoomed in and out within limits and reset to fit the width', async () => {
    vi.stubGlobal('fetch', respond(200));
    pdfjs.getDocument.mockReturnValue(fakeTask(Promise.resolve(fakeDocument(1))));
    render(<PdfViewer url="/x.pdf" title="Sum" />);
    await screen.findByRole('img', { name: 'Page 1 of 1' });
    const zoomIn = screen.getByRole('button', { name: 'Zoom in' });
    const zoomOut = screen.getByRole('button', { name: 'Zoom out' }) as HTMLButtonElement;
    expect(screen.getByText('100%')).toBeTruthy();
    await userEvent.click(zoomIn);
    expect(screen.getByText('125%')).toBeTruthy();
    await userEvent.click(zoomOut);
    await userEvent.click(zoomOut);
    expect(screen.getByText('75%')).toBeTruthy();
    for (let index = 0; index < 5; index++) await userEvent.click(zoomOut);
    expect(screen.getByText('50%')).toBeTruthy();
    expect(zoomOut.disabled).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: 'Fit width' }));
    expect(screen.getByText('100%')).toBeTruthy();
  });

  it('shows a clear message and a way out when the file is not available', async () => {
    vi.stubGlobal('fetch', respond(404));
    render(<PdfViewer url="/gone.pdf" title="Sum" />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('The PDF could not be shown.');
    expect(alert.textContent).toContain('The PDF is not available.');
    expect((screen.getByRole('link', { name: 'open it in a new tab' }) as HTMLAnchorElement).getAttribute('href')).toBe(
      '/gone.pdf'
    );
    expect(pdfjs.getDocument).not.toHaveBeenCalled();
  });

  it('shows the same fallback when pdf.js cannot read the file, and Try again loads it again', async () => {
    vi.stubGlobal('fetch', respond(200));
    pdfjs.getDocument.mockReturnValueOnce(fakeTask(Promise.reject(new Error('Invalid PDF structure.'))));
    pdfjs.getDocument.mockReturnValueOnce(fakeTask(Promise.resolve(fakeDocument(1))));
    render(<PdfViewer url="/x.pdf" title="Sum" />);
    expect((await screen.findByRole('alert')).textContent).toContain('Invalid PDF structure.');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('img', { name: 'Page 1 of 1' })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the fallback on a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    render(<PdfViewer url="/x.pdf" title="Sum" />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  });

  it('draws pages with the dark-theme class that the stylesheet inverts', async () => {
    vi.stubGlobal('fetch', respond(200));
    pdfjs.getDocument.mockReturnValue(fakeTask(Promise.resolve(fakeDocument(1))));
    render(<PdfViewer url="/x.pdf" title="Sum" />);
    const canvas = await screen.findByRole('img', { name: 'Page 1 of 1' });
    expect(canvas.className).toContain('vd-pdf__canvas');
  });
});

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';

const pdf = vi.hoisted(() => ({
  loadPdf: vi.fn(),
  render: vi.fn(),
  destroy: vi.fn(),
}));
vi.mock('../pdf/load-pdf', () => ({ loadPdf: pdf.loadPdf }));

import { PdfViewer } from './pdf-viewer';

beforeEach(() => {
  vi.clearAllMocks();
  pdf.render.mockImplementation(() => ({ done: Promise.resolve(), cancel: vi.fn() }));
  pdf.loadPdf.mockResolvedValue({
    pages: [
      { width: 600, height: 800 },
      { width: 600, height: 800 },
      { width: 600, height: 800 },
    ],
    render: pdf.render,
    destroy: pdf.destroy,
  });
});

const props = { fileKey: 'a', downloadHref: '/api/x/statement.pdf', sizeBytes: 2048 };
const bytes = () => Promise.resolve(new ArrayBuffer(8));

describe('the PDF viewer', () => {
  it('shows a loading state, then the pages with a count, drawn on canvases', async () => {
    render(<PdfViewer {...props} load={bytes} />);
    expect(screen.getByRole('status').textContent).toContain('Loading the PDF statement');
    expect(await screen.findByText('Page 1 of 3')).toBeTruthy();
    expect(screen.getAllByRole('group', { name: /^Page \d$/ })).toHaveLength(3);
    // No IntersectionObserver in jsdom: every page counts as near the screen.
    await waitFor(() => expect(pdf.render).toHaveBeenCalledTimes(3));
    expect(pdf.render.mock.calls[0]![1]).toBeInstanceOf(HTMLCanvasElement);
  });

  it('never embeds the file: no iframe, object or embed, and a plain download link', async () => {
    const { container } = render(<PdfViewer {...props} load={bytes} />);
    await screen.findByText('Page 1 of 3');
    expect(container.querySelector('iframe, object, embed')).toBeNull();
    const link = screen.getByRole('link', { name: /Download PDF \(2 KiB\)/ });
    expect(link.getAttribute('href')).toBe('/api/x/statement.pdf');
    expect(link.hasAttribute('download')).toBe(true);
  });

  it('zooms in and out and goes back to fit width, redrawing at the new scale', async () => {
    render(<PdfViewer {...props} load={bytes} />);
    await screen.findByText('Page 1 of 3');
    expect(screen.getByLabelText('Zoom').textContent).toBe('100%');
    const firstScale = pdf.render.mock.calls[0]![2] as number;
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(screen.getByLabelText('Zoom').textContent).toBe('125%');
    await waitFor(() => expect(pdf.render.mock.calls.at(-1)![2]).toBeCloseTo(firstScale * 1.25));
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    expect(screen.getByLabelText('Zoom').textContent).toBe('75%');
    fireEvent.click(screen.getByRole('button', { name: 'Fit width' }));
    expect(screen.getByLabelText('Zoom').textContent).toBe('100%');
  });

  it('keeps the zoom inside its limits', async () => {
    render(<PdfViewer {...props} load={bytes} />);
    await screen.findByText('Page 1 of 3');
    for (let i = 0; i < 10; i++) fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(screen.getByLabelText('Zoom').textContent).toBe('300%');
    for (let i = 0; i < 10; i++) fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    expect(screen.getByLabelText('Zoom').textContent).toBe('50%');
  });

  it('falls back to a message with a download link when the file cannot be shown, and can retry', async () => {
    pdf.loadPdf.mockRejectedValueOnce(new Error('Invalid PDF structure'));
    render(<PdfViewer {...props} load={bytes} />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('could not be shown here');
    expect(screen.getByRole('link', { name: /Download PDF/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Page 1 of 3')).toBeTruthy();
  });

  it('says so when Core does not serve the file (404), without a download link', async () => {
    const load = () => Promise.reject(new ApiError(404, 'NOT_FOUND', 'Not found'));
    render(<PdfViewer {...props} load={load} />);
    expect((await screen.findByRole('alert')).textContent).toContain('The PDF statement is not available.');
    expect(screen.queryByRole('link', { name: /Download PDF/ })).toBeNull();
  });

  it('loads again when the file changes and frees the old document', async () => {
    const { rerender } = render(<PdfViewer {...props} load={bytes} />);
    await screen.findByText('Page 1 of 3');
    rerender(<PdfViewer {...props} fileKey="b" load={bytes} />);
    await waitFor(() => expect(pdf.loadPdf).toHaveBeenCalledTimes(2));
    expect(pdf.destroy).toHaveBeenCalled();
    await act(async () => undefined);
  });
});

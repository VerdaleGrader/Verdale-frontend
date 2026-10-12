import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Avatar } from './avatar';

describe('Avatar', () => {
  it('shows the picture when there is one', () => {
    render(<Avatar name="Ada Lovelace" src="https://example.com/ada.png" />);
    const image = screen.getByRole('img', { name: 'Ada Lovelace' }) as HTMLImageElement;
    expect(image.tagName).toBe('IMG');
    expect(image.getAttribute('src')).toBe('https://example.com/ada.png');
  });

  it.each([[undefined], [null], ['']])('falls back to the initials without a picture (%j)', (src) => {
    render(<Avatar name="Ada Lovelace" src={src} />);
    const fallback = screen.getByRole('img', { name: 'Ada Lovelace' });
    expect(fallback.tagName).toBe('SPAN');
    expect(fallback.textContent).toBe('AL');
  });

  it('falls back to the initials when the picture cannot be loaded', () => {
    render(<Avatar name="Ada Lovelace" src="https://example.com/gone.png" />);
    fireEvent.error(screen.getByRole('img', { name: 'Ada Lovelace' }));
    const fallback = screen.getByRole('img', { name: 'Ada Lovelace' });
    expect(fallback.tagName).toBe('SPAN');
    expect(fallback.textContent).toBe('AL');
  });

  it('tries a new picture address after a failed one', () => {
    const { rerender } = render(<Avatar name="Ada" src="https://example.com/gone.png" />);
    fireEvent.error(screen.getByRole('img', { name: 'Ada' }));
    rerender(<Avatar name="Ada" src="https://example.com/new.png" />);
    expect(screen.getByRole('img', { name: 'Ada' }).getAttribute('src')).toBe('https://example.com/new.png');
  });
});

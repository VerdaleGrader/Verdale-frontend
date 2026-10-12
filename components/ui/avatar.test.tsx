import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Avatar } from './avatar';

describe('Avatar (GRD-69)', () => {
  it('shows the picture when there is one, named after the person', () => {
    render(<Avatar name="Ada Lovelace" src="https://example.com/ada.png" />);
    const image = screen.getByRole('img', { name: 'Ada Lovelace' }) as HTMLImageElement;
    expect(image.tagName).toBe('IMG');
    expect(image.getAttribute('src')).toBe('https://example.com/ada.png');
    // The picture's host should not learn which page we are on.
    expect(image.getAttribute('referrerpolicy')).toBe('no-referrer');
  });

  it.each([undefined, null, ''])('falls back to initials when the picture is %j', (src) => {
    render(<Avatar name="Ada Lovelace" src={src} />);
    const fallback = screen.getByRole('img', { name: 'Ada Lovelace' });
    expect(fallback.tagName).toBe('SPAN');
    expect(fallback.textContent).toBe('AL');
  });

  it('falls back to initials when the picture does not load', () => {
    render(<Avatar name="Ada Lovelace" src="https://example.com/broken.png" />);
    fireEvent.error(screen.getByRole('img', { name: 'Ada Lovelace' }));
    const fallback = screen.getByRole('img', { name: 'Ada Lovelace' });
    expect(fallback.tagName).toBe('SPAN');
    expect(fallback.textContent).toBe('AL');
  });

  it('tries a new picture after the old one failed', () => {
    const { rerender } = render(<Avatar name="Ada" src="https://example.com/broken.png" />);
    fireEvent.error(screen.getByRole('img', { name: 'Ada' }));
    rerender(<Avatar name="Ada" src="https://example.com/fixed.png" />);
    expect(screen.getByRole('img', { name: 'Ada' }).tagName).toBe('IMG');
  });

  it('has a size for every place it is used', () => {
    render(<Avatar name="Ada" size="lg" />);
    expect(screen.getByRole('img', { name: 'Ada' }).className).toContain('vd-avatar--lg');
  });
});

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageContainer } from './page';

describe('PageContainer', () => {
  it('uses the normal side margins by default', () => {
    render(<PageContainer>content</PageContainer>);
    expect(screen.getByRole('main').className).toContain('px-6');
  });

  it('uses smaller side margins when tight (problem page and editor)', () => {
    render(<PageContainer tight>content</PageContainer>);
    const className = screen.getByRole('main').className;
    expect(className).toContain('px-3');
    expect(className).not.toContain('px-6');
  });
});

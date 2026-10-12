import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageContainer } from './page';

describe('PageContainer (GRD-71)', () => {
  it('the wide page has a narrower side gutter and a larger maximum than the standard page', () => {
    const standard = render(<PageContainer>x</PageContainer>).container.querySelector('main')!;
    const wide = render(<PageContainer wide>x</PageContainer>).container.querySelector('main')!;
    expect(standard.className).toContain('px-6');
    expect(standard.className).toContain('max-w-5xl');
    expect(wide.className).toContain('px-4');
    expect(wide.className).toContain('max-w-7xl');
    expect(wide.className).not.toContain('px-6');
    expect(wide.className).not.toContain('px-8');
  });

  it('wide wins over narrow, and every page gets the same gutter from one place', () => {
    const wide = render(
      <PageContainer wide narrow>
        x
      </PageContainer>
    ).container.querySelector('main')!;
    expect(wide.className).toContain('max-w-7xl');
    expect(wide.className).not.toContain('--measure');
  });
});

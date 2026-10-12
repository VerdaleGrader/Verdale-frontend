import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MarkdownView, isAllowedImageSource } from './markdown-view';

describe('MarkdownView', () => {
  it('renders Markdown: headings, lists, emphasis, code and tables', () => {
    const { container } = render(
      <MarkdownView
        source={
          '## Input\n\nThe **first** line has `n`.\n\n- one\n- two\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n```\n1 2\n```'
        }
      />
    );
    expect(container.querySelector('h2')?.textContent).toBe('Input');
    expect(container.querySelector('strong')?.textContent).toBe('first');
    expect(container.querySelectorAll('li')).toHaveLength(2);
    expect(container.querySelector('pre code')?.textContent).toContain('1 2');
    expect(container.querySelector('.vd-tablewrap table')).toBeTruthy();
  });

  it('typesets inline and display maths with KaTeX', () => {
    const { container } = render(<MarkdownView source={'Print $a + b$.\n\n$$\n\\sum_{i=1}^{n} i\n$$'} />);
    expect(container.querySelectorAll('.katex').length).toBeGreaterThanOrEqual(2);
    expect(container.querySelector('.katex-display')).toBeTruthy();
    expect(container.textContent).toContain('a');
  });

  it('shows a broken formula as text instead of throwing', () => {
    const { container } = render(<MarkdownView source={'Bad $\\frac{1$ formula'} />);
    expect(container.textContent).toContain('formula');
  });

  it('does not render raw HTML or run scripts', () => {
    const { container } = render(
      <MarkdownView
        source={'<script>window.__pwned = true</script><img src=x onerror="window.__pwned=true"><b>bold?</b>'}
      />
    );
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
    expect((window as unknown as { __pwned?: boolean }).__pwned).toBeUndefined();
  });

  it('drops javascript: links', () => {
    const { container } = render(
      <MarkdownView source={'[click](javascript:alert(1)) and [fine](https://example.com/page)'} />
    );
    const links = [...container.querySelectorAll('a')];
    expect(links.find((link) => link.textContent === 'click')?.getAttribute('href') ?? '').not.toMatch(/javascript:/i);
    const fine = links.find((link) => link.textContent === 'fine')!;
    expect(fine.getAttribute('href')).toBe('https://example.com/page');
    expect(fine.getAttribute('target')).toBe('_blank');
    expect(fine.getAttribute('rel')).toBe('noopener noreferrer nofollow');
  });

  it('shows pictures from Verdale’s own storage and nothing from elsewhere', () => {
    const { container } = render(
      <MarkdownView
        source={
          '![diagram](/api/v1/assets/0123456789abcdef0123456789abcdef.png)\n\n![tracker](https://evil.example/pixel.png)\n\n![sneaky](//evil.example/p.png)'
        }
      />
    );
    const images = container.querySelectorAll('img');
    expect(images).toHaveLength(1);
    expect(images[0]!.getAttribute('src')).toBe('/api/v1/assets/0123456789abcdef0123456789abcdef.png');
    expect(images[0]!.getAttribute('alt')).toBe('diagram');
    expect(container.textContent).toContain('external images are not shown');
    expect(container.querySelector('a[href="https://evil.example/pixel.png"]')?.getAttribute('rel')).toContain(
      'noopener'
    );
  });

  it('renders Thai text', () => {
    const { container } = render(<MarkdownView source={'## ข้อมูลนำเข้า\n\nอ่านจำนวนเต็ม $n$ หนึ่งจำนวน'} />);
    expect(container.querySelector('h2')?.textContent).toBe('ข้อมูลนำเข้า');
  });
});

describe('isAllowedImageSource', () => {
  it.each([
    ['/api/v1/assets/abc.png', true],
    ['/api/v1/assets/', true],
    ['https://evil.example/a.png', false],
    ['//evil.example/a.png', false],
    ['/other/path.png', false],
    ['data:image/png;base64,AAAA', false],
    ['', false],
    [undefined, false],
  ])('%s -> %s', (source, expected) => {
    expect(isAllowedImageSource(source)).toBe(expected);
  });
});

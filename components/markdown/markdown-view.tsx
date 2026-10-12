'use client';

import 'katex/dist/katex.min.css';
import ReactMarkdown, { type Components, defaultUrlTransform } from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

/**
 * Pictures a statement may show: the ones Core stores (served at /api/v1/assets
 * or from the public bucket's own domain). Any other address would let an
 * author see who reads a problem, so it is shown as a plain link instead.
 */
const ASSET_BASE = process.env.NEXT_PUBLIC_ASSET_BASE_URL?.replace(/\/$/, '');

export function isAllowedImageSource(source: string | undefined): boolean {
  if (!source) return false;
  if (source.startsWith('/api/v1/assets/')) return true;
  return Boolean(ASSET_BASE && source.startsWith(`${ASSET_BASE}/`));
}

const components: Components = {
  a({ href, children }) {
    const external = Boolean(href && /^https?:\/\//i.test(href));
    return (
      <a href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer nofollow' } : {})}>
        {children}
      </a>
    );
  },
  img({ src, alt }) {
    const source = typeof src === 'string' ? src : undefined;
    if (isAllowedImageSource(source)) {
      // eslint-disable-next-line @next/next/no-img-element -- author pictures have unknown sizes
      return <img src={source} alt={alt ?? ''} loading="lazy" />;
    }
    return source ? (
      <a href={source} target="_blank" rel="noopener noreferrer nofollow">
        {alt || 'External image'} (external images are not shown)
      </a>
    ) : null;
  },
  // Wide tables scroll on their own instead of the page.
  table({ children }) {
    return (
      <div className="vd-tablewrap">
        <table>{children}</table>
      </div>
    );
  },
};

/**
 * A problem statement: Markdown (GitHub flavour) with `$…$` and `$$…$$` maths
 * typeset by KaTeX. Raw HTML is never rendered, links use safe protocols
 * only, and pictures are limited to Verdale's own storage.
 */
export function MarkdownView({ source }: { source: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: 'ignore', trust: false }]]}
      components={components}
      urlTransform={defaultUrlTransform}
    >
      {source}
    </ReactMarkdown>
  );
}

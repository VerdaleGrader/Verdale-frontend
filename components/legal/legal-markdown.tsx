import ReactMarkdown, { type Components, defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { sectionId } from '@/lib/legal-content';

function textOf(children: React.ReactNode): string {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) return children.map(textOf).join('');
  return '';
}

const components: Components = {
  // Numbered headings get an anchor so the contents list and shared links land on them.
  h2({ children }) {
    return (
      <h2 id={sectionId(textOf(children))} className="scroll-mt-6">
        {children}
      </h2>
    );
  },
  a({ href, children }) {
    const external = Boolean(href && /^https?:\/\//i.test(href));
    return (
      <a href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer nofollow' } : {})}>
        {children}
      </a>
    );
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

/** The text of a legal document: Markdown (GitHub flavour) from content/legal, no raw HTML, no maths. */
export function LegalMarkdown({ source }: { source: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components} urlTransform={defaultUrlTransform}>
      {source}
    </ReactMarkdown>
  );
}

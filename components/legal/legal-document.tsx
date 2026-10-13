import type { LegalContent } from '@/lib/legal-content';
import { LegalMarkdown } from './legal-markdown';

function ContentsList({ sections }: { sections: LegalContent['sections'] }) {
  return (
    <ol>
      {sections.map((section) => (
        <li key={section.id}>
          <a href={`#${section.id}`}>{section.title}</a>
        </li>
      ))}
    </ol>
  );
}

/**
 * A reading page for the Terms or the Privacy Policy (Design System: LegalDocument).
 * Thai content in IBM Plex Sans Thai; contents list on the left from 1024px, collapsed above the text below that.
 */
export function LegalDocument({ content, effective }: { content: LegalContent; effective: string }) {
  return (
    <article className="vd-legal" lang="th">
      <header className="vd-legal__head">
        <h1>{content.title}</h1>
        <p className="vd-legal__effective">{effective}</p>
      </header>
      <div className="vd-legal__layout">
        {content.sections.length > 0 && (
          <>
            {/* Below 1024px: collapsed above the text. From 1024px: always open, beside it. Only one is shown. */}
            <nav aria-label="สารบัญ" className="vd-legal__toc vd-legal__toc--compact">
              <details>
                <summary>สารบัญ</summary>
                <ContentsList sections={content.sections} />
              </details>
            </nav>
            <nav aria-label="สารบัญ" className="vd-legal__toc vd-legal__toc--side">
              <p className="vd-legal__toc-title">สารบัญ</p>
              <ContentsList sections={content.sections} />
            </nav>
          </>
        )}
        <div className="vd-legal__body vd-prose">
          <LegalMarkdown source={content.body} />
        </div>
      </div>
    </article>
  );
}
